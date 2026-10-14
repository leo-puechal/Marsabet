require('dotenv').config();
const path = require('path');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: jwtSecret || 'marsabet_super_secret_epitech_key_2026',
  adminSecretKey: process.env.ADMIN_SECRET_KEY || 'darkrider84',
  adminPassword: process.env.ADMIN_PASSWORD || 'darkrider84',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../database/marsabet.db'),
  startingCoins: process.env.STARTING_COINS ? parseInt(process.env.STARTING_COINS, 10) : 5000,
  dailyBonusBase: 100,
  dailyBonusStreakMultiplier: 25, // +25 par jour de streak consécutif (max streak: 7)
  maxStreakBonusDays: 7,
};
