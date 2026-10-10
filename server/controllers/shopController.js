const crypto = require('crypto');
const db = require('../database/db');

// Génère un code unique de retrait lisible du type MB-7X9P-4K2Z
function generateClaimCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclut 0, 1, O, I pour éviter toute confusion visuelle
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[crypto.randomInt(0, chars.length)];
    part2 += chars[crypto.randomInt(0, chars.length)];
  }
  return `MB-${part1}-${part2}`;
}

exports.getProducts = (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, category, price, stock, initial_stock, icon, description, is_active
      FROM shop_items
      WHERE is_active = 1
      ORDER BY price ASC
    `).all();

    return res.json({
      notice: 'Stock limité, disponible tant que les réserves du BDE le permettent. Jetons 100% gratuits gagnés aux jeux.',
      products: products.map(p => ({
        ...p,
        isAvailable: p.stock > 0
      }))
    });
  } catch (err) {
    console.error('Erreur catalogue boutique:', err);
    return res.status(500).json({ error: 'Impossible de charger les produits du BDE.' });
  }
};

exports.orderProduct = (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Identifiant du produit manquant.' });
    }

    const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND is_active = 1').get(productId);
    if (!item) {
      return res.status(404).json({ error: 'Produit introuvable dans le catalogue BDE.' });
    }

    if (item.stock <= 0) {
      return res.status(400).json({ error: `Rupture de stock pour ${item.name} ! Reviens lors du prochain réapprovisionnement.` });
    }

    const user = db.prepare('SELECT coins, username FROM users WHERE id = ?').get(userId);
    if (user.coins < item.price) {
      return res.status(400).json({
        error: `Solde insuffisant ! Il te manque ${(item.price - user.coins).toLocaleString()} jetons pour récupérer ce produit.`
      });
    }

    // Générer un code de retrait unique garanti
    let claimCode = generateClaimCode();
    while (db.prepare('SELECT id FROM shop_orders WHERE claim_code = ?').get(claimCode)) {
      claimCode = generateClaimCode();
    }

    // Exécution transactionnelle sécurisée
    const executeOrder = db.transaction(() => {
      // 1. Décrémenter le stock avec vérification atomique
      const updateStock = db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0').run(item.id);
      if (updateStock.changes === 0) {
        throw new Error('Le dernier exemplaire vient d’être réservé par un autre élève !');
      }

      // 2. Déduire les jetons
      const newCoins = user.coins - item.price;
      db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newCoins, userId);

      // 3. Créer la commande avec le code de retrait
      const orderInsert = db.prepare(`
        INSERT INTO shop_orders (claim_code, user_id, item_id, item_name, coins_paid, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(claimCode, userId, item.id, item.name, item.price);

      // 4. Enregistrer dans l'historique
      db.prepare(`
        INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
        VALUES (?, 'bde_reward', ?, 0, ?, ?)
      `).run(userId, item.price, -item.price, JSON.stringify({
        claimCode,
        itemName: item.name,
        icon: item.icon
      }));

      const remainingStock = db.prepare('SELECT stock FROM shop_items WHERE id = ?').get(item.id).stock;

      return {
        orderId: orderInsert.lastInsertRowid,
        newCoins,
        remainingStock
      };
    });

    const result = executeOrder();

    return res.status(201).json({
      message: `Commande validée ! Présente ton code au stand BDE pour récupérer : ${item.name}.`,
      claimCode,
      order: {
        id: result.orderId,
        claimCode,
        itemName: item.name,
        icon: item.icon,
        coinsPaid: item.price,
        status: 'pending',
        createdAt: new Date().toISOString()
      },
      coins: result.newCoins,
      remainingStock: result.remainingStock
    });
  } catch (err) {
    console.error('Erreur commande boutique:', err);
    return res.status(400).json({ error: err.message || 'Échec de la commande.' });
  }
};

exports.getMyOrders = (req, res) => {
  try {
    const userId = req.user.id;

    const orders = db.prepare(`
      SELECT o.id, o.claim_code, o.item_id, o.item_name, o.coins_paid, o.status, o.collected_at, o.created_at,
             i.icon, i.category
      FROM shop_orders o
      LEFT JOIN shop_items i ON o.item_id = i.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);

    return res.json({ orders });
  } catch (err) {
    console.error('Erreur mes commandes:', err);
    return res.status(500).json({ error: 'Impossible de récupérer tes commandes.' });
  }
};
