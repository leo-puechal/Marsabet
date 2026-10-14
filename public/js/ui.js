// Marsabet UI Utilities — Enhanced Modals, Confetti & Navigation Sync

const UI = {
  // Toasts
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span style="font-size:1.15rem;">${icon}</span> <div style="flex:1;">${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(110%)';
      toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Modal Auth
  openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');

    if (!modal) return;
    modal.classList.add('active');

    if (mode === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
      const userInp = document.getElementById('loginUsername');
      if (userInp) setTimeout(() => userInp.focus(), 100);
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
      const regInp = document.getElementById('regUsername');
      if (regInp) setTimeout(() => regInp.focus(), 100);
    }
  },

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
  },

  // Confetti Canvas animation (Enhanced Luxury Gold & Ribbons)
  triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#D4AF37', '#FFE27A', '#FFF4C2', '#38BDF8', '#10B981', '#F43F5E', '#C084FC'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 120,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.8) * 18,
        size: Math.random() * 9 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 12,
        alpha: 1,
        isCircle: Math.random() > 0.7
      });
    }

    let frame = 0;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99; // air resistance
        p.vy += 0.28; // gravity
        p.rotation += p.spin;
        p.alpha -= 0.01;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          if (p.isCircle) {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
          }
          ctx.restore();
        }
      });

      frame++;
      if (alive && frame < 170) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(render);
  },

  // Switch views
  switchView(viewName, updateUrl = true) {
    if (viewName === 'admin') {
      const isAuth = !!(window.State && window.State.isAuthenticated);
      const isAdmin = !!(isAuth && window.State.user && (window.State.user.role === 'admin' || window.State.user.role === 'bde'));

      if (!isAdmin) {
        if (!isAuth) {
          this.showToast('Accès restreint. Veuillez vous connecter avec un compte Administrateur BDE.', 'error', 4500);
          setTimeout(() => this.openAuthModal('login'), 350);
        } else {
          this.showToast('Accès interdit. Cette section est strictement réservée aux membres du BDE.', 'error', 4500);
        }

        viewName = 'lobby';
        if (updateUrl && window.Router) {
          window.Router.navigate('/lobby', true);
        }
      }
    }

    const views = document.querySelectorAll('.section-view');
    views.forEach(v => v.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (viewName === 'crash' && window.CrashGame && typeof window.CrashGame.onShow === 'function') {
        window.CrashGame.onShow();
      } else if (viewName === 'video-poker' && window.VideoPokerGame) {
        window.VideoPokerGame.init();
      } else if (viewName === 'dragon-tower' && window.DragonTowerGame) {
        window.DragonTowerGame.init();
      } else if (viewName === 'events' && window.EventsManager) {
        window.EventsManager.init();
      }
    }

    if (updateUrl && window.Router && window.Router.viewToPath[viewName]) {
      const targetPath = window.Router.viewToPath[viewName];
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ path: targetPath, view: viewName }, '', targetPath);
      }
      if (window.Router.updateDocumentTitle) {
        window.Router.updateDocumentTitle(viewName);
      }
    }

    // Mettre à jour l'état actif dans la navbar et la sidebar
    const gameViews = ['games', 'slots', 'blackjack', 'roulette', 'dice', 'slider', 'crash', 'plinko', 'wheel', 'free-wheel', 'video-poker', 'dragon-tower'];
    document.querySelectorAll('.nav-link, .sidebar-link, .sidebar-sublink').forEach(l => {
      if (l.dataset.view === viewName) {
        l.classList.add('active');
      } else if (l.id === 'sidebarGamesToggle' && gameViews.includes(viewName)) {
        l.classList.add('active');
      } else {
        l.classList.remove('active');
      }
    });

    // Mettre à jour la barre inférieure mobile (Bottom Nav)
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
      if (b.dataset.view === viewName || (b.dataset.view === 'games' && gameViews.includes(viewName))) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }
};

// Fermeture globale des modales avec la touche Escape ou clic sur l'arrière-plan (Light Dismiss)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    e.target.classList.remove('active');
  }
});

window.UI = UI;
