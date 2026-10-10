require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'marsabet_super_secret_epitech_key_2026',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../database/marsabet.db'),
  startingCoins: 1000,
  dailyBonusBase: 100,
  dailyBonusStreakMultiplier: 25, // +25 par jour de streak consécutif (max streak: 7)
  maxStreakBonusDays: 7,
};
