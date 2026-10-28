/* =========================================================
   Podaci projekta: spratovi, stanovi, rasporedi soba.
   Koordinate su u metrima. Zgrada je 30 × 16 m, hodnik po sredini (z = -1…1).
   Jug (z > 0) gleda na reku, sever (z < 0) na park.
   ========================================================= */

export const PROJECT = {
  name: 'Sava Residence',
  address: 'Savski nasip 12, Beograd',
  move: 'Q4 2027',
  width: 30,
  depth: 16,
  groundH: 4.2,
  floorH: 3.2,
  floors: 11
};

export const TYPES = {
  A: { label: 'Garsonjera', rooms: 0.5, short: '0.5' },
  B: { label: 'Jednoiposoban', rooms: 1.5, short: '1.5' },
  C: { label: 'Dvosoban', rooms: 2.0, short: '2.0' },
  D: { label: 'Trosoban', rooms: 3.0, short: '3.0' },
  E: { label: 'Četvorosoban penthaus', rooms: 4.0, short: '4.0' }
};

// Rasporedi soba: u ide duž fasade (0…1), v od fasade (0) ka hodniku (1)
export const ROOMS = {
  A: [
    { n: 'Dnevni boravak + kuhinja', u: [0, 1], v: [0, .62] },
    { n: 'Kupatilo', u: [0, .5], v: [.62, 1] },
    { n: 'Predsoblje', u: [.5, 1], v: [.62, 1] }
  ],
  B: [
    { n: 'Dnevna + kuhinja', u: [0, .58], v: [0, .6] },
    { n: 'Spavaća soba', u: [.58, 1], v: [0, .6] },
    { n: 'Kupatilo', u: [0, .42], v: [.6, 1] },
    { n: 'Hodnik', u: [.42, 1], v: [.6, 1] }
  ],
  C: [
    { n: 'Dnevna soba', u: [0, .52], v: [0, .6] },
    { n: 'Spavaća soba', u: [.52, 1], v: [0, .6] },
    { n: 'Kupatilo', u: [0, .3], v: [.6, 1] },
    { n: 'Hodnik', u: [.3, .62], v: [.6, 1] },
    { n: 'Kuhinja', u: [.62, 1], v: [.6, 1] }
  ],
  D: [
    { n: 'Dnevna soba', u: [0, .44], v: [0, .6] },
    { n: 'Spavaća 1', u: [.44, .72], v: [0, .6] },
    { n: 'Spavaća 2', u: [.72, 1], v: [0, .6] },
    { n: 'Kuhinja', u: [0, .3], v: [.6, 1] },
    { n: 'Hodnik', u: [.3, .7], v: [.6, 1] },
    { n: 'Kupatilo', u: [.7, 1], v: [.6, 1] }
  ],
  E: [
    { n: 'Dnevna soba', u: [0, .38], v: [0, .6] },
    { n: 'Spavaća 1', u: [.38, .59], v: [0, .6] },
    { n: 'Spavaća 2', u: [.59, .8], v: [0, .6] },
    { n: 'Master', u: [.8, 1], v: [0, .6] },
    { n: 'Kuhinja', u: [0, .26], v: [.6, 1] },
    { n: 'Hodnik', u: [.26, .6], v: [.6, 1] },
    { n: 'Kupatilo', u: [.6, .8], v: [.6, 1] },
    { n: 'Garderober', u: [.8, 1], v: [.6, 1] }
  ]
};

// Raspored stanova po spratu: x0, x1 duž zgrade, strana S (jug) ili N (sever)
const STANDARD = [
  { t: 'D', x: [-15, -4], side: 'S', corner: 'zapad' },
  { t: 'C', x: [-4, 4], side: 'S' },
  { t: 'B', x: [4, 10], side: 'S' },
  { t: 'A', x: [10, 15], side: 'S', corner: 'istok' },
  { t: 'C', x: [-15, -7], side: 'N', corner: 'zapad' },
  { t: 'D', x: [-3, 8], side: 'N' },
  { t: 'B', x: [8, 15], side: 'N', corner: 'istok' }
];
const PENTHOUSE = [
  { t: 'E', x: [-15, 0], side: 'S', corner: 'zapad' },
  { t: 'E', x: [0, 15], side: 'S', corner: 'istok' },
  { t: 'C', x: [-15, -7], side: 'N', corner: 'zapad' },
  { t: 'D', x: [-3, 8], side: 'N' },
  { t: 'B', x: [8, 15], side: 'N', corner: 'istok' }
];
export const CORE = { x: [-7, -3], side: 'N' }; // stepenište + lift

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function floorY(f) {
  return f === 0 ? 0 : PROJECT.groundH + (f - 1) * PROJECT.floorH;
}

export function buildApartments() {
  const r = rng(2027);
  const list = [];
  for (let f = 1; f <= PROJECT.floors; f++) {
    const layout = f >= 10 ? PENTHOUSE : STANDARD;
    layout.forEach((u, i) => {
      const w = u.x[1] - u.x[0];
      const d = 7;
      const area = Math.round(w * d * 0.94 * 10) / 10; // neto
      const terrace = u.side === 'S' ? Math.round((w - 0.6) * 1.6 * 10) / 10 : 0;
      const south = u.side === 'S';
      let ppm = 2450 + f * 45 + (south ? 160 : 0) + (u.corner ? 60 : 0) + (u.t === 'E' ? 900 : 0);
      ppm = Math.round(ppm / 10) * 10;
      const price = Math.round((area * ppm + terrace * ppm * 0.5) / 100) * 100;
      // niži spratovi prodati više
      const roll = r();
      const soldP = 0.62 - f * 0.035;
      const status = roll < soldP ? 'prodat' : roll < soldP + 0.14 ? 'rezervisan' : 'slobodan';
      const orient = (south ? 'Jug · pogled na reku' : 'Sever · park') + (u.corner ? ' + ' + u.corner : '');
      list.push({
        id: `${f}.${String(i + 1).padStart(2, '0')}`,
        floor: f, type: u.t, x: u.x, side: u.side, corner: u.corner || null,
        area, terrace, ppm, price, status, orient,
        rooms: TYPES[u.t].rooms
      });
    });
  }
  return list;
}

export const STATUS = {
  slobodan: { label: 'Slobodan', color: '#2fb67c' },
  rezervisan: { label: 'Rezervisan', color: '#f2a93b' },
  prodat: { label: 'Prodat', color: '#b9b3a8' }
};
