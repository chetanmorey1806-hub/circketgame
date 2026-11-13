import { useState } from 'react'
import { matchResult } from '../game/engine.js'
import Scorecard from './Scorecard.jsx'
import TeamLogo from './TeamLogo.jsx'
import { Avatar } from './Player.jsx'

export default function Result({ settings, innings, challengeStars = null, onRematch, onChangeXI, onTournament, onChallenges, onHome }) {
  const res = matchResult(innings, settings.wickets, settings.user.id)
  const real = innings.map((inn, i) => [inn, i]).filter(([inn]) => !inn.synthetic)
  const [tab, setTab] = useState(real[0][1])

  return (
    <section className="result-wrap">
      <div className="card result">
        {res.winner ? <TeamLogo team={res.winner} size={90} className="winner-logo" /> : <div className="trophy">🤝</div>}
        <h2>{res.winner ? (res.userWon ? 'Victory!' : 'Defeat') : res.draw ? 'Draw' : 'Tie'}</h2>
        <p className="headline">{res.winner ? `${res.winner.name} won ${res.margin}` : res.margin}</p>
        {challengeStars != null && (
          <div className={`challenge-result ${challengeStars ? 'won' : 'lost'}`}>
            <b>{challengeStars ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED'}</b>
            <span className="ch-stars big">{[1, 2, 3].map((n) => <i key={n} className={n <= challengeStars ? 'on' : ''}>★</i>)}</span>
            <small>{settings.challenge.title}</small>
          </div>
        )}

        <div className="mini-scores">
          {innings.map((inn, i) => (
            <div key={i}>
              <TeamLogo team={inn.battingTeam} size={40} />
              {inn.battingTeam.name}
              <b>{inn.synthetic ? `set ${inn.runs + 1} to win` : `${inn.runs}/${inn.wickets}`}</b>
            </div>
          ))}
        </div>

        {res.potm && (
          <div className="potm" style={{ '--team': res.potm.team.colors.primary }}>
            <Avatar player={res.potm.player} team={res.potm.team} size={56} />
            <div>
              <small>Player of the Match</small>
              <b>{res.potm.player.name}</b>
              <span className="muted">{res.potm.team.name} · {res.potm.line}</span>
            </div>
          </div>
        )}

        <div className="btn-row">
          {onTournament && <button className="btn primary big" onClick={onTournament}>🏆 Back to tournament</button>}
          {onChallenges && <button className="btn big" onClick={onChallenges}>🎯 Challenges</button>}
          {onRematch && <button className="btn primary big" onClick={onRematch}>{settings.challenge ? 'Retry challenge' : 'Rematch'}</button>}
          {onChangeXI && <button className="btn big" onClick={onChangeXI}>Change XI</button>}
          <button className="btn big" onClick={onHome}>Main Menu</button>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          {real.map(([inn, i]) => (
            <button key={i} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
              {inn.battingTeam.name} innings
            </button>
          ))}
        </div>
        <Scorecard inn={innings[tab]} />
      </div>
    </section>
  )
}
