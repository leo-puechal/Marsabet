const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const db = require('./database/db');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const gamesRoutes = require('./routes/games.routes');

const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques du Frontend
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/games', gamesRoutes);

// Infos globales du casino Marsabet
app.get('/api/stats', (req, res) => {
  try {
    const totalPlayers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const statsRow = db.prepare(`
      SELECT 
        SUM(games_played) as totalGames,
        MAX(biggest_win) as highestWin,
        SUM(total_wagered) as totalWagered
      FROM users
    `).get();

    // 10 derniers gros gains pour le bandeau ticker
    const recentWins = db.prepare(`
      SELECT h.game_type, h.payout, h.profit, u.username, h.created_at
      FROM game_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.profit > 0
      ORDER BY h.created_at DESC
      LIMIT 10
    `).all();

    return res.json({
      totalPlayers,
      totalGames: statsRow.totalGames || 0,
      highestWin: statsRow.highestWin || 0,
      totalWagered: statsRow.totalWagered || 0,
      recentWins
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur stats.' });
  }
});

// Santé serveur
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Marsabet Server', uptime: process.uptime() });
});

// SPA fallback pour les routes non-API (compatible Express 5)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint API introuvable' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`🎰 MARSABET CASINO VIRTUEL DÉMARRÉ SUR LE PORT ${config.port}`);
  console.log(`🌐 Accès local : http://localhost:${config.port}`);
  console.log(`🛡️  Monnaie 100% fictive scolaire - Zéro argent réel`);
  console.log(`===============================================`);
});

module.exports = app;
