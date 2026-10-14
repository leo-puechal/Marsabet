const crypto = require('crypto');
const db = require('../database/db');
const socketService = require('../services/socketService');
const slotsEngine = require('../services/games/slotsEngine');
const blackjackEngine = require('../services/games/blackjackEngine');
const rouletteEngine = require('../services/games/rouletteEngine');
const diceEngine = require('../services/games/diceEngine');
const wheelEngine = require('../services/games/wheelEngine');
const plinkoEngine = require('../services/games/plinkoEngine');
const freeWheelEngine = require('../services/games/freeWheelEngine');
const sliderEngine = require('../services/games/sliderEngine');
const crashEngine = require('../services/games/crashEngine');
const vipService = require('../services/vipService');
const contestService = require('../services/contestService');

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

  const txRes = runTx();

  try {
    contestService.recordGameProgress(userId, gameType, bet, payout, details);
  } catch (cErr) {
    console.warn('Erreur contest tracking non bloquante:', cErr);
  }

  try {
    socketService.notifyUserBalance(userId, txRes.newCoins, { wager: txRes.newWager, vipInfo: txRes.vipInfo });
    socketService.notifyLeaderboardUpdated();
    if (profit > 0) {
      const u = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
      socketService.notifyNewWin({
        username: u ? u.username : 'Joueur',
        game_type: gameType,
        profit,
        payout,
        created_at: new Date().toISOString()
      });
    }
  } catch (sockErr) {
    // Non-bloquant
  }

  return txRes;
}
exports.recordGameResult = recordGameResult;

