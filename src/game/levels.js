/** Level / wave definitions for Neon Genesis Space Impact */

export const LEVELS = [
  {
    id: 1,
    name: 'ORBITAL EDGE',
    badgeName: 'Orbital Edge Badge',
    waves: 4,
    enemyHp: 1,
    enemySpeed: 1,
    spawnRate: 1.15,
    boss: true,
    bossName: 'SCOUT OVERSEER',
    bossDifficulty: 1,
    palette: ['#00f0ff', '#4d7cff'],
  },
  {
    id: 2,
    name: 'NEON ASTEROIDS',
    badgeName: 'Asteroid Belt Badge',
    waves: 5,
    enemyHp: 1.2,
    enemySpeed: 1.15,
    spawnRate: 1.0,
    boss: true,
    bossName: 'ASTEROID WARDEN',
    bossDifficulty: 1,
    palette: ['#b8ff3c', '#00f0ff'],
  },
  {
    id: 3,
    name: 'CRIMSON CONVOY',
    badgeName: 'Crimson Convoy Badge',
    waves: 5,
    enemyHp: 1.45,
    enemySpeed: 1.3,
    spawnRate: 0.88,
    boss: true,
    bossName: 'CONVOY DESTROYER',
    bossDifficulty: 2,
    palette: ['#ff2bd6', '#ff8a3d'],
  },
  {
    id: 4,
    name: 'VOID DRIFTERS',
    badgeName: 'Void Drifter Badge',
    waves: 6,
    enemyHp: 1.65,
    enemySpeed: 1.4,
    spawnRate: 0.78,
    boss: true,
    bossName: 'VOID SERAPH',
    bossDifficulty: 2,
    palette: ['#8b5cff', '#00f0ff'],
  },
  {
    id: 5,
    name: 'BASE ZERO',
    badgeName: 'Base Zero Commander',
    waves: 6,
    enemyHp: 2.0,
    enemySpeed: 1.5,
    spawnRate: 0.68,
    boss: true,
    bossName: 'GENESIS CORE',
    bossDifficulty: 3,
    palette: ['#ff2bd6', '#00f0ff', '#b8ff3c'],
  },
];

export function getLevel(n) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, n - 1));
  const base = LEVELS[idx];
  // Endless scaling past final defined level
  if (n > LEVELS.length) {
    const scale = 1 + (n - LEVELS.length) * 0.15;
    return {
      ...LEVELS[LEVELS.length - 1],
      id: n,
      name: `DEEP SPACE ${n}`,
      badgeName: `Deep Space Sector ${n}`,
      waves: 6 + Math.floor((n - LEVELS.length) / 2),
      enemyHp: base.enemyHp * scale,
      enemySpeed: base.enemySpeed * Math.min(2.2, scale),
      spawnRate: Math.max(0.45, base.spawnRate / scale),
      boss: true,
      bossName: `ANOMALY ${n}`,
      bossDifficulty: Math.min(5, 3 + Math.floor((n - LEVELS.length) / 2)),
      palette: base.palette,
    };
  }
  return { ...base };
}
