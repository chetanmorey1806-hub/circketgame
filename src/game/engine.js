// Pure game logic: delivery outcomes, player-level innings state, and scoring helpers.
import { FIELD_ANGLES, nearestFielder, zoneName } from './field.js'
import { adjudicate, bounceXFor, deliveryPath, flight, gradeTiming, hitBall } from './physics.js'

export const DIFFICULTY = {
  easy: { label: 'Easy', ballMs: 1500, sweet: 0.09, cpuSkill: 0.85 },
  medium: { label: 'Medium', ballMs: 1150, sweet: 0.065, cpuSkill: 1 },
  hard: { label: 'Hard', ballMs: 850, sweet: 0.045, cpuSkill: 1.2 },
}

// Delivery types per bowling style. `stumps` = chance the ball is heading at the stumps,
// `risk` = wicket-taking potential, `wickets` = weighted dismissal types, `runs` = base run table.
export const DELIVERIES = {
  pace: {
    yorker: {
      label: 'Yorker', desc: 'Full at the toes. Hard to hit, easy to miss.', risk: 0.35, stumps: 0.75,
      wickets: [['bowled', 3], ['lbw', 2]], runs: [[0, 5], [1, 4], [2, 1], [4, 0.6], [6, 0.1]],
    },
    bouncer: {
      label: 'Bouncer', desc: 'Short & hostile. Wickets or sixes.', risk: 0.25, stumps: 0.1,
      wickets: [['caught', 3], ['caughtBehind', 1]], runs: [[0, 4], [1, 2], [2, 1], [4, 1.2], [6, 1]],
    },
    goodLength: {
      label: 'Good Length', desc: 'Safe and steady. Few boundaries.', risk: 0.12, stumps: 0.45,
      wickets: [['caughtBehind', 2], ['bowled', 1], ['lbw', 1]], runs: [[0, 5], [1, 5], [2, 2], [3, 0.4], [4, 0.6], [6, 0.15]],
    },
    slower: {
      label: 'Slower Ball', desc: 'Deceives the batter if well disguised.', risk: 0.2, stumps: 0.4,
      wickets: [['caught', 2], ['bowled', 1]], runs: [[0, 4], [1, 3], [2, 2], [4, 1], [6, 0.6]],
    },
  },
  spin: {
    stock: {
      label: 'Stock Ball', desc: 'Turns away and tests the edge.', risk: 0.12, stumps: 0.45,
      wickets: [['caughtBehind', 2], ['lbw', 1], ['bowled', 1]], runs: [[0, 5], [1, 5], [2, 2], [4, 0.5], [6, 0.15]],
    },
    flighted: {
      label: 'Flighted', desc: 'Tossed up to lure the big shot.', risk: 0.25, stumps: 0.35,
      wickets: [['caught', 3], ['stumped', 2]], runs: [[0, 3], [1, 3], [2, 1], [4, 1.2], [6, 1.1]],
    },
    quicker: {
      label: 'Quicker One', desc: 'Skids on flat. Hurries the batter.', risk: 0.2, stumps: 0.7,
      wickets: [['bowled', 2], ['lbw', 2]], runs: [[0, 5], [1, 4], [2, 1], [4, 0.5], [6, 0.2]],
    },
    wrongun: {
      label: "Wrong'un", desc: 'Turns the other way. High risk, high reward.', risk: 0.32, stumps: 0.5,
      wickets: [['stumped', 1], ['bowled', 2], ['caught', 1]], runs: [[0, 4], [1, 3], [2, 1], [4, 1], [6, 0.8]],
    },
  },
}

export const deliveriesFor = (bowler) => DELIVERIES[bowler.style === 'spin' ? 'spin' : 'pace']


const rand = () => Math.random()
export const pick = (weights) => {
  const total = weights.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [v, w] of weights) if ((r -= w) <= 0) return v
  return weights[weights.length - 1][0]
}

export const maxOversPerBowler = (overs) => Math.max(1, Math.ceil(overs / 5))

/** Random extra before the ball is bowled (wide / no-ball). */
export function rollExtra() {
  const r = rand()
  if (r < 0.04) return 'wide'
  if (r < 0.06) return 'noball'
  return null
}

// ---------------- deliveries: length & line ----------------

