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
        if (view === 'admin') {
          if (window.AdminBDE) window.AdminBDE.switchTab('claims');
        }
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

  // Initialisation des jeux & Admin
  window.SlotsGame.init();
  window.BlackjackGame.init();
  window.RouletteGame.init();
  window.DiceGame.init();
  window.WheelGame.init();
  window.PlinkoGame.init();
  if (window.AdminBDE) window.AdminBDE.init();

  // Fermeture modale Ticket
  const closeTicketBtn = document.getElementById('closeTicketModal');
  if (closeTicketBtn) {
    closeTicketBtn.addEventListener('click', () => {
      const modal = document.getElementById('claimTicketModal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Devenir Admin avec code secret
  const becomeAdminBtn = document.getElementById('becomeAdminBtn');
  if (becomeAdminBtn) {
    becomeAdminBtn.addEventListener('click', async () => {
      const secret = prompt('Entre le mot de passe secret BDE (ex: epitech2026) :');
      if (!secret) return;
      try {
        const res = await window.API.becomeAdmin(secret);
        window.State.user.role = 'admin';
        window.State.updateUI();
        window.UI.showToast(res.message, 'success');
        window.UI.switchView('admin');
        window.AdminBDE.switchTab('claims');
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      }
    });
  }

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

    // Commandes physiques et codes de retrait
    const ordersListEl = document.getElementById('profileOrdersList');
    if (ordersListEl) {
      if (!data.orders || data.orders.length === 0) {
        ordersListEl.innerHTML = '<p style="color: var(--text-muted); padding:1rem;">Aucun produit BDE échangé pour l’instant. Visite la boutique !</p>';
      } else {
        ordersListEl.innerHTML = data.orders.map(o => {
          const isCollected = o.status === 'collected';
          return `
            <div class="shop-item-card" style="text-align:left; align-items:flex-start;">
              <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <span style="font-size:1.8rem;">${o.icon || '🎁'}</span>
                <span class="order-status ${isCollected ? 'collected' : 'pending'}">
                  ${isCollected ? '✅ Retiré au stand' : '⏳ En attente de retrait'}
                </span>
              </div>
              <div class="shop-item-title" style="margin-top:0.4rem;">${escapeHtml(o.item_name)}</div>
              <div style="width:100%; margin:0.5rem 0;">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Code à présenter au stand BDE :</div>
                <code style="font-family:var(--font-mono); font-size:1.2rem; font-weight:800; color:var(--gold-light); letter-spacing:1.5px; background:rgba(0,0,0,0.4); padding:4px 8px; border-radius:4px; display:inline-block; border:1px solid var(--gold-primary);">
                  ${o.claim_code}
                </code>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                ${isCollected ? 'Retiré le ' + formatDate(o.collected_at) : 'Commandé le ' + formatDate(o.created_at)}
              </div>
            </div>
          `;
        }).join('');
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
    const products = data.products || [];

    shopGrid.innerHTML = products.map(item => {
      const isOut = item.stock <= 0;
      const isLow = item.stock > 0 && item.stock <= 5;
      let badgeHtml = '';

      if (isOut) {
        badgeHtml = '<span class="stock-badge out-of-stock">Rupture de Stock (0)</span>';
      } else if (isLow) {
        badgeHtml = `<span class="stock-badge low-stock">Derniers articles (${item.stock})</span>`;
      } else {
        badgeHtml = `<span class="stock-badge in-stock">En Stock (${item.stock} restants)</span>`;
      }

      return `
        <div class="shop-item-card ${isOut ? 'is-empty' : ''}">
          <div class="shop-item-icon">${item.icon}</div>
          <div class="shop-item-title">${escapeHtml(item.name)}</div>
          <div class="shop-item-desc">${escapeHtml(item.description)}</div>
          
          <div style="margin: 0.25rem 0;">
            ${badgeHtml}
          </div>

          <div class="shop-item-price">${item.price.toLocaleString()} 🪙</div>

          <button class="btn btn-gold btn-buy-shop" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.price}" ${isOut ? 'disabled' : ''} style="width: 100%; font-size: 0.85rem;">
            ${isOut ? '❌ Épuisé' : 'Échanger mes Coins ▶'}
          </button>
        </div>
      `;
    }).join('');

    // Événements d'échange
    shopGrid.querySelectorAll('.btn-buy-shop:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!window.State.isAuthenticated) {
          window.UI.openAuthModal('login');
          return;
        }

        const productId = e.currentTarget.dataset.id;
        const productName = e.currentTarget.dataset.name;
        const productPrice = parseInt(e.currentTarget.dataset.price);

        if (window.State.user.coins < productPrice) {
          window.UI.showToast(`Solde insuffisant ! Il te manque ${(productPrice - window.State.user.coins).toLocaleString()} jetons.`, 'error');
          return;
        }

        if (!confirm(`Confirmer l'échange de ${productPrice.toLocaleString()} coins contre : "${productName}" physique au stand BDE ?`)) {
          return;
        }

        try {
          const res = await window.API.orderShopProduct(productId);
          window.State.updateCoins(res.coins);
          window.UI.showToast(res.message, 'success', 5000);
          window.sound.playWin();
          window.UI.triggerConfetti();

          // Afficher la modale avec le Ticket de Retrait
          showClaimTicketModal(res.order);

          // Rafraîchir les stocks affichés
          loadShop();
        } catch (err) {
          window.UI.showToast(err.message, 'error');
        }
      });
    });

    // Charger également les commandes en cours de l'élève
    loadShopMyOrders();
  } catch (err) {
    shopGrid.innerHTML = '<p style="color:var(--lose-red);">Erreur lors du chargement du catalogue BDE.</p>';
  }
}

async function loadShopMyOrders() {
  const container = document.getElementById('shopMyOrdersList');
  if (!container) return;

  if (!window.State.isAuthenticated) {
    container.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">Connecte-toi pour voir tes codes de retrait actifs.</p>';
    return;
  }

  try {
    const data = await window.API.getMyOrders();
    const orders = data.orders || [];

    if (orders.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">Tu n’as aucun code de retrait pour le moment.</p>';
      return;
    }

    container.innerHTML = orders.map(o => {
      const isCollected = o.status === 'collected';
      return `
        <div style="background:rgba(4,12,28,0.7); border:1px solid ${isCollected ? 'rgba(16,185,129,0.3)' : 'var(--gold-primary)'}; border-radius:var(--radius-md); padding:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span style="font-size:2rem;">${o.icon || '🎁'}</span>
            <div>
              <div style="font-weight:700; color:#FFF;">${escapeHtml(o.item_name)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Commandé le ${formatDate(o.created_at)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <code style="font-family:var(--font-mono); font-size:1.15rem; font-weight:800; color:var(--gold-light); letter-spacing:1px; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.4);">
              ${o.claim_code}
            </code>
            <div style="margin-top:0.35rem;">
              <span class="order-status ${isCollected ? 'collected' : 'pending'}">
                ${isCollected ? '✅ Retiré au stand' : '⏳ En attente de retrait'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

function showClaimTicketModal(order) {
  const modal = document.getElementById('claimTicketModal');
  const codeEl = document.getElementById('ticketModalCode');
  const prodEl = document.getElementById('ticketModalProduct');
  const coinsEl = document.getElementById('ticketModalCoins');

  if (!modal) return;
  if (codeEl) codeEl.textContent = order.claimCode;
  if (prodEl) prodEl.textContent = `${order.icon || '🎁'} ${order.itemName}`;
  if (coinsEl) coinsEl.textContent = `${order.coinsPaid.toLocaleString()} 🪙`;

  modal.classList.add('active');
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
