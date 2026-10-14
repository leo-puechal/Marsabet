const db = require('../database/db');
const vipService = require('../services/vipService');

exports.getLeaderboard = (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const leaders = db.prepare(`
      SELECT id, username, coins, daily_streak, games_played, biggest_win, total_wagered, vip_rank, created_at
      FROM users
      WHERE role NOT IN ('admin', 'bde')
      ORDER BY coins DESC, biggest_win DESC
      LIMIT ?
    `).all(limit);

    // Enrichir chaque joueur avec son statut VIP
    const enrichedLeaders = leaders.map(l => {
      const vip = vipService.getVipInfo(l.total_wagered);
      return {
        ...l,
        vipRank: vip.currentTier.name,
        vipIcon: vip.currentTier.icon,
        vipColor: vip.currentTier.color,
        vipBadgeClass: vip.currentTier.badgeClass
      };
    });

    // Si l'utilisateur est connecté, récupérer son rang (uniquement pour les élèves)
    let userRank = null;
    if (req.user) {
      const currentUser = db.prepare('SELECT role, coins FROM users WHERE id = ?').get(req.user.id);
      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'bde') {
        const rankRow = db.prepare(`
          SELECT COUNT(*) + 1 as rank
          FROM users
          WHERE role NOT IN ('admin', 'bde') AND coins > ?
        `).get(currentUser.coins);
        userRank = rankRow ? rankRow.rank : null;
      }
    }

    return res.json({
      leaderboard: enrichedLeaders,
      userRank
    });
  } catch (err) {
    console.error('Erreur leaderboard:', err);
    return res.status(500).json({ error: 'Impossible de charger le classement.' });
  }
};

exports.getProfile = (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const user = db.prepare(`
      SELECT id, username, first_name, last_name, role, coins, daily_streak, last_daily_claim, last_free_spin, free_spin_streak, total_wagered, total_won, games_played, biggest_win, created_at
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const safeUser = {
      ...user,
      coins: user.coins ?? 0,
      total_wagered: user.total_wagered ?? 0,
      total_won: user.total_won ?? 0,
      games_played: user.games_played ?? 0,
      biggest_win: user.biggest_win ?? 0,
      daily_streak: user.daily_streak ?? 0,
      role: user.role || 'student'
    };

    const vipInfo = vipService.getVipInfo(safeUser.total_wagered);

    const isStaff = safeUser.role === 'admin' || safeUser.role === 'bde';
    let userRank = 1;
    if (!isStaff) {
      try {
        const rankRow = db.prepare(`
          SELECT COUNT(*) + 1 as rank
          FROM users
          WHERE role NOT IN ('admin', 'bde') AND coins > ?
        `).get(safeUser.coins);
        if (rankRow) userRank = rankRow.rank;
      } catch (e) {
        userRank = 1;
      }
    }

    // 25 dernières parties avec parsing JSON sécurisé
    let rawHistory = [];
    try {
      rawHistory = db.prepare(`
        SELECT id, game_type, bet, payout, profit, details, created_at
        FROM game_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 25
      `).all(userId) || [];
    } catch (e) {
      rawHistory = [];
    }

    const history = rawHistory.map(h => {
      let detailsObj = null;
      if (h.details) {
        try {
          detailsObj = typeof h.details === 'object' ? h.details : JSON.parse(h.details);
        } catch (e) {
          detailsObj = { raw: h.details };
        }
      }
      return {
        id: h.id,
        game_type: h.game_type || 'unknown',
        bet: h.bet ?? 0,
        payout: h.payout ?? 0,
        profit: h.profit ?? 0,
        details: detailsObj,
        created_at: h.created_at
      };
    });

    // Statistiques par type de jeu
    let statsByGame = [];
    try {
      statsByGame = db.prepare(`
        SELECT game_type, COUNT(*) as count, SUM(bet) as total_bet, SUM(payout) as total_payout, SUM(profit) as net_profit
        FROM game_history
        WHERE user_id = ? AND game_type != 'daily_bonus'
        GROUP BY game_type
      `).all(userId) || [];
    } catch (e) {
      statsByGame = [];
    }

    // Demandes de livraison directe de la boutique BDE et roues de la fortune
    let orders = [];
    try {
      const rawOrders = db.prepare(`
        SELECT d.id, d.last_name, d.first_name, d.room_location, d.phone,
               d.item_id, d.item_name, d.variant_name, d.quantity, d.coins_paid, d.status,
               d.email_status, d.delivered_at, d.created_at, d.source
        FROM delivery_orders d
        WHERE d.user_id = ?
        ORDER BY d.created_at DESC
      `).all(userId) || [];

      orders = rawOrders.map(o => {
        let icon = '🎁';
        let category = 'snack';
        const name = (o.item_name || '').toLowerCase();
        if (name.includes('red bull') || name.includes('monster')) {
          icon = '⚡';
          category = 'energie';
        } else if (name.includes('canette') || name.includes('coca') || name.includes('boisson') || name.includes('oasis') || name.includes('fuze')) {
          icon = '🥤';
          category = 'boisson';
        } else if (name.includes('chocolat') || name.includes('kinder') || name.includes('kitkat')) {
          icon = '🍫';
          category = 'snack';
        }
        return { ...o, icon, category };
      });
    } catch (e) {
      orders = [];
    }

    return res.json({
      success: true,
      user: {
        ...safeUser,
        rank: userRank
      },
      vipInfo: {
        ...vipInfo,
        wager: safeUser.total_wagered
      },
      wager: safeUser.total_wagered,
      history,
      statsByGame,
      orders,
      deliveries: orders,
      inventory: orders
    });
  } catch (err) {
    console.error('Erreur profil:', err);
    return res.status(500).json({ error: 'Impossible de charger le profil.' });
  }
};

// ======================== RÉDEMPTION DE CODES PROMO ========================
const promoCodeService = require('../services/promoCodeService');

exports.redeemPromoCode = (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Veuillez saisir un code promo.' });
    }

    const result = promoCodeService.redeemCode(code, userId);
    return res.json({
      ...result,
      coins: result.newCoins
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors de l\'activation du code promo.' });
  }
};

exports.getMyPromoCodes = (req, res) => {
  try {
    const userId = req.user.id;
    const redemptions = promoCodeService.getUserRedemptions(userId);
    return res.json({ redemptions });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des codes.' });
  }
};
