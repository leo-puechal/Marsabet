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

  // Effets sonores dans la Navbar latérale
  const sidebarSoundBtn = document.getElementById('sidebarSoundBtn');
  const sidebarSoundIcon = document.getElementById('sidebarSoundIcon');
  if (sidebarSoundBtn) {
    const updateSidebarSound = () => {
      const muted = window.sound.isMuted();
      if (sidebarSoundIcon) sidebarSoundIcon.textContent = muted ? '🔇' : '🔊';
      sidebarSoundBtn.innerHTML = `<span>${muted ? '🔇' : '🔊'}</span> Effets ${muted ? 'Coupés' : 'Activés'}`;
    };
    updateSidebarSound();
    sidebarSoundBtn.addEventListener('click', () => {
      window.sound.toggleMute();
      updateSidebarSound();
      if (soundBtn) soundBtn.textContent = window.sound.isMuted() ? '🔇' : '🔊';
      window.UI.showToast(window.sound.isMuted() ? 'Effets sonores désactivés' : 'Effets sonores activés', 'info', 1500);
    });
  }

  // Navigation dans la Navbar Verticale Fixe
  document.querySelectorAll('.sidebar-link, .sidebar-sublink').forEach(link => {
    link.addEventListener('click', (e) => {
      // Toggle du sous-menu Jeux
      if (link.id === 'sidebarGamesToggle') {
        e.preventDefault();
        const submenu = document.getElementById('sidebarGamesSubmenu');
        const chevron = document.getElementById('sidebarGamesChevron');
        if (submenu) {
          const isClosed = submenu.style.display === 'none' || submenu.style.display === '';
          submenu.style.display = isClosed ? 'flex' : 'none';
          if (chevron) chevron.style.transform = isClosed ? 'rotate(90deg)' : 'rotate(0deg)';
        }
        if (window.Router) {
          window.Router.navigate('/jeux');
        } else {
          window.UI.switchView('games');
        }
        return;
      }

      const view = link.dataset.view;
      if (view) {
        e.preventDefault();
        if (window.Router && window.Router.viewToPath[view]) {
          window.Router.navigate(window.Router.viewToPath[view]);
        } else {
          window.UI.switchView(view);
          if (view === 'leaderboard') loadLeaderboard();
          if (view === 'profile') loadProfile();
          if (view === 'shop') loadShop();
          if (view === 'admin' && window.AdminBDE) window.AdminBDE.switchTab('claims');
        }

        // Fermer le tiroir mobile après sélection
        const sidebar = document.getElementById('appSidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
      }
    });
  });

  // Toggle Menu Mobile
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('appSidebar');
      if (sidebar) sidebar.classList.toggle('mobile-open');
    });
  }

  // Connexion rapide depuis la navbar latérale
  const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');
  if (sidebarAuthBtn) {
    sidebarAuthBtn.addEventListener('click', () => window.UI.openAuthModal('login'));
  }

  // Modale de Confirmation de Déconnexion
  const logoutModal = document.getElementById('logoutConfirmModal');
  const openLogoutModal = () => {
    if (logoutModal) logoutModal.classList.add('active');
  };
  const closeLogoutModal = () => {
    if (logoutModal) logoutModal.classList.remove('active');
  };

  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', openLogoutModal);

  const headerLogoutBtn = document.getElementById('logoutBtn');
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', openLogoutModal);

  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  if (cancelLogoutBtn) cancelLogoutBtn.addEventListener('click', closeLogoutModal);

  const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');
  if (closeLogoutModalBtn) closeLogoutModalBtn.addEventListener('click', closeLogoutModal);

  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', () => {
      closeLogoutModal();
      window.API.clearToken();
      window.State.setUser(null);
      window.UI.showToast('Déconnecté avec succès.', 'info');
      if (window.Router) {
        window.Router.navigate('/lobby');
      } else {
        window.UI.switchView('lobby');
      }
      window.UI.openAuthModal('login');
    });
  }

  // Fermeture au clic en dehors et touche Échap
  if (logoutModal) {
    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) closeLogoutModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (logoutModal && logoutModal.classList.contains('active')) {
        closeLogoutModal();
      }
    }
  });

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
  if (window.FreeWheelGame) window.FreeWheelGame.init();
  if (window.AdminBDE) window.AdminBDE.init();
  if (window.Router) window.Router.init();

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
        if (window.Router) {
          window.Router.navigate('/admin');
        } else {
          window.UI.switchView('admin');
        }
        if (window.AdminBDE) window.AdminBDE.switchTab('claims');
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
    if (window.FreeWheelGame) {
      window.FreeWheelGame.fetchStatus();
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

    if (podiumP1Name) {
      podiumP1Name.innerHTML = p1 ? `<span class="vip-badge ${p1.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p1.vipIcon || '🥉'}</span> ${escapeHtml(p1.username)}` : 'En attente';
    }
    if (podiumP1Score) podiumP1Score.textContent = p1 ? `${p1.coins.toLocaleString()} 🪙` : '-';

    if (podiumP2Name) {
      podiumP2Name.innerHTML = p2 ? `<span class="vip-badge ${p2.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p2.vipIcon || '🥉'}</span> ${escapeHtml(p2.username)}` : 'En attente';
    }
    if (podiumP2Score) podiumP2Score.textContent = p2 ? `${p2.coins.toLocaleString()} 🪙` : '-';

    if (podiumP3Name) {
      podiumP3Name.innerHTML = p3 ? `<span class="vip-badge ${p3.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p3.vipIcon || '🥉'}</span> ${escapeHtml(p3.username)}` : 'En attente';
    }
    if (podiumP3Score) podiumP3Score.textContent = p3 ? `${p3.coins.toLocaleString()} 🪙` : '-';

    // Remplir le tableau
    listEl.innerHTML = leaders.map((u, idx) => {
      const rank = idx + 1;
      let badge = `${rank}`;
      if (rank === 1) badge = '🥇';
      if (rank === 2) badge = '🥈';
      if (rank === 3) badge = '🥉';

      const isCurrent = window.State.user && window.State.user.id === u.id;
      const vipClass = u.vipBadgeClass || 'vip-bronze';
      const vipIcon = u.vipIcon || '🥉';
      const vipRank = u.vipRank || 'Bronze';

      return `
        <tr style="${isCurrent ? 'background: rgba(212, 175, 55, 0.15); font-weight: bold;' : ''}">
          <td><span class="leader-rank-badge">${badge}</span></td>
          <td>
            <span class="vip-badge ${vipClass}" style="margin-right:6px; font-size:0.65rem;">${vipIcon} ${vipRank}</span>
            <strong>${escapeHtml(u.username)}</strong> ${isCurrent ? '<span style="color:var(--gold-light); font-size:0.75rem;">(Toi)</span>' : ''}
          </td>
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
    const vip = data.vipInfo || {
      currentTier: { name: 'Bronze', icon: '🥉', color: '#CD7F32', badgeClass: 'vip-bronze', bonusMultiplier: 1.0, perks: ['Badge Bronze standard'] },
      nextTier: { name: 'Argent', minWager: 50000 },
      wagerNeeded: 50000,
      progressPercent: 0
    };

    const profileUsername = document.getElementById('profileUsername');
    const profileRank = document.getElementById('profileRank');
    const profileCoins = document.getElementById('profileCoins');
    const profileGamesPlayed = document.getElementById('profileGamesPlayed');
    const profileBiggestWin = document.getElementById('profileBiggestWin');
    const profileTotalWon = document.getElementById('profileTotalWon');
    const profileStreak = document.getElementById('profileStreak');
    const profileStatWager = document.getElementById('profileStatWager');

    if (profileUsername) profileUsername.textContent = u.username;
    if (profileRank) profileRank.textContent = `Rang #${u.rank || '-'}`;
    if (profileCoins) profileCoins.textContent = `${u.coins.toLocaleString()} 🪙`;
    if (profileGamesPlayed) profileGamesPlayed.textContent = u.games_played.toLocaleString();
    if (profileBiggestWin) profileBiggestWin.textContent = `${u.biggest_win.toLocaleString()} 🪙`;
    if (profileTotalWon) profileTotalWon.textContent = `${u.total_won.toLocaleString()} 🪙`;
    if (profileStreak) profileStreak.textContent = `${u.daily_streak} jour${u.daily_streak > 1 ? 's' : ''}`;
    if (profileStatWager) profileStatWager.textContent = `${(u.total_wagered || 0).toLocaleString()} 🪙`;

    // Progression VIP
    const totalWageredEl = document.getElementById('profileTotalWagered');
    const vipTierNameEl = document.getElementById('profileVipTierName');
    const vipBadgeEl = document.getElementById('profileVipBadge');
    const vipAvatarEl = document.getElementById('profileVipAvatar');
    const vipMultiplierEl = document.getElementById('profileVipMultiplier');
    const vipProgressFill = document.getElementById('profileVipProgressFill');
    const vipProgressPercent = document.getElementById('profileVipProgressPercent');
    const vipNextTierText = document.getElementById('profileVipNextTierText');

    if (totalWageredEl) totalWageredEl.textContent = `${(u.total_wagered || 0).toLocaleString()} 🪙`;
    if (vipTierNameEl) vipTierNameEl.textContent = `VIP ${vip.currentTier.name.toUpperCase()}`;
    if (vipBadgeEl) {
      vipBadgeEl.className = `vip-badge ${vip.currentTier.badgeClass}`;
      vipBadgeEl.textContent = `${vip.currentTier.icon} ${vip.currentTier.name.toUpperCase()}`;
    }
    if (vipAvatarEl) {
      vipAvatarEl.textContent = vip.currentTier.icon;
      vipAvatarEl.style.borderColor = vip.currentTier.color;
    }
    if (vipMultiplierEl) {
      vipMultiplierEl.textContent = `Bonus Quotidien x${vip.currentTier.bonusMultiplier} (${vip.currentTier.perks[0] || ''})`;
    }
    if (vipProgressFill) {
      vipProgressFill.style.width = `${vip.progressPercent}%`;
    }
    if (vipProgressPercent) {
      vipProgressPercent.textContent = `Progression : ${vip.progressPercent}%`;
    }
    if (vipNextTierText) {
      if (vip.nextTier) {
        vipNextTierText.textContent = `Encore ${vip.wagerNeeded.toLocaleString()} 🪙 de mises vers ${vip.nextTier.name}`;
      } else {
        vipNextTierText.textContent = '👑 Rang VIP Maximum Atteint !';
      }
    }

    // Mise à jour de la roadmap VIP
    document.querySelectorAll('#profileVipRoadmap .vip-roadmap-tier').forEach(tierEl => {
      const tierName = tierEl.dataset.tier;
      if (tierName === vip.currentTier.name) {
        tierEl.classList.add('active');
      } else {
        tierEl.classList.remove('active');
      }
    });

    // Rafraîchir le compte à rebours de la roue quotidienne
    if (window.FreeWheelGame) {
      window.FreeWheelGame.fetchStatus();
    }

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

let currentShopCategory = 'all';
let allShopProducts = [];

async function loadShop() {
  const shopGrid = document.getElementById('shopItemsGrid');
  if (!shopGrid) return;

  try {
    const data = await window.API.getShopItems();
    allShopProducts = data.products || [];

    // Initialiser les écouteurs de filtres de catégorie
    const filterContainer = document.getElementById('shopCategoryFilters');
    if (filterContainer && !filterContainer.dataset.initialized) {
      filterContainer.dataset.initialized = 'true';
      filterContainer.querySelectorAll('.shop-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          filterContainer.querySelectorAll('.shop-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentShopCategory = btn.dataset.category || 'all';
          renderShopProducts();
        });
      });
    }

    renderShopProducts();
    loadShopMyOrders();
  } catch (err) {
    shopGrid.innerHTML = '<p style="color:var(--lose-red);">Erreur lors du chargement du catalogue BDE.</p>';
  }
}

