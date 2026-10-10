const Database = require('better-sqlite3');
const path = require('path');
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
      icon TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES shop_items(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_history_user ON game_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins DESC);
  `);

  // Initialisation des articles de la boutique fictive BDE
  const countItems = db.prepare('SELECT COUNT(*) as count FROM shop_items').get().count;
  if (countItems === 0) {
    const insertItem = db.prepare('INSERT INTO shop_items (id, name, category, price, icon, description) VALUES (?, ?, ?, ?, ?, ?)');
    const defaultItems = [
      ['cafe_bde', 'Café / Espresso Virtuel', 'boisson', 150, '☕', 'Le carburant officiel des projets Epitech.'],
      ['canette_soda', 'Soda Frais du BDE', 'boisson', 250, '🥤', 'Idéal pour tenir pendant un rush de code.'],
      ['snack_choco', 'Barre Chocolatée BDE', 'snack', 300, '🍫', 'Une douceur bien méritée après une victoire aux slots.'],
      ['sticker_pack', 'Pack Stickers Epitech Mars', 'goodie', 500, '✨', 'Pour pimper ton laptop avec fierté marseillaise.'],
      ['mug_marsabet', 'Mug Officiel Marsabet VIP', 'goodie', 1500, '🏆', 'Pour boire ton café comme un high roller.'],
      ['tshirt_bde', 'T-Shirt BDE Marseille Élite', 'vetement', 3500, '👕', 'Édition limitée aux grands gagnants du casino.'],
      ['sweat_marsabet', 'Hoodie Marsabet High Roller', 'vetement', 8000, '👑', 'Le graal absolu pour flexer dans les couloirs du campus.']
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertItem.run(...item);
    });
    insertMany(defaultItems);
  }
}

initDb();

module.exports = db;
