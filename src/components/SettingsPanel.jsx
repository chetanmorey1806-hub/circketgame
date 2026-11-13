import { useState } from 'react'
import { sound } from '../audio/sound.js'
import { LANGS } from '../game/commentary.js'
import { getQuality, setQuality } from '../three/quality.js'

function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map(([v, label]) => (
        <button key={String(v)} className={`chip ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Commentary language, sound, voice and graphics quality. */
export default function SettingsPanel() {
  const [audio, setAudio] = useState(sound.prefs)
  const [quality, setQ] = useState(getQuality())
  const update = (p) => {
    sound.unlock()
    sound.set(p)
    setAudio({ ...sound.prefs })
    if (p.lang) sound.say({ en: 'Welcome to Cricket Clash!', hi: 'क्रिकेट क्लैश में आपका स्वागत है!', mr: 'क्रिकेट क्लॅशमध्ये तुमचं स्वागत!' }[p.lang])
  }
  return (
    <div className="settings-panel">
      <div className="row3">
        <div className="field">
          <label>Commentary language</label>
          <Chips options={Object.entries(LANGS).map(([k, l]) => [k, l.label])} value={audio.lang} onChange={(lang) => update({ lang })} />
        </div>
        <div className="field">
          <label>Stadium sound</label>
          <Chips options={[[true, '🔊 On'], [false, '🔇 Off']]} value={audio.sound} onChange={(v) => update({ sound: v })} />
        </div>
        <div className="field">
          <label>Commentary voice</label>
          <Chips options={[[true, '🎙 On'], [false, 'Off']]} value={audio.voice} onChange={(v) => update({ voice: v })} />
        </div>
      </div>
      <div className="field">
        <label>Graphics</label>
        <Chips options={[['low', 'Low (older phones)'], ['medium', 'Medium'], ['high', 'HD']]} value={quality} onChange={(q) => { setQuality(q); setQ(q) }} />
      </div>
    </div>
  )
}