// Where the ball pitches, in metres in front of the batter's stumps.
export const LENGTHS = ['yorker', 'full', 'good', 'short', 'bouncer']
export const LENGTH_DIST = { yorker: 1.0, full: 3.0, good: 5.6, short: 8.2, bouncer: 10.6 }
export const LENGTH_LABEL = { yorker: 'Yorker', full: 'Full', good: 'Good length', short: 'Short', bouncer: 'Bouncer' }
export function lengthFromDist(d) {
  if (d < 1.7) return 'yorker'
  if (d < 4.2) return 'full'
  if (d < 7) return 'good'
  if (d < 9.4) return 'short'
  return 'bouncer'
}
// The length each delivery type is designed to land on.
export const DELIVERY_LENGTH = {
  yorker: 'yorker', bouncer: 'bouncer', goodLength: 'good', slower: 'full',
  stock: 'good', flighted: 'full', quicker: 'good', wrongun: 'good',
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const neighbour = (len) => {
  const i = LENGTHS.indexOf(len)
  return LENGTHS[clamp(i + (rand() < 0.5 ? -1 : 1), 0, LENGTHS.length - 1)]
}

/** Speed for a delivery in km/h. */
export function deliverySpeed(bowler, key) {
  return bowler.style === 'spin'
    ? Math.round(78 + rand() * 16)
    : Math.round(125 + (bowler.bowl / 100) * 15 + rand() * 10) - (key === 'slower' ? 25 : 0)
}

/** CPU bowler's plan: delivery, where it pitches (lengthDist from stumps, lineX: + = off side) and speed. */
export function cpuDeliveryPlan(bowler) {
  const set = deliveriesFor(bowler)
  const key = pick(Object.keys(set).map((k) => [k, k === 'stock' || k === 'goodLength' ? 3 : 1.5]))
  const length = rand() < 0.25 ? neighbour(DELIVERY_LENGTH[key]) : DELIVERY_LENGTH[key]
  const lengthDist = LENGTH_DIST[length] + (rand() - 0.5) * 1.4
  const lineAtStumps = rand() < 0.15 ? -0.25 - rand() * 0.2 : -0.05 + rand() * 0.45
  return planFor(bowler, key, lengthDist, bounceXFor(lineAtStumps, lengthDist))
}

/** Build a delivery plan from an explicit pitching point (used for the user's marker too). */
export function planFor(bowler, key, lengthDist, lineX) {
  const def = deliveriesFor(bowler)[key]
  const spin = bowler.style === 'spin'
  const turn = spin ? (key === 'wrongun' ? -1 : 1) * (0.18 + rand() * 0.22) : (rand() - 0.5) * 0.16
  const length = lengthFromDist(lengthDist)
  const kmh = deliverySpeed(bowler, key)
  // real ball flight: swing in the air for pace (Magnus/seam), turn off the pitch for spin
  const path = deliveryPath({ kmh, lengthDist, bounceX: lineX, swing: spin ? turn * 1.5 : turn * 15, turn: spin ? -turn * 4 : -turn * 2, spin })
  return { key, def, kmh, lengthDist, length, lineX, turn, spin, path, onStumps: path.hitsStumps }
}

// ---------------- batting (user) ----------------

export const SHOTS = {
  push: { label: 'Push', key: 'A' },
  stroke: { label: 'Stroke', key: 'S' },
  loft: { label: 'Loft', key: 'D' },
}
export const FOOTWORK = {
  front: { label: 'Front foot', key: 'Q' },
  back: { label: 'Back foot', key: 'E' },
  advance: { label: 'Advance', key: 'W' },
}
// How well each footwork option suits each length (1 = ideal).
const FOOT_FIT = {
  yorker: { front: 0.85, back: 0.35, advance: 0.55 },
  full: { front: 1, back: 0.55, advance: 0.95 },
  good: { front: 0.9, back: 0.85, advance: 0.65 },
  short: { front: 0.45, back: 1, advance: 0.35 },
  bouncer: { front: 0.3, back: 0.95, advance: 0.2 },
}
export const bestFoot = (length, spin) =>
  spin && length === 'full' ? 'advance' : Object.entries(FOOT_FIT[length]).sort((a, b) => b[1] - a[1])[0][0]

const SHOT_WORDS = {
  push: ['pushed', 'nudged', 'worked'],
  stroke: ['driven', 'punched', 'crunched'],
  loft: ['lofted', 'launched', 'carted'],
}
const word = (shot) => SHOT_WORDS[shot][Math.floor(rand() * 3)]

// ---------------- physics-driven shots (user and CPU) ----------------

/** LBW evidence from the actual ball path. */
function lbwEvidence(path) {
  const out = path.hitsStumps && !path.pitchedOutsideLeg
  return {
    type: 'lbw',
    out,
    pitching: path.pitchedOutsideLeg ? 'OUTSIDE LEG' : 'IN LINE',
    impact: 'IN LINE',
    wickets: path.hitsStumps ? (Math.abs(path.atStumps.x) > 0.1 ? "UMPIRE'S CALL" : 'HITTING') : 'MISSING',
  }
}

/** No bat on ball (left alone or beaten): bowled, LBW shout, or through to the keeper. */
function unplayed(plan, base, text) {
  const p = plan.path
  if (p.hitsPad) {
    const review = lbwEvidence(p)
    if (review.out) return { runs: 0, wicket: 'lbw', text: 'struck on the pad in front… that is plumb!', review, visual: { ...base, pad: true } }
    return { runs: 0, appeal: 'lbw', text: 'hit on the pad — big appeal, not out.', review, visual: { ...base, pad: true } }
  }
  if (p.hitsStumps) return { runs: 0, wicket: 'bowled', text: base.leave ? 'leaves it… and it crashes into the stumps!' : 'beaten all ends up — the stumps are rattled!', visual: { ...base, stumps: true } }
  return { runs: 0, text, visual: { ...base, miss: !base.leave } }
}

/**
 * Play a shot against a physical delivery.
 * offset: seconds between the button press and the ideal contact time (− early, + late).
 * w: half-width of the PERFECT window in seconds.
 */
export function physicsShot({ shot, foot, dir, offset, w = 0.05, plan, batter, catchRng }) {
  const { length, spin } = plan
  if (!shot) return unplayed(plan, { shot: null, dir: 0, dist: 0, leave: true }, 'leaves it alone, through to the keeper.')

  const timing = gradeTiming(offset, w)
  const f = foot ?? bestFoot(length, spin)
  if (timing.grade === 'miss') {
    if (f === 'advance' && spin && !plan.path.hitsPad && rand() < 0.6) {
      return { runs: 0, wicket: 'stumped', timing: timing.label, grade: 'miss', text: 'charges down the track, misses… stumped!', visual: { shot, dir, foot: f, stumps: true, catcher: 'keeper' } }
    }
    return { ...unplayed(plan, { shot, dir, foot: f, dist: 0 }, `${timing.label === 'early' ? 'too early' : 'too late'}, beaten outside off.`), timing: timing.label, grade: 'miss' }
  }

  // playing across the line / with the wrong footwork makes edges likelier
  const lineX = plan.path.atBatter.x
  const lineF = (lineX > 0.3 && dir < -25) || (lineX < -0.2 && dir > 25) ? 0.7 : 1
  // shot assist picks the footwork but never quite as crisply as doing it yourself
  const fit = FOOT_FIT[length][f] * lineF * (foot ? 1 : 0.94)
  const hit = hitBall({ shot, dir, timing, fit, batter, path: plan.path })
  const fl = flight({ x: hit.contact.x, y: hit.contact.y, z: hit.contact.z }, hit.v)
  const a = adjudicate(fl, { rng: catchRng })
  const zone = zoneName(Math.max(-180, Math.min(180, hit.deg)))
  const z = zone.toLowerCase()
  const visual = { shot, foot: f, dir: hit.deg, edge: hit.zone === 'edge', zone: hit.zone, flight: fl, adj: a }
  const tl = timing.label
  const base = { timing: tl, grade: timing.grade, zone: hit.zone, visual }

  if (a.kind === 'caught') {
    const wicket = a.by === 'keeper' ? 'caughtBehind' : 'caught'
    const how = hit.zone === 'edge' ? 'gets an outside edge' : hit.zone === 'toe' ? 'top-edges it high' : tl === 'early' ? 'through it too early' : tl === 'late' ? 'a touch late on it' : 'goes for it'
    const catcher = typeof a.by === 'number' ? a.by : a.by
    return { ...base, runs: 0, wicket, catcher, text: `${how}… ${a.by === 'keeper' ? 'taken by the keeper!' : a.by === 'bowler' ? 'caught and bowled!' : `caught at ${FIELD_ANGLES[a.by].name.toLowerCase()}!`}` }
  }
  if (a.kind === 'six') return { ...base, runs: 6, text: `${tl === 'perfect' ? 'perfectly timed, ' : ''}${word('loft')} over ${z} — that's a massive SIX!` }
  if (a.kind === 'four') return { ...base, runs: 4, text: hit.zone === 'edge' ? 'edged… and it runs away to the third-man boundary for FOUR!' : `${word(shot)} through ${z} for FOUR!` }
  const runs = a.runs ?? 0
  const fielder = typeof a.by === 'number' ? FIELD_ANGLES[a.by].name.toLowerCase() : a.by
  const text =
    a.kind === 'dropped' ? `put down by ${typeof a.by === 'number' ? FIELD_ANGLES[a.by].name.toLowerCase() : 'the ' + a.by}! ${runs ? `they scamper ${runs}.` : 'no run.'}`
    : hit.zone === 'edge' ? `edged, ${runs ? `runs down to third man for ${runs}.` : 'dies before the fielder.'}`
    : runs === 0 ? (shot === 'push' ? 'solid defence, no run.' : `${word(shot)} straight to ${fielder}, no run.`)
    : `${word(shot)} towards ${z}, ${runs === 1 ? 'quick single' : `they come back for ${runs}`}.`
  return { ...base, runs, catcher: a.kind === 'dropped' ? null : a.by, dropped: a.kind === 'dropped', text }
}

/** The CPU batter picks a shot and times it (worse against good bowling), then the same physics plays out. */
export function cpuPhysicsShot({ plan, accuracy, batter, bowler, cpuSkill = 1, aggression = 1 }) {
  const quality = clamp(accuracy, 0, 1)
  const batF = (0.5 + (batter.bat / 100) * 0.8) * cpuSkill
  const bowlF = 0.6 + (bowler.bowl / 100) * 0.6
  const { length } = plan
  const wide = Math.abs(plan.path.atBatter.x) > 0.45
  // leave wide balls outside off now and then
  if (wide && plan.path.atBatter.x > 0 && rand() < 0.45 / aggression) return physicsShot({ shot: null, plan, batter })
  const loose = quality < 0.25
  const loftP = clamp(0.12 * aggression + (loose ? 0.35 : 0) + (length === 'full' || length === 'short' ? 0.1 : 0) - (length === 'yorker' ? 0.15 : 0), 0, 0.85)
  const shot = rand() < loftP ? 'loft' : rand() < 0.22 / aggression ? 'push' : 'stroke'
  const foot = rand() < 0.65 + batter.bat / 300 ? bestFoot(length, plan.spin) : pick([['front', 1], ['back', 1]])
  const dir = cpuDirection(length, shot === 'push' ? 0 : 1)
  // timing error grows with bowling quality, shrinks with batting skill
  const sd = loose ? 0.04 : 0.045 + 0.08 * ((quality * bowlF) / batF)
  const gauss = (rand() + rand() + rand() - 1.5) * 1.15
  return physicsShot({ shot, foot, dir, offset: gauss * sd, w: 0.05, plan, batter })
}

// ---------------- batting (CPU, when the user bowls) ----------------

/** Pick a direction that finds a gap (or hits a fielder when `toFielder`). */
function cpuDirection(length, runs) {
  const pref = length === 'short' || length === 'bouncer' ? [-110, -40] : length === 'full' || length === 'yorker' ? [-30, 60] : [-80, 100]
  let best = null
  for (let i = 0; i < 8; i++) {
    const d = pref[0] + rand() * (pref[1] - pref[0])
    const gap = nearestFielder(d).gap
    if (!best || (runs > 0 ? gap > best.gap : gap < best.gap)) best = { d, gap }
  }
  return best.d
}

// ---------------- umpiring & DRS ----------------

export const REVIEWABLE = ['lbw', 'caughtBehind']

/** Evidence the review system will show, consistent with whether it was really out. */
function reviewData(type, out) {
  if (type === 'caughtBehind') return { type, out, edge: out }
  if (out) return { type, out, pitching: 'IN LINE', impact: 'IN LINE', wickets: rand() < 0.2 ? "UMPIRE'S CALL" : 'HITTING' }
  const why = pick([['pitching', 1], ['impact', 1], ['wickets', 2]])
  return {
    type,
    out,
    pitching: why === 'pitching' ? 'OUTSIDE LEG' : 'IN LINE',
    impact: why === 'impact' ? 'OUTSIDE OFF' : 'IN LINE',
    wickets: why === 'wickets' ? 'MISSING' : 'HITTING',
  }
}

/**
 * The on-field umpire's decision. Sometimes wrong — which is what reviews are for.
 * Adds `review` (the truth + evidence) and either keeps the wicket, turns it down (`appeal`), or gives a wrong one.
 */
export function umpireCall(result) {
  if (result.extra) return result
  const v = result.visual ?? {}
  if (result.wicket && REVIEWABLE.includes(result.wicket)) {
    const review = result.review ?? reviewData(result.wicket, true)
    if (rand() < 0.12) return { ...result, wicket: null, runs: 0, appeal: result.wicket, review, text: 'huge appeal… not out, says the umpire!' }
    return { ...result, review }
  }
  // close shouts after the batter is beaten that are actually not out
  if (!result.wicket && result.runs === 0 && (v.miss || v.leave) && rand() < 0.22) {
    const type = rand() < 0.6 ? 'lbw' : 'caughtBehind'
    const review = reviewData(type, false)
    if (rand() < 0.35) {
      return {
        ...result,
        wicket: type,
        review,
        text: type === 'lbw' ? 'struck on the pad, and the finger goes up!' : 'appeal for caught behind… given!',
        visual: type === 'lbw' ? { ...v, pad: true, miss: false, leave: false } : v,
      }
    }
    return { ...result, appeal: type, review, text: 'big appeal, but not out.', visual: type === 'lbw' ? { ...v, pad: true, miss: false, leave: false } : v }
  }
  return result
}

/** Outcome of a review: final decision and whether the review is kept. */
export function decideReview(result) {
  const r = result.review
  const givenOut = !!result.wicket
  const umpiresCall = r.out && r.wickets === "UMPIRE'S CALL"
  const finalOut = umpiresCall ? givenOut : r.out
  return { finalOut, overturned: finalOut !== givenOut, umpiresCall, retained: finalOut !== givenOut || umpiresCall }
}

/** Apply a review outcome to a ball result. */
export function applyReview(result, decision) {
  if (decision.finalOut && !result.wicket) return { ...result, wicket: result.appeal ?? result.review.type, runs: 0, text: 'given out on review!' }
  if (!decision.finalOut && result.wicket) return { ...result, wicket: null, runs: 0, text: 'not out after the review — decision overturned!' }
  return result
}

// ---------------- innings state ----------------

const blankBatter = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, out: null, batted: false })
const blankBowler = () => ({ balls: 0, runs: 0, wickets: 0, maidens: 0, overRuns: 0 })

