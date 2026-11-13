import { useId } from 'react'
import { ink, shade } from '../game/color.js'

// Original emblem shapes, drawn around (0,0) within roughly ±20 units.
const EMBLEMS = {
  star: <polygon points="0,-21 6,-7 21,-7 9,3 13,18 0,9 -13,18 -9,3 -21,-7 -6,-7" />,
  crown: (
    <>
      <path d="M-20 8 L-22 -10 L-10 0 L0 -18 L10 0 L22 -10 L20 8 Z" />
      <rect x="-20" y="11" width="40" height="6" rx="2" />
      <circle cx="0" cy="-20" r="3" /><circle cx="-22" cy="-12" r="2.5" /><circle cx="22" cy="-12" r="2.5" />
    </>
  ),
  wheel: (
    <>
      <circle r="18" fill="none" strokeWidth="3.5" stroke="currentColor" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="0" y1="0" x2={18 * Math.cos((i * Math.PI) / 6)} y2={18 * Math.sin((i * Math.PI) / 6)} stroke="currentColor" strokeWidth="2" />
      ))}
      <circle r="4" />
    </>
  ),
  crescent: (
    <>
      <path d="M8 -19 A20 20 0 1 0 8 19 A15 15 0 1 1 8 -19 Z" />
      <polygon transform="translate(12 -2) scale(0.38)" points="0,-21 6,-7 21,-7 9,3 13,18 0,9 -13,18 -9,3 -21,-7 -6,-7" />
    </>
  ),
  flower: (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <ellipse key={i} cx="0" cy="-12" rx="5" ry="10" transform={`rotate(${i * 36})`} />
      ))}
      <circle r="7" fill="rgba(0,0,0,0.25)" />
    </>
  ),
  leaf: (
    <>
      <path d="M0 22 C-2 8 -4 -6 0 -22 C4 -6 2 8 0 22 Z" />
      {[-14, -6, 2, 10].map((y, i) => (
        <g key={i}>
          <path d={`M0 ${y} Q-10 ${y - 4} -16 ${y - 10} Q-8 ${y - 2} 0 ${y + 3} Z`} />
          <path d={`M0 ${y} Q10 ${y - 4} 16 ${y - 10} Q8 ${y - 2} 0 ${y + 3} Z`} />
        </g>
      ))}
    </>
  ),
  paw: (
    <>
      <ellipse cx="0" cy="8" rx="12" ry="10" />
      <ellipse cx="-14" cy="-6" rx="5" ry="6.5" />
      <ellipse cx="-5" cy="-15" rx="5" ry="6.5" />
      <ellipse cx="5" cy="-15" rx="5" ry="6.5" />
      <ellipse cx="14" cy="-6" rx="5" ry="6.5" />
    </>
  ),
  trident: (
    <path d="M-2 22 L-2 -4 L-12 -8 L-14 -20 L-10 -20 L-8 -12 L-2 -10 L-2 -22 L0 -26 L2 -22 L2 -10 L8 -12 L10 -20 L14 -20 L12 -8 L2 -4 L2 22 Z" />
  ),
  flame: (
    <>
      <path d="M0 -22 C12 -8 18 2 13 12 C9 21 -9 21 -13 12 C-17 2 -6 -4 -4 -12 C-2 -6 0 -4 2 -2 C4 -10 2 -16 0 -22 Z" />
      <path d="M0 0 C6 6 6 14 0 16 C-6 14 -6 8 0 0 Z" fill="rgba(255,255,255,0.45)" />
    </>
  ),
  shield: (
    <>
      <path d="M-16 -18 Q0 -26 16 -18 L16 6 Q16 18 0 22 Q-16 18 -16 6 Z" />
      <rect x="-12" y="-6" width="24" height="4" rx="1" fill="rgba(0,0,0,0.45)" />
      <rect x="-1.5" y="-2" width="3" height="18" fill="rgba(0,0,0,0.35)" />
      <path d="M0 -26 L4 -32 L0 -30 L-4 -32 Z" />
    </>
  ),
  sun: (
    <>
      <circle r="10" />
      {Array.from({ length: 12 }, (_, i) => (
        <polygon key={i} points="-3,-13 3,-13 0,-22" transform={`rotate(${i * 30})`} />
      ))}
    </>
  ),
  bolt: <polygon points="-3,-22 12,-22 3,-5 13,-5 -8,22 -2,2 -11,2" />,
  wings: (
    <>
      <path d="M-2 4 C-8 -8 -18 -14 -24 -14 C-20 -8 -20 -4 -22 0 C-16 0 -14 4 -16 8 C-10 6 -6 8 -2 12 Z" />
      <path d="M2 4 C8 -8 18 -14 24 -14 C20 -8 20 -4 22 0 C16 0 14 4 16 8 C10 6 6 8 2 12 Z" />
      <circle cx="0" cy="-4" r="5" />
    </>
  ),
  sword: (
    <>
      <g transform="rotate(35)"><rect x="-2" y="-22" width="4" height="34" rx="1" /><rect x="-8" y="10" width="16" height="3" /><rect x="-1.5" y="13" width="3" height="8" /></g>
      <g transform="rotate(-35)"><rect x="-2" y="-22" width="4" height="34" rx="1" /><rect x="-8" y="10" width="16" height="3" /><rect x="-1.5" y="13" width="3" height="8" /></g>
    </>
  ),
}

/** Original crest: shield in team colours with emblem and short name. */
export default function TeamLogo({ team, size = 48, className = '' }) {
  const id = useId().replace(/:/g, '')
  const { primary, secondary } = team.colors
  const emblemColor = ink(primary) === '#111' ? shade(secondary, -0.1) : secondary
  return (
    <svg className={`team-logo ${className}`} viewBox="0 0 100 116" width={size} height={size * 1.16} aria-label={`${team.name} crest`}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(primary, 0.15)} />
          <stop offset="1" stopColor={shade(primary, -0.35)} />
        </linearGradient>
      </defs>
      <path d="M50 3 L93 15 L91 62 Q87 97 50 113 Q13 97 9 62 L7 15 Z" fill={shade(primary, -0.5)} />
      <path d="M50 8 L88 19 L86 61 Q82 92 50 107 Q18 92 14 61 L12 19 Z" fill={`url(#g${id})`} stroke={secondary} strokeWidth="3" />
      <path d="M50 8 L88 19 L87 40 Q50 30 13 40 L12 19 Z" fill="rgba(255,255,255,0.12)" />
      <g transform="translate(50 47)" fill={emblemColor} color={emblemColor}>
        {EMBLEMS[team.emblem] ?? EMBLEMS.star}
      </g>
      <rect x="20" y="76" width="60" height="18" rx="3" fill={secondary} />
      <text x="50" y="90" textAnchor="middle" fontSize={team.short.length > 3 ? 13 : 15} fontWeight="900" fill={ink(secondary)} fontFamily="system-ui, sans-serif" letterSpacing="1">
        {team.short}
      </text>
    </svg>
  )
}
