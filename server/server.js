const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');

const config = require('./config/config');
const db = require('./database/db');
const socketService = require('./services/socketService');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const gamesRoutes = require('./routes/games.routes');
const wheelRoutes = require('./routes/wheel.routes');
const adminRoutes = require('./routes/admin.routes');
const contestRoutes = require('./routes/contest.routes');

const app = express();
const server = http.createServer(app);

// Configuration CORS dynamique pour accepter localhost, .local et n'importe quel sous-réseau local (Wi-Fi/LAN)
const lanRegex = /^https?:\/\/(localhost|127\.0\.0\.1|.*\.local|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (same-origin, curl, requêtes directes mobiles)
    if (!origin) return callback(null, true);
    if (lanRegex.test(origin)) {
      return callback(null, true);
    }
    // En environnement de jeu LAN / dev étudiant, tolérance pour toutes les adresses locales
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialisation de Socket.io pour la synchronisation temps réel inter-appareils
const io = new Server(server, {
  cors: corsOptions
});
socketService.init(io);

// Fichiers statiques du Frontend
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/wheels', wheelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/events', contestRoutes);

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

// Gestion propre des erreurs de démarrage (port déjà occupé)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Le port ${config.port} est déjà utilisé par une autre instance de Marsabet.`);
    console.error(`💡 Le serveur fonctionne déjà en arrière-plan sur http://localhost:${config.port}`);
  } else {
    console.error('Erreur démarrage serveur:', err);
  }
  process.exit(1);
});

// Écoute stricte sur 0.0.0.0 pour accepter les connexions depuis tout le réseau local
server.listen(config.port, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const lanIps = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorer les adresses IPv6 et l'interface de boucle locale (127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIps.push({ name, address: iface.address });
      }
    }
  }

  console.log(`=============================================================`);
  console.log(`🎰 MARSABET CASINO VIRTUEL DÉMARRÉ SUR LE PORT ${config.port}`);
  console.log(`🌐 Accès local (machine hôte) : http://localhost:${config.port}`);
  if (lanIps.length > 0) {
    console.log(`📡 Accès Réseau Local (Wi-Fi / LAN - autres appareils) :`);
    lanIps.forEach(ip => {
      console.log(`   👉 http://${ip.address}:${config.port} (interface ${ip.name})`);
    });
  } else {
    console.log(`📡 Accès Réseau Local : http://0.0.0.0:${config.port}`);
  }
  console.log(`🛡️  Monnaie 100% fictive scolaire - Zéro argent réel`);
  console.log(`=============================================================`);
});

module.exports = { app, server };
