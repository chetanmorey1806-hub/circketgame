import Character from './Character.jsx'
import { ROLE_LABEL } from '../game/squads.js'

/** Player portrait (drawn face + jersey) in a team-coloured badge. */
export function Avatar({ player, team, size = 36 }) {
  return (
    <span
      className="avatar"
      style={{ '--team': team.colors.primary, '--team2': team.colors.secondary, width: size, height: size }}
      title={player.name}
    >
      <Character player={player} team={team} role="portrait" portrait />
    </span>
  )
}

export function RoleBadge({ role }) {
  return <span className={`role role-${role}`} title={ROLE_LABEL[role]}>{role}</span>
}

export function Rating({ label, value }) {
  return (
    <span className="rating" title={`${label} ${value}`}>
      <small>{label}</small>
      <span className="rating-bar"><i style={{ width: `${value}%` }} /></span>
      <b>{value}</b>
    </span>
  )
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          {onClose && <button className="btn ghost" onClick={onClose}>✕</button>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
