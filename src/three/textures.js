import * as THREE from 'three'
import { ink, shade } from '../game/color.js'

/** Draw onto a canvas and wrap it as a texture. */
export function canvasTexture(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  return t
}

// Deterministic pseudo-random so textures look the same every load.
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296)
}

function speckle(ctx, w, h, n, colors, size, r) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]
    ctx.fillRect(r() * w, r() * h, size, size * (1 + r()))
  }
}

/** Outfield: mowing stripes + blade noise. Mapped once across the whole ground disc. */
export function grassTexture(night, pattern = 'stripes') {
  return canvasTexture(2048, 2048, (ctx, w, h) => {
    const a = night ? '#2c8a45' : '#4c9e37'
    const b = night ? '#3aa253' : '#5cb243'
    const bands = 22
    if (pattern === 'rings') {
      ctx.fillStyle = a
      ctx.fillRect(0, 0, w, h)
      for (let i = bands; i > 0; i--) {
        ctx.fillStyle = i % 2 ? a : b
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, (i * w) / bands / 2 + 30, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 ? a : b
        ctx.fillRect(0, (i * h) / bands, w, h / bands + 1)
      }
      if (pattern === 'checks') {
        // cross-mowing: lighten alternate squares
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        for (let i = 0; i < bands; i += 2) ctx.fillRect((i * w) / bands, 0, w / bands, h)
      }
    }
    const r = rng(11)
    speckle(ctx, w, h, 90000, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.05)', 'rgba(20,70,25,0.12)'], 2, r)
  })
}

/** Pitch strip: rolled clay with footmarks; length runs along the texture's height. */
export function pitchTexture() {
  return canvasTexture(256, 1792, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, '#c4a46c')
    g.addColorStop(0.5, '#d8c08b')
    g.addColorStop(1, '#c3a36a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = rng(5)
    speckle(ctx, w, h, 26000, ['rgba(120,90,50,0.18)', 'rgba(255,255,255,0.12)', 'rgba(90,70,40,0.12)'], 1.5, r)
    // mowing lines
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = x % 64 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
      ctx.fillRect(x, 0, 32, h)
    }
    // hairline cracks
    ctx.strokeStyle = 'rgba(90,65,35,0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i < 40; i++) {
      let x = r() * w
      let y = r() * h
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 5; k++) ctx.lineTo((x += (r() - 0.5) * 30), (y += r() * 40))
      ctx.stroke()
    }
    // footmarks near both ends
    for (const cy of [h * 0.07, h * 0.93]) {
      const rg = ctx.createRadialGradient(w / 2, cy, 4, w / 2, cy, w * 0.55)
      rg.addColorStop(0, 'rgba(140,105,60,0.55)')
      rg.addColorStop(1, 'rgba(140,105,60,0)')
      ctx.fillStyle = rg
      ctx.fillRect(0, cy - w * 0.6, w, w * 1.2)
    }
  })
}

/** Rows of spectators in the two teams' colours. Tiles around the stands. */
export function crowdTexture(colors, { density = 1, seats = null, bg = '#14171f', repeat = [14, 3] } = {}) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    const r = rng(23)
    const skins = ['#e9bf9b', '#c98d63', '#a86d45', '#7f5134', '#f0cfb3']
    const rows = 16
    const rh = h / rows
    for (let row = 0; row < rows; row++) {
      const y0 = row * rh
      if (seats) {
        // coloured seats showing between spectators
        ctx.fillStyle = seats[row % seats.length]
        ctx.fillRect(0, y0 + rh - 11, w, 7)
      }
      ctx.fillStyle = seats ? 'rgba(0,0,0,0.45)' : '#0c0e14'
      ctx.fillRect(0, y0 + rh - 4, w, 4) // seat row shadow
      for (let x = 2; x < w; x += 9 + r() * 4) {
        if (r() > density * 0.94) continue // empty seat
        const c = colors[Math.floor(r() * colors.length)]
        const bob = r() * 3
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.ellipse(x + 4, y0 + rh - 8 - bob, 4.5, 7, 0, Math.PI, 0)
        ctx.fill()
        ctx.fillRect(x - 0.5, y0 + rh - 8 - bob, 9, 6)
        ctx.fillStyle = skins[Math.floor(r() * skins.length)]
        ctx.beginPath()
        ctx.arc(x + 4, y0 + rh - 17 - bob, 3.4, 0, Math.PI * 2)
        ctx.fill()
        if (r() < 0.05) {
          ctx.fillStyle = colors[Math.floor(r() * colors.length)]
          ctx.fillRect(x + 6, y0 + rh - 30 - bob, 10, 7) // flag
          ctx.fillStyle = '#ddd'
          ctx.fillRect(x + 5, y0 + rh - 30 - bob, 1, 14)
        }
      }
    }
  }, { repeat })
}

