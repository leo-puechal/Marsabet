const crypto = require('crypto');

const FREE_WHEEL_SEGMENTS = [
  { index: 0, coins: 50, label: '50 🪙', color: '#1E3A8A', text: '50 Coins' },
  { index: 1, coins: 150, label: '150 🪙', color: '#0D9488', text: '150 Coins' },
  { index: 2, coins: 100, label: '100 🪙', color: '#3B82F6', text: '100 Coins' },
  { index: 3, coins: 350, label: '350 🪙', color: '#8B5CF6', text: '350 Coins' },
  { index: 4, coins: 200, label: '200 🪙', color: '#10B981', text: '200 Coins' },
  { index: 5, coins: 500, label: '⭐ 500 🪙', color: '#F59E0B', text: 'Super Lot 500 Coins' },
  { index: 6, coins: 75, label: '75 🪙', color: '#1E3A8A', text: '75 Coins' },
  { index: 7, coins: 250, label: '250 🪙', color: '#06B6D4', text: '250 Coins' },
  { index: 8, coins: 125, label: '125 🪙', color: '#3B82F6', text: '125 Coins' },
  { index: 9, coins: 1000, label: '👑 1 000 🪙', color: '#D4AF37', text: 'Jackpot Quotidien 1000 Coins' },
  { index: 10, coins: 300, label: '300 🪙', color: '#8B5CF6', text: '300 Coins' },
  { index: 11, coins: 750, label: '🔥 750 🪙', color: '#EF4444', text: 'Méga Gain 750 Coins' }
];

// Poids de probabilité
const SEGMENT_WEIGHTS = [
  25, // 0: 50
  18, // 1: 150
  22, // 2: 100
  10, // 3: 350
  15, // 4: 200
  6,  // 5: 500
  20, // 6: 75
  12, // 7: 250
  16, // 8: 125
  2,  // 9: 1000
  11, // 10: 300
  4   // 11: 750
];

const WEIGHTED_POOL = [];
SEGMENT_WEIGHTS.forEach((weight, segIdx) => {
  for (let i = 0; i < weight; i++) {
    WEIGHTED_POOL.push(segIdx);
  }
});

function spinFreeWheel(streak = 1, vipMultiplier = 1.0) {
  const poolIndex = crypto.randomInt(0, WEIGHTED_POOL.length);
  const winningSegmentIndex = WEIGHTED_POOL[poolIndex];
  const segment = FREE_WHEEL_SEGMENTS[winningSegmentIndex];

  // Bonus de streak (+10% par jour de streak consécutif, max 7 jours = +70%)
  const streakBonusPercent = Math.min(Math.max(streak - 1, 0) * 10, 70);
  const streakMultiplier = 1 + (streakBonusPercent / 100);

  // Gain final combinant streak et rang VIP
  const baseCoins = segment.coins;
  const finalCoins = Math.round(baseCoins * streakMultiplier * vipMultiplier);

  const segmentAngle = 360 / FREE_WHEEL_SEGMENTS.length; // 30 degrés par segment
  const centerAngle = (winningSegmentIndex * segmentAngle) + (segmentAngle / 2);

  return {
    segmentIndex: winningSegmentIndex,
    segment,
    baseCoins,
    finalCoins,
    streak,
    streakBonusPercent,
    vipMultiplier,
    segmentAngle,
    targetAngle: centerAngle,
    allSegments: FREE_WHEEL_SEGMENTS
  };
}

module.exports = {
  spinFreeWheel,
  FREE_WHEEL_SEGMENTS
};
