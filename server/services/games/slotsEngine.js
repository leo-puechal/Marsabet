const crypto = require('crypto');

/**
 * Hiérarchie complète des symboles pour la machine à sous Marsabet :
 * - Symboles Bas (Cartes) : 10, J, Q, K, A
 * - Symboles Moyens (Thème BDE) : Café, Chips, Chocolat, Canette
 * - Symboles Hauts (Cosmique/Jackpot) : Diamant, Planète Mars
 * - Symboles Spéciaux : Wild (Multiplicateur x2) et Scatter (Free Spins)
 */
const SYMBOLS = [
  // Symboles Bas (Cartes)
  {
    id: '10',
    name: '10 de Pique',
    icon: '🔟',
    category: 'low',
    weight: 32,
    pays: { 3: 4, 4: 12, 5: 35 }
  },
  {
    id: 'J',
    name: 'Valet',
    icon: '🃋',
    category: 'low',
    weight: 30,
    pays: { 3: 5, 4: 15, 5: 45 }
  },
  {
    id: 'Q',
    name: 'Dame',
    icon: '🃍',
    category: 'low',
    weight: 28,
    pays: { 3: 6, 4: 20, 5: 60 }
  },
  {
    id: 'K',
    name: 'Roi',
    icon: '🃎',
    category: 'low',
    weight: 26,
    pays: { 3: 8, 4: 25, 5: 80 }
  },
  {
    id: 'A',
    name: 'As Doré',
    icon: '🂱',
    category: 'low',
    weight: 24,
    pays: { 3: 10, 4: 35, 5: 120 }
  },

  // Symboles Moyens (Thème BDE Epitech)
  {
    id: 'cafe',
    name: 'Café Campus',
    icon: '☕',
    category: 'medium',
    weight: 20,
    pays: { 3: 15, 4: 50, 5: 180 }
  },
  {
    id: 'chips',
    name: 'Chips Snack BDE',
    icon: '🥔',
    category: 'medium',
    weight: 18,
    pays: { 3: 20, 4: 75, 5: 250 }
  },
  {
    id: 'choc',
    name: 'Chocolat BDE',
    icon: '🍫',
    category: 'medium',
    weight: 16,
    pays: { 3: 25, 4: 100, 5: 350 }
  },
  {
    id: 'canette',
    name: 'Canette Fraîche BDE',
    icon: '🥤',
    category: 'medium',
    weight: 14,
    pays: { 3: 35, 4: 150, 5: 500 }
  },

  // Symboles Hauts (Premium & Jackpot)
  {
    id: 'diamond',
    name: 'Diamant Cosmique',
    icon: '💎',
    category: 'high',
    weight: 9,
    pays: { 3: 50, 4: 250, 5: 1000 }
  },
  {
    id: 'mars',
    name: 'Planète Marsabet',
    icon: '🪐',
    category: 'jackpot',
    weight: 6,
    pays: { 2: 10, 3: 100, 4: 500, 5: 2500 }
  },

  // Symboles Spéciaux
  {
    id: 'wild',
    name: 'Wild Cosmique',
    icon: '🌟',
    category: 'special',
    weight: 5,
    isWild: true,
    wildMultiplier: 2,
    pays: { 3: 150, 4: 600, 5: 3000 }
  },
  {
    id: 'scatter',
    name: 'Scatter Free Spins',
    icon: '⚡',
    category: 'special',
    weight: 5,
    isScatter: true,
    // Paye sur la mise totale (pas par ligne)
    scatterPays: { 2: 1, 3: 3, 4: 15, 5: 100 },
    freeSpinsAwards: { 3: 10, 4: 15, 5: 25 }
  }
];

// Dictionnaire rapide par id
const SYMBOLS_MAP = {};
SYMBOLS.forEach(s => { SYMBOLS_MAP[s.id] = s; });

// Pool pondéré pour tirage aléatoire cryptographique
const SYMBOL_POOL = [];
SYMBOLS.forEach(s => {
  for (let i = 0; i < s.weight; i++) {
    SYMBOL_POOL.push(s.id);
  }
});

/**
 * 20 Lignes de paiement vidéo standards (5 colonnes × 3 rangées)
 * coords: [ [col0, row], [col1, row], [col2, row], [col3, row], [col4, row] ]
 * row : 0 = Haut, 1 = Milieu, 2 = Bas
 */
