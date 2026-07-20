const BASE_KEY = 'space-impact-neon:v2';

const DEFAULTS = {
  highScore: 0,
  bestLevel: 1,
  bestCombo: 1,
  runs: 0,
  difficulty: 'pilot', // rookie | pilot | ace
  autoFire: true,
};

let activeUserId = null;

export function setStorageUser(uid) {
  activeUserId = uid || null;
}

function storageKey() {
  return activeUserId ? `${BASE_KEY}:user:${activeUserId}` : BASE_KEY;
}

export function loadMeta() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(storageKey()) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveMeta(partial) {
  const next = { ...loadMeta(), ...partial };
  localStorage.setItem(storageKey(), JSON.stringify(next));
  return next;
}

export function recordRun({ score, level, maxCombo }) {
  const m = loadMeta();
  const next = {
    runs: (m.runs || 0) + 1,
    highScore: Math.max(m.highScore || 0, score || 0),
    bestLevel: Math.max(m.bestLevel || 1, level || 1),
    bestCombo: Math.max(m.bestCombo || 1, maxCombo || 1),
  };
  return saveMeta(next);
}

export const DIFFICULTY = {
  rookie: {
    id: 'rookie',
    label: 'ROOKIE',
    desc: 'Extra life · softer enemies · more powerups',
    enemyHp: 0.8,
    enemySpeed: 0.88,
    spawnRate: 1.15,
    playerLives: 4,
    powerupChance: 0.28,
    scoreMul: 0.75,
    bombCharges: 3,
  },
  pilot: {
    id: 'pilot',
    label: 'PILOT',
    desc: 'Balanced neon combat',
    enemyHp: 1,
    enemySpeed: 1,
    spawnRate: 1,
    playerLives: 3,
    powerupChance: 0.18,
    scoreMul: 1,
    bombCharges: 2,
  },
  ace: {
    id: 'ace',
    label: 'ACE',
    desc: 'Brutal bosses · fewer drops · high score glory',
    enemyHp: 1.35,
    enemySpeed: 1.22,
    spawnRate: 0.82,
    playerLives: 2,
    powerupChance: 0.12,
    scoreMul: 1.5,
    bombCharges: 1,
  },
};
