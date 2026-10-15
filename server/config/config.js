require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

// Secret JWT : obligatoire en production. En développement, un secret aléatoire est généré
// une fois et conservé dans un fichier local ignoré par git (jamais de secret codé en dur).
function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) {
      throw new Error('SECURITY ERROR: JWT_SECRET doit contenir au moins 32 caractères.');
    }
    return fromEnv;
  }
  if (isProduction) {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
  }
  const secretFile = path.join(__dirname, '../database/.jwt_secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (e) {}
  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  } catch (e) {}
  console.warn('[Config] JWT_SECRET absent : secret de développement généré localement (server/database/.jwt_secret).');
  return generated;
}

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: resolveJwtSecret(),
  // Clé de promotion admin : AUCUNE valeur par défaut. Sans ADMIN_SECRET_KEY, /auth/become-admin est désactivé.
  adminSecretKey: process.env.ADMIN_SECRET_KEY || null,
  // Mot de passe du compte bde_admin : si absent, un mot de passe aléatoire est généré à la création.
  adminPassword: process.env.ADMIN_PASSWORD || null,
  dbPath: process.env.DB_PATH || path.join(__dirname, '../database/marsabet.db'),
  startingCoins: process.env.STARTING_COINS ? parseInt(process.env.STARTING_COINS, 10) : 5000,
  dailyBonusBase: 100,
  dailyBonusStreakMultiplier: 25, // +25 par jour de streak consécutif (max streak: 7)
  maxStreakBonusDays: 7,
  isProduction,
  // Origines supplémentaires autorisées (séparées par des virgules), en plus de la même origine
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  // Nombre de reverse-proxies de confiance devant l'app (0 = aucun : X-Forwarded-For ignoré)
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,
};