const PAYLINES = [
  { id: 1, name: 'Ligne Centrale', coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], color: '#FFD700' },
  { id: 2, name: 'Ligne Haute', coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], color: '#38BDF8' },
  { id: 3, name: 'Ligne Basse', coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], color: '#F43F5E' },
  { id: 4, name: 'V Plongeant', coords: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]], color: '#A855F7' },
  { id: 5, name: 'V Inversé', coords: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], color: '#22C55E' },
  { id: 6, name: 'Descente Douce', coords: [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]], color: '#F97316' },
  { id: 7, name: 'Montée Douce', coords: [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]], color: '#EC4899' },
  { id: 8, name: 'U Inversé', coords: [[0, 1], [1, 0], [2, 0], [3, 0], [4, 1]], color: '#EAB308' },
  { id: 9, name: 'U Creux', coords: [[0, 1], [1, 2], [2, 2], [3, 2], [4, 1]], color: '#06B6D4' },
  { id: 10, name: 'Zig-Zag 1', coords: [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]], color: '#84CC16' },
  { id: 11, name: 'Zig-Zag 2', coords: [[0, 1], [1, 2], [2, 1], [3, 0], [4, 1]], color: '#8B5CF6' },
  { id: 12, name: 'Pont Haut', coords: [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]], color: '#F59E0B' },
  { id: 13, name: 'Pont Bas', coords: [[0, 2], [1, 1], [2, 1], [3, 1], [4, 2]], color: '#10B981' },
  { id: 14, name: 'Créneau Haut', coords: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]], color: '#6366F1' },
  { id: 15, name: 'Créneau Bas', coords: [[0, 2], [1, 1], [2, 2], [3, 1], [4, 2]], color: '#EF4444' },
  { id: 16, name: 'Pic Médian Haut', coords: [[0, 1], [1, 1], [2, 0], [3, 1], [4, 1]], color: '#14B8A6' },
  { id: 17, name: 'Creux Médian Bas', coords: [[0, 1], [1, 1], [2, 2], [3, 1], [4, 1]], color: '#D946EF' },
  { id: 18, name: 'Creux Profond', coords: [[0, 0], [1, 0], [2, 2], [3, 0], [4, 0]], color: '#F472B6' },
  { id: 19, name: 'Pic Profond', coords: [[0, 2], [1, 2], [2, 0], [3, 2], [4, 2]], color: '#38BDF8' },
  { id: 20, name: 'Onde Cosmique', coords: [[0, 0], [1, 2], [2, 0], [3, 2], [4, 0]], color: '#FBBF24' }
];

function getRandomSymbol() {
  const idx = crypto.randomInt(0, SYMBOL_POOL.length);
  return SYMBOL_POOL[idx];
}

/**
 * Évalue une ligne de paiement de gauche à droite
 * avec support du Wild (substitution + multiplicateur x2)
 */
function evaluateLine(line, grid, lineBet) {
  const lineSymbols = line.coords.map(([col, row]) => grid[col][row]);

  // Si le premier symbole est un Scatter, la ligne de paiement ne s'applique pas
  if (lineSymbols[0] === 'scatter') {
    return null;
  }

  // Déterminer le symbole cible :
  // Si le premier est Wild, chercher le premier symbole non-Wild suivant
  let targetSymbolId = lineSymbols[0];
  let targetData = SYMBOLS_MAP[targetSymbolId];

  if (targetSymbolId === 'wild') {
    for (let i = 1; i < lineSymbols.length; i++) {
      const sym = lineSymbols[i];
      if (sym !== 'wild' && sym !== 'scatter') {
        targetSymbolId = sym;
        targetData = SYMBOLS_MAP[targetSymbolId];
        break;
      }
    }
  }

  // Compter les correspondances continues de gauche à droite
  let matchCount = 0;
  let hasWildInWin = false;

  for (let i = 0; i < lineSymbols.length; i++) {
    const sym = lineSymbols[i];
    if (sym === targetSymbolId) {
      matchCount++;
    } else if (sym === 'wild' && targetSymbolId !== 'scatter') {
      matchCount++;
      hasWildInWin = true;
    } else {
      break;
    }
  }

  // Vérifier si cette combinaison rapporte un gain
  if (!targetData || !targetData.pays || !targetData.pays[matchCount]) {
    // Si c'est une combinaison purement de Wilds
    if (lineSymbols[0] === 'wild') {
      let pureWildCount = 0;
      for (let i = 0; i < lineSymbols.length; i++) {
        if (lineSymbols[i] === 'wild') pureWildCount++;
        else break;
      }
      const wildData = SYMBOLS_MAP['wild'];
      if (wildData.pays[pureWildCount]) {
        const mult = wildData.pays[pureWildCount];
        return {
          lineId: line.id,
          lineName: line.name,
          color: line.color,
          symbol: wildData,
          matchCount: pureWildCount,
          baseMultiplier: mult,
          wildMultiplier: 1,
          finalMultiplier: mult,
          winAmount: mult * lineBet,
          hasWild: true,
          coords: line.coords.slice(0, pureWildCount)
        };
      }
    }
    return null;
  }

  const baseMultiplier = targetData.pays[matchCount];
  const wildMult = hasWildInWin ? 2 : 1; // Multiplicateur Wild x2
  const finalMultiplier = baseMultiplier * wildMult;
  const winAmount = finalMultiplier * lineBet;

  return {
    lineId: line.id,
    lineName: line.name,
    color: line.color,
    symbol: targetData,
    matchCount,
    baseMultiplier,
    wildMultiplier: wildMult,
    finalMultiplier,
    winAmount,
    hasWild: hasWildInWin,
    coords: line.coords.slice(0, matchCount)
  };
}

