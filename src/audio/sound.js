// Game audio: spoken commentary (Web Speech API) and synthesised stadium sounds (Web Audio).
import { LANGS } from '../game/commentary.js'

const PREFS = 'cricket-clash-audio'

function loadPrefs() {
  try {
    return { sound: true, voice: true, lang: 'hi', ...JSON.parse(localStorage.getItem(PREFS) || '{}') }
  } catch {
    return { sound: true, voice: true, lang: 'hi' }
  }
}

class Sound {
  constructor() {
    this.prefs = loadPrefs()
    this.ctx = null
    this.crowdGain = null
    this.voices = []
    this.samples = {} // name → AudioBuffer, from public/sounds (optional; synth is the fallback)
    if (typeof speechSynthesis !== 'undefined') {
      const load = () => (this.voices = speechSynthesis.getVoices())
      load()
      speechSynthesis.addEventListener?.('voiceschanged', load)
    }
  }

  set(p) {
    this.prefs = { ...this.prefs, ...p }
    try {
      localStorage.setItem(PREFS, JSON.stringify(this.prefs))
    } catch {
      /* not persisted */
    }
    if (!this.prefs.sound) this.stopCrowd()
    else if (this.ctx) this.startCrowd()
    if (!this.prefs.voice) speechSynthesis?.cancel()
  }

  /** Must be called from a tap/click (browsers block audio until then). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this.noise = this.makeNoise()
      this.loadSamples()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    // a silent utterance unlocks speech on iOS
    if (typeof speechSynthesis !== 'undefined' && !this.speechUnlocked) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
      this.speechUnlocked = true
    }
  }

  /**
   * Optional recorded SFX. List files in public/sounds/manifest.json, e.g.
   *   { "bat": "bat_hit.mp3", "roar": "crowd_cheer.mp3" }
   * Any name used by sfx() can be overridden; anything missing keeps the synthesised sound.
   */
  async loadSamples() {
    try {
      const res = await fetch('/sounds/manifest.json', { cache: 'no-cache' })
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return
      const list = await res.json()
      await Promise.all(
        Object.entries(list).map(async ([name, file]) => {
          try {
            const r = await fetch(`/sounds/${file}`)
            if (!r.ok) return
            this.samples[name] = await this.ctx.decodeAudioData(await r.arrayBuffer())
          } catch {
            /* bad file: keep the synth */
          }
        }),
      )
    } catch {
      /* no manifest */
    }
  }

  playSample(name, intensity, out) {
    const buf = this.samples[name]
    if (!buf) return false
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = 0.96 + Math.random() * 0.08 // tiny variation so repeats don't sound canned
    const g = this.ctx.createGain()
    g.gain.value = Math.min(1.5, intensity)
    src.connect(g).connect(out)
    src.start()
    return true
  }

