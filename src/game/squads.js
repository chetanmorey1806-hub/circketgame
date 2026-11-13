import { TEAM_BY_ID } from './leagues.js'

export const ROLE_LABEL = { BAT: 'Batter', WK: 'Wicket-keeper', AR: 'All-rounder', BOWL: 'Bowler' }

const SKIN = ['#f2c9a7', '#e3b08a', '#c98d63', '#a86d45', '#7f5134']
const HAIR = ['#1b1410', '#2b1d14', '#3d2a1c', '#5a3b22', '#b48a52']

// Small deterministic hash so a player always looks the same.
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

const lastName = (name) => name.split(' ').slice(-1)[0]

export function getSquad(teamId) {
  return TEAM_BY_ID[teamId].squad.map(([name, role, bat, bowl, style, number], i) => {
    const h = hash(name)
    return {
      id: `${teamId}-${i}`,
      name,
      short: lastName(name),
      initials: name.split(/[\s-]/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      role,
      bat,
      bowl,
      style,
      number: number ?? (h % 98) + 1,
      look: {
        skin: SKIN[h % SKIN.length],
        hair: HAIR[(h >>> 4) % HAIR.length],
        hairStyle: (h >>> 8) % 4,
        beard: (h >>> 12) % 3 === 0,
      },
    }
  })
}

/** Rules a Playing XI must satisfy. Returns an error string or null. */
export function validateXI(xi) {
  if (xi.length !== 11) return `Select exactly 11 players (${xi.length}/11)`
  if (!xi.some((p) => p.role === 'WK')) return 'You need a wicket-keeper'
  const bowlers = xi.filter((p) => p.role === 'BOWL' || p.role === 'AR').length
  if (bowlers < 5) return `You need at least 5 bowling options (${bowlers}/5)`
  return null
}
