// Marsabet Front-End Router — HTML5 History API & Direct URL Routes

const Router = {
  routes: {
    '/': 'lobby',
    '/lobby': 'lobby',
    '/jeux': 'games',
    '/roues': 'wheels',
    '/classement': 'leaderboard',
    '/boutique': 'wheels',
    '/profil': 'profile',
    '/codes': 'profile',
    '/recompenses': 'rewards',
    '/jeux/machine-a-sous': 'slots',
    '/jeux/blackjack': 'blackjack',
    '/jeux/roulette': 'roulette',
    '/jeux/des': 'dice',
    '/jeux/slider': 'slider',
    '/jeux/crash': 'crash',
    '/jeux/roue': 'wheel',
    '/jeux/roue-quotidienne': 'free-wheel',
    '/jeux/plinko': 'plinko',
    '/jeux/video-poker': 'video-poker',
    '/jeux/dragon-tower': 'dragon-tower',
    '/admin': 'admin'
  },

  viewToPath: {
    'lobby': '/lobby',
    'games': '/jeux',
    'wheels': '/roues',
    'wheel-arena': '/roues',
    'rewards': '/recompenses',
    'leaderboard': '/classement',
    'shop': '/roues',
    'profile': '/profil',
    'slots': '/jeux/machine-a-sous',
    'blackjack': '/jeux/blackjack',
    'roulette': '/jeux/roulette',
    'dice': '/jeux/des',
    'slider': '/jeux/slider',
    'crash': '/jeux/crash',
    'wheel': '/jeux/roue',
    'free-wheel': '/jeux/roue-quotidienne',
    'plinko': '/jeux/plinko',
    'video-poker': '/jeux/video-poker',
    'dragon-tower': '/jeux/dragon-tower',
    'admin': '/admin'
  },

  init() {
    // Intercepter l'événement popstate (Retour / Avancer dans l'historique du navigateur)
    window.addEventListener('popstate', (e) => {
      this.handleRoute(window.location.pathname, false);
    });

    // Intercepter les clics sur les liens internes et boutons de navigation
    document.addEventListener('click', (e) => {
      // Éléments avec data-route ou data-view ou lien interne
      const link = e.target.closest('a[href^="/"], [data-route], [data-view], [data-game], .btn-back-lobby');
      if (!link) return;

      // Ignorer si clic molette ou avec touches modificatrices
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Bouton retour lobby
      if (link.classList.contains('btn-back-lobby')) {
        e.preventDefault();
        this.navigate('/lobby');
        return;
      }

      // Lien navigation nav-link ou data-view
      const view = link.dataset.view;
      if (view && this.viewToPath[view]) {
        e.preventDefault();
        this.navigate(this.viewToPath[view]);
        return;
      }

      // Carte de jeu avec data-game
      const game = link.dataset.game;
      if (game && this.viewToPath[game]) {
        e.preventDefault();
        this.navigate(this.viewToPath[game]);
        return;
      }

      // Attribut href standard (ex: <a href="/classement">)
      if (link.tagName === 'A') {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api') && !href.endsWith('.css') && !href.endsWith('.js')) {
          e.preventDefault();
          this.navigate(href);
        }
      }
    });

    // Résoudre la route actuelle dès l'initialisation
    this.handleRoute(window.location.pathname, true);
  },

  resolveRoute(path) {
    const cleanPath = this.normalizePath(path);
    if (this.routes[cleanPath]) {
      return { path: cleanPath, view: this.routes[cleanPath], param: null };
    }
    // Matcher dynamique pour /roues/:id
    if (cleanPath.startsWith('/roues/')) {
      const wheelId = cleanPath.replace('/roues/', '').trim();
      if (wheelId) {
        return { path: cleanPath, view: 'wheel-arena', param: wheelId };
      }
    }
    return { path: '/lobby', view: 'lobby', param: null };
  },

  navigate(path, replace = false) {
    const routeInfo = this.resolveRoute(path);

    if (window.location.pathname !== routeInfo.path) {
      if (replace) {
        window.history.replaceState({ path: routeInfo.path, view: routeInfo.view, param: routeInfo.param }, '', routeInfo.path);
      } else {
        window.history.pushState({ path: routeInfo.path, view: routeInfo.view, param: routeInfo.param }, '', routeInfo.path);
      }
    }

    this.renderView(routeInfo.view, false, routeInfo.param);
  },

  handleRoute(path, isInitial = false) {
    const cleanPath = this.normalizePath(path);
    const routeInfo = this.resolveRoute(cleanPath);

    // Normaliser l'URL si inconnue
    if (routeInfo.path === '/lobby' && cleanPath !== '/' && cleanPath !== '/lobby') {
      window.history.replaceState({ path: '/lobby', view: 'lobby' }, '', '/lobby');
    }

    this.renderView(routeInfo.view, isInitial, routeInfo.param);
  },

  normalizePath(path) {
    if (!path) return '/';
    let p = path.split('?')[0].split('#')[0];
    if (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
    return p || '/';
  },

  renderView(viewName, isInitial = false, param = null) {
    if (!window.UI) return;
    window.UI.switchView(viewName);

    // Déclencher les chargeurs de données selon la vue
    if (viewName === 'leaderboard' && typeof window.loadLeaderboard === 'function') {
      window.loadLeaderboard();
    } else if (viewName === 'profile' && typeof window.loadProfile === 'function') {
      window.loadProfile();
      if (window.location.pathname === '/codes') {
        setTimeout(() => {
          const promoCard = document.getElementById('profilePromoCard');
          const promoInput = document.getElementById('inputPromoCode');
          if (promoCard) promoCard.scrollIntoView({ behavior: 'smooth' });
          if (promoInput) promoInput.focus();
        }, 200);
      }
    } else if (viewName === 'rewards' && window.FortuneWheels) {
      window.FortuneWheels.loadMyRewards();
    } else if (viewName === 'wheels' && window.FortuneWheels) {
      window.FortuneWheels.loadWheelsList();
    } else if (viewName === 'wheel-arena' && window.FortuneWheels) {
      window.FortuneWheels.loadWheelArena(param || 'quotidienne');
    } else if (viewName === 'free-wheel' && window.FreeWheelGame) {
      window.FreeWheelGame.fetchStatus();
    } else if (viewName === 'crash' && window.CrashGame) {
      window.CrashGame.resizeCanvas();
    } else if (viewName === 'video-poker' && window.VideoPokerGame) {
      window.VideoPokerGame.init();
    } else if (viewName === 'dragon-tower' && window.DragonTowerGame) {
      window.DragonTowerGame.init();
    } else if (viewName === 'admin' && window.AdminBDE) {
      window.AdminBDE.switchTab('orders');
    }

    // Mettre à jour l'état actif dans la barre de navigation
    document.querySelectorAll('.sidebar-link, .sidebar-sublink, .nav-link').forEach(link => {
      if (link.dataset.view === viewName || (viewName === 'wheel-arena' && link.dataset.view === 'wheels')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Mettre à jour le titre du document
    this.updateDocumentTitle(viewName, param);
  },

  updateDocumentTitle(viewName, param = null) {
    const titles = {
      'lobby': 'Marsabet — Casino Virtuel BDE Epitech',
      'games': 'Salle des Jeux — Marsabet Casino',
      'wheels': 'Roues de la Fortune — Marsabet',
      'wheel-arena': param ? `Roue ${param.toUpperCase()} — Marsabet` : 'Roue de la Fortune — Marsabet',
      'rewards': 'Mes Récompenses BDE — Marsabet',
      'leaderboard': 'Classement des Joueurs — Marsabet',
      'profile': 'Mon Profil & Statut VIP — Marsabet',
      'blackjack': 'Table de Blackjack — Marsabet',
      'roulette': 'Roulette Européenne — Marsabet',
      'dice': 'Jeu de Dés (Craps) — Marsabet',
      'slider': 'Slider Over/Under — Marsabet',
      'crash': 'Crash Galactique — Marsabet',
      'wheel': 'Roue de la Fortune — Marsabet',
      'free-wheel': 'Roue Quotidienne Gratuite — Marsabet',
      'plinko': 'Plinko Cosmique — Marsabet',
      'video-poker': 'Vidéo Poker Jacks or Better — Marsabet',
      'dragon-tower': 'Dragon Tower — Tour du Dragon — Marsabet',
      'admin': 'Administration BDE — Marsabet'
    };
    document.title = titles[viewName] || 'Marsabet — Casino Virtuel BDE';
  }
};

window.Router = Router;
