const crypto = require('crypto');

/**
 * Moteur de calcul pour le jeu Slider (Curseur Cosmique)
 * RTP fixé à 97% (Standard Casino en ligne)
 */
function playSlider(bet, target, condition = 'under') {
  const lineBet = Math.max(1, Math.floor(bet));
  const cleanTarget = Math.max(2, Math.min(98, parseFloat(target) || 50));
  const cond = condition === 'over' ? 'over' : 'under';

  // Tirage cryptographique de haute précision entre 0.00 et 100.00
  const roll = Number((crypto.randomInt(0, 10001) / 100).toFixed(2));

  let winChance = cond === 'under' ? cleanTarget : (100 - cleanTarget);
  winChance = Math.max(1, Math.min(99, winChance));

  // Multiplicateur basé sur 97% RTP
  const multiplier = Number((97 / winChance).toFixed(2));

  const won = cond === 'under' ? roll < cleanTarget : roll > cleanTarget;
  const payout = won ? Math.floor(lineBet * multiplier) : 0;
  const profit = payout - lineBet;

  return {
    game: 'slider',
    roll,
    target: cleanTarget,
    condition: cond,
    winChance: Number(winChance.toFixed(2)),
    multiplier,
    won,
    isWin: won,
    payout,
    profit
  };
}

module.exports = {
  playSlider
};
