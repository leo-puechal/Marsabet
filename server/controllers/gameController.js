const db = require('../database/db');
const slotsEngine = require('../services/games/slotsEngine');
const blackjackEngine = require('../services/games/blackjackEngine');
const rouletteEngine = require('../services/games/rouletteEngine');
const diceEngine = require('../services/games/diceEngine');
const wheelEngine = require('../services/games/wheelEngine');
const plinkoEngine = require('../services/games/plinkoEngine');
const freeWheelEngine = require('../services/games/freeWheelEngine');
const vipService = require('../services/vipService');

// Helper transactionnel pour mettre à jour le joueur, wager, rang VIP et l'historique
function recordGameResult(userId, gameType, bet, payout, details, alreadyDeducted = false) {
  const profit = payout - bet;

  const runTx = db.transaction(() => {
    const user = db.prepare('SELECT coins, biggest_win, total_wagered FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }

    const deduction = alreadyDeducted ? 0 : bet;
    if (user.coins < deduction) {
      throw new Error('Solde insuffisant.');
    }

    const newCoins = user.coins - deduction + payout;
    if (newCoins < 0) {
      throw new Error('Solde insuffisant.');
    }
    const newBiggestWin = Math.max(user.biggest_win, payout);
    const newWager = user.total_wagered + bet;
    const vipInfo = vipService.getVipInfo(newWager);

    const updateRes = db.prepare(`
      UPDATE users
      SET coins = ?,
          total_wagered = ?,
          total_won = total_won + ?,
          games_played = games_played + 1,
          biggest_win = ?,
          vip_rank = ?
      WHERE id = ? AND coins >= ?
    `).run(newCoins, newWager, payout, newBiggestWin, vipInfo.currentTier.name, userId, deduction);

    if (updateRes.changes === 0) {
      throw new Error('Solde insuffisant.');
    }

    const hist = db.prepare(`
      INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, gameType, bet, payout, profit, JSON.stringify(details));

    return { newCoins, newWager, vipInfo, historyId: hist.lastInsertRowid };
  });

  return runTx();
}

// ======================== SLOTS (5x3 VIDÉO SLOT) ========================

// Récupérer l'état actuel de la machine (Free Spins actifs, gamble en attente, etc.)
exports.getSlotsState = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare('SELECT * FROM slot_sessions WHERE user_id = ?').get(userId);

    return res.json({
      session: session || {
        free_spins_remaining: 0,
        free_spins_total: 0,
        free_spins_multiplier: 3,
        free_spins_accumulated_win: 0,
        pending_gamble_amount: 0
      },
      symbols: slotsEngine.SYMBOLS,
      paylines: slotsEngine.PAYLINES
    });
  } catch (err) {
    console.error('Erreur getSlotsState:', err);
    return res.status(500).json({ error: 'Impossible de récupérer l\'état des slots.' });
  }
};

exports.playSlots = (req, res) => {
  try {
    const userId = req.user.id;

    // Vérifier si l'utilisateur est dans une session de Free Spins
    let session = db.prepare('SELECT * FROM slot_sessions WHERE user_id = ?').get(userId);
    const isFreeSpin = !!(session && session.free_spins_remaining > 0);

    let betPerLine = 1;
    let linesCount = 20;
    let totalBet = 20;

    if (isFreeSpin) {
      // Tour gratuit : aucune déduction de jetons !
      betPerLine = session.free_spins_bet_per_line || 1;
      linesCount = session.free_spins_lines || 20;
      totalBet = 0;
    } else {
      // Tour régulier : calcul de la mise totale
      if (req.body.betPerLine !== undefined) {
        betPerLine = Math.max(1, Math.floor(Number(req.body.betPerLine)));
        linesCount = Math.min(20, Math.max(1, Math.floor(Number(req.body.linesCount || 20))));
        totalBet = betPerLine * linesCount;
      } else {
        const rawBet = Number(req.body.bet || 20);
        if (!Number.isInteger(rawBet) || rawBet <= 0) {
          return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton).' });
        }
        linesCount = 20;
        betPerLine = Math.max(1, Math.floor(rawBet / linesCount));
        totalBet = betPerLine * linesCount;
      }

      const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
      if (!user || user.coins < totalBet) {
        return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
      }
    }

    // Exécution du spin côté serveur
    const freeSpinMult = isFreeSpin ? (session.free_spins_multiplier || 3) : 1;
    const result = slotsEngine.spin(betPerLine, linesCount, isFreeSpin, freeSpinMult);

    let newCoins = 0;

    if (isFreeSpin) {
      // Enregistrer le gain des tours gratuits
      const runTx = db.transaction(() => {
        const user = db.prepare('SELECT coins, biggest_win, total_wagered FROM users WHERE id = ?').get(userId);
        const updatedCoins = user.coins + result.payout;
        const newBiggest = Math.max(user.biggest_win, result.payout);

        db.prepare(`
          UPDATE users
          SET coins = ?,
              total_won = total_won + ?,
              games_played = games_played + 1,
              biggest_win = ?
          WHERE id = ?
        `).run(updatedCoins, result.payout, newBiggest, userId);

        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'slots_freespin', 0, ?, ?, ?)
        `).run(userId, result.payout, result.payout, JSON.stringify({
          grid: result.grid,
          linesWon: result.winningLines.length,
          multiplier: freeSpinMult
        }));

        // Mettre à jour la session Free Spins
        const remainingAfter = session.free_spins_remaining - 1 + result.scatter.freeSpinsWon;
        const totalAfter = session.free_spins_total + result.scatter.freeSpinsWon;
        const accumAfter = session.free_spins_accumulated_win + result.payout;

        db.prepare(`
          UPDATE slot_sessions
          SET free_spins_remaining = ?,
              free_spins_total = ?,
              free_spins_accumulated_win = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(remainingAfter, totalAfter, accumAfter, userId);

        return {
          coins: updatedCoins,
          remainingSpins: remainingAfter,
          accumulatedBonus: accumAfter,
          bonusCompleted: remainingAfter <= 0
        };
      });

      const txRes = runTx();
      newCoins = txRes.coins;

      return res.json({
        ...result,
        coins: newCoins,
        freeSpinsState: {
          isActive: true,
          remaining: txRes.remainingSpins,
          total: session.free_spins_total + result.scatter.freeSpinsWon,
          multiplier: freeSpinMult,
          accumulatedWin: txRes.accumulatedBonus,
          justFinished: txRes.bonusCompleted
        }
      });
    } else {
      // Tour régulier : enregistrement complet du résultat
      const { newCoins: updatedCoins } = recordGameResult(userId, 'slots', totalBet, result.payout, {
        grid: result.grid,
        betPerLine,
        linesCount,
        winningLinesCount: result.winningLines.length,
        isBigWin: result.isBigWin,
        scatters: result.scatter.count
      });

      newCoins = updatedCoins;

      // Gestion du déclenchement du bonus Free Spins
      if (result.scatter.triggeredBonus) {
        db.prepare(`
          INSERT INTO slot_sessions (
            user_id, free_spins_remaining, free_spins_total, free_spins_multiplier,
            free_spins_accumulated_win, free_spins_bet_per_line, free_spins_lines, pending_gamble_amount
          )
          VALUES (?, ?, ?, 3, 0, ?, ?, 0)
          ON CONFLICT(user_id) DO UPDATE SET
            free_spins_remaining = excluded.free_spins_remaining,
            free_spins_total = excluded.free_spins_total,
            free_spins_multiplier = 3,
            free_spins_accumulated_win = 0,
            free_spins_bet_per_line = excluded.free_spins_bet_per_line,
            free_spins_lines = excluded.free_spins_lines,
            pending_gamble_amount = 0,
            updated_at = CURRENT_TIMESTAMP
        `).run(userId, result.scatter.freeSpinsWon, result.scatter.freeSpinsWon, betPerLine, linesCount);
      } else {
        // Enregistrer la possibilité de Quitte ou Double si gain
        db.prepare(`
          INSERT INTO slot_sessions (user_id, pending_gamble_amount)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            pending_gamble_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        `).run(userId, result.payout, result.payout);
      }

      return res.json({
        ...result,
        coins: newCoins,
        freeSpinsState: {
          isActive: false,
          remaining: result.scatter.freeSpinsWon,
          total: result.scatter.freeSpinsWon,
          multiplier: 3,
          accumulatedWin: 0,
          justTriggered: result.scatter.triggeredBonus
        },
        canGamble: result.payout > 0
      });
    }
  } catch (err) {
    console.error('Erreur slots spin:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors du spin.' });
  }
};

// ======================== GAMBLE (QUITTE OU DOUBLE) ========================
exports.gambleSlots = (req, res) => {
  try {
    const userId = req.user.id;
    const { choice } = req.body; // 'red' ou 'black'

    if (choice !== 'red' && choice !== 'black') {
      return res.status(400).json({ error: 'Choix invalide : choisis Rouge ou Noir.' });
    }

    const session = db.prepare('SELECT * FROM slot_sessions WHERE user_id = ?').get(userId);
    if (!session || !session.pending_gamble_amount || session.pending_gamble_amount <= 0) {
      return res.status(400).json({ error: 'Aucun gain en attente à risquer.' });
    }

    const currentGamble = session.pending_gamble_amount;

    // Tirage d'une carte aléatoire
    const SUITS = [
      { name: 'hearts', symbol: '♥️', color: 'red' },
      { name: 'diamonds', symbol: '♦️', color: 'red' },
      { name: 'spades', symbol: '♠️', color: 'black' },
      { name: 'clubs', symbol: '♣️', color: 'black' }
    ];
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    const suit = SUITS[crypto.randomInt(0, SUITS.length)];
    const rank = RANKS[crypto.randomInt(0, RANKS.length)];
    const drawnCard = {
      rank,
      suit: suit.symbol,
      color: suit.color,
      label: `${rank}${suit.symbol}`
    };

    const isWin = suit.color === choice;

    const runTx = db.transaction(() => {
      const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

      if (isWin) {
        // Double le montant du gain : l'élève gagne currentGamble supplémentaire
        const newCoins = user.coins + currentGamble;
        const newGambleAmount = currentGamble * 2;

        db.prepare('UPDATE users SET coins = ?, total_won = total_won + ? WHERE id = ?')
          .run(newCoins, currentGamble, userId);

        db.prepare('UPDATE slot_sessions SET pending_gamble_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run(newGambleAmount, userId);

        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'slots_gamble', ?, ?, ?, ?)
        `).run(userId, currentGamble, newGambleAmount, currentGamble, JSON.stringify({ choice, card: drawnCard, win: true }));

        return { coins: newCoins, newAmount: newGambleAmount, isWin: true };
      } else {
        // Perdu : le gain précédent est perdu
        const newCoins = Math.max(0, user.coins - currentGamble);

        db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newCoins, userId);
        db.prepare('UPDATE slot_sessions SET pending_gamble_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run(userId);

        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'slots_gamble', ?, 0, ?, ?)
        `).run(userId, currentGamble, -currentGamble, JSON.stringify({ choice, card: drawnCard, win: false }));

        return { coins: newCoins, newAmount: 0, isWin: false };
      }
    });

    const result = runTx();

    return res.json({
      success: true,
      won: result.isWin,
      choice,
      drawnCard,
      newAmount: result.newAmount,
      coins: result.coins,
      message: result.isWin
        ? `🎉 Bravo ! C'est ${drawnCard.label} (${drawnCard.color === 'red' ? 'Rouge' : 'Noir'}). Gain doublé à ${result.newAmount.toLocaleString()} 🪙 !`
        : `❌ Dommage ! C'est ${drawnCard.label}. Gain perdu pour cette fois.`
    });
  } catch (err) {
    console.error('Erreur slots gamble:', err);
    return res.status(500).json({ error: 'Erreur lors du Quitte ou Double.' });
  }
};

