// Marsabet Real-time LAN Synchronization & Periodic Polling Engine
(function() {
  'use strict';

  const SyncEngine = {
    socket: null,
    pollingInterval: null,
    pollIntervalMs: 6000, // Rafraîchissement automatique toutes les 6 secondes (garantie 5-10s)
    lastSyncTime: 0,

    init() {
      this.initSocket();
      this.startPolling();
      this.setupVisibilityListener();
      console.log('🔄 Moteur de synchronisation LAN Marsabet initialisé (Socket.io + Polling 6s).');
    },

    initSocket() {
      if (typeof io === 'undefined') {
        console.warn('Socket.io client non disponible, bascule sur le polling périodique.');
        return;
      }

      try {
        // Connexion au même serveur (auto-détection dynamique de l'IP hôte et port)
        this.socket = io({
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000
        });

        this.socket.on('connect', () => {
          this.authenticateSocket();
        });

        this.socket.on('reconnect', () => {
          this.authenticateSocket();
          this.runSyncCycle();
        });

        // 1. Mise à jour instantanée du solde utilisateur
        this.socket.on('balance:updated', (data) => {
          if (!data || data.coins === undefined) return;
          if (window.State && window.State.isAuthenticated) {
            window.State.updateCoins(data.coins);
            if (data.daily_streak !== undefined && window.State.user) {
              window.State.user.daily_streak = data.daily_streak;
              window.State.updateUI();
            }
          }
        });

        // 2. Nouveau gain diffusé sur le réseau (bandeau ticker temps réel)
        this.socket.on('ticker:newWin', (win) => {
          this.prependTickerWin(win);
        });

        // 3. Mise à jour des stats globales
        this.socket.on('stats:updated', () => {
          if (typeof window.loadGlobalStats === 'function') {
            window.loadGlobalStats();
          }
        });

        // 4. Mise à jour du classement
        this.socket.on('leaderboard:updated', () => {
          const currentView = window.UI ? window.UI.currentView : null;
          if (currentView === 'leaderboard' && typeof window.loadLeaderboard === 'function') {
            window.loadLeaderboard();
          }
        });

        // 6. Mise à jour des commandes et livraisons directes
        this.socket.on('orders:updated', () => {
          const currentView = window.UI ? window.UI.currentView : null;
          if (currentView === 'profile' && typeof window.loadProfile === 'function') {
            window.loadProfile();
          }
          if (currentView === 'admin' && window.AdminBDE && typeof window.AdminBDE.loadDeliveries === 'function') {
            window.AdminBDE.loadDeliveries();
          }
        });

      } catch (err) {
        console.warn('Erreur initialisation Socket.io:', err);
      }
    },

    // Envoi du token JWT pour s'abonner aux notifications ciblées de l'utilisateur
    authenticateSocket() {
      if (!this.socket || !this.socket.connected) return;
      const token = window.API ? window.API.getToken() : localStorage.getItem('marsabet_token');
      if (token) {
        this.socket.emit('authenticate', token);
      }
    },

    // Ajout visuel fluide d'un nouveau gain en direct dans le bandeau ticker
    prependTickerWin(win) {
      if (!win) return;
      const tickerEl = document.getElementById('recentWinsTicker');
      if (!tickerEl) return;

      const item = document.createElement('div');
      item.className = 'ticker-item';
      item.style.animation = 'pulse 1s ease-in-out';
      
      const gameLabelStr = typeof window.gameLabel === 'function' ? window.gameLabel(win.game_type) : (win.game_type || 'Jeu');
      const safeUsername = typeof window.escapeHtml === 'function' ? window.escapeHtml(win.username || 'Joueur') : (win.username || 'Joueur');
      
      item.innerHTML = `
        <span class="ticker-player">${safeUsername}</span>
        <span class="ticker-game">${gameLabelStr}</span>
        <span class="ticker-win">+${Number(win.profit || 0).toLocaleString()} 🪙</span>
      `;

      tickerEl.insertBefore(item, tickerEl.firstChild);
      // Limiter le ticker à 10 items maximum
      while (tickerEl.children.length > 10) {
        tickerEl.removeChild(tickerEl.lastChild);
      }
    },

    // Démarre le rafraîchissement périodique (fallback réseau et synchronisation de fond)
    startPolling() {
      if (this.pollingInterval) clearInterval(this.pollingInterval);

      this.pollingInterval = setInterval(() => {
        this.runSyncCycle();
      }, this.pollIntervalMs);
    },

    // Cycle complet de synchronisation périodique
    async runSyncCycle() {
      const now = Date.now();
      // Éviter deux requêtes simultanées en moins de 2 secondes
      if (now - this.lastSyncTime < 2000) return;
      this.lastSyncTime = now;

      // 1. Synchronisation du solde et profil de l'utilisateur s'il est connecté
      if (window.API && window.State && window.State.isAuthenticated) {
        try {
          const data = await window.API.getMe();
          if (data && data.user) {
            // Mise à jour douce du solde si changement détecté
            if (window.State.user && data.user.coins !== window.State.user.coins) {
              window.State.updateCoins(data.user.coins);
            }
            // Mise à jour de l'état canClaimDaily et streak
            if (window.State.user) {
              window.State.user.canClaimDaily = data.user.canClaimDaily;
              window.State.user.daily_streak = data.user.daily_streak;
              window.State.updateUI();
            }
          }
        } catch (e) {
          // Token expiré ou problème temporaire, géré par API
        }
      }

      // 2. Synchronisation de la vue active
      const currentView = window.UI ? window.UI.currentView : null;

      if (currentView === 'leaderboard' && typeof window.loadLeaderboard === 'function') {
        window.loadLeaderboard();
      } else if (currentView === 'lobby' && typeof window.loadGlobalStats === 'function') {
        window.loadGlobalStats();
      } else if (currentView === 'admin' && window.AdminBDE && typeof window.AdminBDE.loadDeliveries === 'function') {
        window.AdminBDE.loadDeliveries();
      }
    },

    // Dès que l'onglet redevient actif (ex: smartphone déverrouillé ou changement d'onglet), synchroniser
    setupVisibilityListener() {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.authenticateSocket();
          this.runSyncCycle();
        }
      });
    }
  };

  // Exposer sur l'objet global
  window.SyncEngine = SyncEngine;

  // Lancement automatique dès le chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SyncEngine.init());
  } else {
    SyncEngine.init();
  }
})();
