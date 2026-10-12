const fortuneWheelService = require('../services/fortuneWheelService');
const db = require('../database/db');

exports.listWheels = (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const wheels = fortuneWheelService.getAllWheels(userId);
    return res.json({ wheels });
  } catch (err) {
    console.error('Erreur liste roues:', err);
    return res.status(500).json({ error: 'Impossible de charger les roues de la fortune.' });
  }
};

exports.getWheelDetails = (req, res) => {
  try {
    const wheelId = req.params.id;
    const userId = req.user ? req.user.id : null;
    const wheel = fortuneWheelService.getWheel(wheelId, userId);

    if (!wheel) {
      return res.status(404).json({ error: 'Roue introuvable.' });
    }

    return res.json({ wheel });
  } catch (err) {
    console.error('Erreur détail roue:', err);
    return res.status(500).json({ error: 'Impossible de charger la roue.' });
  }
};

exports.spin = (req, res) => {
  try {
    const wheelId = req.params.id;
    const userId = req.user.id;

    const result = fortuneWheelService.spinWheel(wheelId, userId);
    return res.json(result);
  } catch (err) {
    const isClientError = err.message && (
      err.message.includes('Solde insuffisant') ||
      err.message.includes('Patience') ||
      err.message.includes('Limite quotidienne') ||
      err.message.includes('introuvable')
    );
    const status = isClientError ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Erreur lors du tour de roue.' });
  }
};

// Confirmation des informations de livraison directe pour un lot gagné à la roue
exports.confirmDelivery = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, lastName, firstName, roomLocation, phone, notes } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Identifiant du lot manquant.' });
    }

    const result = await fortuneWheelService.confirmWheelDelivery(orderId, userId, {
      lastName,
      firstName,
      roomLocation,
      phone,
      notes
    });

    return res.json(result);
  } catch (err) {
    console.error('Erreur confirmation livraison roue:', err);
    return res.status(400).json({ error: err.message || 'Erreur lors de la confirmation de livraison.' });
  }
};

// Récupère toutes les demandes de livraison (roues de la fortune) par l'élève
exports.getMyRewards = (req, res) => {
  try {
    const userId = req.user.id;

    const rawRewards = db.prepare(`
      SELECT d.id, d.last_name, d.first_name, d.room_location, d.phone, d.notes,
             d.item_id, d.item_name, d.variant_name, d.coins_paid, d.quantity, d.status,
             d.source, d.email_status, d.delivered_at, d.created_at
      FROM delivery_orders d
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(userId);

    const rewards = rawRewards.map(r => {
      let icon = '🎁';
      let category = 'snack';
      const name = (r.item_name || '').toLowerCase();
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
      return { ...r, icon, category };
    });

    return res.json({ rewards, deliveries: rewards });
  } catch (err) {
    console.error('Erreur récupération récompenses:', err);
    return res.status(500).json({ error: 'Impossible de charger tes demandes de livraison.' });
  }
};
