const db = require('../database/db');
const fortuneWheelService = require('../services/fortuneWheelService');
const promoCodeService = require('../services/promoCodeService');
const socketService = require('../services/socketService');
const presenceService = require('../services/presenceService');

// Récupérer toutes les demandes de livraison directe pour le suivi BDE
exports.getAllDeliveries = (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT d.id, d.last_name, d.first_name, d.room_location, d.phone, d.notes,
             d.item_id, d.item_name, d.variant_name, d.quantity, d.coins_paid,
             d.source, d.status, d.email_status, d.email_error, d.delivered_at, d.created_at,
             u.username, u.id as user_id, admin.username as delivered_by_admin
      FROM delivery_orders d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN users admin ON d.delivered_by = admin.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      query += ' AND (u.username LIKE ? OR d.last_name LIKE ? OR d.first_name LIKE ? OR d.room_location LIKE ? OR d.item_name LIKE ? OR d.notes LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY d.created_at DESC LIMIT 150';

    const rawDeliveries = db.prepare(query).all(...params);
    const deliveries = rawDeliveries.map(d => {
      let icon = '🎁';
      const name = (d.item_name || '').toLowerCase();
      if (name.includes('red bull') || name.includes('monster')) icon = '⚡';
      else if (name.includes('canette') || name.includes('coca') || name.includes('boisson') || name.includes('oasis') || name.includes('fuze')) icon = '🥤';
      else if (name.includes('chocolat') || name.includes('kinder') || name.includes('kitkat') || name.includes('snack')) icon = '🍫';
      return { ...d, icon };
    });
    return res.json({ deliveries, orders: deliveries });
  } catch (err) {
    console.error('Erreur récupération livraisons admin:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des livraisons.' });
  }
};

// Alias de rétrocompatibilité pour les requêtes existantes
exports.getAllOrders = exports.getAllDeliveries;

// Marquer une livraison comme effectuée ("Livré")
exports.markDelivered = (req, res) => {
  try {
    const adminId = req.user.id;
    const deliveryId = req.params.id || req.body.id;

    if (!deliveryId) {
      return res.status(400).json({ error: 'Identifiant de livraison manquant.' });
    }

    const delivery = db.prepare(`
      SELECT d.*, u.username
      FROM delivery_orders d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `).get(deliveryId);

    if (!delivery) {
      return res.status(404).json({ error: 'Demande de livraison introuvable.' });
    }

    if (delivery.status === 'delivered') {
      return res.status(409).json({
        error: `Cette commande a déjà été marquée comme livrée le ${new Date(delivery.delivered_at).toLocaleString('fr-FR')}.`,
        delivery
      });
    }

    db.prepare(`
      UPDATE delivery_orders
      SET status = 'delivered',
          delivered_at = CURRENT_TIMESTAMP,
          delivered_by = ?
      WHERE id = ?
    `).run(adminId, deliveryId);

    const updated = db.prepare(`
      SELECT d.*, u.username, admin.username as delivered_by_admin
      FROM delivery_orders d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN users admin ON d.delivered_by = admin.id
      WHERE d.id = ?
    `).get(deliveryId);

    try {
      socketService.notifyOrdersUpdated();
    } catch (sockErr) {}

    return res.json({
      success: true,
      message: `Commande #${deliveryId} marquée comme livrée à ${delivery.first_name} ${delivery.last_name} (${delivery.room_location}) !`,
      delivery: updated
    });
  } catch (err) {
    console.error('Erreur validation livraison admin:', err);
    return res.status(500).json({ error: 'Erreur lors de la validation de la livraison.' });
  }
};


// ======================== CODES PROMO ADMIN ========================
exports.getPromoCodes = (req, res) => {
  try {
    const codes = promoCodeService.listPromoCodes();
    return res.json({ codes });
  } catch (err) {
    console.error('Erreur getPromoCodes:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des codes promo.' });
  }
};