// Encaisser définitivement le gain sans risquer de gamble
exports.collectSlotsGamble = (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare('UPDATE slot_sessions SET pending_gamble_amount = 0 WHERE user_id = ?').run(userId);
    return res.json({ success: true, message: 'Gain sécurisé et conservé !' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de l\'encaissement.' });
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
    const bet = Number(req.body.bet);

    if (!Number.isInteger(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton).' });
    }

    // Vérifier si une partie est déjà active
    const existing = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (existing) {
      return res.status(400).json({ error: 'Une partie de Blackjack est déjà en cours ! Termine-la d’abord.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    // Déduire la mise immédiatement de façon atomique
    const updateDeduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(bet, userId, bet);
    if (updateDeduct.changes === 0) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

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
      }, true);

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
      }, true);

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
    }, true);

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

    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour doubler la mise.' });
    }

    // Déduire la mise supplémentaire de façon atomique
    const updateDeduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(bet, userId, bet);
    if (updateDeduct.changes === 0) {
      return res.status(400).json({ error: 'Solde insuffisant pour doubler la mise.' });
    }
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
      }, true);

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
    }, true);

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
      const amt = Number(b.amount);
      if (!Number.isInteger(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Montant de pari invalide.' });
      }
      totalBet += amt;
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < totalBet) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
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
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur Roulette.' });
  }
};

