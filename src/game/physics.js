// Ball physics in real units (metres, seconds, kg).
// World frame: y up, the pitch runs along z (striker's stumps at +z), +x is the off side of a right-handed batter.

import { BOUNDARY, FIELD, KEEPER, STRIKER_Z, STUMPS_Z } from './field.js'

export const G = 9.81
export const BALL = { mass: 0.16, radius: 0.036 }
// quadratic drag: a = -K |v| v,  K = ½ ρ Cd A / m
const K_DRAG = (0.5 * 1.2 * 0.45 * Math.PI * BALL.radius ** 2) / BALL.mass

// Physics materials (restitution = bounciness, friction = speed lost along the surface at a bounce).
export const PITCH = { restitution: 0.7, friction: 0.5 }
export const GRASS = { restitution: 0.4, friction: 0.45, rolling: 4.4 /* m/s² of rolling drag */ }

// Bat collision zones (sweet spot / outer edge / toe & top edge).
export const BAT_ZONES = {
  sweet: { restitution: 0.9, power: 1.0 },
  edge: { restitution: 0.4, power: 0.45, deflect: 25 },
  toe: { restitution: 0.3, power: 0.35 },
}

export const RELEASE = { x: -0.35, y: 2.15, z: -9.3 }

/**
 * Batting guard: where the striker takes stance on the popping crease (RH batter, +x = off side).
 *   Pos_batter = Pos_stumps + d_crease · Z_forward + Offset_guard
 * `x` is Offset_guard along the crease; the pads move with it, so it changes what hits the pad.
 */
export const GUARDS = {
  leg: { label: 'Leg stump', short: 'LEG', x: -0.11 },
  middle: { label: 'Middle', short: 'MID', x: 0 },
  off: { label: 'Off stump', short: 'OFF', x: 0.11 },
}
let guardX = 0
export function setGuard(name) {
  guardX = (GUARDS[name] ?? GUARDS.middle).x
}
export const CONTACT_Z = STRIKER_Z - 0.55 // where the bat meets the ball in front of the batter
const STUMP_HALF = 0.115 + BALL.radius
const STUMP_TOP = 0.71 + BALL.radius
const DT = 1 / 240

const RAD = Math.PI / 180
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = () => Math.random()

/** One integration step: gravity + air drag + a constant sideways (swing / Magnus) acceleration. */
function step(s, dt, side = 0) {
  const sp = Math.hypot(s.vx, s.vy, s.vz)
  const k = K_DRAG * sp
  s.vx += (-k * s.vx + side) * dt
  s.vy += (-k * s.vy - G) * dt
  s.vz += -k * s.vz * dt
  s.x += s.vx * dt
  s.y += s.vy * dt
  s.z += s.vz * dt
  s.t += dt
}

// ---------------- the delivery ----------------

/** Fly a delivery with given launch velocity; returns samples until it reaches the keeper. */
function flyDelivery(v0, { swing, turn, spin }) {
  const s = { x: RELEASE.x, y: RELEASE.y, z: RELEASE.z, ...v0, t: 0 }
  const out = [{ t: 0, x: s.x, y: s.y, z: s.z }]
  let bounce = null
  let i = 0
  while (s.z < KEEPER.z && s.t < 3) {
    step(s, DT, bounce ? 0 : swing)
    if (!bounce && s.y <= BALL.radius) {
      // bounce off the pitch: restitution for the vertical speed, friction for the horizontal
      s.y = BALL.radius
      s.vy = -s.vy * PITCH.restitution
      const keep = 1 - PITCH.friction * (spin ? 0.45 : 0.28)
      s.vz *= keep
      s.vx = s.vx * keep + turn // spin/seam deviation off the surface
      bounce = { t: s.t, x: s.x, z: s.z }
    }
    if (++i % 2 === 0) out.push({ t: s.t, x: s.x, y: s.y, z: s.z })
  }
  return { samples: out, bounce, end: s }
}

/** Position on a sample path at time t (linear interpolation). */
export function sampleAt(samples, t) {
  if (t <= samples[0].t) return samples[0]
  let lo = 0
  let hi = samples.length - 1
  if (t >= samples[hi].t) return samples[hi]
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const u = (t - a.t) / (b.t - a.t || 1)
  return { t, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }
}

/** First time the path crosses z (or null). */
export function timeAtZ(samples, z) {
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].z >= z) {
      const a = samples[i - 1]
      const b = samples[i]
      return a.t + ((z - a.z) / (b.z - a.z || 1)) * (b.t - a.t)
    }
  }
  return null
}

/**
 * Solve the launch velocity so the ball pitches at (bounceX, STUMPS_Z - lengthDist) at the given speed,
 * then fly it. Swing: pre-bounce sideways accel (m/s²). Turn: sideways speed gained at the bounce (m/s).
 */