const blackjackController = require('./blackjackController');
blackjackController.setRecordGameResultFn(recordGameResult);

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
        betPerLine = Number(req.body.betPerLine);
        linesCount = Number(req.body.linesCount || 20);
        if (!Number.isInteger(betPerLine) || betPerLine <= 0) {
          return res.status(400).json({ error: 'La mise par ligne doit être un nombre entier positif (minimum 1 jeton).' });
        }
        if (!Number.isInteger(linesCount) || linesCount < 1 || linesCount > 20) {
          return res.status(400).json({ error: 'Nombre de lignes invalide (entre 1 et 20).' });
        }
        totalBet = betPerLine * linesCount;
      } else {
        const rawBet = Number(req.body.bet || 20);
        if (!Number.isInteger(rawBet) || rawBet < 10) {
          return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons).' });
        }
        linesCount = 20;
        betPerLine = Math.max(1, Math.floor(rawBet / linesCount));
        totalBet = betPerLine * linesCount;
      }

      if (totalBet < 10) {
        return res.status(400).json({ error: 'Mise totale minimale : 10 jetons.' });
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

// ======================== BLACKJACK (MULTI-MAINS & SPLIT) ========================
exports.getBlackjackState = blackjackController.getBlackjackState;
exports.dealBlackjack = blackjackController.dealBlackjack;
exports.splitBlackjack = blackjackController.splitBlackjack;
exports.hitBlackjack = blackjackController.hitBlackjack;
exports.standBlackjack = blackjackController.standBlackjack;
exports.doubleBlackjack = blackjackController.doubleBlackjack;

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
        return res.status(400).json({ error: 'Montant de pari invalide (doit être un entier positif).' });
      }
      totalBet += amt;
    }

    if (totalBet < 10) {
      return res.status(400).json({ error: 'Mise totale minimale sur la roulette : 10 jetons.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < totalBet) {
      return res.status(400).json({ error: 'Solde insuffisant pour placer ces paris.' });
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

    if (!Number.isInteger(bet) || bet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
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

    if (!Number.isInteger(bet) || bet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
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

    if (!Number.isInteger(unitBet) || unitBet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons par bille).' });
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

// ======================== SLIDER (JEU INDÉPENDANT) ========================
exports.playSlider = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = Number(req.body.bet);
    const target = parseFloat(req.body.target) || 50;
    const condition = req.body.condition || req.body.mode || 'under';

    if (!Number.isInteger(bet) || bet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons).' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
    }

    const result = sliderEngine.playSlider(bet, target, condition);
    const { newCoins } = recordGameResult(userId, 'slider', bet, result.payout, result);

    return res.json({
      success: true,
      ...result,
      mode: result.mode || condition,
      condition,
      coins: newCoins,
      data: {
        ...result,
        mode: result.mode || condition,
        condition,
        balance: newCoins,
        coins: newCoins
      }
    });
  } catch (err) {
    console.error('Erreur slider:', err);
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur lors du jeu Slider.' });
  }
};

// ======================== CRASH (FUSÉE COSMIQUE) ========================
exports.getCrashHistory = (req, res) => {
  try {
    const rows = db.prepare('SELECT crash_point FROM crash_history ORDER BY id DESC LIMIT 25').all();
    const history = rows.map(r => r.crash_point);
    return res.json({ history });
  } catch (err) {
    console.error('Erreur historique crash:', err);
    return res.status(500).json({ error: 'Impossible de récupérer l\'historique.' });
  }
};

exports.startCrash = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = Number(req.body.bet);

    if (!Number.isInteger(bet) || bet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons).' });
    }

    const MAX_CRASH_BET = 1000;
    if (bet > MAX_CRASH_BET) {
      return res.status(400).json({ error: 'Mise maximale de 1000 coins pour ce jeu.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
    }

    // Déduction immédiate de la mise et calcul des timestamps
    const gameId = crypto.randomUUID();
    const crashPoint = crashEngine.generateCrashPoint();
    const startedAt = Date.now();
    const durationSec = crashEngine.getDurationForMultiplier(crashPoint);
    const durationMs = Math.round(durationSec * 1000);
    const crashAt = startedAt + durationMs;

    const runTx = db.transaction(() => {
      const updateRes = db.prepare('UPDATE users SET coins = coins - ?, total_wagered = total_wagered + ?, games_played = games_played + 1 WHERE id = ? AND coins >= ?').run(bet, bet, userId, bet);
      if (updateRes.changes === 0) {
        throw new Error('Solde insuffisant.');
      }
      db.prepare(`
        INSERT INTO crash_sessions (id, user_id, bet, crash_point, status, started_at, crash_at)
        VALUES (?, ?, ?, ?, 'running', ?, ?)
      `).run(gameId, userId, bet, crashPoint, startedAt, crashAt);
      return db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins;
    });

    const updatedCoins = runTx();

    return res.json({
      success: true,
      gameId,
      bet,
      crashPoint,
      startedAt,
      crashAt,
      durationMs,
      coins: updatedCoins,
      data: {
        gameId,
        bet,
        crashPoint,
        startedAt,
        crashAt,
        durationMs,
        coins: updatedCoins
      }
    });
  } catch (err) {
    console.error('Erreur démarrage crash:', err);
    return res.status(err.message === 'Solde insuffisant.' ? 400 : 500).json({ error: err.message || 'Erreur lors du démarrage du tour de Crash.' });
  }
};

exports.cashoutCrash = (req, res) => {
  // Enregistrer le timestamp exact de réception de la requête dès la première milliseconde
  const requestReceivedAt = Date.now();

  try {
    const userId = req.user.id;
    const { gameId, multiplier, clientClickedAt } = req.body;
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: 'Identifiant de partie manquant ou invalide.' });
    }
    const userMult = Math.max(1.00, Number(multiplier) || 1.00);

    const session = db.prepare('SELECT * FROM crash_sessions WHERE id = ? AND user_id = ?').get(gameId, userId);
    if (!session) {
      return res.status(404).json({ error: 'Partie introuvable.' });
    }

    if (session.status !== 'running') {
      return res.status(400).json({ error: 'Cette partie est déjà terminée ou encaissée.' });
    }

    const crashPoint = session.crash_point;
    const crashAt = session.crash_at || (session.started_at ? session.started_at + Math.round(crashEngine.getDurationForMultiplier(crashPoint) * 1000) : null);

    // Déterminer le timestamp d'encaissement effectif (timestamp de réception ou clic client vérifié)
    const effectiveClickTime = (clientClickedAt && typeof clientClickedAt === 'number' && clientClickedAt <= requestReceivedAt && (!session.started_at || clientClickedAt >= session.started_at - 100))
      ? clientClickedAt
      : requestReceivedAt;

    // Vérifier si l'encaissement a eu lieu avant le crash :
    // 1. Soit le multiplicateur au clic est inférieur ou égal au crashPoint
    // 2. Soit le timestamp d'encaissement est intervenu avant le timestamp exact du crash déterminé pour ce tour
    const isTimely = crashAt ? (effectiveClickTime <= crashAt || requestReceivedAt <= crashAt) : false;
    const isMultiplierValid = userMult <= crashPoint;

    if (isMultiplierValid || isTimely) {
      // Gain valide : multiplicateur plafonné au crashPoint en cas de décalage minime
      const finalMult = Math.min(userMult, crashPoint);
      const payout = Math.floor(session.bet * finalMult);
      const profit = payout - session.bet;

      const runTx = db.transaction(() => {
        const updateSession = db.prepare(`
          UPDATE crash_sessions
          SET status = 'cashed_out',
              cashed_multiplier = ?,
              payout = ?
          WHERE id = ? AND status = 'running'
        `).run(finalMult, payout, gameId);

        if (updateSession.changes === 0) {
          throw new Error('Partie déjà clôturée.');
        }

        db.prepare(`
          UPDATE users
          SET coins = coins + ?,
              total_won = total_won + ?,
              biggest_win = MAX(biggest_win, ?)
          WHERE id = ?
        `).run(payout, payout, payout, userId);

        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'crash', ?, ?, ?, ?)
        `).run(userId, session.bet, payout, profit, JSON.stringify({
          multiplier: finalMult,
          crashPoint,
          clickTimestamp: effectiveClickTime,
          requestReceivedAt,
          crashAt,
          outcome: 'cashed_out'
        }));

        db.prepare('INSERT INTO crash_history (crash_point) VALUES (?)').run(crashPoint);

        return db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins;
      });

      const updatedCoins = runTx();

      try {
        contestService.recordGameProgress(userId, 'crash', session.bet, payout, {
          multiplier: finalMult,
          crashPoint,
          isWin: true
        });
      } catch (cErr) {}

      try {
        socketService.notifyUserBalance(userId, updatedCoins);
        socketService.notifyLeaderboardUpdated();
        if (profit > 0) {
          const u = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
          socketService.notifyNewWin({
            username: u ? u.username : 'Joueur',
            game_type: 'crash',
            profit,
            payout,
            created_at: new Date().toISOString()
          });
        }
      } catch (sockErr) {}

      return res.json({
        success: true,
        won: true,
        multiplier: finalMult,
        payout,
        profit,
        crashPoint,
        coins: updatedCoins,
        data: {
          won: true,
          multiplier: finalMult,
          payout,
          profit,
          crashPoint,
          coins: updatedCoins
        }
      });
    } else {
      // Trop tard : partie crashée avant l'encaissement
      db.transaction(() => {
        db.prepare(`
          UPDATE crash_sessions
          SET status = 'crashed',
              payout = 0
          WHERE id = ?
        `).run(gameId);

        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'crash', ?, 0, ?, ?)
        `).run(userId, session.bet, -session.bet, JSON.stringify({
          multiplier: userMult,
          crashPoint,
          clickTimestamp: effectiveClickTime,
          requestReceivedAt,
          crashAt,
          outcome: 'crashed'
        }));

        db.prepare('INSERT INTO crash_history (crash_point) VALUES (?)').run(crashPoint);
      })();

      try {
        contestService.recordGameProgress(userId, 'crash', session.bet, 0, {
          multiplier: 0,
          crashPoint,
          isWin: false
        });
      } catch (cErr) {}

      const currentCoins = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins;

      return res.json({
        success: true,
        won: false,
        multiplier: 0,
        payout: 0,
        profit: -session.bet,
        crashPoint,
        coins: currentCoins,
        data: {
          won: false,
          multiplier: 0,
          payout: 0,
          profit: -session.bet,
          crashPoint,
          coins: currentCoins
        }
      });
    }
  } catch (err) {
    console.error('Erreur cashout crash:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de l\'encaissement.' });
  }
};

exports.finishCrash = (req, res) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.body;
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: 'Identifiant de partie manquant ou invalide.' });
    }

    const session = db.prepare('SELECT * FROM crash_sessions WHERE id = ? AND user_id = ?').get(gameId, userId);
    if (!session || session.status !== 'running') {
      return res.json({ success: true });
    }

    const crashPoint = session.crash_point;

    db.transaction(() => {
      const updateRes = db.prepare(`
        UPDATE crash_sessions
        SET status = 'crashed',
            payout = 0
        WHERE id = ? AND status = 'running'
      `).run(gameId);
      if (updateRes.changes > 0) {
        db.prepare(`
          INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
          VALUES (?, 'crash', ?, 0, ?, ?)
        `).run(userId, session.bet, -session.bet, JSON.stringify({
          crashPoint,
          outcome: 'crashed'
        }));

        db.prepare('INSERT INTO crash_history (crash_point) VALUES (?)').run(crashPoint);
      }
    })();

    return res.json({
      success: true,
      crashPoint
    });
  } catch (err) {
    console.error('Erreur finish crash:', err);
    return res.status(500).json({ error: 'Erreur lors de la clôture du tour.' });
  }
};
