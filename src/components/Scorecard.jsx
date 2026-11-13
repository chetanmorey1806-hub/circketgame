import { findPlayer, oversText, runRate, strikeRate, yetToBat } from '../game/engine.js'

/** Full batting + bowling card for one innings. `live` marks batters currently at the crease. */
export default function Scorecard({ inn, live = false }) {
  const batted = inn.battingTeam.xi.filter((p) => inn.batters[p.id].batted)
  const toBat = yetToBat(inn)

  const status = (p) => {
    const b = inn.batters[p.id]
    if (b.out) return b.out
    if (live && (p.id === inn.striker || p.id === inn.nonStriker)) return 'batting'
    return 'not out'
  }

  return (
    <div className="scorecard" style={{ '--team': inn.battingTeam.colors.primary }}>
      <div className="sc-title">
        <span><span className="team-dot" />{inn.battingTeam.name}</span>
        <b>{inn.runs}/{inn.wickets} <small>({oversText(inn.balls)} ov, RR {runRate(inn.runs, inn.balls)})</small></b>
      </div>

      <table className="sc-table">
        <thead>
          <tr><th>Batter</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
        </thead>
        <tbody>
          {batted.map((p) => {
            const b = inn.batters[p.id]
            const atCrease = live && !b.out && (p.id === inn.striker || p.id === inn.nonStriker)
            return (
              <tr key={p.id} className={atCrease ? 'at-crease' : ''}>
                <td className="sc-name">{p.name}{p.role === 'WK' ? ' †' : ''}{live && p.id === inn.striker ? ' *' : ''}</td>
                <td className="sc-out">{status(p)}</td>
                <td><b>{b.runs}</b></td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{strikeRate(b.runs, b.balls)}</td>
              </tr>
            )
          })}
          <tr className="sc-extras"><td>Extras</td><td></td><td><b>{inn.extras}</b></td><td colSpan={4}></td></tr>
        </tbody>
      </table>

      {toBat.length > 0 && (
        <p className="sc-note"><b>Yet to bat:</b> {toBat.map((p) => p.name).join(', ')}</p>
      )}
      {inn.fow.length > 0 && (
        <p className="sc-note">
          <b>Fall of wickets:</b> {inn.fow.map((f) => `${f.score}-${f.wicket} (${f.name}, ${f.over})`).join(', ')}
        </p>
      )}

      <table className="sc-table">
        <thead>
          <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr>
        </thead>
        <tbody>
          {Object.entries(inn.bowlers).map(([id, b]) => (
            <tr key={id}>
              <td className="sc-name">{findPlayer(inn.bowlingTeam, id).name}{live && id === inn.bowler ? ' ⚾' : ''}</td>
              <td>{oversText(b.balls)}</td>
              <td>{b.maidens}</td>
              <td>{b.runs}</td>
              <td><b>{b.wickets}</b></td>
              <td>{runRate(b.runs, b.balls)}</td>
            </tr>
          ))}
          {Object.keys(inn.bowlers).length === 0 && (
            <tr><td colSpan={6} className="muted">Yet to bowl</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
