const crypto = require('crypto');
const db = require('../database/db');

// Génère un code unique de retrait MB-XXXX-XXXX
function generateClaimCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[crypto.randomInt(0, chars.length)];
    part2 += chars[crypto.randomInt(0, chars.length)];
  }
  return `MB-${part1}-${part2}`;
}

const WHEELS_CONFIG = {
  'quotidienne': {
    id: 'quotidienne',
    name: 'Roue Quotidienne BDE',
    subtitle: '1 spin 100% gratuit toutes les 24h',
    type: 'free',
    cost: 0,
    cooldownHours: 24,
    badge: '✨ GRATUIT',
    badgeClass: 'badge-free',
    icon: '🎁',
    description: 'Tourne la grande roue chaque jour gratuitement pour gagner des coins et tenter de décrocher des boissons ou chocolats réels du BDE !',
    segments: [
      { id: 'q_50', type: 'coins', coins: 50, label: '50 🪙', color: '#1E3A8A', textColor: '#FFF', weight: 26 },
      { id: 'q_100', type: 'coins', coins: 100, label: '100 🪙', color: '#0D9488', textColor: '#FFF', weight: 22 },
      { id: 'q_150', type: 'coins', coins: 150, label: '150 🪙', color: '#3B82F6', textColor: '#FFF', weight: 18 },
      { id: 'q_250', type: 'coins', coins: 250, label: '250 🪙', color: '#8B5CF6', textColor: '#FFF', weight: 14 },
      { id: 'q_500', type: 'coins', coins: 500, label: '⭐ 500 🪙', color: '#F59E0B', textColor: '#000', weight: 8 },
      { id: 'q_1000', type: 'coins', coins: 1000, label: '👑 1 000 🪙', color: '#D4AF37', textColor: '#000', weight: 4, isJackpot: true },
      { id: 'q_coca', type: 'physical', product: { itemId: 'coca', name: 'Canette Coca-Cola 33cl', icon: '🥤', category: 'Boissons Fraîches' }, label: '🥤 Canette Coca', color: '#DC2626', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 'q_kinder', type: 'physical', product: { itemId: 'kinder_bueno', name: 'Kinder Bueno', icon: '🍫', category: 'Sucreries' }, label: '🍫 Kinder Bueno', color: '#EA580C', textColor: '#FFF', weight: 4, isPhysical: true }
    ]
  },
  'snack': {
    id: 'snack',
    name: 'Roue Pause & Confiseries',
    subtitle: 'Mise accessible pour les pauses gourmandes',
    type: 'paid',
    cost: 250,
    badge: '250 🪙',
    badgeClass: 'badge-coins',
    icon: '🍫',
    description: 'Mise de 250 coins gagnés en jouant. Transforme tes jetons virtuels en confiseries, chips et Capri-Sun réels !',
    segments: [
      { id: 's_100', type: 'coins', coins: 100, label: '100 🪙', color: '#334155', textColor: '#FFF', weight: 28 },
      { id: 's_250', type: 'coins', coins: 250, label: '250 🪙 (Remboursé)', color: '#1E3A8A', textColor: '#FFF', weight: 24 },
      { id: 's_500', type: 'coins', coins: 500, label: '500 🪙 (x2)', color: '#0D9488', textColor: '#FFF', weight: 18 },
      { id: 's_750', type: 'coins', coins: 750, label: '750 🪙 (x3)', color: '#3B82F6', textColor: '#FFF', weight: 12 },
      { id: 's_1500', type: 'coins', coins: 1500, label: '⚡ 1 500 🪙 (x6)', color: '#8B5CF6', textColor: '#FFF', weight: 8 },
      { id: 's_capri', type: 'physical', product: { itemId: 'capri_sun', name: 'Capri-Sun', icon: '🧃', category: 'Boissons Fraîches' }, label: '🧃 Capri-Sun', color: '#16A34A', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 's_chips', type: 'physical', product: { itemId: 'chips_barbecue', name: 'Chips Barbecue', icon: '🥔', category: 'Chips' }, label: '🥔 Chips BBQ', color: '#CA8A04', textColor: '#000', weight: 3, isPhysical: true },
      { id: 's_kitkat', type: 'physical', product: { itemId: 'kitkat', name: 'Kitkat', icon: '🍫', category: 'Sucreries' }, label: '🍫 Kitkat', color: '#DC2626', textColor: '#FFF', weight: 3, isPhysical: true }
    ]
  },
  'energie': {
    id: 'energie',
    name: 'Roue Énergie & Red Bull',
    subtitle: 'La recharge des nuits de rush et hackathons',
    type: 'paid',
    cost: 750,
    badge: '750 🪙',
    badgeClass: 'badge-coins',
    icon: '⚡',
    description: 'Vise les canettes Red Bull et Monster Energy ou décroche le jackpot de 5 000 coins !',
    segments: [
      { id: 'e_300', type: 'coins', coins: 300, label: '300 🪙', color: '#334155', textColor: '#FFF', weight: 26 },
      { id: 'e_750', type: 'coins', coins: 750, label: '750 🪙 (Remboursé)', color: '#1E3A8A', textColor: '#FFF', weight: 24 },
      { id: 'e_1500', type: 'coins', coins: 1500, label: '1 500 🪙 (x2)', color: '#0D9488', textColor: '#FFF', weight: 18 },
      { id: 'e_2500', type: 'coins', coins: 2500, label: '2 500 🪙 (x3.3)', color: '#3B82F6', textColor: '#FFF', weight: 12 },
      { id: 'e_5000', type: 'coins', coins: 5000, label: '🔥 5 000 🪙 (x6.6)', color: '#8B5CF6', textColor: '#FFF', weight: 8, isJackpot: true },
      { id: 'e_redbull', type: 'physical', product: { itemId: 'red_bull_classic', name: 'Red Bull', icon: '⚡', category: 'Red Bull' }, label: '⚡ Red Bull 250ml', color: '#2563EB', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 'e_monster', type: 'physical', product: { itemId: 'monster_mango_loco', name: 'Monster Mango Loco', icon: '⚡', category: 'Boissons Fraîches' }, label: '⚡ Monster Mango', color: '#059669', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 'e_juneberry', type: 'physical', product: { itemId: 'red_bull_juneberry', name: 'Red Bull Juneberry', icon: '⚡', category: 'Red Bull' }, label: '⚡ RB Juneberry', color: '#7C3AED', textColor: '#FFF', weight: 4, isPhysical: true }
    ]
  },
  'royale': {
    id: 'royale',
    name: 'Roue Royale BDE',
    subtitle: 'La plus haute mise pour les repas et jackpots',
    type: 'paid',
    cost: 2000,
    badge: '2 000 🪙',
    badgeClass: 'badge-coins',
    icon: '👑',
    description: 'La table VIP des roues de la fortune : 10 000 coins de jackpot, Hot-Dogs chauds et menus complets au stand !',
    segments: [
      { id: 'r_1000', type: 'coins', coins: 1000, label: '1 000 🪙', color: '#334155', textColor: '#FFF', weight: 26 },
      { id: 'r_2000', type: 'coins', coins: 2000, label: '2 000 🪙 (Remboursé)', color: '#1E3A8A', textColor: '#FFF', weight: 24 },
      { id: 'r_3500', type: 'coins', coins: 3500, label: '3 500 🪙 (x1.75)', color: '#0D9488', textColor: '#FFF', weight: 18 },
      { id: 'r_5000', type: 'coins', coins: 5000, label: '5 000 🪙 (x2.5)', color: '#3B82F6', textColor: '#FFF', weight: 12 },
      { id: 'r_10000', type: 'coins', coins: 10000, label: '👑 10 000 🪙 (x5)', color: '#D4AF37', textColor: '#000', weight: 8, isJackpot: true },
      { id: 'r_hotdog', type: 'physical', product: { itemId: 'hot_dog_simple', name: 'Hot-dog (version simple)', icon: '🌭', category: 'Repas' }, label: '🌭 Hot-Dog Chaud', color: '#DC2626', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 'r_pringles', type: 'physical', product: { itemId: 'pringles_sour_cream', name: 'Pringles Sour Cream and Onion 70g', icon: '🥔', category: 'Chips' }, label: '🥔 Pringles 70g', color: '#059669', textColor: '#FFF', weight: 4, isPhysical: true },
      { id: 'r_menu', type: 'physical', product: { itemId: 'menu_hot_dog', name: 'Menu Hot-Dog', icon: '🌭', category: 'Repas' }, label: '🌭 Menu Complet BDE', color: '#D97706', textColor: '#000', weight: 4, isPhysical: true }
    ]
  }
};

