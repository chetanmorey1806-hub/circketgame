// Graphics quality presets (stored per device).
const KEY = 'cricket-clash-gfx'

export const QUALITY = {
  low: { pixelRatio: 1, shadows: 1024, shadowType: 'basic', fill: false, bloom: false, crowdDensity: 0.6 },
  medium: { pixelRatio: 1.5, shadows: 2048, shadowType: 'soft', fill: true, bloom: false, crowdDensity: 1 },
  high: { pixelRatio: 2, shadows: 4096, shadowType: 'soft', fill: true, bloom: true, crowdDensity: 1 },
}

export function getQuality() {
  try {
    const q = localStorage.getItem(KEY)
    if (q && QUALITY[q]) return q
  } catch {
    /* fall through */
  }
  // phones default to medium, laptops/desktops to HD
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'medium' : 'high'
}

export function setQuality(q) {
  try {
    localStorage.setItem(KEY, q)
  } catch {
    /* not saved */
  }
}
