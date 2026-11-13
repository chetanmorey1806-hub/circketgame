import { CHALLENGES, loadProgress } from '../game/challenges.js'
import { teamInfo } from '../game/leagues.js'
import TeamLogo from './TeamLogo.jsx'

export default function ChallengesScreen({ onPlay, onBack }) {
  const progress = loadProgress()
  const total = Object.values(progress).reduce((s, v) => s + v, 0)
  return (
    <section className="challenges">
      <div className="ch-head">
        <div>
          <h2>🎯 Challenges</h2>
          <p className="muted">Jump into the hottest moments. Earn up to 3 stars each · ⭐ {total}/{CHALLENGES.length * 3}</p>
        </div>
        <button className="btn" onClick={onBack}>← Menu</button>
      </div>
      <div className="ch-grid">
        {CHALLENGES.map((c) => {
          const u = teamInfo(c.user)
          const o = teamInfo(c.cpu)
          const stars = progress[c.id] ?? 0
          return (
            <button key={c.id} className="ch-card" style={{ '--p': u.colors.primary, '--s': u.colors.secondary }} onClick={() => onPlay(c)}>
              <div className="ch-teams">
                <TeamLogo team={u} size={40} />
                <span className="vs">vs</span>
                <TeamLogo team={o} size={40} />
                <span className={`ch-kind ${c.kind}`}>{c.kind === 'chase' ? '🏏 BAT' : '🎯 BOWL'}</span>
              </div>
              <b>{c.title}</b>
              <small>{c.desc}</small>
              <span className="ch-meta">{c.venue.split(',')[0]} · {c.overs} over{c.overs > 1 ? 's' : ''}</span>
              <span className="ch-stars">{[1, 2, 3].map((n) => <i key={n} className={n <= stars ? 'on' : ''}>★</i>)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
