const db = require('../database/db');
const fortuneWheelService = require('../services/fortuneWheelService');
const promoCodeService = require('../services/promoCodeService');
const socketService = require('../services/socketService');

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

