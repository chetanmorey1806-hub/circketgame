import * as THREE from 'three'
import { shade } from '../game/color.js'
import { BOUNDARY, CREASE_Z, STUMPS_Z } from '../game/field.js'
import { venueStyle } from '../game/venues.js'
import { boardsTexture, canvasTexture, crowdTexture, drawScreen, glowTexture, grassTexture, lampTexture, pavilionTexture, pitchTexture, skyTexture } from './textures.js'

function flat(geo, material, x, z, y = 0.006) {
  const m = new THREE.Mesh(geo, material)
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.receiveShadow = true
  return m
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })

/** Stumps + bails at one end; returned parts are animated when broken. */
export function makeStumps(z) {
  const g = new THREE.Group()
  g.position.set(0, 0, z)
  const wood = new THREE.MeshStandardMaterial({ color: '#efe1bb', roughness: 0.5 })
  const bailMat = new THREE.MeshStandardMaterial({ color: '#e5bf72', roughness: 0.45 })
  const stumpGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.71, 12)
  const stumps = [-0.114, 0, 0.114].map((x) => {
    const s = new THREE.Mesh(stumpGeo, wood)
    s.position.set(x, 0.355, 0)
    s.castShadow = true
    g.add(s)
    return s
  })
  const bailGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.11, 8)
  const bails = [-0.057, 0.057].map((x) => {
    const b = new THREE.Mesh(bailGeo, bailMat)
    b.rotation.z = Math.PI / 2
    b.position.set(x, 0.72, 0)
    b.castShadow = true
    g.add(b)
    return b
  })
  g.userData = { stumps, bails }
  return g
}

export function resetStumps(g) {
  const { stumps, bails } = g.userData
  stumps.forEach((s, i) => {
    s.position.set([-0.114, 0, 0.114][i], 0.355, 0)
    s.rotation.set(0, 0, 0)
  })
  bails.forEach((b, i) => {
    b.position.set([-0.057, 0.057][i], 0.72, 0)
    b.rotation.set(0, 0, Math.PI / 2)
  })
}

/** A sloped ring of seats (viewed from inside). */
function tier(scene, material, r0, r1, y0, y1, thetaStart = 0, thetaLength = Math.PI * 2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 128, 1, true, thetaStart, thetaLength), material)
  m.position.y = (y0 + y1) / 2
  scene.add(m)
  return m
}

function ring(scene, r, y, height, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 128, 1, true), material)
  m.position.y = y
  scene.add(m)
  return m
}

/**
 * Volumetric light beam: an open cone with a shader that fades along its length and towards its edges
 * (fresnel), added on top of the scene — the look of floodlights through night haze.
 */
