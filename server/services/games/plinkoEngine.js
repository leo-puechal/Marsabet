const crypto = require('crypto');

const PLINKO_ROWS = 12;

const MULTIPLIERS = {
  low: [8.0, 4.0, 2.0, 1.4, 1.1, 0.8, 0.6, 0.8, 1.1, 1.4, 2.0, 4.0, 8.0],
  medium: [24.0, 10.0, 4.0, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4.0, 10.0, 24.0],
  high: [50.0, 20.0, 7.0, 2.5, 0.6, 0.2, 0.0, 0.2, 0.6, 2.5, 7.0, 20.0, 50.0]
};

function dropPlinko(bet, risk = 'medium') {
  const selectedRisk = MULTIPLIERS[risk] ? risk : 'medium';
  const rowMultipliers = MULTIPLIERS[selectedRisk];

  // Générer la suite de rebonds (0 = gauche, 1 = droite)
  const path = [];
  let rightSteps = 0;

  for (let r = 0; r < PLINKO_ROWS; r++) {
    // 50/50 tirage équitable
    const dir = crypto.randomInt(0, 2);
    path.push(dir);
    if (dir === 1) rightSteps++;
  }

  // L'indice du panier correspond au nombre total de déviations à droite
  const bucketIndex = rightSteps;
  const multiplier = rowMultipliers[bucketIndex];
  const payout = Math.floor(bet * multiplier);

  return {
    risk: selectedRisk,
    rows: PLINKO_ROWS,
    path, // Array de 12 entiers (0 ou 1)
    bucketIndex,
    multiplier,
    payout,
    profit: payout - bet,
    multipliers: rowMultipliers
  };
}

module.exports = {
  dropPlinko,
  MULTIPLIERS,
  PLINKO_ROWS
};