export function newInnings(battingTeam, bowlingTeam, target = null) {
  const batters = Object.fromEntries(battingTeam.xi.map((p) => [p.id, blankBatter()]))
  const [s, ns] = battingTeam.xi
  batters[s.id].batted = true
  batters[ns.id].batted = true
  return {
    battingTeam,
    bowlingTeam,
    target, // runs needed to win (null in 1st innings)
    runs: 0,
    wickets: 0,
    balls: 0, // legal deliveries
    extras: 0,
    fours: 0,
    sixes: 0,
    batters, // id -> batting figures
    striker: s.id,
    nonStriker: ns.id,
    bowlers: {}, // id -> bowling figures, in the order they came on
    bowler: null,
    lastOverBowler: null,
    partnership: { runs: 0, balls: 0 },
    fow: [],
    log: [], // { over, label } per delivery, for the over display
    commentary: [],
  }
}

export const findPlayer = (team, id) => team.xi.find((p) => p.id === id)

export const keeperOf = (team) => team.xi.find((p) => p.role === 'WK') ?? team.xi[team.xi.length - 1]
/** The nine fielders, in the order they take the positions in field.js FIELD. */
export const fieldersOf = (inn) => {
  const k = keeperOf(inn.bowlingTeam)
  return inn.bowlingTeam.xi.filter((p) => p.id !== k.id && p.id !== inn.bowler).slice(0, 9)
}

