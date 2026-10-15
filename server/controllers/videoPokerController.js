const db = require('../database/db');
const videoPokerEngine = require('../services/games/videoPokerEngine');
const socketService = require('../services/socketService');
const { recordGameResult } = require('./gameController');

exports.getState = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare('SELECT * FROM videopoker_sessions WHERE user_id = ?').get(userId);

    if (session && session.status === 'deal') {
      const hand = JSON.parse(session.hand);
      const initialEvaluation = videoPokerEngine.evaluateHand(hand);
      return res.json({
        activeGame: true,
        hand,
        bet: session.bet,
        status: session.status,
        initialEvaluation,
        paytable: videoPokerEngine.PAYTABLE
      });
    }

    return res.json({
      activeGame: false,
      paytable: videoPokerEngine.PAYTABLE
    });
  } catch (err) {
    console.error('Erreur getVideoPokerState:', err);
    return res.status(500).json({ error: 'Impossible de charger la session de vidéo poker.' });
  }
};

exports.deal = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet, 10);

    if (isNaN(bet) || bet < 10) {
      return res.status(400).json({ error: 'La mise minimale est de 10 coins.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
    }

    // Vérifier s'il y a déjà une main non terminée
    const existing = db.prepare('SELECT status, bet FROM videopoker_sessions WHERE user_id = ?').get(userId);
    if (existing && existing.status === 'deal') {
      return res.status(400).json({ error: 'Une main est déjà en cours. Choisis tes cartes à garder et clique sur Tirer.' });
    }

    // Tirage des cartes sécurisé côté serveur
    const deck = videoPokerEngine.createShuffledDeck();
    const hand = deck.slice(0, 5);
    const remainingDeck = deck.slice(5);

    // Déduction atomique de la mise
    let newCoins = 0;
    const deductTx = db.transaction(() => {
      const deduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?')
        .run(bet, userId, bet);
      if (deduct.changes === 0) {
        throw new Error('Solde insuffisant.');
      }

      db.prepare(`
        INSERT INTO videopoker_sessions (user_id, deck, hand, bet, status)
        VALUES (?, ?, ?, ?, 'deal')
        ON CONFLICT(user_id) DO UPDATE SET
          deck = excluded.deck,
          hand = excluded.hand,
          bet = excluded.bet,
          status = 'deal',
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, JSON.stringify(remainingDeck), JSON.stringify(hand), bet);

      const u = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
      newCoins = u.coins;
    });

    deductTx();

    try {
      socketService.notifyUserBalance(userId, newCoins);
    } catch (e) {}

    const initialEvaluation = videoPokerEngine.evaluateHand(hand);

    return res.json({
      hand,
      bet,
      status: 'deal',
      userCoins: newCoins,
      initialEvaluation,
      paytable: videoPokerEngine.PAYTABLE
    });
  } catch (err) {
    console.error('Erreur deal video poker:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors de la distribution.' });
  }
};

exports.draw = (req, res) => {
  try {
    const userId = req.user.id;
    const holds = Array.isArray(req.body.holds) ? req.body.holds.map(h => parseInt(h, 10)) : [];

    const session = db.prepare('SELECT * FROM videopoker_sessions WHERE user_id = ?').get(userId);
    if (!session || session.status !== 'deal') {
      return res.status(400).json({ error: 'Aucune main en cours à tirer.' });
    }

    const currentHand = JSON.parse(session.hand);
    const remainingDeck = JSON.parse(session.deck);
    const bet = session.bet;

    // Remplacement des cartes non gardées
    const finalHand = [...currentHand];
    const replacedIndices = [];

    for (let i = 0; i < 5; i++) {
      if (!holds.includes(i)) {
        if (remainingDeck.length === 0) {
          throw new Error('Erreur de sabot : plus de cartes disponibles.');
        }
        finalHand[i] = remainingDeck.shift();
        replacedIndices.push(i);
      }
    }

    // Évaluation finale
    const evaluation = videoPokerEngine.evaluateHand(finalHand);
    const payout = Math.floor(bet * evaluation.multiplier);
    const profit = payout - bet;

    // Enregistrement via recordGameResult (alreadyDeducted = true car la mise a été déduite au deal initial)
    const tx = recordGameResult(userId, 'video-poker', bet, payout, {
      hand: finalHand,
      holds,
      rank: evaluation.id,
      multiplier: evaluation.multiplier,
      rankName: evaluation.name
    }, true);

    // Supprimer la session terminée
    db.prepare('DELETE FROM videopoker_sessions WHERE user_id = ?').run(userId);

    return res.json({
      finalHand,
      replacedIndices,
      evaluation,
      payout,
      profit,
      isWin: evaluation.isWin,
      userCoins: tx.newCoins
    });
  } catch (err) {
    console.error('Erreur draw video poker:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors du tirage final.' });
  }
};
