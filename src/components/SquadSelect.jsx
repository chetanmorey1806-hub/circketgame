import { useMemo, useState } from 'react'
import { getSquad, validateXI } from '../game/squads.js'
import { Avatar, RoleBadge, Rating } from './Player.jsx'
import TeamLogo from './TeamLogo.jsx'
import Character from './Character.jsx'

export default function SquadSelect({ settings, initialXI, onConfirm, onBack }) {
  const { user, cpu } = settings
  const squad = useMemo(() => getSquad(user.id), [user.id])
  const cpuXI = useMemo(() => getSquad(cpu.id).slice(0, 11), [cpu.id])
  const [xi, setXI] = useState(() => initialXI ?? squad.slice(0, 11))
  const [focus, setFocus] = useState(squad[0])

  const inXI = (p) => xi.some((x) => x.id === p.id)
  const toggle = (p) => setXI((cur) => (inXI(p) ? cur.filter((x) => x.id !== p.id) : cur.length < 11 ? [...cur, p] : cur))
  const move = (i, d) =>
    setXI((cur) => {
      const j = i + d
      if (j < 0 || j >= cur.length) return cur
      const next = [...cur]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const error = validateXI(xi)

  return (
    <section className="squad">
      <div className="squad-head">
        <div>
          <h2><TeamLogo team={user} size={40} className="inline-logo" /> Select your Playing XI</h2>
          <p className="muted">
            {user.name} vs {cpu.name} · Tap players to add/remove · Reorder to set the batting order
          </p>
        </div>
        <div className="btn-row tight">
          <button className="btn" onClick={onBack}>Back</button>
          <button className="btn primary" disabled={!!error} onClick={() => onConfirm(xi, cpuXI)}>
            Confirm XI →
          </button>
        </div>
      </div>
      <p className={`squad-status ${error ? 'bad' : 'ok'}`}>{error ?? '✓ Playing XI is ready'}</p>

      <div className="squad-grid">
        <div className="card">
          <h3>Squad · {squad.length} players</h3>
          <div className="player-list">
            {squad.map((p) => (
              <button
                key={p.id}
                className={`player-card ${inXI(p) ? 'selected' : ''}`}
                onClick={() => toggle(p)}
                onMouseEnter={() => setFocus(p)}
                onFocus={() => setFocus(p)}
                disabled={!inXI(p) && xi.length >= 11}
              >
                <Avatar player={p} team={user} />
                <div className="pc-info">
                  <div className="pc-name">{p.name} <RoleBadge role={p.role} /></div>
                  <div className="pc-ratings">
                    <Rating label="BAT" value={p.bat} />
                    {p.role !== 'WK' && <Rating label="BOWL" value={p.bowl} />}
                  </div>
                </div>
                <span className="pc-check">{inXI(p) ? '✓' : '+'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Batting order · {xi.length}/11</h3>
          <ol className="order-list">
            {xi.map((p, i) => (
              <li key={p.id}>
                <span className="order-num">{i + 1}</span>
                <Avatar player={p} team={user} size={30} />
                <span className="order-name">
                  {p.name}
                  <small>{p.style ? `${p.style === 'spin' ? 'Spin' : 'Pace'} · ` : ''}BAT {p.bat}{p.role !== 'WK' ? ` · BOWL ${p.bowl}` : ''}</small>
                </span>
                <RoleBadge role={p.role} />
                <span className="order-btns">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === xi.length - 1} aria-label="Move down">▼</button>
                  <button onClick={() => toggle(p)} aria-label="Remove">✕</button>
                </span>
              </li>
            ))}
          </ol>
          <p className="muted small">Openers are #1 and #2.</p>
        </div>

        <div className="side-col">
        <div className="card player-preview" style={{ '--p': user.colors.primary, '--s': user.colors.secondary }}>
          <div className="pp-figures">
            <Character player={focus} team={user} role={focus.role === 'WK' ? 'keeper' : focus.role === 'BOWL' ? 'bowler' : 'batter'} pose={focus.role === 'BOWL' ? 'idle' : 'stance'} />
            <Character player={focus} team={user} role={focus.role === 'BOWL' ? 'bowler' : 'fielder'} view="back" pose="idle" />
          </div>
          <div className="pp-info">
            <b>{focus.name}</b>
            <span>#{focus.number} · <RoleBadge role={focus.role} /> {focus.style ? `· ${focus.style === 'spin' ? 'Spin' : 'Pace'}` : ''}</span>
            <Rating label="BAT" value={focus.bat} />
            {focus.role !== 'WK' && <Rating label="BOWL" value={focus.bowl} />}
          </div>
        </div>
        <div className="card opp">
          <h3><TeamLogo team={cpu} size={28} className="inline-logo" /> {cpu.name} Playing XI</h3>
          <ol className="opp-list">
            {cpuXI.map((p) => (
              <li key={p.id}>
                <Avatar player={p} team={cpu} size={26} />
                <span>{p.name}</span>
                <RoleBadge role={p.role} />
              </li>
            ))}
          </ol>
        </div>
        </div>
      </div>
    </section>
  )
}