/** Red-brick pavilion facade with cream windows and white balconies. */
export function pavilionTexture() {
  return canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#8e3b2a'
    ctx.fillRect(0, 0, w, h)
    const r = rng(9)
    for (let y = 0; y < h; y += 8) {
      for (let x = (y / 8) % 2 ? -10 : 0; x < w; x += 20) {
        ctx.fillStyle = `hsl(${10 + r() * 8}, ${45 + r() * 15}%, ${30 + r() * 10}%)`
        ctx.fillRect(x + 1, y + 1, 18, 6)
      }
    }
    for (let floor = 0; floor < 3; floor++) {
      const y = 40 + floor * 110
      for (let x = 30; x < w - 40; x += 70) {
        ctx.fillStyle = '#f1e9d6'
        ctx.fillRect(x - 4, y - 4, 44, 76)
        ctx.fillStyle = floor === 0 ? '#2a3442' : '#3d4b5f'
        ctx.fillRect(x, y, 36, 68)
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillRect(x + 3, y + 3, 10, 62)
      }
      // balcony rail
      ctx.fillStyle = '#f7f4ec'
      ctx.fillRect(0, y + 70, w, 8)
      for (let x = 0; x < w; x += 10) ctx.fillRect(x, y + 58, 3, 14)
    }
  })
}

/** LED advertising boards. */
export function boardsTexture(colors, venue) {
  const words = ['CRICKET CLASH', 'LIVE', venue.split(',')[0].toUpperCase(), 'MAXIMUM 6', 'FOUR!', 'PLAY FAIR']
  return canvasTexture(4096, 64, (ctx, w, h) => {
    const n = 16
    for (let i = 0; i < n; i++) {
      const c = i % 3 === 0 ? colors[0] : i % 3 === 1 ? colors[1] : '#0b0f17'
      ctx.fillStyle = c
      ctx.fillRect((i * w) / n, 0, w / n - 2, h)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect((i * w) / n, 0, w / n - 2, 10)
      ctx.fillStyle = c === '#0b0f17' ? '#ffd34d' : ink(c)
      ctx.font = '900 30px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(words[i % words.length], (i + 0.5) * (w / n), 44)
    }
  }, { repeat: [3, 1] })
}

