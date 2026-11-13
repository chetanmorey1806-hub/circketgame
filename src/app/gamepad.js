import { useEffect, useState } from 'react'

// Standard gamepad layout (Xbox / PlayStation via the browser Gamepad API).
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }

/**
 * Polls the first connected controller every frame.
 * handlersRef.current = { button(index), stick(x, y, dt) } — kept fresh by the caller on every render.
 */
export function useGamepad(handlersRef) {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    let raf = 0
    let prev = []
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gp = [...(navigator.getGamepads?.() ?? [])].find(Boolean)
      setConnected((c) => (c === !!gp ? c : !!gp))
      if (gp) {
        const h = handlersRef.current
        gp.buttons.forEach((b, i) => {
          if (b.pressed && !prev[i]) h.button?.(i)
        })
        prev = gp.buttons.map((b) => b.pressed)
        const x = gp.axes[0] ?? 0
        const y = gp.axes[1] ?? 0
        if (Math.hypot(x, y) > 0.25) h.stick?.(x, y, dt)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [handlersRef])
  return connected
}
