const db = require('../database/db');

// Récupérer toutes les demandes de livraison directe pour le suivi BDE
exports.getAllDeliveries = (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT d.id, d.last_name, d.first_name, d.room_location, d.phone,
             d.item_id, d.item_name, d.variant_name, d.quantity, d.coins_paid,
             d.source, d.status, d.email_status, d.email_error, d.delivered_at, d.created_at,
             u.username, u.id as user_id, i.icon, admin.username as delivered_by_admin
      FROM delivery_orders d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN shop_items i ON d.item_id = i.id
      LEFT JOIN users admin ON d.delivered_by = admin.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      query += ' AND (u.username LIKE ? OR d.last_name LIKE ? OR d.first_name LIKE ? OR d.room_location LIKE ? OR d.item_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY d.created_at DESC LIMIT 150';

    const deliveries = db.prepare(query).all(...params);
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

// Gestion des produits physiques
exports.getProductsAdmin = (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM shop_items ORDER BY is_active DESC, price ASC').all();
    return res.json({ products });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur produits admin.' });
  }
};

exports.createProduct = (req, res) => {
  try {
    const { id, name, category, price, stock, icon, description } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Nom et prix en coins requis.' });
    }

    const productId = id ? id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : `prod_${Date.now()}`;
    const cleanPrice = Math.max(1, parseInt(price));
    const cleanStock = Math.max(0, parseInt(stock) || 0);

    db.prepare(`
      INSERT INTO shop_items (id, name, category, price, stock, initial_stock, icon, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(productId, name.trim(), category || 'snack', cleanPrice, cleanStock, cleanStock, icon || '🎁', description || '');

    const newProduct = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(productId);
    return res.status(201).json({ message: 'Nouveau produit BDE ajouté au catalogue !', product: newProduct });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Un produit avec cet identifiant existe déjà.' });
    }
    return res.status(500).json({ error: 'Erreur lors de la création du produit.' });
  }
};

exports.updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, stock, icon, description, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    db.prepare(`
      UPDATE shop_items
      SET name = COALESCE(?, name),
          category = COALESCE(?, category),
          price = COALESCE(?, price),
          stock = COALESCE(?, stock),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      category || null,
      price !== undefined ? Math.max(1, parseInt(price)) : null,
      stock !== undefined ? Math.max(0, parseInt(stock)) : null,
      icon || null,
      description !== undefined ? description : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
    return res.json({ message: 'Produit BDE mis à jour avec succès.', product: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
};

exports.deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    // Désactivation logique pour garder l'intégrité de l'historique
    db.prepare('UPDATE shop_items SET is_active = 0 WHERE id = ?').run(id);
    return res.json({ message: 'Produit archivé et retiré de la boutique.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
};

// ======================== CODES PROMO ADMIN ========================
const promoCodeService = require('../services/promoCodeService');

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
