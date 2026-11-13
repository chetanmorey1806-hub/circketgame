import { useState } from 'react'
import ChallengesScreen from './components/ChallengesScreen.jsx'
import Home from './components/Home.jsx'
import MainMenu from './components/MainMenu.jsx'
import Match from './components/Match.jsx'
import Result from './components/Result.jsx'
import Splash from './components/Splash.jsx'
import SquadSelect from './components/SquadSelect.jsx'
import TitleScreen from './components/TitleScreen.jsx'
import Toss from './components/Toss.jsx'
import TournamentHub from './components/TournamentHub.jsx'
import { saveStars, starsFor } from './game/challenges.js'
import { FORMATS, matchResult } from './game/engine.js'
import { LEAGUES, teamInfo } from './game/leagues.js'
import { getSquad } from './game/squads.js'
import { recordMatch } from './game/storage.js'
import { TOURNAMENTS, clear as clearTournament, createTournament, recordUserMatch, simulateUntilUser } from './game/tournament.js'

function goFullscreenOnPhones() {
  // on phones, go full screen in landscape like a native game (needs a tap as the user gesture)
  if (window.matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {})
  }
}

// Main-menu tiles → setup presets
const PRESETS = {
  quick: { mode: 'quick' },
  worldcup: { mode: 'tournament', tKind: 'worldcup' },
  ipl: { mode: 'tournament', tKind: 'ipl' },
  test: { mode: 'quick', league: 'intl', format: 'test' },
  superover: { mode: 'quick', format: 'custom', overs: 1, wickets: 2, title: 'SUPER OVER' },
  nets: { mode: 'quick', format: 'custom', overs: 2, wickets: 10, title: 'NETS PRACTICE', practice: true },
}

const fullTeam = (id) => ({ ...teamInfo(id), xi: getSquad(id).slice(0, 11) })