// Vérifie le cooldown d'un utilisateur pour une roue
function getUserCooldown(userId, wheel) {
  if (wheel.type !== 'free') {
    return { canSpin: true, remainingMs: 0, streak: 0 };
  }

  const cooldownMs = (wheel.cooldownHours || 24) * 60 * 60 * 1000;
  const streakResetMs = 48 * 60 * 60 * 1000;

  // Chercher d'abord dans user_wheel_cooldowns
  const row = db.prepare('SELECT last_spin_at, streak FROM user_wheel_cooldowns WHERE user_id = ? AND wheel_id = ?').get(userId, wheel.id);
  
  let lastSpinAt = row ? row.last_spin_at : null;
  let streak = row ? row.streak : 0;

  // Fallback rétrocompatible pour la roue quotidienne avec users.last_free_spin
  if (!lastSpinAt && wheel.id === 'quotidienne') {
    const user = db.prepare('SELECT last_free_spin, free_spin_streak FROM users WHERE id = ?').get(userId);
    if (user && user.last_free_spin) {
      lastSpinAt = user.last_free_spin;
      streak = user.free_spin_streak || 0;
    }
  }

  if (!lastSpinAt) {
    return { canSpin: true, remainingMs: 0, streak: 0 };
  }

  const elapsed = Date.now() - new Date(lastSpinAt).getTime();
  if (elapsed < cooldownMs) {
    return {
      canSpin: false,
      remainingMs: cooldownMs - elapsed,
      streak
    };
  }

  // Si plus de 48h sans tourner, reset le streak
  if (elapsed > streakResetMs) {
    streak = 0;
  }

  return { canSpin: true, remainingMs: 0, streak };
}

