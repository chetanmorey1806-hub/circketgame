import { useState } from 'react'
import { sound } from '../audio/sound.js'
import { DIFFICULTY, FORMATS } from '../game/engine.js'
import { LEAGUES, teamInfo } from '../game/leagues.js'
import { loadStats } from '../game/storage.js'
import { TOURNAMENTS, load as loadTournament } from '../game/tournament.js'
import { venueStyle } from '../game/venues.js'
import SettingsPanel from './SettingsPanel.jsx'
import TeamLogo from './TeamLogo.jsx'

const QUICK_OVERS = [1, 2, 5, 10]
const WICKETS = [2, 3, 5, 10]
const STYLE_LABEL = { bowl: 'Mega bowl', modern: 'Modern', heritage: 'Heritage', open: 'Open ground', desert: 'Desert' }

function TeamGrid({ teams, value, disabled, onChange }) {
  return (
    <div className="team-grid">
      {teams.map((t) => (
        <button
          key={t.id}
          className={`team-tile ${value === t.id ? 'active' : ''}`}
          style={{ '--p': t.colors.primary, '--s': t.colors.secondary }}
          disabled={disabled === t.id}
          onClick={() => onChange(t.id)}
        >
          <TeamLogo team={t} size={40} />
          <span>{t.name}</span>
        </button>
      ))}
    </div>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map(([v, label]) => (
        <button key={String(v)} className={`chip ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Home({ preset = {}, onStart, onTournament, onContinueTournament, onBack }) {
  const [mode, setMode] = useState(preset.mode ?? 'quick') // quick | tournament
  const [leagueId, setLeagueId] = useState(preset.league ?? 'ipl')
  const league = LEAGUES[leagueId]
  const [userTeam, setUserTeam] = useState(league.teams[0].id)
  const [cpuTeam, setCpuTeam] = useState(league.teams[1].id)
  const [venue, setVenue] = useState(league.venues[0])
  const [night, setNight] = useState(false)
  const [format, setFormat] = useState(preset.format ?? 'custom')
  const [overs, setOvers] = useState(preset.overs ?? 2)
  const [wickets, setWickets] = useState(preset.wickets ?? 5)
  const [difficulty, setDifficulty] = useState('medium')
  const [tKind, setTKind] = useState(preset.tKind ?? 'worldcup')
  const [tOvers, setTOvers] = useState(5)
  const stats = loadStats()
  const saved = loadTournament()

  const switchLeague = (id) => {
    const l = LEAGUES[id]
    setLeagueId(id)
    setUserTeam(l.teams[0].id)
    setCpuTeam(l.teams[1].id)
    setVenue(l.venues[0])
  }

  const u = teamInfo(userTeam)
  const c = teamInfo(cpuTeam)
  const fmt = FORMATS[format]
  const matchOvers = format === 'custom' ? overs : fmt.overs
  const tLeague = LEAGUES[TOURNAMENTS[tKind].league]
  const tTeam = tLeague.teams.some((t) => t.id === userTeam) ? userTeam : tLeague.teams[0].id

  const start = () => {
    sound.unlock()
    onStart({
      user: u,
      cpu: c,
      overs: matchOvers,
      wickets: format === 'custom' ? wickets : 10,
      difficulty,
      venue,
      night,
      format: fmt,
      leagueName: preset.title ?? `${league.name === 'IPL' ? 'IPL' : league.tag} · ${fmt.id === 'custom' ? `${matchOvers} ov` : fmt.name}`,
    })
  }

  return (
    <section className="home">
      {onBack && <button className="btn back-btn" onClick={onBack}>← Menu</button>}
      <div className="hero">
        <div className="hero-vs">
          <TeamLogo team={mode === 'quick' ? u : teamInfo(tTeam)} size={84} className="hero-logo" />
          <div>
            <h1>Cricket Clash</h1>
            <p>{mode === 'quick' ? `${fmt.name} · ${u.short} vs ${c.short} · ${venue.split(',')[0]}` : `${TOURNAMENTS[tKind].name} · ${tOvers} overs a side`}</p>
          </div>
          <TeamLogo team={mode === 'quick' ? c : teamInfo(tLeague.teams.find((t) => t.id !== tTeam).id)} size={84} className="hero-logo" />
        </div>
      </div>

      {saved && (
        <button className="card continue-card" onClick={() => { sound.unlock(); onContinueTournament(saved) }}>
          <span className="cc-trophy">🏆</span>
          <span>
            <b>Continue {saved.name}</b>
            <small>{teamInfo(saved.userTeam).name} · {saved.stage === 'done' ? `Champions: ${teamInfo(saved.champion).name}` : saved.stage === 'league' ? 'League stage' : saved.stage === 'semi' ? 'Semi-finals' : 'Final'}</small>
          </span>
          <span className="cc-go">▶</span>
        </button>
      )}

      <div className="mode-tabs">
        <button className={`mode-tab ${mode === 'quick' ? 'active' : ''}`} onClick={() => setMode('quick')}>⚡ Quick Match</button>
        <button className={`mode-tab ${mode === 'tournament' ? 'active' : ''}`} onClick={() => setMode('tournament')}>🏆 Tournament</button>
      </div>

      {mode === 'quick' ? (
        <div className="card setup">
          <div className="league-tabs">
            {Object.values(LEAGUES).map((l) => (
              <button key={l.id} className={`league-tab ${leagueId === l.id ? 'active' : ''}`} onClick={() => switchLeague(l.id)}>
                <b>{l.name}</b>
                <small>{l.tag} · {l.teams.length} teams</small>
              </button>
            ))}
          </div>

          <div className="field">
            <label>Format</label>
            <div className="format-grid">
              {Object.values(FORMATS).map((f) => (
                <button key={f.id} className={`format-tile ${format === f.id ? 'active' : ''}`} onClick={() => setFormat(f.id)}>
                  <b>{f.name}</b>
                  <small>{f.id === 'custom' ? 'Short game' : f.inningsPerSide === 2 ? '2 innings each · whites' : `${f.overs} overs a side`}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Your team</label>
            <TeamGrid teams={league.teams} value={userTeam} disabled={cpuTeam} onChange={setUserTeam} />
          </div>
          <div className="field">
            <label>Opponent</label>
            <TeamGrid teams={league.teams} value={cpuTeam} disabled={userTeam} onChange={setCpuTeam} />
          </div>

          <div className="row3">
            <div className="field">
              <label>Stadium</label>
              <select className="select" value={venue} onChange={(e) => setVenue(e.target.value)}>
                {league.venues.map((v) => (
                  <option key={v} value={v}>{v} — {STYLE_LABEL[venueStyle(v).style]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Match time</label>
              <Chips options={[[false, '☀️ Day'], [true, '🌙 Day/Night']]} value={night} onChange={setNight} />
            </div>
          </div>

          <div className="row3">
            {format === 'custom' && (
              <>
                <div className="field">
                  <label>Overs</label>
                  <Chips options={QUICK_OVERS.map((o) => [o, o])} value={overs} onChange={setOvers} />
                </div>
                <div className="field">
                  <label>Wickets</label>
                  <Chips options={WICKETS.map((w) => [w, w])} value={wickets} onChange={setWickets} />
                </div>
              </>
            )}
            <div className="field">
              <label>Difficulty</label>
              <Chips options={Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label])} value={difficulty} onChange={setDifficulty} />
            </div>
          </div>

          {format !== 'custom' && (
            <p className="muted small">Full-length format. Use <b>Sim over</b> / <b>Sim innings</b> in the pause menu to fast-forward.</p>
          )}

          <button className="btn primary big" onClick={start}>Next: Select Playing XI →</button>
        </div>
      ) : (
        <div className="card setup">
          <div className="field">
            <label>Tournament</label>
            <div className="league-tabs">
              {Object.values(TOURNAMENTS).map((t) => (
                <button key={t.id} className={`league-tab ${tKind === t.id ? 'active' : ''}`} onClick={() => { setTKind(t.id); setUserTeam(LEAGUES[t.league].teams[0].id) }}>
                  <b>{t.trophy} {t.name}</b>
                  <small>{LEAGUES[t.league].teams.length} teams · league → semi-finals → final</small>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Your team</label>
            <TeamGrid teams={tLeague.teams} value={tTeam} onChange={setUserTeam} />
          </div>
          <div className="row3">
            <div className="field">
              <label>Overs per match</label>
              <Chips options={[[2, '2'], [5, '5'], [10, '10'], [20, 'T20'], [50, 'ODI']]} value={tOvers} onChange={setTOvers} />
            </div>
            <div className="field">
              <label>Difficulty</label>
              <Chips options={Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label])} value={difficulty} onChange={setDifficulty} />
            </div>
            <div className="field">
              <label>Match time</label>
              <Chips options={[[false, '☀️ Day'], [true, '🌙 Day/Night']]} value={night} onChange={setNight} />
            </div>
          </div>
          <button
            className="btn primary big"
            onClick={() => {
              sound.unlock()
              onTournament({ kind: tKind, teamIds: tLeague.teams.map((t) => t.id), userTeam: tTeam, overs: tOvers, wickets: 10, difficulty, night })
            }}
          >
            {saved ? 'Start new tournament (replaces saved)' : 'Start tournament'} →
          </button>
        </div>
      )}

      <div className="card settings-card">
        <h3>⚙️ Settings</h3>
        <SettingsPanel />
      </div>

      <div className="card howto">
        <h3>How to play</h3>
        <ul>
          <li><b>Batting:</b> aim with the joystick (or <kbd>←</kbd> <kbd>→</kbd>), choose footwork — <kbd>Q</kbd> front foot, <kbd>E</kbd> back foot, <kbd>W</kbd> advance — or leave it to shot assist, then play <kbd>A</kbd> Push, <kbd>S</kbd> Stroke or <kbd>D</kbd> Loft as the ball arrives. Hit the gaps!</li>
          <li><b>Bowling:</b> tap the pitch (or arrows) to place the blue marker, pick a delivery (<kbd>1</kbd>–<kbd>4</kbd>), then <kbd>Space</kbd> to run in and again to release.</li>
          <li><b>DRS:</b> given out LBW or caught behind? Tap <b>REVIEW</b>. Appeal turned down when you bowl? Review it too.</li>
          <li>Fours, sixes and wickets get a TV replay (tap to skip). <kbd>V</kbd> cycles cameras (Broadcast, Behind batter, Pro helmet cam, Bowler end) · <kbd>G</kbd> changes your guard (leg / middle / off stump) before the ball · <kbd>P</kbd> pause.</li>
        </ul>
      </div>

      <div className="card stats">
        <div><span>{stats.played}</span>Played</div>
        <div><span>{stats.won}</span>Won</div>
        <div><span>{stats.highScore}</span>High score</div>
        <div><span>{stats.sixes}</span>Sixes hit</div>
      </div>
    </section>
  )
}