// ======================== DICE ========================
exports.playDice = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = Number(req.body.bet);
    const mode = req.body.mode || 'classic';
    const options = req.body.options || {};

    if (!Number.isInteger(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
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
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur lors du lancer de dés.' });
  }
};

// ======================== WHEEL OF FORTUNE ========================
exports.playWheel = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = Number(req.body.bet);

    if (!Number.isInteger(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
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
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur lors du spin de la roue.' });
  }
};

// ======================== PLINKO ========================
exports.playPlinko = (req, res) => {
  try {
    const userId = req.user.id;
    const unitBet = Number(req.body.bet);
    const risk = req.body.risk || 'medium';
    const ballCount = Math.max(1, Math.min(10, parseInt(req.body.ballCount, 10) || 1));

    if (!Number.isInteger(unitBet) || unitBet <= 0) {
      return res.status(400).json({ error: 'Mise invalide (minimum 1 jeton par bille).' });
    }

    const totalBet = unitBet * ballCount;
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < totalBet) {
      return res.status(400).json({ error: `Solde insuffisant pour ${ballCount} bille(s). Mise totale requise : ${totalBet} coins.` });
    }

    const result = plinkoEngine.dropPlinkoMulti(unitBet, ballCount, risk);
    const { newCoins } = recordGameResult(userId, 'plinko', totalBet, result.totalPayout, {
      risk: result.risk,
      ballCount: result.ballCount,
      unitBet: result.unitBet,
      totalBet: result.totalBet,
      totalPayout: result.totalPayout,
      balls: result.balls.map(b => ({
        index: b.ballIndex,
        multiplier: b.multiplier,
        payout: b.payout
      }))
    });

    return res.json({
      ...result,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur plinko:', err);
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur lors du drop Plinko.' });
  }
};

// ======================== ROUE QUOTIDIENNE GRATUITE ========================
exports.getFreeWheelStatus = (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT last_free_spin, free_spin_streak, total_wagered FROM users WHERE id = ?').get(userId);

    const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h en millisecondes
    const STREAK_RESET_MS = 48 * 60 * 60 * 1000; // Si > 48h sans tourner, streak reset à 0

    let canSpin = true;
    let remainingMs = 0;
    let currentStreak = user.free_spin_streak || 0;

    if (user.last_free_spin) {
      const lastSpinTime = new Date(user.last_free_spin).getTime();
      const elapsed = Date.now() - lastSpinTime;

      if (elapsed < COOLDOWN_MS) {
        canSpin = false;
        remainingMs = COOLDOWN_MS - elapsed;
      } else if (elapsed > STREAK_RESET_MS) {
        // Trop de temps écoulé, le streak est réinitialisé
        currentStreak = 0;
      }
    }

    const vipInfo = vipService.getVipInfo(user.total_wagered);

    return res.json({
      canSpin,
      remainingMs,
      streak: currentStreak,
      vipInfo,
      lastFreeSpin: user.last_free_spin
    });
  } catch (err) {
    console.error('Erreur statut roue gratuite:', err);
    return res.status(500).json({ error: 'Impossible de charger le statut de la roue gratuite.' });
  }
};

