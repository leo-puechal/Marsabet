// Marsabet Global State Manager

const State = {
  user: null,
  isAuthenticated: false,
  isGameAnimating: false,
  pendingCoins: null,

  setUser(user) {
    this.user = user;
    this.isAuthenticated = !!user;
    this.updateUI();
  },

  // Déduire immédiatement la mise du solde affiché dès le clic sur le jeu
  deductBet(amount) {
    if (!this.user || !amount || amount <= 0) return;
    this.user.coins = Math.max(0, this.user.coins - amount);
    this.isGameAnimating = true;
    this.pendingCoins = null;
    this.updateUI();
  },

  // Activer ou désactiver l'état d'animation d'un jeu
  setGameAnimating(isAnimating, finalCoins = null) {
    if (isAnimating) {
      this.isGameAnimating = true;
      if (finalCoins !== null && finalCoins !== undefined) {
        this.pendingCoins = finalCoins;
      }
    } else {
      this.isGameAnimating = false;
      const target = (finalCoins !== null && finalCoins !== undefined) ? finalCoins : this.pendingCoins;
      this.pendingCoins = null;
      if (target !== null && target !== undefined && this.user) {
        const oldCoins = this.user.coins;
        this.user.coins = target;
        this.animateCoins(oldCoins, target);
        this.updateUI();
      }
    }
  },

  updateUser(partialUser) {
    if (!partialUser || typeof partialUser !== 'object') return;
    if (!this.user) {
      this.setUser(partialUser);
      return;
    }
    const oldCoins = this.user.coins;
    // Si une animation de jeu est en cours, ne pas spoiler le solde
    if (this.isGameAnimating && partialUser.coins !== undefined) {
      this.pendingCoins = partialUser.coins;
      const clone = { ...partialUser };
      delete clone.coins;
      Object.assign(this.user, clone);
      this.updateUI();
      return;
    }
    Object.assign(this.user, partialUser);
    if (partialUser.coins !== undefined && partialUser.coins !== oldCoins) {
      this.animateCoins(oldCoins, partialUser.coins);
    }
    this.updateUI();
  },

  updateCoins(newCoins) {
    if (!this.user) return;
    // Si une animation est en cours, stocker le résultat pour la fin de séquence
    if (this.isGameAnimating) {
      this.pendingCoins = newCoins;
      return;
    }
    const oldCoins = this.user.coins;
    this.user.coins = newCoins;
    this.animateCoins(oldCoins, newCoins);
  },

  animateCoins(from, to) {
    const el = document.getElementById('userCoinsDisplay');
    const landingEl = document.getElementById('landingCoinsDisplay');
    const sidebarEl = document.getElementById('sidebarCoinsDisplay');
    const mobileEl = document.getElementById('mobileCoinsDisplay');
    const equivEl = document.getElementById('landingEquivalentDisplay');

    const updateAll = (val) => {
      const formatted = val.toLocaleString();
      if (el) el.textContent = formatted;
      if (landingEl) landingEl.textContent = formatted;
      if (sidebarEl) sidebarEl.textContent = formatted;
      if (mobileEl) mobileEl.textContent = formatted;
    };

    const diff = to - from;
    if (diff === 0) {
      updateAll(to);
      return;
    }

    const duration = 600;
    const start = performance.now();

    function step(timestamp) {
      const progress = Math.min((timestamp - start) / duration, 1);
      const current = Math.floor(from + (diff * progress));
      updateAll(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        updateAll(to);
      }
    }

    requestAnimationFrame(step);
  },

  updateUI() {
    const coinsDisplay = document.getElementById('userCoinsDisplay');
    const landingCoins = document.getElementById('landingCoinsDisplay');
    const landingEquiv = document.getElementById('landingEquivalentDisplay');
    const landingVip = document.getElementById('landingVipDisplay');
    const sidebarCoins = document.getElementById('sidebarCoinsDisplay');
    const mobileCoins = document.getElementById('mobileCoinsDisplay');

    const authBtn = document.getElementById('headerAuthBtn');
    const userMenu = document.getElementById('headerUserMenu');
    const headerUsername = document.getElementById('headerUsername');
    const adminNavLink = document.getElementById('navLinkAdmin');

    const sidebarUserCard = document.getElementById('sidebarUserCard');
    const sidebarGuestCard = document.getElementById('sidebarGuestCard');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserVipBadge = document.getElementById('sidebarUserVipBadge');
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    const sidebarAdminItem = document.getElementById('sidebarAdminItem');

    if (this.isAuthenticated && this.user) {
      const formattedCoins = this.user.coins.toLocaleString();

      if (coinsDisplay) coinsDisplay.textContent = formattedCoins;
      if (landingCoins) landingCoins.textContent = formattedCoins;
      if (sidebarCoins) sidebarCoins.textContent = formattedCoins;
      if (mobileCoins) mobileCoins.textContent = formattedCoins;
      if (landingEquiv) landingEquiv.textContent = '🪙 Monnaie virtuelle 100% gratuite';

      if (authBtn) authBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (sidebarGuestCard) sidebarGuestCard.style.display = 'none';
      if (sidebarUserCard) sidebarUserCard.style.display = 'flex';
      if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'flex';

      const vip = this.user.vipInfo?.currentTier || { name: 'Bronze', icon: '🥉', badgeClass: 'vip-bronze' };
      if (landingVip) landingVip.textContent = `${vip.icon} ${vip.name}`;

      if (headerUsername) {
        headerUsername.textContent = this.user.username;
        if (this.user.role === 'admin' || this.user.role === 'bde') {
          headerUsername.innerHTML = `${(window.escapeHtml ? window.escapeHtml(this.user.username) : "")} <span style="font-size:0.7rem; background:#EF4444; color:#FFF; padding:2px 6px; border-radius:99px; margin-left:4px;">BDE</span>`;
        }
      }
      if (sidebarUserName) {
        sidebarUserName.textContent = this.user.username;
        if (this.user.role === 'admin' || this.user.role === 'bde') {
          sidebarUserName.innerHTML = `${(window.escapeHtml ? window.escapeHtml(this.user.username) : "")} <span style="font-size:0.65rem; background:#EF4444; color:#FFF; padding:1px 5px; border-radius:99px; margin-left:3px;">BDE</span>`;
        }
      }

      const vipBadge = document.getElementById('headerUserVipBadge');
      if (vipBadge) {
        vipBadge.className = `vip-badge ${vip.badgeClass}`;
        vipBadge.textContent = `${vip.icon} ${vip.name.toUpperCase()}`;
      }
      if (sidebarUserVipBadge) {
        sidebarUserVipBadge.className = `vip-badge ${vip.badgeClass}`;
        sidebarUserVipBadge.textContent = `${vip.icon} ${vip.name.toUpperCase()}`;
      }

      const isAdmin = this.user.role === 'admin' || this.user.role === 'bde';
      if (adminNavLink) adminNavLink.style.display = isAdmin ? 'inline-flex' : 'none';
      if (sidebarAdminItem) sidebarAdminItem.style.display = isAdmin ? 'list-item' : 'none';
      const profileAdminBox = document.getElementById('profileAdminBox');
      if (profileAdminBox) profileAdminBox.style.display = isAdmin ? 'flex' : 'none';

      // Actualiser le statut du bouton de bonus quotidien
      const dailyBtn = document.getElementById('claimDailyBtn');
      if (dailyBtn) {
        if (this.user.canClaimDaily) {
          dailyBtn.disabled = false;
          dailyBtn.textContent = '🎁 Réclamer mon Bonus !';
          dailyBtn.classList.add('pulse');
        } else {
          dailyBtn.disabled = true;
          dailyBtn.textContent = '✅ Bonus déjà reçu aujourd’hui';
          dailyBtn.classList.remove('pulse');
        }
      }

      // Actualiser streak dots
      this.updateStreakDots(this.user.daily_streak || 0);
    } else {
      if (coinsDisplay) coinsDisplay.textContent = '0';
      if (landingCoins) landingCoins.textContent = '0';
      if (sidebarCoins) sidebarCoins.textContent = '0';
      if (mobileCoins) mobileCoins.textContent = '0';
      if (landingEquiv) landingEquiv.textContent = '🪙 Monnaie virtuelle 100% gratuite';
      if (landingVip) landingVip.textContent = '🥉 Bronze';

      if (authBtn) authBtn.style.display = 'inline-flex';
      if (userMenu) userMenu.style.display = 'none';
      if (sidebarGuestCard) sidebarGuestCard.style.display = 'block';
      if (sidebarUserCard) sidebarUserCard.style.display = 'none';
      if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'none';
      if (adminNavLink) adminNavLink.style.display = 'none';
      if (sidebarAdminItem) sidebarAdminItem.style.display = 'none';
      const profileAdminBox = document.getElementById('profileAdminBox');
      if (profileAdminBox) profileAdminBox.style.display = 'none';

      this.updateStreakDots(0);
    }
  },

  updateStreakDots(streak) {
    const dots = document.querySelectorAll('.streak-dot');
    dots.forEach((dot, index) => {
      if (index < streak) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
};

window.State = State;
