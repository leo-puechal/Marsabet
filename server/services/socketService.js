const jwt = require('jsonwebtoken');
const config = require('../config/config');

let ioInstance = null;

function init(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Authentification du socket pour écouter les notifications spécifiques à l'utilisateur
    socket.on('authenticate', (token) => {
      try {
        if (!token) return;
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          socket.userId = decoded.id;
          socket.join(`user_${decoded.id}`);
        }
      } catch (err) {
        // Ignorer si token invalide
      }
    });

    socket.on('disconnect', () => {
      // Nettoyage automatique par socket.io
    });
  });
}

function getIO() {
  return ioInstance;
}

// Notifie l'utilisateur connecté que son solde a changé (depuis un spin, achat, bonus, ou action admin)
function notifyUserBalance(userId, coins, extra = {}) {
  if (!ioInstance) return;
  ioInstance.to(`user_${userId}`).emit('balance:updated', { coins, ...extra });
}

// Diffuse en temps réel un nouveau gain à tous les clients pour le ticker et les stats
function notifyNewWin(winData) {
  if (!ioInstance) return;
  ioInstance.emit('ticker:newWin', winData);
  ioInstance.emit('stats:updated');
}

// Diffuse une mise à jour du classement
function notifyLeaderboardUpdated() {
  if (!ioInstance) return;
  ioInstance.emit('leaderboard:updated');
}

// Diffuse une mise à jour des stocks de la boutique BDE
function notifyShopUpdated() {
  if (!ioInstance) return;
  ioInstance.emit('shop:updated');
}

// Diffuse une mise à jour des commandes et livraisons (pour admin et profils)
function notifyOrdersUpdated() {
  if (!ioInstance) return;
  ioInstance.emit('orders:updated');
}

module.exports = {
  init,
  getIO,
  notifyUserBalance,
  notifyNewWin,
  notifyLeaderboardUpdated,
  notifyShopUpdated,
  notifyOrdersUpdated
};
