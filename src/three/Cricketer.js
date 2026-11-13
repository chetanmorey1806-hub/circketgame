import * as THREE from 'three'
import { shade } from '../game/color.js'
import { faceTexture, jerseyTexture } from './textures.js'

// Body proportions in metres (about 1.82 m tall). The character faces +z, its right side is -x.
const HIP_Y = 0.98
const THIGH = 0.45
const SHIN = 0.44
const UPPER = 0.29
const FORE = 0.28
const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)
// foot IK: ankle height above the ground when the sole is flat, and how far up a foot still "feels" the ground
const SOLE = 0.085
const PLANT_RANGE = 0.16
const MAX_ANKLE = 0.95 // rad of ankle bend the flattening may add
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qp = new THREE.Quaternion()
const _corr = new THREE.Quaternion()
const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shR', 'elR', 'shL', 'elL', 'hipR', 'knR', 'hipL', 'knL', 'bat']

const matCache = new Map()
function mat(color, opts = {}) {
  const key = `${color}|${opts.rough ?? 0.75}|${opts.metal ?? 0}|${opts.map?.uuid ?? ''}|${opts.cloth ? 1 : 0}|${opts.skin ? 1 : 0}`
  if (!matCache.has(key)) {
    const base = { color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0, map: opts.map ?? null }
    // cloth gets a soft sheen so kits read as fabric rather than plastic
    matCache.set(
      key,
      opts.cloth ? new THREE.MeshPhysicalMaterial({ ...base, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff') })
      // skin: a warm reddish sheen at grazing angles fakes subsurface scattering
      : opts.skin ? new THREE.MeshPhysicalMaterial({ ...base, sheen: 0.45, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff9a7a'), clearcoat: 0.08, clearcoatRoughness: 0.6 })
      : new THREE.MeshStandardMaterial(base),
    )
  }
  return matCache.get(key)
}

function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Smooth body part revolved from a [radius, y] profile (listed top to bottom); y=0 is the joint. */
function lathe(profile, segments = 28) {
  const pts = [...profile].reverse().map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y))
  const g = new THREE.LatheGeometry(pts, segments)
  g.computeVertexNormals()
  return g
}

const G = {
  pelvis: lathe([[0.001, 0.1], [0.14, 0.1], [0.152, 0.07], [0.162, -0.02], [0.152, -0.1], [0.07, -0.13], [0.001, -0.13]]),
  // chest → waist: broad shoulders, tapered waist
  torso: lathe([[0.001, 0.315], [0.07, 0.31], [0.16, 0.285], [0.2, 0.235], [0.205, 0.17], [0.19, 0.08], [0.172, -0.02], [0.158, -0.12], [0.152, -0.2], [0.15, -0.25], [0.001, -0.25]], 36),
  shoulder: new THREE.SphereGeometry(0.085, 16, 12),
  neck: new THREE.CylinderGeometry(0.05, 0.056, 0.13, 14),
  head: new THREE.SphereGeometry(0.102, 32, 24),
  nose: new THREE.ConeGeometry(0.016, 0.042, 10),
  ear: new THREE.SphereGeometry(0.024, 10, 8),
  hairCap: new THREE.SphereGeometry(0.106, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
  sleeve: lathe([[0.001, 0.05], [0.07, 0.03], [0.066, -0.06], [0.06, -0.14], [0.058, -0.15], [0.001, -0.15]]),
  // arm segments with biceps / forearm swell
  upper: lathe([[0.001, 0.04], [0.052, 0.02], [0.056, -0.07], [0.05, -0.17], [0.042, -0.27], [0.036, -0.3], [0.001, -0.31]]),
  fore: lathe([[0.001, 0.03], [0.04, 0.015], [0.046, -0.06], [0.04, -0.16], [0.031, -0.25], [0.028, -0.27], [0.001, -0.28]]),
  hand: new THREE.SphereGeometry(0.045, 12, 10),
  glove: new THREE.BoxGeometry(0.095, 0.12, 0.075),
  keeperGlove: new THREE.BoxGeometry(0.13, 0.15, 0.09),
  thigh: lathe([[0.001, 0.05], [0.075, 0.03], [0.085, -0.05], [0.082, -0.17], [0.072, -0.32], [0.06, -0.43], [0.055, -0.46], [0.001, -0.47]]),
  // calf muscle bulge, slim ankle
  shin: lathe([[0.001, 0.03], [0.054, 0.015], [0.06, -0.06], [0.063, -0.13], [0.052, -0.25], [0.038, -0.38], [0.034, -0.43], [0.001, -0.45]]),
  pad: new THREE.CapsuleGeometry(0.072, 0.33, 6, 14),
  joint: new THREE.SphereGeometry(0.062, 16, 12),
  rib: new THREE.BoxGeometry(0.008, 0.3, 0.008),
  knee: new THREE.SphereGeometry(0.085, 14, 10),
  strap: new THREE.TorusGeometry(0.078, 0.008, 6, 20),
  shoe: new THREE.BoxGeometry(0.105, 0.075, 0.27),
  sole: new THREE.BoxGeometry(0.11, 0.02, 0.28),
  helmet: new THREE.SphereGeometry(0.128, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
  peak: new THREE.BoxGeometry(0.21, 0.012, 0.075),
  grille: new THREE.TorusGeometry(0.118, 0.0045, 6, 28, Math.PI),
  grilleV: new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6),
  neckGuard: new THREE.BoxGeometry(0.16, 0.06, 0.03),
  capBrim: new THREE.BoxGeometry(0.15, 0.01, 0.09),
  hatBrim: new THREE.CylinderGeometry(0.19, 0.19, 0.01, 28),
  hatCrown: new THREE.CylinderGeometry(0.1, 0.112, 0.09, 24),
  handle: new THREE.CylinderGeometry(0.017, 0.017, 0.28, 10),
  blade: new THREE.BoxGeometry(0.108, 0.56, 0.036),
  ridge: new THREE.BoxGeometry(0.05, 0.48, 0.024),
  sticker: new THREE.BoxGeometry(0.1, 0.09, 0.002),
}

// ---------------- poses ----------------

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = (t) => t * t * (3 - 2 * t)
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1)

function blendPose(a, b, w) {
  const out = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k]
    const vb = b[k]
    if (Array.isArray(va) || Array.isArray(vb)) {
      const x = va ?? [0, 0, 0]
      const y = vb ?? [0, 0, 0]
      out[k] = [lerp(x[0], y[0], w), lerp(x[1], y[1], w), lerp(x[2], y[2], w)]
    } else out[k] = lerp(va ?? 0, vb ?? 0, w)
  }
  return out
}

