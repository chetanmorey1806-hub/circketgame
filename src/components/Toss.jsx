import { useState } from 'react'
import { cpuTossChoice } from '../game/engine.js'
import TeamLogo from './TeamLogo.jsx'

export default function Toss({ settings, onDone }) {
  const [call, setCall] = useState(null)
  const [flipping, setFlipping] = useState(false)
  const [face, setFace] = useState(null)
  const [cpuChoice, setCpuChoice] = useState(null)

  const won = face && call === face

  const flip = (c) => {
    setCall(c)
    setFlipping(true)
    setTimeout(() => {
      const f = Math.random() < 0.5 ? 'heads' : 'tails'
      setFace(f)
      setFlipping(false)
      if (f !== c) setCpuChoice(cpuTossChoice())
    }, 1400)
  }

  return (
    <section className="toss card">
      <div className="toss-teams">
        <div><TeamLogo team={settings.user} size={72} /><b>{settings.user.name}</b></div>
        <span className="vs">VS</span>
        <div><TeamLogo team={settings.cpu} size={72} /><b>{settings.cpu.name}</b></div>
      </div>
      <p className="muted">
        {settings.overs} over{settings.overs > 1 ? 's' : ''} · {settings.wickets} wickets · {settings.venue}
      </p>

      <div className={`coin ${flipping ? 'flipping' : ''} ${face || ''}`}>
        <div className="coin-face heads">H</div>
        <div className="coin-face tails">T</div>
      </div>

      {!call && (
        <>
          <p>Call the toss</p>
          <div className="btn-row">
            <button className="btn primary" onClick={() => flip('heads')}>Heads</button>
            <button className="btn primary" onClick={() => flip('tails')}>Tails</button>
          </div>
        </>
      )}

      {flipping && <p className="muted">Coin is in the air…</p>}

      {face && won && (
        <>
          <p className="headline">It's {face}! You won the toss.</p>
          <div className="btn-row">
            <button className="btn primary" onClick={() => onDone('user')}>🏏 Bat first</button>
            <button className="btn" onClick={() => onDone('cpu')}>🎯 Bowl first</button>
          </div>
        </>
      )}

      {face && !won && (
        <>
          <p className="headline">
            It's {face}. {settings.cpu.name} won the toss and chose to {cpuChoice}.
          </p>
          <button className="btn primary" onClick={() => onDone(cpuChoice === 'bat' ? 'cpu' : 'user')}>
            Continue
          </button>
        </>
      )}
    </section>
  )
}
