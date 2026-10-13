const db = require('../database/db');
const dragonTowerEngine = require('../services/games/dragonTowerEngine');
const socketService = require('../services/socketService');
const { recordGameResult } = require('./gameController');

exports.getState = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare('SELECT * FROM dragontower_sessions WHERE user_id = ?').get(userId);

    // Historique des 10 dernières parties Dragon Tower du joueur
    const recentHistory = db.prepare(`
      SELECT id, bet, payout, profit, details, created_at
      FROM game_history
      WHERE user_id = ? AND game_type = 'dragon-tower'
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId).map(h => {
      let parsed = {};
      try { parsed = JSON.parse(h.details); } catch (e) {}
      return {
        id: h.id,
        bet: h.bet,
        payout: h.payout,
        profit: h.profit,
        floorReached: parsed.floorReached || 1,
        difficulty: parsed.difficulty || 'medium',
        multiplier: parsed.multiplier || 0,
        outcome: parsed.outcome || (h.profit > 0 ? 'win' : 'loss'),
        createdAt: h.created_at
      };
    });

    if (session && session.status === 'playing') {
      const diff = dragonTowerEngine.DIFFICULTIES[session.difficulty] || dragonTowerEngine.DIFFICULTIES.medium;
      const revealed = JSON.parse(session.revealed || '[]');
      const completedFloors = session.current_floor - 1;
      const currentMultiplier = completedFloors > 0 ? diff.multipliers[completedFloors - 1] : 1.0;
      const potentialPayout = Math.floor(session.bet * currentMultiplier);

      return res.json({
        activeGame: true,
        bet: session.bet,
        difficulty: session.difficulty,
        diffConfig: diff,
        currentFloor: session.current_floor,
        currentMultiplier,
        potentialPayout,
        revealed,
        difficulties: dragonTowerEngine.DIFFICULTIES,
        totalFloors: dragonTowerEngine.TOTAL_FLOORS,
        recentHistory
      });
    }

    return res.json({
      activeGame: false,
      difficulties: dragonTowerEngine.DIFFICULTIES,
      totalFloors: dragonTowerEngine.TOTAL_FLOORS,
      recentHistory
    });
  } catch (err) {
    console.error('Erreur getDragonTowerState:', err);
    return res.status(500).json({ error: 'Impossible de charger la session Dragon Tower.' });
  }
};

exports.start = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = parseInt(req.body.bet, 10);
    const difficultyKey = req.body.difficulty || 'medium';

    if (isNaN(bet) || bet < 10) {
      return res.status(400).json({ error: 'La mise minimale est de 10 coins.' });
    }

    const diff = dragonTowerEngine.DIFFICULTIES[difficultyKey];
    if (!diff) {
      return res.status(400).json({ error: 'Difficulté invalide.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour cette mise.' });
    }

    // Vérifier si une partie est déjà en cours
    const existing = db.prepare('SELECT status, bet FROM dragontower_sessions WHERE user_id = ?').get(userId);
    if (existing && existing.status === 'playing') {
      return res.status(400).json({ error: 'Une ascension est déjà en cours. Termine-la ou encaisse avant d\'en lancer une nouvelle.' });
    }

    // Génération des 9 pièges côté serveur (un par étage, strictement secret)
    const traps = dragonTowerEngine.generateTraps(difficultyKey);

    // Déduction atomique de la mise
    let newCoins = 0;
    const deductTx = db.transaction(() => {
      const deduct = db.prepare('UPDATE users SET coins = coins - ?, total_wagered = total_wagered + ? WHERE id = ? AND coins >= ?')
        .run(bet, bet, userId, bet);
      if (deduct.changes === 0) {
        throw new Error('Solde insuffisant.');
      }

      db.prepare(`
        INSERT INTO dragontower_sessions (
          user_id, bet, difficulty, tiles_per_floor, traps_per_floor,
          total_floors, current_floor, traps, revealed, current_multiplier, status
        )
        VALUES (?, ?, ?, ?, 1, 9, 1, ?, '[]', 1.0, 'playing')
        ON CONFLICT(user_id) DO UPDATE SET
          bet = excluded.bet,
          difficulty = excluded.difficulty,
          tiles_per_floor = excluded.tiles_per_floor,
          traps_per_floor = 1,
          total_floors = 9,
          current_floor = 1,
          traps = excluded.traps,
          revealed = '[]',
          current_multiplier = 1.0,
          status = 'playing',
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, bet, difficultyKey, diff.tilesPerFloor, JSON.stringify(traps));

      const u = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
      newCoins = u.coins;
    });

    deductTx();

    try {
      socketService.notifyUserBalance(userId, newCoins);
    } catch (e) {}

    return res.json({
      bet,
      difficulty: difficultyKey,
      diffConfig: diff,
      currentFloor: 1,
      currentMultiplier: 1.0,
      potentialPayout: bet,
      revealed: [],
      userCoins: newCoins,
      status: 'playing'
    });
  } catch (err) {
    console.error('Erreur start Dragon Tower:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors du démarrage.' });
  }
};

