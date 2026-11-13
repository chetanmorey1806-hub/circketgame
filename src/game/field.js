// Ground layout in metres. The pitch runs along z: the striker's stumps are at +z, the bowler's at -z.
// For a right-handed batter the off side is +x. Shot angles are measured from the striker:
// 0° = straight back past the bowler, +90° = square on the off side (point), -90° = square leg.

export const STUMPS_Z = 10.06
export const CREASE_Z = 8.84
export const STRIKER_Z = 8.7
export const BOUNDARY = 64

export const FIELD = [
  { name: 'Point', x: 23, z: 6 },
  { name: 'Cover', x: 21, z: -9 },
  { name: 'Mid-off', x: 9, z: -21 },
  { name: 'Long-off', x: 24, z: -55 },
  { name: 'Mid-on', x: -9, z: -21 },
  { name: 'Deep mid-wicket', x: -47, z: -20 },
  { name: 'Square leg', x: -23, z: 9 },
  { name: 'Fine leg', x: -30, z: 50 },
  { name: 'Third man', x: 33, z: 49 },
]
export const KEEPER = { x: 0.4, z: 12.6 }

const RAD = Math.PI / 180

/** Angle (deg) of a ground point as seen from the striker. */
export const angleFromStriker = (x, z) => Math.atan2(x, -(z - STRIKER_Z)) / RAD
export const distFromStriker = (x, z) => Math.hypot(x, z - STRIKER_Z)

/** Ground point at angle/distance from the striker. */
export const pointFrom = (deg, dist) => ({ x: Math.sin(deg * RAD) * dist, z: STRIKER_Z - Math.cos(deg * RAD) * dist })

/** Distance from the striker to the boundary rope along an angle. */
export function boundaryDist(deg) {
  const dz = -Math.cos(deg * RAD)
  // |S + t·d| = BOUNDARY with S = (0, STRIKER_Z)
  const b = STRIKER_Z * dz
  const c = STRIKER_Z * STRIKER_Z - BOUNDARY * BOUNDARY
  return -b + Math.sqrt(b * b - c)
}

export const FIELD_ANGLES = FIELD.map((f) => ({ ...f, angle: angleFromStriker(f.x, f.z), dist: distFromStriker(f.x, f.z) }))

/** Fielder (index) whose angle is closest to `deg`, with the angular gap. */
export function nearestFielder(deg, filter = () => true) {
  let best = null
  FIELD_ANGLES.forEach((f, i) => {
    if (!filter(f)) return
    const gap = Math.abs(((deg - f.angle + 540) % 360) - 180)
    if (!best || gap < best.gap) best = { index: i, gap, ...f }
  })
  return best
}

// Names for the shot-direction joystick (RH batter).
const ZONES = [
  [-181, -115, 'Fine leg'], [-115, -75, 'Square leg'], [-75, -35, 'Mid-wicket'], [-35, -10, 'Mid-on'],
  [-10, 10, 'Straight'], [10, 35, 'Mid-off'], [35, 70, 'Cover'], [70, 115, 'Point'], [115, 181, 'Third man'],
]
export const zoneName = (deg) => (ZONES.find(([a, b]) => deg >= a && deg < b) ?? ZONES[4])[2]