/**
 * Lance un tour de machine à sous
 * @param {number} betPerLine - Mise par ligne active
 * @param {number} activeLinesCount - Nombre de lignes de paiement actives (1 à 20)
 * @param {boolean} isFreeSpin - Indique si ce tour fait partie des Free Spins
 * @param {number} freeSpinMultiplier - Multiplicateur global des Free Spins (ex: x3)
 */
function spin(betPerLine = 1, activeLinesCount = 20, isFreeSpin = false, freeSpinMultiplier = 1) {
  const lineBet = Math.max(1, Math.floor(betPerLine));
  const linesCount = Math.min(20, Math.max(1, Math.floor(activeLinesCount)));
  const totalBet = lineBet * linesCount;

  // 1. Génération de la grille 5 colonnes × 3 rangées
  // grid[col][row]
  const grid = [];
  for (let c = 0; c < 5; c++) {
    const col = [];
    for (let r = 0; r < 3; r++) {
      col.push(getRandomSymbol());
    }
    grid.push(col);
  }

  // 2. Évaluation des lignes de paiement actives
  const winningLines = [];
  const activePaylines = PAYLINES.slice(0, linesCount);

  for (const line of activePaylines) {
    const result = evaluateLine(line, grid, lineBet);
    if (result) {
      // Appliquer le multiplicateur de Free Spins si actif
      if (isFreeSpin && freeSpinMultiplier > 1) {
        result.freeSpinMultiplier = freeSpinMultiplier;
        result.finalMultiplier *= freeSpinMultiplier;
        result.winAmount *= freeSpinMultiplier;
      }
      winningLines.push(result);
    }
  }

  const linesPayout = winningLines.reduce((acc, curr) => acc + curr.winAmount, 0);

  // 3. Évaluation des Scatters (n'importe où sur les 5 rouleaux)
  const scatterCoords = [];
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (grid[c][r] === 'scatter') {
        scatterCoords.push([c, r]);
      }
    }
  }

  const scatterCount = scatterCoords.length;
  let scatterPayout = 0;
  let freeSpinsWon = 0;
  const scatterData = SYMBOLS_MAP['scatter'];

  if (scatterCount >= 2 && scatterData.scatterPays[scatterCount]) {
    scatterPayout = scatterData.scatterPays[scatterCount] * totalBet;
  }

  if (scatterCount >= 3 && scatterData.freeSpinsAwards[scatterCount]) {
    freeSpinsWon = scatterData.freeSpinsAwards[scatterCount];
  }

  const totalPayout = linesPayout + scatterPayout;
  const netProfit = totalPayout - (isFreeSpin ? 0 : totalBet);

  return {
    grid,
    gridDetails: grid.map(col => col.map(symId => SYMBOLS_MAP[symId])),
    activeLinesCount: linesCount,
    betPerLine: lineBet,
    totalBet: isFreeSpin ? 0 : totalBet,
    isFreeSpin,
    freeSpinMultiplier: isFreeSpin ? freeSpinMultiplier : 1,
    winningLines,
    linesPayout,
    scatter: {
      count: scatterCount,
      coords: scatterCoords,
      payout: scatterPayout,
      freeSpinsWon,
      triggeredBonus: freeSpinsWon > 0
    },
    payout: totalPayout,
    profit: netProfit,
    isWin: totalPayout > 0,
    isBigWin: totalPayout >= totalBet * 10,
    isMegaWin: totalPayout >= totalBet * 25,
    isJackpot: totalPayout >= totalBet * 50
  };
}

module.exports = {
  spin,
  evaluateLine,
  getRandomSymbol,
  SYMBOLS,
  SYMBOLS_MAP,
  PAYLINES
};