function renderShopProducts() {
  const shopGrid = document.getElementById('shopItemsGrid');
  if (!shopGrid) return;

  const filtered = allShopProducts.filter(item => {
    if (currentShopCategory === 'all') return true;
    return item.category === currentShopCategory;
  });

  if (filtered.length === 0) {
    shopGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2.5rem; color: var(--text-muted);">Aucun produit disponible dans cette catégorie pour le moment.</div>';
    return;
  }

  shopGrid.innerHTML = filtered.map(item => {
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

    const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
    const initialPrice = hasVariants ? item.variants[0].price : item.price;
    const initialEuros = (initialPrice / 1000).toFixed(2).replace('.', ',');

    let variantsHtml = '';
    if (hasVariants) {
      variantsHtml = `
        <div style="margin: 0.5rem 0 0.25rem; text-align: left; width: 100%;">
          <label class="form-label" style="font-size: 0.72rem; margin-bottom: 0.2rem; color: var(--text-secondary);">
            Variante / Taille :
          </label>
          <select class="form-input shop-variant-select" data-item-id="${item.id}" id="variant-select-${item.id}">
            ${item.variants.map(v => {
              const vEuros = (v.price / 1000).toFixed(2).replace('.', ',');
              return `<option value="${escapeHtml(v.name)}" data-price="${v.price}">
                ${escapeHtml(v.name)} — ${v.price.toLocaleString()} 🪙 (${vEuros} €)
              </option>`;
            }).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="shop-item-card ${isOut ? 'is-empty' : ''}" id="card-product-${item.id}">
        <div class="shop-item-icon">${item.icon}</div>
        <div style="font-size:0.75rem; color:var(--gold-primary); font-weight:700; margin-bottom:0.2rem;">
          ${escapeHtml(item.category)} • ${escapeHtml(item.unit || 'Pièce')}
        </div>
        <div class="shop-item-title">${escapeHtml(item.name)}</div>
        <div class="shop-item-desc">${escapeHtml(item.description)}</div>
        
        ${variantsHtml}

        <div style="margin: 0.35rem 0;">
          ${badgeHtml}
        </div>

        <div class="shop-item-price" id="price-display-${item.id}">
          ${initialPrice.toLocaleString()} 🪙 <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">(${initialEuros} €)</span>
        </div>

        <button class="btn btn-gold btn-buy-shop" 
          id="btn-buy-${item.id}"
          data-id="${item.id}" 
          data-name="${escapeHtml(item.name)}" 
          data-price="${initialPrice}"
          data-variant="${hasVariants ? escapeHtml(item.variants[0].name) : ''}"
          ${isOut ? 'disabled' : ''} 
          style="width: 100%; font-size: 0.85rem;">
          ${isOut ? '❌ Épuisé' : 'Échanger mes Coins ▶'}
        </button>
      </div>
    `;
  }).join('');

  // Gestion des sélecteurs de variantes (changement dynamique du prix)
  shopGrid.querySelectorAll('.shop-variant-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const itemId = e.target.dataset.itemId;
      const selectedOption = e.target.selectedOptions[0];
      const newPrice = parseInt(selectedOption.dataset.price);
      const newVariant = e.target.value;
      const newEuros = (newPrice / 1000).toFixed(2).replace('.', ',');

      const priceDisplay = document.getElementById(`price-display-${itemId}`);
      if (priceDisplay) {
        priceDisplay.innerHTML = `${newPrice.toLocaleString()} 🪙 <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">(${newEuros} €)</span>`;
      }

      const buyBtn = document.getElementById(`btn-buy-${itemId}`);
      if (buyBtn) {
        buyBtn.dataset.price = newPrice;
        buyBtn.dataset.variant = newVariant;
      }
    });
  });

  // Événements d'échange avec support des variantes et confirmation
  shopGrid.querySelectorAll('.btn-buy-shop:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!window.State.isAuthenticated) {
        window.UI.openAuthModal('login');
        return;
      }

      const productId = e.currentTarget.dataset.id;
      const productName = e.currentTarget.dataset.name;
      const productPrice = parseInt(e.currentTarget.dataset.price);
      const variantName = e.currentTarget.dataset.variant || null;

      // Vérification côté client
      if (window.State.user.coins < productPrice) {
        window.UI.showToast(`Solde insuffisant ! Il te manque ${(productPrice - window.State.user.coins).toLocaleString()} coins pour cet échange.`, 'error');
        return;
      }

      const displayName = variantName ? `${productName} (${variantName})` : productName;
      const eurosDisplay = (productPrice / 1000).toFixed(2).replace('.', ',');

      if (!confirm(`Confirmer l'échange de ${productPrice.toLocaleString()} coins (${eurosDisplay} €) contre : "${displayName}" physique au stand BDE ?`)) {
        return;
      }

      try {
        const res = await window.API.orderShopProduct(productId, variantName);
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
    free_daily_wheel: '🎁 Roue Quotidienne',
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

window.loadLeaderboard = loadLeaderboard;
window.loadProfile = loadProfile;
window.loadShop = loadShop;
window.loadGlobalStats = loadGlobalStats;

