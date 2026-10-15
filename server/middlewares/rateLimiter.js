const rateLimit = require('express-rate-limit');

// Limiteur global pour toutes les routes API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1200, // max 1200 requêtes par fenêtre de 15 minutes par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes envoyées au serveur. Veuillez patienter un instant.' }
});

// Limiteur pour l'authentification (connexion et inscription) anti-brute-force
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // Fenêtre courte d'1 minute (au lieu de 15 minutes)
  max: 20, // 20 requêtes par minute par IP
  skipSuccessfulRequests: true, // Les connexions ou inscriptions réussies ne sont pas décomptées
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion ou d’inscription. Veuillez réessayer dans 1 minute.' }
});

// Limiteur pour les codes promo anti-brute-force
const promoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // max 15 essais de codes par 15 min par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d’activation de code promo. Réessaie dans quelques minutes.' }
});

// Limiteur pour les actions de jeu et dépense de coins (anti-spam / anti-bot)
const gameActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 mises ou actions de jeu par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cadence de jeu trop rapide. Veuillez patienter quelques secondes.' }
});

// Limiteur pour les bonus quotidiens et roues
const bonusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes de bonus ou récompenses. Veuillez patienter.' }
});

module.exports = {
  apiLimiter,
  authLimiter,
  promoLimiter,
  gameActionLimiter,
  bonusLimiter
};
