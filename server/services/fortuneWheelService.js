const crypto = require('crypto');
const db = require('../database/db');

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
  'roue_2000': {
    id: 'roue_2000',
    name: 'Roue 2000 Coins',
    subtitle: 'Boissons fraîches & chocolats gourmands',
    type: 'paid',
    cost: 2000,
    dailyLimit: 5,
    badge: '2 000 🪙',
    badgeClass: 'badge-coins',
    icon: '🥤',
    description: 'Coût : 2 000 coins par tour. 80% de chance de remporter 250 coins, 10% de gagner une canette au choix et 10% un chocolat ! (Max 5 tours / jour)',
    segments: [
      { id: 'r2000_c1', type: 'coins', coins: 250, label: '250 🪙', color: '#1E3A8A', textColor: '#FFF', weight: 10 },
      { id: 'r2000_canette', type: 'physical', product: { itemId: 'canette', name: 'Canette 33cl au choix', icon: '🥤', category: 'Boissons Fraîches' }, label: '🥤 Canette au choix', color: '#DC2626', textColor: '#FFF', weight: 10, isPhysical: true },
      { id: 'r2000_c2', type: 'coins', coins: 250, label: '250 🪙', color: '#0D9488', textColor: '#FFF', weight: 10 },
      { id: 'r2000_c3', type: 'coins', coins: 250, label: '250 🪙', color: '#3B82F6', textColor: '#FFF', weight: 10 },
      { id: 'r2000_chocolat', type: 'physical', product: { itemId: 'chocolat', name: 'Chocolat au choix', icon: '🍫', category: 'Sucreries' }, label: '🍫 Chocolat au choix', color: '#EA580C', textColor: '#FFF', weight: 10, isPhysical: true },
      { id: 'r2000_c4', type: 'coins', coins: 250, label: '250 🪙', color: '#1E3A8A', textColor: '#FFF', weight: 10 },
      { id: 'r2000_c5', type: 'coins', coins: 250, label: '250 🪙', color: '#0D9488', textColor: '#FFF', weight: 10 },
      { id: 'r2000_c6', type: 'coins', coins: 250, label: '250 🪙', color: '#3B82F6', textColor: '#FFF', weight: 10 },
      { id: 'r2000_c7', type: 'coins', coins: 250, label: '250 🪙', color: '#8B5CF6', textColor: '#FFF', weight: 10 },
      { id: 'r2000_c8', type: 'coins', coins: 250, label: '250 🪙', color: '#0284C7', textColor: '#FFF', weight: 10 }
    ]
  },
  'roue_3000': {
    id: 'roue_3000',
    name: 'Roue 3000 Coins',
    subtitle: 'Énergie Red Bull & recharges express',
    type: 'paid',
    cost: 3000,
    dailyLimit: 5,
    badge: '3 000 🪙',
    badgeClass: 'badge-coins',
    icon: '⚡',
    description: 'Coût : 3 000 coins par tour. 80% de chance de remporter 300 coins et 20% de gagner une canette Red Bull 250ml ! (Max 5 tours / jour)',
    segments: [
      { id: 'r3000_c1', type: 'coins', coins: 300, label: '300 🪙', color: '#1E3A8A', textColor: '#FFF', weight: 10 },
      { id: 'r3000_rb1', type: 'physical', product: { itemId: 'red_bull', name: 'Canette Red Bull 250ml', icon: '⚡', category: 'Red Bull' }, label: '⚡ Red Bull 250ml', color: '#2563EB', textColor: '#FFF', weight: 10, isPhysical: true },
      { id: 'r3000_c2', type: 'coins', coins: 300, label: '300 🪙', color: '#0D9488', textColor: '#FFF', weight: 10 },
      { id: 'r3000_c3', type: 'coins', coins: 300, label: '300 🪙', color: '#3B82F6', textColor: '#FFF', weight: 10 },
      { id: 'r3000_c4', type: 'coins', coins: 300, label: '300 🪙', color: '#8B5CF6', textColor: '#FFF', weight: 10 },
      { id: 'r3000_c5', type: 'coins', coins: 300, label: '300 🪙', color: '#1E3A8A', textColor: '#FFF', weight: 10 },
      { id: 'r3000_rb2', type: 'physical', product: { itemId: 'red_bull', name: 'Canette Red Bull 250ml', icon: '⚡', category: 'Red Bull' }, label: '⚡ Red Bull 250ml', color: '#7C3AED', textColor: '#FFF', weight: 10, isPhysical: true },
      { id: 'r3000_c6', type: 'coins', coins: 300, label: '300 🪙', color: '#0D9488', textColor: '#FFF', weight: 10 },
      { id: 'r3000_c7', type: 'coins', coins: 300, label: '300 🪙', color: '#3B82F6', textColor: '#FFF', weight: 10 },
      { id: 'r3000_c8', type: 'coins', coins: 300, label: '300 🪙', color: '#0284C7', textColor: '#FFF', weight: 10 }
    ]
  }
};

