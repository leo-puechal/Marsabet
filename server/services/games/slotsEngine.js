const crypto = require('crypto');

// Symboles et leurs poids relatifs (fréquence d'apparition)
const SYMBOLS = [
  { id: 'mars', name: 'Planète Mars', icon: '🪐', weight: 4, pays: { 3: 15, 4: 40, 5: 100 } },
  { id: 'diamond', name: 'Diamant Bleu', icon: '💎', weight: 6, pays: { 3: 10, 4: 25, 5: 60 } },
  { id: 'crown', name: 'Couronne Or', icon: '👑', weight: 8, pays: { 3: 8, 4: 18, 5: 40 } },
  { id: 'seven', name: 'Triple 7', icon: '🎰', weight: 12, pays: { 3: 5, 4: 12, 5: 25 } },
  { id: 'clover', name: 'Trèfle 4 Feuilles', icon: '🍀', weight: 16, pays: { 3: 4, 4: 8, 5: 18 } },
  { id: 'grape', name: 'Grappe de Raisin', icon: '🍇', weight: 20, pays: { 3: 3, 4: 6, 5: 12 } },
  { id: 'lemon', name: 'Citron Doré', icon: '🍋', weight: 24, pays: { 3: 2, 4: 4, 5: 8 } },
  { id: 'cherry', name: 'Cerises', icon: '🍒', weight: 30, pays: { 2: 1, 3: 2, 4: 3, 5: 5 } }
];

// Pool pré-calculé pour tirage aléatoire sécurisé
const SYMBOL_POOL = [];
SYMBOLS.forEach(s => {
  for (let i = 0; i < s.weight; i++) {
    SYMBOL_POOL.push(s.id);
  }
});

const SYMBOLS_MAP = {};
SYMBOLS.forEach(s => { SYMBOLS_MAP[s.id] = s; });

// 10 lignes de paiement classiques (coordonnées [col][row])
// 5 colonnes (0 à 4), 3 rangées (0: haut, 1: milieu, 2: bas)
const PAYLINES = [
  { id: 1, name: 'Ligne Milieu', coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]] },
  { id: 2, name: 'Ligne Haut', coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: 3, name: 'Ligne Bas', coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] },
  { id: 4, name: 'V Inversé', coords: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]] },
  { id: 5, name: 'V Plongeant', coords: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]] },
  { id: 6, name: 'Diagonale Descendante', coords: [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]] },
  { id: 7, name: 'Diagonale Montante', coords: [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]] },
  { id: 8, name: 'Zig-Zag 1', coords: [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]] },
  { id: 9, name: 'Zig-Zag 2', coords: [[0, 1], [1, 2], [2, 1], [3, 0], [4, 1]] },
  { id: 10, name: 'Chapeau', coords: [[0, 2], [1, 0], [2, 0], [3, 0], [4, 2]] }
];

function getRandomSymbol() {
  const index = crypto.randomInt(0, SYMBOL_POOL.length);
  return SYMBOL_POOL[index];
}

function spin(bet) {
  // Générer grille 5 colonnes x 3 rangées
  // grid[col][row]
  const grid = [];
  for (let c = 0; c < 5; c++) {
    const col = [];
    for (let r = 0; r < 3; r++) {
      col.push(getRandomSymbol());
    }
    grid.push(col);
  }

  // Évaluation des lignes de paiement
  const winningLines = [];
  let totalMultiplier = 0;
  const lineBet = Math.max(1, Math.floor(bet / PAYLINES.length)); // mise par ligne

  for (const line of PAYLINES) {
    const firstSymbolId = grid[line.coords[0][0]][line.coords[0][1]];
    const symbolData = SYMBOLS_MAP[firstSymbolId];
    let matchCount = 1;

    for (let i = 1; i < line.coords.length; i++) {
      const currentSymbolId = grid[line.coords[i][0]][line.coords[i][1]];
      if (currentSymbolId === firstSymbolId) {
        matchCount++;
      } else {
        break;
      }
    }

    if (symbolData.pays[matchCount]) {
      const mult = symbolData.pays[matchCount];
      const winAmount = mult * lineBet;
      totalMultiplier += mult;

      winningLines.push({
        lineId: line.id,
        lineName: line.name,
        symbol: symbolData,
        matchCount,
        multiplier: mult,
        winAmount,
        coords: line.coords.slice(0, matchCount)
      });
    }
  }

  const payout = winningLines.reduce((acc, curr) => acc + curr.winAmount, 0);

  return {
    grid, // 5 x 3 array de symbol IDs
    gridDetails: grid.map(col => col.map(symId => SYMBOLS_MAP[symId])),
    winningLines,
    payout,
    profit: payout - bet,
    isWin: payout > 0,
    isBigWin: payout >= bet * 5,
    isJackpot: payout >= bet * 25
  };
}

module.exports = {
  spin,
  SYMBOLS,
  PAYLINES
};