  /** Output bus for one effect: straight to the master, or through a stereo panner (-1 left … +1 right). */
  bus(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.master
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    p.connect(this.master)
    return p
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      // pinkish noise
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1)
      d[i] = b * 6 + (Math.random() * 2 - 1) * 0.25
    }
    return buf
  }

  noiseSource(loop = false) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = loop
    return s
  }

  // ----- crowd ambience -----
  startCrowd() {
    if (!this.ctx || !this.prefs.sound || this.crowdGain) return
    const src = this.noiseSource(true)
    const band = this.ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 650
    band.Q.value = 0.6
    this.crowdGain = this.ctx.createGain()
    this.crowdGain.gain.value = 0.05
    // slow swell so the crowd "breathes"
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.13
    lfoGain.gain.value = 0.015
    lfo.connect(lfoGain).connect(this.crowdGain.gain)
    src.connect(band).connect(this.crowdGain).connect(this.master)
    src.start()
    lfo.start()
    this.crowdSrc = [src, lfo]
  }

  stopCrowd() {
    this.crowdSrc?.forEach((s) => s.stop())
    this.crowdSrc = null
    this.crowdGain?.disconnect()
    this.crowdGain = null
  }

  // ----- effects -----
  /** Play an effect. pan: stereo position of the source on screen (-1 … 1), for a sense of where it happened. */
  sfx(name, intensity = 1, pan = 0) {
    if (!this.ctx || !this.prefs.sound) return
    const out = this.bus(pan)
    if (this.playSample(name, intensity, out)) return
    const t = this.ctx.currentTime
    const env = (node, peak, attack, decay) => {
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
      node.connect(g).connect(out)
      return g
    }
    switch (name) {
      case 'bat': {
        // willow "tock": short resonant ping + click
        const o = this.ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.setValueAtTime(1150, t)
        o.frequency.exponentialRampToValueAtTime(700, t + 0.08)
        env(o, 0.5 * intensity, 0.002, 0.12)
        o.start(t)
        o.stop(t + 0.2)
        const n = this.noiseSource()
        const hp = this.ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 2500
        env(n.connect(hp), 0.35 * intensity, 0.001, 0.04)
        n.start(t)
        n.stop(t + 0.08)
        break
      }
      case 'edge': {
        // thin "nick" off the edge: high, short, no body
        const o = this.ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.setValueAtTime(2600, t)
        o.frequency.exponentialRampToValueAtTime(1700, t + 0.04)
        env(o, 0.28 * intensity, 0.001, 0.05)
        o.start(t)
        o.stop(t + 0.08)
        const n = this.noiseSource()
        const hp = this.ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 4000
        env(n.connect(hp), 0.3 * intensity, 0.001, 0.025)
        n.start(t)
        n.stop(t + 0.05)
        break
      }
      case 'bounce': {
        const o = this.ctx.createOscillator()
        o.frequency.setValueAtTime(180, t)
        o.frequency.exponentialRampToValueAtTime(90, t + 0.06)
        env(o, 0.25, 0.002, 0.07)
        o.start(t)
        o.stop(t + 0.1)
        break
      }
      case 'stumps': {
        for (const [f, d] of [[620, 0], [470, 0.03], [820, 0.05]]) {
          const o = this.ctx.createOscillator()
          o.type = 'square'
          o.frequency.value = f
          const g = this.ctx.createGain()
          g.gain.setValueAtTime(0.0001, t + d)
          g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.003)
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.09)
          o.connect(g).connect(out)
          o.start(t + d)
          o.stop(t + d + 0.12)
        }
        break
      }
      case 'catch': {
        const n = this.noiseSource()
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 900
        env(n.connect(lp), 0.4, 0.002, 0.08)
        n.start(t)
        n.stop(t + 0.12)
        break
      }
      case 'roar':
      case 'cheer': {
        // crowd erupts: band-limited noise swell
        const n = this.noiseSource(true)
        const bp = this.ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900
        bp.Q.value = 0.5
        const g = this.ctx.createGain()
        const peak = (name === 'roar' ? 0.55 : 0.32) * intensity
        const dur = name === 'roar' ? 3.2 : 2
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(peak, t + 0.25)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        n.connect(bp).connect(g).connect(out)
        n.start(t)
        n.stop(t + dur + 0.1)
        this.sfx('applause', intensity)
        break
      }
      case 'applause': {
        // lots of tiny claps
        const len = Math.floor(this.ctx.sampleRate * 2.4)
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let k = 0; k < 900 * intensity; k++) {
          const at = Math.floor(Math.random() * len * (0.2 + 0.8 * Math.random()))
          const amp = 0.25 + Math.random() * 0.4
          for (let i = 0; i < 260 && at + i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / 50)
        }
        const s = this.ctx.createBufferSource()
        s.buffer = buf
        const hp = this.ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 900
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0.35, t)
        g.gain.linearRampToValueAtTime(0.0001, t + 2.4)
        s.connect(hp).connect(g).connect(out)
        s.start(t)
        break
      }
      case 'appeal': {
        // "Howzat!" — rising vocal-ish formant
        const o = this.ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(220, t)
        o.frequency.linearRampToValueAtTime(330, t + 0.35)
        const bp = this.ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 800
        env(o.connect(bp), 0.18, 0.05, 0.45)
        o.start(t)
        o.stop(t + 0.6)
        this.sfx('cheer', 0.5)
        break
      }
      case 'click': {
        const o = this.ctx.createOscillator()
        o.frequency.value = 900
        env(o, 0.08, 0.001, 0.03)
        o.start(t)
        o.stop(t + 0.05)
        break
      }
      default:
    }
  }

  // ----- commentary voice -----
  say(text) {
    if (!this.prefs.voice || !text || typeof speechSynthesis === 'undefined') return
    const lang = LANGS[this.prefs.lang] ?? LANGS.en
    const voice = lang.voice.map((code) => this.voices.find((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()))).find(Boolean)
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? lang.voice[0]
    u.rate = 1.05
    u.pitch = 1
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  }

  /** Is there a native voice for the chosen language? (Marathi falls back to Hindi on many devices.) */
  voiceFor(langKey) {
    const lang = LANGS[langKey]
    return lang.voice.map((code) => this.voices.find((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()))).find(Boolean)
  }
}

export const sound = new Sound()
