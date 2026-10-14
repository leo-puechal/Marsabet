const jwt = require('jsonwebtoken');
const config = require('../config/config');

const db = require('../database/db');
const presenceService = require('./presenceService');

let ioInstance = null;

function init(io) {
  ioInstance = io;
  presenceService.setIO(io);

  io.on('connection', (socket) => {
    // Authentification du socket pour écouter les notifications spécifiques à l'utilisateur
    socket.on('authenticate', (token) => {
      try {
        if (!token) return;
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          // Si le socket avait un autre userId enregistré, nettoyer
          if (socket.userId && socket.userId !== decoded.id) {
            presenceService.unregisterSocket(socket.userId, socket.id);
            socket.leave(`user_${socket.userId}`);
          }

          socket.userId = decoded.id;
          socket.join(`user_${decoded.id}`);

          // Enregistrer la présence en ligne
          presenceService.registerSocket(decoded.id, socket.id);

          // Si administrateur BDE, rejoindre le salon dédié aux notifications temps réel admin
          try {
            const user = db.prepare('SELECT role FROM users WHERE id = ?').get(decoded.id);
            if (user && user.role === 'admin') {
              socket.join('admin_room');
              // Envoyer immédiatement l'état actuel des joueurs connectés
              socket.emit('admin:online_players_updated', presenceService.getOnlineSummary());
            }
          } catch (e) {
            // Ignorer l'erreur de lecture DB
          }
        }
      } catch (err) {
        // Ignorer si token invalide
      }
    });

    // Événement d'activité pour rafraîchir le timestamp de dernière action
    socket.on('activity', () => {
      if (socket.userId) {
        presenceService.recordActivity(socket.userId);
      }
    });

    // Souscription explicite au salon admin
    socket.on('admin:subscribe_presence', () => {
      if (socket.userId) {
        try {
          const user = db.prepare('SELECT role FROM users WHERE id = ?').get(socket.userId);
          if (user && user.role === 'admin') {
            socket.join('admin_room');
            socket.emit('admin:online_players_updated', presenceService.getOnlineSummary());
          }
        } catch (e) {}
      }
    });

    // Déconnexion explicite de la session
    socket.on('logout', () => {
      if (socket.userId) {
        presenceService.unregisterSocket(socket.userId, socket.id);
        socket.leave(`user_${socket.userId}`);
        socket.leave('admin_room');
        socket.userId = null;
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        presenceService.unregisterSocket(socket.userId, socket.id);
      }
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