export const needsBatter = (inn) => inn.striker == null || inn.nonStriker == null

export function addBatter(inn, id) {
  const batters = { ...inn.batters, [id]: { ...inn.batters[id], batted: true } }
  const slot = inn.striker == null ? 'striker' : 'nonStriker'
  return { ...inn, batters, [slot]: id, partnership: { runs: 0, balls: 0 } }
}

export function setBowler(inn, id) {
  return { ...inn, bowler: id, bowlers: inn.bowlers[id] ? inn.bowlers : { ...inn.bowlers, [id]: blankBowler() } }
}

export const yetToBat = (inn) => inn.battingTeam.xi.filter((p) => !inn.batters[p.id].batted)

/** Bowlers allowed to bowl the next over (no back-to-back overs, quota respected, keeper excluded). */
export function availableBowlers(inn, overs) {
  const quota = maxOversPerBowler(overs) * 6
  return inn.bowlingTeam.xi.filter(
    (p) => p.role !== 'WK' && p.id !== inn.lastOverBowler && (inn.bowlers[p.id]?.balls ?? 0) < quota,
  )
}

export function cpuPickBowler(inn, overs) {
  const options = availableBowlers(inn, overs).sort((a, b) => b.bowl - a.bowl).slice(0, 4)
  return pick(options.map((p, i) => [p.id, 4 - i])) // favour the best, but rotate
}

