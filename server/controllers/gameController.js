const db = require('../database/db');
const slotsEngine = require('../services/games/slotsEngine');
const blackjackEngine = require('../services/games/blackjackEngine');
const rouletteEngine = require('../services/games/rouletteEngine');
const diceEngine = require('../services/games/diceEngine');
const wheelEngine = require('../services/games/wheelEngine');
const plinkoEngine = require('../services/games/plinkoEngine');

// Helper transactionnel pour mettre à jour le joueur et l'historique
function recordGameResult(userId, gameType, bet, payout, details) {
  const profit = payout - bet;

  const runTx = db.transaction(() => {
    const user = db.prepare('SELECT coins, biggest_win FROM users WHERE id = ?').get(userId);

    const newCoins = user.coins - bet + payout;
    const newBiggestWin = Math.max(user.biggest_win, payout);

    db.prepare(`
      UPDATE users
      SET coins = ?,
          total_wagered = total_wagered + ?,
          total_won = total_won + ?,
          games_played = games_played + 1,
          biggest_win = ?
      WHERE id = ?
    `).run(newCoins, bet, payout, newBiggestWin, userId);

    const hist = db.prepare(`
      INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, gameType, bet, payout, profit, JSON.stringify(details));

    return { newCoins, historyId: hist.lastInsertRowid };
  });

  return runTx();
}

// ======================== SLOTS ========================
exports.playSlots = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet);

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
    }

    const result = slotsEngine.spin(bet);
    const { newCoins } = recordGameResult(userId, 'slots', bet, result.payout, {
      grid: result.grid,
      winningLinesCount: result.winningLines.length,
      isBigWin: result.isBigWin
    });

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur slots:', err);
    return res.status(500).json({ error: 'Erreur lors du spin.' });
  }
};

// ======================== BLACKJACK ========================
exports.getBlackjackState = (req, res) => {
  const userId = req.user.id;
  const session = db.prepare('SELECT * FROM blackjack_sessions WHERE user_id = ?').get(userId);

  if (!session) {
    return res.json({ activeGame: false });
  }

  const playerHand = JSON.parse(session.player_hand);
  const dealerHand = JSON.parse(session.dealer_hand);
  const isPlaying = session.status === 'playing';

  // Si en cours, cacher la seconde carte du croupier
  const visibleDealerHand = isPlaying ? [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }] : dealerHand;
  const dealerScore = isPlaying ? blackjackEngine.calculateHand([dealerHand[0]]).score : blackjackEngine.calculateHand(dealerHand).score;

  return res.json({
    activeGame: true,
    bet: session.bet,
    playerHand,
    playerScore: blackjackEngine.calculateHand(playerHand).score,
    dealerHand: visibleDealerHand,
    dealerScore,
    status: session.status,
    canDouble: session.can_double === 1
  });
};

exports.dealBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet);

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide.' });
    }

    // Vérifier si une partie est déjà active
    const existing = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (existing) {
      return res.status(400).json({ error: 'Une partie de Blackjack est déjà en cours ! Termine-la d’abord.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour miser.' });
    }

    // Déduire la mise immédiatement
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(bet, userId);

    const deck = blackjackEngine.createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const playerCalc = blackjackEngine.calculateHand(playerHand);
    const dealerCalc = blackjackEngine.calculateHand(dealerHand);

    // Cas de Blackjack naturel direct
    if (playerCalc.isBlackjack) {
      let payout = 0;
      let outcome = 'lose';

      if (dealerCalc.isBlackjack) {
        // Push
        payout = bet;
        outcome = 'push';
      } else {
        // Joueur gagne avec Blackjack (3:2 = x2.5)
        payout = Math.floor(bet * 2.5);
        outcome = 'blackjack';
      }

      db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);
      const { newCoins } = recordGameResult(userId, 'blackjack', bet, payout, {
        playerHand,
        dealerHand,
        outcome
      });

      return res.json({
        activeGame: false,
        bet,
        playerHand,
        playerScore: 21,
        dealerHand,
        dealerScore: dealerCalc.score,
        status: 'finished',
        outcome,
        payout,
        coins: newCoins
      });
    }

    // Partie en cours
    db.prepare(`
      INSERT OR REPLACE INTO blackjack_sessions (user_id, deck, player_hand, dealer_hand, bet, status, can_double)
      VALUES (?, ?, ?, ?, ?, 'playing', 1)
    `).run(userId, JSON.stringify(deck), JSON.stringify(playerHand), JSON.stringify(dealerHand), bet);

    const updatedCoins = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins;

    return res.json({
      activeGame: true,
      bet,
      playerHand,
      playerScore: playerCalc.score,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      status: 'playing',
      canDouble: true,
      coins: updatedCoins
    });
  } catch (err) {
    console.error('Erreur deal blackjack:', err);
    return res.status(500).json({ error: 'Erreur Blackjack.' });
  }
};

exports.hitBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);

    if (!session) {
      return res.status(400).json({ error: 'Aucune partie en cours.' });
    }

    const deck = JSON.parse(session.deck);
    const playerHand = JSON.parse(session.player_hand);
    const dealerHand = JSON.parse(session.dealer_hand);
    const bet = session.bet;

    const newCard = deck.pop();
    playerHand.push(newCard);

    const playerCalc = blackjackEngine.calculateHand(playerHand);

    if (playerCalc.isBust) {
      // Défaite immédiate (Bust)
      db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);
      const { newCoins } = recordGameResult(userId, 'blackjack', bet, 0, {
        playerHand,
        dealerHand,
        outcome: 'bust'
      });

      return res.json({
        activeGame: false,
        bet,
        playerHand,
        playerScore: playerCalc.score,
        dealerHand,
        dealerScore: blackjackEngine.calculateHand(dealerHand).score,
        status: 'finished',
        outcome: 'bust',
        payout: 0,
        coins: newCoins
      });
    }

    // Sauvegarde de la main mise à jour (ne peut plus doubler après avoir tiré)
    db.prepare(`
      UPDATE blackjack_sessions
      SET deck = ?, player_hand = ?, can_double = 0
      WHERE user_id = ?
    `).run(JSON.stringify(deck), JSON.stringify(playerHand), userId);

    return res.json({
      activeGame: true,
      bet,
      playerHand,
      playerScore: playerCalc.score,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      status: 'playing',
      canDouble: false
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur Hit Blackjack.' });
  }
};

exports.standBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);

    if (!session) {
      return res.status(400).json({ error: 'Aucune partie en cours.' });
    }

    const deck = JSON.parse(session.deck);
    const playerHand = JSON.parse(session.player_hand);
    const dealerHand = JSON.parse(session.dealer_hand);
    const bet = session.bet;

    const playerCalc = blackjackEngine.calculateHand(playerHand);

    // Tour du croupier : tire jusqu'à avoir au moins 17
    let dealerCalc = blackjackEngine.calculateHand(dealerHand);
    while (dealerCalc.score < 17) {
      dealerHand.push(deck.pop());
      dealerCalc = blackjackEngine.calculateHand(dealerHand);
    }

    let payout = 0;
    let outcome = 'lose';

    if (dealerCalc.isBust) {
      payout = bet * 2;
      outcome = 'dealer_bust';
    } else if (playerCalc.score > dealerCalc.score) {
      payout = bet * 2;
      outcome = 'win';
    } else if (playerCalc.score === dealerCalc.score) {
      payout = bet;
      outcome = 'push';
    } else {
      payout = 0;
      outcome = 'lose';
    }

    db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);
    const { newCoins } = recordGameResult(userId, 'blackjack', bet, payout, {
      playerHand,
      dealerHand,
      playerScore: playerCalc.score,
      dealerScore: dealerCalc.score,
      outcome
    });

    return res.json({
      activeGame: false,
      bet,
      playerHand,
      playerScore: playerCalc.score,
      dealerHand,
      dealerScore: dealerCalc.score,
      status: 'finished',
      outcome,
      payout,
      coins: newCoins
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur Stand Blackjack.' });
  }
};

exports.doubleBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing' AND can_double = 1").get(userId);

    if (!session) {
      return res.status(400).json({ error: 'Impossible de doubler sur cette main.' });
    }

    const bet = session.bet;
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour doubler la mise.' });
    }

    // Déduire la mise supplémentaire
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(bet, userId);
    const totalBet = bet * 2;

    const deck = JSON.parse(session.deck);
    const playerHand = JSON.parse(session.player_hand);
    const dealerHand = JSON.parse(session.dealer_hand);

    // Tirer exactement 1 carte pour le joueur
    playerHand.push(deck.pop());
    const playerCalc = blackjackEngine.calculateHand(playerHand);

    let payout = 0;
    let outcome = 'lose';

    if (playerCalc.isBust) {
      db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);
      const { newCoins } = recordGameResult(userId, 'blackjack', totalBet, 0, {
        playerHand,
        dealerHand,
        outcome: 'bust'
      });

      return res.json({
        activeGame: false,
        bet: totalBet,
        playerHand,
        playerScore: playerCalc.score,
        dealerHand,
        dealerScore: blackjackEngine.calculateHand(dealerHand).score,
        status: 'finished',
        outcome: 'bust',
        payout: 0,
        coins: newCoins
      });
    }

    // Croupier joue
    let dealerCalc = blackjackEngine.calculateHand(dealerHand);
    while (dealerCalc.score < 17) {
      dealerHand.push(deck.pop());
      dealerCalc = blackjackEngine.calculateHand(dealerHand);
    }

    if (dealerCalc.isBust) {
      payout = totalBet * 2;
      outcome = 'dealer_bust';
    } else if (playerCalc.score > dealerCalc.score) {
      payout = totalBet * 2;
      outcome = 'win';
    } else if (playerCalc.score === dealerCalc.score) {
      payout = totalBet;
      outcome = 'push';
    } else {
      payout = 0;
      outcome = 'lose';
    }

    db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);
    const { newCoins } = recordGameResult(userId, 'blackjack', totalBet, payout, {
      playerHand,
      dealerHand,
      playerScore: playerCalc.score,
      dealerScore: dealerCalc.score,
      outcome,
      doubled: true
    });

    return res.json({
      activeGame: false,
      bet: totalBet,
      playerHand,
      playerScore: playerCalc.score,
      dealerHand,
      dealerScore: dealerCalc.score,
      status: 'finished',
      outcome,
      payout,
      coins: newCoins
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur Double Blackjack.' });
  }
};

// ======================== ROULETTE ========================
exports.playRoulette = (req, res) => {
  try {
    const userId = req.user.id;
    const { bets } = req.body;

    if (!Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ error: 'Place au moins un jeton sur le tapis de roulette.' });
    }

    let totalBet = 0;
    for (const b of bets) {
      const amt = parseInt(b.amount);
      if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Montant de pari invalide.' });
      }
      totalBet += amt;
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < totalBet) {
      return res.status(400).json({ error: `Solde insuffisant (mise totale: ${totalBet} jetons).` });
    }

    const result = rouletteEngine.spinRoulette(bets);
    const { newCoins } = recordGameResult(userId, 'roulette', totalBet, result.totalPayout, {
      winningNumber: result.winningNumber,
      color: result.color,
      winningBetsCount: result.winningBetsDetails.length
    });

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur roulette:', err);
    return res.status(500).json({ error: 'Erreur Roulette.' });
  }
};

// ======================== DICE ========================
exports.playDice = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet);
    const mode = req.body.mode || 'classic';
    const options = req.body.options || {};

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    const result = diceEngine.rollDice(bet, mode, options);
    const { newCoins } = recordGameResult(userId, 'dice', bet, result.payout, result);

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur dés:', err);
    return res.status(500).json({ error: 'Erreur lors du lancer de dés.' });
  }
};

// ======================== WHEEL OF FORTUNE ========================
exports.playWheel = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet);

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    const result = wheelEngine.spinWheel(bet);
    const { newCoins } = recordGameResult(userId, 'wheel', bet, result.payout, {
      segmentIndex: result.segmentIndex,
      multiplier: result.multiplier
    });

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur roue:', err);
    return res.status(500).json({ error: 'Erreur lors du spin de la roue.' });
  }
};

// ======================== PLINKO ========================
exports.playPlinko = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet);
    const risk = req.body.risk || 'medium';

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    const result = plinkoEngine.dropPlinko(bet, risk);
    const { newCoins } = recordGameResult(userId, 'plinko', bet, result.payout, {
      risk: result.risk,
      multiplier: result.multiplier,
      bucketIndex: result.bucketIndex
    });

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur plinko:', err);
    return res.status(500).json({ error: 'Erreur lors du lâcher de bille.' });
  }
};