const IDLE = { shR: [0, 0, -0.08], shL: [0, 0, 0.08], elR: [-0.15, 0, 0], elL: [-0.15, 0, 0] }

const CLIPS = {
  idle: (t) => ({ ...IDLE, chest: [0.02 * Math.sin(t * 1.6), 0, 0] }),

  run: (t, { freq = 1.7 } = {}) => {
    const p = t * Math.PI * 2 * freq
    const s = Math.sin(p)
    const c = Math.cos(p)
    return {
      hipR: [-0.75 * s, 0, 0], hipL: [0.75 * s, 0, 0],
      knR: [0.2 + 1.25 * Math.max(0, c), 0, 0], knL: [0.2 + 1.25 * Math.max(0, -c), 0, 0],
      shR: [0.65 * s, 0, -0.1], shL: [-0.65 * s, 0, 0.1], elR: [-1.45, 0, 0], elL: [-1.45, 0, 0],
      spine: [0.22, 0, 0], chest: [0, 0.14 * s, 0], drop: 0.045 * Math.abs(s) - 0.04,
    }
  },

  // Batter running between wickets: legs run, hands stay on the bat (IK), bat carried forward.
  batRun: (t) => ({ ...CLIPS.run(t, { freq: 2 }), shR: [0, 0, 0], shL: [0, 0, 0], bat: [-1.0, 0, 0.1], batPos: [0.12, -0.18, 0.28] }),

  // Right-arm bowling action: gather, side-on, arm over the top, follow-through.
  bowl: (t) => {
    const g = ease(seg(t, 0, 0.22))
    const d = ease(seg(t, 0.22, 0.5))
    const f = ease(seg(t, 0.5, 0.95))
    return {
      drop: 0.12 * Math.sin(Math.PI * seg(t, 0, 0.3)) - 0.06 * d,
      hips: [0, lerp(lerp(0, -0.6, g), 0.4, d), 0],
      chest: [0, lerp(lerp(0, -1.1, g), 0.3, d) + 0.4 * f, 0],
      spine: [lerp(0.15, 0.55, d) - 0.15 * f, 0, 0],
      shR: [lerp(lerp(0, 0.7, g), 3.6, d) + 2.4 * f, 0, -0.1 + 0.6 * f],
      elR: [-0.05, 0, 0],
      shL: [lerp(lerp(0, -2.8, g), 0.4, d), 0, 0.15],
      elL: [lerp(-0.2, -0.6, d), 0, 0],
      hipR: [lerp(lerp(0, -0.7, g), 0.55, d) - 0.5 * f, 0, 0],
      knR: [lerp(lerp(0.2, 1.1, g), 0.7, d), 0, 0],
      hipL: [lerp(lerp(0, -0.2, g), -0.55, d) + 0.3 * f, 0, 0],
      knL: [lerp(0.3, 0.1, d) + 0.4 * f, 0, 0],
    }
  },

  // Batting stance (RH, side-on, looking at the bowler on local +x).
  stance: (t) => ({
    hipR: [-0.22, 0, -0.1], knR: [0.42, 0, 0], hipL: [-0.22, 0, 0.12], knL: [0.42, 0, 0],
    spine: [0.32, 0, 0], chest: [0, 0.15, 0], neck: [0, 0.35, 0], head: [-0.15, 0.95, 0],
    drop: -0.07 + 0.005 * Math.sin(t * 3),
    bat: [0.15, 0, 0.05 + 0.04 * Math.sin(t * 3)], batPos: [0.02, -0.34, 0.27],
  }),

  // Bat raised, waiting for the ball.
  backlift: () => ({
    ...CLIPS.stance(0),
    bat: [0.25, 0, -1.9], batPos: [-0.12, -0.08, 0.2], chest: [0, 0.05, 0],
  }),

  /**
   * A shot. shot: push | stroke | loft | leave; dir: degrees (0 straight, + off side); foot: front | back | advance.
   */
  shot: (t, { shot, dir = 0, foot = 'front' }) => {
    const yaw = (-dir * Math.PI) / 180
    const swingEnd = shot === 'loft' ? 2.7 : shot === 'stroke' ? 1.7 : shot === 'push' ? 0.45 : -1.6
    const start = shot === 'push' ? -0.9 : -2.0
    const s = ease(seg(t, 0.04, 0.24))
    const z = shot === 'leave' ? lerp(-1.9, -2.3, s) : lerp(start, swingEnd, s)
    const open = clamp(((90 - dir) / 90) * 0.75, -0.1, 1.5)
    const step = ease(seg(t, 0, 0.16))
    const pose = {
      ...CLIPS.stance(0),
      bat: [0.15, shot === 'leave' ? 0 : yaw, z],
      batPos: [lerp(-0.12, 0.12, s) * Math.cos(yaw), lerp(-0.08, shot === 'loft' ? 0.05 : -0.2, s), 0.24 - 0.1 * Math.sin(-yaw) * s],
      chest: [0, lerp(0.05, open, s), 0],
      spine: [shot === 'loft' ? lerp(0.32, 0.05, s) : 0.38, 0, 0],
      neck: [0, lerp(0.35, 0.15, s), 0],
      head: [-0.1, lerp(0.95, 0.6, s), 0],
    }
    if (foot === 'front' || foot === 'advance') {
      pose.hipL = [lerp(-0.22, -0.35, step), 0, lerp(0.12, 0.5, step)]
      pose.knL = [lerp(0.42, 0.55, step), 0, 0]
      pose.hipR = [-0.15, 0, lerp(-0.1, -0.2, step)]
      pose.drop = lerp(-0.07, -0.13, step)
      pose.shift = lerp(0, foot === 'advance' ? 1.1 : 0.22, foot === 'advance' ? ease(seg(t, 0, 0.12)) : step)
    } else {
      pose.hipR = [lerp(-0.22, -0.1, step), 0, lerp(-0.1, -0.35, step)]
      pose.hipL = [-0.1, 0, 0.05]
      pose.knL = [0.25, 0, 0]
      pose.drop = lerp(-0.07, -0.04, step)
      pose.shift = lerp(0, -0.22, step)
    }
    return pose
  },

  keeper: (t) => ({
    hipR: [-1.3, 0, -0.38], hipL: [-1.3, 0, 0.38], knR: [2.15, 0, 0], knL: [2.15, 0, 0],
    drop: -0.47 + 0.01 * Math.sin(t * 2), spine: [0.55, 0, 0],
    shR: [-1.15, 0, 0.3], shL: [-1.15, 0, -0.3], elR: [-0.4, 0, 0], elL: [-0.4, 0, 0],
  }),
  keeperCatch: () => ({
    hipR: [-0.7, 0, -0.25], hipL: [-0.7, 0, 0.25], knR: [1.2, 0, 0], knL: [1.2, 0, 0],
    drop: -0.25, spine: [0.3, 0, 0], shR: [-1.9, 0, 0.35], shL: [-1.9, 0, -0.35], elR: [-0.25, 0, 0], elL: [-0.25, 0, 0],
  }),

  ready: (t) => ({
    hipR: [-0.35, 0, -0.08], hipL: [-0.35, 0, 0.08], knR: [0.65, 0, 0], knL: [0.65, 0, 0],
    drop: -0.12 + 0.01 * Math.sin(t * 2.4), spine: [0.42, 0, 0],
    shR: [-0.55, 0, 0.05], shL: [-0.55, 0, -0.05], elR: [-0.35, 0, 0], elL: [-0.35, 0, 0],
  }),
  pickup: () => ({
    hipR: [-0.9, 0, -0.1], hipL: [-0.4, 0, 0.1], knR: [1.4, 0, 0], knL: [0.9, 0, 0],
    drop: -0.32, spine: [1.05, 0, 0], shR: [-1.0, 0, 0.1], elR: [-0.2, 0, 0], shL: [-0.4, 0, -0.1],
  }),
  throw: (t) => {
    const a = ease(seg(t, 0, 0.35))
    return {
      chest: [0, lerp(-0.9, 0.5, a), 0], spine: [lerp(0, 0.4, a), 0, 0],
      shR: [lerp(0.9, 3.9, a), 0, -0.2], elR: [lerp(-1.2, -0.1, a), 0, 0],
      shL: [lerp(-1.6, 0.3, a), 0, 0.2], hipL: [-0.4, 0, 0], knL: [0.2, 0, 0], hipR: [0.3, 0, 0], knR: [0.5, 0, 0],
    }
  },
  catch: () => ({
    shR: [-2.75, 0, 0.18], shL: [-2.75, 0, -0.18], elR: [-0.3, 0, 0], elL: [-0.3, 0, 0],
    spine: [-0.05, 0, 0], hipR: [-0.1, 0, -0.06], hipL: [-0.1, 0, 0.06], knR: [0.15, 0, 0], knL: [0.15, 0, 0],
  }),
  cheer: (t) => ({
    shR: [-0.3, 0, -2.6], shL: [-0.3, 0, 2.6], elR: [-0.3, 0, 0], elL: [-0.3, 0, 0],
    drop: 0.12 * Math.abs(Math.sin(t * 7)), knR: [0.3 * Math.abs(Math.cos(t * 7)), 0, 0], knL: [0.3 * Math.abs(Math.cos(t * 7)), 0, 0],
  }),
  appeal: () => ({
    shR: [-2.4, 0, -0.6], shL: [-2.4, 0, 0.6], elR: [-0.1, 0, 0], elL: [-0.1, 0, 0], spine: [-0.2, 0, 0], chest: [0, 0, 0],
    hipL: [-0.4, 0, 0], knL: [0.3, 0, 0],
  }),
  celebrateBat: (t) => ({
    ...CLIPS.stance(0), spine: [0, 0, 0], drop: 0, hipR: [0, 0, -0.06], hipL: [0, 0, 0.06], knR: [0.05, 0, 0], knL: [0.05, 0, 0],
    head: [-0.2, 0.3, 0], bat: [0, 0, 3.0 + 0.15 * Math.sin(t * 6)], batPos: [0.1, 0.35, 0.18],
  }),
  dejected: () => ({
    ...IDLE, head: [0.45, 0, 0], neck: [0.2, 0, 0], spine: [0.15, 0, 0],
    bat: [-0.4, 0, -0.4], batPos: [-0.05, -0.35, 0.22],
  }),

  // wicket celebrations
  airplane: (t) => ({ ...CLIPS.run(t, { freq: 1.6 }), shR: [0, 0, -1.45], shL: [0, 0, 1.45], elR: [0, 0, 0], elL: [0, 0, 0], spine: [0.1, 0, 0], chest: [0, 0, 0.15 * Math.sin(t * 3)] }),
  fistPump: (t) => ({ shR: [-1.2 - 0.6 * Math.abs(Math.sin(t * 6)), 0, -0.3], elR: [-1.9, 0, 0], shL: [0.2, 0, 0.3], elL: [-0.6, 0, 0], spine: [-0.15, 0, 0], head: [-0.3, 0, 0], hipL: [-0.3, 0, 0], knL: [0.4, 0, 0] }),
  umpire: (t) => ({
    shR: [-0.35, 0, 0.28], shL: [-0.35, 0, -0.28], elR: [-1.0, 0, 0], elL: [-1.0, 0, 0],
    hipR: [0, 0, -0.06], hipL: [0, 0, 0.06], chest: [0.01 * Math.sin(t), 0, 0],
  }),
  umpOut: () => ({ shR: [-3.05, 0, 0.05], elR: [-0.05, 0, 0], shL: [0, 0, 0.08], elL: [-0.1, 0, 0] }),
  umpFour: (t) => ({ shR: [-1.5, 0, 0.6 * Math.sin(t * 9)], elR: [-0.1, 0, 0], shL: [0, 0, 0.08] }),
  umpSix: () => ({ shR: [-3.0, 0, -0.15], shL: [-3.0, 0, 0.15], elR: [-0.05, 0, 0], elL: [-0.05, 0, 0] }),
  umpWide: () => ({ shR: [0, 0, -1.55], shL: [0, 0, 1.55], elR: [0, 0, 0], elL: [0, 0, 0] }),
}

