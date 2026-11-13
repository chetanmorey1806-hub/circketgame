const KEY = 'cricket-clash-stats'
const EMPTY = { played: 0, won: 0, highScore: 0, sixes: 0 }

export function loadStats() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...EMPTY }
  }
}

export function recordMatch({ userWon, userRuns, userSixes }) {
  const s = loadStats()
  const next = {
    played: s.played + 1,
    won: s.won + (userWon ? 1 : 0),
    highScore: Math.max(s.highScore, userRuns),
    sixes: s.sixes + userSixes,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — stats just won't persist */
  }
  return next
}
