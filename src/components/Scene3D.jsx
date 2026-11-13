import { useEffect, useRef } from 'react'
import { World } from '../three/World.js'
import { getQuality } from '../three/quality.js'

/** Mounts the Three.js world and lays the broadcast HUD / touch controls over it. */
export default function Scene3D({ night, venue, teamColors, whites = false, onWorld, children }) {
  const host = useRef(null)

  useEffect(() => {
    const world = new World(host.current, { night, venue, teamColors, whites, quality: getQuality() })
    onWorld(world)
    window.__cricketWorld = world // handy for debugging in the console
    return () => {
      onWorld(null)
      world.dispose()
    }
    // the world is built once per match; settings don't change mid-match
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scene3d">
      <div className="gl-host" ref={host} />
      {children}
    </div>
  )
}
