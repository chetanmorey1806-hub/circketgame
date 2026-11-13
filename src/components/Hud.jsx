import { useMemo } from 'react'
import { currentOver, findPlayer, oversText, runRate, strikeRate } from '../game/engine.js'
import TeamLogo from './TeamLogo.jsx'
import { Avatar } from './Player.jsx'

// Broadcast graphics drawn over the 3D view.

function Confetti({ colors }) {
  const bits = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.4, rot: Math.random() * 360, c: colors[i % colors.length] })),
    [colors],
  )
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, background: b.c, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  )
}

export function EventGraphic({ event, battingTeam }) {
  if (!event) return null
  const { primary, secondary } = battingTeam.colors
  const style = { '--p': primary, '--s': secondary }
  if (event.kind === 'six' || event.kind === 'four') {
    return (
      <div className={`ev ev-${event.kind}`} style={style}>
        {event.kind === 'six' && <Confetti colors={[primary, secondary, '#ffd34d', '#fff']} />}
        <div className="ev-slash" />
        <div className="ev-word">{event.kind === 'six' ? 'SIX' : 'FOUR'}</div>
        <div className="ev-sub">{event.kind === 'six' ? 'MAXIMUM!' : 'BOUNDARY'}</div>
      </div>
    )
  }
  if (event.kind === 'wicket') {
    return (
      <div className="ev ev-wicket">
        <div className="ev-word">WICKET!</div>
        <div className="ev-card" style={style}>
          <Avatar player={event.player} team={battingTeam} size={64} />
          <div>
            <b>{event.player.name}</b>
            <span>{event.out}</span>
            <span className="ev-stats">{event.runs} ({event.balls}) · SR {strikeRate(event.runs, event.balls)}</span>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className={`ev-toast ${event.kind}`}>
      <b>{event.title}</b>
      {event.timing && <span className={`timing ${event.timing}`}>{event.timing}</span>}
    </div>
  )
}

export function LowerThird({ info }) {
  if (!info) return null
  if (info.kind === 'intro') {
    return (
      <div className="lower-third intro">
        <TeamLogo team={info.home} size={54} />
        <div>
          <small>{info.league} · LIVE</small>
          <b>{info.home.name} vs {info.away.name}</b>
          <span>{info.venue}</span>
        </div>
        <TeamLogo team={info.away} size={54} />
      </div>
    )
  }
  if (info.kind === 'newBatter') {
    return (
      <div className="lower-third" style={{ '--p': info.team.colors.primary, '--s': info.team.colors.secondary }}>
        <Avatar player={info.player} team={info.team} size={58} />
        <div>
          <small>New batter · #{info.position}</small>
          <b>{info.player.name}</b>
          <span>{info.player.role === 'WK' ? 'Wicket-keeper' : info.player.role === 'AR' ? 'All-rounder' : info.player.role === 'BOWL' ? 'Bowler' : 'Batter'} · Batting {info.player.bat}</span>
        </div>
      </div>
    )
  }
  if (info.kind === 'newBowler') {
    return (
      <div className="lower-third" style={{ '--p': info.team.colors.primary, '--s': info.team.colors.secondary }}>
        <Avatar player={info.player} team={info.team} size={58} />
        <div>
          <small>Into the attack · Over {info.over}</small>
          <b>{info.player.name}</b>
          <span>{info.player.style === 'spin' ? 'Spin' : 'Pace'} · {info.figures}</span>
        </div>
      </div>
    )
  }
  return null
}

export function Scorebug({ inn, overs }) {
  const bat = inn.battingTeam
  const bowl = inn.bowlingTeam
  const thisOver = currentOver(inn)
  const row = (id, strike) => {
    if (id == null) return <div className="rc-batter">—</div>
    const p = findPlayer(bat, id)
    const b = inn.batters[id]
    return (
      <div className={`rc-batter ${strike ? 'strike' : ''}`}>
        <span>{p.short.toUpperCase()}{strike ? ' *' : ''}</span>
        <b>{b.runs}</b>
        <small>({b.balls})</small>
      </div>
    )
  }
  const bowler = inn.bowler != null ? findPlayer(bowl, inn.bowler) : null
  const bf = bowler && inn.bowlers[bowler.id]
  const need = inn.target != null ? inn.target - inn.runs : null
  const left = overs * 6 - inn.balls

  return (
    <div className="rc-score" style={{ '--p': bat.colors.primary, '--s': bat.colors.secondary, '--bp': bowl.colors.primary }}>
      <div className="rc-side rc-left">
        <TeamLogo team={bat} size={22} />
        <div>
          {row(inn.striker, true)}
          {row(inn.nonStriker, false)}
        </div>
      </div>
      <div className="rc-center">
        <div className="rc-main">
          <span className="rc-abbr">{bat.short}</span>
          <span className="rc-runs">{inn.runs}-{inn.wickets}</span>
          <span className="rc-overs">{oversText(inn.balls)} <small>({overs})</small></span>
        </div>
        <div className="rc-sub">
          {need != null && need > 0 ? <>NEED {need} OFF {left} · RRR {left > 0 ? runRate(need, left) : '-'}</> : <>CUR RR {runRate(inn.runs, inn.balls)}</>}
        </div>
      </div>
      <div className="rc-side rc-right">
        <div>
          <div className="rc-bowler">
            <span>{bowler ? bowler.short.toUpperCase() : '—'}</span>
            {bf && <b>{bf.wickets}-{bf.runs}</b>}
            {bf && <small>({oversText(bf.balls)})</small>}
          </div>
          <div className="rc-over">
            {thisOver.map((b, i) => (
              <span key={i} className={`ball-chip b-${b}`}>{b}</span>
            ))}
          </div>
        </div>
        <TeamLogo team={bowl} size={22} />
      </div>
    </div>
  )
}