export const cpuPickBatter = (inn) => yetToBat(inn)[0].id

function dismissalText(type, bowler, fieldingXI, catcherId) {
  const keeper = fieldingXI.find((p) => p.role === 'WK') ?? fieldingXI[0]
  switch (type) {
    case 'bowled': return `b ${bowler.short}`
    case 'lbw': return `lbw b ${bowler.short}`
    case 'caughtBehind': return `c †${keeper.short} b ${bowler.short}`
    case 'stumped': return `st †${keeper.short} b ${bowler.short}`
    default: {
      const named = catcherId && fieldingXI.find((p) => p.id === catcherId)
      if (named) return named.id === bowler.id ? `c & b ${bowler.short}` : `c ${named.short} b ${bowler.short}`
      if (rand() < 0.1) return `c & b ${bowler.short}`
      const fielders = fieldingXI.filter((p) => p.id !== bowler.id && p.id !== keeper.id)
      return `c ${fielders[Math.floor(rand() * fielders.length)].short} b ${bowler.short}`
    }
  }
}

/** Apply a delivery result to an innings and return the new innings. */
export function applyBall(inn, result) {
  const bowler = findPlayer(inn.bowlingTeam, inn.bowler)
  const striker = findPlayer(inn.battingTeam, inn.striker)
  const over = `${Math.floor(inn.balls / 6)}.${(inn.balls % 6) + 1}`
  const prefix = `${bowler.short} to ${striker.short}, `
  const next = {
    ...inn,
    batters: { ...inn.batters },
    bowlers: { ...inn.bowlers },
    log: [...inn.log],
    commentary: [...inn.commentary],
    fow: [...inn.fow],
    partnership: { ...inn.partnership },
  }
  const bw = { ...inn.bowlers[inn.bowler] }
  next.bowlers[inn.bowler] = bw

  if (result.extra) {
    next.runs += 1
    next.extras += 1
    next.partnership.runs += 1
    bw.runs += 1
    bw.overRuns += 1
    next.log.push({ over: Math.floor(inn.balls / 6), label: result.extra === 'wide' ? 'Wd' : 'Nb' })
    next.commentary.unshift({ over, text: prefix + (result.extra === 'wide' ? 'wide ball, +1.' : 'no ball! +1.'), kind: 'extra' })
    return next
  }

  const bat = { ...inn.batters[inn.striker] }
  next.batters[inn.striker] = bat

  next.balls += 1
  next.runs += result.runs
  next.partnership.runs += result.runs
  next.partnership.balls += 1
  bat.runs += result.runs
  bat.balls += 1
  bw.balls += 1
  bw.runs += result.runs
  bw.overRuns += result.runs
  if (result.runs === 4) { next.fours += 1; bat.fours += 1 }
  if (result.runs === 6) { next.sixes += 1; bat.sixes += 1 }
  next.log.push({ over: Math.floor(inn.balls / 6), label: result.wicket ? 'W' : String(result.runs) })

  let text = prefix + result.text
  if (result.wicket) {
    bat.out = dismissalText(result.wicket, bowler, inn.bowlingTeam.xi, result.catcherId)
    bw.wickets += 1
    next.wickets += 1
    next.fow.push({ score: next.runs, wicket: next.wickets, over, name: striker.short })
    text = `OUT! ${prefix}${result.text} ${striker.short} ${bat.out} ${bat.runs} (${bat.balls})`
    next.striker = null
  } else if (result.runs % 2 === 1) {
    ;[next.striker, next.nonStriker] = [next.nonStriker, next.striker]
  }
  next.commentary.unshift({ over, text, kind: result.wicket ? 'wicket' : result.runs >= 4 ? 'boundary' : 'normal' })

  // End of over: batters change ends and a new bowler is needed.
  if (next.balls % 6 === 0) {
    if (bw.overRuns === 0) bw.maidens += 1
    bw.overRuns = 0
    ;[next.striker, next.nonStriker] = [next.nonStriker, next.striker]
    next.lastOverBowler = inn.bowler
    next.bowler = null
  }
  return next
}

