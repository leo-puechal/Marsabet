const db = require('../database/db');
const emailService = require('../services/emailService');

exports.getProducts = (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, category, price, stock, initial_stock, icon, description, unit, variants, is_active
      FROM shop_items
      WHERE is_active = 1
      ORDER BY category ASC, price ASC
    `).all();

    return res.json({
      notice: 'Stock limité, disponible tant que les réserves du BDE le permettent. Jetons 100% gratuits gagnés aux jeux.',
      products: products.map(p => ({
        ...p,
        variants: p.variants ? JSON.parse(p.variants) : null,
        unit: p.unit || 'Pièce',
        isAvailable: p.stock > 0
      }))
    });
  } catch (err) {
    console.error('Erreur catalogue boutique:', err);
    return res.status(500).json({ error: 'Impossible de charger les produits du BDE.' });
  }
};

// Demande d'échange avec livraison directe
exports.orderProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      productId,
      variantId,
      variantName,
      lastName,
      firstName,
      roomLocation,
      phone
    } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Identifiant du produit manquant.' });
    }

    // Validation stricte des informations de livraison
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom de famille est obligatoire pour la livraison (2 caractères minimum).' });
    }
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
      return res.status(400).json({ error: 'Le prénom est obligatoire pour la livraison (2 caractères minimum).' });
    }
    if (!roomLocation || typeof roomLocation !== 'string' || roomLocation.trim().length < 2) {
      return res.status(400).json({ error: 'La salle ou le lieu où tu te trouves est obligatoire pour la livraison directe.' });
    }

    const cleanLastName = lastName.trim();
    const cleanFirstName = firstName.trim();
    const cleanRoomLocation = roomLocation.trim();
    const cleanPhone = (phone && typeof phone === 'string') ? phone.trim() : null;

    const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND is_active = 1').get(productId);
    if (!item) {
      return res.status(404).json({ error: 'Produit introuvable dans le catalogue BDE.' });
    }

    if (item.stock <= 0) {
      return res.status(400).json({ error: `Rupture de stock pour ${item.name} ! Reviens lors du prochain réapprovisionnement.` });
    }

    let finalPrice = item.price;
    let orderItemName = item.name;
    let selectedVariantName = null;

    if (item.variants) {
      try {
        const variants = JSON.parse(item.variants);
        if (Array.isArray(variants) && variants.length > 0) {
          const normalized = variantName ? variantName.trim().toLowerCase() : '';
          const selected = variants.find(v => 
            (normalized && v.name && v.name.trim().toLowerCase() === normalized) ||
            (variantId && v.id === variantId) ||
            (normalized && v.name && (v.name.toLowerCase().includes(normalized) || normalized.includes(v.name.toLowerCase())))
          ) || variants[0];
          if (selected) {
            finalPrice = selected.price;
            selectedVariantName = selected.name;
            orderItemName = `${item.name} (${selected.name})`;
          }
        }
      } catch (e) {}
    }

    const user = db.prepare('SELECT coins, username FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < finalPrice) {
      return res.status(400).json({
        error: `Solde insuffisant ! Il te manque ${(finalPrice - (user ? user.coins : 0)).toLocaleString()} jetons pour cet échange.`
      });
    }

    // Exécution transactionnelle sécurisée : déduction coins, décrémentation stock, insertion livraison
    const executeOrder = db.transaction(() => {
      // 1. Décrémenter le stock avec vérification atomique
      const updateStock = db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0').run(item.id);
      if (updateStock.changes === 0) {
        throw new Error('Le dernier exemplaire vient d’être réservé par un autre élève !');
      }

      // 2. Déduire les jetons de façon atomique
      const updateCoins = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(finalPrice, userId, finalPrice);
      if (updateCoins.changes === 0) {
        throw new Error('Solde insuffisant.');
      }

      // 3. Enregistrer la demande de livraison directe
      const deliveryInsert = db.prepare(`
        INSERT INTO delivery_orders (
          user_id, last_name, first_name, room_location, phone,
          item_id, item_name, variant_name, quantity, coins_paid,
          source, status, email_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'shop', 'pending', 'pending')
      `).run(
        userId,
        cleanLastName,
        cleanFirstName,
        cleanRoomLocation,
        cleanPhone,
        item.id,
        item.name,
        selectedVariantName,
        finalPrice
      );

      // 4. Enregistrer dans l'historique de jeu / transaction
      db.prepare(`
        INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
        VALUES (?, 'bde_reward', ?, 0, ?, ?)
      `).run(userId, finalPrice, -finalPrice, JSON.stringify({
        deliveryId: deliveryInsert.lastInsertRowid,
        itemName: orderItemName,
        roomLocation: cleanRoomLocation,
        icon: item.icon
      }));

      const remainingStock = db.prepare('SELECT stock FROM shop_items WHERE id = ?').get(item.id).stock;
      const updatedUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

      return {
        deliveryId: deliveryInsert.lastInsertRowid,
        newCoins: updatedUser.coins,
        remainingStock
      };
    });

    const result = executeOrder();

    // Objet récapitulatif pour email et réponse
    const deliveryPayload = {
      id: result.deliveryId,
      user_id: userId,
      username: user.username,
      first_name: cleanFirstName,
      last_name: cleanLastName,
      room_location: cleanRoomLocation,
      phone: cleanPhone,
      item_name: item.name,
      variant_name: selectedVariantName,
      quantity: 1,
      coins_paid: finalPrice,
      source: 'shop',
      created_at: new Date().toISOString()
    };

    // Envoi asynchrone de l'email au BDE (ne bloque pas si échec ou si identifiants absents)
    let emailResult = { success: false, status: 'failed' };
    try {
      emailResult = await emailService.sendDeliveryNotification(deliveryPayload);
      db.prepare(`
        UPDATE delivery_orders
        SET email_status = ?, email_error = ?
        WHERE id = ?
      `).run(
        emailResult.status || (emailResult.success ? 'sent' : 'failed'),
        emailResult.error || null,
        result.deliveryId
      );
    } catch (mailErr) {
      console.error('Erreur non bloquante emailService:', mailErr);
      db.prepare(`
        UPDATE delivery_orders
        SET email_status = 'failed', email_error = ?
        WHERE id = ?
      `).run(mailErr.message, result.deliveryId);
    }

    return res.status(201).json({
      success: true,
      message: `Demande de livraison confirmée ! Un membre du BDE t'apportera ton produit (${orderItemName}) directement en salle ${cleanRoomLocation}.`,
      coins: result.newCoins,
      delivery: {
        id: result.deliveryId,
        itemName: orderItemName,
        variantName: selectedVariantName,
        icon: item.icon,
        quantity: 1,
        coinsPaid: finalPrice,
        roomLocation: cleanRoomLocation,
        lastName: cleanLastName,
        firstName: cleanFirstName,
        phone: cleanPhone,
        status: 'pending',
        emailStatus: emailResult.status || 'pending',
        createdAt: new Date().toISOString()
      },
      emailSent: emailResult.success,
      remainingStock: result.remainingStock
    });
  } catch (err) {
    console.error('Erreur commande boutique:', err);
    return res.status(400).json({ error: err.message || 'Échec de la commande de livraison.' });
  }
};

// Récupère l'historique des demandes de livraison de l'élève
exports.getMyOrders = (req, res) => {
  try {
    const userId = req.user.id;

    const deliveries = db.prepare(`
      SELECT d.id, d.last_name, d.first_name, d.room_location, d.phone,
             d.item_id, d.item_name, d.variant_name, d.quantity, d.coins_paid,
             d.source, d.status, d.email_status, d.delivered_at, d.created_at,
             i.icon, i.category
      FROM delivery_orders d
      LEFT JOIN shop_items i ON d.item_id = i.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(userId);

    return res.json({
      orders: deliveries,
      deliveries
    });
  } catch (err) {
    console.error('Erreur mes livraisons:', err);
    return res.status(500).json({ error: 'Impossible de récupérer tes demandes de livraison.' });
  }
};
