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
const announcementRoutes = require('./routes/announcement.routes');

const helmet = require('helmet');
const {
  apiLimiter,
  authLimiter,
  promoLimiter,
  gameActionLimiter,
  bonusLimiter
} = require('./middlewares/rateLimiter');

const app = express();
const server = http.createServer(app);

// IP réelle du client : X-Forwarded-For n'est lu QUE si TRUST_PROXY (nb de proxies de confiance) est défini.
app.set('trust proxy', config.trustProxy);

// En-têtes HTTP de sécurité renforcés via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' reste nécessaire tant que le frontend utilise des gestionnaires onclick="" inline
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' }
  })
);

// CORS : même origine (le frontend est servi par ce serveur, y compris via l'IP du LAN) + liste blanche ALLOWED_ORIGINS.
// Auparavant TOUTES les origines étaient acceptées avec credentials, ce qui annulait la protection du navigateur.
function isAllowedOrigin(origin, host) {
  if (!origin) return true; // requêtes sans Origin (curl, same-origin GET, apps natives)
  if (config.allowedOrigins.includes(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch (e) {
    return false;
  }
}

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  const allowed = isAllowedOrigin(origin, req.header('Host'));
  callback(null, {
    origin: allowed,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
};

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Initialisation de Socket.io pour la synchronisation temps réel inter-appareils
// allowRequest bloque le détournement de WebSocket depuis un site tiers (Cross-Site WebSocket Hijacking).
const io = new Server(server, {
  maxHttpBufferSize: 1e5,
  allowRequest: (req, callback) => {
    callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
  }
});
socketService.init(io);

// Fichiers statiques du Frontend
app.use(express.static(path.join(__dirname, '../public')));

// Application des limiteurs de débit (Rate Limiting) sur les endpoints sensibles
app.use('/api', apiLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify-email', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);
app.use('/api/auth/become-admin', authLimiter);
app.use('/api/auth/daily-bonus', bonusLimiter);
app.use('/api/user/redeem-code', promoLimiter);
app.use('/api/users/redeem-code', promoLimiter);
app.use('/api/games', gameActionLimiter);
app.use('/api/wheels/:id/spin', bonusLimiter);

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
app.use('/api/announcements', announcementRoutes);

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

// Gestionnaire d'erreurs global (protection anti-fuite d'informations sensibles en production)
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Erreur non gérée:', err);
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction
    ? 'Une erreur interne est survenue sur le serveur.'
    : (err.message || 'Erreur interne du serveur.');
  res.status(err.status || 500).json({ error: message });
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
