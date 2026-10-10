const crypto = require('crypto');

function rollDice(bet, mode, options) {
  // Mode 1: Classic Craps / Two Dice (1-6 chacun)
  if (mode === 'classic') {
    const die1 = crypto.randomInt(1, 7);
    const die2 = crypto.randomInt(1, 7);
    const sum = die1 + die2;
    const isDouble = die1 === die2;

    const betType = options.betType; // 'seven', 'craps', 'high', 'low', 'double', 'exact'
    const exactTarget = parseInt(options.targetSum) || 7;

    let won = false;
    let multiplier = 0;

    switch (betType) {
      case 'seven':
        if (sum === 7) { won = true; multiplier = 4; }
        break;
      case 'craps':
        if ([2, 3, 12].includes(sum)) { won = true; multiplier = 5; }
        break;
      case 'high':
        if (sum >= 8 && sum <= 12) { won = true; multiplier = 2; }
        break;
      case 'low':
        if (sum >= 2 && sum <= 6) { won = true; multiplier = 2; }
        break;
      case 'double':
        if (isDouble) { won = true; multiplier = 6; }
        break;
      case 'exact':
        if (sum === exactTarget) {
          won = true;
          // Multiplicateurs basés sur les probabilités réelles (36 combinaisons au total)
          const combos = { 2: 30, 3: 15, 4: 10, 5: 8, 6: 6, 7: 5, 8: 6, 9: 8, 10: 10, 11: 15, 12: 30 };
          multiplier = combos[exactTarget] || 5;
        }
        break;
      default:
        break;
    }

    const payout = won ? bet * multiplier : 0;

    return {
      mode: 'classic',
      die1,
      die2,
      sum,
      isDouble,
      betType,
      won,
      multiplier,
      payout,
      profit: payout - bet
    };
  }

  // Mode 2: Over / Under curseur 1-100
  if (mode === 'over_under') {
    const roll = Number((crypto.randomInt(100, 10001) / 100).toFixed(2)); // 1.00 à 100.00
    const condition = options.condition; // 'over' ou 'under'
    const target = Math.max(2, Math.min(98, parseFloat(options.target) || 50));

    let winChance = 0;
    if (condition === 'over') {
      winChance = 100 - target;
    } else {
      winChance = target;
    }

    // RTP ~ 97%
    const multiplier = Number(((97 / winChance)).toFixed(2));

    const won = condition === 'over' ? roll > target : roll < target;
    const payout = won ? Math.floor(bet * multiplier) : 0;

    return {
      mode: 'over_under',
      roll,
      condition,
      target,
      multiplier,
      winChance,
      won,
      payout,
      profit: payout - bet
    };
  }

  throw new Error('Mode de dés inconnu');
}

module.exports = {
  rollDice
};
