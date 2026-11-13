// Scenario challenges: jump into the end of a match. `chase`: you bat needing `target`; `defend`: you bowl.
const KEY = 'cricket-clash-challenges'

export const CHALLENGES = [
  { id: 'c1', title: 'Last-over thriller', desc: 'Need 16 off the final over. 2 wickets in hand.', kind: 'chase', user: 'CSK', cpu: 'MI', target: 16, overs: 1, wickets: 2, venue: 'Wankhede Stadium, Mumbai', night: true },
  { id: 'c2', title: 'Defend 9 with Bumrah', desc: 'One over left. Opponents need 9. Bowl it out.', kind: 'defend', user: 'MI', cpu: 'CSK', target: 9, overs: 1, wickets: 3, venue: 'MA Chidambaram Stadium, Chennai', night: true },
  { id: 'c3', title: 'World Cup final chase', desc: '30 off 12 balls at the MCG. Win the trophy.', kind: 'chase', user: 'IND', cpu: 'AUS', target: 30, overs: 2, wickets: 4, venue: 'Melbourne Cricket Ground', night: true },
  { id: 'c4', title: 'Lord’s rescue', desc: 'Collapse at Lord’s — get 25 off 3 overs with 3 wickets left.', kind: 'chase', user: 'ENG', cpu: 'SA', target: 25, overs: 3, wickets: 3, venue: "Lord's, London", night: false },
  { id: 'c5', title: 'Spin the web in Dubai', desc: 'Defend 20 in 2 overs on a turning track.', kind: 'defend', user: 'AFG', cpu: 'PAK', target: 20, overs: 2, wickets: 4, venue: 'Dubai International Stadium', night: true },
  { id: 'c6', title: 'Power-play blitz', desc: 'Smash 45 off 3 overs at Chinnaswamy.', kind: 'chase', user: 'RCB', cpu: 'SRH', target: 45, overs: 3, wickets: 5, venue: 'M Chinnaswamy Stadium, Bengaluru', night: true },
  { id: 'c7', title: 'Newlands nerves', desc: 'Defend 14 in the final over against South Africa.', kind: 'defend', user: 'IND', cpu: 'SA', target: 14, overs: 1, wickets: 3, venue: 'Newlands, Cape Town', night: false },
  { id: 'c8', title: 'Super Over decider', desc: 'Super Over: need 18. Two wickets and it is over.', kind: 'chase', user: 'NZ', cpu: 'ENG', target: 18, overs: 1, wickets: 2, venue: 'Eden Park, Auckland', night: true },
]

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

/** Stars: 1 for winning, +1 with balls to spare (chase) or 2+ wickets (defend), +1 for a big margin. */
export function starsFor(ch, innings) {
  const last = innings[innings.length - 1]
  if (ch.kind === 'chase') {
    if (last.runs < last.target) return 0
    const spare = ch.overs * 6 - last.balls
    return 1 + (spare >= 2 ? 1 : 0) + (spare >= 4 || last.wickets === 0 ? 1 : 0)
  }
  if (last.runs >= last.target) return 0
  return 1 + (last.wickets >= 2 ? 1 : 0) + (last.target - 1 - last.runs >= 5 ? 1 : 0)
}

export function saveStars(id, stars) {
  const p = loadProgress()
  p[id] = Math.max(p[id] ?? 0, stars)
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* not saved */
  }
  return p
}
