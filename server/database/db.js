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
      player_hand_2 TEXT DEFAULT NULL,
      dealer_hand TEXT NOT NULL,
      bet INTEGER NOT NULL,
      bet_2 INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'playing',
      active_hand INTEGER NOT NULL DEFAULT 1,
      can_double INTEGER NOT NULL DEFAULT 1,
      can_double_2 INTEGER NOT NULL DEFAULT 1,
      can_split INTEGER NOT NULL DEFAULT 0,
      split_aces INTEGER NOT NULL DEFAULT 0,
      status_1 TEXT DEFAULT NULL,
      status_2 TEXT DEFAULT NULL,
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
      started_at INTEGER DEFAULT NULL,
      crash_at INTEGER DEFAULT NULL,
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

  // Migration blackjack_sessions pour le Split
  const bjCols = db.prepare("PRAGMA table_info(blackjack_sessions)").all();
  const hasHand2 = bjCols.some(c => c.name === 'player_hand_2');
  if (!hasHand2) {
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN player_hand_2 TEXT DEFAULT NULL");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN bet_2 INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN active_hand INTEGER NOT NULL DEFAULT 1");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN can_split INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN split_aces INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN status_1 TEXT DEFAULT NULL");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN status_2 TEXT DEFAULT NULL");
    db.exec("ALTER TABLE blackjack_sessions ADD COLUMN can_double_2 INTEGER NOT NULL DEFAULT 1");
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
      notes TEXT DEFAULT NULL,
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

  // Migration de la colonne notes si absente
  const delivCols = db.prepare("PRAGMA table_info(delivery_orders)").all();
  const hasNotes = delivCols.some(c => c.name === 'notes');
  if (!hasNotes) {
    db.exec("ALTER TABLE delivery_orders ADD COLUMN notes TEXT DEFAULT NULL");
  }

  // Migration des colonnes timing pour le jeu Crash (anti-latence encaissement)
  const crashCols = db.prepare("PRAGMA table_info(crash_sessions)").all();
  if (!crashCols.some(c => c.name === 'started_at')) {
    db.exec("ALTER TABLE crash_sessions ADD COLUMN started_at INTEGER DEFAULT NULL");
  }
  if (!crashCols.some(c => c.name === 'crash_at')) {
    db.exec("ALTER TABLE crash_sessions ADD COLUMN crash_at INTEGER DEFAULT NULL");
  }

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

    CREATE TABLE IF NOT EXISTS user_wheel_daily_spins (
      user_id INTEGER NOT NULL,
      wheel_id TEXT NOT NULL,
      spin_date TEXT NOT NULL,
      spins_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, wheel_id, spin_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wheel_daily_spins ON user_wheel_daily_spins(user_id, wheel_id, spin_date);

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

    CREATE TABLE IF NOT EXISTS wheel_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      type TEXT NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0,
      cooldown_hours INTEGER NOT NULL DEFAULT 24,
      badge TEXT,
      badge_class TEXT,
      icon TEXT,
      description TEXT,
      segments_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
    CREATE INDEX IF NOT EXISTS idx_code_util_user ON code_utilisations(user_id);
    CREATE INDEX IF NOT EXISTS idx_code_util_code ON code_utilisations(code_id);
  `);


  // Création ou synchronisation du compte admin BDE officiel avec le mot de passe configuré
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'bde_admin'").get();
  const adminPwd = process.env.ADMIN_PASSWORD || config.adminPassword || 'darkrider84';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(adminPwd, salt);
  if (!adminExists) {
    db.prepare(`
      INSERT INTO users (username, password_hash, coins, role)
      VALUES ('bde_admin', ?, 50000, 'admin')
    `).run(hash);
  } else {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE username = 'bde_admin'").run(hash);
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
