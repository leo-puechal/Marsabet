const db = require('../database/db');
const vipService = require('../services/vipService');

exports.getLeaderboard = (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const leaders = db.prepare(`
      SELECT id, username, coins, daily_streak, games_played, biggest_win, total_wagered, vip_rank, created_at
      FROM users
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

    // Si l'utilisateur est connecté, récupérer son rang
    let userRank = null;
    if (req.user) {
      const rankRow = db.prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM users
        WHERE coins > (SELECT coins FROM users WHERE id = ?)
      `).get(req.user.id);
      userRank = rankRow ? rankRow.rank : null;
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
    const userId = req.user.id;

    const user = db.prepare(`
      SELECT id, username, role, coins, daily_streak, last_daily_claim, last_free_spin, free_spin_streak, total_wagered, total_won, games_played, biggest_win, created_at
      FROM users WHERE id = ?
    `).get(userId);

    const vipInfo = vipService.getVipInfo(user.total_wagered);

    const rankRow = db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE coins > ?
    `).get(user.coins);

    // 20 dernières parties
    const history = db.prepare(`
      SELECT id, game_type, bet, payout, profit, details, created_at
      FROM game_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).all(userId);

    // Statistiques par type de jeu
    const statsByGame = db.prepare(`
      SELECT game_type, COUNT(*) as count, SUM(bet) as total_bet, SUM(payout) as total_payout, SUM(profit) as net_profit
      FROM game_history
      WHERE user_id = ? AND game_type != 'daily_bonus'
      GROUP BY game_type
    `).all(userId);

    // Commandes et codes de retrait de la boutique BDE
    const orders = db.prepare(`
      SELECT o.id, o.claim_code, o.item_name, o.coins_paid, o.status, o.collected_at, o.created_at,
             i.icon, i.category
      FROM shop_orders o
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);

    return res.json({
      user: {
        ...user,
        rank: rankRow ? rankRow.rank : 1
      },
      vipInfo,
      history: history.map(h => ({
        ...h,
        details: h.details ? JSON.parse(h.details) : null
      })),
      statsByGame,
      orders
    });
  } catch (err) {
    console.error('Erreur profil:', err);
    return res.status(500).json({ error: 'Impossible de charger le profil.' });
  }
};

exports.getShopItems = (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des articles.' });
  }
};

exports.buyShopItem = (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'Identifiant de l’article manquant.' });
  }

  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'Article introuvable dans le catalogue BDE.' });
  }

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < item.price) {
    return res.status(400).json({ error: `Solde insuffisant ! Il te manque ${item.price - user.coins} jetons.` });
  }

  const transaction = db.transaction(() => {
    const newCoins = user.coins - item.price;
    db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newCoins, userId);
    db.prepare('INSERT INTO shop_purchases (user_id, item_id) VALUES (?, ?)').run(userId, item.id);
    return newCoins;
  });

  try {
    const newCoins = transaction();
    return res.json({
      message: `Félicitations ! Tu as échangé tes jetons contre : ${item.name} (${item.icon}) !`,
      item,
      coins: newCoins
    });
  } catch (err) {
    console.error('Erreur achat shop:', err);
    return res.status(500).json({ error: 'Échec de la transaction.' });
  }
};
