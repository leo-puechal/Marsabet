const db = require('../database/db');

class PresenceService {
  constructor() {
    // Map<userId, { userId, username, firstName, lastName, role, connectedAt, lastActivityAt, sockets: Set<socketId> }>
    this.onlineUsers = new Map();
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  // Enregistre une connexion socket authentifiée
  registerSocket(userId, socketId) {
    if (!userId || !socketId) return null;

    const numericId = Number(userId);
    const now = Date.now();

    if (this.onlineUsers.has(numericId)) {
      const entry = this.onlineUsers.get(numericId);
      entry.sockets.add(socketId);
      entry.lastActivityAt = now;
      this.notifyAdmins();
      return entry;
    }

    // Premier socket pour cet utilisateur : charger les infos du profil depuis SQLite
    try {
      const user = db.prepare('SELECT id, username, first_name, last_name, role, coins FROM users WHERE id = ?').get(numericId);
      if (!user) return null;

      const entry = {
        userId: user.id,
        username: user.username,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        role: user.role || 'student',
        connectedAt: now,
        lastActivityAt: now,
        sockets: new Set([socketId])
      };

      this.onlineUsers.set(numericId, entry);
      this.notifyAdmins();
      return entry;
    } catch (err) {
      console.error('Erreur enregistrement présence utilisateur:', err);
      return null;
    }
  }

  // Retire un socket lors de la déconnexion ou de la déconnexion explicite
  unregisterSocket(userId, socketId) {
    if (!userId || !socketId) return;
    const numericId = Number(userId);

    if (!this.onlineUsers.has(numericId)) return;

    const entry = this.onlineUsers.get(numericId);
    entry.sockets.delete(socketId);

    // Si l'utilisateur n'a plus aucun socket actif, on le retire de la liste des joueurs en ligne
    if (entry.sockets.size === 0) {
      this.onlineUsers.delete(numericId);
    }

    this.notifyAdmins();
  }

  // Met à jour l'horodatage de dernière activité (requête API, spin, clic, interaction socket)
  recordActivity(userId) {
    if (!userId) return;
    const numericId = Number(userId);
    if (this.onlineUsers.has(numericId)) {
      this.onlineUsers.get(numericId).lastActivityAt = Date.now();
    }
  }

  // Vérifie si un utilisateur est actuellement en ligne
  isUserOnline(userId) {
    if (!userId) return false;
    return this.onlineUsers.has(Number(userId));
  }

  // Récupère la présence d'un utilisateur spécifique
  getUserPresence(userId) {
    if (!userId) return null;
    return this.onlineUsers.get(Number(userId)) || null;
  }

  // Récupère la liste formatée des joueurs en ligne avec leur solde temps réel
  getOnlinePlayers() {
    const now = Date.now();
    const players = [];

    for (const [userId, entry] of this.onlineUsers.entries()) {
      let currentCoins = 0;
      try {
        const row = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
        if (row) currentCoins = row.coins;
      } catch (e) {
        currentCoins = 0;
      }

      players.push({
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        lastName: entry.lastName,
        role: entry.role,
        coins: currentCoins,
        connectedAt: entry.connectedAt,
        lastActivityAt: entry.lastActivityAt,
        tabCount: entry.sockets.size,
        connectedSeconds: Math.max(0, Math.floor((now - entry.connectedAt) / 1000)),
        idleSeconds: Math.max(0, Math.floor((now - entry.lastActivityAt) / 1000))
      });
    }

    // Tri par défaut : connexion la plus récente
    players.sort((a, b) => b.connectedAt - a.connectedAt);
    return players;
  }

  // Résumé complet (totaux et liste des joueurs)
  getOnlineSummary() {
    const players = this.getOnlinePlayers();
    let totalTabs = 0;
    let totalCoins = 0;
    let activeRecentCount = 0;

    for (const p of players) {
      totalTabs += p.tabCount;
      totalCoins += p.coins;
      if (p.idleSeconds <= 120) {
        activeRecentCount++;
      }
    }

    return {
      totalOnline: players.length,
      totalTabs,
      totalCoins,
      activeRecentCount,
      players
    };
  }

  // Diffuse instantanément la mise à jour à tous les administrateurs connectés
  notifyAdmins() {
    if (!this.io) return;
    try {
      const summary = this.getOnlineSummary();
      this.io.to('admin_room').emit('admin:online_players_updated', summary);
    } catch (err) {
      console.error('Erreur diffusion présence admin:', err);
    }
  }

  // Vider (principalement pour tests automatisés)
  clear() {
    this.onlineUsers.clear();
  }
}

const presenceService = new PresenceService();
module.exports = presenceService;
