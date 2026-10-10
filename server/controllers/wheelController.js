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
    const status = (err.message && (err.message.includes('Solde insuffisant') || err.message.includes('Patience'))) ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Erreur lors du tour de roue.' });
  }
};

// Récupère toutes les récompenses physiques gagnées (roues + boutique) par l'élève
exports.getMyRewards = (req, res) => {
  try {
    const userId = req.user.id;

    const rewards = db.prepare(`
      SELECT o.id, o.claim_code, o.item_name, o.variant_name, o.coins_paid, o.status,
             o.source, o.collected_at, o.created_at,
             i.icon, i.category
      FROM shop_orders o
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);

    return res.json({ rewards });
  } catch (err) {
    console.error('Erreur récupération récompenses:', err);
    return res.status(500).json({ error: 'Impossible de charger tes récompenses.' });
  }
};
