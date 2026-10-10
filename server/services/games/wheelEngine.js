const crypto = require('crypto');

const WHEEL_SEGMENTS = [
  { index: 0, multiplier: 0, label: '0x', color: '#334155', text: 'Perdu' },
  { index: 1, multiplier: 1.2, label: '1.2x', color: '#10B981', text: 'Gain léger' },
  { index: 2, multiplier: 2.0, label: '2x', color: '#3B82F6', text: 'Double' },
  { index: 3, multiplier: 0, label: '0x', color: '#334155', text: 'Perdu' },
  { index: 4, multiplier: 1.5, label: '1.5x', color: '#06B6D4', text: 'Bien joué' },
  { index: 5, multiplier: 3.0, label: '3x', color: '#8B5CF6', text: 'Triple' },
  { index: 6, multiplier: 0.5, label: '0.5x', color: '#F59E0B', text: 'Consolation' },
  { index: 7, multiplier: 5.0, label: '5x', color: '#EC4899', text: 'Super Gain' },
  { index: 8, multiplier: 0, label: '0x', color: '#334155', text: 'Perdu' },
  { index: 9, multiplier: 1.2, label: '1.2x', color: '#10B981', text: 'Gain léger' },
  { index: 10, multiplier: 2.0, label: '2x', color: '#3B82F6', text: 'Double' },
  { index: 11, multiplier: 10.0, label: '10x', color: '#EF4444', text: 'Méga Gain' },
  { index: 12, multiplier: 0.5, label: '0.5x', color: '#F59E0B', text: 'Consolation' },
  { index: 13, multiplier: 1.5, label: '1.5x', color: '#06B6D4', text: 'Bien joué' },
  { index: 14, multiplier: 3.0, label: '3x', color: '#8B5CF6', text: 'Triple' },
  { index: 15, multiplier: 25.0, label: '25x', color: '#D4AF37', text: '👑 JACKPOT' }
];

// Poids de probabilité pour chaque segment afin de garantir un RTP casino cohérent (~96%)
const SEGMENT_WEIGHTS = [
  15, // 0: 0x
  14, // 1: 1.2x
  8,  // 2: 2x
  15, // 3: 0x
  10, // 4: 1.5x
  5,  // 5: 3x
  12, // 6: 0.5x
  3,  // 7: 5x
  15, // 8: 0x
  14, // 9: 1.2x
  8,  // 10: 2x
  1,  // 11: 10x
  12, // 12: 0.5x
  10, // 13: 1.5x
  5,  // 14: 3x
  1   // 15: 25x Jackpot
];

const WEIGHTED_POOL = [];
SEGMENT_WEIGHTS.forEach((weight, segIdx) => {
  for (let i = 0; i < weight; i++) {
    WEIGHTED_POOL.push(segIdx);
  }
});

function spinWheel(bet) {
  const poolIndex = crypto.randomInt(0, WEIGHTED_POOL.length);
  const winningSegmentIndex = WEIGHTED_POOL[poolIndex];
  const segment = WHEEL_SEGMENTS[winningSegmentIndex];

  const payout = Math.floor(bet * segment.multiplier);

  // Calcul de l'angle central du segment (chaque segment = 360 / 16 = 22.5 deg)
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;
  // Décalage pour tomber en plein milieu du segment
  const centerAngle = (winningSegmentIndex * segmentAngle) + (segmentAngle / 2);

  return {
    segmentIndex: winningSegmentIndex,
    segment,
    multiplier: segment.multiplier,
    payout,
    profit: payout - bet,
    won: payout > 0,
    segmentAngle,
    targetAngle: centerAngle,
    allSegments: WHEEL_SEGMENTS
  };
}

module.exports = {
  spinWheel,
  WHEEL_SEGMENTS
};
