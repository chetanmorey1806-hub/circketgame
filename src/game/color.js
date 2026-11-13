// Tiny colour helpers for kits and crests.
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => clamp(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Readable text colour on top of `hex`. */
export function ink(hex) {
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#111' : '#fff'
}