exports.spinFreeWheel = (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT coins, last_free_spin, free_spin_streak, total_wagered FROM users WHERE id = ?').get(userId);

    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const STREAK_RESET_MS = 48 * 60 * 60 * 1000;

    if (user.last_free_spin) {
      const lastSpinTime = new Date(user.last_free_spin).getTime();
      const elapsed = Date.now() - lastSpinTime;

      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return res.status(400).json({
          error: `Patience ! Ton prochain spin gratuit sera disponible dans ${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m.`,
          remainingMs: COOLDOWN_MS - elapsed
        });
      }
    }

    // Calcul du streak
    let newStreak = 1;
    if (user.last_free_spin) {
      const elapsed = Date.now() - new Date(user.last_free_spin).getTime();
      if (elapsed <= STREAK_RESET_MS) {
        newStreak = (user.free_spin_streak || 0) + 1;
      }
    }

    const vipInfo = vipService.getVipInfo(user.total_wagered);
    const result = freeWheelEngine.spinFreeWheel(newStreak, vipInfo.currentTier.bonusMultiplier);

    const newCoins = user.coins + result.finalCoins;
    const nowIso = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET coins = ?,
            last_free_spin = ?,
            free_spin_streak = ?
        WHERE id = ?
      `).run(newCoins, nowIso, newStreak, userId);

      db.prepare(`
        INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
        VALUES (?, 'free_daily_wheel', 0, ?, ?, ?)
      `).run(userId, result.finalCoins, result.finalCoins, JSON.stringify({
        segment: result.segment.label,
        baseCoins: result.baseCoins,
        streak: newStreak,
        streakBonusPercent: result.streakBonusPercent,
        vipRank: vipInfo.currentTier.name,
        vipMultiplier: vipInfo.currentTier.bonusMultiplier
      }));
    })();

    return res.json({
      ...result,
      coins: newCoins,
      newStreak,
      lastFreeSpin: nowIso,
      vipInfo
    });
  } catch (err) {
    console.error('Erreur spin roue gratuite:', err);
    return res.status(500).json({ error: 'Erreur lors du spin gratuit.' });
  }
};
