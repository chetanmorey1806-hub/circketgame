import { useEffect } from 'react'

const SPARKS = Array.from({ length: 26 }, (_, i) => ({
  left: 8 + ((i * 37) % 84),
  top: 18 + ((i * 53) % 64),
  delay: 1.0 + ((i * 7) % 10) / 10,
  size: 2 + (i % 4),
}))

/** Studio intro: "CHETAN PRODUCTION" in gold metal with light sweeps, ~3.4 seconds. */
export default function Splash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="splash2" onClick={onDone} role="presentation">
      <div className="s2-rays" />
      <div className="s2-streak" />
      <div className="s2-ball">
        <span className="s2-trail" />
        <span className="s2-leather" />
      </div>
      <div className="s2-logo">
        <div className="s2-emblem">
          <svg viewBox="0 0 64 64">
            <defs>
              <linearGradient id="s2g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff6c8" />
                <stop offset="0.45" stopColor="#f5c518" />
                <stop offset="1" stopColor="#9a6b05" />
              </linearGradient>
            </defs>
            <path d="M32 3 L58 14 L55 42 Q50 56 32 61 Q14 56 9 42 L6 14 Z" fill="none" stroke="url(#s2g)" strokeWidth="3" />
            <text x="32" y="42" textAnchor="middle" fontSize="28" fontWeight="900" fill="url(#s2g)" fontFamily="Georgia, serif">C</text>
          </svg>
        </div>
        <h1 className="s2-title" data-text="CHETAN">
          {'CHETAN'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.08}s` }}>{c}</span>
          ))}
        </h1>
        <div className="s2-sub">
          <i />
          <span>PRODUCTION</span>
          <i />
        </div>
        <p className="s2-presents">presents</p>
      </div>
      {SPARKS.map((s, i) => (
        <b key={i} className="s2-spark" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
      <div className="s2-flash" />
    </div>
  )
}