/** Sky dome gradient (+ stars at night). */
export function skyTexture(night) {
  return canvasTexture(64, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    if (night) {
      g.addColorStop(0, '#01030a')
      g.addColorStop(0.45, '#0b1230')
      g.addColorStop(0.5, '#1f2453')
      g.addColorStop(1, '#1f2453')
    } else {
      g.addColorStop(0, '#2f7fdc')
      g.addColorStop(0.48, '#a9d4ff')
      g.addColorStop(1, '#cfe7ff')
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    if (night) {
      const r = rng(3)
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`
        ctx.fillRect(r() * w, r() * h * 0.42, 1, 1)
      }
    }
  })
}

/** Soft radial glow for floodlight halos (additive sprites). */
export function glowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,252,235,1)')
    g.addColorStop(0.2, 'rgba(255,245,200,0.55)')
    g.addColorStop(1, 'rgba(255,245,200,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

/** Floodlight panel: grid of lamps. */
export function lampTexture() {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#20242c'
    ctx.fillRect(0, 0, w, h)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 7; c++) {
        const g = ctx.createRadialGradient(18 + c * 36, 20 + r * 40, 2, 18 + c * 36, 20 + r * 40, 17)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(1, '#ffe6a0')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(4 + c * 36, 4 + r * 40, 30, 32, 6)
        ctx.fill()
      }
    }
  })
}

/**
 * Jersey wrapped around the torso cylinder: u=0 is the chest, u=0.5 the back.
 * Back: player name + big number. Front: team short name + small number.
 */
export function jerseyTexture(team, player, umpire = false) {
  const { primary, secondary, accent } = umpire ? { primary: '#c2306f', secondary: '#9c1f57', accent: '#16181d' } : team.colors
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, shade(primary, 0.08))
    g.addColorStop(1, shade(primary, -0.18))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // side panels (u = .25 and .75)
    for (const u of [0.25, 0.75]) {
      ctx.fillStyle = secondary
      ctx.fillRect(u * w - 22, 0, 44, h)
      ctx.fillStyle = shade(secondary, -0.25)
      ctx.fillRect(u * w - 22, 0, 6, h)
    }
    // kit design (wraps the torso: u=0 chest, u=0.5 back)
    const kit = umpire ? 'plain' : team.kit ?? 'sash'
    const both = (draw) => {
      draw(0)
      draw(w)
    }
    ctx.save()
    if (kit === 'sash') {
      ctx.fillStyle = shade(secondary, -0.05)
      ctx.globalAlpha = 0.6
      both((o) => {
        ctx.beginPath()
        ctx.moveTo(o - w * 0.14, 0)
        ctx.lineTo(o - w * 0.04, 0)
        ctx.lineTo(o + w * 0.12, h)
        ctx.lineTo(o + w * 0.02, h)
        ctx.fill()
      })
    } else if (kit === 'shoulders') {
      // contrasting yoke across the shoulders with a thin stripe below
      ctx.fillStyle = secondary
      ctx.fillRect(0, 0, w, h * 0.2)
      ctx.fillStyle = accent
      ctx.fillRect(0, h * 0.2, w, 5)
      ctx.fillStyle = shade(secondary, 0.25)
      ctx.fillRect(0, h * 0.2 + 5, w, 3)
    } else if (kit === 'chevron') {
      ctx.fillStyle = secondary
      ctx.globalAlpha = 0.85
      for (const cx of [0, w * 0.5, w]) {
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.16, h * 0.08)
        ctx.lineTo(cx, h * 0.32)
        ctx.lineTo(cx + w * 0.16, h * 0.08)
        ctx.lineTo(cx + w * 0.16, h * 0.16)
        ctx.lineTo(cx, h * 0.4)
        ctx.lineTo(cx - w * 0.16, h * 0.16)
        ctx.fill()
      }
    } else if (kit === 'stripes') {
      ctx.fillStyle = shade(primary, 0.12)
      for (let x = 0; x < w; x += 18) ctx.fillRect(x, 0, 6, h)
    } else if (kit === 'gradient') {
      const gg = ctx.createLinearGradient(0, 0, 0, h)
      gg.addColorStop(0, 'rgba(0,0,0,0)')
      gg.addColorStop(1, shade(secondary === '#c9a227' ? accent : secondary, -0.2))
      ctx.fillStyle = gg
      ctx.globalAlpha = 0.85
      ctx.fillRect(0, h * 0.35, w, h * 0.65)
    }
    ctx.restore()
    // fabric weave
    const wr = rng(31)
    speckle(ctx, w, h, 5000, ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)'], 1, wr)
    // collar
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, w, 10)
    if (umpire) return
    const t = ink(primary)
    ctx.fillStyle = t
    ctx.strokeStyle = shade(secondary, -0.3)
    ctx.lineWidth = 3
    ctx.textAlign = 'center'
    // back: name + number
    const name = player.short.toUpperCase()
    ctx.font = `900 ${name.length > 9 ? 22 : 28}px 'Arial Black', system-ui, sans-serif`
    ctx.fillText(name, w * 0.5, 62)
    ctx.font = "900 112px 'Arial Black', system-ui, sans-serif"
    ctx.strokeText(String(player.number), w * 0.5, 178)
    ctx.fillText(String(player.number), w * 0.5, 178)
    // front: team name across the chest (wraps the u=0 seam) + small number
    ctx.font = "900 30px 'Arial Black', system-ui, sans-serif"
    for (const x of [0, w]) ctx.fillText(team.short, x, 96)
    ctx.font = "900 26px 'Arial Black', system-ui, sans-serif"
    ctx.fillText(String(player.number), w * 0.93, 140)
  })
}

/**
 * Face texture for a sphere head (u=0.25 is the front). Eyes, brows, nose, mouth, beard, hairline.
 */
export function faceTexture(look) {
  const { skin, hair, beard, hairStyle } = look
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = skin
    ctx.fillRect(0, 0, w, h)
    const r = rng(skin.length * 7 + (beard ? 3 : 1))
    // skin texture + shading towards the back of the head
    speckle(ctx, w, h, 9000, [shade(skin, -0.06), shade(skin, 0.05)], 2, r)
    const sg = ctx.createLinearGradient(0, 0, w, 0)
    sg.addColorStop(0, 'rgba(0,0,0,0.12)')
    sg.addColorStop(0.25, 'rgba(0,0,0,0)')
    sg.addColorStop(0.5, 'rgba(0,0,0,0.14)')
    sg.addColorStop(0.75, 'rgba(0,0,0,0.22)')
    sg.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, w, h)
    const fx = w * 0.25
    const Y = (f) => h * f
    const dark = shade(skin, -0.35)
    // jaw / cheekbone shading
    const jg = ctx.createRadialGradient(fx, Y(0.5), 20, fx, Y(0.55), w * 0.14)
    jg.addColorStop(0, 'rgba(255,255,255,0.06)')
    jg.addColorStop(1, 'rgba(0,0,0,0.16)')
    ctx.fillStyle = jg
    ctx.fillRect(fx - w * 0.16, Y(0.3), w * 0.32, Y(0.6))
    // hair (top + back)
    ctx.fillStyle = hair
    const line = [0.3, 0.26, 0.34, 0.24][hairStyle] * h
    ctx.fillRect(0, 0, w, line)
    ctx.beginPath()
    ctx.ellipse(w * 0.75, line, w * 0.2, h * (hairStyle === 2 ? 0.12 : 0.24), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(fx, line, w * 0.11, h * 0.05, 0, 0, Math.PI)
    ctx.fill()
    speckle(ctx, w, line + 10, 3000, [shade(hair, 0.2), shade(hair, -0.2)], 2, r)
    // ears
    ctx.fillStyle = shade(skin, -0.12)
    for (const ex of [0.03, 0.47]) {
      ctx.beginPath()
      ctx.ellipse(ex * w, Y(0.5), 18, 36, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // eye sockets
    for (const sx of [-1, 1]) {
      const eg = ctx.createRadialGradient(fx + sx * 40, Y(0.47), 4, fx + sx * 40, Y(0.47), 34)
      eg.addColorStop(0, 'rgba(0,0,0,0.18)')
      eg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = eg
      ctx.fillRect(fx + sx * 40 - 36, Y(0.47) - 36, 72, 72)
    }
    // brows
    ctx.strokeStyle = shade(hair, 0.05)
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(fx + sx * 18, Y(0.405))
      ctx.quadraticCurveTo(fx + sx * 40, Y(0.375), fx + sx * 62, Y(0.41))
      ctx.stroke()
    }
    // eyes: white, iris, pupil, highlight, lash line
    const iris = ['#4a2f1c', '#3a2414', '#5c3b22', '#2e3b2a'][Math.floor(r() * 4)]
    for (const sx of [-1, 1]) {
      const ex = fx + sx * 40
      ctx.fillStyle = '#efe9e1'
      ctx.beginPath()
      ctx.ellipse(ex, Y(0.47), 19, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = iris
      ctx.beginPath()
      ctx.arc(ex, Y(0.47), 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0b0705'
      ctx.beginPath()
      ctx.arc(ex, Y(0.47), 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(ex + 3, Y(0.46), 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1d140e'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.ellipse(ex, Y(0.47), 20, 11, 0, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
      ctx.strokeStyle = shade(skin, -0.2)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(ex, Y(0.48), 19, 12, 0, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
    // nose: bridge highlight, sides, nostrils
    const ng = ctx.createLinearGradient(fx - 16, 0, fx + 16, 0)
    ng.addColorStop(0, 'rgba(0,0,0,0.14)')
    ng.addColorStop(0.5, 'rgba(255,255,255,0.1)')
    ng.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = ng
    ctx.fillRect(fx - 16, Y(0.46), 32, Y(0.17))
    ctx.fillStyle = shade(skin, -0.4)
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(fx + sx * 9, Y(0.625), 6, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // lips
    for (const fill of [shade(skin, -0.26), 'rgba(170,64,60,0.28)']) {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(fx - 26, Y(0.715))
      ctx.quadraticCurveTo(fx, Y(0.69), fx + 26, Y(0.715))
      ctx.quadraticCurveTo(fx, Y(0.765), fx - 26, Y(0.715))
      ctx.fill()
    }
    ctx.strokeStyle = shade(skin, -0.5)
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(fx - 25, Y(0.716))
    ctx.quadraticCurveTo(fx, Y(0.725), fx + 25, Y(0.716))
    ctx.stroke()
    // beard / stubble
    if (beard) {
      ctx.fillStyle = hair
      ctx.globalAlpha = 0.82
      ctx.beginPath()
      ctx.moveTo(fx - 92, Y(0.55))
      ctx.quadraticCurveTo(fx - 80, Y(0.93), fx, Y(0.94))
      ctx.quadraticCurveTo(fx + 80, Y(0.93), fx + 92, Y(0.55))
      ctx.quadraticCurveTo(fx + 60, Y(0.8), fx + 32, Y(0.77))
      ctx.lineTo(fx - 32, Y(0.77))
      ctx.quadraticCurveTo(fx - 60, Y(0.8), fx - 92, Y(0.55))
      ctx.fill()
      ctx.fillRect(fx - 30, Y(0.665), 60, 9) // moustache
      ctx.globalAlpha = 1
      speckle(ctx, w * 0.5, h, 1500, [shade(hair, 0.25)], 2, r)
    } else {
      // light stubble shadow
      ctx.fillStyle = 'rgba(40,30,25,0.08)'
      ctx.beginPath()
      ctx.ellipse(fx, Y(0.8), 70, 50, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** Big-screen text. */
export function drawScreen(canvas, title, sub) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  ctx.fillStyle = '#04060b'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffd34d'
  ctx.textAlign = 'center'
  ctx.font = '900 64px system-ui, sans-serif'
  ctx.fillText(title, w / 2, h * 0.45)
  ctx.fillStyle = '#e8edf5'
  ctx.font = '700 40px system-ui, sans-serif'
  ctx.fillText(sub, w / 2, h * 0.8)
}
