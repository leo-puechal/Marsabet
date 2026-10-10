// Main Marsabet Application Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Initialisation du son
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    const updateSoundBtnIcon = () => {
      soundBtn.textContent = window.sound.isMuted() ? '🔇' : '🔊';
    };
    updateSoundBtnIcon();
    soundBtn.addEventListener('click', () => {
      window.sound.toggleMute();
      updateSoundBtnIcon();
      window.UI.showToast(window.sound.isMuted() ? 'Son désactivé' : 'Son activé', 'info', 1500);
    });
  }

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) {
        window.UI.switchView(view);
        if (view === 'leaderboard') loadLeaderboard();
        if (view === 'profile') loadProfile();
        if (view === 'shop') loadShop();
      }
    });
  });

  // Cartes de jeux dans le Lobby
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetGame = card.dataset.game;
      if (targetGame) {
        window.UI.switchView(targetGame);
      }
    });
  });

  // Boutons Retour au Lobby
  document.querySelectorAll('.btn-back-lobby').forEach(btn => {
    btn.addEventListener('click', () => {
      window.UI.switchView('lobby');
    });
  });

  // Modale Auth
  const authBtn = document.getElementById('headerAuthBtn');
  if (authBtn) {
    authBtn.addEventListener('click', () => window.UI.openAuthModal('login'));
  }

  const closeAuthBtn = document.getElementById('closeAuthModal');
  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', () => window.UI.closeAuthModal());
  }

  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  if (tabLogin) tabLogin.addEventListener('click', () => window.UI.openAuthModal('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => window.UI.openAuthModal('register'));

  // Formulaire Connexion
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      try {
        const data = await window.API.login(username, password);
        window.API.setToken(data.token);
        window.State.setUser(data.user);
        window.UI.closeAuthModal();
        window.UI.showToast(data.message, 'success');
        window.sound.playWin();
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      }
    });
  }

  // Formulaire Inscription
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value;
      const password = document.getElementById('regPassword').value;

      try {
        const data = await window.API.register(username, password);
        window.API.setToken(data.token);
        window.State.setUser(data.user);
        window.UI.closeAuthModal();
        window.UI.showToast(data.message, 'success');
        window.sound.playJackpot();
        window.UI.triggerConfetti();
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      }
    });
  }

  // Déconnexion
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.API.clearToken();
      window.State.setUser(null);
      window.UI.showToast('Déconnecté avec succès.', 'info');
      window.UI.switchView('lobby');
    });
  }

  // Clic sur l'en-tête de solde pour ouvrir le profil
  const coinsBadge = document.getElementById('headerCoinsBadge');
  if (coinsBadge) {
    coinsBadge.addEventListener('click', () => {
      if (window.State.isAuthenticated) {
        window.UI.switchView('profile');
        loadProfile();
      } else {
        window.UI.openAuthModal('login');
      }
    });
  }

  // Bonus Quotidien
  const claimDailyBtn = document.getElementById('claimDailyBtn');
  if (claimDailyBtn) {
    claimDailyBtn.addEventListener('click', async () => {
      if (!window.State.isAuthenticated) {
        window.UI.openAuthModal('login');
        return;
      }
      try {
        const data = await window.API.claimDailyBonus();
        window.State.updateCoins(data.coins);
        window.State.user.canClaimDaily = false;
        window.State.user.daily_streak = data.newStreak;
        window.State.updateUI();
        window.UI.showToast(data.message, 'success');
        window.sound.playWin();
        window.UI.triggerConfetti();
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      }
    });
  }

  // Initialisation des jeux
  window.SlotsGame.init();
  window.BlackjackGame.init();
  window.RouletteGame.init();
  window.DiceGame.init();
  window.WheelGame.init();
  window.PlinkoGame.init();

  // Vérification de la session utilisateur persistante
  await checkSession();
  loadGlobalStats();
});

async function checkSession() {
  const token = window.API.getToken();
  if (!token) return;

  try {
    const data = await window.API.getMe();
    window.State.setUser(data.user);
    if (window.BlackjackGame) {
      window.BlackjackGame.checkExistingGame();
    }
  } catch (err) {
    window.API.clearToken();
    window.State.setUser(null);
  }
}