export function deliveryPath({ kmh, lengthDist, bounceX, swing = 0, turn = 0, spin = false }) {
  const speed = kmh / 3.6
  const target = { x: bounceX, z: STUMPS_Z - lengthDist }
  // shooting method: adjust vertical speed + aim until the first bounce lands on target
  let vy = -3
  let aimX = target.x
  let path
  for (let it = 0; it < 30; it++) {
    const dz = target.z - RELEASE.z
    const dx = aimX - RELEASE.x
    const horiz = Math.sqrt(Math.max(speed * speed - vy * vy, 1))
    const n = Math.hypot(dx, dz)
    path = flyDelivery({ vx: (horiz * dx) / n, vy, vz: (horiz * dz) / n }, { swing, turn, spin })
    if (!path.bounce) {
      vy -= 1
      continue
    }
    const ez = path.bounce.z - target.z
    const ex = path.bounce.x - target.x
    if (Math.abs(ez) < 0.02 && Math.abs(ex) < 0.01) break
    vy -= ez * 0.35 // landed too far → aim lower
    aimX -= ex
  }
  const samples = path.samples
  const tStumps = timeAtZ(samples, STUMPS_Z) ?? samples[samples.length - 1].t
  const tContact = timeAtZ(samples, CONTACT_Z) ?? tStumps * 0.97
  const atStumps = sampleAt(samples, tStumps)
  const atBatter = sampleAt(samples, timeAtZ(samples, STRIKER_Z) ?? tStumps)
  return {
    samples,
    bounce: path.bounce,
    tStumps,
    tContact,
    atStumps,
    atBatter,
    hitsStumps: Math.abs(atStumps.x) < STUMP_HALF && atStumps.y < STUMP_TOP,
    // the pads cover roughly middle/leg stump line below the knee roll
    hitsPad: Math.abs(atBatter.x + 0.05 - guardX) < 0.17 && atBatter.y < 0.62,
    pitchedOutsideLeg: path.bounce.x < -0.13,
  }
}

/** Where to pitch the ball so that (without movement) it would pass the stumps at `lineAtStumps`. */
export function bounceXFor(lineAtStumps, lengthDist) {
  const d1 = STUMPS_Z - lengthDist - RELEASE.z
  return (lineAtStumps * d1 + RELEASE.x * lengthDist) / (d1 + lengthDist)
}

/** Where a ball pitched at bounceX would pass the stumps (no movement). */
export function lineAtStumpsFor(bounceX, lengthDist) {
  const d1 = STUMPS_Z - lengthDist - RELEASE.z
  return bounceX + ((bounceX - RELEASE.x) * lengthDist) / d1
}

// ---------------- the bat ----------------

/**
 * Timing grade from the press time vs the ideal contact time (seconds, in game time).
 * perfect: |offset| ≤ w · good: ≤ 0.08 · early/late: ≤ 0.20 · beyond that you miss.
 */
export function gradeTiming(offset, w = 0.05) {
  const a = Math.abs(offset)
  const good = Math.max(0.08, w * 1.6)
  const edge = Math.max(0.2, w * 4)
  if (a <= w) return { grade: 'perfect', label: 'perfect', mult: 1, k: 0 }
  if (a <= good) return { grade: 'good', label: offset < 0 ? 'early' : 'late', mult: 0.74, k: (a - w) / (good - w) * 0.35 }
  if (a <= edge) {
    const k = 0.35 + ((a - good) / (edge - good)) * 0.65
    return { grade: 'poor', label: offset < 0 ? 'early' : 'late', mult: offset < 0 ? 0.4 : 0.3, k }
  }
  return { grade: 'miss', label: offset < 0 ? 'early' : 'late', mult: 0, k: 1 }
}

/** Unit vector for a shot direction (deg from the striker, 0 = straight) and elevation (deg). */
function dirVec(deg, elev) {
  const c = Math.cos(elev * RAD)
  return { x: Math.sin(deg * RAD) * c, y: Math.sin(elev * RAD), z: -Math.cos(deg * RAD) * c }
}

export const SHOT_SPEED = { push: 17, stroke: 29.5, loft: 28.2 }
const SHOT_ELEV = { push: -9, stroke: -3, loft: 34 }

/**
 * Bat-ball collision. Picks the contact zone from timing + footwork + line, then
 *   V_final = D_shot · Speed · TimingMultiplier · zonePower + V_ball_in · 0.2
 * with direction deviation (early → pulled across to leg & popped up, late → thick edge to the off side).
 */
