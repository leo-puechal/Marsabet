const db = require('../database/db');

// Pré-visualisation ou scan d'un code de retrait
exports.checkClaimCode = (req, res) => {
  try {
    let { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Code de retrait requis.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const order = db.prepare(`
      SELECT o.id, o.claim_code, o.item_name, o.coins_paid, o.status, o.created_at, o.collected_at,
             u.username, u.id as user_id, i.icon, i.category
      FROM shop_orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.claim_code = ?
    `).get(cleanCode);

    if (!order) {
      return res.status(404).json({ error: 'Code de retrait introuvable ou inexistant.' });
    }

    return res.json({ order });
  } catch (err) {
    console.error('Erreur vérification code:', err);
    return res.status(500).json({ error: 'Erreur lors de la vérification du code.' });
  }
};

// Validation définitive d'un retrait (marquer "retiré" en 1 clic)
exports.validateClaimCode = (req, res) => {
  try {
    const adminId = req.user.id;
    let { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code de retrait manquant.' });
    }

    const cleanCode = code.trim().toUpperCase();

    const order = db.prepare(`
      SELECT o.id, o.claim_code, o.item_name, o.coins_paid, o.status, o.created_at, o.collected_at,
             u.username, i.icon
      FROM shop_orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.claim_code = ?
    `).get(cleanCode);

    if (!order) {
      return res.status(404).json({ error: 'Code de retrait inconnu. Vérifie la saisie.' });
    }

    if (order.status === 'collected') {
      const dateFormatted = new Date(order.collected_at).toLocaleString('fr-FR');
      return res.status(409).json({
        error: `ATTENTION : Ce code a DÉJÀ ÉTÉ RETIRÉ le ${dateFormatted} pour l'élève ${order.username} ! Ne pas donner le produit une seconde fois.`,
        alreadyCollected: true,
        order
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Cette commande ne peut pas être retirée (statut actuel : ${order.status}).` });
    }

    // Valider le retrait
    db.prepare(`
      UPDATE shop_orders
      SET status = 'collected',
          collected_at = CURRENT_TIMESTAMP,
          collected_by = ?
      WHERE claim_code = ? AND status = 'pending'
    `).run(adminId, cleanCode);

    const updatedOrder = db.prepare(`
      SELECT o.*, u.username, i.icon
      FROM shop_orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.claim_code = ?
    `).get(cleanCode);

    return res.json({
      message: `Retrait VALIDÉ avec succès pour ${order.username} ! Tu peux lui remettre son produit : ${order.item_name}.`,
      order: updatedOrder
    });
  } catch (err) {
    console.error('Erreur validation retrait:', err);
    return res.status(500).json({ error: 'Erreur interne lors de la validation.' });
  }
};

// Récupérer la liste complète des commandes de tous les élèves
exports.getAllOrders = (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT o.id, o.claim_code, o.item_name, o.coins_paid, o.status, o.created_at, o.collected_at,
             u.username, u.id as user_id, i.icon, admin.username as collected_by_admin
      FROM shop_orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN shop_items i ON o.item_id = i.id
      LEFT JOIN users admin ON o.collected_by = admin.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      query += ' AND (u.username LIKE ? OR o.claim_code LIKE ? OR o.item_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 100';

    const orders = db.prepare(query).all(...params);
    return res.json({ orders });
  } catch (err) {
    console.error('Erreur récupération commandes admin:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des commandes.' });
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