async function loadGlobalStats() {
  try {
    const stats = await window.API.getGlobalStats();

    const tickerEl = document.getElementById('recentWinsTicker');
    if (tickerEl && stats.recentWins && stats.recentWins.length > 0) {
      tickerEl.innerHTML = stats.recentWins.map(w => `
        <div class="ticker-item">
          <span class="ticker-player">${escapeHtml(w.username)}</span>
          <span class="ticker-game">${gameLabel(w.game_type)}</span>
          <span class="ticker-win">+${w.profit} 🪙</span>
        </div>
      `).join('');
    }

    const totalGamesEl = document.getElementById('statTotalGames');
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames.toLocaleString();

    const totalPlayersEl = document.getElementById('statTotalPlayers');
    if (totalPlayersEl) totalPlayersEl.textContent = stats.totalPlayers.toLocaleString();
  } catch (e) {}
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboardList');
  if (!listEl) return;
  listEl.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Chargement du classement...</td></tr>';

  try {
    const data = await window.API.getLeaderboard();
    const leaders = data.leaderboard || [];

    // Mettre à jour le podium (Top 3)
    const p1 = leaders[0];
    const p2 = leaders[1];
    const p3 = leaders[2];

    const podiumP1Name = document.getElementById('podiumP1Name');
    const podiumP1Score = document.getElementById('podiumP1Score');
    const podiumP2Name = document.getElementById('podiumP2Name');
    const podiumP2Score = document.getElementById('podiumP2Score');
    const podiumP3Name = document.getElementById('podiumP3Name');
    const podiumP3Score = document.getElementById('podiumP3Score');

    if (podiumP1Name) podiumP1Name.textContent = p1 ? p1.username : 'En attente';
    if (podiumP1Score) podiumP1Score.textContent = p1 ? `${p1.coins.toLocaleString()} 🪙` : '-';
    if (podiumP2Name) podiumP2Name.textContent = p2 ? p2.username : 'En attente';
    if (podiumP2Score) podiumP2Score.textContent = p2 ? `${p2.coins.toLocaleString()} 🪙` : '-';
    if (podiumP3Name) podiumP3Name.textContent = p3 ? p3.username : 'En attente';
    if (podiumP3Score) podiumP3Score.textContent = p3 ? `${p3.coins.toLocaleString()} 🪙` : '-';

    // Remplir le tableau
    listEl.innerHTML = leaders.map((u, idx) => {
      const rank = idx + 1;
      let badge = `${rank}`;
      if (rank === 1) badge = '🥇';
      if (rank === 2) badge = '🥈';
      if (rank === 3) badge = '🥉';

      const isCurrent = window.State.user && window.State.user.id === u.id;

      return `
        <tr style="${isCurrent ? 'background: rgba(212, 175, 55, 0.15); font-weight: bold;' : ''}">
          <td><span class="leader-rank-badge">${badge}</span></td>
          <td><strong>${escapeHtml(u.username)}</strong> ${isCurrent ? '<span style="color:var(--gold-light); font-size:0.75rem;">(Toi)</span>' : ''}</td>
          <td class="leader-coins">${u.coins.toLocaleString()} 🪙</td>
          <td>🔥 ${u.daily_streak}j</td>
          <td>${u.biggest_win ? u.biggest_win.toLocaleString() + ' 🪙' : '-'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--lose-red);">Erreur lors du chargement.</td></tr>';
  }
}

async function loadProfile() {
  if (!window.State.isAuthenticated) {
    window.UI.openAuthModal('login');
    return;
  }

  try {
    const data = await window.API.getProfile();
    const u = data.user;

    const profileUsername = document.getElementById('profileUsername');
    const profileRank = document.getElementById('profileRank');
    const profileCoins = document.getElementById('profileCoins');
    const profileGamesPlayed = document.getElementById('profileGamesPlayed');
    const profileBiggestWin = document.getElementById('profileBiggestWin');
    const profileTotalWon = document.getElementById('profileTotalWon');
    const profileStreak = document.getElementById('profileStreak');

    if (profileUsername) profileUsername.textContent = u.username;
    if (profileRank) profileRank.textContent = `Rang #${u.rank || '-'}`;
    if (profileCoins) profileCoins.textContent = `${u.coins.toLocaleString()} 🪙`;
    if (profileGamesPlayed) profileGamesPlayed.textContent = u.games_played.toLocaleString();
    if (profileBiggestWin) profileBiggestWin.textContent = `${u.biggest_win.toLocaleString()} 🪙`;
    if (profileTotalWon) profileTotalWon.textContent = `${u.total_won.toLocaleString()} 🪙`;
    if (profileStreak) profileStreak.textContent = `${u.daily_streak} jour${u.daily_streak > 1 ? 's' : ''}`;

    // Historique
    const histTable = document.getElementById('profileHistoryList');
    if (histTable) {
      if (data.history.length === 0) {
        histTable.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1.5rem;">Aucune partie enregistrée pour le moment.</td></tr>';
      } else {
        histTable.innerHTML = data.history.map(h => {
          const isWin = h.profit > 0;
          const isTie = h.profit === 0;
          return `
            <tr>
              <td><strong>${gameLabel(h.game_type)}</strong></td>
              <td>${h.bet > 0 ? h.bet.toLocaleString() + ' 🪙' : '-'}</td>
              <td>${h.payout.toLocaleString()} 🪙</td>
              <td style="color: ${isWin ? 'var(--win-green)' : (isTie ? 'var(--text-muted)' : 'var(--lose-red)')}; font-weight: bold;">
                ${h.profit > 0 ? '+' : ''}${h.profit.toLocaleString()} 🪙
              </td>
              <td style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(h.created_at)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Inventaire
    const invGrid = document.getElementById('profileInventoryGrid');
    if (invGrid) {
      if (data.inventory.length === 0) {
        invGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Aucun article virtuel échangé pour l’instant. Visite la boutique BDE !</p>';
      } else {
        invGrid.innerHTML = data.inventory.map(item => `
          <div class="shop-item-card">
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-title">${escapeHtml(item.name)}</div>
            <div class="shop-item-desc">${escapeHtml(item.description)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Acheté le ${formatDate(item.created_at)}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    window.UI.showToast(err.message, 'error');
  }
}

async function loadShop() {
  const shopGrid = document.getElementById('shopItemsGrid');
  if (!shopGrid) return;

  try {
    const data = await window.API.getShopItems();
    shopGrid.innerHTML = data.items.map(item => `
      <div class="shop-item-card">
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-title">${escapeHtml(item.name)}</div>
        <div class="shop-item-desc">${escapeHtml(item.description)}</div>
        <div class="shop-item-price">${item.price.toLocaleString()} 🪙</div>
        <button class="btn btn-gold btn-buy-shop" data-id="${item.id}" style="width: 100%; font-size: 0.85rem;">
          Échanger mes jetons
        </button>
      </div>
    `).join('');

    // Événements d'achat
    shopGrid.querySelectorAll('.btn-buy-shop').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!window.State.isAuthenticated) {
          window.UI.openAuthModal('login');
          return;
        }
        const itemId = e.currentTarget.dataset.id;
        try {
          const res = await window.API.buyShopItem(itemId);
          window.State.updateCoins(res.coins);
          window.UI.showToast(res.message, 'success');
          window.sound.playWin();
          window.UI.triggerConfetti();
        } catch (err) {
          window.UI.showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    shopGrid.innerHTML = '<p style="color:var(--lose-red);">Erreur catalogue.</p>';
  }
}

function gameLabel(type) {
  const map = {
    slots: '🎰 Machine à sous',
    blackjack: '🃏 Blackjack',
    roulette: '🎡 Roulette',
    dice: '🎲 Dés',
    wheel: '🎪 Roue de la fortune',
    plinko: '💧 Plinko',
    daily_bonus: '🎁 Bonus quotidien'
  };
  return map[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