exports.step = (req, res) => {
  try {
    const userId = req.user.id;
    const tileIndex = parseInt(req.body.tileIndex, 10);

    const session = db.prepare('SELECT * FROM dragontower_sessions WHERE user_id = ?').get(userId);
    if (!session || session.status !== 'playing') {
      return res.status(400).json({ error: 'Aucune ascension en cours.' });
    }

    const diff = dragonTowerEngine.DIFFICULTIES[session.difficulty] || dragonTowerEngine.DIFFICULTIES.medium;
    if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= diff.tilesPerFloor) {
      return res.status(400).json({ error: 'Emplacement de case invalide.' });
    }

    const currentFloor = session.current_floor; // 1 à 9
    const floorIndex = currentFloor - 1; // 0 à 8
    const traps = JSON.parse(session.traps);
    const revealed = JSON.parse(session.revealed || '[]');
    const currentTrap = traps[floorIndex];

    // 1. CAS DU PIÈGE (Œuf de dragon touché)
    if (tileIndex === currentTrap) {
      revealed.push({ floor: currentFloor, tile: tileIndex, status: 'trap' });

      const tx = recordGameResult(userId, 'dragon-tower', session.bet, 0, {
        floorReached: currentFloor,
        difficulty: session.difficulty,
        outcome: 'trap',
        steppedTile: tileIndex
      }, true);

      db.prepare('DELETE FROM dragontower_sessions WHERE user_id = ?').run(userId);

      return res.json({
        status: 'lost',
        isTrap: true,
        steppedTile: tileIndex,
        trapTile: currentTrap,
        floor: currentFloor,
        allTraps: traps,
        payout: 0,
        profit: -session.bet,
        userCoins: tx.newCoins
      });
    }

    // 2. CAS D'UNE CASE SÛRE
    revealed.push({ floor: currentFloor, tile: tileIndex, status: 'safe' });
    const floorMultiplier = diff.multipliers[floorIndex];
    const potentialPayout = Math.floor(session.bet * floorMultiplier);

    // Vérifier si c'est le sommet (9ème étage réussi)
    if (currentFloor === dragonTowerEngine.TOTAL_FLOORS) {
      const payout = potentialPayout;
      const profit = payout - session.bet;

      const tx = recordGameResult(userId, 'dragon-tower', session.bet, payout, {
        floorReached: 9,
        difficulty: session.difficulty,
        outcome: 'top_reached',
        multiplier: floorMultiplier
      }, true);

      db.prepare('DELETE FROM dragontower_sessions WHERE user_id = ?').run(userId);

      return res.json({
        status: 'completed',
        isTopReached: true,
        isTrap: false,
        steppedTile: tileIndex,
        floor: 9,
        multiplier: floorMultiplier,
        payout,
        profit,
        allTraps: traps,
        userCoins: tx.newCoins
      });
    }

    // Sinon, passage à l'étage suivant
    const nextFloor = currentFloor + 1;
    db.prepare(`
      UPDATE dragontower_sessions
      SET current_floor = ?, revealed = ?, current_multiplier = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(nextFloor, JSON.stringify(revealed), floorMultiplier, userId);

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

    return res.json({
      status: 'safe',
      isTrap: false,
      steppedTile: tileIndex,
      floor: currentFloor,
      nextFloor,
      currentMultiplier: floorMultiplier,
      nextMultiplier: diff.multipliers[floorIndex + 1],
      potentialPayout,
      userCoins: user.coins
    });
  } catch (err) {
    console.error('Erreur step Dragon Tower:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors de l\'ascension.' });
  }
};

exports.cashout = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare('SELECT * FROM dragontower_sessions WHERE user_id = ?').get(userId);

    if (!session || session.status !== 'playing') {
      return res.status(400).json({ error: 'Aucune ascension en cours à encaisser.' });
    }

    if (session.current_floor <= 1) {
      return res.status(400).json({ error: 'Tu dois franchir au moins un étage avant d\'encaisser.' });
    }

    const diff = dragonTowerEngine.DIFFICULTIES[session.difficulty] || dragonTowerEngine.DIFFICULTIES.medium;
    const completedFloors = session.current_floor - 1;
    const multiplier = diff.multipliers[completedFloors - 1];
    const payout = Math.floor(session.bet * multiplier);
    const profit = payout - session.bet;
    const traps = JSON.parse(session.traps);

    const tx = recordGameResult(userId, 'dragon-tower', session.bet, payout, {
      floorReached: completedFloors,
      difficulty: session.difficulty,
      outcome: 'cashout',
      multiplier
    }, true);

    db.prepare('DELETE FROM dragontower_sessions WHERE user_id = ?').run(userId);

    return res.json({
      status: 'cashed_out',
      floor: completedFloors,
      multiplier,
      payout,
      profit,
      allTraps: traps,
      userCoins: tx.newCoins
    });
  } catch (err) {
    console.error('Erreur cashout Dragon Tower:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors de l\'encaissement.' });
  }
};
