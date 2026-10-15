const db = require('../database/db');
const crypto = require('crypto');

function generatePromoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = 'MARSA-';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return res;
}

function normalizeCode(codeStr) {
  if (!codeStr) return '';
  return codeStr.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
}

/**
 * Créer un nouveau code promo (Admin BDE)
 */
function createPromoCode({ code, coinsAmount, maxUses = 50, expiresAt = null, createdBy = null }) {
  let cleanCode = normalizeCode(code);
  if (!cleanCode) {
    cleanCode = generatePromoCode();
  }

  const parsedCoins = parseInt(coinsAmount, 10);
  if (isNaN(parsedCoins) || parsedCoins <= 0 || parsedCoins > 1000000) {
    throw new Error('Le montant de coins doit être un nombre positif (maximum 1 000 000).');
  }

  const parsedUses = parseInt(maxUses, 10);
  if (isNaN(parsedUses) || parsedUses <= 0 || parsedUses > 100000) {
    throw new Error('La limite globale d\'utilisations doit être comprise entre 1 et 100 000.');
  }

  // Vérifier unicité
  const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(cleanCode);
  if (existing) {
    throw new Error(`Le code promo "${cleanCode}" existe déjà.`);
  }

  const stmt = db.prepare(`
    INSERT INTO promo_codes (code, coins_amount, max_uses, current_uses, expires_at, is_active, created_by)
    VALUES (?, ?, ?, 0, ?, 1, ?)
  `);

  const info = stmt.run(cleanCode, parsedCoins, parsedUses, expiresAt || null, createdBy);

  return {
    id: info.lastInsertRowid,
    code: cleanCode,
    coinsAmount: parsedCoins,
    maxUses: parsedUses,
    currentUses: 0,
    expiresAt: expiresAt || null,
    isActive: true
  };
}

/**
 * Lister tous les codes promo avec statut calculé
 */
function listPromoCodes() {
  const codes = db.prepare(`
    SELECT p.id, p.code, p.coins_amount, p.max_uses, p.current_uses, p.expires_at, p.is_active,
           p.created_at, u.username as created_by_user,
           (SELECT COUNT(*) FROM code_utilisations WHERE code_id = p.id) as actual_uses
    FROM promo_codes p
    LEFT JOIN users u ON p.created_by = u.id
    ORDER BY p.created_at DESC
  `).all();

  const now = new Date();
  return codes.map(c => {
    const isExpired = c.expires_at ? new Date(c.expires_at) < now : false;
    const isLimitReached = c.current_uses >= c.max_uses;
    let statusText = 'Actif';
    if (!c.is_active) {
      statusText = 'Désactivé';
    } else if (isExpired) {
      statusText = 'Expiré';
    } else if (isLimitReached) {
      statusText = 'Limite atteinte';
    }

    return {
      ...c,
      is_expired: isExpired,
      is_limit_reached: isLimitReached,
      status_text: statusText
    };
  });
}

/**
 * Activer ou désactiver manuellement un code
 */
function togglePromoCode(id) {
  const code = db.prepare('SELECT id, is_active, code FROM promo_codes WHERE id = ?').get(id);
  if (!code) {
    throw new Error('Code promo introuvable.');
  }

  const newStatus = code.is_active ? 0 : 1;
  db.prepare('UPDATE promo_codes SET is_active = ? WHERE id = ?').run(newStatus, id);

  return {
    id,
    code: code.code,
    isActive: newStatus === 1
  };
}

/**
 * Supprimer un code promo
 */
function deletePromoCode(id) {
  const code = db.prepare('SELECT id, code FROM promo_codes WHERE id = ?').get(id);
  if (!code) {
    throw new Error('Code promo introuvable.');
  }

  db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
  return { success: true, id, code: code.code };
}

/**
 * Rédemption d'un code par un élève
 * Vérifie toutes les règles : existence, statut actif, date d'expiration, limite globale, et unicité par élève
 */