const DAILY_PAID_SPIN_LIMIT = 5;

// Obtient la date du jour au format YYYY-MM-DD (fuseau local, reset automatique à minuit)
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Récupère l'état des tours quotidiens d'un utilisateur pour une roue
function getUserDailySpins(userId, wheelId) {
  const spinDate = getTodayDateString();
  const row = db.prepare('SELECT spins_count FROM user_wheel_daily_spins WHERE user_id = ? AND wheel_id = ? AND spin_date = ?').get(userId, wheelId, spinDate);
  const spinsToday = row ? row.spins_count : 0;
  const maxSpins = DAILY_PAID_SPIN_LIMIT;
  const remainingSpins = Math.max(0, maxSpins - spinsToday);
  return {
    spinDate,
    spinsToday,
    maxSpins,
    remainingSpins,
    limitReached: spinsToday >= maxSpins
  };
}

// Initialisation dans SQLite
function initWheelConfigsDb() {
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='wheel_configs'").get();
    if (!tableExists) return;

    // Supprimer les anciennes roues payantes obsolètes si existantes
    const obsoleteIds = ['snack', 'energie', 'royale'];
    for (const oldId of obsoleteIds) {
      db.prepare('DELETE FROM wheel_configs WHERE id = ?').run(oldId);
    }

    const upsert = db.prepare(`
      INSERT INTO wheel_configs (id, name, subtitle, type, cost, cooldown_hours, badge, badge_class, icon, description, segments_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        subtitle = excluded.subtitle,
        type = excluded.type,
        cost = excluded.cost,
        cooldown_hours = excluded.cooldown_hours,
        badge = excluded.badge,
        badge_class = excluded.badge_class,
        icon = excluded.icon,
        description = excluded.description,
        segments_json = excluded.segments_json
    `);

    for (const key of Object.keys(WHEELS_CONFIG)) {
      const w = WHEELS_CONFIG[key];
      upsert.run(
        w.id,
        w.name,
        w.subtitle,
        w.type,
        w.cost,
        w.cooldownHours || 24,
        w.badge,
        w.badgeClass,
        w.icon,
        w.description,
        JSON.stringify(w.segments)
      );
    }
  } catch (err) {
    console.error('Erreur initWheelConfigsDb:', err);
  }
}
initWheelConfigsDb();

// Récupère une configuration de roue depuis SQLite (ou fallback code)
function getWheelConfig(wheelId) {
  try {
    const row = db.prepare('SELECT * FROM wheel_configs WHERE id = ?').get(wheelId);
    if (row) {
      return {
        id: row.id,
        name: row.name,
        subtitle: row.subtitle,
        type: row.type,
        cost: row.cost,
        cooldownHours: row.cooldown_hours,
        badge: row.badge,
        badgeClass: row.badge_class,
        icon: row.icon,
        description: row.description,
        segments: JSON.parse(row.segments_json)
      };
    }
  } catch (err) {
    console.error(`Erreur getWheelConfig(${wheelId}):`, err);
  }
  return WHEELS_CONFIG[wheelId] || null;
}

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
  let wheels = [];
  try {
    const rows = db.prepare('SELECT * FROM wheel_configs ORDER BY cost ASC').all();
    if (rows && rows.length > 0) {
      wheels = rows.map(r => ({
        id: r.id,
        name: r.name,
        subtitle: r.subtitle,
        type: r.type,
        cost: r.cost,
        cooldownHours: r.cooldown_hours,
        badge: r.badge,
        badgeClass: r.badge_class,
        icon: r.icon,
        description: r.description,
        segments: JSON.parse(r.segments_json)
      }));
    }
  } catch (e) {
    wheels = Object.values(WHEELS_CONFIG);
  }
  if (!wheels || wheels.length === 0) wheels = Object.values(WHEELS_CONFIG);

  return wheels.map(w => {
    const isFree = w.type === 'free';
    const cd = isFree ? (userId ? getUserCooldown(userId, w) : { canSpin: true, remainingMs: 0, streak: 0 }) : { canSpin: true, remainingMs: 0, streak: 0 };
    const dailyLimit = (!isFree && userId) ? getUserDailySpins(userId, w.id) : {
      spinDate: getTodayDateString(),
      spinsToday: 0,
      maxSpins: DAILY_PAID_SPIN_LIMIT,
      remainingSpins: DAILY_PAID_SPIN_LIMIT,
      limitReached: false
    };

    const canSpin = isFree ? cd.canSpin : !dailyLimit.limitReached;

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
      canSpin,
      remainingMs: cd.remainingMs,
      streak: cd.streak,
      dailyLimit,
      spinsToday: dailyLimit.spinsToday,
      maxSpins: dailyLimit.maxSpins,
      remainingSpinsToday: dailyLimit.remainingSpins,
      limitReached: dailyLimit.limitReached
    };
  });
}