export default function App() {
  const [splash, setSplash] = useState(true)
  const [screen, setScreen] = useState('title')
  const [backdrop, setBackdrop] = useState(null)
  const [preset, setPreset] = useState(PRESETS.quick)
  const [settings, setSettings] = useState(null) // match settings; teams carry `xi` after selection
  const [battingFirst, setBattingFirst] = useState(null) // 'user' | 'cpu'
  const [innings, setInnings] = useState(null)
  const [matchKey, setMatchKey] = useState(0)
  const [tournament, setTournament] = useState(null)
  const [fixture, setFixture] = useState(null)
  const [challengeStars, setChallengeStars] = useState(null)

  if (splash) return <Splash onDone={() => setSplash(false)} />
  if (screen === 'title') {
    return (
      <TitleScreen
        onStart={(shot) => {
          setBackdrop(shot)
          goFullscreenOnPhones()
          setScreen('menu')
        }}
      />
    )
  }

  const startMatch = (s, who) => {
    setSettings(s)
    setBattingFirst(who)
    setMatchKey((k) => k + 1)
    setScreen('match')
  }

  const playFixture = (t, f) => {
    const userIsHome = f.home === t.userTeam
    const opp = userIsHome ? f.away : f.home
    const league = LEAGUES[TOURNAMENTS[t.kind].league]
    const fmt = t.overs >= 50 ? FORMATS.odi : t.overs >= 20 ? FORMATS.t20 : { ...FORMATS.custom, overs: t.overs }
    setFixture(f)
    setSettings({
      user: { ...teamInfo(t.userTeam), xi: t.userXI ? getSquad(t.userTeam).filter((p) => t.userXI.includes(p.id)).sort((a, b) => t.userXI.indexOf(a.id) - t.userXI.indexOf(b.id)) : undefined },
      cpu: teamInfo(opp),
      overs: t.overs,
      wickets: t.wickets,
      difficulty: t.difficulty,
      night: f.stage === 'final' ? true : t.night,
      venue: league.venues[(t.fixtures.indexOf(f) * 3) % league.venues.length],
      format: fmt,
      leagueName: `${t.name} · ${f.stage === 'league' ? 'League' : f.stage === 'semi' ? 'Semi-final' : 'FINAL'}`,
    })
    setScreen('squad')
  }

  const playChallenge = (c) => {
    setTournament(null)
    setFixture(null)
    setChallengeStars(null)
    goFullscreenOnPhones()
    startMatch(
      {
        user: fullTeam(c.user),
        cpu: fullTeam(c.cpu),
        overs: c.overs,
        wickets: c.wickets,
        difficulty: 'medium',
        venue: c.venue,
        night: c.night,
        format: { ...FORMATS.custom, reviews: 1 },
        leagueName: `CHALLENGE · ${c.title}`,
        challenge: c,
      },
      c.kind === 'chase' ? 'user' : 'cpu',
    )
  }

  const toMenu = () => setScreen('menu')

  return (
    <div className="app">
      {screen !== 'menu' && (
        <header className="topbar">
          <button className="brand" onClick={toMenu}>
            <span className="brand-ball" /> Cricket Clash
          </button>
          {settings?.user.xi && !['home', 'challenges', 'hub'].includes(screen) && (
            <span className="topbar-match">
              {settings.user.name} vs {settings.cpu.name} · {settings.format?.name === 'Test' ? 'Test' : `${settings.overs} ov`}
            </span>
          )}
        </header>
      )}

      {screen === 'menu' && (
        <MainMenu
          backdrop={backdrop}
          onPick={(id) => {
            if (id === 'challenges') return setScreen('challenges')
            setPreset(PRESETS[id])
            setScreen('home')
          }}
          onContinue={(t) => {
            setTournament(t)
            setScreen('hub')
          }}
        />
      )}

      <main className="content">
        {screen === 'home' && (
          <Home
            key={JSON.stringify(preset)}
            preset={preset}
            onBack={toMenu}
            onStart={(s) => {
              setTournament(null)
              setFixture(null)
              setSettings({ ...s, practice: !!preset.practice, ...(preset.practice ? { overs: 99, wickets: 10 } : {}) })
              setScreen('squad')
            }}
            onTournament={(opts) => {
              const t = simulateUntilUser(createTournament(opts))
              setTournament({ ...t })
              setScreen('hub')
            }}
            onContinueTournament={(t) => {
              setTournament(t)
              setScreen('hub')
            }}
          />
        )}
        {screen === 'challenges' && <ChallengesScreen onPlay={playChallenge} onBack={toMenu} />}
        {screen === 'hub' && tournament && (
          <TournamentHub
            t={tournament}
            onPlay={(f) => playFixture(tournament, f)}
            onHome={toMenu}
            onUpdate={setTournament}
            onAbandon={() => {
              clearTournament()
              setTournament(null)
              toMenu()
            }}
          />
        )}
        {screen === 'squad' && (
          <SquadSelect
            settings={settings}
            initialXI={settings.user.xi}
            onBack={() => setScreen(tournament ? 'hub' : 'home')}
            onConfirm={(userXI, cpuXI) => {
              const s = { ...settings, user: { ...settings.user, xi: userXI }, cpu: { ...settings.cpu, xi: cpuXI } }
              if (tournament) setTournament((t) => ({ ...t, userXI: userXI.map((p) => p.id) }))
              if (s.practice) {
                // nets: no toss, you bat
                goFullscreenOnPhones()
                return startMatch(s, 'user')
              }
              setSettings(s)
              setScreen('toss')
            }}
          />
        )}
        {screen === 'toss' && (
          <Toss
            settings={settings}
            onDone={(who) => {
              goFullscreenOnPhones()
              startMatch(settings, who)
            }}
          />
        )}
        {screen === 'match' && (
          <Match
            key={matchKey}
            settings={settings}
            battingFirst={battingFirst}
            onFinish={(inns) => {
              if (!settings.practice) recordMatch(matchResult(inns, settings.wickets, settings.user.id))
              if (tournament && fixture) setTournament({ ...recordUserMatch(tournament, fixture.id, inns, settings.wickets) })
              if (settings.challenge) {
                const stars = starsFor(settings.challenge, inns)
                saveStars(settings.challenge.id, stars)
                setChallengeStars(stars)
              }
              setInnings(inns)
              setScreen('result')
            }}
            onQuit={() => setScreen(tournament ? 'hub' : settings.challenge ? 'challenges' : 'menu')}
          />
        )}
        {screen === 'result' && (
          <Result
            settings={settings}
            innings={innings}
            challengeStars={settings.challenge ? challengeStars : null}
            onRematch={tournament ? null : settings.challenge ? () => playChallenge(settings.challenge) : () => setScreen('toss')}
            onChangeXI={tournament || settings.challenge ? null : () => setScreen('squad')}
            onTournament={tournament ? () => setScreen('hub') : null}
            onChallenges={settings.challenge ? () => setScreen('challenges') : null}
            onHome={toMenu}
          />
        )}
      </main>
    </div>
  )
}
