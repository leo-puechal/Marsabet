const crypto = require('crypto');

const SUITS = [
  { suit: 'S', symbol: '♠', name: 'Pique', color: 'black' },
  { suit: 'H', symbol: '♥', name: 'Cœur', color: 'red' },
  { suit: 'D', symbol: '♦', name: 'Carreau', color: 'red' },
  { suit: 'C', symbol: '♣', name: 'Trèfle', color: 'black' }
];

const RANKS = [
  { rank: '2', value: 2, label: '2' },
  { rank: '3', value: 3, label: '3' },
  { rank: '4', value: 4, label: '4' },
  { rank: '5', value: 5, label: '5' },
  { rank: '6', value: 6, label: '6' },
  { rank: '7', value: 7, label: '7' },
  { rank: '8', value: 8, label: '8' },
  { rank: '9', value: 9, label: '9' },
  { rank: '10', value: 10, label: '10' },
  { rank: 'J', value: 11, label: 'Valet' },
  { rank: 'Q', value: 12, label: 'Dame' },
  { rank: 'K', value: 13, label: 'Roi' },
  { rank: 'A', value: 14, label: 'As' }
];

const PAYTABLE = [
  { id: 'royal_flush', name: 'Quinte Flush Royale', multiplier: 250, desc: '10, V, D, R, As de la même couleur' },
  { id: 'straight_flush', name: 'Quinte Flush', multiplier: 50, desc: '5 cartes consécutives de la même couleur' },
  { id: 'four_of_a_kind', name: 'Carré', multiplier: 25, desc: '4 cartes de même valeur' },
  { id: 'full_house', name: 'Full', multiplier: 9, desc: 'Un brelan et une paire' },
  { id: 'flush', name: 'Couleur', multiplier: 6, desc: '5 cartes de la même couleur' },
  { id: 'straight', name: 'Suite', multiplier: 4, desc: '5 cartes consécutives de couleurs variées' },
  { id: 'three_of_a_kind', name: 'Brelan', multiplier: 3, desc: '3 cartes de même valeur' },
  { id: 'two_pair', name: 'Deux Paires', multiplier: 2, desc: 'Deux paires distinctes' },
  { id: 'jacks_or_better', name: 'Paire de Valets ou Mieux', multiplier: 1, desc: 'Paire de Valets, Dames, Rois ou As' },
  { id: 'none', name: 'Perdu', multiplier: 0, desc: 'Aucune combinaison payante' }
];

const SUIT_SYMBOLS = {
  'S': '♠', 's': '♠', '♠': '♠',
  'H': '♥', 'h': '♥', '♥': '♥',
  'D': '♦', 'd': '♦', '♦': '♦',
  'C': '♣', 'c': '♣', '♣': '♣'
};

function createShuffledDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({
        code: `${r.rank}${s.suit}`,
        rank: r.rank,
        value: r.value,
        suit: s.symbol,
        suitCode: s.suit,
        symbol: s.symbol,
        color: s.color,
        name: `${r.label} de ${s.name}`
      });
    }
  }

  // Mélange Fisher-Yates cryptographiquement sécurisé
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Évalue une main de 5 cartes au Jacks or Better
 * @param {Array} cards 5 cartes
 * @returns {Object} combinaison gagnante et détails
 */
function evaluateHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new Error('Une main de vidéo poker doit comporter exactement 5 cartes.');
  }

  // Tri par valeur croissante
  const sorted = [...cards].sort((a, b) => a.value - b.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => SUIT_SYMBOLS[c.suit] || c.suit);

  // 1. Couleur (Flush)
  const isFlush = suits.every(s => s === suits[0]);

  // 2. Suite (Straight) : standard ou As en bas (A, 2, 3, 4, 5)
  const isStandardStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
  const isAceLowStraight = (values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14);
  const isStraight = isStandardStraight || isAceLowStraight;

  // 3. Quinte Flush Royale
  if (isFlush && isStraight && values[0] === 10 && values[4] === 14) {
    const info = PAYTABLE.find(p => p.id === 'royal_flush');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices: [0, 1, 2, 3, 4],
      isWin: true
    };
  }

  // 4. Quinte Flush
  if (isFlush && isStraight) {
    const info = PAYTABLE.find(p => p.id === 'straight_flush');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices: [0, 1, 2, 3, 4],
      isWin: true
    };
  }

  // Fréquence de chaque valeur
  const valCounts = {};
  for (const c of cards) {
    valCounts[c.value] = (valCounts[c.value] || 0) + 1;
  }

  const freqEntries = Object.entries(valCounts).map(([val, count]) => ({
    value: parseInt(val, 10),
    count
  })).sort((a, b) => b.count - a.count || b.value - a.value);

  // 5. Carré (Four of a Kind)
  if (freqEntries[0].count === 4) {
    const fourVal = freqEntries[0].value;
    const winningIndices = cards.map((c, idx) => c.value === fourVal ? idx : -1).filter(idx => idx !== -1);
    const info = PAYTABLE.find(p => p.id === 'four_of_a_kind');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices,
      isWin: true
    };
  }

  // 6. Full (Full House)
  if (freqEntries[0].count === 3 && freqEntries[1].count === 2) {
    const info = PAYTABLE.find(p => p.id === 'full_house');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices: [0, 1, 2, 3, 4],
      isWin: true
    };
  }

  // 7. Couleur (Flush)
  if (isFlush) {
    const info = PAYTABLE.find(p => p.id === 'flush');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices: [0, 1, 2, 3, 4],
      isWin: true
    };
  }

  // 8. Suite (Straight)
  if (isStraight) {
    const info = PAYTABLE.find(p => p.id === 'straight');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices: [0, 1, 2, 3, 4],
      isWin: true
    };
  }

  // 9. Brelan (Three of a Kind)
  if (freqEntries[0].count === 3) {
    const threeVal = freqEntries[0].value;
    const winningIndices = cards.map((c, idx) => c.value === threeVal ? idx : -1).filter(idx => idx !== -1);
    const info = PAYTABLE.find(p => p.id === 'three_of_a_kind');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices,
      isWin: true
    };
  }

  // 10. Deux Paires (Two Pair)
  if (freqEntries[0].count === 2 && freqEntries[1].count === 2) {
    const pair1 = freqEntries[0].value;
    const pair2 = freqEntries[1].value;
    const winningIndices = cards.map((c, idx) => (c.value === pair1 || c.value === pair2) ? idx : -1).filter(idx => idx !== -1);
    const info = PAYTABLE.find(p => p.id === 'two_pair');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices,
      isWin: true
    };
  }

  // 11. Paire de Valets ou Mieux (Jacks or Better : Valets (11), Dames (12), Rois (13), As (14))
  if (freqEntries[0].count === 2 && freqEntries[0].value >= 11) {
    const pairVal = freqEntries[0].value;
    const winningIndices = cards.map((c, idx) => c.value === pairVal ? idx : -1).filter(idx => idx !== -1);
    const info = PAYTABLE.find(p => p.id === 'jacks_or_better');
    return {
      id: info.id,
      name: info.name,
      multiplier: info.multiplier,
      winningIndices,
      isWin: true
    };
  }

  // 12. Aucune combinaison gagnante (Paire inférieure à Valet, ou rien)
  const noneInfo = PAYTABLE.find(p => p.id === 'none');
  return {
    id: noneInfo.id,
    name: noneInfo.name,
    multiplier: 0,
    winningIndices: [],
    isWin: false
  };
}

module.exports = {
  SUITS,
  RANKS,
  PAYTABLE,
  createShuffledDeck,
  evaluateHand
};
