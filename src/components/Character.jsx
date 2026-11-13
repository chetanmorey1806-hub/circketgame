import { useId } from 'react'
import { ink, shade } from '../game/color.js'

// Skeleton (viewBox units, figure ~234 tall, feet at y=238):
// shoulders (28,52)/(72,52) · elbows 34 below · hips (42,118)/(58,118) · knees 54 below · ankles 52 below.
const SH = { r: [28, 52], l: [72, 52] }
const HIP = { r: [42, 118], l: [58, 118] }
const UPPER_ARM = 34
const THIGH = 54

// Joint angles in degrees. u* = upper arm, f* = forearm (relative), th* = thigh, sh* = shin (relative).
// swing rotates both arms + bat around the chest; drop lowers the upper body (px) for bent knees.
const POSES = {
  idle: { uR: 6, fR: -6, uL: -6, fL: 6, thR: 3, thL: -3 },
  stance: { uR: -20, uL: 20, thR: 7, shR: -4, thL: -7, shL: 4, drop: 4 },
  defend: { uR: -20, uL: 20, swing: -18, thR: 3, thL: -14, shL: 6, drop: 7 },
  drive: { uR: -20, uL: 20, swing: 120, thR: 5, thL: -20, shL: 10, drop: 5 },
  loft: { uR: -20, uL: 20, swing: 172, thR: 9, thL: -12 },
  celebrate: { uR: -20, uL: 20, swing: 184, thR: 6, thL: -6 },
  out: { uR: -4, fR: -4, uL: 4, fL: 4, thR: 2, thL: -2, head: 14 },
  ready: { uR: 10, fR: -26, uL: -10, fL: 26, thR: 12, shR: -10, thL: -12, shL: 10, drop: 7 },
  keeper: { uR: -26, fR: -24, uL: 26, fL: 24, thR: 34, shR: -62, thL: -34, shL: 62, drop: 30 },
  cheer: { uR: 158, fR: 12, uL: -158, fL: -12, thR: 4, thL: -4 },
  run: {},
  deliver: {},
}

const UMPIRE_KIT = { primary: '#eef2f6', secondary: '#c9d1da', accent: '#1d2430' }

/** Tapered limb segment hanging straight down from (x, y0) to (x, y1) with rounded ends. */
const seg = (x, y0, y1, w0, w1) =>
  `M${x - w0 / 2} ${y0} L${x - w1 / 2} ${y1} A${w1 / 2} ${w1 / 2} 0 0 0 ${x + w1 / 2} ${y1} L${x + w0 / 2} ${y0} A${w0 / 2} ${w0 / 2} 0 0 0 ${x - w0 / 2} ${y0} Z`

