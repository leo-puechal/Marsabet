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

/**
 * Formule standard d'accélération du multiplicateur Marsabet
 * M(t) = 1.00 + (t * 0.10) + (t * 0.22)^2.1
 */
function getMultiplierAtTime(elapsedSec) {
  if (elapsedSec <= 0) return 1.00;
  const raw = 1.00 + (elapsedSec * 0.10) + Math.pow(elapsedSec * 0.22, 2.1);
  return Number(raw.toFixed(2));
}

/**
 * Calcule la durée exacte en secondes pour atteindre un multiplicateur donné
 */
function getDurationForMultiplier(targetMultiplier) {
  if (targetMultiplier <= 1.00) return 0;
  let low = 0;
  let high = 120; // 120s est largement supérieur à 250x
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const m = 1.00 + (mid * 0.10) + Math.pow(mid * 0.22, 2.1);
    if (m < targetMultiplier) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

module.exports = {
  generateCrashPoint,
  getMultiplierAtTime,
  getDurationForMultiplier
};
