const crypto = require('crypto');

const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Facile',
    badge: '🟢 Facile (4 cases)',
    tilesPerFloor: 4,
    trapsPerFloor: 1,
    multipliers: [1.26, 1.68, 2.24, 2.98, 3.98, 5.30, 7.07, 9.43, 12.58]
  },
  medium: {
    id: 'medium',
    name: 'Moyen',
    badge: '🟡 Moyen (3 cases)',
    tilesPerFloor: 3,
    trapsPerFloor: 1,
    multipliers: [1.41, 2.12, 3.19, 4.78, 7.18, 10.76, 16.14, 24.22, 36.33]
  },
  hard: {
    id: 'hard',
    name: 'Difficile',
    badge: '🔴 Difficile (2 cases)',
    tilesPerFloor: 2,
    trapsPerFloor: 1,
    multipliers: [1.89, 3.78, 7.56, 15.12, 30.24, 60.48, 120.96, 241.92, 483.84]
  }
};

const TOTAL_FLOORS = 9;

/**
 * Génère un plateau précalculé équitable et sécurisé pour les 9 étages
 * Chaque étage a un piège (œuf de dragon) placé aléatoirement.
 * @param {string} diffKey 'easy' | 'medium' | 'hard'
 * @returns {Array<number>} index du piège pour chacun des 9 étages
 */
function generateTraps(diffKey) {
  const diff = DIFFICULTIES[diffKey] || DIFFICULTIES.medium;
  const traps = [];
  for (let f = 0; f < TOTAL_FLOORS; f++) {
    const trapIndex = crypto.randomInt(0, diff.tilesPerFloor);
    traps.push(trapIndex);
  }
  return traps;
}

module.exports = {
  DIFFICULTIES,
  TOTAL_FLOORS,
  generateTraps
};
