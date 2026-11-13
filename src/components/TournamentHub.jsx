import { teamInfo } from '../game/leagues.js'
import { finishWithoutUser, nextUserFixture, standings, userEliminated } from '../game/tournament.js'
import TeamLogo from './TeamLogo.jsx'

const STAGE = { league: 'League stage', semi: 'Semi-finals', final: 'Final', done: 'Complete' }

function Score({ f }) {
  const r = f.result
  if (!r) return <span className="muted">vs</span>
  const fmt = (id) => `${r[id].runs}/${r[id].wkts}`
  return (
    <span className="fx-score">
      {fmt(f.home)} <span className="muted">·</span> {fmt(f.away)}
    </span>
  )
}

export default function TournamentHub({ t, onPlay, onHome, onAbandon, onUpdate }) {
  const table = standings(t)
  const next = nextUserFixture(t)
  const me = teamInfo(t.userTeam)
  const knockouts = t.fixtures.filter((f) => f.stage !== 'league')
  const recent = t.fixtures.filter((f) => f.result).slice(-6).reverse()
  const upcoming = t.fixtures.filter((f) => !f.result).slice(0, 6)

  return (
    <section className="hub">
      <div className="card hub-head" style={{ '--p': me.colors.primary }}>
        <div className="hub-title">
          <span className="hub-trophy">🏆</span>
          <div>
            <h2>{t.name}</h2>
            <p className="muted">{STAGE[t.stage]} · {t.overs} overs a side · playing as <b>{me.name}</b></p>
          </div>
        </div>
        {t.stage === 'done' ? (
          <div className="champion">
            <TeamLogo team={teamInfo(t.champion)} size={90} className="winner-logo" />
            <h2>{teamInfo(t.champion).name} are champions!</h2>
            {t.champion === t.userTeam && <p className="headline">🎉 You won the {t.name}!</p>}
          </div>
        ) : next ? (
          <div className="next-match">
            <small>{next.stage === 'league' ? 'Next match' : next.stage === 'semi' ? 'Semi-final' : 'FINAL'}</small>
            <div className="nm-teams">
              <TeamLogo team={teamInfo(next.home)} size={56} />
              <b>{teamInfo(next.home).short}</b>
              <span className="vs">VS</span>
              <b>{teamInfo(next.away).short}</b>
              <TeamLogo team={teamInfo(next.away)} size={56} />
            </div>
            <button className="btn primary big" onClick={() => onPlay(next)}>▶ Play match</button>
          </div>
        ) : (
          userEliminated(t) && (
            <div className="next-match">
              <p className="headline">{me.name} are out of the tournament.</p>
              <button className="btn primary big" onClick={() => onUpdate({ ...finishWithoutUser(t) })}>Simulate to the end</button>
            </div>
          )
        )}
      </div>

      <div className="hub-grid">
        <div className="card">
          <h3>Points table</h3>
          <table className="points">
            <thead>
              <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.id} className={`${i < 4 ? 'qual' : ''} ${r.id === t.userTeam ? 'mine' : ''}`}>
                  <td>{i + 1}</td>
                  <td className="pt-team"><TeamLogo team={teamInfo(r.id)} size={20} /> {teamInfo(r.id).short}</td>
                  <td>{r.p}</td>
                  <td>{r.w}</td>
                  <td>{r.l}</td>
                  <td><b>{r.pts}</b></td>
                  <td>{r.nrr >= 0 ? '+' : ''}{r.nrr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Top 4 reach the semi-finals.</p>
        </div>

        <div className="card">
          {knockouts.length > 0 && (
            <>
              <h3>Knockouts</h3>
              <ul className="fixtures">
                {knockouts.map((f) => (
                  <li key={f.id} className={f.result?.winner ? 'done' : ''}>
                    <span className="fx-stage">{f.stage === 'semi' ? 'SF' : 'Final'}</span>
                    <span className={f.result?.winner === f.home ? 'win' : ''}>{teamInfo(f.home).short}</span>
                    <Score f={f} />
                    <span className={f.result?.winner === f.away ? 'win' : ''}>{teamInfo(f.away).short}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Recent results</h3>
          <ul className="fixtures">
            {recent.length === 0 && <li className="muted">No matches played yet.</li>}
            {recent.map((f) => (
              <li key={f.id}>
                <span className={f.result.winner === f.home ? 'win' : ''}>{teamInfo(f.home).short}</span>
                <Score f={f} />
                <span className={f.result.winner === f.away ? 'win' : ''}>{teamInfo(f.away).short}</span>
                <small className="muted">{f.result.winner ? `${teamInfo(f.result.winner).short} ${f.result.margin}` : f.result.margin}</small>
              </li>
            ))}
          </ul>
          {upcoming.length > 0 && (
            <>
              <h3>Upcoming</h3>
              <ul className="fixtures">
                {upcoming.map((f) => (
                  <li key={f.id} className={f.home === t.userTeam || f.away === t.userTeam ? 'mine' : ''}>
                    <span>{teamInfo(f.home).short}</span>
                    <span className="muted">vs</span>
                    <span>{teamInfo(f.away).short}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn big" onClick={onHome}>Main menu</button>
        <button className="btn big ghost" onClick={onAbandon}>Abandon tournament</button>
      </div>
    </section>
  )
}