// Récupère la configuration détaillée d'une roue pour l'écran de jeu
function getWheel(wheelId, userId) {
  const wheel = getWheelConfig(wheelId);
  if (!wheel) return null;

  const isFree = wheel.type === 'free';
  const cd = isFree ? (userId ? getUserCooldown(userId, wheel) : { canSpin: true, remainingMs: 0, streak: 0 }) : { canSpin: true, remainingMs: 0, streak: 0 };
  const dailyLimit = (!isFree && userId) ? getUserDailySpins(userId, wheel.id) : {
    spinDate: getTodayDateString(),
    spinsToday: 0,
    maxSpins: DAILY_PAID_SPIN_LIMIT,
    remainingSpins: DAILY_PAID_SPIN_LIMIT,
    limitReached: false
  };

  const canSpin = isFree ? cd.canSpin : !dailyLimit.limitReached;

  // Calcul des probabilités exactes pour l'affichage transparent
  const totalWeight = wheel.segments.reduce((acc, s) => acc + (Number(s.weight) || 1), 0);

  const safeSegments = wheel.segments.map((s, index) => {
    const weight = Number(s.weight) || 1;
    const probability = totalWeight > 0 ? (weight / totalWeight) : (1 / wheel.segments.length);
    return {
      index,
      id: s.id || `seg_${index}`,
      type: s.type,
      coins: s.coins || 0,
      label: s.label,
      icon: s.icon || (s.type === 'physical' ? '🥤' : '🪙'),
      color: s.color,
      textColor: s.textColor || '#FFF',
      isPhysical: !!s.isPhysical,
      isJackpot: !!s.isJackpot,
      product: s.product || null,
      probability: Number(probability.toFixed(4))
    };
  });

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
    canSpin,
    remainingMs: cd.remainingMs,
    streak: cd.streak,
    dailyLimit,
    spinsToday: dailyLimit.spinsToday,
    maxSpins: dailyLimit.maxSpins,
    remainingSpinsToday: dailyLimit.remainingSpins,
    limitReached: dailyLimit.limitReached
  };
}

// Récupère toutes les roues avec tous les détails pour l'administration BDE
function getAllWheelsAdmin() {
  initWheelConfigsDb();
  let rows = [];
  try {
    rows = db.prepare('SELECT * FROM wheel_configs ORDER BY cost ASC').all();
  } catch (e) {
    rows = [];
  }

  return rows.map(r => {
    let segments = [];
    try {
      segments = JSON.parse(r.segments_json);
    } catch (e) {
      segments = [];
    }

    const totalWeight = segments.reduce((sum, s) => sum + (Number(s.weight) || 1), 0);
    const enrichedSegments = segments.map((s, idx) => {
      const weight = Number(s.weight) || 1;
      const probPercent = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      return {
        id: s.id || `seg_${idx}`,
        label: s.label || `Lot #${idx + 1}`,
        type: s.type || 'coins',
        coins: Number(s.coins) || 0,
        icon: s.icon || (s.type === 'physical' ? '🎁' : '🪙'),
        color: s.color || '#1E3A8A',
        textColor: s.textColor || '#FFF',
        weight: weight,
        probabilityPercent: Number(probPercent.toFixed(1)),
        isJackpot: !!s.isJackpot,
        isPhysical: s.type === 'physical',
        product: s.product || null
      };
    });

    return {
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      type: r.type,
      cost: r.cost,
      cooldownHours: r.cooldown_hours,
      badge: r.badge,
      badgeClass: r.badge_class,
      icon: r.icon,
      description: r.description,
      segments: enrichedSegments,
      totalWeight,
      updatedAt: r.updated_at
    };
  });
}