export function isInningsOver(inn, overs, wickets) {
  if (inn.wickets >= Math.min(wickets, inn.battingTeam.xi.length - 1)) return true
  if (inn.balls >= overs * 6) return true
  if (inn.target != null && inn.runs >= inn.target) return true
  return false
}

export const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`
export const runRate = (runs, balls) => (balls ? ((runs / balls) * 6).toFixed(2) : '0.00')
export const strikeRate = (runs, balls) => (balls ? ((runs / balls) * 100).toFixed(1) : '0.0')
export const figures = (b) => `${b.wickets}-${b.runs}`

/** Labels for the deliveries in the current over (or the last completed one). */
export function currentOver(inn) {
  const idx = Math.floor(inn.balls / 6)
  let balls = inn.log.filter((b) => b.over === idx)
  if (!balls.length && idx > 0) balls = inn.log.filter((b) => b.over === idx - 1)
  return balls.map((b) => b.label)
}

export function cpuTossChoice() {
  return rand() < 0.5 ? 'bat' : 'bowl'
}

/** Summarise a finished match, including Player of the Match. */
// ---------------- formats ----------------

export const FORMATS = {
  t20: { id: 't20', name: 'T20', overs: 20, inningsPerSide: 1, reviews: 2 },
  odi: { id: 'odi', name: 'One Day', overs: 50, inningsPerSide: 1, reviews: 2 },
  test: { id: 'test', name: 'Test', overs: 90, inningsPerSide: 2, reviews: 3, whites: true },
  custom: { id: 'custom', name: 'Quick', overs: 2, inningsPerSide: 1, reviews: 1 },
}

const total = (innings, teamId) => innings.filter((i) => i.battingTeam.id === teamId).reduce((s, i) => s + i.runs, 0)

/**
 * What happens after innings `done.length - 1` finishes: either the match is over, or who bats next and the target.
 * Innings alternate A, B, A, B (no follow-on).
 */
export function nextInnings(done, inningsPerSide) {
  const totalInnings = inningsPerSide * 2
  const last = done[done.length - 1]
  const A = done[0].battingTeam
  const B = done[0].bowlingTeam
  if (done.length >= totalInnings) return null
  if (last.target != null && last.runs >= last.target) return null
  // Test: side batting third is still behind after both its innings → innings defeat
  if (inningsPerSide === 2 && done.length === 3 && total(done, A.id) < total(done, B.id)) return null
  const batting = last.bowlingTeam
  const bowling = last.battingTeam
  const isLast = done.length === totalInnings - 1
  const target = isLast ? total(done, bowling.id) - total(done, batting.id) + 1 : null
  return { batting, bowling, target: target != null ? Math.max(1, target) : null }
}

/** Summarise a finished match (2 innings for limited overs, 3–4 for a Test). */
export function matchResult(innings, wickets, userId) {
  const first = innings[0]
  const A = first.battingTeam
  const B = first.bowlingTeam
  const last = innings[innings.length - 1]
  const allOut = (inn) => inn.wickets >= Math.min(wickets, 10)
  let winner = null
  let margin = ''
  let draw = false
  const tA = total(innings, A.id)
  const tB = total(innings, B.id)

  if (innings.length === 3) {
    winner = B
    margin = `by an innings and ${tB - tA} run${tB - tA !== 1 ? 's' : ''}`
  } else if (last.target != null && last.runs >= last.target) {
    winner = last.battingTeam
    const w = Math.min(wickets, 10) - last.wickets
    margin = `by ${w} wicket${w !== 1 ? 's' : ''}`
  } else if (innings.length === 4 && !allOut(last)) {
    draw = true
    margin = 'Match drawn'
  } else if (tA === tB) {
    margin = 'Match tied!'
  } else {
    winner = last.bowlingTeam
    const r = Math.abs(tA - tB)
    margin = `by ${r} run${r !== 1 ? 's' : ''}`
  }

  // Player of the match: runs + quick-scoring bonus, or wickets + economy; winners favoured.
  let best = null
  for (const inn of innings) {
    for (const p of inn.battingTeam.xi) {
      const b = inn.batters[p.id]
      if (!b.batted) continue
      const score = b.runs + Math.max(0, b.runs - b.balls) * 0.5 + (winner?.id === inn.battingTeam.id ? 8 : 0)
      if (!best || score > best.score) best = { player: p, team: inn.battingTeam, score, line: `${b.runs}${b.out ? '' : '*'} (${b.balls})` }
    }
    for (const p of inn.bowlingTeam.xi) {
      const b = inn.bowlers[p.id]
      if (!b) continue
      const score = b.wickets * 25 + Math.max(0, b.balls * 1.5 - b.runs) + (winner?.id === inn.bowlingTeam.id ? 8 : 0)
      if (score > best.score) best = { player: p, team: inn.bowlingTeam, score, line: `${figures(b)} (${oversText(b.balls)} ov)` }
    }
  }

  const userInns = innings.filter((i) => i.battingTeam.id === userId)
  return {
    winner,
    margin,
    draw,
    potm: best,
    userWon: winner?.id === userId,
    userRuns: Math.max(0, ...userInns.map((i) => i.runs)),
    userSixes: userInns.reduce((s, i) => s + i.sixes, 0),
    totals: { [A.id]: tA, [B.id]: tB },
  }
}

// ---------------- instant simulation (fast-forward / other tournament games) ----------------

// Per-ball outcome rates by format (calibrated to typical scoring), adjusted by batter vs bowler ratings.
const SIM = {
  t20: { wkt: 0.052, runs: [[0, 0.36], [1, 0.38], [2, 0.08], [3, 0.01], [4, 0.12], [6, 0.05]] },
  odi: { wkt: 0.03, runs: [[0, 0.5], [1, 0.33], [2, 0.07], [3, 0.01], [4, 0.07], [6, 0.02]] },
  test: { wkt: 0.017, runs: [[0, 0.7], [1, 0.18], [2, 0.04], [3, 0.01], [4, 0.06], [6, 0.005]] },
}
export const simStyle = (overs) => (overs <= 20 ? 't20' : overs <= 50 ? 'odi' : 'test')

/** Play one ball without visuals (fast-forward and other tournament games). */
export function simulateBall(inn, overs) {
  let c = inn
  if (needsBatter(c)) c = addBatter(c, cpuPickBatter(c))
  if (c.bowler == null) c = setBowler(c, cpuPickBowler(c, overs))
  const extra = rollExtra()
  if (extra && rand() < 0.6) return applyBall(c, { extra })
  const bowler = findPlayer(c.bowlingTeam, c.bowler)
  const batter = findPlayer(c.battingTeam, c.striker)
  const m = SIM[simStyle(overs)]
  const d = (batter.bat - bowler.bowl) / 100
  // chasing sides take more risk when the asking rate climbs
  let press = 1
  if (c.target != null) {
    const left = Math.max(overs * 6 - c.balls, 1)
    press = clamp((((c.target - c.runs) / left) * 6) / 8, 0.7, 1.8)
  }
  if (rand() < m.wkt * clamp(1 - d * 0.8, 0.35, 2.2) * (0.6 + 0.4 * press)) {
    const wicket = pick([['caught', 5], ['bowled', 2], ['lbw', 2], ['caughtBehind', 2], ['stumped', bowler.style === 'spin' ? 1 : 0]])
    const r = { runs: 0, wicket, text: 'and that is a wicket!' }
    if (wicket === 'caught') r.catcherId = fieldersOf(c)[Math.floor(rand() * 9)]?.id
    return applyBall(c, r)
  }
  const boost = clamp(1 + d * 0.8, 0.4, 1.8) * press
  const runs = pick(m.runs.map(([r, w]) => [r, r >= 4 ? w * boost : w]))
  const text = runs === 0 ? 'no run.' : runs === 6 ? 'six!' : runs === 4 ? 'four!' : `${runs} run${runs > 1 ? 's' : ''}.`
  return applyBall(c, { runs, text })
}

/** Simulate a whole limited-overs match between two teams (for the rest of a tournament). */
export function simulateMatch(teamA, teamB, overs, wickets = 10) {
  let inn1 = newInnings(teamA, teamB)
  let guard = 0
  while (!isInningsOver(inn1, overs, wickets) && guard++ < 2000) inn1 = simulateBall(inn1, overs)
  let inn2 = newInnings(teamB, teamA, inn1.runs + 1)
  guard = 0
  while (!isInningsOver(inn2, overs, wickets) && guard++ < 2000) inn2 = simulateBall(inn2, overs)
  return { innings: [inn1, inn2], result: matchResult([inn1, inn2], wickets, null) }
}