export function hitBall({ shot, dir, timing, fit, batter, path, rng = rand }) {
  const inV = (() => {
    const a = sampleAt(path.samples, path.tContact - 0.01)
    const b = sampleAt(path.samples, path.tContact + 0.01)
    return { x: (b.x - a.x) / 0.02, y: (b.y - a.y) / 0.02, z: (b.z - a.z) / 0.02 }
  })()
  const contact = sampleAt(path.samples, path.tContact)
  const quality = clamp(fit * (0.85 + (batter.bat / 100) * 0.3), 0, 1.1)

  // contact zone
  const edgeChance = clamp(0.03 + (1 - quality) * 0.55 + timing.k * 0.35, 0, 0.9)
  let zone = 'sweet'
  const r = rng()
  if (r < edgeChance) zone = timing.label === 'early' && shot !== 'push' ? 'toe' : 'edge'

  let deg = dir
  let elev = SHOT_ELEV[shot] + (rng() - 0.5) * (shot === 'loft' ? 12 : 4)
  if (timing.label === 'early') {
    deg -= 30 * timing.k // dragged across the line
    elev += 18 * timing.k // and popped up
  } else if (timing.label === 'late') {
    deg += 25 * timing.k // squirts squarer on the off side
    elev -= 4 * timing.k
  }
  const Z = BAT_ZONES[zone]
  if (zone === 'edge') {
    // outer edge: flies behind square on the off side (keeper / slips / third man)
    deg = 150 + rng() * 30 + (timing.label === 'early' ? -20 : 0)
    elev = 4 + rng() * 14
  } else if (zone === 'toe') {
    elev = shot === 'loft' ? 55 + rng() * 20 : 10 + rng() * 25 // top-edge skier or toe-ender
    deg += (rng() - 0.5) * 50
  }

  // power: batter strength, timing, contact zone, and getting to the pitch of the ball (footwork vs length)
  const speed = SHOT_SPEED[shot] * (0.86 + (batter.bat / 100) * 0.18) * timing.mult * Z.power * (0.7 + 0.3 * Math.min(fit, 1)) * (0.94 + rng() * 0.12)
  const D = dirVec(deg, elev)
  const inSpeed = Math.hypot(inV.x, inV.y, inV.z)
  // edges keep the incoming pace (deflection); clean hits use it as extra power along the shot
  const carry = zone === 'edge' ? { x: inV.x * 0.2 * Z.restitution * 2, y: Math.abs(inV.y) * 0.1, z: inV.z * 0.2 * Z.restitution * 2 } : { x: D.x * inSpeed * 0.2, y: D.y * inSpeed * 0.2, z: D.z * inSpeed * 0.2 }
  const v = { x: D.x * speed + carry.x, y: D.y * speed + carry.y, z: D.z * speed + carry.z }
  return { zone, contact, v, deg, elev, speed: Math.hypot(v.x, v.y, v.z) }
}

// ---------------- the ball after the shot ----------------

/** Fly / bounce / roll across the outfield until it stops or leaves the ground. */
export function flight(p0, v0) {
  const s = { ...p0, vx: v0.x, vy: v0.y, vz: v0.z, t: 0 }
  const out = [{ t: 0, x: s.x, y: s.y, z: s.z, air: true }]
  let firstBounce = null
  let i = 0
  let rolling = false
  while (s.t < 9) {
    if (rolling) {
      const sp = Math.hypot(s.vx, s.vz)
      const ns = Math.max(0, sp - GRASS.rolling * DT)
      if (ns < 0.25) break
      s.vx *= ns / sp
      s.vz *= ns / sp
      s.x += s.vx * DT
      s.z += s.vz * DT
      s.t += DT
    } else {
      step(s, DT)
      if (s.y <= BALL.radius) {
        s.y = BALL.radius
        firstBounce ??= { t: s.t, x: s.x, z: s.z }
        s.vy = -s.vy * GRASS.restitution
        s.vx *= 1 - GRASS.friction * 0.5
        s.vz *= 1 - GRASS.friction * 0.5
        if (Math.abs(s.vy) < 1.2) {
          rolling = true
          s.vy = 0
        }
      }
    }
    if (++i % 4 === 0) out.push({ t: s.t, x: s.x, y: s.y, z: s.z, air: !firstBounce })
    if (Math.hypot(s.x, s.z) > BOUNDARY + 22) break
  }
  out.push({ t: s.t, x: s.x, y: s.y, z: s.z, air: !firstBounce })
  return { samples: out, firstBounce }
}

const FIELDER_SPEED = 7.5
const GROUND_REACH = 2.3 // dive to stop a ground ball
const KEEPER_SPEED = 3.2
const REACTION = 0.3
const CATCH_REACH = 1.6 // dive / stretch
const CATCH_HEIGHT = 2.7