// Mise à jour sécurisée des segments d'une roue par l'administrateur
function updateWheelSegments(wheelId, newSegments) {
  const wheel = getWheelConfig(wheelId);
  if (!wheel) {
    throw new Error('Roue introuvable.');
  }

  if (!Array.isArray(newSegments) || newSegments.length < 2) {
    throw new Error('Une roue doit comporter au minimum 2 segments.');
  }

  if (newSegments.length > 24) {
    throw new Error('Une roue ne peut pas comporter plus de 24 segments.');
  }

  // Nettoyage et validation de chaque segment
  let totalWeight = 0;
  const cleanedSegments = newSegments.map((s, idx) => {
    const label = String(s.label || '').trim();
    if (!label) {
      throw new Error(`Le segment #${idx + 1} doit avoir un libellé.`);
    }

    const type = s.type === 'physical' ? 'physical' : 'coins';
    const coins = type === 'coins' ? Math.max(0, parseInt(s.coins !== undefined ? s.coins : s.value, 10) || 0) : 0;
    const weight = Math.max(0.1, parseFloat(s.weight || s.probabilityPercent || 10));
    totalWeight += weight;

    return {
      id: s.id || `seg_${Date.now()}_${idx}`,
      label,
      type,
      coins,
      icon: s.icon ? String(s.icon).trim() : (type === 'physical' ? '🎁' : '🪙'),
      color: s.color || '#1E3A8A',
      textColor: s.textColor || '#FFFFFF',
      weight: Number(weight.toFixed(1)),
      isPhysical: type === 'physical',
      isJackpot: !!s.isJackpot,
      product: type === 'physical' ? (s.product || { itemId: String(s.value || 'custom'), name: label, icon: s.icon || '🎁', category: 'Lots BDE' }) : null
    };
  });

  // Sauvegarde dans la base de données
  db.prepare(`
    UPDATE wheel_configs
    SET segments_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(cleanedSegments), wheelId);

  return getWheelConfig(wheelId);
}

// Lancement d'un tour de roue (sécurisé serveur)
function spinWheel(wheelId, userId) {
  const wheel = getWheelConfig(wheelId);
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
    const daily = getUserDailySpins(userId, wheel.id);
    if (daily.limitReached) {
      throw new Error(`Limite quotidienne atteinte pour cette roue (${daily.maxSpins}/${daily.maxSpins} tours). Reviens demain !`);
    }

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
  let orderInfo = null;

  const executeSpin = db.transaction(() => {
    // Déduction du coût si payant
    if (wheel.type === 'paid') {
      const deduct = db.prepare('UPDATE users SET coins = coins - ?, total_wagered = total_wagered + ? WHERE id = ? AND coins >= ?')
        .run(wheel.cost, wheel.cost, userId, wheel.cost);
      if (deduct.changes === 0) {
        throw new Error('Solde insuffisant.');
      }

      // Incrémentation du compteur journalier pour roue payante (limite 5/jour)
      const todayStr = getTodayDateString();
      db.prepare(`
        INSERT INTO user_wheel_daily_spins (user_id, wheel_id, spin_date, spins_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id, wheel_id, spin_date) DO UPDATE SET
          spins_count = spins_count + 1
      `).run(userId, wheel.id, todayStr);
    }

    // Gestion du gain
    if (winningSegment.type === 'coins') {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(winningSegment.coins, userId);
    } else if (winningSegment.type === 'physical') {
      const orderInsert = db.prepare(`
        INSERT INTO delivery_orders (
          user_id, last_name, first_name, room_location, phone,
          item_id, item_name, variant_name, quantity, coins_paid,
          source, status, email_status
        )
        VALUES (?, 'À renseigner', 'Élève', 'À renseigner', NULL, ?, ?, ?, 1, ?, 'wheel', 'pending_info', 'not_configured')
      `).run(
        userId,
        winningSegment.product?.itemId || 'coca',
        winningSegment.product.name,
        `Gagné sur ${wheel.name}`,
        wheel.cost || 0
      );

      orderInfo = {
        id: orderInsert.lastInsertRowid,
        deliveryId: orderInsert.lastInsertRowid,
        itemName: winningSegment.product.name,
        icon: winningSegment.product.icon,
        category: winningSegment.product.category,
        wheelName: wheel.name,
        needsDeliveryInfo: true,
        status: 'pending_info'
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
        deliveryId: orderInfo ? orderInfo.id : null,
        product: winningSegment.product || null
      })
    );

    const updatedUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    return {
      newCoins: updatedUser.coins
    };
  });

  const txResult = executeSpin();

  try {
    const socketService = require('./socketService');
    socketService.notifyUserBalance(userId, txResult.newCoins);
    socketService.notifyLeaderboardUpdated();
    if (orderInfo) {
      socketService.notifyOrdersUpdated();
    }
    const profit = (winningSegment.type === 'coins' ? winningSegment.coins : 0) - wheel.cost;
    if (profit > 0 || winningSegment.isPhysical || winningSegment.isJackpot) {
      socketService.notifyNewWin({
        username: user.username,
        game_type: `wheel_${wheel.id}`,
        profit: Math.max(0, profit),
        payout: winningSegment.type === 'coins' ? winningSegment.coins : 0,
        label: winningSegment.label,
        created_at: new Date().toISOString()
      });
    }
  } catch (sockErr) {}

    const postDaily = wheel.type === 'paid' ? getUserDailySpins(userId, wheel.id) : null;

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
      winningSegment: {
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
      order: orderInfo,
      coins: txResult.newCoins,
      userCoins: txResult.newCoins,
      cost: wheel.cost,
      remainingMs: wheel.type === 'free' ? (wheel.cooldownHours || 24) * 3600 * 1000 : 0,
      canSpin: wheel.type === 'free' ? false : (postDaily ? !postDaily.limitReached : true),
      streak: newStreak,
      dailyLimit: postDaily,
      spinsToday: postDaily ? postDaily.spinsToday : 0,
      maxSpins: postDaily ? postDaily.maxSpins : 5,
      remainingSpinsToday: postDaily ? postDaily.remainingSpins : 5,
      limitReached: postDaily ? postDaily.limitReached : false
    };
  }

/**
 * Confirme la demande de livraison pour un lot gagné à la roue
 */
async function confirmWheelDelivery(orderId, userId, { lastName, firstName, roomLocation, phone, notes }) {
  if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 2) {
    throw new Error('Le nom est obligatoire (2 caractères minimum).');
  }
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    throw new Error('Le prénom est obligatoire (2 caractères minimum).');
  }
  if (!roomLocation || typeof roomLocation !== 'string' || roomLocation.trim().length < 2) {
    throw new Error('La salle ou le lieu où tu te trouves est obligatoire.');
  }

  const cleanLastName = lastName.trim();
  const cleanFirstName = firstName.trim();
  const cleanRoomLocation = roomLocation.trim();
  const cleanPhone = (phone && typeof phone === 'string') ? phone.trim() : null;
  const cleanNotes = (notes && typeof notes === 'string') ? notes.trim() : null;

  const order = db.prepare(`
    SELECT d.*, u.username
    FROM delivery_orders d
    JOIN users u ON d.user_id = u.id
    WHERE d.id = ? AND d.user_id = ?
  `).get(orderId, userId);

  if (!order) {
    throw new Error('Demande de lot introuvable.');
  }

  db.prepare(`
    UPDATE delivery_orders
    SET last_name = ?,
        first_name = ?,
        room_location = ?,
        phone = ?,
        notes = ?,
        status = 'pending'
    WHERE id = ?
  `).run(cleanLastName, cleanFirstName, cleanRoomLocation, cleanPhone, cleanNotes, orderId);

  const updated = db.prepare(`
    SELECT d.*, u.username
    FROM delivery_orders d
    JOIN users u ON d.user_id = u.id
    WHERE d.id = ?
  `).get(orderId);

  const emailService = require('./emailService');
  let emailResult = { success: false, status: 'failed' };
  try {
    emailResult = await emailService.sendDeliveryNotification(updated);
    db.prepare(`
      UPDATE delivery_orders
      SET email_status = ?, email_error = ?
      WHERE id = ?
    `).run(
      emailResult.status || (emailResult.success ? 'sent' : 'failed'),
      emailResult.error || null,
      orderId
    );
  } catch (err) {
    console.error('Erreur non bloquante envoi email roue:', err.message);
  }

  return {
    success: true,
    message: `Demande de livraison confirmée ! Un membre du BDE t'apportera ton lot en salle ${cleanRoomLocation}.`,
    delivery: updated,
    emailSent: emailResult.success
  };
}

module.exports = {
  WHEELS_CONFIG,
  getAllWheels,
  getWheel,
  getAllWheelsAdmin,
  updateWheelSegments,
  spinWheel,
  getUserCooldown,
  confirmWheelDelivery
};
