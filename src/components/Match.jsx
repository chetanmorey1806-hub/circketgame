import { useCallback, useEffect, useRef, useState } from 'react'
import { sound } from '../audio/sound.js'
import { call } from '../game/commentary.js'
import {
  DIFFICULTY,
  FOOTWORK,
  LENGTH_LABEL,
  addBatter,
  applyBall,
  applyReview,
  availableBowlers,
  cpuDeliveryPlan,
  cpuPickBatter,
  cpuPickBowler,
  decideReview,
  deliveriesFor,
  fieldersOf,
  findPlayer,
  isInningsOver,
  keeperOf,
  lengthFromDist,
  matchResult,
  maxOversPerBowler,
  needsBatter,
  newInnings,
  nextInnings,
  oversText,
  planFor,
  cpuPhysicsShot,
  physicsShot,
  rollExtra,
  runRate,
  setBowler,
  simulateBall,
  umpireCall,
  yetToBat,
} from '../game/engine.js'
import { FIELD, STRIKER_Z, zoneName } from '../game/field.js'
import { GUARDS, lineAtStumpsFor, setGuard as setPhysicsGuard } from '../game/physics.js'
import { nextView, viewLabel } from '../three/World.js'

const GUARD_ORDER = ['leg', 'middle', 'off']
const nextGuard = (g) => GUARD_ORDER[(GUARD_ORDER.indexOf(g) + 1) % GUARD_ORDER.length]
import { BTN, useGamepad } from '../app/gamepad.js'
import Scene3D from './Scene3D.jsx'
import Scorecard from './Scorecard.jsx'
import TeamLogo from './TeamLogo.jsx'
import { EventGraphic, LowerThird, Scorebug } from './Hud.jsx'
import { Avatar, Modal, RoleBadge, Rating } from './Player.jsx'

const RESULT_PAUSE_MS = 1500
const SHOT_KEYS = { a: 'push', s: 'hit', d: 'loft' }
const FOOT_KEYS = { q: 'front', e: 'back', w: 'advance' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Direction joystick: drag/click to aim. Screen-down = straight back past the bowler. */
function Joystick({ dir, onChange, mirror }) {
  const ref = useRef(null)
  const set = (e) => {
    const r = ref.current.getBoundingClientRect()
    const kx = (e.clientX - r.left - r.width / 2) * (mirror ? -1 : 1)
    const ky = e.clientY - r.top - r.height / 2
    if (Math.hypot(kx, ky) < 6) return
    onChange(Math.round((Math.atan2(-kx, ky) * 180) / Math.PI))
  }
  const a = (dir * Math.PI) / 180
  const kx = -Math.sin(a) * 34 * (mirror ? -1 : 1)
  const ky = Math.cos(a) * 34
  return (
    <div
      className="joystick"
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(e)
      }}
      onPointerMove={(e) => e.buttons && set(e)}
    >
      <div className="js-ring" />
      <div className="js-knob" style={{ transform: `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))` }} />
      <span className="js-label">{zoneName(dir)}</span>
    </div>
  )
}