// Récupère la liste de toutes les roues avec le statut pour l'utilisateur
function getAllWheels(userId) {
  return Object.values(WHEELS_CONFIG).map(w => {
    const cd = userId ? getUserCooldown(userId, w) : { canSpin: w.type !== 'free', remainingMs: 0, streak: 0 };
    return {
      id: w.id,
      name: w.name,
      subtitle: w.subtitle,
      type: w.type,
      cost: w.cost,
      badge: w.badge,
      badgeClass: w.badgeClass,
      icon: w.icon,
      description: w.description,
      segmentsCount: w.segments.length,
      topPrizes: w.segments.filter(s => s.isPhysical || s.isJackpot).map(s => s.label),
      canSpin: cd.canSpin,
      remainingMs: cd.remainingMs,
      streak: cd.streak
    };
  });
}

// Récupère la configuration détaillée d'une roue pour l'écran de jeu
function getWheel(wheelId, userId) {
  const wheel = WHEELS_CONFIG[wheelId];
  if (!wheel) return null;

  const cd = userId ? getUserCooldown(userId, wheel) : { canSpin: wheel.type !== 'free', remainingMs: 0, streak: 0 };

  // Exclure les poids exacts côté client pour la sécurité
  const safeSegments = wheel.segments.map((s, index) => ({
    index,
    id: s.id,
    type: s.type,
    coins: s.coins || 0,
    label: s.label,
    color: s.color,
    textColor: s.textColor || '#FFF',
    isPhysical: !!s.isPhysical,
    isJackpot: !!s.isJackpot,
    product: s.product || null
  }));

  return {
    id: wheel.id,
    name: wheel.name,
    subtitle: wheel.subtitle,
    type: wheel.type,
    cost: wheel.cost,
    badge: wheel.badge,
    badgeClass: wheel.badgeClass,
    icon: wheel.icon,
    description: wheel.description,
    segments: safeSegments,
    canSpin: cd.canSpin,
    remainingMs: cd.remainingMs,
    streak: cd.streak
  };
}