function redeemCode(codeStr, userId) {
  const cleanCode = normalizeCode(codeStr);
  if (!cleanCode) {
    throw new Error('Veuillez saisir un code promo valide.');
  }

  const tx = db.transaction(() => {
    // 1. Vérifier si le code existe
    const promo = db.prepare(`
      SELECT id, code, coins_amount, max_uses, current_uses, expires_at, is_active
      FROM promo_codes
      WHERE code = ?
    `).get(cleanCode);

    if (!promo) {
      throw new Error(`Le code "${cleanCode}" est inexistant ou invalide.`);
    }

    // 2. Vérifier si actif
    if (!promo.is_active) {
      throw new Error('Ce code promo est actuellement désactivé.');
    }

    // 3. Vérifier date d'expiration
    if (promo.expires_at) {
      const expirationDate = new Date(promo.expires_at);
      if (expirationDate < new Date()) {
        const formattedDate = expirationDate.toLocaleDateString('fr-FR');
        throw new Error(`Ce code promo a expiré le ${formattedDate}.`);
      }
    }

    // 4. Vérifier limite globale d'utilisations
    if (promo.current_uses >= promo.max_uses) {
      throw new Error('Ce code promo a atteint sa limite maximale d\'utilisations.');
    }

    // 5. Vérifier si l'élève l'a déjà utilisé (règle stricte : 1 seule fois par élève)
    const alreadyUsed = db.prepare(`
      SELECT id, used_at
      FROM code_utilisations
      WHERE code_id = ? AND user_id = ?
    `).get(promo.id, userId);

    if (alreadyUsed) {
      const usedDate = new Date(alreadyUsed.used_at).toLocaleDateString('fr-FR');
      throw new Error(`Tu as déjà utilisé ce code promo le ${usedDate}. Chaque code ne peut être utilisé qu'une seule fois par élève.`);
    }

    // 6. Enregistrer l'utilisation dans code_utilisations
    db.prepare(`
      INSERT INTO code_utilisations (code_id, user_id, coins_awarded)
      VALUES (?, ?, ?)
    `).run(promo.id, userId, promo.coins_amount);

    // 7. Incrémenter le compteur d'utilisation du code promo
    db.prepare(`
      UPDATE promo_codes
      SET current_uses = current_uses + 1
      WHERE id = ?
    `).run(promo.id);

    // 8. Créditer les coins sur le compte de l'élève
    db.prepare(`
      UPDATE users
      SET coins = coins + ?
      WHERE id = ?
    `).run(promo.coins_amount, userId);

    // 9. Enregistrer dans l'historique
    db.prepare(`
      INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
      VALUES (?, 'promo_code', 0, ?, ?, ?)
    `).run(
      userId,
      promo.coins_amount,
      promo.coins_amount,
      JSON.stringify({ code: promo.code, coinsAmount: promo.coins_amount })
    );

    // 10. Récupérer le nouveau solde
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

    return {
      success: true,
      code: promo.code,
      coinsAdded: promo.coins_amount,
      newCoins: user.coins,
      message: `Félicitations ! Le code "${promo.code}" a été validé. Tu reçois +${promo.coins_amount.toLocaleString()} coins sur ton solde !`
    };
  });

  const res = tx();

  try {
    const socketService = require('./socketService');
    socketService.notifyUserBalance(userId, res.newCoins);
    socketService.notifyLeaderboardUpdated();
  } catch (sockErr) {}

  return res;
}

/**
 * Récupérer l'historique des codes activés par un utilisateur
 */
function getUserRedemptions(userId) {
  return db.prepare(`
    SELECT u.id, u.coins_awarded, u.used_at, p.code
    FROM code_utilisations u
    JOIN promo_codes p ON u.code_id = p.id
    WHERE u.user_id = ?
    ORDER BY u.used_at DESC
  `).all(userId);
}

module.exports = {
  createPromoCode,
  listPromoCodes,
  togglePromoCode,
  deletePromoCode,
  redeemCode,
  getUserRedemptions,
  generatePromoCode
};