/** Little batter silhouettes for the footwork buttons. */
function FootIcon({ kind }) {
  const pose = {
    front: 'M14 6a3 3 0 1 1 0 .1M14 10l-2 9M12 19l7 6M12 19l-6 7M13 12l6-2l4 4',
    back: 'M12 6a3 3 0 1 1 0 .1M12 10l1 9M13 19l-3 7M13 19l5 6M12 12l-5-1l-3 3',
    advance: 'M15 6a3 3 0 1 1 0 .1M15 10l-3 8M12 18l6 3l-1 5M12 18l-6 7M14 12l5 2M3 14h5M4 18h4',
  }[kind]
  return (
    <svg viewBox="0 0 28 30" className="foot-icon">
      <path d={pose} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Mini field radar (top-left), like the broadcast/game map. */
function Radar({ dir, showDir }) {
  const S = 0.62 // px per metre
  const X = (x) => 50 - x * S // off side on the left, matching the broadcast camera
  const Y = (z) => 50 + z * S
  const a = (dir * Math.PI) / 180
  return (
    <svg className="radar" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" className="radar-ground" />
      <circle cx="50" cy="50" r={27.4 * S} className="radar-ring" />
      <rect x="48.8" y={50 - 10 * S} width="2.4" height={20 * S} className="radar-pitch" />
      {FIELD.map((f) => (
        <circle key={f.name} cx={X(f.x)} cy={Y(f.z)} r="2.4" className="radar-fielder" />
      ))}
      <circle cx={X(0.4)} cy={Y(12.6)} r="2.2" className="radar-fielder" />
      <circle cx="50" cy={Y(STRIKER_Z)} r="2.6" className="radar-batter" />
      {showDir && <line x1="50" y1={Y(STRIKER_Z)} x2={50 - Math.sin(a) * 40} y2={Y(STRIKER_Z) - Math.cos(a) * 40} className="radar-dir" />}
    </svg>
  )
}

/** UltraEdge trace: flat line, or a sharp spike when bat touched ball. */
function UltraEdge({ edge }) {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const spike = edge && i > 58 && i < 66 ? Math.sin(((i - 58) / 8) * Math.PI) * 38 * (i % 2 ? -1 : 1) : 0
    pts.push(`${i * 2.5},${50 + (Math.sin(i * 1.7) + Math.sin(i * 0.6)) * 2.2 + spike}`)
  }
  return (
    <svg className="ultraedge" viewBox="0 0 300 100">
      <line x1="150" y1="5" x2="150" y2="95" className="ue-bat" />
      <polyline points={pts.join(' ')} className="ue-wave" />
    </svg>
  )
}

/** Decision Review System panel. */
function DrsPanel({ drs }) {
  if (!drs) return null
  const { review, decision, stage, team } = drs
  const rows = review.type === 'lbw' ? [['PITCHING', review.pitching], ['IMPACT', review.impact], ['WICKETS', review.wickets]] : null
  const good = (v) => (v === 'IN LINE' || v === 'HITTING' ? 'red' : v === "UMPIRE'S CALL" ? 'amber' : 'green')
  return (
    <div className="drs" style={{ '--p': team.colors.primary }}>
      <div className="drs-head">
        <span className="drs-logo">DRS</span>
        <span>{team.short} review · {review.type === 'lbw' ? 'LBW' : 'Caught behind'}</span>
      </div>
      {stage === 'checking' && <div className="drs-check">Checking<span className="dots">…</span></div>}
      {stage !== 'checking' && rows && (
        <div className="drs-rows">
          {rows.map(([k, v], i) => (
            <div key={k} className={`drs-row ${good(v)}`} style={{ animationDelay: `${i * 0.6}s` }}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}
      {stage !== 'checking' && !rows && (
        <div className="drs-ue">
          <small>ULTRAEDGE</small>
          <UltraEdge edge={review.edge} />
          <b className={review.edge ? 'red' : 'green'}>{review.edge ? 'EDGE DETECTED' : 'NO EDGE'}</b>
        </div>
      )}
      {stage === 'decision' && (
        <div className={`drs-final ${decision.finalOut ? 'out' : 'notout'}`}>
          {decision.finalOut ? 'OUT' : 'NOT OUT'}
          <small>{decision.overturned ? 'Decision overturned' : decision.umpiresCall ? "Umpire's call — stays" : 'Original decision stays'}</small>
        </div>
      )}
    </div>
  )
}

export default function Match({ settings, battingFirst, onFinish, onQuit }) {
  const diff = DIFFICULTY[settings.difficulty]
  const { user, cpu, overs, wickets } = settings
  const format = settings.format ?? { inningsPerSide: 1, reviews: 2 }
  const ips = format.inningsPerSide ?? 1

  /** Fill in whatever the innings needs next (batter / bowler); CPU picks automatically, the user via a picker. */
  const prepare = (cur) => {
    const userBats = cur.battingTeam.id === user.id
    let c = cur
    if (needsBatter(c)) {
      if (userBats) return { inn: c, phase: 'pickBatter' }
      c = addBatter(c, cpuPickBatter(c))
    }
    if (c.bowler == null) {
      if (!userBats) return { inn: c, phase: 'pickBowler' }
      c = setBowler(c, cpuPickBowler(c, overs))
    }
    return { inn: c, phase: 'ready' }
  }

  const initRef = useRef(null)
  if (!initRef.current) {
    const ch = settings.challenge
    if (ch) {
      // challenge: the first innings is already "played" — start the chase with the target set
      const chaser = ch.kind === 'chase' ? user : cpu
      const setter = ch.kind === 'chase' ? cpu : user
      const first = { ...newInnings(setter, chaser), runs: ch.target - 1, wickets: 6, balls: overs * 6, synthetic: true }
      initRef.current = { ...prepare(newInnings(chaser, setter, ch.target)), done: [first] }
    } else {
      initRef.current = prepare(battingFirst === 'user' ? newInnings(user, cpu) : newInnings(cpu, user))
    }
  }

  const [done, setDone] = useState(initRef.current.done ?? []) // completed innings
  const [nextUp, setNextUp] = useState(null) // { batting, bowling, target } during the break
  const [inn, setInn] = useState(initRef.current.inn)
  // phase: ready | aiming | runup | delivering | play | result | pickBatter | pickBowler | break | over
  const [phase, setPhase] = useState(initRef.current.phase)
  const userBatting = inn.battingTeam.id === user.id
  const inningsIdx = done.length

  const [world, setWorld] = useState(null)
  const [event, setEvent] = useState(null)
  const [lowerThird, setLowerThird] = useState(null)
  const [commentary, setCommentary] = useState(null)
  const [deliveryInfo, setDeliveryInfo] = useState(null)
  const [timing, setTiming] = useState(null) // { label, pos } for the EARLY/PERFECT/LATE bar
  const [paused, setPaused] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [view, setView] = useState('broadcast')
  const [guard, setGuard] = useState('middle') // batting guard on the popping crease
  const [replaying, setReplaying] = useState(false)
  const [flying, setFlying] = useState(false)
  const [drs, setDrs] = useState(null)
  const [reviewOffer, setReviewOffer] = useState(null)
  const [reviews, setReviews] = useState({ [user.id]: format.reviews, [cpu.id]: format.reviews })

  // batting controls
  const [dir, setDir] = useState(25)
  const [foot, setFoot] = useState(null) // null = shot assist chooses
  const [assist, setAssist] = useState(true)
  const [lofted, setLofted] = useState(false) // HIT plays a lofted shot when on
  // bowling controls
  const [deliveryKey, setDeliveryKey] = useState(null)
  const [marker, setMarker] = useState({ lineX: 0.2, lengthDist: 5.6 })
  const [meter, setMeter] = useState(0)

  const striker = inn.striker != null ? findPlayer(inn.battingTeam, inn.striker) : null
  const bowler = inn.bowler != null ? findPlayer(inn.bowlingTeam, inn.bowler) : null
  const deliverySet = bowler ? deliveriesFor(bowler) : null
  const deliveryKeys = deliverySet ? Object.keys(deliverySet) : []
  const delivery = deliverySet?.[deliveryKey] ? deliveryKey : deliveryKeys[0]
  const sweetFor = (p) => diff.sweet * (0.7 + (p.bat / 100) * 0.6)

  const timersRef = useRef([])
  const rafRef = useRef(0)
  const ballRef = useRef(null) // { plan, travel, sweet, resolved }
  const meterRef = useRef(0)
  const innRef = useRef(inn)
  innRef.current = inn
  const doneRef = useRef(done)
  doneRef.current = done
  const reviewsRef = useRef(reviews)
  reviewsRef.current = reviews
  const reviewResolve = useRef(null)
  const later = (fn, ms) => timersRef.current.push(setTimeout(fn, ms))
  const say = (event, ctx) => {
    const text = call(event, ctx, sound.prefs.lang)
    sound.say(text)
    return text
  }

  useEffect(() => {
    document.body.classList.add('in-game')
    sound.unlock()
    sound.startCrowd()
    return () => {
      document.body.classList.remove('in-game')
      sound.stopCrowd()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      cancelAnimationFrame(rafRef.current)
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  // TV-style fly-over of the stadium when the match starts
  useEffect(() => {
    if (!world) return
    setFlying(true)
    world.flyover().then(() => setFlying(false))
  }, [world])

  // stadium sounds from the 3D world
  useEffect(() => {
    if (!world) return
    world.onEvent = (type, data, pan = 0) => {
      // bat/ball sounds come from where the ball is on screen; the crowd stays all around you
      if (type === 'bat') sound.sfx((data ?? 1) < 0.5 ? 'edge' : 'bat', data ?? 1, pan)
      else if (type === 'bounce') sound.sfx('bounce', 1, pan)
      else if (type === 'stumps') sound.sfx('stumps', 1, pan)
      else if (type === 'catch') sound.sfx('catch', 1, pan)
      else if (type === 'six') sound.sfx('roar', 1)
      else if (type === 'four') sound.sfx('cheer', 1)
      else if (type === 'wicket') sound.sfx('roar', 0.8)
      else if (type === 'appeal') sound.sfx('appeal')
    }
  }, [world])

  const travelFor = (plan) => (diff.ballMs / 1000) * (plan.spin ? 1.2 : 140 / plan.kmh) * 1.05

  // ---- keep the 3D world's line-up in sync ----
  const lineupKey = `${inn.battingTeam.id}|${inn.striker}|${inn.nonStriker}|${inn.bowler}|${inningsIdx}`
  useEffect(() => {
    if (!world || !['ready', 'pickBatter', 'pickBowler'].includes(phase)) return
    world.setLineup({
      battingTeam: inn.battingTeam,
      bowlingTeam: inn.bowlingTeam,
      striker,
      nonStriker: inn.nonStriker != null ? findPlayer(inn.battingTeam, inn.nonStriker) : null,
      bowler: bowler ?? inn.bowlingTeam.xi.find((p) => p.role === 'BOWL'),
      keeper: keeperOf(inn.bowlingTeam),
      fielders: fieldersOf(inn),
    })
    world.setBigScreen(`${inn.battingTeam.short} ${inn.runs}/${inn.wickets}`, inn.target ? `Target ${inn.target} · ${oversText(inn.balls)} ov` : `${oversText(inn.balls)} overs`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, lineupKey, phase === 'ready'])

  // ---- overlays on the 3D view ----
  useEffect(() => {
    if (!world) return
    if (world.view !== 'hawk') world.setView(view)
    world.setArrow(userBatting && ['ready', 'runup', 'delivering'].includes(phase), dir)
    world.setMarker(!userBatting && (phase === 'ready' || phase === 'aiming'), marker.lineX, marker.lengthDist)
    // the CPU batter always takes middle; the pads follow the guard for LBW / pad contact
    const g = userBatting ? guard : 'middle'
    setPhysicsGuard(g)
    world.setGuard(g, userBatting && phase === 'ready')
    world.onMarkerPick = (lineX, lengthDist) => phase === 'ready' && setMarker({ lineX, lengthDist })
  }, [world, view, userBatting, phase, dir, marker, guard])

  const showIntro = (first) => {
    setLowerThird({ kind: 'intro', home: first.battingTeam, away: first.bowlingTeam, venue: settings.venue, league: settings.leagueName })
    later(() => setLowerThird((l) => (l?.kind === 'intro' ? null : l)), 3200)
  }
  useEffect(() => {
    showIntro(initRef.current.inn)
    later(() => say('intro', { z: settings.venue.split(',')[0] }), 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Commit a prepared state and announce new batters / bowlers. */
  const apply = ({ inn: i, phase: p }, prev) => {
    setInn(i)
    setPhase(p)
    if (prev && needsBatter(prev) && !needsBatter(i)) {
      const id = prev.striker == null ? i.striker : i.nonStriker
      const player = findPlayer(i.battingTeam, id)
      setLowerThird({ kind: 'newBatter', player, team: i.battingTeam, position: i.wickets + 2 })
      say('newBatter', { b: player.name })
      later(() => setLowerThird((l) => (l?.kind === 'newBatter' ? null : l)), 2400)
    } else if (prev && prev.bowler == null && i.bowler != null) {
      const b = i.bowlers[i.bowler]
      setLowerThird({
        kind: 'newBowler',
        player: findPlayer(i.bowlingTeam, i.bowler),
        team: i.bowlingTeam,
        over: Math.floor(i.balls / 6) + 1,
        figures: b.balls ? `${oversText(b.balls)}-${b.maidens}-${b.runs}-${b.wickets}` : 'First over',
      })
      later(() => setLowerThird((l) => (l?.kind === 'newBowler' ? null : l)), 2400)
    }
  }

  /** Innings finished: next innings break, or the end of the match. */
  const endInnings = (finished) => {
    const all = [...doneRef.current, finished]
    const nx = nextInnings(all, ips)
    if (!nx) {
      setPhase('over')
      const res = matchResult(all, wickets, user.id)
      if (res.winner) {
        world?.celebrateWin(res.winner.id === finished.battingTeam.id)
        say('win', { t: res.winner.name })
        sound.sfx('roar', 1.2)
      }
      later(() => onFinish(all), 4200)
      return
    }
    setDone(all)
    setNextUp(nx)
    setPhase('break')
  }

  // ---- DRS ----
  const askUserReview = (givenOut, left) =>
    new Promise((resolve) => {
      reviewResolve.current = (v) => {
        reviewResolve.current = null
        setReviewOffer(null)
        resolve(v)
      }
      setReviewOffer({ givenOut, left })
      later(() => reviewResolve.current?.(false), 7000)
    })

  const runReview = async (result) => {
    const cur = innRef.current
    const givenOut = !!result.wicket
    const team = givenOut ? cur.battingTeam : cur.bowlingTeam
    const left = reviewsRef.current[team.id] ?? 0
    if (left <= 0) return result
    const wants = team.id === user.id ? await askUserReview(givenOut, left) : Math.random() < (givenOut ? (result.review.out ? 0.1 : 0.8) : result.review.out ? 0.6 : 0.1)
    if (!wants) return result
    const decision = decideReview(result)
    say('review')
    setDrs({ review: result.review, decision, stage: 'checking', team })
    if (result.review.type === 'caughtBehind') world?.replay('caughtBehind')
    await sleep(1500)
    if (result.review.type === 'lbw') world?.showTracking(result.review)
    setDrs((d) => d && { ...d, stage: 'evidence' })
    await sleep(result.review.type === 'lbw' ? 2600 : 2000)
    setDrs((d) => d && { ...d, stage: 'decision' })
    say(decision.overturned ? 'overturned' : 'upheld')
    sound.sfx(decision.finalOut ? 'roar' : 'cheer', 0.8)
    await sleep(2200)
    world?.skipReplay()
    world?.clearTracking()
    setDrs(null)
    if (!decision.retained) setReviews((r) => ({ ...r, [team.id]: r[team.id] - 1 }))
    if (decision.finalOut && !givenOut) world?.wicketReaction(result.review.type === 'lbw' ? 'lbw' : 'caught')
    return applyReview(result, decision)
  }

  // ---- after the play is dead: (review), score it, show graphics + replay, move on ----
  const finishBall = useCallback(
    async (raw) => {
      setPhase('result')
      let result = raw.review && (raw.wicket || raw.appeal) && !settings.practice ? await runReview(raw) : raw
      const prev = innRef.current
      const practiceOut = settings.practice && result.wicket ? { ...findPlayer(prev.battingTeam, prev.striker), outText: result.wicket } : null
      // nets: getting out is shown, but you keep batting
      if (practiceOut) result = { ...result, wicket: null, runs: 0, text: `${result.text} (nets — keep batting)` }
      if (result.wicket === 'caught' && result.catcher != null) {
        result.catcherId = result.catcher === 'bowler' ? prev.bowler : result.catcher === 'keeper' ? keeperOf(prev.bowlingTeam).id : fieldersOf(prev)[result.catcher]?.id
      }
      const next = applyBall(prev, result)
      setInn(next)

      // commentary voice + caption in the chosen language
      const sid = prev.striker
      const ctx = {
        b: findPlayer(prev.battingTeam, sid)?.short,
        bw: bowler?.short,
        f: result.catcherId ? findPlayer(prev.bowlingTeam, result.catcherId)?.short : keeperOf(prev.bowlingTeam).short,
        n: result.runs,
        z: result.visual?.dir != null ? zoneName(result.visual.dir) : '',
        t: next.battingTeam.name,
        s: `${next.runs}/${next.wickets}`,
      }
      const key = result.extra ? result.extra : result.wicket ? result.wicket : result.runs === 0 ? (result.appeal ? 'appeal' : 'dot') : result.runs === 1 ? 'single' : result.runs >= 4 ? (result.runs === 6 ? 'six' : 'four') : 'runs'
      setCommentary({ key: next.commentary.length, text: say(key, ctx) })

      let replayKind = null
      if (result.extra) setEvent({ kind: 'extra', title: result.extra === 'wide' ? 'WIDE +1' : 'NO BALL +1' })
      else if (practiceOut) {
        const b = next.batters[sid]
        setEvent({ kind: 'wicket', player: practiceOut, out: `${practiceOut.outText} — nets, bat on`, runs: b.runs, balls: b.balls })
      } else if (result.wicket) {
        const p = findPlayer(next.battingTeam, sid)
        const b = next.batters[sid]
        setEvent({ kind: 'wicket', player: p, out: b.out, runs: b.runs, balls: b.balls })
        replayKind = result.wicket
      } else {
        const kind = result.runs === 6 ? 'six' : result.runs === 4 ? 'four' : 'runs'
        setEvent({ kind, title: result.runs === 0 ? 'DOT BALL' : `${result.runs} RUN${result.runs > 1 ? 'S' : ''}`, timing: result.timing })
        if (result.runs >= 4) replayKind = kind
        // milestones
        const before = prev.batters[sid]?.runs ?? 0
        const after = next.batters[sid]?.runs ?? 0
        const milestone = before < 100 && after >= 100 ? 'hundred' : before < 50 && after >= 50 ? 'fifty' : null
        if (milestone) {
          later(() => {
            world?.celebrateMilestone()
            sound.sfx('applause', 1.4)
            setLowerThird({ kind: 'newBatter', player: findPlayer(next.battingTeam, sid), team: next.battingTeam, position: milestone === 'hundred' ? '💯 HUNDRED' : '50 FIFTY' })
            later(() => say(milestone, { b: findPlayer(next.battingTeam, sid).name }), 1800)
            later(() => setLowerThird(null), 4000)
          }, 600)
        }
      }
      world?.setBigScreen(
        result.wicket ? 'OUT!' : result.runs === 6 ? 'SIX!' : result.runs === 4 ? 'FOUR!' : `${next.battingTeam.short} ${next.runs}/${next.wickets}`,
        `${next.battingTeam.short} ${next.runs}/${next.wickets} · ${oversText(next.balls)} ov`,
      )

      await sleep(replayKind ? 1300 : RESULT_PAUSE_MS)
      if (replayKind && world) {
        setEvent(null)
        setReplaying(true)
        await world.replay(replayKind)
        setReplaying(false)
      }
      setEvent(null)
      setCommentary(null)
      setDeliveryInfo(null)
      world?.resetPositions()
      if (isInningsOver(next, overs, wickets)) endInnings(next)
      else {
        if (next.balls % 6 === 0 && next.balls > 0 && !result.extra && !result.wicket && result.runs < 4) later(() => say('overEnd', ctx), 300)
        apply(prepare(next), next)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, overs, wickets, bowler],
  )

  // ---- user batting ----
  const bowlToUser = useCallback(async () => {
    if (phase !== 'ready' || !userBatting || !world) return
    world.skipFlyover()
    setLowerThird(null)
    setTiming(null)
    setPhase('runup')
    const plan = cpuDeliveryPlan(bowler)
    const extra = rollExtra()
    const travel = travelFor(plan)
    await world.deliver(plan, travel, { showSpot: settings.difficulty !== 'hard' })
    setDeliveryInfo({ bowler: bowler.short, label: `${plan.def.label} · ${LENGTH_LABEL[plan.length]}`, kmh: plan.kmh })
    ballRef.current = { plan, travel, sweet: sweetFor(striker), resolved: false }
    setPhase('delivering')
    if (extra) {
      ballRef.current.resolved = true
      later(async () => {
        await world.playOutcome({ extra })
        finishBall({ extra })
      }, 350)
      return
    }
    // ball goes past without a shot → left alone
    const watch = () => {
      const b = ballRef.current
      if (!b || b.resolved) return
      if (world.progress() >= 0.99) {
        b.resolved = true
        const result = umpireCall(physicsShot({ shot: null, plan: b.plan, batter: striker }))
        setPhase('play')
        world.swing({ shot: 'leave', dir: 0, foot: 'back' })
        world.playOutcome(result).then(() => finishBall(result))
        return
      }
      rafRef.current = requestAnimationFrame(watch)
    }
    rafRef.current = requestAnimationFrame(watch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userBatting, world, bowler, striker, finishBall])

  const playShot = useCallback(
    (kind) => {
      const b = ballRef.current
      if (phase !== 'delivering' || !userBatting || !b || b.resolved) return
      b.resolved = true
      cancelAnimationFrame(rafRef.current)
      const shot = kind === 'hit' ? (lofted ? 'loft' : 'stroke') : kind
      // timing in seconds: press time vs the moment the ball reaches the bat (physics clock)
      const offset = world.ballTime() - b.plan.path.tContact
      const w = b.sweet * 0.65
      let result = umpireCall(physicsShot({ shot, foot: assist ? foot : foot ?? 'front', dir, offset, w, plan: b.plan, batter: striker }))
      // dev-only hook for testing reviews (stripped from production builds)
      if (import.meta.env.DEV && window.__forceResult) result = window.__forceResult(result)
      setTiming(result.timing ? { label: result.timing, ms: Math.round((offset / world.timeScale) * 1000), pos: Math.max(0.03, Math.min(0.97, 0.5 + offset / 0.44)) } : null)
      setPhase('play')
      world.swing(result.visual.shot ? result.visual : { shot, dir, foot: result.visual.foot ?? foot })
      world.playOutcome(result, world.contactDelay()).then(() => finishBall(result))
    },
    [phase, userBatting, world, assist, foot, dir, striker, finishBall, lofted],
  )

  // ---- user bowling ----
  const startAim = useCallback(() => {
    if (phase !== 'ready' || userBatting) return
    world?.skipFlyover()
    setLowerThird(null)
    setPhase('aiming')
    const start = performance.now()
    const speed = 1 / (diff.ballMs * 0.9)
    const tick = (now) => {
      const t = ((now - start) * speed) % 2
      const v = t < 1 ? t : 2 - t
      meterRef.current = v
      setMeter(v)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [phase, userBatting, diff])

  const release = useCallback(async () => {
    if (phase !== 'aiming' || !world) return
    cancelAnimationFrame(rafRef.current)
    const accuracy = 1 - Math.abs(meterRef.current - 0.5) * 2
    const miss = 1 - accuracy
    const extra = accuracy < 0.12 ? (Math.random() < 0.6 ? 'wide' : 'noball') : null
    const plan = planFor(
      bowler,
      delivery,
      Math.max(0.4, marker.lengthDist + (Math.random() - 0.5) * miss * 3),
      marker.lineX + (Math.random() - 0.5) * miss * (extra === 'wide' ? 3 : 0.8),
    )
    const cur = innRef.current
    let aggression
    if (cur.target != null) {
      const left = overs * 6 - cur.balls
      aggression = Math.min(2, Math.max(0.7, (((cur.target - cur.runs) / Math.max(left, 1)) * 6) / 7))
    } else aggression = 1 + (cur.balls / (overs * 6)) * 0.5
    const result = extra ? { extra } : umpireCall(cpuPhysicsShot({ plan, accuracy, batter: striker, bowler, cpuSkill: diff.cpuSkill, aggression }))

    setPhase('runup')
    await world.deliver(plan, travelFor(plan))
    setDeliveryInfo({ bowler: bowler.short, label: `${plan.def.label} · ${LENGTH_LABEL[lengthFromDist(plan.lengthDist)]}`, kmh: plan.kmh, accuracy: Math.round(accuracy * 100) })
    setPhase('delivering')
    if (extra) {
      later(async () => {
        await world.playOutcome(result)
        finishBall(result)
      }, 350)
      return
    }
    // the CPU batter plays at the ideal moment
    const v = result.visual
    const wait = () => {
      const leave = !v.shot
      if (world.ballTime() >= plan.path.tContact - 0.07 || !world.inFlight || (leave && world.progress() >= 0.99)) {
        setPhase('play')
        if (v.shot && !v.pad) world.swing(v)
        else if (leave) world.swing({ shot: 'leave', dir: 0, foot: 'back' })
        world.playOutcome(result, world.contactDelay()).then(() => finishBall(result))
        return
      }
      rafRef.current = requestAnimationFrame(wait)
    }
    rafRef.current = requestAnimationFrame(wait)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, world, delivery, marker, bowler, striker, diff, overs, finishBall])

  // ---- fast-forward (long formats) ----
  const fastForward = (mode) => {
    if (!['ready', 'pickBatter', 'pickBowler'].includes(phase)) return
    let c = innRef.current
    const startOver = Math.floor(c.balls / 6)
    let guard = 0
    while (!isInningsOver(c, overs, wickets) && guard++ < 3000) {
      c = simulateBall(c, overs)
      if (mode === 'over' && Math.floor(c.balls / 6) > startOver) break
    }
    setPaused(false)
    world?.resetPositions()
    if (isInningsOver(c, overs, wickets)) {
      setInn(c)
      endInnings(c)
    } else apply(prepare(c), innRef.current)
  }

  // ---- selections ----
  const chooseBatter = (id) => apply(prepare(addBatter(inn, id)), inn)
  const chooseBowler = (id) => apply(prepare(setBowler(inn, id)), inn)
  const startNextInnings = () => {
    if (!nextUp) return
    const fresh = newInnings(nextUp.batting, nextUp.bowling, nextUp.target)
    setReviews({ [user.id]: format.reviews, [cpu.id]: format.reviews })
    setNextUp(null)
    apply(prepare(fresh))
    showIntro(fresh)
  }

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if (replaying && (k === ' ' || k === 'enter' || k === 'escape')) {
        e.preventDefault()
        return world?.skipReplay()
      }
      if (reviewOffer && k === 'r') return reviewResolve.current?.(true)
      if (k === 'c') return setShowCard((v) => !v)
      if (k === 'v') return setView(nextView)
      if (k === 'escape' || k === 'p') return setPaused((v) => !v)
      if (paused || showCard || phase === 'pickBatter' || phase === 'pickBowler') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (phase === 'break') return startNextInnings()
        if (userBatting) bowlToUser()
        else if (phase === 'ready') startAim()
        else release()
        return
      }
      if (userBatting) {
        if (SHOT_KEYS[k]) playShot(SHOT_KEYS[k])
        if (k === 'l') setLofted((x) => !x)
        if (k === 'g' && phase === 'ready') setGuard(nextGuard)
        if (FOOT_KEYS[k]) setFoot((f) => (f === FOOT_KEYS[k] ? null : FOOT_KEYS[k]))
        const m = view === 'batter' || view === 'pro' ? -1 : 1
        if (e.key === 'ArrowLeft') setDir((d) => Math.min(180, d + 15 * m))
        if (e.key === 'ArrowRight') setDir((d) => Math.max(-180, d - 15 * m))
        if (e.key === 'ArrowDown') setDir(0)
        if (e.key === 'ArrowUp') setDir((d) => (d >= 0 ? 150 : -150))
        if (e.key.startsWith('Arrow')) e.preventDefault()
      } else if (phase === 'ready') {
        if (/^[1-4]$/.test(k)) setDeliveryKey(deliveryKeys[Number(k) - 1])
        const step = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.4], ArrowDown: [0, -0.4] }[e.key]
        if (step) {
          e.preventDefault()
          setMarker((m) => ({ lineX: Math.max(-1.2, Math.min(1.4, m.lineX + step[0])), lengthDist: Math.max(0.5, Math.min(12, m.lengthDist + step[1])) }))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const available = new Set(availableBowlers(inn, overs).map((p) => p.id))

  // ---- gamepad (left stick aims / moves the marker, A = hit or bowl, B = defend, LB = loft toggle) ----
  const padRef = useRef({})
  padRef.current = {
    button: (i) => {
      if (flying) return world?.skipFlyover()
      if (replaying) return i === BTN.A && world?.skipReplay()
      if (reviewOffer) return i === BTN.A ? reviewResolve.current?.(true) : i === BTN.B && reviewResolve.current?.(false)
      if (i === BTN.START) return setPaused((v) => !v)
      if (i === BTN.Y) return setView(nextView)
      if (paused || showCard) return
      if (phase === 'pickBatter' && i === BTN.A) return chooseBatter(yetToBat(inn)[0].id)
      if (phase === 'pickBowler' && i === BTN.A) {
        const best = inn.bowlingTeam.xi.filter((p) => available.has(p.id)).sort((a, b) => b.bowl - a.bowl)[0]
        return best && chooseBowler(best.id)
      }
      if (phase === 'break' && i === BTN.A) return startNextInnings()
      if (userBatting) {
        if (i === BTN.A) return phase === 'ready' ? bowlToUser() : playShot('hit')
        if (i === BTN.B) return playShot('push')
        if (i === BTN.X) return playShot('loft')
        if (i === BTN.LB) return setLofted((x) => !x)
        if (i === BTN.RB) return setFoot((f) => ({ null: 'front', front: 'back', back: 'advance', advance: null })[f])
        if (i === BTN.BACK && phase === 'ready') return setGuard(nextGuard)
      } else {
        if (i === BTN.A) return phase === 'ready' ? startAim() : release()
        if ((i === BTN.LB || i === BTN.RB) && phase === 'ready') {
          const k = deliveryKeys.indexOf(delivery) + (i === BTN.RB ? 1 : -1)
          return setDeliveryKey(deliveryKeys[(k + deliveryKeys.length) % deliveryKeys.length])
        }
        const step = { [BTN.LEFT]: [0.08, 0], [BTN.RIGHT]: [-0.08, 0], [BTN.UP]: [0, 0.4], [BTN.DOWN]: [0, -0.4] }[i]
        if (step && phase === 'ready') setMarker((m) => ({ lineX: Math.max(-1.2, Math.min(1.4, m.lineX + step[0])), lengthDist: Math.max(0.5, Math.min(12, m.lengthDist + step[1])) }))
      }
    },
    stick: (x, y, dt) => {
      if (userBatting) {
        const d = Math.round((Math.atan2(-x, y) * 180) / Math.PI)
        setDir((cur) => (Math.abs(cur - d) > 2 ? d : cur))
      } else if (phase === 'ready') {
        setMarker((m) => ({ lineX: Math.max(-1.2, Math.min(1.4, m.lineX - x * dt * 1.2)), lengthDist: Math.max(0.5, Math.min(12, m.lengthDist - y * dt * 5)) }))
      }
    },
  }
  const gamepad = useGamepad(padRef)

  if (phase === 'break' && nextUp) {
    const last = done[done.length - 1]
    const totalOf = (id) => done.filter((i) => i.battingTeam.id === id).reduce((s, i) => s + i.runs, 0)
    const lead = totalOf(nextUp.bowling.id) - totalOf(nextUp.batting.id)
    return (
      <section className="break-wrap">
        <div className="card break">
          <h2>{ips === 2 ? `End of innings ${done.length} of 4` : 'Innings Break'}</h2>
          <div className="break-teams">
            <TeamLogo team={last.battingTeam} size={64} />
            <p className="big-score">
              {last.battingTeam.name} {last.runs}/{last.wickets} <small className="muted">({oversText(last.balls)} ov)</small>
            </p>
          </div>
          <p className="headline">
            {nextUp.target != null
              ? <>{nextUp.batting.name} need <b>{nextUp.target}</b> to win{ips === 1 ? ` from ${overs * 6} balls` : ''}</>
              : <>{nextUp.batting.name} {lead > 0 ? <>trail by <b>{lead}</b></> : lead < 0 ? <>lead by <b>{-lead}</b></> : 'are level'} · next to bat</>}
          </p>
          <button className="btn primary big" onClick={startNextInnings}>
            Start innings {done.length + 1} <kbd>Space</kbd>
          </button>
        </div>
        <div className="card"><Scorecard inn={last} /></div>
      </section>
    )
  }

  const quota = maxOversPerBowler(overs)
  const need = inn.target != null ? inn.target - inn.runs : null
  const ballsLeft = overs * 6 - inn.balls
  const canShoot = phase === 'delivering'
  const markerLength = LENGTH_LABEL[lengthFromDist(marker.lengthDist)]
  const longFormat = overs >= 20 || ips === 2

  const goFullscreen = () => {
    const el = document.documentElement
    if (document.fullscreenElement) return document.exitFullscreen?.()
    el.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {})
  }

  return (
    <div className={`game-screen ${replaying ? 'replaying' : ''}`}>
      <Scene3D
        night={settings.night}
        venue={settings.venue}
        teamColors={[user.colors.primary, cpu.colors.primary]}
        whites={!!format.whites}
        onWorld={setWorld}
      >
        <div className="hud">
          {!replaying && !flying && <Radar dir={dir} showDir={userBatting} />}
          <div className="hud-top-right">
            <div className="sys-btns">
              {gamepad && <span className="drs-chip" title="Controller connected">🎮</span>}
              <span className="drs-chip" title="Reviews left">DRS {reviews[user.id]}</span>
              <button className="sys-btn" onClick={() => setView(nextView)} aria-label="Switch camera"><svg viewBox="0 0 24 24" width="1.2em" height="1.2em"><path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></button>
              <button className="sys-btn" onClick={goFullscreen} aria-label="Full screen"><svg viewBox="0 0 24 24" width="1.2em" height="1.2em"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>
              <button className="sys-btn pause" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
            </div>
            {userBatting && !replaying && !flying && (
              <div className="timing-bar">
                <div className="tb-labels">
                  <span className={timing?.label === 'early' ? 'on' : ''}>EARLY</span>
                  <span className={timing?.label === 'perfect' ? 'on' : ''}>PERFECT</span>
                  <span className={timing?.label === 'late' ? 'on' : ''}>LATE</span>
                </div>
                <div className="tb-track">{timing && <i style={{ left: `${timing.pos * 100}%` }} />}</div>
                {timing && <span className="tb-ms">{timing.ms > 0 ? '+' : ''}{timing.ms} ms</span>}
              </div>
            )}
            {deliveryInfo && !replaying && (
              <div className="speed-gun">
                <small>{deliveryInfo.bowler} · {deliveryInfo.label}</small>
                <b>{deliveryInfo.kmh}<span>km/h</span></b>
                {deliveryInfo.accuracy != null && <small>Accuracy {deliveryInfo.accuracy}%</small>}
              </div>
            )}
          </div>
          {!replaying && <EventGraphic event={event} battingTeam={inn.battingTeam} />}
          <LowerThird info={lowerThird} />
          {commentary && !lowerThird && !drs && (
            <div className="comm-line" key={commentary.key}>
              <span className="mic">🎙</span>
              {commentary.text}
            </div>
          )}
          <DrsPanel drs={drs} />
          {!replaying && !flying && <Scorebug inn={inn} overs={overs} />}
        </div>

        {flying && (
          <div className="replay-overlay fly" onClick={() => world?.skipFlyover()}>
            <span className="replay-badge live"><i />LIVE · {settings.venue.split(',')[0].toUpperCase()}</span>
            <button className="pad-btn skip">SKIP ▸▸</button>
          </div>
        )}

        {replaying && (
          <div className="replay-overlay" onClick={() => world?.skipReplay()}>
            <div className="letterbox top" />
            <div className="letterbox bottom" />
            <span className="replay-badge"><i />REPLAY</span>
            <button className="pad-btn skip">SKIP ▸▸</button>
          </div>
        )}

        {reviewOffer && (
          <div className="review-offer">
            <p>{reviewOffer.givenOut ? 'Given OUT!' : 'Appeal turned down!'} Review the decision?</p>
            <div className="pad-row">
              <button className="pad-btn go" onClick={() => reviewResolve.current?.(true)}>📺 REVIEW <kbd>R</kbd></button>
              <button className="pad-btn" onClick={() => reviewResolve.current?.(false)}>{reviewOffer.givenOut ? 'WALK OFF' : 'CONTINUE'}</button>
            </div>
            <small>{reviewOffer.left} review{reviewOffer.left > 1 ? 's' : ''} left</small>
            <i className="review-timer" />
          </div>
        )}

        {/* RC-style touch controls */}
        {!replaying && !flying && !drs && !reviewOffer && phase !== 'over' && (
          <div className="pad">
            {userBatting ? (
              <>
                <div className="pad-left">
                  <Joystick dir={dir} onChange={setDir} mirror={view === 'batter' || view === 'pro'} />
                </div>
                <div className="pad-right">
                  {phase === 'ready' && (
                    <button className="pad-btn go" onClick={bowlToUser}>▶ PLAY <kbd>Space</kbd></button>
                  )}
                  <button className={`pad-btn assist-btn ${assist ? 'on' : ''}`} onClick={() => setAssist((a) => !a)}>SHOT ASSIST</button>
                  <button className="pad-btn assist-btn guard-btn" disabled={phase !== 'ready'} onClick={() => setGuard(nextGuard)} title={`Guard: ${GUARDS[guard].label}`}>
                    GUARD: {GUARDS[guard].short}<kbd>G</kbd>
                  </button>
                  <div className="hit-cluster">
                    <button className={`loft-toggle ${lofted ? 'on' : ''}`} onClick={() => setLofted((x) => !x)} aria-pressed={lofted}>
                      <span className="lt-icon">{lofted ? '⤴' : '➝'}</span>
                      <b>{lofted ? 'LOFT' : 'GROUND'}</b>
                      <kbd>L</kbd>
                    </button>
                    <button className="pad-btn shot push" disabled={!canShoot} onPointerDown={(e) => { e.preventDefault(); playShot('push') }}>
                      DEFEND<kbd>A</kbd>
                    </button>
                    <button className={`hit-btn ${lofted ? 'lofted' : ''}`} disabled={!canShoot} onPointerDown={(e) => { e.preventDefault(); playShot('hit') }}>
                      HIT<kbd>S</kbd>
                    </button>
                  </div>
                </div>
                <div className="foot-col">
                  {Object.entries(FOOTWORK).map(([k, f]) => (
                    <button key={k} className={`foot-btn ${foot === k ? 'on' : ''}`} onClick={() => setFoot((x) => (x === k ? null : k))} aria-label={f.label}>
                      <FootIcon kind={k} />
                      <span>{f.label.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="pad-right">
                {deliverySet && (
                  <div className="pad-row wrap">
                    {deliveryKeys.map((k, i) => (
                      <button key={k} className={`pad-btn deliv ${delivery === k ? 'on' : ''}`} disabled={phase !== 'ready'} onClick={() => setDeliveryKey(k)}>
                        {deliverySet[k].label.toUpperCase()}<kbd>{i + 1}</kbd>
                      </button>
                    ))}
                  </div>
                )}
                {(phase === 'ready' || phase === 'aiming') && (
                  <>
                    <div className="marker-info">🎯 <b>{markerLength}</b> · {(() => { const l = lineAtStumpsFor(marker.lineX, marker.lengthDist); return l > 0.16 ? 'outside off' : l < -0.16 ? 'down leg' : 'on the stumps' })()} <small>tap the pitch to move</small></div>
                    <div className="meter">
                      <div className="meter-sweet" />
                      <div className="meter-needle" style={{ left: `${meter * 100}%` }} />
                    </div>
                    <button className={`pad-btn go ${phase === 'aiming' ? 'pulse' : ''}`} onClick={phase === 'ready' ? startAim : release}>
                      {phase === 'ready' ? '▶ RUN IN' : 'RELEASE!'} <kbd>Space</kbd>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Scene3D>

      {paused && (
        <Modal title="Paused" onClose={() => setPaused(false)}>
          <div className="pause-menu">
            <button className="btn primary big" onClick={() => setPaused(false)}>▶ Resume</button>
            <button className="btn big" onClick={() => { setPaused(false); setShowCard(true) }}>Scorecard</button>
            {longFormat && <button className="btn big" onClick={() => fastForward('over')}>⏩ Sim over</button>}
            {longFormat && <button className="btn big" onClick={() => fastForward('innings')}>⏭ Sim innings</button>}
            <button className="btn big" onClick={() => setView(nextView)}>Camera: {viewLabel(view)}</button>
            <button className="btn big ghost" onClick={onQuit}>Quit match</button>
          </div>
          {bowler && striker && (
            <div className="matchup">
              <div>
                <Avatar player={bowler} team={inn.bowlingTeam} size={44} />
                <span><b>{bowler.name}</b><small>{bowler.style === 'spin' ? 'Spin' : 'Pace'} · BOWL {bowler.bowl}</small></span>
              </div>
              <span className="muted">to</span>
              <div>
                <span className="right"><b>{striker.name}</b><small>BAT {striker.bat}</small></span>
                <Avatar player={striker} team={inn.battingTeam} size={44} />
              </div>
            </div>
          )}
          <div className="mini-stats">
            <span>CRR <b>{runRate(inn.runs, inn.balls)}</b></span>
            {need != null && <span>RRR <b>{ballsLeft > 0 ? runRate(need, ballsLeft) : '-'}</b></span>}
            <span>P'ship <b>{inn.partnership.runs} ({inn.partnership.balls})</b></span>
            <span>Inns <b>{inningsIdx + 1}/{ips * 2}</b></span>
            <span>Reviews <b>{reviews[user.id]}</b></span>
          </div>
          <div className="commentary">
            <h3>🎙 Commentary</h3>
            {inn.commentary.length === 0 && <p className="muted">Waiting for the first ball…</p>}
            <ul>
              {inn.commentary.slice(0, 12).map((c, i) => (
                <li key={inn.commentary.length - i} className={c.kind}>
                  <span className="over-tag">{c.over}</span>
                  {c.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="hint">
            {userBatting
              ? 'Aim with the joystick, pick footwork (or leave Shot Assist on), then tap PUSH / STROKE / LOFT as the ball arrives. Keyboard: arrows, Q/E/W, A/S/D, Space.'
              : 'Tap the pitch to place the blue marker, pick a delivery, tap RUN IN, then RELEASE with the needle in the green. Keyboard: arrows, 1–4, Space.'}
          </p>
        </Modal>
      )}

      {phase === 'pickBatter' && !paused && !flying && (
        <Modal title={inn.balls === 0 && inn.wickets === 0 ? 'Choose batter' : `Wicket! Who walks in at #${inn.wickets + 2}?`}>
          <div className="picker">
            {yetToBat(inn).map((p, i) => (
              <button key={p.id} className="picker-row" onClick={() => chooseBatter(p.id)}>
                <Avatar player={p} team={inn.battingTeam} size={44} />
                <span className="picker-name">
                  {p.name} {i === 0 && <small className="tag">Next in order</small>}
                </span>
                <RoleBadge role={p.role} />
                <Rating label="BAT" value={p.bat} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {phase === 'pickBowler' && !paused && !flying && (
        <Modal title={`Over ${Math.floor(inn.balls / 6) + 1} of ${overs} · Choose your bowler`}>
          <p className="muted small">Max {quota} over{quota > 1 ? 's' : ''} per bowler · no back-to-back overs</p>
          {longFormat && <button className="btn" onClick={() => fastForward('over')}>⏩ Sim this over</button>}
          <div className="picker">
            {inn.bowlingTeam.xi
              .filter((p) => p.role !== 'WK')
              .sort((a, b) => b.bowl - a.bowl)
              .map((p) => {
                const fig = inn.bowlers[p.id]
                const ok = available.has(p.id)
                const why = p.id === inn.lastOverBowler ? 'Bowled last over' : 'Quota complete'
                return (
                  <button key={p.id} className="picker-row" disabled={!ok} onClick={() => chooseBowler(p.id)}>
                    <Avatar player={p} team={inn.bowlingTeam} size={44} />
                    <span className="picker-name">
                      {p.name}
                      <small>
                        {p.style ? (p.style === 'spin' ? 'Spin' : 'Pace') : 'Part-time'}
                        {fig ? ` · ${oversText(fig.balls)}-${fig.maidens}-${fig.runs}-${fig.wickets}` : ''}
                        {!ok ? ` · ${why}` : ''}
                      </small>
                    </span>
                    <RoleBadge role={p.role} />
                    <Rating label="BOWL" value={p.bowl} />
                  </button>
                )
              })}
          </div>
        </Modal>
      )}

      {showCard && (
        <Modal title="Scorecard" onClose={() => setShowCard(false)}>
          {done.map((d, i) => <Scorecard key={i} inn={d} />)}
          <Scorecard inn={inn} live />
        </Modal>
      )}
    </div>
  )
}