/**
 * Who stops it, who catches it, and how many runs: decided from the actual ball path.
 * fielders: [{x, z}] in FIELD order; plus keeper and bowler positions.
 */
export function adjudicate(fl, { bowlerPos = { x: -1.9, z: -5.5 }, rng = rand } = {}) {
  const people = [
    ...FIELD.map((f, i) => ({ who: i, x: f.x, z: f.z, speed: FIELDER_SPEED })),
    { who: 'keeper', x: KEEPER.x, z: KEEPER.z, speed: KEEPER_SPEED },
    { who: 'bowler', x: bowlerPos.x, z: bowlerPos.z, speed: 4, reach: 0.9, react: 0.45 },
  ]
  // judging a catch is slower than sprinting after a ground ball: lower speed, longer reaction for skiers
  const reachTime = (p, s) => (p.react ?? REACTION) + (s.t > 1.5 ? 0.35 : 0) + Math.max(0, Math.hypot(s.x - p.x, s.z - p.z) - (p.reach ?? CATCH_REACH)) / (p.speed * 0.78)
  const S = fl.samples

  // 1) catches: while the ball is still in the air and at catchable height
  for (const s of S) {
    if (!s.air) break
    if (Math.hypot(s.x, s.z) > BOUNDARY - 0.5) break
    if (s.y > CATCH_HEIGHT || s.y < 0.15 || s.t < 0.12) continue
    for (const p of people) {
      const rt = reachTime(p, s)
      if (rt <= s.t) {
        const margin = s.t - rt
        const prev = S[Math.max(0, S.indexOf(s) - 1)]
        const ballSpeed = Math.hypot(s.x - prev.x, s.z - prev.z) / Math.max(s.t - prev.t, 1e-3)
        // hard-hit, low, or barely-reached chances are often dropped (or not even a chance)
        const hard = (p.who === 'keeper' ? 0.06 : 0.1) + Math.max(0, 0.35 - margin) * 0.7 + (s.y > 2.2 ? 0.1 : 0) + (s.y < 0.45 ? 0.3 : 0) + (ballSpeed > 24 && s.t < 1 ? 0.35 : 0)
        if (hard > 0.85) continue
        if (rng() > hard) return { kind: 'caught', by: p.who, t: s.t, at: s }
        return { kind: 'dropped', by: p.who, t: s.t, at: s, ...groundPlay(fl, people, s.t + 0.6, reachTime) }
      }
    }
  }

  // 2) six / four
  for (const s of S) {
    if (Math.hypot(s.x, s.z) >= BOUNDARY) {
      if (s.air) return { kind: 'six', t: s.t, at: s }
      return { kind: 'four', t: s.t, at: s, ...nearestChaser(people, s) }
    }
  }
  return groundPlay(fl, people, 0, reachTime)
}

function nearestChaser(people, s) {
  let best = null
  for (const p of people) {
    if (p.who === 'keeper') continue
    const d = Math.hypot(s.x - p.x, s.z - p.z)
    if (!best || d < best.d) best = { d, by: p.who }
  }
  return { by: best.by }
}

/** Ground fielding: the first fielder able to reach the ball's path collects it and throws it in. */
function groundPlay(fl, people, fromT, reachTime) {
  const S = fl.samples
  for (const s of S) {
    if (s.t < fromT || s.y > 1.1) continue
    for (const p of people) {
      if (p.who === 'keeper' && s.z < STRIKER_Z - 3) continue
      const rt = (p.react ?? REACTION) + Math.max(0, Math.hypot(s.x - p.x, s.z - p.z) - GROUND_REACH) / p.speed
      if (rt <= s.t + 0.05) return dead(s, p.who)
    }
  }
  // stopped before anyone got there: nearest fielder jogs over
  const last = S[S.length - 1]
  let best = people[0]
  for (const p of people) if (Math.hypot(last.x - p.x, last.z - p.z) < Math.hypot(last.x - best.x, last.z - best.z)) best = p
  return dead({ ...last, t: last.t + Math.max(0, reachTime(best, last) - last.t) }, best.who)
}

function dead(s, who) {
  // throw to the nearer end; batters need ~3 s for the first run and ~2.7 s for each extra one
  const end = Math.abs(s.z - STUMPS_Z) < Math.abs(s.z + STUMPS_Z) ? STUMPS_Z : -STUMPS_Z
  const throwT = 0.45 + Math.hypot(s.x, s.z - end) / 27
  const total = s.t + throwT
  const runs = total < 2.7 ? 0 : Math.min(3, 1 + Math.floor((total - 2.7) / 2.6))
  return { kind: 'fielded', by: who, t: s.t, at: s, runs, deadT: total }
}

export { clamp }
