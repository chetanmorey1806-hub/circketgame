import { useState } from 'react'
import { teamInfo } from '../game/leagues.js'
import { loadStats } from '../game/storage.js'
import { load as loadTournament } from '../game/tournament.js'
import InstallButton from './InstallButton.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import { Modal } from './Player.jsx'

const TILES = [
  { id: 'quick', title: 'QUICK MATCH', sub: 'Pick teams & play', icon: '⚡', tone: 'gold', big: true },
  { id: 'worldcup', title: 'WORLD CUP', sub: '10 nations · knockouts', icon: '🏆', tone: 'blue', big: true },
  { id: 'ipl', title: 'IPL SEASON', sub: '10 franchises · playoffs', icon: '🏏', tone: 'purple' },
  { id: 'test', title: 'TEST MATCH', sub: '2 innings · whites · red ball', icon: '🔴', tone: 'cream' },
  { id: 'challenges', title: 'CHALLENGES', sub: 'Win from tough spots', icon: '🎯', tone: 'red' },
  { id: 'superover', title: 'SUPER OVER', sub: '1 over · 2 wickets', icon: '🔥', tone: 'orange' },
  { id: 'nets', title: 'NETS PRACTICE', sub: 'Bat freely, sharpen timing', icon: '🥅', tone: 'green' },
  { id: 'settings', title: 'SETTINGS', sub: 'Commentary · sound · graphics', icon: '⚙️', tone: 'slate' },
]

/** Game-style main menu with big mode tiles over the stadium backdrop. */
export default function MainMenu({ backdrop, onPick, onContinue }) {
  const [settings, setSettings] = useState(false)
  const saved = loadTournament()
  const stats = loadStats()

  return (
    <div className="main-menu" style={backdrop ? { '--bg': `url(${backdrop})` } : undefined}>
      <header className="mm-head">
        <div className="mm-logo">
          <span className="tl-studio">CHETAN PRODUCTION</span>
          <b><span className="tl-cricket">CRICKET</span> <span className="tl-clash">CLASH</span></b>
        </div>
        <div className="mm-stats">
          <span><b>{stats.played}</b> played</span>
          <span><b>{stats.won}</b> won</span>
          <span><b>{stats.highScore}</b> best</span>
          <InstallButton />
        </div>
      </header>

      {saved && (
        <button className="mm-continue" onClick={() => onContinue(saved)}>
          <span>🏆</span>
          <span><b>CONTINUE {saved.name.toUpperCase()}</b><small>{teamInfo(saved.userTeam).name} · {saved.stage === 'done' ? 'Finished' : saved.stage === 'league' ? 'League stage' : saved.stage === 'semi' ? 'Semi-finals' : 'Final'}</small></span>
          <span className="cc-go">▶</span>
        </button>
      )}

      <div className="mm-grid">
        {TILES.map((t, i) => (
          <button
            key={t.id}
            className={`mm-tile tone-${t.tone} ${t.big ? 'big' : ''}`}
            style={{ animationDelay: `${i * 0.05}s` }}
            onClick={() => (t.id === 'settings' ? setSettings(true) : onPick(t.id))}
          >
            <span className="mm-icon">{t.icon}</span>
            <b>{t.title}</b>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>

      {settings && (
        <Modal title="⚙️ Settings" onClose={() => setSettings(false)}>
          <SettingsPanel />
        </Modal>
      )}
    </div>
  )
}
