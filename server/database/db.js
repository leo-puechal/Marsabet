const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

const db = new Database(config.dbPath);

// Activer WAL mode pour de bien meilleures performances concurrentes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 1000,
      role TEXT NOT NULL DEFAULT 'student',
      daily_streak INTEGER NOT NULL DEFAULT 0,
      last_daily_claim TEXT DEFAULT NULL,
      total_wagered INTEGER NOT NULL DEFAULT 0,
      total_won INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      biggest_win INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_type TEXT NOT NULL,
      bet INTEGER NOT NULL,
      payout INTEGER NOT NULL,
      profit INTEGER NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blackjack_sessions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      deck TEXT NOT NULL,
      player_hand TEXT NOT NULL,
      dealer_hand TEXT NOT NULL,
      bet INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'playing',
      can_double INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      initial_stock INTEGER NOT NULL DEFAULT 0,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES shop_items(id),
      item_name TEXT NOT NULL,
      coins_paid INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      collected_at DATETIME DEFAULT NULL,
      collected_by INTEGER DEFAULT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_history_user ON game_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_code ON shop_orders(claim_code);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON shop_orders(user_id, status);

    CREATE TABLE IF NOT EXISTS slot_sessions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      free_spins_remaining INTEGER NOT NULL DEFAULT 0,
      free_spins_total INTEGER NOT NULL DEFAULT 0,
      free_spins_multiplier INTEGER NOT NULL DEFAULT 3,
      free_spins_accumulated_win INTEGER NOT NULL DEFAULT 0,
      free_spins_bet_per_line INTEGER NOT NULL DEFAULT 1,
      free_spins_lines INTEGER NOT NULL DEFAULT 20,
      pending_gamble_amount INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crash_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bet INTEGER NOT NULL,
      crash_point REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      cashed_multiplier REAL DEFAULT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crash_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crash_point REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Assainissement préalable : aucun solde existant ne doit être inférieur à 0
  db.prepare("UPDATE users SET coins = 50000 WHERE username = 'bde_admin' AND coins < 0").run();
  db.prepare("UPDATE users SET coins = 0 WHERE coins < 0").run();

  // Déclencheurs stricts interdisant tout solde négatif (sécurité SQLite native)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS check_positive_coins_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN NEW.coins < 0
    BEGIN
      SELECT RAISE(ABORT, 'Solde insuffisant : les coins ne peuvent pas être négatifs.');
    END;

    CREATE TRIGGER IF NOT EXISTS check_positive_coins_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    WHEN NEW.coins < 0
    BEGIN
      SELECT RAISE(ABORT, 'Solde insuffisant : les coins ne peuvent pas être négatifs.');
    END;
  `);

  // Migration de la table users au cas où les nouvelles colonnes n'existent pas encore
  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  const hasRole = userColumns.some(c => c.name === 'role');
  if (!hasRole) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'");
  }
  const hasLastFreeSpin = userColumns.some(c => c.name === 'last_free_spin');
  if (!hasLastFreeSpin) {
    db.exec("ALTER TABLE users ADD COLUMN last_free_spin TEXT DEFAULT NULL");
  }
  const hasFreeSpinStreak = userColumns.some(c => c.name === 'free_spin_streak');
  if (!hasFreeSpinStreak) {
    db.exec("ALTER TABLE users ADD COLUMN free_spin_streak INTEGER NOT NULL DEFAULT 0");
  }
  const hasVipRank = userColumns.some(c => c.name === 'vip_rank');
  if (!hasVipRank) {
    db.exec("ALTER TABLE users ADD COLUMN vip_rank TEXT NOT NULL DEFAULT 'Bronze'");
  }

  // Migration de shop_items pour ajouter stock, initial_stock, is_active, created_at, variants, unit si absents
  const itemColumns = db.prepare("PRAGMA table_info(shop_items)").all();
  const hasStock = itemColumns.some(c => c.name === 'stock');
  if (!hasStock) {
    db.exec("ALTER TABLE shop_items ADD COLUMN stock INTEGER NOT NULL DEFAULT 50");
    db.exec("ALTER TABLE shop_items ADD COLUMN initial_stock INTEGER NOT NULL DEFAULT 50");
    db.exec("ALTER TABLE shop_items ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  }
  const hasCreatedAt = itemColumns.some(c => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE shop_items ADD COLUMN created_at TEXT DEFAULT NULL");
  }
  const hasVariants = itemColumns.some(c => c.name === 'variants');
  if (!hasVariants) {
    db.exec("ALTER TABLE shop_items ADD COLUMN variants TEXT DEFAULT NULL");
  }
  const hasUnit = itemColumns.some(c => c.name === 'unit');
  if (!hasUnit) {
    db.exec("ALTER TABLE shop_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'Pièce'");
  }

  // Migration de shop_orders pour ajouter variant_name et source si absents
  const orderColumns = db.prepare("PRAGMA table_info(shop_orders)").all();
  const hasVariantName = orderColumns.some(c => c.name === 'variant_name');
  if (!hasVariantName) {
    db.exec("ALTER TABLE shop_orders ADD COLUMN variant_name TEXT DEFAULT NULL");
  }
  const hasSource = orderColumns.some(c => c.name === 'source');
  if (!hasSource) {
    db.exec("ALTER TABLE shop_orders ADD COLUMN source TEXT NOT NULL DEFAULT 'shop'");
  }

  // Table des Demandes de Livraison Directe (remplace le système de code de retrait)
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      room_location TEXT NOT NULL,
      phone TEXT DEFAULT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      variant_name TEXT DEFAULT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      coins_paid INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'shop', -- 'shop' ou 'wheel'
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending_info', 'pending', 'delivered', 'cancelled'
      email_status TEXT NOT NULL DEFAULT 'pending', -- 'sent', 'failed', 'not_configured'
      email_error TEXT DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      delivered_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_delivery_user ON delivery_orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_orders(status);
  `);

  // Migration rétrocompatible des anciennes commandes vers delivery_orders si vide
  const deliveriesCount = db.prepare('SELECT COUNT(*) as count FROM delivery_orders').get().count;
  if (deliveriesCount === 0) {
    try {
      db.exec(`
        INSERT INTO delivery_orders (id, user_id, last_name, first_name, room_location, phone, item_id, item_name, variant_name, quantity, coins_paid, source, status, email_status, delivered_at, delivered_by, created_at)
        SELECT id, user_id, 'Étudiant', 'Marsabet', 'Stand BDE', NULL, item_id, item_name, variant_name, 1, coins_paid, source,
          CASE WHEN status = 'collected' THEN 'delivered' ELSE 'pending' END,
          'not_configured', collected_at, collected_by, created_at
        FROM shop_orders;
      `);
    } catch (migErr) {
      // Ignorer si shop_orders n'a pas pu être migré
    }
  }

  // Table pour enregistrer les cooldowns et streaks de chaque roue
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_wheel_cooldowns (
      user_id INTEGER NOT NULL,
      wheel_id TEXT NOT NULL,
      last_spin_at TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, wheel_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      coins_amount INTEGER NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 50,
      current_uses INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME DEFAULT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS code_utilisations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coins_awarded INTEGER NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
    CREATE INDEX IF NOT EXISTS idx_code_util_user ON code_utilisations(user_id);
    CREATE INDEX IF NOT EXISTS idx_code_util_code ON code_utilisations(code_id);
  `);

  // Initialisation du catalogue officiel BDE (Taux interne de calcul : 10 000 coins = 1,00 €)
  const officialCatalog = [
    // Sucreries
    ['dragibus_40g', 'Bonbons Dragibus 40g', 'Sucreries', 10000, 50, 50, '🍬', 'Sachet de bonbons Dragibus Haribo 40g', null, 'Pièce'],
    ['happy_life_40g', 'Bonbons Happy Life 40g', 'Sucreries', 10000, 50, 50, '🍬', 'Sachet Happy Life Haribo 40g', null, 'Pièce'],
    ['bounty', 'Bounty', 'Sucreries', 10000, 50, 50, '🍫', 'Barre chocolatée Bounty à la noix de coco', null, 'Pièce'],
    ['crunch', 'Crunch', 'Sucreries', 10000, 50, 50, '🍫', 'Barre Crunch chocolat au lait et riz soufflé', null, 'Pièce'],
    ['kinder_bueno', 'Kinder Bueno', 'Sucreries', 10000, 50, 50, '🍫', 'Gaufrette croustillante enrobée de chocolat au lait', null, 'Pièce'],
    ['kinder_bueno_white', 'Kinder Bueno White', 'Sucreries', 10000, 50, 50, '🍫', 'Gaufrette croustillante chocolat blanc', null, 'Pièce'],
    ['kinder_country', 'Kinder Country', 'Sucreries', 10000, 50, 50, '🍫', 'Barre de céréales soufflées au chocolat au lait', null, 'Pièce'],
    ['kinder_delice', 'Kinder Délice', 'Sucreries', 10000, 50, 50, '🍫', 'Génoise cacaotée avec cœur de lait', null, 'Pièce'],
    ['kinder_delice_coco', 'Kinder Délice Coco', 'Sucreries', 10000, 50, 50, '🍫', 'Génoise cacaotée au cœur de coco', null, 'Pièce'],
    ['kinder_maxi', 'Kinder Maxi', 'Sucreries', 10000, 50, 50, '🍫', 'Barre chocolatée Kinder Maxi', null, 'Pièce'],
    ['kitkat', 'Kitkat', 'Sucreries', 10000, 50, 50, '🍫', 'Gaufrettes croustillantes enrobées de chocolat au lait', null, 'Pièce'],
    ['kitkat_chunky', 'Kitkat Chunky', 'Sucreries', 10000, 50, 50, '🍫', 'Version Chunky ultra gourmande Kitkat', null, 'Pièce'],
    ['lion', 'Lion', 'Sucreries', 10000, 50, 50, '🍫', 'Gaufrette, caramel et céréales enrobés de chocolat', null, 'Pièce'],
    ['mars', 'Mars', 'Sucreries', 10000, 50, 50, '🍫', 'Barre de nougat tendre et caramel au chocolat au lait', null, 'Pièce'],
    ['mms', 'M&M’s', 'Sucreries', 10000, 50, 50, '🍬', 'Sachet individuel de M&M’s cacahuètes', null, 'Pièce'],
    ['pain_au_chocolat', 'Pain au chocolat', 'Sucreries', 5000, 40, 40, '🥐', 'Viennoiserie fraîche pour la pause', null, 'Pièce'],
    ['smarties', 'Smarties', 'Sucreries', 10000, 50, 50, '🍬', 'Boîte de Smarties chocolatés colorés', null, 'Pièce'],
    ['snickers', 'Snickers', 'Sucreries', 10000, 50, 50, '🍫', 'Nougat, cacahuètes grillées et caramel au chocolat', null, 'Pièce'],
    ['twix', 'Twix', 'Sucreries', 10000, 50, 50, '🍫', 'Biscuit croustillant et caramel enrobés de chocolat', null, 'Pièce'],

    // Boissons Fraîches
    ['cacolac', 'Cacolac', 'Boissons Fraîches', 10000, 40, 40, '🥛', 'Boisson lactée cacaotée servie fraîche', null, 'Pièce'],
    ['capri_sun', 'Capri-Sun', 'Boissons Fraîches', 5000, 60, 60, '🧃', 'Poche Capri-Sun multivitaminé 200ml', null, 'Pièce'],
    ['coca', 'Coca', 'Boissons Fraîches', 10000, 60, 60, '🥤', 'Canette Coca-Cola 33cl fraîche', null, 'Pièce'],
    ['coca_50cl', 'Coca 50cl', 'Boissons Fraîches', 15000, 40, 40, '🥤', 'Bouteille Coca-Cola 50cl fraîche', null, 'Pièce'],
    ['coca_cherry', 'Coca Cherry', 'Boissons Fraîches', 10000, 40, 40, '🥤', 'Canette Coca-Cola Cherry 33cl fraîche', null, 'Pièce'],
    ['coca_zero', 'Coca Zero', 'Boissons Fraîches', 10000, 40, 40, '🥤', 'Canette Coca-Cola Zero 33cl fraîche', null, 'Pièce'],
    ['ice_tea_peche', 'Ice Tea Pêche', 'Boissons Fraîches', 10000, 50, 50, '🧋', 'Canette Lipton Ice Tea Pêche 33cl fraîche', null, 'Pièce'],
    ['jus_de_banane', 'Jus de Banane', 'Boissons Fraîches', 10000, 30, 30, '🍌', 'Bouteille de jus de banane onctueux', null, 'Pièce'],
    ['monster_mango_loco', 'Monster Mango Loco', 'Boissons Fraîches', 20000, 35, 35, '⚡', 'Canette Monster Energy Mango Loco 500ml', null, 'Pièce'],
    ['oasis_pomme_cassis', 'Oasis Pomme Cassis Framboise', 'Boissons Fraîches', 10000, 40, 40, '🧃', 'Canette Oasis Pomme Cassis Framboise 33cl', null, 'Pièce'],
    ['oasis_tropical', 'Oasis Tropical', 'Boissons Fraîches', 10000, 50, 50, '🧃', 'Canette Oasis Tropical 33cl fraîche', null, 'Pièce'],

    // Chips
    ['chips_barbecue', 'Chips Barbecue', 'Chips', 10000, 40, 40, '🥔', 'Paquet individuel de chips goût Barbecue', null, 'Pièce'],
    ['chips_nature', 'Chips Nature', 'Chips', 10000, 40, 40, '🥔', 'Paquet individuel de chips goût Nature salé', null, 'Pièce'],
    ['chips_poulet_roti', 'Chips Poulet Rôti', 'Chips', 10000, 40, 40, '🥔', 'Paquet individuel de chips au poulet rôti', null, 'Pièce'],
    ['pringles_barbecue', 'Pringles Barbecue', 'Chips', 12000, 30, 30, '🥔', 'Tube Pringles saveur Barbecue', null, 'Pièce'],
    ['pringles_original', 'Pringles Original', 'Chips', 12000, 30, 30, '🥔', 'Tube Pringles saveur Original', null, 'Pièce'],
    ['pringles_sour_cream', 'Pringles Sour Cream and Onion 70g', 'Chips', 15000, 30, 30, '🥔', 'Tube Pringles Sour Cream and Onion 70g', null, 'Pièce'],

    // Repas
    ['crepes', 'Crêpes', 'Repas', 10000, 30, 30, '🥞', 'Crêpe sucrée préparée au stand BDE', null, 'Pièce'],
    ['gaufres', 'Gaufres', 'Repas', 10000, 30, 30, '🧇', 'Gaufre moelleuse chaude', null, 'Pièce'],
    [
      'hot_dog_variantes',
      'Hot-Dog',
      'Repas',
      25000,
      35,
      35,
      '🌭',
      'Hot-dog chaud préparé à la minute au stand BDE avec options de sauces et garnitures',
      JSON.stringify([
        { name: 'Hot-Dog Simple', price: 25000 },
        { name: 'Hot-Dog Complet (Sauces + Oignons Frits)', price: 30000 },
        { name: 'Hot-Dog Double Saucisse Gourmand', price: 35000 }
      ]),
      'Pièce'
    ],
    ['hot_dog_simple', 'Hot-dog (version simple)', 'Repas', 25000, 35, 35, '🌭', 'Hot-dog classique saucisse et pain moelleux', null, 'Pièce'],
    [
      'menu_hot_dog',
      'Menu Hot-Dog',
      'Repas',
      35000,
      25,
      25,
      '🌭',
      'Menu complet repas BDE incluant boisson fraîche et accompagnement au choix',
      JSON.stringify([
        { name: 'Menu Classique (Hot-Dog + Boisson 33cl)', price: 35000 },
        { name: 'Menu Complet (Hot-Dog + Boisson + Chips)', price: 40000 },
        { name: 'Menu Maxi (Hot-Dog Double + Boisson + Chips + Snack)', price: 45000 }
      ]),
      'Pièce'
    ],

    // Red Bull
    ['red_bull_classic', 'Red Bull', 'Red Bull', 10000, 45, 45, '⚡', 'Canette Red Bull Energy Drink 250ml', null, 'Pièce'],
    ['red_bull_abricot_fraise', 'Redbull Abricot-Fraise', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Amber Edition Abricot-Fraise 250ml', null, 'Pièce'],
    ['red_bull_coco_acai', 'Red Bull Coco Açaï', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The White Edition Coco Açaï 250ml', null, 'Pièce'],
    ['red_bull_juneberry', 'Red Bull Juneberry', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Sea Blue Edition Juneberry 250ml', null, 'Pièce'],
    ['red_bull_mure_vanille', 'Redbull Mûre givrée & vanille', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Winter Edition Mûre givrée & vanille 250ml', null, 'Pièce'],
    ['red_bull_myrtille', 'Redbull Myrtille', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Blue Edition Myrtille 250ml', null, 'Pièce'],
    ['red_bull_peche_blanche', 'Redbull Pêche blanche', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Ruby Edition Pêche blanche 250ml', null, 'Pièce'],
    ['red_bull_pomme_fuji', 'Red Bull Pomme Fuji & Gingembre', 'Red Bull', 15000, 30, 30, '⚡', 'Red Bull The Red Edition Pomme Fuji & Gingembre 250ml', null, 'Pièce'],
    ['red_bull_zero', 'Redbull Zero', 'Red Bull', 13000, 35, 35, '⚡', 'Canette Red Bull Zero 250ml', null, 'Pièce']
  ];

  const insertItem = db.prepare(`
    INSERT INTO shop_items (id, name, category, price, stock, initial_stock, icon, description, variants, unit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      icon = excluded.icon,
      description = excluded.description,
      variants = excluded.variants,
      unit = excluded.unit,
      is_active = 1
  `);

  const insertAll = db.transaction((items) => {
    for (const item of items) insertItem.run(...item);
  });
  insertAll(officialCatalog);

  // Désactiver les anciens articles de test pour n'avoir que le catalogue officiel
  const officialIds = officialCatalog.map(item => item[0]);
  const placeholders = officialIds.map(() => '?').join(',');
  db.prepare(`UPDATE shop_items SET is_active = 0 WHERE id NOT IN (${placeholders})`).run(...officialIds);

  // Création du compte admin BDE prédéfini pour l'accès facile aux membres du bureau
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'bde_admin'").get();
  if (!adminExists) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('epitech2026', salt);
    db.prepare(`
      INSERT INTO users (username, password_hash, coins, role)
      VALUES ('bde_admin', ?, 50000, 'admin')
    `).run(hash);
  } else {
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'bde_admin'").run();
  }

  // Initialisation de l'historique de Crash si vide
  const crashCount = db.prepare('SELECT COUNT(*) as count FROM crash_history').get().count;
  if (crashCount === 0) {
    const seedPoints = [1.25, 2.14, 1.05, 5.82, 1.88, 3.40, 1.12, 12.45, 1.95, 2.70, 1.01, 4.10, 8.20, 1.45, 1.76];
    const insertHistory = db.prepare('INSERT INTO crash_history (crash_point) VALUES (?)');
    seedPoints.forEach(p => insertHistory.run(p));
  }
}

initDb();

module.exports = db;
