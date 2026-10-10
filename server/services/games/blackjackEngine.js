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

module.exports = {
  createDeck,
  calculateHand,
  drawCard
};