// ---------------- the character ----------------

export class Cricketer {
  /**
   * @param role batter | bowler | fielder | keeper | umpire
   */
  constructor({ player, team, role, whites = false }) {
    this.whites = whites
    this.role = role
    this.player = player
    this.root = new THREE.Group()
    this.body = new THREE.Group()
    this.root.add(this.body)
    this.j = {}
    this.clip = { name: 'idle', fn: CLIPS.idle, t: 0, params: {} }
    this.prevPose = {}
    this.lastPose = {}
    this.blend = 1
    this.move = null
    this.ik = role === 'batter'
    this.build(team)
  }

  build(team) {
    const umpire = this.role === 'umpire'
    const colors = umpire ? { primary: '#c2306f', secondary: '#9c1f57', accent: '#16181d' } : this.whites ? { primary: '#f1ede1', secondary: team.colors.primary, accent: team.colors.primary } : team.colors
    const kitTeam = this.whites && !umpire ? { ...team, colors } : team
    const look = this.player?.look ?? { skin: '#b07a52', hair: '#1b1410', hairStyle: 0, beard: false }
    const skin = mat(look.skin, { rough: 0.6, skin: true })
    const kit = mat(colors.primary, { rough: 0.7, cloth: true })
    const pants = mat(umpire ? '#15171c' : this.whites ? '#e9e5d8' : shade(colors.primary, -0.15), { rough: 0.74, cloth: true })
    const trim = mat(colors.secondary, { rough: 0.6 })
    const white = mat('#f4f5f7', { rough: 0.55 })
    const dark = mat('#20242b', { rough: 0.6 })
    const jersey = new THREE.MeshPhysicalMaterial({ map: jerseyTexture(kitTeam, this.player ?? { short: '', number: '' }, umpire), roughness: 0.7, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff') })
    const face = new THREE.MeshPhysicalMaterial({ map: faceTexture(look), roughness: 0.55, sheen: 0.4, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff9a7a') })
    const hair = mat(look.hair, { rough: 0.9 })
    const padded = this.role === 'batter' || this.role === 'keeper'
    const padMat = mat(this.whites ? '#f6f6f2' : shade(colors.primary, 0.05), { rough: 0.5 })

    const J = (name, parent, x, y, z) => {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      parent.add(g)
      this.j[name] = g
      return g
    }

    const hips = J('hips', this.body, 0, HIP_Y, 0)
    hips.add(mesh(G.pelvis, pants, { y: 0, sz: 0.78 }))
    for (const [side, sx] of [['R', -1], ['L', 1]]) {
      const hip = J(`hip${side}`, hips, sx * 0.095, -0.04, 0)
      hip.add(mesh(G.thigh, pants, { sz: 0.92 }))
      hip.add(mesh(new THREE.BoxGeometry(0.012, 0.3, 0.02), trim, { x: sx * 0.068, y: -0.2 }))
      hip.add(mesh(G.joint, pants, { y: 0.01, sx: 1.25, sy: 1.1, sz: 1.15 }))
      const knee = J(`kn${side}`, hip, 0, -THIGH, 0)
      knee.add(mesh(G.joint, pants, { sx: 0.95, sy: 0.9, sz: 0.95 }))
      knee.add(mesh(G.shin, pants, { sz: 0.9 }))
      if (padded) {
        // coloured T20 pads with white ribs and straps (like the broadcast games)
        knee.add(mesh(G.pad, padMat, { y: -0.2, z: 0.03, sx: 1.12, sz: 0.78 }))
        knee.add(mesh(G.knee, padMat, { y: -0.01, z: 0.05, sx: 1.0, sy: 0.75, sz: 0.8 }))
        for (const x of [-0.035, 0, 0.035]) knee.add(mesh(G.rib, white, { x, y: -0.2, z: 0.088 }))
        for (const y of [-0.12, -0.3]) knee.add(mesh(G.strap, white, { y, rx: Math.PI / 2, sx: 1.08, sy: 0.8 }))
      }
      // ankle joint (not part of the clips): foot IK rotates it to keep planted soles flat
      const ankle = J(`ft${side}`, knee, 0, -SHIN, 0)
      ankle.add(mesh(G.shoe, white, { y: -0.035, z: 0.055 }))
      ankle.add(mesh(G.sole, dark, { y: -0.075, z: 0.055 }))
    }

    const spine = J('spine', hips, 0, 0.06, 0)
    const chest = J('chest', spine, 0, 0.24, 0)
    chest.add(mesh(G.torso, jersey, { y: 0.0, sz: 0.66 }))
    const neck = J('neck', chest, 0, 0.29, 0)
    neck.add(mesh(G.neck, skin, { y: 0.02 }))
    const head = J('head', neck, 0, 0.13, 0)
    head.add(mesh(G.head, face, { sy: 1.16, sz: 1.06 }))
    head.add(mesh(G.nose, skin, { y: -0.012, z: 0.106, rx: Math.PI / 2 }))
    head.add(mesh(G.ear, skin, { x: -0.1, sz: 0.55 }))
    head.add(mesh(G.ear, skin, { x: 0.1, sz: 0.55 }))

    if (padded) {
      const helmetMat = mat(shade(this.whites ? team.colors.primary : colors.primary, -0.25), { rough: 0.32, metal: 0.25 })
      const steel = mat('#c5cad2', { rough: 0.3, metal: 0.85 })
      head.add(mesh(G.helmet, helmetMat, { y: 0.012, z: -0.006, sy: 1.08, sz: 1.08 }))
      head.add(mesh(G.peak, helmetMat, { y: 0.04, z: 0.125, rx: 0.22 }))
      head.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), trim, { y: 0.1, z: 0.1 }))
      for (const [y, r] of [[-0.02, 1], [-0.055, 0.97], [-0.09, 0.9]]) head.add(mesh(G.grille, steel, { y, rx: Math.PI / 2, sx: r, sy: r }))
      for (const x of [-0.045, 0, 0.045]) head.add(mesh(G.grilleV, steel, { x, y: -0.055, z: 0.112 }))
      head.add(mesh(G.neckGuard, helmetMat, { y: -0.075, z: -0.105 }))
    } else if (umpire) {
      // white panama hat
      const hat = mat('#f4f2ea', { rough: 0.85 })
      head.add(mesh(G.hatBrim, hat, { y: 0.07, sx: 1.05, sz: 1.05 }))
      head.add(mesh(G.hatCrown, hat, { y: 0.115 }))
      head.add(mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.02, 24), mat('#1d1f24'), { y: 0.085 }))
      head.add(mesh(G.hairCap, hair, { y: 0.01, rx: -0.3 }))
    } else if (this.role === 'fielder') {
      head.add(mesh(G.hairCap, kit, { y: 0.02, rx: -0.15, sx: 1.04, sz: 1.04 }))
      head.add(mesh(G.capBrim, kit, { y: 0.055, z: 0.12, rx: 0.12 }))
    } else {
      head.add(mesh(G.hairCap, hair, { y: 0.012, rx: -0.28 }))
    }

