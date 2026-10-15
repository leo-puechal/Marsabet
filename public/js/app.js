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
        if (view === 'admin') {
          const isAdmin = !!(window.State && window.State.isAuthenticated && window.State.user && (window.State.user.role === 'admin' || window.State.user.role === 'bde'));
          if (!isAdmin) {
            window.UI?.showToast('Accès interdit. Cette section est strictement réservée au BDE.', 'error');
            return;
          }
        }
        if (window.Router && window.Router.viewToPath[view]) {
          window.Router.navigate(window.Router.viewToPath[view]);
        } else {
          window.UI.switchView(view);
          if (view === 'leaderboard') loadLeaderboard();
          if (view === 'profile') loadProfile();
          if (view === 'admin' && window.AdminBDE) window.AdminBDE.switchTab('orders');
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

  let currentPendingEmail = '';

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
        if (window.SyncEngine) window.SyncEngine.authenticateSocket();
        window.UI.closeAuthModal();
        window.UI.showToast(data.message, 'success');
        window.sound.playWin();
        if (window.AnnouncementManager) {
          window.AnnouncementManager.check();
        }
      } catch (err) {
        if (err.requiresVerification || (err.message && err.message.toLowerCase().includes('activé'))) {
          currentPendingEmail = err.email || '';
          window.UI.openAuthModal('verify', { email: currentPendingEmail });
          window.UI.showToast(err.message || 'Saisis le code de validation reçu par email.', 'warning', 6000);
          return;
        }
        window.UI.showToast(err.message, 'error');
      }
    });
  }

  // Formulaire Inscription
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const lastName = document.getElementById('regLastName')?.value.trim();
      const firstName = document.getElementById('regFirstName')?.value.trim();
      const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
      const username = document.getElementById('regUsername').value.trim();
      const password = document.getElementById('regPassword').value;

      if (!lastName || !firstName) {
        window.UI.showToast('Le nom et le prénom sont obligatoires pour pouvoir récupérer tes récompenses physiques.', 'error');
        return;
      }

      if (!email) {
        window.UI.showToast('L\'adresse email étudiante Epitech (@epitech.eu) est obligatoire.', 'error');
        return;
      }

      const epitechRegex = /^[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.)*epitech\.(eu|digital)$/i;
      if (!epitechRegex.test(email)) {
        window.UI.showToast('Format non autorisé. Utilise ton email étudiant officiel (@epitech.eu).', 'warning');
        return;
      }

      try {
        const data = await window.API.register(username, password, lastName, firstName, email);
        if (data.requiresVerification) {
          currentPendingEmail = email;
          window.UI.openAuthModal('verify', { email });
          window.UI.showToast(data.message, 'info', 7000);
        } else {
          window.API.setToken(data.token);
          window.State.setUser(data.user);
          if (window.SyncEngine) window.SyncEngine.authenticateSocket();
          window.UI.closeAuthModal();
          window.UI.showToast(data.message, 'success');
          window.sound.playJackpot();
          window.UI.triggerConfetti();
          if (window.AnnouncementManager) {
            window.AnnouncementManager.check();
          }
        }
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      }
    });
  }

  // Formulaire Validation Code Email
  const formVerifyEmail = document.getElementById('formVerifyEmail');
  if (formVerifyEmail) {
    formVerifyEmail.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('verifyCodeInput')?.value.trim();
      if (!code || code.length !== 6) {
        window.UI.showToast('Veuillez entrer le code à 6 chiffres reçu par email.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitVerifyEmail');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Vérification...';
      }

      try {
        const data = await window.API.verifyEmail(currentPendingEmail, code);
        window.API.setToken(data.token);
        window.State.setUser(data.user);
        if (window.SyncEngine) window.SyncEngine.authenticateSocket();
        window.UI.closeAuthModal();
        window.UI.showToast(data.message, 'success', 5000);
        window.sound.playJackpot();
        window.UI.triggerConfetti();
        if (window.AnnouncementManager) {
          window.AnnouncementManager.check();
        }
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '✨ Activer & Recevoir 5 000 🪙';
        }
      }
    });
  }

  // Renvoyer le code de validation
  const btnResendVerifyCode = document.getElementById('btnResendVerifyCode');
  if (btnResendVerifyCode) {
    btnResendVerifyCode.addEventListener('click', async () => {
      if (!currentPendingEmail) {
        window.UI.showToast('Adresse email inconnue. Reconnecte-toi.', 'warning');
        window.UI.openAuthModal('login');
        return;
      }
      btnResendVerifyCode.disabled = true;
      btnResendVerifyCode.textContent = 'Envoi...';
      try {
        const res = await window.API.resendVerificationCode(currentPendingEmail);
        window.UI.showToast(res.message || 'Nouveau code envoyé par email !', 'success', 4000);
      } catch (err) {
        window.UI.showToast(err.message, 'error');
      } finally {
        btnResendVerifyCode.disabled = false;
        btnResendVerifyCode.textContent = '🔄 Renvoyer le code';
      }
    });
  }

  // Bouton retour à la connexion depuis l'étape vérification
  const btnBackToLogin = document.getElementById('btnBackToLoginFromVerify');
  if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', () => {
      window.UI.openAuthModal('login');
    });
  }

  // Bouton corriger l'email depuis l'étape vérification (en cas de faute de frappe)
  const btnBackToRegister = document.getElementById('btnBackToRegisterFromVerify');
  if (btnBackToRegister) {
    btnBackToRegister.addEventListener('click', () => {
      window.UI.openAuthModal('register');
      const regEmail = document.getElementById('regEmail');
      if (regEmail && currentPendingEmail) {
        regEmail.value = currentPendingEmail;
        setTimeout(() => regEmail.focus(), 150);
      }
    });
  }

  // Masquer / afficher le mot de passe (icône œil)
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
        btn.setAttribute('aria-label', 'Masquer le mot de passe');
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
        btn.setAttribute('aria-label', 'Afficher le mot de passe');
      }
    });
  });

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
        if (view === 'admin') {
          const isAdmin = !!(window.State && window.State.isAuthenticated && window.State.user && (window.State.user.role === 'admin' || window.State.user.role === 'bde'));
          if (!isAdmin) {
            window.UI?.showToast('Accès interdit. Cette section est strictement réservée au BDE.', 'error');
            closeMobileDrawer();
            return;
          }
        }
        if (window.Router && window.Router.viewToPath[view]) {
          window.Router.navigate(window.Router.viewToPath[view]);
        } else {
          window.UI.switchView(view);
          if (view === 'leaderboard') loadLeaderboard();
          if (view === 'profile') loadProfile();
          if (view === 'admin' && window.AdminBDE) window.AdminBDE.switchTab('orders');
        }

        // Fermer le tiroir mobile après sélection
        closeMobileDrawer();
      }
    });
  });

  // Gestion du Tiroir Mobile / Menu Hamburger & Backdrop
  const sidebar = document.getElementById('appSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');

  function openMobileDrawer() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileDrawer() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  window.closeMobileDrawer = closeMobileDrawer;
  window.openMobileDrawer = openMobileDrawer;

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileDrawer);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileDrawer);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
      closeMobileDrawer();
    }
  });

  // Connexion rapide depuis la navbar latérale
  const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');
  if (sidebarAuthBtn) {
    sidebarAuthBtn.addEventListener('click', () => {
      closeMobileDrawer();
      window.UI.openAuthModal('login');
    });
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
      if (window.SyncEngine) window.SyncEngine.notifyLogout();
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
  if (window.SliderGame) window.SliderGame.init();
  if (window.CrashGame) window.CrashGame.init();
  window.WheelGame.init();
  window.PlinkoGame.init();
  if (window.FreeWheelGame) window.FreeWheelGame.init();
  if (window.VideoPokerGame) window.VideoPokerGame.init();
  if (window.DragonTowerGame) window.DragonTowerGame.init();
  if (window.AdminBDE) window.AdminBDE.init();

  // Vérification de la session utilisateur persistante AVANT le routage
  await checkSession();

  // Initialisation du Router sécurisé une fois la session authentifiée
  if (window.Router) window.Router.init();
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
    if (window.VideoPokerGame) {
      window.VideoPokerGame.init();
    }
    if (window.DragonTowerGame) {
      window.DragonTowerGame.init();
    }
    if (window.AnnouncementManager) {
      window.AnnouncementManager.check();
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
  } catch (e) { }
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

    const isAdmin = !!(window.State && window.State.user && (window.State.user.role === 'admin' || window.State.user.role === 'bde'));

    if (podiumP1Name) {
      podiumP1Name.innerHTML = p1 ? `<span class="vip-badge ${p1.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p1.vipIcon || '🥉'}</span> <span ${isAdmin ? `style="cursor:pointer; text-decoration:underline;" onclick="window.AdminBDE && window.AdminBDE.openPlayerDetailModal(${p1.id})" title="Admin : Voir la fiche joueur"` : ''}>${escapeHtml(p1.username)}</span>` : 'En attente';
    }
    if (podiumP1Score) podiumP1Score.textContent = p1 ? `${p1.coins.toLocaleString()} 🪙` : '-';

    if (podiumP2Name) {
      podiumP2Name.innerHTML = p2 ? `<span class="vip-badge ${p2.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p2.vipIcon || '🥉'}</span> <span ${isAdmin ? `style="cursor:pointer; text-decoration:underline;" onclick="window.AdminBDE && window.AdminBDE.openPlayerDetailModal(${p2.id})" title="Admin : Voir la fiche joueur"` : ''}>${escapeHtml(p2.username)}</span>` : 'En attente';
    }
    if (podiumP2Score) podiumP2Score.textContent = p2 ? `${p2.coins.toLocaleString()} 🪙` : '-';

    if (podiumP3Name) {
      podiumP3Name.innerHTML = p3 ? `<span class="vip-badge ${p3.vipBadgeClass || 'vip-bronze'}" style="margin-right:4px; font-size:0.65rem;">${p3.vipIcon || '🥉'}</span> <span ${isAdmin ? `style="cursor:pointer; text-decoration:underline;" onclick="window.AdminBDE && window.AdminBDE.openPlayerDetailModal(${p3.id})" title="Admin : Voir la fiche joueur"` : ''}>${escapeHtml(p3.username)}</span>` : 'En attente';
    }
    if (podiumP3Score) podiumP3Score.textContent = p3 ? `${p3.coins.toLocaleString()} 🪙` : '-';

    // Remplir le tableau
    if (leaders.length === 0) {
      listEl.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2.5rem; color:var(--text-muted); font-size:0.95rem;">Aucun joueur classé pour le moment.<br><span style="color:var(--gold-light);">Inscris-toi et lance une partie pour prendre la tête du podium !</span></td></tr>';
      return;
    }

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
      const adminClick = isAdmin ? `onclick="window.AdminBDE && window.AdminBDE.openPlayerDetailModal(${u.id})" style="cursor:pointer; ${isCurrent ? 'background: rgba(212, 175, 55, 0.15);' : ''}" class="admin-user-row-hover" title="Admin : Voir la fiche de ${escapeHtml(u.username)}"` : (isCurrent ? 'style="background: rgba(212, 175, 55, 0.15); font-weight: bold;"' : '');

      return `
        <tr ${adminClick}>
          <td><span class="leader-rank-badge">${badge}</span></td>
          <td>
            <span class="vip-badge ${vipClass}" style="margin-right:6px; font-size:0.65rem;">${vipIcon} ${vipRank}</span>
            <strong>${escapeHtml(u.username)}</strong>
            ${isCurrent ? '<span style="color:var(--gold-light); font-size:0.75rem;">(Toi)</span>' : ''}
            ${isAdmin ? '<span style="font-size:0.75rem; color:var(--gold-light); margin-left:5px; opacity:0.85;" title="Fiche Admin">📊</span>' : ''}
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
  if (!window.State?.isAuthenticated) {
    window.UI?.openAuthModal('login');
    return;
  }

  const loadingState = document.getElementById('profileLoadingState');
  const contentContainer = document.getElementById('profileContentContainer');

  // Afficher l'état de chargement
  if (loadingState) {
    loadingState.style.display = 'block';
    loadingState.innerHTML = `
      <div style="width:50px; height:50px; border:4px solid rgba(212,175,55,0.2); border-top-color:var(--gold-primary); border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 1.5rem;"></div>
      <h3 style="color:#FFF; font-family:var(--font-display); font-size:1.3rem; margin-bottom:0.5rem;">
        Chargement de ton profil cosmique...
      </h3>
      <p style="color:var(--text-muted); font-size:0.9rem;">
        Récupération du solde, niveau VIP, historique et livraisons
      </p>
    `;
  }
  if (contentContainer) contentContainer.style.display = 'none';

  try {
    const data = await window.API.getProfile();
    const u = data?.user || {};
    const vip = data?.vipInfo || {
      currentTier: { name: 'Bronze', icon: '🥉', color: '#CD7F32', badgeClass: 'vip-bronze', bonusMultiplier: 1.0, perk: 'Statut joueur de base', perks: ['Statut joueur de base'] },
      nextTier: { name: 'Argent', minWager: 500000 },
      wagerNeeded: 500000,
      progressPercent: 0
    };

    const currentTier = vip?.currentTier || { name: 'Bronze', icon: '🥉', color: '#CD7F32', badgeClass: 'vip-bronze', bonusMultiplier: 1.0, perk: 'Statut standard' };

    const profileUsername = document.getElementById('profileUsername');
    const profileRank = document.getElementById('profileRank');
    const profileCoins = document.getElementById('profileCoins');
    const profileGamesPlayed = document.getElementById('profileGamesPlayed');
    const profileBiggestWin = document.getElementById('profileBiggestWin');
    const profileTotalWon = document.getElementById('profileTotalWon');
    const profileStreak = document.getElementById('profileStreak');
    const profileStatWager = document.getElementById('profileStatWager');

    if (profileUsername) profileUsername.textContent = u?.username || 'Élève';
    const profileFullNameText = document.getElementById('profileFullNameText');
    if (profileFullNameText) {
      const full = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
      profileFullNameText.textContent = full || u?.username || 'Élève';
    }
    if (profileRank) profileRank.textContent = `Rang #${u?.rank || '-'}`;
    if (profileCoins) profileCoins.textContent = `${(Number(u?.coins) || 0).toLocaleString('fr-FR')} 🪙`;
    if (profileGamesPlayed) profileGamesPlayed.textContent = (Number(u?.games_played) || 0).toLocaleString('fr-FR');
    if (profileBiggestWin) profileBiggestWin.textContent = `${(Number(u?.biggest_win) || 0).toLocaleString('fr-FR')} 🪙`;
    if (profileTotalWon) profileTotalWon.textContent = `${(Number(u?.total_won) || 0).toLocaleString('fr-FR')} 🪙`;
    const streak = Number(u?.daily_streak) || 0;
    if (profileStreak) profileStreak.textContent = `${streak} jour${streak > 1 ? 's' : ''}`;
    if (profileStatWager) profileStatWager.textContent = `${(Number(u?.total_wagered) || 0).toLocaleString('fr-FR')} 🪙`;

    // Progression VIP
    const totalWageredEl = document.getElementById('profileTotalWagered');
    const vipTierNameEl = document.getElementById('profileVipTierName');
    const vipBadgeEl = document.getElementById('profileVipBadge');
    const vipAvatarEl = document.getElementById('profileVipAvatar');
    const vipMultiplierEl = document.getElementById('profileVipMultiplier');
    const vipProgressFill = document.getElementById('profileVipProgressFill');
    const vipProgressPercent = document.getElementById('profileVipProgressPercent');
    const vipNextTierText = document.getElementById('profileVipNextTierText');

    if (totalWageredEl) totalWageredEl.textContent = `${(Number(u?.total_wagered) || 0).toLocaleString('fr-FR')} 🪙`;
    if (vipTierNameEl) vipTierNameEl.textContent = `VIP ${(currentTier?.name || 'BRONZE').toUpperCase()}`;
    if (vipBadgeEl) {
      vipBadgeEl.className = `vip-badge ${currentTier?.badgeClass || 'vip-bronze'}`;
      vipBadgeEl.textContent = `${currentTier?.icon || '🥉'} ${(currentTier?.name || 'BRONZE').toUpperCase()}`;
    }
    if (vipAvatarEl) {
      vipAvatarEl.textContent = currentTier?.icon || '🥉';
      vipAvatarEl.style.borderColor = currentTier?.color || '#CD7F32';
    }
    const perkText = currentTier?.perk || (Array.isArray(currentTier?.perks) ? currentTier.perks[0] : '') || 'Statut VIP standard';
    if (vipMultiplierEl) {
      vipMultiplierEl.textContent = `Bonus Quotidien x${currentTier?.bonusMultiplier ?? 1.0} (${perkText})`;
    }
    const progress = Math.min(100, Math.max(0, Number(vip?.progressPercent) || 0));
    if (vipProgressFill) {
      vipProgressFill.style.width = `${progress}%`;
    }
    if (vipProgressPercent) {
      vipProgressPercent.textContent = `Progression : ${progress}%`;
    }
    if (vipNextTierText) {
      if (vip?.nextTier?.name) {
        const needed = (Number(vip?.wagerNeeded) || 0).toLocaleString('fr-FR');
        vipNextTierText.textContent = `Encore ${needed} 🪙 de mises vers ${vip.nextTier.name}`;
      } else {
        vipNextTierText.textContent = '👑 Rang VIP Maximum Atteint !';
      }
    }

    // Mise à jour de la roadmap VIP
    document.querySelectorAll('#profileVipRoadmap .vip-roadmap-tier').forEach(tierEl => {
      const tierName = tierEl.dataset.tier;
      if (tierName && currentTier?.name && tierName.toLowerCase() === currentTier.name.toLowerCase()) {
        tierEl.classList.add('active');
      } else {
        tierEl.classList.remove('active');
      }
    });

    // Rafraîchir le compte à rebours de la roue quotidienne
    if (window.FreeWheelGame && typeof window.FreeWheelGame.fetchStatus === 'function') {
      try { window.FreeWheelGame.fetchStatus(); } catch (e) { /* ignore */ }
    }

    // Historique des parties
    const histTable = document.getElementById('profileHistoryList');
    if (histTable) {
      const historyList = Array.isArray(data?.history) ? data.history : [];
      if (historyList.length === 0) {
        histTable.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1.5rem; color:var(--text-muted);">Aucune partie enregistrée pour le moment.</td></tr>';
      } else {
        histTable.innerHTML = historyList.map(h => {
          const profit = Number(h?.profit) || 0;
          const bet = Number(h?.bet) || 0;
          const payout = Number(h?.payout) || 0;
          const isWin = profit > 0;
          const isTie = profit === 0;
          const label = typeof gameLabel === 'function' ? gameLabel(h?.game_type) : (h?.game_type || 'Partie');
          const dateStr = typeof formatDate === 'function' ? formatDate(h?.created_at) : (h?.created_at || '-');

          return `
            <tr>
              <td><strong>${label}</strong></td>
              <td>${bet > 0 ? bet.toLocaleString('fr-FR') + ' 🪙' : '-'}</td>
              <td>${payout.toLocaleString('fr-FR')} 🪙</td>
              <td style="color: ${isWin ? 'var(--win-green)' : (isTie ? 'var(--text-muted)' : 'var(--lose-red)')}; font-weight: bold;">
                ${profit > 0 ? '+' : ''}${profit.toLocaleString('fr-FR')} 🪙
              </td>
              <td style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Demandes de livraison directe et lots physiques
    if (window.FortuneWheels && typeof window.FortuneWheels.renderProfileRewardsList === 'function') {
      try {
        window.FortuneWheels.renderProfileRewardsList();
      } catch (e) {
        console.warn('Erreur FortuneWheels.renderProfileRewardsList:', e);
      }
    } else {
      const ordersListEl = document.getElementById('profileOrdersList');
      if (ordersListEl) {
        const deliveries = Array.isArray(data?.deliveries) ? data.deliveries : (Array.isArray(data?.orders) ? data.orders : []);
        if (deliveries.length === 0) {
          ordersListEl.innerHTML = '<p style="color: var(--text-muted); padding:1rem;">Aucune demande de livraison pour l’instant.</p>';
        } else {
          ordersListEl.innerHTML = deliveries.map(o => {
            const isDelivered = o?.status === 'delivered';
            const icon = o?.icon || '🎁';
            const itemName = typeof escapeHtml === 'function' ? escapeHtml(o?.item_name || 'Produit') : (o?.item_name || 'Produit');
            const room = typeof escapeHtml === 'function' ? escapeHtml(o?.room_location || 'À préciser') : (o?.room_location || 'À préciser');

            return `
              <div class="reward-ticket-card ${isDelivered ? 'status-collected' : 'status-pending'}">
                <div class="reward-ticket-header">
                  <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span class="reward-ticket-icon">${icon}</span>
                    <div class="reward-ticket-title">${itemName}</div>
                  </div>
                  <span class="reward-status-pill ${isDelivered ? 'status-collected' : 'status-pending'}">
                    ${isDelivered ? '✅ Livré' : '⏳ À livrer'}
                  </span>
                </div>
                <div style="font-size:0.8rem; color:var(--gold-light); margin-top:0.4rem;">
                  📍 Lieu : ${room}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }

    // Charger les codes promo déjà activés par l'élève
    try {
      loadMyPromoCodes();
    } catch (e) {
      console.warn('Erreur loadMyPromoCodes:', e);
    }

    // Masquer le chargement et afficher le contenu
    if (loadingState) loadingState.style.display = 'none';
    if (contentContainer) contentContainer.style.display = 'flex';

  } catch (err) {
    console.error('Erreur profil complète:', err);
    if (loadingState) {
      loadingState.style.display = 'block';
      loadingState.innerHTML = `
        <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
        <h3 style="color:#EF4444; font-family:var(--font-display); font-size:1.3rem; margin-bottom:0.5rem;">
          Impossible de charger le profil
        </h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
          ${escapeHtml(err.message || 'Une erreur est survenue lors de la communication avec le serveur.')}
        </p>
        <button class="btn btn-gold" onclick="loadProfile()">🔄 Réessayer</button>
      `;
    }
    if (contentContainer) contentContainer.style.display = 'none';
    window.UI?.showToast(err.message || 'Erreur chargement profil', 'error');
  }
}

async function loadMyPromoCodes() {
  const box = document.getElementById('myRedeemedCodesBox');
  const listEl = document.getElementById('myRedeemedCodesList');
  if (!listEl) return;

  try {
    const data = await window.API.getMyPromoCodes();
    const codes = data.redemptions || [];
    if (codes.length === 0) {
      if (box) box.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }

    if (box) box.style.display = 'block';
    listEl.innerHTML = codes.map(c => `
      <div style="background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.3); border-radius:var(--radius-sm); padding:4px 10px; font-size:0.8rem; display:flex; align-items:center; gap:0.4rem;">
        <span style="font-family:var(--font-mono); font-weight:700; color:var(--gold-light);">${escapeHtml(c.code)}</span>
        <span style="color:#34D399; font-weight:700;">+${c.coins_awarded.toLocaleString()} 🪙</span>
        <span style="color:var(--text-muted); font-size:0.75rem;">(${formatDate(c.used_at)})</span>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Erreur chargement codes activés:', err);
  }
}

// Initialiser l'écouteur du formulaire de rédemption de code promo
document.addEventListener('DOMContentLoaded', () => {
  const formPromo = document.getElementById('formRedeemPromo');
  const inputPromo = document.getElementById('inputPromoCode');
  const msgEl = document.getElementById('promoRedeemMessage');
  const btnPromo = document.getElementById('btnRedeemPromo');

  if (formPromo) {
    formPromo.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = inputPromo ? inputPromo.value.trim() : '';
      if (!code) return;

      if (!window.State.isAuthenticated) {
        window.UI.showToast('Connecte-toi pour activer un code promo.', 'error');
        window.UI.openAuthModal('login');
        return;
      }

      if (btnPromo) btnPromo.disabled = true;
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(59,130,246,0.15)';
        msgEl.style.border = '1px solid rgba(59,130,246,0.3)';
        msgEl.style.color = '#93C5FD';
        msgEl.textContent = 'Vérification du code en cours...';
      }

      try {
        const res = await window.API.redeemPromoCode(code);

        // Succès
        if (msgEl) {
          msgEl.style.background = 'rgba(16,185,129,0.15)';
          msgEl.style.border = '1px solid #10B981';
          msgEl.style.color = '#34D399';
          msgEl.innerHTML = `🎉 <strong>FÉLICITATIONS !</strong> Code <code>${escapeHtml(res.code)}</code> validé avec succès ! Tu as reçu <strong>+${res.coinsAdded.toLocaleString()} 🪙</strong> !`;
        }

        // Effets sonores et visuels
        if (window.sound && typeof window.sound.playWin === 'function') window.sound.playWin();
        if (window.UI && typeof window.UI.launchConfetti === 'function') window.UI.launchConfetti();

        // Mettre à jour le solde utilisateur
        if (window.State) {
          if (typeof window.State.updateUser === 'function') {
            window.State.updateUser({ coins: res.newCoins });
          } else if (typeof window.State.updateCoins === 'function') {
            window.State.updateCoins(res.newCoins);
          }
        }

        window.UI.showToast(`+${res.coinsAdded.toLocaleString()} 🪙 crédités sur ton solde !`, 'success');
        if (inputPromo) inputPromo.value = '';
        loadMyPromoCodes();
      } catch (err) {
        if (msgEl) {
          msgEl.style.background = 'rgba(239,68,68,0.15)';
          msgEl.style.border = '1px solid #EF4444';
          msgEl.style.color = '#FCA5A5';
          msgEl.innerHTML = `❌ <strong>Erreur :</strong> ${escapeHtml(err.message || 'Code promo invalide.')}`;
        }
        window.UI.showToast(err.message, 'error');
      } finally {
        if (btnPromo) btnPromo.disabled = false;
      }
    });
  }
});

// Gestion globale de la modale de demande de livraison directe BDE (Lots remportés aux roues)
window.openDeliveryModal = function (options) {
  const modal = document.getElementById('deliveryRequestModal');
  if (!modal) return;

  const srcInput = document.getElementById('deliverySource');
  const prodIdInput = document.getElementById('deliveryProductId');
  const variantInput = document.getElementById('deliveryVariantName');
  const orderIdInput = document.getElementById('deliveryOrderId');

  const iconEl = document.getElementById('deliveryModalIcon');
  const titleEl = document.getElementById('deliveryModalTitle');
  const subtitleEl = document.getElementById('deliveryModalSubtitle');
  const itemEl = document.getElementById('deliveryModalItemName');
  const varEl = document.getElementById('deliveryModalItemVariant');
  const qtyEl = document.getElementById('deliveryModalQuantity');
  const costEl = document.getElementById('deliveryModalCost');

  if (srcInput) srcInput.value = options.source || 'wheel';
  if (prodIdInput) prodIdInput.value = options.productId || '';
  if (variantInput) variantInput.value = options.variantName || '';
  if (orderIdInput) orderIdInput.value = options.orderId || '';

  if (iconEl) iconEl.textContent = options.icon || '🥤';
  if (itemEl) itemEl.textContent = options.productName || 'Lot BDE';
  if (qtyEl) qtyEl.textContent = options.quantity || 1;

  if (varEl) {
    if (options.variantName) {
      varEl.textContent = `Variante : ${options.variantName}`;
      varEl.style.display = 'block';
    } else {
      varEl.style.display = 'none';
    }
  }

  if (titleEl) titleEl.textContent = 'Demande de Livraison Directe (Lot Roue BDE)';
  if (subtitleEl) subtitleEl.textContent = 'Félicitations pour ton lot ! Indique ta salle pour que le BDE te l\'apporte.';
  if (costEl) costEl.textContent = '🎉 Lot Gagné aux Roues !';

  // Pré-remplir les champs avec l'identité officielle enregistrée à l'inscription (verrouillée)
  const lastNameInput = document.getElementById('deliveryLastName');
  const firstNameInput = document.getElementById('deliveryFirstName');
  const phoneInput = document.getElementById('deliveryPhone');
  const roomInput = document.getElementById('deliveryRoomLocation');
  const notesInput = document.getElementById('deliveryNotes');

  const registeredUser = window.State && window.State.user;
  const regLastName = registeredUser ? (registeredUser.last_name || '').trim() : '';
  const regFirstName = registeredUser ? (registeredUser.first_name || '').trim() : '';

  if (regLastName || regFirstName) {
    if (lastNameInput) {
      lastNameInput.value = regLastName;
      lastNameInput.readOnly = true;
      lastNameInput.style.backgroundColor = 'rgba(255,255,255,0.06)';
      lastNameInput.style.cursor = 'not-allowed';
      lastNameInput.title = 'Identité officielle enregistrée à l\'inscription (verrouillée)';
    }
    if (firstNameInput) {
      firstNameInput.value = regFirstName;
      firstNameInput.readOnly = true;
      firstNameInput.style.backgroundColor = 'rgba(255,255,255,0.06)';
      firstNameInput.style.cursor = 'not-allowed';
      firstNameInput.title = 'Identité officielle enregistrée à l\'inscription (verrouillée)';
    }
  } else {
    if (lastNameInput) {
      lastNameInput.value = localStorage.getItem('marsabet_last_name') || '';
      lastNameInput.readOnly = false;
      lastNameInput.style.backgroundColor = '';
      lastNameInput.style.cursor = '';
    }
    if (firstNameInput) {
      firstNameInput.value = localStorage.getItem('marsabet_first_name') || '';
      firstNameInput.readOnly = false;
      firstNameInput.style.backgroundColor = '';
      firstNameInput.style.cursor = '';
    }
  }

  if (phoneInput && !phoneInput.value) {
    phoneInput.value = localStorage.getItem('marsabet_phone') || '';
  }
  if (roomInput && !roomInput.value) {
    roomInput.value = localStorage.getItem('marsabet_last_room') || '';
  }
  if (notesInput) {
    notesInput.value = '';
  }

  modal.classList.add('active');
};

window.closeDeliveryModal = function () {
  const modal = document.getElementById('deliveryRequestModal');
  const notesInput = document.getElementById('deliveryNotes');
  if (notesInput) notesInput.value = '';
  if (modal) modal.classList.remove('active');
};

// Écouteurs de fermeture et soumission de la modale de livraison
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('deliveryRequestModal');
  const closeBtn = document.getElementById('closeDeliveryModalBtn');
  const cancelBtn = document.getElementById('cancelDeliveryBtn');
  const formDelivery = document.getElementById('formDeliveryRequest');

  if (closeBtn) closeBtn.addEventListener('click', () => window.closeDeliveryModal());
  if (cancelBtn) cancelBtn.addEventListener('click', () => window.closeDeliveryModal());
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) window.closeDeliveryModal();
    });
  }

  if (formDelivery) {
    formDelivery.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('confirmDeliveryBtn');
      const orderId = document.getElementById('deliveryOrderId')?.value;

      const lastName = document.getElementById('deliveryLastName')?.value.trim();
      const firstName = document.getElementById('deliveryFirstName')?.value.trim();
      const roomLocation = document.getElementById('deliveryRoomLocation')?.value.trim();
      const phone = document.getElementById('deliveryPhone')?.value.trim();
      const notes = document.getElementById('deliveryNotes')?.value.trim() || null;

      if (!lastName || !firstName || !roomLocation) {
        window.UI.showToast('Le nom, prénom et la salle sont obligatoires.', 'error');
        return;
      }

      // Sauvegarder dans localStorage pour le confort de l'élève
      localStorage.setItem('marsabet_last_name', lastName);
      localStorage.setItem('marsabet_first_name', firstName);
      localStorage.setItem('marsabet_last_room', roomLocation);
      if (phone) localStorage.setItem('marsabet_phone', phone);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours... ⏳';
      }

      try {
        const res = await window.API.confirmWheelDelivery({
          orderId,
          lastName,
          firstName,
          roomLocation,
          phone,
          notes
        });

        window.closeDeliveryModal();
        window.UI.showToast(res.message || 'Demande de livraison confirmée ! Un membre du BDE t\'apportera ton lot.', 'success', 5000);
        if (window.sound && typeof window.sound.playWin === 'function') window.sound.playWin();

        if (window.FortuneWheels && typeof window.FortuneWheels.loadMyRewards === 'function') {
          window.FortuneWheels.loadMyRewards();
        }
      } catch (err) {
        console.error('Erreur confirmation livraison:', err);
        window.UI.showToast(err.message || 'Erreur lors de la confirmation.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmer la demande 🚀';
        }
      }
    });
  }
});

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

if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  };
}
var escapeHtml = window.escapeHtml;

// ========================================================
// GESTION DES ANNONCES OFFICIELLES BDE (MODAL BLOQUANTE ÉLÈVE)
// ========================================================
const AnnouncementManager = {
  queue: [],
  currentIndex: 0,

  async check() {
    if (!window.State || !window.State.isAuthenticated) return;
    try {
      const res = await window.API.getUnreadAnnouncements();
      if (res && Array.isArray(res.announcements) && res.announcements.length > 0) {
        this.queue = res.announcements;
        this.currentIndex = 0;
        this.showCurrent();
      }
    } catch (e) {
      console.error('Erreur vérification des annonces:', e);
    }
  },

  showCurrent() {
    const modal = document.getElementById('studentAnnouncementModal');
    if (!modal) return;

    if (this.currentIndex >= this.queue.length) {
      modal.classList.remove('active');
      return;
    }

    const current = this.queue[this.currentIndex];
    const counterEl = document.getElementById('studentAnnounceCounter');
    const titleEl = document.getElementById('studentAnnounceTitle');
    const contentEl = document.getElementById('studentAnnounceContent');
    const acknowledgeBtn = document.getElementById('btnAcknowledgeAnnouncement');

    if (counterEl) {
      if (this.queue.length > 1) {
        counterEl.style.display = 'inline-block';
        counterEl.textContent = `Annonce ${this.currentIndex + 1} sur ${this.queue.length}`;
      } else {
        counterEl.style.display = 'none';
      }
    }

    if (titleEl) titleEl.textContent = current.title || 'Annonce BDE';
    if (contentEl) contentEl.textContent = current.content || '';

    if (acknowledgeBtn) {
      acknowledgeBtn.disabled = false;
      acknowledgeBtn.textContent = (this.currentIndex + 1 < this.queue.length) ? "J'ai compris ▶ (Suivant)" : "J'ai compris 👍";
    }

    modal.classList.add('active');
  },

  async acknowledgeCurrent() {
    if (this.currentIndex >= this.queue.length) {
      const modal = document.getElementById('studentAnnouncementModal');
      if (modal) modal.classList.remove('active');
      return;
    }

    const current = this.queue[this.currentIndex];
    const acknowledgeBtn = document.getElementById('btnAcknowledgeAnnouncement');
    if (acknowledgeBtn) {
      acknowledgeBtn.disabled = true;
      acknowledgeBtn.textContent = 'Validation... ⏳';
    }

    try {
      await window.API.markAnnouncementRead(current.id);
    } catch (e) {
      console.error('Erreur acquittement annonce:', e);
    }

    this.currentIndex++;
    if (this.currentIndex < this.queue.length) {
      this.showCurrent();
    } else {
      const modal = document.getElementById('studentAnnouncementModal');
      if (modal) modal.classList.remove('active');
    }
  }
};

window.AnnouncementManager = AnnouncementManager;

document.addEventListener('DOMContentLoaded', () => {
  const acknowledgeBtn = document.getElementById('btnAcknowledgeAnnouncement');
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', () => {
      window.AnnouncementManager.acknowledgeCurrent();
    });
  }
});

window.loadLeaderboard = loadLeaderboard;
window.loadProfile = loadProfile;
window.loadGlobalStats = loadGlobalStats;
window.gameLabel = gameLabel;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;


