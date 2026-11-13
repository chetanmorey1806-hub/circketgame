// What each ground looks like. style: bowl | modern | heritage | open | desert
// seats: seat colours showing through the crowd; extras add landmarks.
const VENUES = {
  'Narendra Modi Stadium, Ahmedabad': { style: 'bowl', tiers: 3, seats: ['#1d4fa8', '#e8edf5'], roof: 'ring', lights: 'roof', capacity: 'huge' },
  'Melbourne Cricket Ground': { style: 'bowl', tiers: 3, seats: ['#c9a227', '#1b2c55'], roof: 'ring', lights: 'towers6', capacity: 'huge' },
  'Eden Gardens, Kolkata': { style: 'bowl', tiers: 2, seats: ['#2a6fd1', '#e9eef3'], roof: 'ring', lights: 'towers', capacity: 'huge' },
  "Lord's, London": { style: 'heritage', tiers: 1, seats: ['#2a6b3a', '#f2f2f2'], roof: 'none', lights: 'none', extras: ['pavilion', 'mediaCentre', 'trees'] },
  'Wankhede Stadium, Mumbai': { style: 'modern', tiers: 2, seats: ['#1f5fbf', '#d9e3f0'], roof: 'cantilever', lights: 'towers' },
  'MA Chidambaram Stadium, Chennai': { style: 'modern', tiers: 2, seats: ['#f2c200', '#e9eef3'], roof: 'cantilever', lights: 'towers' },
  'M Chinnaswamy Stadium, Bengaluru': { style: 'modern', tiers: 2, seats: ['#c62828', '#e9eef3'], roof: 'cantilever', lights: 'towers' },
  'Rajiv Gandhi Intl. Stadium, Hyderabad': { style: 'modern', tiers: 2, seats: ['#ef7b25', '#e9eef3'], roof: 'cantilever', lights: 'towers' },
  'Sawai Mansingh Stadium, Jaipur': { style: 'heritage', tiers: 1, seats: ['#e46aa1', '#f6e3c8'], roof: 'none', lights: 'towers', extras: ['pavilion', 'trees'] },
  'Arun Jaitley Stadium, Delhi': { style: 'modern', tiers: 2, seats: ['#1d4fa8', '#d32f2f'], roof: 'cantilever', lights: 'towers' },
  'Dubai International Stadium': { style: 'desert', tiers: 1, seats: ['#d8c39a', '#f1e6cf'], roof: 'ring', lights: 'ringOfFire' },
  'Newlands, Cape Town': { style: 'open', tiers: 1, seats: ['#2e7d4f', '#f2f2f2'], roof: 'none', lights: 'towers', extras: ['mountain', 'grassBank', 'trees'] },
  'Kensington Oval, Barbados': { style: 'open', tiers: 1, seats: ['#00a3c4', '#ffd23f'], roof: 'none', lights: 'towers', extras: ['palms', 'grassBank'] },
  'Gaddafi Stadium, Lahore': { style: 'modern', tiers: 2, seats: ['#0f7b3f', '#e9eef3'], roof: 'cantilever', lights: 'towers' },
  'Eden Park, Auckland': { style: 'open', tiers: 2, seats: ['#15171c', '#e9eef3'], roof: 'none', lights: 'towers', extras: ['grassBank'] },
}

export function venueStyle(name) {
  return VENUES[name] ?? { style: 'modern', tiers: 2, seats: ['#2a5db0', '#e9eef3'], roof: 'cantilever', lights: 'towers' }
}
