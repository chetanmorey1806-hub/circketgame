import { useEffect, useRef } from 'react'
import { sound } from '../audio/sound.js'
import { fieldersOf, keeperOf, newInnings, setBowler } from '../game/engine.js'
import { teamInfo } from '../game/leagues.js'
import { getSquad } from '../game/squads.js'
import { World } from '../three/World.js'
import InstallButton from './InstallButton.jsx'

const team = (id) => ({ ...teamInfo(id), xi: getSquad(id).slice(0, 11) })

/** "Tap to start": the game logo over a live 3D stadium with a star batter. */
export default function TitleScreen({ onStart }) {
  const host = useRef(null)
  const worldRef = useRef(null)

  useEffect(() => {
    const home = team('IND')
    const away = team('AUS')
    const world = new World(host.current, { night: true, venue: 'Narendra Modi Stadium, Ahmedabad', teamColors: [home.colors.primary, away.colors.primary], quality: 'low' })
    worldRef.current = world
    const inn = setBowler(newInnings(home, away), away.xi[9].id)
    world.setLineup({
      battingTeam: home,
      bowlingTeam: away,
      striker: home.xi[2], // the star batter
      nonStriker: home.xi[0],
      bowler: away.xi[9],
      keeper: keeperOf(away),
      fielders: fieldersOf(inn),
    })
    world.heroShow()
    return () => world.dispose()
  }, [])

  const start = () => {
    sound.unlock()
    sound.startCrowd()
    sound.sfx('roar', 0.7)
    const shot = worldRef.current?.snapshot()
    onStart(shot)
  }

  return (
    <div className="title-screen" onClick={start} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && start()}>
      <div className="gl-host" ref={host} />
      <div className="title-vignette" />
      <div className="title-logo">
        <span className="tl-studio">CHETAN PRODUCTION</span>
        <h1>
          <span className="tl-cricket">CRICKET</span>
          <span className="tl-clash">CLASH</span>
        </h1>
        <span className="tl-tag">3D · T20 · ONE DAY · TEST · WORLD CUP</span>
      </div>
      <div className="title-bottom">
        <span className="tap">TAP TO START</span>
        <InstallButton />
      </div>
      <span className="title-version">v1.0 · © Chetan Production</span>
    </div>
  )
}