exports.createPromoCode = (req, res) => {
  try {
    const { code, coinsAmount, maxUses, expiresAt } = req.body;
    const createdBy = req.user.id;

    const newCode = promoCodeService.createPromoCode({
      code,
      coinsAmount,
      maxUses,
      expiresAt,
      createdBy
    });

    return res.status(201).json({
      message: `Code promo "${newCode.code}" créé avec succès !`,
      code: newCode
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors de la création du code promo.' });
  }
};

exports.togglePromoCode = (req, res) => {
  try {
    const { id } = req.params;
    const result = promoCodeService.togglePromoCode(id);
    return res.json({
      message: `Code promo "${result.code}" ${result.isActive ? 'activé' : 'désactivé'}.`,
      result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour du code promo.' });
  }
};

exports.deletePromoCode = (req, res) => {
  try {
    const { id } = req.params;
    const result = promoCodeService.deletePromoCode(id);
    return res.json({
      message: `Code promo "${result.code}" supprimé définitivement.`,
      result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors de la suppression du code promo.' });
  }
};

// ========================================================
// GESTION DYNAMIQUE DES RÉCOMPENSES DE ROUES (ADMIN BDE)
// ========================================================

// Récupérer la liste des roues et leurs segments pour l'interface admin
exports.getWheelsAdmin = (req, res) => {
  try {
    const wheels = fortuneWheelService.getAllWheelsAdmin();
    const availableProducts = [
      { id: 'canette', name: 'Canette au choix (Coca, Oasis, Fuze Tea...)', category: 'boisson', icon: '🥤' },
      { id: 'chocolat', name: 'Chocolat au choix (Kinder Bueno, KitKat...)', category: 'snack', icon: '🍫' },
      { id: 'redbull', name: 'Canette Red Bull (Saveur au choix)', category: 'energie', icon: '⚡' }
    ];
    return res.json({
      wheels,
      availableProducts
    });
  } catch (err) {
    console.error('Erreur getWheelsAdmin:', err);
    return res.status(500).json({ error: 'Impossible de charger la configuration des roues.' });
  }
};

// Sauvegarder les modifications d'une roue (ajout, modification, suppression de segments)
exports.updateWheelSegments = (req, res) => {
  try {
    const { id } = req.params;
    const { segments } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Identifiant de roue manquant.' });
    }

    if (!Array.isArray(segments) || segments.length < 2) {
      return res.status(400).json({ error: 'Une roue doit obligatoirement comporter au moins 2 segments.' });
    }

    const updatedWheel = fortuneWheelService.updateWheelSegments(id, segments);

    return res.json({
      success: true,
      message: `Récompenses de la roue "${updatedWheel.name}" sauvegardées avec succès !`,
      wheel: updatedWheel
    });
  } catch (err) {
    console.error('Erreur updateWheelSegments:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour des segments de la roue.' });
  }
};

// ========================================================
// GESTION DES UTILISATEURS (ADMIN BDE)
// ========================================================

// Récupérer la liste des utilisateurs avec filtres, recherche et statistiques
exports.getAllUsers = (req, res) => {
  try {
    const { search, role, sortBy = 'coins', sortOrder = 'desc' } = req.query;

    let query = `
      SELECT id, username, first_name, last_name, coins, role, daily_streak, last_daily_claim,
             total_wagered, total_won, games_played, biggest_win, created_at
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'all') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search && search.trim()) {
      query += ' AND (username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    const allowedSort = ['coins', 'username', 'created_at', 'total_wagered', 'games_played', 'biggest_win'];
    const col = allowedSort.includes(sortBy) ? sortBy : 'coins';
    const ord = (sortOrder && sortOrder.toLowerCase() === 'asc') ? 'ASC' : 'DESC';

    query += ` ORDER BY ${col} ${ord} LIMIT 250`;

    const users = db.prepare(query).all(...params);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalUsers,
        COALESCE(SUM(coins), 0) as totalCoins,
        COALESCE(SUM(games_played), 0) as totalGamesPlayed
      FROM users
    `).get();

    return res.json({
      users,
      stats: {
        totalUsers: stats.totalUsers || 0,
        totalCoins: stats.totalCoins || 0,
        totalGamesPlayed: stats.totalGamesPlayed || 0
      }
    });
  } catch (err) {
    console.error('Erreur getAllUsers admin:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des utilisateurs.' });
  }
};

// Modifier le solde de pièces d'un utilisateur (définir, ajouter ou déduire)
exports.updateUserCoins = (req, res) => {
  try {
    const { id } = req.params;
    const { coins, mode = 'set', reason } = req.body;

    const cleanReason = (typeof reason === 'string' && reason.trim().length >= 2)
      ? reason.trim()
      : 'Ajustement administrateur BDE';

    const targetUser = db.prepare('SELECT id, username, coins, role FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    let parsedAmount = Number(coins);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount > 1000000000) {
      return res.status(400).json({ error: 'Le montant de pièces doit être un nombre entier (maximum 1 000 000 000).' });
    }

    let newBalance = targetUser.coins;
    if (mode === 'set') {
      if (parsedAmount < 0) return res.status(400).json({ error: 'Le solde ne peut pas être négatif.' });
      newBalance = parsedAmount;
    } else if (mode === 'add') {
      if (parsedAmount <= 0) return res.status(400).json({ error: 'Le montant à ajouter doit être supérieur à 0.' });
      newBalance = targetUser.coins + parsedAmount;
    } else if (mode === 'subtract') {
      if (parsedAmount <= 0) return res.status(400).json({ error: 'Le montant à déduire doit être supérieur à 0.' });
      if (targetUser.coins < parsedAmount) return res.status(400).json({ error: 'Le solde de l\'élève est insuffisant pour cette déduction.' });
      newBalance = targetUser.coins - parsedAmount;
    } else {
      return res.status(400).json({ error: 'Mode d\'ajustement invalide (set, add, subtract).' });
    }

    db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, id);

    // Enregistrer transaction dans l'audit des ajustements admin et transactions
    const amountDiff = newBalance - targetUser.coins;
    const adminId = req.user ? req.user.id : 0;
    const adminUsername = req.user ? req.user.username : 'admin';

    try {
      db.prepare(`
        INSERT INTO admin_adjustments (user_id, admin_id, admin_username, amount, previous_balance, new_balance, mode, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, adminId, adminUsername, amountDiff, targetUser.coins, newBalance, mode, cleanReason);

      db.prepare(`
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (?, ?, 'admin_adjustment', ?)
      `).run(id, amountDiff, cleanReason);
    } catch (e) {
      console.error('Erreur insertion audit admin_adjustments:', e);
    }

    // Notifier l'utilisateur en temps réel via WebSocket s'il est connecté
    try {
      socketService.notifyUserBalance(id, newBalance);
      socketService.notifyLeaderboardUpdated();
    } catch (sockErr) {}

    return res.json({
      success: true,
      message: `Solde de "${targetUser.username}" mis à jour : ${newBalance.toLocaleString('fr-FR')} 🪙`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        coins: newBalance,
        role: targetUser.role
      }
    });
  } catch (err) {
    console.error('Erreur updateUserCoins admin:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification du solde.' });
  }
};

// Récupérer la fiche détaillée complète d'un joueur pour l'admin
exports.getUserDetails = (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const user = db.prepare(`
      SELECT id, username, first_name, last_name, email, role, coins, daily_streak,
             last_daily_claim, total_wagered, total_won, games_played, biggest_win,
             registration_ip, email_verified, created_at
      FROM users
      WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const vipService = require('../services/vipService');
    const vipInfo = vipService.getVipInfo(user.total_wagered || 0);

    const isOnline = presenceService.isUserOnline(user.id);
    const onlinePresence = isOnline ? presenceService.getUserPresence(user.id) : null;

    // Détection des comptes partageant la même IP d'inscription
    let sameIpAccounts = [];
    if (user.registration_ip && user.registration_ip !== '127.0.0.1' && user.registration_ip !== '::1') {
      sameIpAccounts = db.prepare(`
        SELECT id, username, first_name, last_name, role, coins, created_at
        FROM users
        WHERE registration_ip = ? AND id != ?
      `).all(user.registration_ip, user.id);
    }

    // Statistiques par type de jeu
    const statsByGame = db.prepare(`
      SELECT game_type, COUNT(*) as count, SUM(bet) as total_bet, SUM(payout) as total_payout, SUM(profit) as net_profit
      FROM game_history
      WHERE user_id = ? AND game_type != 'daily_bonus'
      GROUP BY game_type
    `).all(id) || [];

    // Total des parties et pagination
    const totalGamesRow = db.prepare('SELECT COUNT(*) as total FROM game_history WHERE user_id = ?').get(id);
    const totalGames = totalGamesRow ? totalGamesRow.total : 0;
    const totalPages = Math.ceil(totalGames / limit) || 1;

    // Historique des parties paginé
    const rawGames = db.prepare(`
      SELECT id, game_type, bet, payout, profit, details, created_at
      FROM game_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(id, limit, offset) || [];

    const games = rawGames.map(g => {
      let detailsObj = null;
      if (g.details) {
        try { detailsObj = typeof g.details === 'object' ? g.details : JSON.parse(g.details); }
        catch (e) { detailsObj = { raw: g.details }; }
      }
      return {
        id: g.id,
        game_type: g.game_type,
        bet: g.bet,
        payout: g.payout,
        profit: g.profit,
        details: detailsObj,
        created_at: g.created_at
      };
    });

    // Historique des codes promo utilisés
    const promoCodes = db.prepare(`
      SELECT cu.id, cu.coins_awarded, cu.used_at, p.code
      FROM code_utilisations cu
      JOIN promo_codes p ON cu.code_id = p.id
      WHERE cu.user_id = ?
      ORDER BY cu.used_at DESC
    `).all(id) || [];

    // Historique des ajustements manuels de solde
    const adjustments = db.prepare(`
      SELECT a.id, a.admin_id, a.admin_username, a.amount, a.previous_balance,
             a.new_balance, a.mode, a.reason, a.created_at
      FROM admin_adjustments a
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(id) || [];

    // Historique des livraisons et récompenses
    const deliveries = db.prepare(`
      SELECT d.id, d.item_name, d.variant_name, d.quantity, d.coins_paid,
             d.room_location, d.phone, d.notes, d.source, d.status,
             d.delivered_at, d.created_at
      FROM delivery_orders d
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(id) || [];

    return res.json({
      success: true,
      user: {
        ...user,
        isOnline,
        onlinePresence,
        vipInfo,
        sameIpAccountsCount: sameIpAccounts.length,
        sameIpAccounts
      },
      statsByGame,
      games,
      pagination: {
        page,
        limit,
        totalGames,
        totalPages
      },
      promoCodes,
      adjustments,
      deliveries
    });
  } catch (err) {
    console.error('Erreur getUserDetails admin:', err);
    return res.status(500).json({ error: 'Impossible de charger la fiche détaillée du joueur.' });
  }
};

// Modifier le rôle d'un utilisateur (élève ou admin)
exports.updateUserRole = (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;

    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide (doit être "student" ou "admin").' });
    }

    const targetUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (targetUser.username === 'bde_admin' && role !== 'admin') {
      return res.status(403).json({ error: 'Impossible de rétrograder le compte maître bde_admin.' });
    }

    if (Number(id) === Number(adminId) && role !== 'admin') {
      return res.status(403).json({ error: 'Tu ne peux pas révoquer tes propres privilèges administrateur.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);

    try {
      socketService.notifyLeaderboardUpdated();
    } catch (sockErr) {}

    return res.json({
      success: true,
      message: `Rôle de "${targetUser.username}" changé en "${role === 'admin' ? 'Administrateur BDE' : 'Élève'}".`,
      user: { ...targetUser, role }
    });
  } catch (err) {
    console.error('Erreur updateUserRole admin:', err);
    return res.status(500).json({ error: 'Erreur lors du changement de rôle.' });
  }
};

// Supprimer un utilisateur et toutes ses données associées
exports.deleteUser = (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const targetUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (targetUser.username === 'bde_admin') {
      return res.status(403).json({ error: 'Impossible de supprimer le compte maître bde_admin.' });
    }

    if (Number(id) === Number(adminId)) {
      return res.status(403).json({ error: 'Tu ne peux pas supprimer ton propre compte administrateur.' });
    }

    db.transaction(() => {
      const deleteSafe = (table) => {
        try { db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(id); } catch (e) {}
      };
      deleteSafe('game_history');
      deleteSafe('blackjack_sessions');
      deleteSafe('slot_sessions');
      deleteSafe('crash_sessions');
      deleteSafe('user_wheel_cooldowns');
      deleteSafe('user_wheel_daily_spins');
      deleteSafe('code_utilisations');
      deleteSafe('delivery_orders');
      deleteSafe('shop_orders');
      deleteSafe('transactions');
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();

    try {
      socketService.notifyLeaderboardUpdated();
    } catch (sockErr) {}

    return res.json({
      success: true,
      message: `Compte de "${targetUser.username}" supprimé avec succès.`
    });
  } catch (err) {
    console.error('Erreur deleteUser admin:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur.' });
  }
};

// Corriger l'identité (Nom & Prénom) d'un élève (Admin BDE en cas d'erreur de saisie)
exports.updateUserIdentity = (req, res) => {
  try {
    const { id } = req.params;
    const rawFirst = req.body.firstName || req.body.first_name || '';
    const rawLast = req.body.lastName || req.body.last_name || '';
    const firstName = typeof rawFirst === 'string' ? rawFirst.trim() : '';
    const lastName = typeof rawLast === 'string' ? rawLast.trim() : '';

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Le nom et le prénom sont obligatoires.' });
    }
    if (firstName.length > 50 || lastName.length > 50) {
      return res.status(400).json({ error: 'Le nom et le prénom ne doivent pas dépasser 50 caractères.' });
    }

    const targetUser = db.prepare('SELECT id, username, first_name, last_name FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?').run(firstName, lastName, id);

    return res.json({
      success: true,
      message: `Identité de "${targetUser.username}" mise à jour : ${firstName} ${lastName}`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        first_name: firstName,
        last_name: lastName
      }
    });
  } catch (err) {
    console.error('Erreur updateUserIdentity admin:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification de l\'identité.' });
  }
};

// Récupérer la liste des joueurs actuellement connectés en temps réel
exports.getOnlinePlayers = (req, res) => {
  try {
    const summary = presenceService.getOnlineSummary();
    return res.json(summary);
  } catch (err) {
    console.error('Erreur getOnlinePlayers admin:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des joueurs connectés.' });
  }
};

