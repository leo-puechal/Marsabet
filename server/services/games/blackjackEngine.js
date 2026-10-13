const crypto = require('crypto');

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(decksCount = 6) {
  const deck = [];
  for (let d = 0; d < decksCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        let value = parseInt(rank);
        if (['J', 'Q', 'K'].includes(rank)) value = 10;
        if (rank === 'A') value = 11;
        deck.push({
          suit,
          suitName: SUIT_NAMES[suit],
          color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
          rank,
          value
        });
      }
    }
  }

  // Mélange Fisher-Yates sécurisé
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function calculateHand(cards) {
  let score = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      score += 11;
    } else {
      score += card.value;
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  const isBlackjack = cards.length === 2 && score === 21;
  const isBust = score > 21;

  return {
    score,
    isBlackjack,
    isBust,
    isSoft: aces > 0
  };
}

function drawCard(deck) {
  if (deck.length === 0) {
    deck = createDeck();
  }
  return deck.pop();
}

function canSplit(cards) {
  if (!cards || cards.length !== 2) return false;
  const val1 = cards[0].value;
  const val2 = cards[1].value;
  return val1 === val2 || cards[0].rank === cards[1].rank;
}

/**
 * Évalue la mise annexe Perfect Pairs (2 premières cartes du joueur)
 * - Paire parfaite (même rang ET même enseigne) : 25:1
 * - Paire colorée (même rang ET même couleur) : 10:1
 * - Paire mixte (même rang mais couleurs différentes) : 5:1
 */
function evaluatePerfectPairs(card1, card2, bet = 0) {
  if (!card1 || !card2 || bet <= 0) {
    return { bet: 0, win: false, payout: 0, multiplier: 0, type: 'none', label: 'Aucune' };
  }

  if (card1.rank !== card2.rank) {
    return { bet, win: false, payout: 0, multiplier: 0, type: 'none', label: 'Perdue' };
  }

  // Paire Parfaite (même rang et même symbole)
  if (card1.suit === card2.suit) {
    return {
      bet,
      win: true,
      multiplier: 25,
      payout: bet + (bet * 25), // 25:1 gain net + mise remboursée
      type: 'perfect_pair',
      label: 'Paire Parfaite (25:1)'
    };
  }

  // Paire Colorée (même couleur rouge/rouge ou noir/noir)
  const isRed1 = (card1.suit === '♥' || card1.suit === '♦' || card1.color === 'red');
  const isRed2 = (card2.suit === '♥' || card2.suit === '♦' || card2.color === 'red');
  if (isRed1 === isRed2) {
    return {
      bet,
      win: true,
      multiplier: 10,
      payout: bet + (bet * 10), // 10:1
      type: 'colored_pair',
      label: 'Paire Colorée (10:1)'
    };
  }

  // Paire Mixte (couleurs différentes)
  return {
    bet,
    win: true,
    multiplier: 5,
    payout: bet + (bet * 5), // 5:1
    type: 'mixed_pair',
    label: 'Paire Mixte (5:1)'
  };
}

/**
 * Évalue la mise annexe 21+3 (2 cartes joueur + carte visible croupier)
 * - Suite couleur (Straight Flush) : 40:1
 * - Brelan (Three of a Kind) : 30:1
 * - Suite (Straight) : 10:1
 * - Couleur (Flush) : 5:1
 */
function evaluate21Plus3(card1, card2, dealerUpcard, bet = 0) {
  if (!card1 || !card2 || !dealerUpcard || bet <= 0) {
    return { bet: 0, win: false, payout: 0, multiplier: 0, type: 'none', label: 'Aucune' };
  }

  const cards = [card1, card2, dealerUpcard];
  const isFlush = (card1.suit === card2.suit && card2.suit === dealerUpcard.suit);

  const RANK_ORDER = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const isThreeOfAKind = (card1.rank === card2.rank && card2.rank === dealerUpcard.rank);

  // Vérification de suite
  const vals = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  let isStraight = (vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1);

  // Cas spécial suite A-2-3
  const ranksSet = new Set(cards.map(c => c.rank));
  if (ranksSet.has('A') && ranksSet.has('2') && ranksSet.has('3')) {
    isStraight = true;
  }

  if (isStraight && isFlush) {
    return {
      bet,
      win: true,
      multiplier: 40,
      payout: bet + (bet * 40),
      type: 'straight_flush',
      label: 'Suite Couleur (40:1)'
    };
  }

  if (isThreeOfAKind) {
    return {
      bet,
      win: true,
      multiplier: 30,
      payout: bet + (bet * 30),
      type: 'three_of_a_kind',
      label: 'Brelan (30:1)'
    };
  }

  if (isStraight) {
    return {
      bet,
      win: true,
      multiplier: 10,
      payout: bet + (bet * 10),
      type: 'straight',
      label: 'Suite (10:1)'
    };
  }

  if (isFlush) {
    return {
      bet,
      win: true,
      multiplier: 5,
      payout: bet + (bet * 5),
      type: 'flush',
      label: 'Couleur (5:1)'
    };
  }

  return {
    bet,
    win: false,
    payout: 0,
    multiplier: 0,
    type: 'none',
    label: 'Perdue'
  };
}

/**
 * Évalue l'Assurance (proposée si croupier montre un As)
 * Paie 2:1 si le croupier a Blackjack naturel
 */
function evaluateInsurance(dealerHand, insuranceBet = 0) {
  if (insuranceBet <= 0) {
    return { bet: 0, win: false, payout: 0, multiplier: 0, label: 'Aucune' };
  }

  const dealerCalc = calculateHand(dealerHand);
  const isDealerBlackjack = dealerCalc.isBlackjack;

  if (isDealerBlackjack) {
    return {
      bet: insuranceBet,
      win: true,
      multiplier: 2,
      payout: insuranceBet + (insuranceBet * 2), // 2:1 gain net + mise remboursée
      type: 'insurance_win',
      label: 'Assurance Gagnée (2:1)'
    };
  }

  return {
    bet: insuranceBet,
    win: false,
    multiplier: 0,
    payout: 0,
    type: 'insurance_loss',
    label: 'Assurance Perdue'
  };
}

module.exports = {
  createDeck,
  calculateHand,
  drawCard,
  canSplit,
  evaluatePerfectPairs,
  evaluate21Plus3,
  evaluateInsurance
};

