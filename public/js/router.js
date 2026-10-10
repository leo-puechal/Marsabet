// Marsabet Front-End Router — HTML5 History API & Direct URL Routes

const Router = {
  routes: {
    '/': 'lobby',
    '/lobby': 'lobby',
    '/jeux': 'games',
    '/classement': 'leaderboard',
    '/boutique': 'shop',
    '/profil': 'profile',
    '/jeux/machine-a-sous': 'slots',
    '/jeux/blackjack': 'blackjack',
    '/jeux/roulette': 'roulette',
    '/jeux/des': 'dice',
    '/jeux/roue': 'wheel',
    '/jeux/roue-quotidienne': 'free-wheel',
    '/jeux/plinko': 'plinko',
    '/admin': 'admin'
  },

  viewToPath: {
    'lobby': '/lobby',
    'games': '/jeux',
    'leaderboard': '/classement',
    'shop': '/boutique',
    'profile': '/profil',
    'slots': '/jeux/machine-a-sous',
    'blackjack': '/jeux/blackjack',
    'roulette': '/jeux/roulette',
    'dice': '/jeux/des',
    'wheel': '/jeux/roue',
    'free-wheel': '/jeux/roue-quotidienne',
    'plinko': '/jeux/plinko',
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

  navigate(path, replace = false) {
    const cleanPath = this.normalizePath(path);
    const view = this.routes[cleanPath] || 'lobby';

    if (window.location.pathname !== cleanPath) {
      if (replace) {
        window.history.replaceState({ path: cleanPath, view }, '', cleanPath);
      } else {
        window.history.pushState({ path: cleanPath, view }, '', cleanPath);
      }
    }

    this.renderView(view);
  },

  handleRoute(path, isInitial = false) {
    const cleanPath = this.normalizePath(path);
    const view = this.routes[cleanPath] || 'lobby';

    // Normaliser l'URL si inconnue
    if (!this.routes[cleanPath] && cleanPath !== '/') {
      window.history.replaceState({ path: '/lobby', view: 'lobby' }, '', '/lobby');
    }

    this.renderView(view, isInitial);
  },

  normalizePath(path) {
    if (!path) return '/';
    let p = path.split('?')[0].split('#')[0];
    if (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
    return p || '/';
  },

  renderView(viewName, isInitial = false) {
    if (!window.UI) return;
    window.UI.switchView(viewName);

    // Déclencher les chargeurs de données selon la vue
    if (viewName === 'leaderboard' && typeof window.loadLeaderboard === 'function') {
      window.loadLeaderboard();
    } else if (viewName === 'profile' && typeof window.loadProfile === 'function') {
      window.loadProfile();
    } else if (viewName === 'shop' && typeof window.loadShop === 'function') {
      window.loadShop();
    } else if (viewName === 'free-wheel' && window.FreeWheelGame) {
      window.FreeWheelGame.fetchStatus();
    } else if (viewName === 'admin' && window.AdminBDE) {
      window.AdminBDE.switchTab('claims');
    }

    // Mettre à jour l'état actif dans la barre de navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Mettre à jour le titre du document
    this.updateDocumentTitle(viewName);
  },

  updateDocumentTitle(viewName) {
    const titles = {
      'lobby': 'Marsabet — Casino Virtuel BDE Epitech',
      'games': 'Salle des Jeux — Marsabet Casino',
      'leaderboard': 'Classement des Joueurs — Marsabet',
      'shop': 'Boutique Produits BDE — Marsabet',
      'profile': 'Mon Profil & Statut VIP — Marsabet',
      'slots': 'Machine à Sous Cosmique — Marsabet',
      'blackjack': 'Table de Blackjack — Marsabet',
      'roulette': 'Roulette Européenne — Marsabet',
      'dice': 'Jeu de Dés & Craps — Marsabet',
      'wheel': 'Roue de la Fortune — Marsabet',
      'free-wheel': 'Roue Quotidienne Gratuite — Marsabet',
      'plinko': 'Plinko Cosmique — Marsabet',
      'admin': 'Administration BDE — Marsabet'
    };
    document.title = titles[viewName] || 'Marsabet — Casino Virtuel BDE';
  }
};

window.Router = Router;