const BEAM_MAT = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color('#fff4d6') }, strength: { value: 0.42 } },
  vertexShader: `
    varying float vAlong;
    varying vec3 vN;
    varying vec3 vView;
    void main() {
      vAlong = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 color;
    uniform float strength;
    varying float vAlong;
    varying vec3 vN;
    varying vec3 vView;
    void main() {
      float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
      float fall = pow(vAlong, 1.7);
      gl_FragColor = vec4(color * strength * edge * fall, 1.0);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
})

export function addBeam(scene, from, to, radius = 26) {
  const len = from.distanceTo(to)
  const geo = new THREE.CylinderGeometry(2, radius, len, 32, 1, true)
  geo.translate(0, -len / 2, 0) // tip at the origin, widening along -y
  const beam = new THREE.Mesh(geo, BEAM_MAT)
  beam.position.copy(from)
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())
  beam.renderOrder = 5
  scene.add(beam)
  return beam
}

function floodlight(scene, x, z, height, night, glow, lamp) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, height, 10), std('#3a404b', { metalness: 0.4, roughness: 0.6 }))
  pole.position.set(x, height / 2, z)
  scene.add(pole)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(16, 10, 1),
    [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshBasicMaterial({ map: lamp, color: night ? '#ffffff' : '#9aa3b2' }) : std('#22262e'))),
  )
  head.position.set(x * 0.98, height + 2, z * 0.98)
  head.lookAt(0, 20, 0)
  scene.add(head)
  if (night) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#fff6dc', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    s.scale.set(70, 70, 1)
    s.position.copy(head.position).multiplyScalar(0.985)
    scene.add(s)
    addBeam(scene, head.position.clone().multiplyScalar(0.97), new THREE.Vector3(x * 0.12, 0, z * 0.12), 30)
  }
}

function trees(scene, count, rMin, rMax, palm = false) {
  const trunkMat = std('#5b4632')
  const leafMat = std(palm ? '#3f8f3a' : '#2f6b34', { roughness: 0.9 })
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.sin(i * 12.9) * 0.1
    const r = rMin + ((Math.sin(i * 7.3) + 1) / 2) * (rMax - rMin)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const hgt = palm ? 14 + (i % 4) * 2 : 9 + (i % 5) * 2
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(palm ? 0.35 : 0.6, palm ? 0.5 : 0.9, hgt, 6), trunkMat)
    trunk.position.set(x, hgt / 2, z)
    scene.add(trunk)
    if (palm) {
      for (let k = 0; k < 6; k++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 4), leafMat)
        leaf.position.set(x, hgt, z)
        leaf.rotation.set(Math.PI / 2.6, (k / 6) * Math.PI * 2, 0, 'YXZ')
        leaf.translateY(2.6)
        scene.add(leaf)
      }
    } else {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(hgt * 0.45, 1), leafMat)
      crown.position.set(x, hgt + hgt * 0.2, z)
      crown.scale.y = 0.85
      scene.add(crown)
    }
  }
}

/**
 * Build the ground and the stadium for a venue. Returns handles for things that animate.
 */
export function buildStadium(scene, { night, teamColors, venue, whites = false, quality }) {
  const v = venueStyle(venue)
  const h = {}

  // sky + light
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(night), side: THREE.BackSide, fog: false })))
  scene.add(new THREE.HemisphereLight(night ? '#7f93e6' : '#cfe6ff', night ? '#1d3a22' : '#3d6b35', night ? 0.42 : 1.0))
  const key = new THREE.DirectionalLight(night ? '#fff6e4' : v.style === 'desert' ? '#ffe7c4' : '#fff4dc', night ? 2.1 : 2.6)
  key.position.set(night ? 30 : 40, 75, night ? 25 : -30)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadows, quality.shadows)
  Object.assign(key.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 20, far: 200 })
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  scene.add(key)
  if (night && quality.fill) {
    for (const [x, z] of [[-60, -60], [60, 60], [-60, 60]]) {
      const f = new THREE.DirectionalLight('#fff1d6', 0.55)
      f.position.set(x, 60, z)
      scene.add(f)
    }
  }

  // ground: outfield pattern depends on the venue
  const pattern = v.style === 'heritage' ? 'checks' : v.style === 'open' ? 'rings' : 'stripes'
  scene.add(flat(new THREE.CircleGeometry(80, 160), new THREE.MeshStandardMaterial({ map: grassTexture(night, pattern), roughness: 0.92 }), 0, 0, 0))
  scene.add(flat(new THREE.RingGeometry(80, 170, 128), std(night ? '#24432b' : '#2f5a37', { roughness: 0.95 }), 0, 0, -0.01))
  scene.add(flat(new THREE.PlaneGeometry(22, 28), new THREE.MeshStandardMaterial({ color: night ? '#40a457' : '#52b464', roughness: 0.9, transparent: true, opacity: 0.35 }), 0, 0, 0.002))

  // pitch + creases
  scene.add(flat(new THREE.PlaneGeometry(3.05, 22.6), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }), 0, 0, 0.004))
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  for (const s of [-1, 1]) {
    scene.add(flat(new THREE.PlaneGeometry(3.66, 0.05), white, 0, s * CREASE_Z, 0.008))
    scene.add(flat(new THREE.PlaneGeometry(2.64, 0.05), white, 0, s * STUMPS_Z, 0.008))
    for (const x of [-1.32, 1.32]) scene.add(flat(new THREE.PlaneGeometry(0.05, 2.44), white, x, s * (CREASE_Z + 1.22), 0.008))
  }

  // 30-yard circle and boundary rope
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.09), white, 72)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    m4.compose(new THREE.Vector3(Math.cos(a) * 27.4, 0.009, Math.sin(a) * 27.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -a + Math.PI / 2)), new THREE.Vector3(1, 1, 1))
    dashes.setMatrixAt(i, m4)
  }
  scene.add(dashes)
  const rope = new THREE.Mesh(new THREE.TorusGeometry(BOUNDARY, 0.13, 10, 320), std(whites ? '#f2f2f2' : teamColors[1], { roughness: 0.5 }))
  rope.rotation.x = Math.PI / 2
  rope.position.y = 0.12
  rope.castShadow = true
  scene.add(rope)

  // LED boards
  const boardsTex = boardsTexture(teamColors, venue)
  boardsTex.repeat.x = -3 // viewed from inside the ring, so flip to read correctly
  ring(scene, 67, 0.55, 1.1, new THREE.MeshStandardMaterial({ map: boardsTex, emissive: '#ffffff', emissiveMap: boardsTex, emissiveIntensity: night ? 0.9 : 0.4, side: THREE.BackSide }))
  h.boardsTex = boardsTex

  // sightscreens: white for the red ball (Tests), black for the white ball
  const screenMat = std(whites ? '#f4f4f0' : '#07090d', { roughness: 0.9 })
  for (const s of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 0.5), screenMat)
    sc.position.set(0, 2.1, s * 70)
    scene.add(sc)
  }

  // ----- stands by venue style -----
  const crowdColors = [teamColors[0], teamColors[1], '#f2f2f2', shade(teamColors[0], 0.3), shade(teamColors[1], -0.25), '#ffd166', '#1f2937']
  const density = quality.crowdDensity
  const crowdMat = (opts = {}) => {
    const tex = crowdTexture(crowdColors, { seats: v.seats, density, ...opts })
    h.crowdTex ??= tex
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.BackSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: night ? 0.18 : 0.05 })
  }
  const glow = glowTexture()
  const lamp = lampTexture()
  const concrete = std('#2a2f38', { side: THREE.BackSide })
  const ribbon = (r, y, color) => ring(scene, r, y, 2.2, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: night ? 0.7 : 0.2, side: THREE.BackSide }))
  const towers = (n, radius, height) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 4 + (i / n) * Math.PI * 2
      floodlight(scene, Math.cos(a) * radius, Math.sin(a) * radius, height, night, glow, lamp)
    }
  }
  ring(scene, 74, 0.8, 1.6, concrete)

  if (v.style === 'bowl') {
    // three steep tiers and a continuous roof — the giant bowls (Ahmedabad, MCG, Eden Gardens)
    const mat = crowdMat({ repeat: [18, 3] })
    tier(scene, mat, 74, 96, 1.5, 18)
    ribbon(98, 19.6, teamColors[0])
    tier(scene, mat, 100, 122, 21, 38)
    if (v.tiers >= 3) {
      ribbon(124, 39.6, teamColors[1])
      tier(scene, mat, 126, 146, 41, 56)
    }
    const top = v.tiers >= 3 ? 60 : 42
    const roof = new THREE.Mesh(new THREE.RingGeometry(v.tiers >= 3 ? 118 : 104, v.tiers >= 3 ? 156 : 132, 128), std('#1b1f27', { side: THREE.DoubleSide }))
    roof.rotation.x = -Math.PI / 2
    roof.position.y = top
    scene.add(roof)
    const lights = new THREE.Mesh(new THREE.TorusGeometry(v.tiers >= 3 ? 118 : 104, 0.5, 6, 220), new THREE.MeshBasicMaterial({ color: night ? '#fff6d8' : '#a9b2bf' }))
    lights.rotation.x = Math.PI / 2
    lights.position.y = top - 0.4
    scene.add(lights)
    if (night) {
      const r = v.tiers >= 3 ? 118 : 104
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2
        addBeam(scene, new THREE.Vector3(Math.cos(a) * r, top - 1, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * 25, 0, Math.sin(a) * 25), 22)
      }
    }
    if (v.lights === 'towers6') towers(6, 168, 85)
    else if (v.lights === 'towers') towers(4, 150, 72)
  } else if (v.style === 'modern') {
    const mat = crowdMat()
    tier(scene, mat, 74, 96, 1.5, 18)
    ribbon(98, 19.6, teamColors[0])
    tier(scene, mat, 100, 122, 21, 41)
    // cantilever roof sections over the upper tier
    for (let i = 0; i < 4; i++) {
      const roof = new THREE.Mesh(new THREE.RingGeometry(104, 132, 48, 1, i * (Math.PI / 2) + 0.12, Math.PI / 2 - 0.24), std('#1b1f27', { side: THREE.DoubleSide }))
      roof.rotation.x = -Math.PI / 2
      roof.position.y = 44
      scene.add(roof)
    }
    towers(4, 126, 70)
  } else if (v.style === 'heritage') {
    // low stands, a red-brick pavilion and the media centre (Lord's style)
    tier(scene, crowdMat({ repeat: [16, 1.5] }), 74, 90, 1.2, 9)
    const pav = new THREE.Group()
    const brick = pavilionTexture()
    const body = new THREE.Mesh(new THREE.BoxGeometry(46, 18, 12), [std('#8e3b2a'), std('#8e3b2a'), std('#3a3f47'), std('#3a3f47'), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85 }), std('#8e3b2a')])
    body.position.y = 9
    pav.add(body)
    const roofGeo = new THREE.CylinderGeometry(0.1, 9, 7, 4, 1)
    const roof = new THREE.Mesh(roofGeo, std('#3e4650'))
    roof.rotation.y = Math.PI / 4
    roof.scale.set(3.6, 1, 1)
    roof.position.y = 21.5
    pav.add(roof)
    for (const sx of [-1, 1]) {
      const turret = new THREE.Mesh(new THREE.BoxGeometry(5, 26, 5), std('#8e3b2a'))
      turret.position.set(sx * 24, 13, 0)
      pav.add(turret)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#c9b06a', { metalness: 0.4, roughness: 0.4 }))
      dome.position.set(sx * 24, 26, 0)
      pav.add(dome)
    }
    pav.position.set(-38, 0, 92)
    pav.lookAt(0, 0, 0)
    scene.add(pav)
    if (v.extras?.includes('mediaCentre')) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), std('#f2f4f7', { metalness: 0.3, roughness: 0.3 }))
      pod.scale.set(2.2, 0.8, 1)
      pod.position.set(40, 18, 96)
      pod.lookAt(0, 18, 0)
      scene.add(pod)
      const glass = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 0.5), std('#203248', { metalness: 0.6, roughness: 0.2 }))
      glass.position.set(40, 18, 85.5)
      glass.lookAt(0, 18, 0)
      scene.add(glass)
    }
    trees(scene, 46, 100, 140)
    if (v.lights !== 'none' || night) towers(4, 112, 55)
  } else if (v.style === 'open') {
    // grass banks with picnicking fans, a small stand, and the backdrop
    const bank = crowdMat({ bg: night ? '#2b6a33' : '#4f9a44', density: 0.4 * density, repeat: [20, 2] })
    tier(scene, bank, 72, 98, 0.2, 9)
    tier(scene, crowdMat(), 100, 116, 9.5, 22, Math.PI * 0.15, Math.PI * 0.7)
    towers(4, 120, 60)
    if (v.extras?.includes('mountain')) {
      const rock = std('#6f7a83', { roughness: 1 })
      for (const [x, w, hgt] of [[-120, 180, 120], [40, 260, 150], [200, 160, 100]]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.55, hgt, 7), rock)
        m.position.set(x, hgt / 2 - 4, 360)
        m.scale.z = 0.4
        scene.add(m)
      }
    }
    trees(scene, 34, 104, 150, v.extras?.includes('palms'))
  } else {
    // desert: sand-coloured bowl with the "ring of fire" roof lights (Dubai)
    tier(scene, crowdMat(), 74, 104, 1.5, 24)
    const roof = new THREE.Mesh(new THREE.RingGeometry(100, 124, 128), std('#cbb48a', { side: THREE.DoubleSide }))
    roof.rotation.x = -Math.PI / 2
    roof.position.y = 30
    scene.add(roof)
    const fire = new THREE.Mesh(new THREE.TorusGeometry(100.5, 0.8, 8, 240), new THREE.MeshBasicMaterial({ color: night ? '#fff1c4' : '#e9dcc0' }))
    fire.rotation.x = Math.PI / 2
    fire.position.y = 29.5
    scene.add(fire)
    if (night) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#fff3cf', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
        s.scale.set(36, 36, 1)
        s.position.set(Math.cos(a) * 100, 29, Math.sin(a) * 100)
        scene.add(s)
      }
    }
  }

  // big screen above the stands behind the striker's end
  const screenCanvas = document.createElement('canvas')
  screenCanvas.width = 1024
  screenCanvas.height = 420
  drawScreen(screenCanvas, 'CRICKET CLASH', venue.split(',')[0])
  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(30, 12.3), new THREE.MeshBasicMaterial({ map: screenTex }))
  const sy = v.style === 'heritage' || v.style === 'open' ? 16 : 40
  screen.position.set(38, sy, 108)
  screen.lookAt(0, sy * 0.5, 0)
  scene.add(screen)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(31.5, 13.8, 0.6), std('#111419'))
  frame.position.copy(screen.position)
  frame.quaternion.copy(screen.quaternion)
  frame.translateZ(-0.35)
  scene.add(frame)
  if (sy < 30) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, sy, 1.2), std('#2a2f38'))
    leg.position.set(38, sy / 2 - 6, 108.5)
    scene.add(leg)
  }
  h.screen = { canvas: screenCanvas, tex: screenTex }

  // horizon haze
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(300, 300, 60, 64, 1, true),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(64, 64, (ctx, w, hh) => {
        const g = ctx.createLinearGradient(0, 0, 0, hh)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, night ? 'rgba(80,70,140,0.55)' : v.style === 'desert' ? 'rgba(255,230,190,0.5)' : 'rgba(255,255,255,0.4)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, hh)
      }),
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  )
  haze.position.y = 30
  scene.add(haze)
  h.style = v.style
  return h
}