    for (const [side, sx] of [['R', -1], ['L', 1]]) {
      const sh = J(`sh${side}`, chest, sx * 0.19, 0.22, 0)
      sh.add(mesh(G.shoulder, kit, { sz: 0.9 }))
      sh.add(mesh(G.upper, skin, { sz: 0.92 }))
      sh.add(mesh(G.sleeve, kit, { sz: 0.95 }))
      const el = J(`el${side}`, sh, 0, -UPPER, 0)
      el.add(mesh(G.joint, skin, { sx: 0.68, sy: 0.68, sz: 0.68 }))
      el.add(mesh(G.fore, skin, { sz: 0.9 }))
      if (this.role === 'batter') el.add(mesh(G.glove, white, { y: -FORE }))
      else if (this.role === 'keeper') el.add(mesh(G.keeperGlove, trim, { y: -FORE - 0.01 }))
      else el.add(mesh(G.hand, skin, { y: -FORE, sx: 0.9, sy: 1.15, sz: 0.75 }))
    }

    // The bat hangs from a pivot at the top of the handle (in chest space).
    const bat = J('bat', chest, 0.02, -0.34, 0.27)
    bat.rotation.order = 'YZX'
    if (this.role === 'batter') {
      const willow = mat('#e2c88f', { rough: 0.55 })
      bat.add(mesh(G.handle, dark, { y: -0.14 }))
      bat.add(mesh(G.blade, willow, { y: -0.28 - 0.28 }))
      bat.add(mesh(G.ridge, willow, { y: -0.56, z: -0.026 }))
      bat.add(mesh(G.sticker, trim, { y: -0.36, z: 0.019 }))
    }
  }

  // ----- animation API -----

  /** Switch clip with a short cross-fade. */
  play(name, params = {}, { blend = 0.15, restart = true } = {}) {
    if (!restart && this.clip.name === name) {
      this.clip.params = params
      return
    }
    this.prevPose = this.lastPose
    this.blend = blend > 0 ? 0 : 1
    this.blendTime = blend
    this.clip = { name, fn: CLIPS[name], t: 0, params }
  }

  /** Run to a ground point, then call onArrive. */
  moveTo(x, z, speed, onArrive, then = 'idle', runClip = null) {
    this.move = { x, z, speed, onArrive, then }
    const clip = runClip ?? (this.role === 'batter' ? 'batRun' : 'run')
    if (this.clip.name !== clip) this.play(clip, { freq: 1.1 + speed * 0.09 })
  }

  setPosition(x, z) {
    this.root.position.set(x, 0, z)
  }

  face(x, z) {
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z)
  }

  update(dt) {
    if (this.move) {
      const p = this.root.position
      const dx = this.move.x - p.x
      const dz = this.move.z - p.z
      const d = Math.hypot(dx, dz)
      const step = this.move.speed * dt
      if (d <= step || d < 0.02) {
        p.x = this.move.x
        p.z = this.move.z
        const { onArrive, then } = this.move
        this.move = null
        if (then) this.play(then)
        onArrive?.()
      } else {
        p.x += (dx / d) * step
        p.z += (dz / d) * step
        const target = Math.atan2(dx, dz)
        let diff = target - this.root.rotation.y
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        this.root.rotation.y += diff * Math.min(1, dt * 10)
      }
    }

    this.clip.t += dt
    let pose = this.clip.fn(this.clip.t, this.clip.params)
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / (this.blendTime || 0.15))
      pose = blendPose(this.prevPose, pose, ease(this.blend))
    }
    this.lastPose = pose
    this.apply(pose)
  }

  apply(pose) {
    for (const name of JOINTS) {
      const r = pose[name] ?? (name === 'bat' ? [0.15, 0, 0.05] : [0, 0, 0])
      this.j[name].rotation.set(r[0], r[1], r[2])
    }
    const bp = pose.batPos ?? [0.02, -0.34, 0.27]
    this.j.bat.position.set(bp[0], bp[1], bp[2])
    this.groundFeet(pose)
    if (this.ik) this.solveHands()
  }

  /**
   * Foot IK. 1) Ground lock: move the body so the lower ankle sits exactly SOLE above the turf, so the
   * player's origin never floats or sinks whatever the knees/hips are doing (a positive pose.drop is
   * kept as a jump). 2) Plant: feet near the ground rotate at the ankle so the sole lies flat
   * (slope = acos(N·Y_up), here the outfield normal is +y), fading out as the foot lifts.
   */
  groundFeet(pose) {
    const { ftR, ftL } = this.j
    ftR.quaternion.identity()
    ftL.quaternion.identity()
    this.body.position.set(pose.shift ?? 0, 0, 0)
    this.root.updateMatrixWorld(true)
    const baseY = this.root.position.y
    const yR = ftR.getWorldPosition(_v).y
    const yL = ftL.getWorldPosition(_v).y
    this.body.position.y = baseY + SOLE - Math.min(yR, yL) + Math.max(0, pose.drop ?? 0)
    this.body.updateMatrixWorld(true)
    for (const ft of [ftR, ftL]) {
      const h = ft.getWorldPosition(_v).y - baseY - SOLE
      let w = clamp(1 - h / PLANT_RANGE, 0, 1)
      if (w <= 0) continue
      ft.getWorldQuaternion(_q)
      _v.copy(UP).applyQuaternion(_q)
      const tilt = _v.angleTo(UP)
      if (tilt < 1e-3) continue
      w *= Math.min(1, MAX_ANKLE / tilt)
      _corr.setFromUnitVectors(_v, UP)
      _corr.slerp(_qp.identity(), 1 - w) // partial correction (identity → full flatten)
      ft.parent.getWorldQuaternion(_qp)
      ft.quaternion.copy(_qp.invert().multiply(_corr).multiply(_q))
      ft.updateMatrixWorld(true)
    }
  }

  // Two-bone IK so both gloves stay on the bat handle.
  solveHands() {
    this.root.updateMatrixWorld(true)
    const top = this.j.bat.localToWorld(new THREE.Vector3(0, -0.04, 0))
    const bottom = this.j.bat.localToWorld(new THREE.Vector3(0, -0.15, 0))
    this.solveArm(this.j.shL, this.j.elL, top, new THREE.Vector3(0.6, -0.5, -0.4))
    this.solveArm(this.j.shR, this.j.elR, bottom, new THREE.Vector3(-0.6, -0.5, -0.4))
  }

  solveArm(sh, el, target, poleDir) {
    const parent = sh.parent
    const inv = parent.matrixWorld.clone().invert()
    const T = target.clone().applyMatrix4(inv)
    const S = sh.position.clone()
    const d = T.clone().sub(S)
    const dist = clamp(d.length(), 0.08, UPPER + FORE - 0.002)
    d.normalize()
    const a = Math.acos(clamp((UPPER * UPPER + dist * dist - FORE * FORE) / (2 * UPPER * dist), -1, 1))
    let n = new THREE.Vector3().crossVectors(d, poleDir)
    if (n.lengthSq() < 1e-6) n = new THREE.Vector3(1, 0, 0)
    n.normalize()
    const upper = d.clone().applyAxisAngle(n, a)
    sh.quaternion.setFromUnitVectors(DOWN, upper)
    sh.updateMatrixWorld(true)
    const Ts = target.clone().applyMatrix4(sh.matrixWorld.clone().invert())
    const f = Ts.sub(new THREE.Vector3(0, -UPPER, 0)).normalize()
    el.quaternion.setFromUnitVectors(DOWN, f)
  }

  /** World position of the right hand (for holding the ball). */
  handWorld(side = 'R') {
    return this.j[`el${side}`].localToWorld(new THREE.Vector3(0, -FORE, 0.03))
  }
}
