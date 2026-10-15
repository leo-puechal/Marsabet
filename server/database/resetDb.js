const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const db = require('./db');

console.log('🔄 Réinitialisation de la base de données Marsabet pour la production...');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

const resetTx = db.transaction(() => {
  // 1. Vider les sessions actives de jeux
  db.exec(`
    DELETE FROM blackjack_sessions;
    DELETE FROM slot_sessions;
    DELETE FROM crash_sessions;
  `);

  // 2. Vider l'historique et les commandes de test
  db.exec(`
    DELETE FROM game_history;
    DELETE FROM delivery_orders;
    DELETE FROM shop_orders;
    DELETE FROM user_wheel_cooldowns;
    DELETE FROM user_wheel_daily_spins;
    DELETE FROM code_utilisations;
  `);

  // 3. Réinitialiser les codes promo
  db.exec(`
    DELETE FROM promo_codes;
  `);

  // 4. Supprimer tous les comptes de test et utilisateurs factices
  db.exec(`
    DELETE FROM users;
  `);

  // 5. Créer UNIQUEMENT le compte administrateur officiel BDE
  const adminPwd = config.adminPassword || require('crypto').randomBytes(18).toString('base64url');
  if (!config.adminPassword) {
    console.warn('[SECURITY] ADMIN_PASSWORD absent : mot de passe bde_admin généré (affiché une seule fois) : ' + adminPwd);
  }
  const hash = bcrypt.hashSync(adminPwd, 12);
  db.prepare(`
    INSERT INTO users (username, password_hash, coins, role, total_wagered, total_won, games_played, biggest_win)
    VALUES ('bde_admin', ?, 50000, 'admin', 0, 0, 0, 0)
  `).run(hash);

  // 6. Réinitialiser les graines de crash history
  db.exec(`
    DELETE FROM crash_history;
  `);
  const seedPoints = [1.45, 2.10, 1.15, 3.80, 1.95, 5.20, 1.25, 2.70, 8.50, 1.80];
  const insertCrash = db.prepare('INSERT INTO crash_history (crash_point) VALUES (?)');
  seedPoints.forEach(p => insertCrash.run(p));
});

resetTx();

// Optimisation et compactage de SQLite
db.exec('VACUUM;');

console.log('=============================================================');
console.log('✅ Base de données Marsabet nettoyée et réinitialisée avec succès !');
console.log('👥 0 comptes factices ou joueurs de test.');
console.log('🛡️  Compte Administrateur BDE officiel configuré (exclu du classement).');
console.log('🎡 Roues de la fortune prêtes.');
console.log('=============================================================');

process.exit(0);
