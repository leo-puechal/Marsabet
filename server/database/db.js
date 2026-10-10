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

  // Migration de shop_items pour ajouter stock, initial_stock, is_active, created_at si absents
  const itemColumns = db.prepare("PRAGMA table_info(shop_items)").all();
  const hasStock = itemColumns.some(c => c.name === 'stock');
  if (!hasStock) {
    db.exec("ALTER TABLE shop_items ADD COLUMN stock INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE shop_items ADD COLUMN initial_stock INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE shop_items ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  }
  const hasCreatedAt = itemColumns.some(c => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE shop_items ADD COLUMN created_at TEXT DEFAULT NULL");
  }

  // Initialisation / Mise à jour des articles réels du BDE Marseille avec stocks et prix en coins réalistes
  const currentCount = db.prepare("SELECT COUNT(*) as count FROM shop_items").get().count;
  if (currentCount === 0 || !hasStock) {
    const insertItem = db.prepare(`
      INSERT OR REPLACE INTO shop_items (id, name, category, price, stock, initial_stock, icon, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const realBdeProducts = [
      ['cafe_espresso', 'Café Espresso Frais (Stand BDE)', 'boisson', 1500, 100, 100, '☕', 'Café chaud en grain préparé sur place au local associatif.'],
      ['coca_canette', 'Canette Coca-Cola / Cherry 33cl', 'boisson', 6000, 50, 50, '🥤', 'Canette fraîche servie bien fraîche au stand BDE.'],
      ['monster_energy', 'Canette Monster Energy 500ml', 'boisson', 9500, 25, 25, '⚡', 'La recharge ultime pour les nuits de rush et hackathons.'],
      ['barre_kinder', 'Barre Chocolatée Kinder Bueno', 'snack', 3000, 60, 60, '🍫', 'Snack chocolaté réconfortant entre deux créneaux de rush.'],
      ['paquet_chips', 'Paquet de Chips Snack Lays 45g', 'snack', 3500, 40, 40, '🥔', 'Chips salées pour la pause goûter sur le campus.'],
      ['pack_stickers', 'Pack de 5 Stickers Officiels Epitech Mars', 'goodie', 2500, 80, 80, '✨', 'Stickers vinyle haute résistance pour personnaliser ton laptop.'],
      ['tote_bag_bde', 'Tote Bag Officiel BDE Epitech Marseille', 'goodie', 8000, 30, 30, '👜', 'Sac en toile épais brodé avec le logo du BDE Marseille.'],
      ['mug_marsabet', 'Mug Céramique Marsabet VIP', 'goodie', 15000, 15, 15, '🏆', 'Mug collector réservé aux meilleurs joueurs du casino récréatif.'],
      ['hoodie_epitech', 'Sweat à Capuche Officiel BDE (Taille au choix)', 'vetement', 35000, 8, 8, '👑', 'Le graal physique du BDE à retirer en main propre au local.']
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertItem.run(...item);
    });
    insertMany(realBdeProducts);
  }

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
}

initDb();

module.exports = db;
