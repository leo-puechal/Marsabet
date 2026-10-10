const crypto = require('crypto');

/**
 * Moteur de calcul pour le jeu Crash (Fusée Cosmique Marsabet)
 * RTP fixé à 96% (Formule standard de l'industrie)
 */
function generateCrashPoint() {
  // 3% de chance de crash instantané à 1.00x (House Edge)
  const instant = crypto.randomInt(0, 100);
  if (instant < 3) {
    return 1.00;
  }

  // Distribution inverse continue
  const rand = (crypto.randomInt(1, 1000000)) / 1000000;
  const rawPoint = 0.96 / (1 - rand);
  const clamped = Math.min(250.00, Math.max(1.01, rawPoint));
  return Number(clamped.toFixed(2));
}

module.exports = {
  generateCrashPoint
};