const rot = (cx, cy, deg) => ({ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${deg}deg)` })

function Arm({ side, u, f, g, glove, gloveTrim }) {
  const [x, y] = SH[side]
  const ey = y + UPPER_ARM
  return (
    <g className={`uarm uarm-${side}`} style={rot(x, y, u)}>
      <path d={seg(x, y - 2, ey, 13, 10)} fill={`url(#${g}skin)`} />
      <path d={seg(x, y - 3, y + 16, 15, 13)} fill={`url(#${g}kit)`} />
      <rect x={x - 7.2} y={y + 12} width={14.4} height={3} rx="1.5" fill={gloveTrim} opacity="0.9" />
      <g className={`farm farm-${side}`} style={rot(x, ey, f)}>
        <path d={seg(x, ey, ey + 30, 10, 7.5)} fill={`url(#${g}skin)`} />
        {glove ? (
          <g>
            <rect x={x - 6.5} y={ey + 26} width={13} height={15} rx={4.5} fill={glove} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
            <rect x={x - 6.5} y={ey + 26} width={13} height={4} rx={2} fill={gloveTrim} />
            <path d={`M${x - 4} ${ey + 33} h8 M${x - 4} ${ey + 36.5} h8`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
          </g>
        ) : (
          <ellipse cx={x} cy={ey + 34} rx={4.6} ry={6} fill={`url(#${g}skin)`} />
        )}
      </g>
    </g>
  )
}

function Leg({ side, th, sh, g, pads, stripe }) {
  const [x, y] = HIP[side]
  const ky = y + THIGH
  const ay = ky + 52
  return (
    <g className={`thigh thigh-${side}`} style={rot(x, y, th)}>
      <path d={seg(x, y - 4, ky, 18, 13)} fill={`url(#${g}pants)`} />
      <rect x={side === 'r' ? x - 8 : x + 5.5} y={y} width="2.5" height={THIGH - 4} rx="1" fill={stripe} opacity="0.9" />
      <g className={`shin shin-${side}`} style={rot(x, ky, sh)}>
        <path d={seg(x, ky - 2, ay, 13, 8.5)} fill={`url(#${g}pants)`} />
        {pads && (
          <g>
            <path d={`M${x - 9} ${ky - 14} Q${x} ${ky - 22} ${x + 9} ${ky - 14} L${x + 9.5} ${ay - 4} Q${x} ${ay + 2} ${x - 9.5} ${ay - 4} Z`} fill={`url(#${g}pad)`} stroke="#c2c8d0" strokeWidth="0.8" />
            <ellipse cx={x} cy={ky - 4} rx={9.5} ry={6} fill={`url(#${g}pad)`} stroke="#c2c8d0" strokeWidth="0.8" />
            {[-5, -1.7, 1.7, 5].map((d) => (
              <line key={d} x1={x + d} y1={ky + 4} x2={x + d * 0.9} y2={ay - 6} stroke="#d3d8de" strokeWidth="1.3" />
            ))}
            <rect x={x - 9.5} y={ky + 14} width="19" height="2.2" fill={stripe} opacity="0.75" />
            <rect x={x - 9.5} y={ky + 32} width="19" height="2.2" fill={stripe} opacity="0.75" />
          </g>
        )}
        {/* shoe */}
        <path d={`M${x - 7} ${ay - 2} Q${x - 8.5} ${ay + 9} ${x - 5} ${ay + 11} L${x + 5} ${ay + 11} Q${x + 8.5} ${ay + 9} ${x + 7} ${ay - 2} Z`} fill="#f4f5f7" />
        <path d={`M${x - 6} ${ay + 9} L${x + 6} ${ay + 9} L${x + 5} ${ay + 12} L${x - 5} ${ay + 12} Z`} fill="#2b2f36" />
        <path d={`M${x - 6.5} ${ay + 3} L${x + 6.5} ${ay + 3}`} stroke={stripe} strokeWidth="1.6" />
      </g>
    </g>
  )
}

function Hair({ style, back, g }) {
  const fill = `url(#${g}hair)`
  if (back) return <path d="M38.5 22 Q38 3 50 3 Q62 3 61.5 22 Q61 33 55 36 L45 36 Q39 33 38.5 22 Z" fill={fill} />
  switch (style) {
    case 1:
      return <path d="M38.5 21 Q36 3 50 2.5 Q65 3 61.5 21 Q60 12 54 10 Q47 13 40 13 Q39 17 38.5 21 Z" fill={fill} />
    case 2:
      return <path d="M39 18 Q39 5 50 5 Q61 5 61 18 Q58 10 50 10 Q42 10 39 18 Z" fill={fill} opacity="0.9" />
    case 3:
      return <path d="M38 25 Q35 1.5 50 1.5 Q66 1.5 62 25 Q61.5 14 57 10.5 Q50 8 43 10.5 Q38.5 14 38 25 Z" fill={fill} />
    default:
      return <path d="M38.8 18 Q39 3.5 50 3.5 Q61 3.5 61.2 18 Q58.5 9.5 50 9.5 Q41.5 9.5 38.8 18 Z" fill={fill} />
  }
}

function Face({ look, g }) {
  const { skin, hairStyle, beard } = look
  const dark = shade(skin, -0.28)
  return (
    <g>
      <ellipse cx="38.6" cy="21" rx="2.6" ry="4" fill={shade(skin, -0.12)} />
      <ellipse cx="61.4" cy="21" rx="2.6" ry="4" fill={shade(skin, -0.12)} />
      <path d="M39 18 Q39 4 50 4 Q61 4 61 18 Q61 29 55.5 33.5 Q50 36.5 44.5 33.5 Q39 29 39 18 Z" fill={`url(#${g}face)`} />
      {beard && <path d="M40 22 Q41 33 46 35.5 Q50 37.5 54 35.5 Q59 33 60 22 Q58 29 54 30 Q50 31 46 30 Q42 29 40 22 Z" fill={`url(#${g}hair)`} opacity="0.85" />}
      <Hair style={hairStyle} g={g} />
      <path d="M42.5 16 Q45 14.8 47.5 15.6" stroke={dark} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M52.5 15.6 Q55 14.8 57.5 16" stroke={dark} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <ellipse cx="45" cy="18.6" rx="1.9" ry="1.15" fill="#f3efe9" />
      <ellipse cx="55" cy="18.6" rx="1.9" ry="1.15" fill="#f3efe9" />
      <circle cx="45.2" cy="18.7" r="0.95" fill="#2a1d14" />
      <circle cx="55.2" cy="18.7" r="0.95" fill="#2a1d14" />
      <path d="M50 19 Q49.2 23.5 48.2 25 Q50 26 51.8 25" stroke={dark} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M46.6 28.6 Q50 29.9 53.4 28.6" stroke={shade(skin, -0.38)} strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="42.5" cy="24" rx="2.4" ry="1.4" fill="#d9776a" opacity="0.12" />
      <ellipse cx="57.5" cy="24" rx="2.4" ry="1.4" fill="#d9776a" opacity="0.12" />
    </g>
  )
}

function Helmet({ color, accent, back, g }) {
  if (back) {
    return (
      <g>
        <path d="M37 22 Q36.5 1 50 1 Q63.5 1 63 22 L62.5 29 Q50 33 37.5 29 Z" fill={`url(#${g}helmet)`} />
        <path d="M39.5 29 Q50 34 60.5 29 L59.5 36 Q50 39.5 40.5 36 Z" fill={shade(color, -0.35)} />
        <path d="M41 9 Q50 3 59 9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" fill="none" />
      </g>
    )
  }
  return (
    <g>
      <path d="M37.5 18 Q37 1 50 1 Q63 1 62.5 18 Z" fill={`url(#${g}helmet)`} />
      <path d="M35 16.5 L65 16.5 Q66.5 18.5 66 20 L34 20 Q33.5 18.5 35 16.5 Z" fill={shade(color, -0.45)} />
      <path d="M37.5 18 L37.5 30 L41.5 33 L41.5 20 Z" fill={`url(#${g}helmet)`} />
      <path d="M62.5 18 L62.5 30 L58.5 33 L58.5 20 Z" fill={`url(#${g}helmet)`} />
      <circle cx="50" cy="9" r="2.6" fill={accent} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
      <g stroke={`url(#${g}chrome)`} strokeWidth="1.25" fill="none" strokeLinecap="round">
        <path d="M40 22.5 Q50 25 60 22.5" />
        <path d="M40.5 26.5 Q50 29 59.5 26.5" />
        <path d="M41.5 30.5 Q50 33.5 58.5 30.5" />
        <path d="M44.5 20 L45 33" />
        <path d="M50 20 L50 34.5" />
        <path d="M55.5 20 L55 33" />
      </g>
      <path d="M41 7 Q50 1.8 59 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" fill="none" />
    </g>
  )
}

function Hat({ color, back, g }) {
  return (
    <g>
      <path d="M39 15 Q39 2 50 2 Q61 2 61 15 Z" fill={color} />
      <path d="M43 6 Q50 3 57 6" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
      {back ? (
        <path d="M38.5 14 L61.5 14 L61.5 16.5 L38.5 16.5 Z" fill={shade(color, -0.3)} />
      ) : (
        <path d="M33 14.5 L67 14.5 Q65 19 50 19 Q35 19 33 14.5 Z" fill={shade(color, -0.3)} />
      )}
    </g>
  )
}

/**
 * A cricketer drawn in SVG with shaded kit and jointed limbs.
 * role: batter | bowler | fielder | keeper | umpire   (portrait=true renders a head-and-shoulders crop)
 */
export default function Character({ player, team, view = 'front', role = 'fielder', pose = 'idle', className = '', portrait = false }) {
  const g = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const kit = role === 'umpire' ? UMPIRE_KIT : team.colors
  const { primary, secondary, accent } = kit
  const look = player?.look ?? { skin: '#c98d63', hair: '#1b1410', hairStyle: 0, beard: false }
  const p = { uR: 0, fR: 0, uL: 0, fL: 0, thR: 0, shR: 0, thL: 0, shL: 0, swing: 0, drop: 0, head: 0, ...POSES[pose] }
  const back = view === 'back'
  const batter = role === 'batter'
  const keeper = role === 'keeper'
  const pantsBase = role === 'umpire' ? '#23272e' : shade(primary, -0.18)
  const glove = batter ? '#f7f7f7' : keeper ? shade(secondary, -0.05) : null
  const textInk = ink(primary)
  const helmetColor = shade(primary, -0.22)

  const defs = (
    <defs>
      <linearGradient id={`${g}kit`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(primary, 0.22)} />
        <stop offset="0.45" stopColor={primary} />
        <stop offset="1" stopColor={shade(primary, -0.38)} />
      </linearGradient>
      <linearGradient id={`${g}side`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(secondary, 0.15)} />
        <stop offset="1" stopColor={shade(secondary, -0.3)} />
      </linearGradient>
      <linearGradient id={`${g}pants`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(pantsBase, 0.18)} />
        <stop offset="0.5" stopColor={pantsBase} />
        <stop offset="1" stopColor={shade(pantsBase, -0.4)} />
      </linearGradient>
      <linearGradient id={`${g}skin`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(look.skin, 0.12)} />
        <stop offset="0.5" stopColor={look.skin} />
        <stop offset="1" stopColor={shade(look.skin, -0.3)} />
      </linearGradient>
      <radialGradient id={`${g}face`} cx="0.42" cy="0.4" r="0.7">
        <stop offset="0" stopColor={shade(look.skin, 0.1)} />
        <stop offset="0.7" stopColor={look.skin} />
        <stop offset="1" stopColor={shade(look.skin, -0.25)} />
      </radialGradient>
      <linearGradient id={`${g}hair`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={shade(look.hair, 0.25)} />
        <stop offset="1" stopColor={look.hair} />
      </linearGradient>
      <radialGradient id={`${g}helmet`} cx="0.35" cy="0.25" r="0.85">
        <stop offset="0" stopColor={shade(helmetColor, 0.45)} />
        <stop offset="0.45" stopColor={helmetColor} />
        <stop offset="1" stopColor={shade(helmetColor, -0.45)} />
      </radialGradient>
      <linearGradient id={`${g}chrome`} x1="0" x2="1">
        <stop offset="0" stopColor="#9aa1ab" />
        <stop offset="0.5" stopColor="#f2f4f7" />
        <stop offset="1" stopColor="#7d848e" />
      </linearGradient>
      <linearGradient id={`${g}pad`} x1="0" x2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#eef0f3" />
        <stop offset="1" stopColor="#c4cad2" />
      </linearGradient>
      <linearGradient id={`${g}bat`} x1="0" x2="1">
        <stop offset="0" stopColor="#f3e2b3" />
        <stop offset="0.55" stopColor="#e2c98e" />
        <stop offset="1" stopColor="#b8955a" />
      </linearGradient>
    </defs>
  )

  const arms = (
    <g className="arms" style={{ ...rot(50, 62, p.swing), transition: 'transform 0.16s ease-out' }}>
      {batter && (
        <g>
          <rect x="47.8" y="104" width="4.4" height="26" rx="2" fill="#1f2328" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1="47.8" y1={107 + i * 4.5} x2="52.2" y2={109 + i * 4.5} stroke="#3a3f47" strokeWidth="0.8" />
          ))}
          <path d="M44.5 128 Q50 126 55.5 128 L56.5 204 Q50 210 43.5 204 Z" fill={`url(#${g}bat)`} stroke="#a3824c" strokeWidth="0.8" />
          <rect x="44.6" y="134" width="11.3" height="9" fill={secondary} />
          <rect x="44.6" y="145" width="11.3" height="2.5" fill={primary} />
          <path d="M50 150 L50 200" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </g>
      )}
      <Arm side="r" u={p.uR} f={p.fR} g={g} glove={glove} gloveTrim={secondary} />
      <Arm side="l" u={p.uL} f={p.fL} g={g} glove={glove} gloveTrim={secondary} />
    </g>
  )

  const content = (
    <g className="char-body">
      {!portrait && <ellipse cx="50" cy="238" rx="27" ry="4.5" fill="rgba(0,0,0,0.38)" />}
      <g className="legs">
        <Leg side="r" th={p.thR} sh={p.shR} g={g} pads={batter || keeper} stripe={secondary} />
        <Leg side="l" th={p.thL} sh={p.shL} g={g} pads={batter || keeper} stripe={secondary} />
      </g>
      <g className="upper" style={{ transform: `translateY(${p.drop}px)`, transition: 'transform 0.18s' }}>
        {back && arms}
        {/* neck */}
        <path d="M44.5 28 L55.5 28 L56.5 46 L43.5 46 Z" fill={`url(#${g}skin)`} />
        <path d="M44.5 34 Q50 38 55.5 34 L55.5 38 Q50 41 44.5 38 Z" fill="rgba(0,0,0,0.15)" />
        {/* hips / trousers top */}
        <path d="M30.5 104 L69.5 104 L71 124 Q50 128 29 124 Z" fill={`url(#${g}pants)`} />
        {/* torso */}
        <path d="M23 58 Q24 46 36 44 L64 44 Q76 46 77 58 L72 108 Q50 114 28 108 Z" fill={`url(#${g}kit)`} />
        <path d="M23 58 Q23.5 52 26 49 L33 106 Q30 107.5 28 108 Z" fill={`url(#${g}side)`} />
        <path d="M77 58 Q76.5 52 74 49 L67 106 Q70 107.5 72 108 Z" fill={`url(#${g}side)`} />
        <path d="M30 104 Q50 110 70 104" stroke="rgba(0,0,0,0.2)" strokeWidth="1.2" fill="none" />
        <path d="M38 70 Q50 74 62 70" stroke="rgba(0,0,0,0.08)" strokeWidth="2" fill="none" />
        {back ? (
          <g fill={textInk} fontFamily="'Arial Black', system-ui, sans-serif" fontWeight="900" textAnchor="middle">
            <path d="M41 45 Q50 49 59 45" stroke={accent} strokeWidth="2.5" fill="none" />
            <text x="50" y="66" fontSize={player && player.short.length > 8 ? 6.6 : 8} letterSpacing="0.5">
              {role === 'umpire' ? '' : player?.short.toUpperCase()}
            </text>
            <text x="50" y="98" fontSize="27">{role === 'umpire' ? '' : player?.number}</text>
          </g>
        ) : (
          <g fontFamily="'Arial Black', system-ui, sans-serif" fontWeight="900" textAnchor="middle">
            <path d="M41 44.5 L50 55 L59 44.5" stroke={accent} strokeWidth="3" fill="none" />
            <path d="M43 44.5 L50 52.5 L57 44.5 Z" fill={shade(look.skin, -0.1)} />
            {role !== 'umpire' && (
              <>
                <text x="50" y="80" fontSize="9.5" fill={textInk} letterSpacing="0.6">{team.short}</text>
                <text x="61" y="65" fontSize="7" fill={textInk}>{player?.number}</text>
                <circle cx="39" cy="62" r="3.6" fill={secondary} stroke={textInk} strokeWidth="0.5" />
              </>
            )}
          </g>
        )}
        {/* head */}
        <g style={rot(50, 38, p.head)}>
          {back ? (
            <g>
              <ellipse cx="38.6" cy="21" rx="2.6" ry="4" fill={shade(look.skin, -0.12)} />
              <ellipse cx="61.4" cy="21" rx="2.6" ry="4" fill={shade(look.skin, -0.12)} />
              <path d="M39 18 Q39 4 50 4 Q61 4 61 18 Q61 30 55 34 L45 34 Q39 30 39 18 Z" fill={`url(#${g}face)`} />
              <Hair back g={g} />
            </g>
          ) : (
            <Face look={look} g={g} />
          )}
          {!portrait && (batter || keeper) && <Helmet color={helmetColor} accent={secondary} back={back} g={g} />}
          {!portrait && role === 'fielder' && <Hat color={primary} back={back} g={g} />}
          {role === 'umpire' && <Hat color="#15181d" back={back} g={g} />}
        </g>
        {!back && arms}
      </g>
    </g>
  )

  if (portrait) {
    return (
      <svg viewBox="22 -2 56 56" className={`char portrait ${className}`}>
        {defs}
        {content}
      </svg>
    )
  }
  return (
    <svg viewBox="-10 -6 120 248" className={`char pose-${pose} view-${view} ${className}`} preserveAspectRatio="xMidYMax meet">
      {defs}
      {content}
    </svg>
  )
}
