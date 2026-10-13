// Marsabet Events & Contests Module — Tournois & Défis Étudiants BDE

const EventsManager = {
  contests: [],
  activeFilter: 'all', // 'all', 'active', 'ended'
  isInitialized: false,
  timerInterval: null,

  async init() {
    this.bindEvents();
    await this.loadContests();
    this.startCountdownTimer();
  },

  bindEvents() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Filtres d'onglets (Tous / En cours / Terminés)
    document.querySelectorAll('.events-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.events-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'all';
        this.renderContests();
      });
    });

    // Fermeture de la modale de classement
    const closeModalBtn = document.getElementById('closeContestLeaderboardModal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        const modal = document.getElementById('contestLeaderboardModal');
        if (modal) modal.classList.remove('active');
      });
    }

    // Écoute des mises à jour temps réel via Socket.io
    if (window.socket) {
      window.socket.on('contest:updated', () => {
        this.loadContests(false);
      });
      window.socket.on('contest:created', () => {
        this.loadContests(false);
      });
      window.socket.on('contest:ended', (data) => {
        this.loadContests(false);
        if (window.UI?.showToast) {
          window.UI.showToast('🏆 Un concours vient de se terminer ! Les récompenses ont été attribuées.', 'success');
        }
      });
    }
  },

  async loadContests(showSpinner = true) {
    const container = document.getElementById('eventsListContainer');
    if (showSpinner && container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--gold-light);">
          <div style="font-size: 2.2rem; animation: vpPulseGlow 1.2s infinite alternate;">⚔️</div>
          <p style="margin-top: 0.8rem; font-weight: 600;">Chargement des concours en cours...</p>
        </div>
      `;
    }

    try {
      const res = await window.API.getContests(true);
      this.contests = res.contests || [];
      this.renderContests();
      this.updateLobbyContestWidget();
    } catch (err) {
      console.error('Erreur chargement concours:', err);
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #fca5a5;">
            ⚠️ Impossible de charger les concours pour le moment.
          </div>
        `;
      }
    }
  },

  renderContests() {
    const container = document.getElementById('eventsListContainer');
    if (!container) return;

    let filtered = this.contests;
    if (this.activeFilter === 'active') {
      filtered = this.contests.filter(c => c.status === 'active');
    } else if (this.activeFilter === 'ended') {
      filtered = this.contests.filter(c => c.status === 'ended');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="events-empty-state">
          <span style="font-size: 2.5rem;">🏆</span>
          <h3>Aucun concours dans cette catégorie</h3>
          <p>Reviens très bientôt ou consulte les autres onglets pour voir les événements disponibles.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(c => this.generateContestCard(c)).join('');

    // Attacher événements de clics sur les cartes
    container.querySelectorAll('.btn-view-leaderboard').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(btn.dataset.contestId, 10);
        this.openLeaderboardModal(id);
      });
    });

    container.querySelectorAll('.btn-play-contest').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const route = btn.dataset.route;
        if (route && window.Router) {
          window.Router.navigate(route);
        }
      });
    });
  },

  generateContestCard(c) {
    const isEnded = c.status === 'ended';
    const gameMeta = this.getGameMeta(c.gameType);
    const criterionLabel = this.getCriterionLabel(c.criterion);

    // Calcul du temps restant
    let timeText = 'Terminé';
    if (!isEnded && c.endDate) {
      timeText = this.formatTimeRemaining(new Date(c.endDate).getTime() - Date.now());
    } else if (!isEnded) {
      timeText = 'Durée illimitée';
    }

    // Top 3 Podium HTML
    let podiumHtml = '';
    if (c.top3 && c.top3.length > 0) {
      podiumHtml = `
        <div class="contest-podium-preview">
          <div class="contest-podium-title">👑 TOP 3 ACTUEL</div>
          <div class="contest-podium-rows">
            ${c.top3.map((p, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const formattedScore = this.formatScore(p.score, c.criterion);
              return `
                <div class="podium-row rank-${idx + 1}">
                  <span class="podium-medal">${medals[idx] || `#${idx + 1}`}</span>
                  <span class="podium-username">${this.escapeHtml(p.username)}</span>
                  <span class="podium-score">${formattedScore}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      podiumHtml = `
        <div class="contest-podium-empty">
          <span>🚀</span> Aucun score enregistré pour le moment. Sois le premier à t'inscrire au classement !
        </div>
      `;
    }

    // Ma position HTML
    let myEntryHtml = '';
    if (c.myEntry) {
      const myScore = this.formatScore(c.myEntry.score, c.criterion);
      const isTop3 = c.myEntry.rank <= 3;
      myEntryHtml = `
        <div class="contest-my-rank ${isTop3 ? 'in-prize' : ''}">
          <div class="my-rank-header">
            <span>✨ TA POSITION : <strong>#${c.myEntry.rank}</strong></span>
            <span class="my-rank-score">${myScore}</span>
          </div>
          <div class="my-rank-sub">
            Parties jouées : ${c.myEntry.gamesPlayed || 1} • ${isTop3 ? '🎉 Tu es actuellement dans la zone de récompense !' : 'Continue de jouer pour entrer dans le TOP 3 !'}
          </div>
        </div>
      `;
    } else if (!isEnded) {
      myEntryHtml = `
        <div class="contest-my-rank not-played">
          <span>🎯 Tu n'as pas encore participé à ce défi. Joue une partie pour entrer dans le classement !</span>
        </div>
      `;
    }

    return `
      <div class="contest-card ${isEnded ? 'ended' : 'active'}" data-contest-id="${c.id}">
        <!-- En-tête de la carte -->
        <div class="contest-card-header">
          <div class="contest-game-badge">
            <span class="game-icon">${gameMeta.icon}</span>
            <span class="game-name">${gameMeta.name}</span>
          </div>
          <div class="contest-status-badge ${isEnded ? 'ended' : 'live'}">
            ${isEnded ? '🏁 TERMINÉ' : '<span class="status-dot"></span> EN COURS'}
          </div>
        </div>

        <!-- Titre et description -->
        <h3 class="contest-card-title">${this.escapeHtml(c.title)}</h3>
        <p class="contest-card-desc">${this.escapeHtml(c.description || '')}</p>

        <!-- Objectif & Règle -->
        <div class="contest-objective-box">
          <div class="objective-header">
            <span class="objective-icon">🎯</span>
            <strong>Objectif :</strong> ${criterionLabel}
          </div>
          <div class="objective-sub">
            Mise min. : <strong>${c.minBet || 10} 🪙</strong>
          </div>
        </div>

        <!-- Dotation / Prize Pool -->
        <div class="contest-prize-box">
          <div class="prize-total">
            <span class="prize-label">DOTATION TOTALE</span>
            <span class="prize-amount">${Number(c.prizePool || 10000).toLocaleString('fr-FR')} 🪙</span>
          </div>
          <div class="prize-breakdown">
            <span class="prize-pill first">🥇 1er: ${Number(c.prizes?.first || 0).toLocaleString('fr-FR')} 🪙</span>
            <span class="prize-pill second">🥈 2e: ${Number(c.prizes?.second || 0).toLocaleString('fr-FR')} 🪙</span>
            <span class="prize-pill third">🥉 3e: ${Number(c.prizes?.third || 0).toLocaleString('fr-FR')} 🪙</span>
          </div>
        </div>

        <!-- Countdown / Chrono -->
        <div class="contest-timer-bar">
          <span class="timer-icon">⏳</span>
          <span class="timer-text" data-end-date="${c.endDate || ''}">${timeText}</span>
          <span class="contest-participants-count">👥 ${c.participantsCount || 0} participants</span>
        </div>

        <!-- Podium Preview -->
        ${podiumHtml}

        <!-- Ma Position -->
        ${myEntryHtml}

        <!-- Actions -->
        <div class="contest-card-actions">
          <button class="btn btn-outline btn-view-leaderboard" data-contest-id="${c.id}">
            📊 Classement Complet
          </button>
          ${!isEnded ? `
            <button class="btn btn-gold btn-play-contest" data-route="${gameMeta.route}">
              🚀 Jouer (${gameMeta.shortName})
            </button>
          ` : `
            <button class="btn btn-secondary" disabled>
              ${c.prizesDistributed ? '🏆 Récompenses versées' : '🏁 Tournoi Clos'}
            </button>
          `}
        </div>
      </div>
    `;
  },

  async openLeaderboardModal(contestId) {
    const modal = document.getElementById('contestLeaderboardModal');
    const content = document.getElementById('contestLeaderboardContent');
    if (!modal || !content) return;

    modal.classList.add('active');
    content.innerHTML = `
      <div style="text-align:center; padding: 2.5rem; color: var(--gold-light);">
        <div style="font-size: 2rem; animation: vpPulseGlow 1.2s infinite alternate;">⏳</div>
        <p style="margin-top: 0.6rem;">Chargement du classement complet...</p>
      </div>
    `;

    try {
      const res = await window.API.getContest(contestId);
      const c = res.contest;
      if (!c) throw new Error('Concours introuvable');

      const gameMeta = this.getGameMeta(c.gameType);
      const criterionLabel = this.getCriterionLabel(c.criterion);

      let rowsHtml = '';
      if (!c.leaderboard || c.leaderboard.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">
              Aucun joueur classé pour le moment. Sois le premier !
            </td>
          </tr>
        `;
      } else {
        const medals = ['🥇', '🥈', '🥉'];
        const prizes = [c.prizes?.first, c.prizes?.second, c.prizes?.third];

        rowsHtml = c.leaderboard.map(row => {
          const isPodium = row.rank <= 3;
          const medal = medals[row.rank - 1] || `#${row.rank}`;
          const formattedScore = this.formatScore(row.score, c.criterion);
          const prizeText = isPodium && prizes[row.rank - 1]
            ? `<span class="leader-prize-tag">+${Number(prizes[row.rank - 1]).toLocaleString('fr-FR')} 🪙</span>`
            : '<span style="color:var(--text-muted);">-</span>';

          return `
            <tr class="${isPodium ? `leader-podium rank-${row.rank}` : ''}">
              <td class="col-rank"><strong>${medal}</strong></td>
              <td class="col-user">
                <span class="user-avatar">👤</span>
                <span class="user-name">${this.escapeHtml(row.username)}</span>
                <span class="vip-badge vip-${(row.vipRank || 'bronze').toLowerCase()}">${row.vipRank || 'BRONZE'}</span>
              </td>
              <td class="col-score"><strong>${formattedScore}</strong></td>
              <td class="col-games">${row.gamesPlayed || 1}</td>
              <td class="col-prize">${prizeText}</td>
            </tr>
          `;
        }).join('');
      }

      content.innerHTML = `
        <div class="leaderboard-modal-header">
          <div class="modal-contest-badge">
            <span>${gameMeta.icon}</span> ${gameMeta.name}
          </div>
          <h2 class="modal-contest-title">${this.escapeHtml(c.title)}</h2>
          <p class="modal-contest-sub">${this.escapeHtml(c.description || '')}</p>
          <div class="modal-rules-pill">
            <span>🎯 <strong>Objectif :</strong> ${criterionLabel}</span>
            <span>🎁 <strong>Dotation :</strong> ${Number(c.prizePool).toLocaleString('fr-FR')} 🪙</span>
          </div>
        </div>

        <div class="leaderboard-table-responsive">
          <table class="contest-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Joueur</th>
                <th>Score</th>
                <th>Parties</th>
                <th>Récompense</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error('Erreur chargement modal classement:', err);
      content.innerHTML = `
        <div style="text-align:center; padding: 2rem; color: #fca5a5;">
          ⚠️ Impossible de charger le classement complet pour le moment.
        </div>
      `;
    }
  },

  startCountdownTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      document.querySelectorAll('.timer-text[data-end-date]').forEach(el => {
        const endDateStr = el.dataset.endDate;
        if (!endDateStr) return;
        const diff = new Date(endDateStr).getTime() - Date.now();
        if (diff <= 0) {
          el.textContent = 'Terminé';
          el.closest('.contest-card')?.classList.replace('active', 'ended');
        } else {
          el.textContent = this.formatTimeRemaining(diff);
        }
      });
    }, 1000);
  },

  formatTimeRemaining(diffMs) {
    if (diffMs <= 0) return 'Terminé';
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (days > 0) {
      return `⏳ ${days}j ${hours}h ${mins}m restants`;
    }
    return `⏳ ${hours}h ${mins}m ${secs}s restants`;
  },

  formatScore(score, criterion) {
    const val = Number(score) || 0;
    switch (criterion) {
      case 'highest_multiplier':
        return `×${val.toFixed(2)}`;
      case 'highest_win':
        return `+${Math.floor(val).toLocaleString('fr-FR')} 🪙`;
      case 'total_profit':
        return `+${Math.floor(val).toLocaleString('fr-FR')} 🪙`;
      case 'total_wins':
        return `${Math.floor(val)} victoires`;
      case 'total_wagered':
        return `${Math.floor(val).toLocaleString('fr-FR')} 🪙`;
      default:
        return `${val}`;
    }
  },

  getCriterionLabel(criterion) {
    switch (criterion) {
      case 'highest_multiplier':
        return 'Plus Gros Multiplicateur atteint';
      case 'highest_win':
        return 'Plus Gros Gain en une seule manche';
      case 'total_profit':
        return 'Plus de Gains Cumulés (Profit net)';
      case 'total_wins':
        return 'Plus grand nombre de victoires';
      case 'total_wagered':
        return 'Plus gros volume de mises cumulées';
      default:
        return 'Meilleure performance';
    }
  },

  getGameMeta(gameType) {
    const map = {
      'crash': { name: 'Crash Galactique', shortName: 'Crash', icon: '🚀', route: '/jeux/crash' },
      'blackjack': { name: 'Blackjack', shortName: 'Blackjack', icon: '🃏', route: '/jeux/blackjack' },
      'slots': { name: 'Machine à Sous', shortName: 'Slots', icon: '🎰', route: '/jeux/machine-a-sous' },
      'roulette': { name: 'Roulette Européenne', shortName: 'Roulette', icon: '🔴', route: '/jeux/roulette' },
      'dice': { name: 'Jeu de Dés (Craps)', shortName: 'Dés', icon: '🎲', route: '/jeux/des' },
      'slider': { name: 'Slider Over/Under', shortName: 'Slider', icon: '🎯', route: '/jeux/slider' },
      'plinko': { name: 'Plinko Cosmique', shortName: 'Plinko', icon: '💧', route: '/jeux/plinko' },
      'video-poker': { name: 'Vidéo Poker Jacks or Better', shortName: 'Poker', icon: '🎴', route: '/jeux/video-poker' },
      'dragon-tower': { name: 'Dragon Tower', shortName: 'Tour', icon: '🐉', route: '/jeux/dragon-tower' },
      'all': { name: 'Tous les Jeux Marsabet', shortName: 'Tous les Jeux', icon: '👑', route: '/jeux' }
    };
    return map[gameType] || { name: 'Casino Marsabet', shortName: 'Jeux', icon: '🪐', route: '/jeux' };
  },

  updateLobbyContestWidget() {
    const widget = document.getElementById('lobbyContestHighlight');
    if (!widget) return;

    const activeContests = this.contests.filter(c => c.status === 'active');
    if (activeContests.length === 0) {
      widget.style.display = 'none';
      return;
    }

    const featured = activeContests[0];
    const gameMeta = this.getGameMeta(featured.gameType);
    const topLeader = featured.top3 && featured.top3[0];

    widget.style.display = 'block';
    widget.innerHTML = `
      <div class="lobby-contest-banner" onclick="window.Router ? window.Router.navigate('/evenements') : window.UI.switchView('events')">
        <div class="banner-badge">🔥 DÉFI DU MOMENT</div>
        <div class="banner-content">
          <div class="banner-icon">${gameMeta.icon}</div>
          <div class="banner-info">
            <h4 class="banner-title">${this.escapeHtml(featured.title)}</h4>
            <p class="banner-sub">
              Dotation : <strong style="color:var(--gold-light);">${Number(featured.prizePool).toLocaleString('fr-FR')} 🪙</strong>
              ${topLeader ? ` • 🥇 1er actuel : <strong>${this.escapeHtml(topLeader.username)}</strong> (${this.formatScore(topLeader.score, featured.criterion)})` : ''}
            </p>
          </div>
          <button class="btn btn-gold btn-sm banner-cta">
            Participer ➔
          </button>
        </div>
      </div>
    `;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.EventsManager = EventsManager;