// Lancement d'un tour de roue (sécurisé serveur)
function spinWheel(wheelId, userId) {
  const wheel = WHEELS_CONFIG[wheelId];
  if (!wheel) {
    throw new Error('Roue introuvable.');
  }

  const user = db.prepare('SELECT id, username, coins, total_wagered FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('Utilisateur introuvable.');
  }

  // 1. Vérification pour roue gratuite
  let newStreak = 1;
  if (wheel.type === 'free') {
    const cd = getUserCooldown(userId, wheel);
    if (!cd.canSpin) {
      const remainingSecs = Math.ceil(cd.remainingMs / 1000);
      const hours = Math.floor(remainingSecs / 3600);
      const mins = Math.floor((remainingSecs % 3600) / 60);
      throw new Error(`Patience ! Ton prochain tour gratuit sera disponible dans ${hours}h ${mins}m.`);
    }
    newStreak = (cd.streak || 0) + 1;
  }

  // 2. Vérification pour roue payante en coins
  if (wheel.type === 'paid') {
    if (user.coins < wheel.cost) {
      throw new Error(`Solde insuffisant ! Il te manque ${(wheel.cost - user.coins).toLocaleString()} coins.`);
    }
  }

  // 3. Tirage aléatoire pondéré côté serveur
  const weightedPool = [];
  wheel.segments.forEach((seg, index) => {
    const weight = seg.weight || 10;
    for (let i = 0; i < weight; i++) {
      weightedPool.push(index);
    }
  });

  const poolIndex = crypto.randomInt(0, weightedPool.length);
  const winningSegmentIndex = weightedPool[poolIndex];
  const winningSegment = wheel.segments[winningSegmentIndex];

  const segmentAngle = 360 / wheel.segments.length;
  const targetAngle = (winningSegmentIndex * segmentAngle) + (segmentAngle / 2);

  // 4. Exécution atomique en base de données
  const nowIso = new Date().toISOString();
  let claimCode = null;
  let orderInfo = null;

  const executeSpin = db.transaction(() => {
    // Déduction du coût si payant
    if (wheel.type === 'paid') {
      const deduct = db.prepare('UPDATE users SET coins = coins - ?, total_wagered = total_wagered + ? WHERE id = ? AND coins >= ?')
        .run(wheel.cost, wheel.cost, userId, wheel.cost);
      if (deduct.changes === 0) {
        throw new Error('Solde insuffisant.');
      }
    }

    // Gestion du gain
    if (winningSegment.type === 'coins') {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(winningSegment.coins, userId);
    } else if (winningSegment.type === 'physical') {
      // Génération d'un code de retrait unique garanti
      claimCode = generateClaimCode();
      while (db.prepare('SELECT id FROM shop_orders WHERE claim_code = ?').get(claimCode)) {
        claimCode = generateClaimCode();
      }

      const orderInsert = db.prepare(`
        INSERT INTO shop_orders (claim_code, user_id, item_id, item_name, variant_name, coins_paid, status, source)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 'wheel')
      `).run(
        claimCode,
        userId,
        winningSegment.product?.itemId || 'coca',
        winningSegment.product.name,
        `Gagné sur ${wheel.name}`,
        wheel.cost || 0
      );

      orderInfo = {
        id: orderInsert.lastInsertRowid,
        claimCode,
        itemName: winningSegment.product.name,
        icon: winningSegment.product.icon,
        category: winningSegment.product.category,
        wheelName: wheel.name
      };
    }

    // Mise à jour du cooldown pour roue gratuite
    if (wheel.type === 'free') {
      db.prepare(`
        INSERT INTO user_wheel_cooldowns (user_id, wheel_id, last_spin_at, streak)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, wheel_id) DO UPDATE SET
          last_spin_at = excluded.last_spin_at,
          streak = excluded.streak
      `).run(userId, wheel.id, nowIso, newStreak);

      if (wheel.id === 'quotidienne') {
        db.prepare('UPDATE users SET last_free_spin = ?, free_spin_streak = ? WHERE id = ?')
          .run(nowIso, newStreak, userId);
      }
    }

    // Enregistrement dans l'historique
    const profit = (winningSegment.type === 'coins' ? winningSegment.coins : 0) - wheel.cost;
    db.prepare(`
      INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      `wheel_${wheel.id}`,
      wheel.cost,
      winningSegment.type === 'coins' ? winningSegment.coins : 0,
      profit,
      JSON.stringify({
        wheelId: wheel.id,
        wheelName: wheel.name,
        segmentIndex: winningSegmentIndex,
        segmentLabel: winningSegment.label,
        isPhysical: !!winningSegment.isPhysical,
        claimCode,
        product: winningSegment.product || null
      })
    );

    const updatedUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    return {
      newCoins: updatedUser.coins
    };
  });

  const txResult = executeSpin();

  return {
    wheelId: wheel.id,
    segmentIndex: winningSegmentIndex,
    winningIndex: winningSegmentIndex,
    targetAngle,
    segment: {
      index: winningSegmentIndex,
      id: winningSegment.id,
      type: winningSegment.type,
      label: winningSegment.label,
      icon: winningSegment.icon || (winningSegment.type === 'physical' ? '🥤' : '🪙'),
      color: winningSegment.color,
      isPhysical: !!winningSegment.isPhysical,
      isJackpot: !!winningSegment.isJackpot,
      coins: winningSegment.coins || 0,
      product: winningSegment.product || null
    },
    wonItem: {
      index: winningSegmentIndex,
      id: winningSegment.id,
      type: winningSegment.type,
      label: winningSegment.label,
      icon: winningSegment.icon || (winningSegment.type === 'physical' ? '🥤' : '🪙'),
      color: winningSegment.color,
      isPhysical: !!winningSegment.isPhysical,
      isJackpot: !!winningSegment.isJackpot,
      coins: winningSegment.coins || 0,
      product: winningSegment.product || null
    },
    isPhysical: !!winningSegment.isPhysical,
    claimCode,
    order: orderInfo,
    coins: txResult.newCoins,
    userCoins: txResult.newCoins,
    cost: wheel.cost,
    streak: newStreak
  };
}

module.exports = {
  WHEELS_CONFIG,
  getAllWheels,
  getWheel,
  spinWheel,
  getUserCooldown
};
