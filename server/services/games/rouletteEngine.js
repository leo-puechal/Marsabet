const crypto = require('crypto');

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function spinRoulette(bets) {
  // Tirage équitable du numéro gagnant entre 0 et 36
  const winningNumber = crypto.randomInt(0, 37);
  const wheelIndex = WHEEL_NUMBERS.indexOf(winningNumber);

  let color = 'green';
  if (winningNumber !== 0) {
    color = RED_NUMBERS.has(winningNumber) ? 'red' : 'black';
  }

  const isEven = winningNumber !== 0 && winningNumber % 2 === 0;
  const isOdd = winningNumber !== 0 && winningNumber % 2 !== 0;
  const isLow = winningNumber >= 1 && winningNumber <= 18;
  const isHigh = winningNumber >= 19 && winningNumber <= 36;
  const dozen = winningNumber === 0 ? 0 : Math.ceil(winningNumber / 12); // 1, 2 ou 3
  const column = winningNumber === 0 ? 0 : ((winningNumber - 1) % 3) + 1; // 1, 2 ou 3

  let totalBet = 0;
  let totalPayout = 0;
  const winningBetsDetails = [];

  // Évaluation de chaque mise
  for (const bet of bets) {
    const amount = parseInt(bet.amount) || 0;
    if (amount <= 0) continue;
    totalBet += amount;

    let won = false;
    let multiplier = 0;

    switch (bet.type) {
      case 'number':
        if (parseInt(bet.value) === winningNumber) {
          won = true;
          multiplier = 36;
        }
        break;
      case 'red':
        if (color === 'red') { won = true; multiplier = 2; }
        break;
      case 'black':
        if (color === 'black') { won = true; multiplier = 2; }
        break;
      case 'even':
        if (isEven) { won = true; multiplier = 2; }
        break;
      case 'odd':
        if (isOdd) { won = true; multiplier = 2; }
        break;
      case 'low':
        if (isLow) { won = true; multiplier = 2; }
        break;
      case 'high':
        if (isHigh) { won = true; multiplier = 2; }
        break;
      case 'dozen':
        if (parseInt(bet.value) === dozen) { won = true; multiplier = 3; }
        break;
      case 'column':
        if (parseInt(bet.value) === column) { won = true; multiplier = 3; }
        break;
      default:
        break;
    }

    if (won) {
      const payout = amount * multiplier;
      totalPayout += payout;
      winningBetsDetails.push({
        type: bet.type,
        value: bet.value,
        amount,
        multiplier,
        payout
      });
    }
  }

  return {
    winningNumber,
    color,
    wheelIndex,
    wheelNumbersCount: WHEEL_NUMBERS.length,
    totalBet,
    totalPayout,
    profit: totalPayout - totalBet,
    winningBetsDetails,
    isWin: totalPayout > 0
  };
}

module.exports = {
  spinRoulette,
  WHEEL_NUMBERS,
  RED_NUMBERS
};
