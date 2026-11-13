// Tournaments: round-robin league → semi-finals → final. The user's matches are played; the rest are simulated.
import { matchResult, simulateMatch } from './engine.js'
import { TEAM_BY_ID, teamInfo } from './leagues.js'
import { getSquad } from './squads.js'

const KEY = 'cricket-clash-tournament'

export const TOURNAMENTS = {
  worldcup: { id: 'worldcup', name: 'World Cup', league: 'intl', trophy: '🏆' },
  ipl: { id: 'ipl', name: 'IPL Season', league: 'ipl', trophy: '🏆' },
}

const fullTeam = (id) => ({ ...teamInfo(id), xi: getSquad(id).slice(0, 11) })

/** Every team plays every other team once; user games spread through the schedule. */
function roundRobin(ids) {
  const list = [...ids]
  if (list.length % 2) list.push(null)
  const n = list.length
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const games = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a && b) games.push(r % 2 ? [b, a] : [a, b])
    }
    rounds.push(games)
    list.splice(1, 0, list.pop()) // rotate all but the first
  }
  return rounds.flat()
}

export function createTournament({ kind, teamIds, userTeam, overs, wickets, difficulty, night }) {
  const t = {
    kind,
    name: TOURNAMENTS[kind].name,
    teams: teamIds,
    userTeam,
    overs,
    wickets,
    difficulty,
    night,
    stage: 'league',
    fixtures: roundRobin(teamIds).map(([home, away], i) => ({ id: `L${i}`, stage: 'league', home, away, result: null })),
    champion: null,
  }
  save(t)
  return t
}

export function save(t) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* not saved */
  }
}

export function load() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null')
    return t && t.teams?.every((id) => TEAM_BY_ID[id]) ? t : null
  } catch {
    return null
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Compact summary of a played match for the table. */
function summary(innings, result, home, away) {
  const of = (id) => innings.filter((i) => i.battingTeam.id === id)
  const runs = (id) => of(id).reduce((s, i) => s + i.runs, 0)
  return {
    winner: result.winner?.id ?? null,
    margin: result.margin,
    [home]: { runs: runs(home), wkts: of(home).reduce((s, i) => s + i.wickets, 0), balls: of(home).reduce((s, i) => s + i.balls, 0) },
    [away]: { runs: runs(away), wkts: of(away).reduce((s, i) => s + i.wickets, 0), balls: of(away).reduce((s, i) => s + i.balls, 0) },
  }
}

const isUserGame = (t, f) => f.home === t.userTeam || f.away === t.userTeam

/** Simulate every pending non-user fixture up to (not including) the user's next game. */
export function simulateUntilUser(t) {
  for (const f of t.fixtures) {
    if (f.result) continue
    if (isUserGame(t, f)) break
    const sim = simulateMatch(fullTeam(f.home), fullTeam(f.away), t.overs, t.wickets)
    f.result = summary(sim.innings, sim.result, f.home, f.away)
  }
  advanceStage(t)
  save(t)
  return t
}

export function nextUserFixture(t) {
  return t.fixtures.find((f) => !f.result && isUserGame(t, f)) ?? null
}

/** Record the user's played match. */
export function recordUserMatch(t, fixtureId, innings, wickets) {
  const f = t.fixtures.find((x) => x.id === fixtureId)
  const result = matchResult(innings, wickets, t.userTeam)
  f.result = summary(innings, result, f.home, f.away)
  simulateUntilUser(t)
  return t
}

/** Points table with net run rate. */
export function standings(t) {
  const rows = Object.fromEntries(t.teams.map((id) => [id, { id, p: 0, w: 0, l: 0, nr: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 }]))
  const fullBalls = t.overs * 6
  for (const f of t.fixtures) {
    if (f.stage !== 'league' || !f.result) continue
    for (const [me, them] of [[f.home, f.away], [f.away, f.home]]) {
      const r = rows[me]
      r.p++
      if (f.result.winner === me) {
        r.w++
        r.pts += 2
      } else if (f.result.winner === them) r.l++
      else {
        r.nr++
        r.pts += 1
      }
      const mine = f.result[me]
      const theirs = f.result[them]
      // all-out sides are counted as having used their full overs (standard NRR rule)
      r.rf += mine.runs
      r.bf += mine.wkts >= Math.min(t.wickets, 10) ? fullBalls : mine.balls || fullBalls
      r.ra += theirs.runs
      r.ba += theirs.wkts >= Math.min(t.wickets, 10) ? fullBalls : theirs.balls || fullBalls
    }
  }
  return Object.values(rows)
    .map((r) => ({ ...r, nrr: (r.bf ? (r.rf / r.bf) * 6 : 0) - (r.ba ? (r.ra / r.ba) * 6 : 0) }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr)
}

function advanceStage(t) {
  const pending = (stage) => t.fixtures.some((f) => f.stage === stage && !f.result)
  if (t.stage === 'league' && !pending('league')) {
    const top = standings(t).slice(0, 4).map((r) => r.id)
    t.fixtures.push({ id: 'SF1', stage: 'semi', home: top[0], away: top[3], result: null }, { id: 'SF2', stage: 'semi', home: top[1], away: top[2], result: null })
    t.stage = 'semi'
    simulateUntilUser(t)
  } else if (t.stage === 'semi' && !pending('semi')) {
    const winners = t.fixtures.filter((f) => f.stage === 'semi').map((f) => f.result.winner ?? f.home)
    t.fixtures.push({ id: 'F', stage: 'final', home: winners[0], away: winners[1], result: null })
    t.stage = 'final'
    simulateUntilUser(t)
  } else if (t.stage === 'final' && !pending('final')) {
    const f = t.fixtures.find((x) => x.stage === 'final')
    t.champion = f.result.winner ?? f.home
    t.stage = 'done'
  }
}

/** Has the user been knocked out (and the tournament can be simulated to the end)? */
export function userEliminated(t) {
  return t.stage !== 'league' && t.stage !== 'done' && !nextUserFixture(t)
}

export function finishWithoutUser(t) {
  let guard = 0
  while (t.stage !== 'done' && guard++ < 10) simulateUntilUser(t)
  save(t)
  return t
}
