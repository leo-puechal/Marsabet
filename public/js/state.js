// Marsabet Global State Manager

const State = {
  user: null,
  isAuthenticated: false,

  setUser(user) {
    this.user = user;
    this.isAuthenticated = !!user;
    this.updateUI();
  },

  updateCoins(newCoins) {
    if (this.user) {
      const oldCoins = this.user.coins;
      this.user.coins = newCoins;
      this.animateCoins(oldCoins, newCoins);
    }
  },

  animateCoins(from, to) {
    const el = document.getElementById('userCoinsDisplay');
    if (!el) return;

    const diff = to - from;
    if (diff === 0) {
      el.textContent = to.toLocaleString();
      return;
    }

    const duration = 600;
    const start = performance.now();

    function step(timestamp) {
      const progress = Math.min((timestamp - start) / duration, 1);
      const current = Math.floor(from + (diff * progress));
      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = to.toLocaleString();
      }
    }

    requestAnimationFrame(step);
  },

  updateUI() {
    const coinsDisplay = document.getElementById('userCoinsDisplay');
    const authBtn = document.getElementById('headerAuthBtn');
    const userMenu = document.getElementById('headerUserMenu');
    const headerUsername = document.getElementById('headerUsername');
    const adminNavLink = document.getElementById('navLinkAdmin');

    if (this.isAuthenticated && this.user) {
      if (coinsDisplay) coinsDisplay.textContent = this.user.coins.toLocaleString();
      if (authBtn) authBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (headerUsername) {
        headerUsername.textContent = this.user.username;
        if (this.user.role === 'admin') {
          headerUsername.innerHTML = `${this.user.username} <span style="font-size:0.7rem; background:#EF4444; color:#FFF; padding:2px 6px; border-radius:99px; margin-left:4px;">ADMIN</span>`;
        }
      }
      const vipBadge = document.getElementById('headerUserVipBadge');
      if (vipBadge) {
        const vip = this.user.vipInfo?.currentTier || { name: 'Bronze', icon: '🥉', badgeClass: 'vip-bronze' };
        vipBadge.className = `vip-badge ${vip.badgeClass}`;
        vipBadge.textContent = `${vip.icon} ${vip.name.toUpperCase()}`;
      }
      if (adminNavLink) {
        adminNavLink.style.display = (this.user.role === 'admin') ? 'inline-flex' : 'none';
      }

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
      if (authBtn) authBtn.style.display = 'inline-flex';
      if (userMenu) userMenu.style.display = 'none';
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
