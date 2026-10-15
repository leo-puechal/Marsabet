// Admin BDE Module for Marsabet

if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  };
}
var escapeHtml = window.escapeHtml;

const AdminBDE = {
  activeTab: 'orders', // 'orders', 'users', 'online', 'promos', 'wheels', etc.
  onlinePlayersCache: [],
  onlineSearchTimeout: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Onglets Admin
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Filtres des Joueurs en Ligne
    const onlineSearch = document.getElementById('adminOnlineSearchInput');
    if (onlineSearch) {
      onlineSearch.addEventListener('input', () => {
        clearTimeout(this.onlineSearchTimeout);
        this.onlineSearchTimeout = setTimeout(() => this.renderOnlinePlayers(), 250);
      });
    }

    const onlineStatusFilter = document.getElementById('adminOnlineStatusFilter');
    if (onlineStatusFilter) {
      onlineStatusFilter.addEventListener('change', () => this.renderOnlinePlayers());
    }

    const onlineSortSelect = document.getElementById('adminOnlineSortSelect');
    if (onlineSortSelect) {
      onlineSortSelect.addEventListener('change', () => this.renderOnlinePlayers());
    }

    const refreshOnlineBtn = document.getElementById('adminRefreshOnlineBtn');
    if (refreshOnlineBtn) {
      refreshOnlineBtn.addEventListener('click', () => {
        this.loadOnlinePlayers(true);
        window.UI?.showToast('Liste des joueurs en ligne actualisée.', 'info', 1500);
      });
    }

    const onlineTableBody = document.getElementById('adminOnlinePlayersList');
    if (onlineTableBody) {
      onlineTableBody.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          const userId = actionBtn.dataset.userId;
          if (action === 'view-player') this.openPlayerDetailModal(userId);
          else if (action === 'edit-coins') this.openUserCoinsModal(userId);
          return;
        }
        const clickable = e.target.closest('.admin-clickable-user');
        if (clickable) {
          const actionBtn2 = clickable.querySelector('[data-user-id]');
          const userId = actionBtn2 ? actionBtn2.dataset.userId : null;
          if (userId) this.openPlayerDetailModal(userId);
        }
      });
    }

    // Filtres des demandes de livraison
    const statusFilter = document.getElementById('adminOrdersStatusFilter');
    const searchFilter = document.getElementById('adminOrdersSearchInput');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadOrders());
    }

    if (searchFilter) {
      searchFilter.addEventListener('input', () => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadOrders(), 350);
      });
    }

    // Modal Création Code Promo
    const openPromoBtn = document.getElementById('adminOpenCreatePromoBtn');
    if (openPromoBtn) {
      openPromoBtn.addEventListener('click', () => this.openPromoModal());
    }

    const closePromoModal = document.getElementById('closeAdminPromoModal');
    if (closePromoModal) {
      closePromoModal.addEventListener('click', () => {
        const m = document.getElementById('adminPromoModal');
        if (m) m.classList.remove('active');
      });
    }

    const genPromoBtn = document.getElementById('btnGeneratePromoCode');
    if (genPromoBtn) {
      genPromoBtn.addEventListener('click', () => {
        const input = document.getElementById('promoInputCode');
        if (input) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let r = 'MARSA-';
          for (let i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
          input.value = r;
        }
      });
    }

    const formPromo = document.getElementById('formAdminPromo');
    if (formPromo) {
      formPromo.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePromoCode();
      });
    }

    // Gestion des Roues de la Fortune
    const wheelSelect = document.getElementById('adminWheelSelect');
    if (wheelSelect) {
      wheelSelect.addEventListener('change', (e) => {
        this.selectWheel(e.target.value);
      });
    }

    const addSegmentBtn = document.getElementById('adminAddSegmentBtn');
    if (addSegmentBtn) {
      addSegmentBtn.addEventListener('click', () => this.addSegment());
    }

    const resetWheelBtn = document.getElementById('adminResetWheelBtn');
    if (resetWheelBtn) {
      resetWheelBtn.addEventListener('click', () => this.resetWheelSegments());
    }

    const saveWheelBtn = document.getElementById('adminSaveWheelBtn');
    if (saveWheelBtn) {
      saveWheelBtn.addEventListener('click', () => this.saveWheelSegments());
    }

    // Gestion des Utilisateurs & Soldes
    const usersSearch = document.getElementById('adminUsersSearchInput');
    const usersRoleFilter = document.getElementById('adminUsersRoleFilter');
    const usersSortSelect = document.getElementById('adminUsersSortSelect');
    const usersRefreshBtn = document.getElementById('adminRefreshUsersBtn');

    if (usersSearch) {
      usersSearch.addEventListener('input', () => {
        clearTimeout(this.usersSearchTimeout);
        this.usersSearchTimeout = setTimeout(() => this.loadUsers(), 300);
      });
    }

    if (usersRoleFilter) {
      usersRoleFilter.addEventListener('change', () => this.loadUsers());
    }

    if (usersSortSelect) {
      usersSortSelect.addEventListener('change', () => this.loadUsers());
    }

    if (usersRefreshBtn) {
      usersRefreshBtn.addEventListener('click', () => this.loadUsers());
    }

    // Modal Modification Solde Utilisateur
    const closeCoinsModalBtn = document.getElementById('closeAdminUserCoinsModal');
    const cancelCoinsModalBtn = document.getElementById('btnCancelUserCoinsModal');
    const formUserCoins = document.getElementById('formAdminUserCoins');

    if (closeCoinsModalBtn) {
      closeCoinsModalBtn.addEventListener('click', () => this.closeUserCoinsModal());
    }
    if (cancelCoinsModalBtn) {
      cancelCoinsModalBtn.addEventListener('click', () => this.closeUserCoinsModal());
    }

    // Boutons de mode d'ajustement solde (Définir / Ajouter / Retirer)
    document.querySelectorAll('.admin-coin-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.setUserCoinsMode(mode);
      });
    });

    if (formUserCoins) {
      formUserCoins.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitUserCoins();
      });
    }

    // Modal Correction Identité Utilisateur (Nom / Prénom)
    const closeIdentityModalBtn = document.getElementById('closeAdminUserIdentityModal');
    const cancelIdentityModalBtn = document.getElementById('btnCancelUserIdentityModal');
    const formUserIdentity = document.getElementById('formAdminUserIdentity');

    if (closeIdentityModalBtn) {
      closeIdentityModalBtn.addEventListener('click', () => this.closeUserIdentityModal());
    }
    if (cancelIdentityModalBtn) {
      cancelIdentityModalBtn.addEventListener('click', () => this.closeUserIdentityModal());
    }
    if (formUserIdentity) {
      formUserIdentity.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitUserIdentity();
      });
    }

    // Gestion des Concours BDE
    const openContestBtn = document.getElementById('adminOpenCreateContestBtn');
    if (openContestBtn) {
      openContestBtn.addEventListener('click', () => this.openContestModal());
    }

    const closeContestModalBtn = document.getElementById('closeAdminContestModal');
    if (closeContestModalBtn) {
      closeContestModalBtn.addEventListener('click', () => {
        const m = document.getElementById('adminContestModal');
        if (m) m.classList.remove('active');
      });
    }

    document.querySelectorAll('.contest-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.currentTarget.dataset.preset;
        this.applyContestPreset(preset);
      });
    });

    const formContest = document.getElementById('formAdminContest');
    if (formContest) {
      formContest.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveContest();
      });
    }

    // Gestion des Annonces Officielles BDE
    const openAnnounceBtn = document.getElementById('adminOpenCreateAnnouncementBtn');
    const closeAnnounceModalBtn = document.getElementById('closeAdminAnnouncementModal');
    const cancelAnnounceModalBtn = document.getElementById('btnCancelAdminAnnouncementModal');
    const refreshAnnounceBtn = document.getElementById('adminRefreshAnnouncementsBtn');
    const formAnnounce = document.getElementById('formAdminAnnouncement');

    if (openAnnounceBtn) {
      openAnnounceBtn.addEventListener('click', () => this.openAnnouncementModal());
    }
    if (closeAnnounceModalBtn) {
      closeAnnounceModalBtn.addEventListener('click', () => this.closeAnnouncementModal());
    }
    if (cancelAnnounceModalBtn) {
      cancelAnnounceModalBtn.addEventListener('click', () => this.closeAnnouncementModal());
    }
    if (refreshAnnounceBtn) {
      refreshAnnounceBtn.addEventListener('click', () => this.loadAnnouncements());
    }
    if (formAnnounce) {
      formAnnounce.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAnnouncement();
      });
    }

    // Modal Fiche Joueur Admin (Statistiques & Détails)
    const closePlayerModalBtn = document.getElementById('closeAdminPlayerDetailModal');
    if (closePlayerModalBtn) {
      closePlayerModalBtn.addEventListener('click', () => this.closePlayerDetailModal());
    }

    const playerDetailModal = document.getElementById('adminPlayerDetailModal');
    if (playerDetailModal) {
      playerDetailModal.addEventListener('click', (e) => {
        if (e.target === playerDetailModal) {
          this.closePlayerDetailModal();
        }
      });
    }

    // Onglets de la modale Fiche Joueur
    document.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchPlayerDetailTab(tab);
      });
    });

    // Pagination parties de la modale joueur
    const btnGamesPrev = document.getElementById('btnPlayerGamesPrev');
    const btnGamesNext = document.getElementById('btnPlayerGamesNext');
    if (btnGamesPrev) {
      btnGamesPrev.addEventListener('click', () => {
        if (this.currentPlayerGamesPage > 1) {
          this.loadPlayerGamesPage(this.currentPlayerGamesPage - 1);
        }
      });
    }
    if (btnGamesNext) {
      btnGamesNext.addEventListener('click', () => {
        if (this.currentPlayerData && this.currentPlayerGamesPage < (this.currentPlayerData.pagination?.totalPages || 1)) {
          this.loadPlayerGamesPage(this.currentPlayerGamesPage + 1);
        }
      });
    }

    // Actions rapides depuis la modale joueur
    const adjustCoinsBtn = document.getElementById('playerDetailAdjustCoinsBtn');
    if (adjustCoinsBtn) {
      adjustCoinsBtn.addEventListener('click', () => {
        if (this.currentPlayerData && this.currentPlayerData.user) {
          this.openUserCoinsModal(this.currentPlayerData.user);
        }
      });
    }

    const footerClosePlayerBtn = document.getElementById('btnClosePlayerDetailFooterBtn');
    if (footerClosePlayerBtn) {
      footerClosePlayerBtn.addEventListener('click', () => this.closePlayerDetailModal());
    }

    // Délégation d'événements pour le tableau des utilisateurs (garantie 100% de clic)
    const usersTableBody = document.getElementById('adminUsersList');
    if (usersTableBody) {
      usersTableBody.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          const userId = actionBtn.dataset.userId;
          if (action === 'view-player') {
            this.openPlayerDetailModal(userId);
          } else if (action === 'edit-coins') {
            this.openUserCoinsModal(userId);
          } else if (action === 'edit-identity') {
            this.openUserIdentityModal(userId);
          } else if (action === 'toggle-role') {
            const username = actionBtn.dataset.username;
            const role = actionBtn.dataset.role;
            this.confirmToggleUserRole(userId, username, role);
          } else if (action === 'delete-user') {
            const username = actionBtn.dataset.username;
            this.confirmDeleteUser(userId, username);
          }
          return;
        }

        const clickableCell = e.target.closest('.admin-clickable-user');
        if (clickableCell) {
          const userId = clickableCell.dataset.userId;
          if (userId) {
            this.openPlayerDetailModal(userId);
          }
        }
      });
    }
  },

  checkPermission() {
    const isAdmin = !!(window.State && window.State.isAuthenticated && window.State.user && (window.State.user.role === 'admin' || window.State.user.role === 'bde'));
    if (!isAdmin) {
      if (window.UI) {
        window.UI.switchView('lobby');
      }
      return false;
    }
    return true;
  },

  switchTab(tab) {
    if (!this.checkPermission()) return;

    this.activeTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    const areaOnline = document.getElementById('adminTabOnline');
    const areaOrders = document.getElementById('adminTabOrders');
    const areaUsers = document.getElementById('adminTabUsers');
    const areaPromos = document.getElementById('adminTabPromos');
    const areaWheels = document.getElementById('adminTabWheels');
    const areaContests = document.getElementById('adminTabContests');
    const areaAnnouncements = document.getElementById('adminTabAnnouncements');

    if (areaOnline) areaOnline.style.display = (tab === 'online') ? 'block' : 'none';
    if (areaOrders) areaOrders.style.display = (tab === 'orders') ? 'block' : 'none';
    if (areaUsers) areaUsers.style.display = (tab === 'users') ? 'block' : 'none';
    if (areaPromos) areaPromos.style.display = (tab === 'promos') ? 'block' : 'none';
    if (areaWheels) areaWheels.style.display = (tab === 'wheels') ? 'block' : 'none';
    if (areaContests) areaContests.style.display = (tab === 'contests') ? 'block' : 'none';
    if (areaAnnouncements) areaAnnouncements.style.display = (tab === 'announcements') ? 'block' : 'none';

    if (tab === 'online') {
      this.loadOnlinePlayers();
      if (window.SyncEngine) window.SyncEngine.subscribeAdminPresence();
    }
    if (tab === 'orders') this.loadOrders();
    if (tab === 'users') this.loadUsers();
    if (tab === 'promos') this.loadPromoCodes();
    if (tab === 'wheels') this.loadWheels();
    if (tab === 'contests') this.loadContests();
    if (tab === 'announcements') this.loadAnnouncements();
  },

  // ==========================================
  // GESTION DES UTILISATEURS (ADMIN BDE)
  // ==========================================
  currentCoinsMode: 'set',
  usersListCache: [],

  setUserCoinsMode(mode) {
    this.currentCoinsMode = mode;
    document.querySelectorAll('.admin-coin-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    const label = document.getElementById('adminUserCoinsAmountLabel');
    const input = document.getElementById('adminUserCoinsAmount');
    if (label) {
      if (mode === 'set') {
        label.textContent = 'Nouveau montant exact :';
        if (input) input.placeholder = 'Ex: 5000';
      } else if (mode === 'add') {
        label.textContent = 'Montant de pièces à ajouter (+) :';
        if (input) input.placeholder = 'Ex: 1000';
      } else if (mode === 'subtract') {
        label.textContent = 'Montant de pièces à déduire (-) :';
        if (input) input.placeholder = 'Ex: 500';
      }
    }
  },

  openUserCoinsModal(target) {
    const modal = document.getElementById('adminUserCoinsModal');
    if (!modal) return;

    let user = target;
    if (typeof target === 'number' || typeof target === 'string') {
      user = (this.usersListCache && this.usersListCache.find(x => String(x.id) === String(target)))
             || (this.currentPlayerData && String(this.currentPlayerData.user?.id) === String(target) ? this.currentPlayerData.user : null);
    }
    if (!user) return;

    const idInput = document.getElementById('adminUserCoinsUserId');
    const nameEl = document.getElementById('adminUserCoinsUsername');
    const currEl = document.getElementById('adminUserCoinsCurrent');
    const amountInput = document.getElementById('adminUserCoinsAmount');
    const reasonInput = document.getElementById('adminUserCoinsReason');

    if (idInput) idInput.value = user.id;
    if (nameEl) nameEl.textContent = user.username || `Joueur #${user.id}`;
    if (currEl) currEl.textContent = `${Number(user.coins || 0).toLocaleString('fr-FR')} 🪙`;
    if (amountInput) amountInput.value = user.coins || 0;
    if (reasonInput) reasonInput.value = 'Ajustement administrateur BDE';

    this.setUserCoinsMode('set');
    modal.classList.add('active');
  },

  closeUserCoinsModal() {
    const modal = document.getElementById('adminUserCoinsModal');
    if (modal) modal.classList.remove('active');
  },

  async submitUserCoins() {
    const idInput = document.getElementById('adminUserCoinsUserId');
    const amountInput = document.getElementById('adminUserCoinsAmount');
    const reasonInput = document.getElementById('adminUserCoinsReason');
    const submitBtn = document.getElementById('btnSubmitUserCoinsModal');

    if (!idInput || !idInput.value || !amountInput) return;

    const userId = idInput.value;
    const coins = parseInt(amountInput.value, 10);
    const mode = this.currentCoinsMode || 'set';
    const reason = (reasonInput && reasonInput.value.trim().length >= 2) ? reasonInput.value.trim() : 'Ajustement administrateur BDE';

    if (isNaN(coins) || coins < 0) {
      window.UI.showToast('Veuillez entrer un montant de pièces valide.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small"></span> Enregistrement...';
    }

    try {
      const res = await window.API.adminUpdateUserCoins(userId, { coins, mode, reason });
      window.UI.showToast(res.message || 'Solde modifié avec succès !', 'success', 4000);
      if (window.sound && typeof window.sound.playWin === 'function') {
        window.sound.playWin();
      }

      this.closeUserCoinsModal();
      this.loadUsers();
      if (this.currentPlayerId && String(this.currentPlayerId) === String(userId)) {
        this.openPlayerDetailModal(userId, this.currentPlayerGamesPage);
      }

      // Si l'admin a modifié son propre solde, actualiser le state local
      if (window.State && window.State.user && String(window.State.user.id) === String(userId)) {
        if (typeof window.State.updateCoins === 'function') {
          window.State.updateCoins(res.user.coins);
        }
      }
    } catch (err) {
      console.error('Erreur updateUserCoins:', err);
      window.UI.showToast(err.message || 'Erreur lors de la modification du solde.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 Enregistrer le Solde';
      }
    }
  },

  openUserIdentityModal(target) {
    const modal = document.getElementById('adminUserIdentityModal');
    if (!modal) return;

    let user = target;
    if (typeof target === 'number' || typeof target === 'string') {
      user = (this.usersListCache && this.usersListCache.find(x => String(x.id) === String(target)))
             || (this.currentPlayerData && String(this.currentPlayerData.user?.id) === String(target) ? this.currentPlayerData.user : null);
    }
    if (!user) return;

    const idInput = document.getElementById('adminIdentityUserId');
    const usernameInput = document.getElementById('adminIdentityUsername');
    const lastInput = document.getElementById('adminIdentityLastName');
    const firstInput = document.getElementById('adminIdentityFirstName');

    if (idInput) idInput.value = user.id;
    if (usernameInput) usernameInput.value = user.username || '';
    if (lastInput) lastInput.value = user.last_name || '';
    if (firstInput) firstInput.value = user.first_name || '';

    modal.classList.add('active');
  },

  closeUserIdentityModal() {
    const modal = document.getElementById('adminUserIdentityModal');
    if (modal) modal.classList.remove('active');
  },

  async submitUserIdentity() {
    const idInput = document.getElementById('adminIdentityUserId');
    const lastInput = document.getElementById('adminIdentityLastName');
    const firstInput = document.getElementById('adminIdentityFirstName');

    if (!idInput || !idInput.value || !lastInput || !firstInput) return;

    const userId = idInput.value;
    const lastName = lastInput.value.trim();
    const firstName = firstInput.value.trim();

    if (!lastName || !firstName) {
      window.UI.showToast('Le nom et le prénom sont obligatoires.', 'warning');
      return;
    }

    try {
      const res = await window.API.adminUpdateUserIdentity(userId, { firstName, lastName });
      window.UI.showToast(res.message || 'Identité mise à jour avec succès !', 'success');
      this.closeUserIdentityModal();
      this.loadUsers();
      if (this.currentPlayerId && String(this.currentPlayerId) === String(userId)) {
        this.openPlayerDetailModal(userId, this.currentPlayerGamesPage);
      }

      // Si l'admin a modifié sa propre identité, rafraîchir le state local
      if (window.State && window.State.user && String(window.State.user.id) === String(userId)) {
        window.State.updateUser({ first_name: firstName, last_name: lastName });
      }
    } catch (err) {
      console.error('Erreur updateUserIdentity:', err);
      window.UI.showToast(err.message || 'Erreur lors de la modification de l\'identité.', 'error');
    }
  },

  async confirmToggleUserRole(userId, username, currentRole) {
    if (username === 'bde_admin') {
      window.UI.showToast('Le compte maître "bde_admin" ne peut pas être modifié.', 'warning');
      return;
    }

    const currentAdminId = window.State && window.State.user ? window.State.user.id : null;
    if (String(currentAdminId) === String(userId) && currentRole === 'admin') {
      window.UI.showToast('Tu ne peux pas révoquer tes propres privilèges administrateur.', 'warning');
      return;
    }

    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    const newRoleLabel = newRole === 'admin' ? 'Administrateur BDE' : 'Élève';

    const confirmed = window.confirm(`Veux-tu vraiment changer le rôle de "${username}" en "${newRoleLabel}" ?`);
    if (!confirmed) return;

    try {
      const res = await window.API.adminUpdateUserRole(userId, newRole);
      window.UI.showToast(res.message || 'Rôle mis à jour !', 'success');
      this.loadUsers();
    } catch (err) {
      console.error('Erreur updateUserRole:', err);
      window.UI.showToast(err.message || 'Erreur lors du changement de rôle.', 'error');
    }
  },

  async confirmDeleteUser(userId, username) {
    if (username === 'bde_admin') {
      window.UI.showToast('Le compte maître "bde_admin" ne peut pas être supprimé.', 'warning');
      return;
    }

    const currentAdminId = window.State && window.State.user ? window.State.user.id : null;
    if (String(currentAdminId) === String(userId)) {
      window.UI.showToast('Tu ne peux pas supprimer ton propre compte administrateur.', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ ATTENTION : Es-tu sûr de vouloir supprimer définitivement le compte de "${username}" ?\n\nToutes ses parties, ses pièces, ses commandes et ses statistiques seront irréversiblement effacées.`
    );
    if (!confirmed) return;

    try {
      const res = await window.API.adminDeleteUser(userId);
      window.UI.showToast(res.message || 'Compte supprimé avec succès.', 'success', 4000);
      this.loadUsers();
    } catch (err) {
      console.error('Erreur deleteUser:', err);
      window.UI.showToast(err.message || 'Erreur lors de la suppression de l\'utilisateur.', 'error');
    }
  },

  async loadUsers() {
    const listEl = document.getElementById('adminUsersList');
    if (!listEl) return;

    const searchInput = document.getElementById('adminUsersSearchInput');
    const roleFilter = document.getElementById('adminUsersRoleFilter');
    const sortSelect = document.getElementById('adminUsersSortSelect');

    const search = searchInput ? searchInput.value.trim() : '';
    const role = roleFilter ? roleFilter.value : 'all';
    
    let sortBy = 'coins';
    let sortOrder = 'desc';
    if (sortSelect && sortSelect.value) {
      const parts = sortSelect.value.split(':');
      sortBy = parts[0] || 'coins';
      sortOrder = parts[1] || 'desc';
    }

    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);"><span class="spinner-small" style="display:inline-block; margin-right:8px;"></span> Chargement des utilisateurs...</td></tr>';

    try {
      const res = await window.API.adminGetUsers({ search, role, sortBy, sortOrder });
      const users = res.users || [];
      const stats = res.stats || {};
      this.usersListCache = users;

      // Mettre à jour les compteurs métriques
      const countEl = document.getElementById('adminTotalUsersCount');
      const coinsEl = document.getElementById('adminTotalCoinsInCirculation');
      const gamesEl = document.getElementById('adminTotalGamesCount');

      if (countEl) countEl.textContent = (stats.totalUsers || users.length).toLocaleString('fr-FR');
      if (coinsEl) coinsEl.textContent = `${(stats.totalCoins || 0).toLocaleString('fr-FR')} 🪙`;
      if (gamesEl) gamesEl.textContent = (stats.totalGamesPlayed || 0).toLocaleString('fr-FR');

      if (users.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted); font-size:0.95rem;">Aucun utilisateur trouvé correspondant à ces critères.</td></tr>';
        return;
      }

      const currentAdminId = window.State && window.State.user ? window.State.user.id : null;

      listEl.innerHTML = users.map(u => {
        const isAdmin = u.role === 'admin';
        const isMaster = u.username === 'bde_admin';
        const isSelf = String(currentAdminId) === String(u.id);

        const roleBadge = isAdmin
          ? `<span class="admin-role-badge role-admin">🛡️ Admin BDE</span>`
          : `<span class="admin-role-badge role-student">🎓 Élève</span>`;

        const createdAtStr = u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        const gamesCount = u.games_played || 0;
        const totalWagered = (u.total_wagered || 0).toLocaleString('fr-FR');
        const biggestWin = (u.biggest_win || 0).toLocaleString('fr-FR');

        // Avatar icon
        const avatarIcon = isAdmin ? '🛡️' : '👤';

        return `
          <tr class="admin-user-row-hover">
            <td>
              <div class="admin-user-cell admin-clickable-user" data-action="view-player" data-user-id="${u.id}" onclick="AdminBDE.openPlayerDetailModal(${u.id})" title="Voir la fiche détaillée de ${escapeHtml(u.username)}">
                <div class="admin-user-avatar">${avatarIcon}</div>
                <div>
                  <div style="font-weight:700; color:#FFF; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                    ${escapeHtml(u.username)} <span style="font-size:0.75rem; opacity:0.7;">📊</span>
                    ${isSelf ? '<span style="font-size:0.7rem; background:rgba(212,175,55,0.25); color:var(--gold-light); padding:1px 6px; border-radius:4px;">(Toi)</span>' : ''}
                    ${isMaster ? '<span style="font-size:0.7rem; background:rgba(168,85,247,0.25); color:#E9D5FF; padding:1px 6px; border-radius:4px;">Maître</span>' : ''}
                  </div>
                  <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                    ${escapeHtml(u.first_name || '')} ${escapeHtml(u.last_name || '')}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">ID #${u.id}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td>
              <span style="font-weight:800; color:var(--gold-primary); font-size:1.05rem;">
                ${Number(u.coins).toLocaleString('fr-FR')} 🪙
              </span>
            </td>
            <td>
              <div style="font-size:0.8rem; color:var(--text-secondary);">
                🎮 <strong style="color:#FFF;">${gamesCount}</strong> parties
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                Misé: ${totalWagered} 🪙 · Max: ${biggestWin} 🪙
              </div>
            </td>
            <td>
              <span style="font-size:0.82rem; color:var(--text-secondary);">${createdAtStr}</span>
            </td>
            <td style="text-align:right;">
              <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end; flex-wrap:wrap;">
                <button class="admin-btn-action" style="border-color:var(--gold-primary); color:var(--gold-light);" data-action="view-player" data-user-id="${u.id}" onclick="AdminBDE.openPlayerDetailModal(${u.id})" title="Fiche détaillée et historique de ${escapeHtml(u.username)}">
                  📊 Fiche
                </button>
                <button class="admin-btn-action admin-btn-coins" data-action="edit-coins" data-user-id="${u.id}" onclick="AdminBDE.openUserCoinsModal(${u.id})" title="Modifier le solde de pièces">
                  🪙 Solde
                </button>
                <button class="admin-btn-action" style="border-color:#38BDF8; color:#38BDF8;" data-action="edit-identity" data-user-id="${u.id}" onclick="AdminBDE.openUserIdentityModal(${u.id})" title="Corriger Nom et Prénom (faute de frappe)">
                  ✏️ Identité
                </button>
                ${!isMaster && !isSelf ? `
                  <button class="admin-btn-action admin-btn-role" data-action="toggle-role" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}" data-role="${u.role}" onclick="AdminBDE.confirmToggleUserRole(${u.id}, '${escapeHtml(u.username)}', '${u.role}')" title="${isAdmin ? 'Rétrograder en élève' : 'Promouvoir en Admin BDE'}">
                    ${isAdmin ? '🎓 Rétrograder' : '🛡️ Promouvoir'}
                  </button>
                  <button class="admin-btn-action admin-btn-delete" data-action="delete-user" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}" onclick="AdminBDE.confirmDeleteUser(${u.id}, '${escapeHtml(u.username)}')" title="Supprimer définitivement le compte">
                    🗑️ Suppr.
                  </button>
                ` : `
                  <span style="font-size:0.75rem; color:var(--text-muted); padding:4px 6px;">Protégé</span>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Erreur chargement utilisateurs admin:', err);
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:#EF4444;">Erreur lors du chargement des utilisateurs : ${escapeHtml(err.message || 'problème de connexion')}</td></tr>`;
    }
  },

  async markDelivered(deliveryId) {
    if (!deliveryId) return;
    try {
      const data = await window.API.adminMarkDelivered(deliveryId);
      window.UI.showToast(data.message || 'Demande marquée comme livrée !', 'success', 4000);
      if (window.sound && typeof window.sound.playWin === 'function') {
        window.sound.playWin();
      }
      this.loadOrders();
    } catch (err) {
      console.error('Erreur marquer livré:', err);
      window.UI.showToast(err.message || 'Erreur lors de la validation de la livraison.', 'error');
    }
  },

  async loadOrders() {
    const listEl = document.getElementById('adminOrdersList');
    if (!listEl) return;

    const status = document.getElementById('adminOrdersStatusFilter')?.value || 'all';
    const search = document.getElementById('adminOrdersSearchInput')?.value || '';

    listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Chargement des livraisons...</td></tr>';

    try {
      const data = await window.API.adminGetDeliveries(status, search);
      const deliveries = data.deliveries || data.orders || [];

      if (deliveries.length === 0) {
        listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Aucune demande de livraison trouvée.</td></tr>';
        return;
      }

      listEl.innerHTML = deliveries.map(d => {
        const isDelivered = d.status === 'delivered';
        const isShop = d.source === 'shop';

        // Badge Email BDE
        let emailBadge = '';
        if (d.email_status === 'sent') {
          emailBadge = '<span style="color:#22C55E; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:3px;">✉️ Envoyé</span>';
        } else if (d.email_status === 'not_configured') {
          emailBadge = '<span style="color:var(--text-muted); font-size:0.8rem;" title="EMAIL_PASS non configuré dans .env">⚠️ Non config.</span>';
        } else {
          emailBadge = `<span style="color:#EF4444; font-size:0.8rem; font-weight:600;" title="${escapeHtml(d.email_error || 'Erreur d\'envoi')}">❌ Échec</span>`;
        }

        // Badge Statut
        const statusBadge = isDelivered
          ? '<span style="display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; background:rgba(34,197,94,0.15); border:1px solid #22C55E; color:#22C55E; font-size:0.8rem; font-weight:600;">✅ Livré</span>'
          : '<span style="display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; background:rgba(245,158,11,0.15); border:1px solid #F59E0B; color:#F59E0B; font-size:0.8rem; font-weight:600;">⏳ À livrer</span>';

        // Origine
        const originBadge = isShop
          ? '<span class="vip-badge" style="background:rgba(59,130,246,0.15); border:1px solid #3b82f6; color:#93c5fd; font-size:0.75rem;">🛍️ Boutique</span>'
          : '<span class="vip-badge" style="background:rgba(212,175,55,0.15); border:1px solid var(--gold-primary); color:var(--gold-light); font-size:0.75rem;">🎡 Roue</span>';

        // Action
        let actionCell = '';
        if (isDelivered) {
          actionCell = `<span style="font-size:0.75rem; color:var(--text-muted);">Livré par ${escapeHtml(d.delivered_by_admin || 'Admin')}<br>${new Date(d.delivered_at).toLocaleDateString('fr-FR')}</span>`;
        } else {
          actionCell = `<button class="btn btn-gold btn-mark-delivered" data-id="${d.id}" style="padding:0.35rem 0.75rem; font-size:0.8rem; white-space:nowrap;">✔ Marquer Livré</button>`;
        }

        const dateStr = new Date(d.created_at).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        return `
          <tr>
            <td style="font-size:0.82rem; color:var(--text-secondary); white-space:nowrap;">${dateStr}</td>
            <td>
              <strong style="color:#FFF;">${escapeHtml(d.last_name)} ${escapeHtml(d.first_name)}</strong>
              <br><small style="color:var(--text-muted); font-size:0.78rem;">@${escapeHtml(d.username)}</small>
            </td>
            <td>
              <span style="color:var(--gold-light); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                📍 ${escapeHtml(d.room_location)}
              </span>
              ${d.notes ? `<br><small style="color:#CBD5E1; font-size:0.78rem; display:inline-block; margin-top:2px;">📝 <em>${escapeHtml(d.notes)}</em></small>` : ''}
            </td>
            <td style="font-size:0.85rem;">
              ${d.phone ? `<a href="tel:${escapeHtml(d.phone)}" style="color:var(--text-secondary); text-decoration:none;">📞 ${escapeHtml(d.phone)}</a>` : '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>'}
            </td>
            <td>
              <strong>${d.icon || '🎁'} ${escapeHtml(d.item_name)}</strong>
              ${d.variant_name ? `<br><small style="color:var(--text-muted); font-size:0.78rem;">${escapeHtml(d.variant_name)}</small>` : ''}
              <span style="font-size:0.8rem; color:var(--text-secondary);"> (x${d.quantity || 1})</span>
            </td>
            <td>${originBadge}</td>
            <td>${emailBadge}</td>
            <td>${statusBadge}</td>
            <td>${actionCell}</td>
          </tr>
        `;
      }).join('');

      // Attacher les écouteurs pour "Marquer Livré"
      listEl.querySelectorAll('.btn-mark-delivered').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          if (confirm('Confirmer que cette commande a bien été livrée à l\'élève ?')) {
            this.markDelivered(id);
          }
        });
      });
    } catch (err) {
      console.error('Erreur chargement livraisons admin:', err);
      listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--lose-red); padding:1.5rem;">Erreur lors du chargement des livraisons.</td></tr>';
    }
  },

  // ======================== GESTION CODES PROMO ========================
  openPromoModal() {
    const modal = document.getElementById('adminPromoModal');
    if (!modal) return;
    const form = document.getElementById('formAdminPromo');
    if (form) form.reset();
    const codeInput = document.getElementById('promoInputCode');
    if (codeInput) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let r = 'MARSA-';
      for (let i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
      codeInput.value = r;
    }
    const usesInput = document.getElementById('promoInputMaxUses');
    if (usesInput) usesInput.value = '50';
    const coinsInput = document.getElementById('promoInputCoins');
    if (coinsInput) coinsInput.value = '1000';
    modal.classList.add('active');
  },

  async savePromoCode() {
    const code = document.getElementById('promoInputCode')?.value.trim();
    const coinsAmount = parseInt(document.getElementById('promoInputCoins')?.value);
    const maxUses = parseInt(document.getElementById('promoInputMaxUses')?.value);
    const expiresAt = document.getElementById('promoInputExpiresAt')?.value || null;

    if (!code) {
      window.UI.showToast('Veuillez entrer un code.', 'error');
      return;
    }

    try {
      const res = await window.API.adminCreatePromoCode({ code, coinsAmount, maxUses, expiresAt });
      window.UI.showToast(res.message || 'Code promo créé avec succès !', 'success');
      const modal = document.getElementById('adminPromoModal');
      if (modal) modal.classList.remove('active');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async loadPromoCodes() {
    const listEl = document.getElementById('adminPromosList');
    if (!listEl) return;
    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Chargement des codes promo...</td></tr>';

    try {
      const data = await window.API.adminGetPromoCodes();
      const codes = data.codes || [];

      // Mettre à jour les métriques
      const countEl = document.getElementById('adminPromoCount');
      const activeEl = document.getElementById('adminPromoActiveCount');
      const usesEl = document.getElementById('adminPromoUsesCount');
      const coinsEl = document.getElementById('adminPromoCoinsCount');

      if (countEl) countEl.textContent = codes.length;
      if (activeEl) activeEl.textContent = codes.filter(c => c.is_active && !c.is_expired && !c.is_limit_reached).length;
      const totalUses = codes.reduce((acc, c) => acc + (c.current_uses || 0), 0);
      const totalCoins = codes.reduce((acc, c) => acc + ((c.current_uses || 0) * c.coins_amount), 0);
      if (usesEl) usesEl.textContent = totalUses;
      if (coinsEl) coinsEl.textContent = totalCoins.toLocaleString() + ' 🪙';

      if (codes.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucun code promo créé. Clique sur "Nouveau Code Promo" pour en créer un !</td></tr>';
        return;
      }

      listEl.innerHTML = codes.map(c => {
        const percent = Math.min(100, Math.round((c.current_uses / c.max_uses) * 100));
        let statusBadge = '<span class="order-status pending" style="background:rgba(16,185,129,0.2); color:#34D399; border:1px solid #10B981;">Actif</span>';
        if (!c.is_active) {
          statusBadge = '<span class="order-status" style="background:rgba(148,163,184,0.2); color:#94A3B8; border:1px solid #64748B;">Désactivé</span>';
        } else if (c.is_expired) {
          statusBadge = '<span class="order-status" style="background:rgba(239,68,68,0.2); color:#FCA5A5; border:1px solid #EF4444;">Expiré</span>';
        } else if (c.is_limit_reached) {
          statusBadge = '<span class="order-status" style="background:rgba(245,158,11,0.2); color:#FCD34D; border:1px solid #F59E0B;">Limite atteinte</span>';
        }

        const expText = c.expires_at ? new Date(c.expires_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '<span style="color:var(--text-muted);">Illimitée</span>';

        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <code style="font-family:var(--font-mono); font-weight:800; font-size:1.05rem; color:var(--gold-light); background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.4); letter-spacing:1px;">${c.code}</code>
                <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${c.code}'); window.UI.showToast('Code ${c.code} copié !', 'info');" style="padding:2px 6px; font-size:0.75rem;" title="Copier le code">📋</button>
              </div>
            </td>
            <td><strong style="color:var(--gold-light);">${c.coins_amount.toLocaleString()} 🪙</strong></td>
            <td>
              <div style="min-width:120px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:3px;">
                  <span>${c.current_uses} / ${c.max_uses}</span>
                  <span style="color:var(--text-muted);">${percent}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                  <div style="background:var(--gold-primary); height:100%; width:${percent}%;"></div>
                </div>
              </div>
            </td>
            <td style="font-size:0.85rem;">${expText}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-outline" onclick="AdminBDE.togglePromoCode(${c.id})" style="padding:4px 8px; font-size:0.75rem;" title="Activer / Désactiver">
                  ${c.is_active ? '⏸️ Désactiver' : '▶️ Activer'}
                </button>
                <button class="btn btn-outline" onclick="AdminBDE.deletePromoCode(${c.id}, '${c.code}')" style="padding:4px 8px; font-size:0.75rem; border-color:#EF4444; color:#FCA5A5;" title="Supprimer">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#EF4444;">Erreur : ${err.message}</td></tr>`;
    }
  },

  async togglePromoCode(id) {
    try {
      const res = await window.API.adminTogglePromoCode(id);
      window.UI.showToast(res.message, 'success');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async deletePromoCode(id, code) {
    if (!confirm(`Supprimer définitivement le code promo "${code}" ?`)) return;
    try {
      const res = await window.API.adminDeletePromoCode(id);
      window.UI.showToast(res.message, 'info');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // GESTION DYNAMIQUE DES ROUES DE LA FORTUNE
  // ==========================================
  wheelsData: [],
  currentWheelId: null,
  editedSegments: [],
  previewAngle: 0,
  previewSpinning: false,

  async loadWheels() {
    const select = document.getElementById('adminWheelSelect');
    if (!select) return;

    try {
      select.innerHTML = '<option value="">Chargement des roues...</option>';
      const data = await window.API.adminGetWheels();
      this.wheelsData = data.wheels || [];

      if (!this.wheelsData.length) {
        select.innerHTML = '<option value="">Aucune roue trouvée</option>';
        return;
      }

      select.innerHTML = this.wheelsData.map(w => `
        <option value="${w.id}">${w.name} (${w.isFree ? 'Gratuit / 24h' : w.cost + ' coins'})</option>
      `).join('');

      const targetId = this.currentWheelId && this.wheelsData.some(w => w.id === this.currentWheelId)
        ? this.currentWheelId
        : this.wheelsData[0].id;

      select.value = targetId;
      this.selectWheel(targetId);
    } catch (err) {
      console.error('Erreur chargement roues admin:', err);
      window.UI.showToast('Erreur lors du chargement des roues : ' + err.message, 'error');
    }
  },

  selectWheel(wheelId) {
    this.currentWheelId = wheelId;
    const wheel = this.wheelsData.find(w => w.id === wheelId);
    if (!wheel) return;

    // Cloner profondément les segments pour modification sans toucher au cache tant que pas sauvegardé
    this.editedSegments = JSON.parse(JSON.stringify(wheel.segments || []));

    // Mettre à jour la bannière d'information
    const nameEl = document.getElementById('adminWheelCurrentName');
    const typeEl = document.getElementById('adminWheelCurrentType');
    if (nameEl) nameEl.textContent = wheel.name;
    if (typeEl) typeEl.textContent = wheel.isFree ? '🎁 Gratuite (Cooldown 24h)' : `🪙 Payante (${wheel.cost} Coins)`;

    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  renderSegmentsTable() {
    const tbody = document.getElementById('adminWheelSegmentsTbody');
    const segCountEl = document.getElementById('adminWheelSegCount');
    const probBadge = document.getElementById('adminWheelProbSumBadge');
    const previewCountEl = document.getElementById('adminPreviewCount');
    const previewWeightEl = document.getElementById('adminPreviewTotalWeight');

    if (!tbody) return;

    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const count = this.editedSegments.length;

    if (segCountEl) segCountEl.textContent = count;
    if (previewCountEl) previewCountEl.textContent = count;
    if (previewWeightEl) previewWeightEl.textContent = `${totalWeight.toFixed(1)}%`;

    // Indicateur de probabilité
    if (probBadge) {
      const isExact100 = Math.abs(totalWeight - 100) < 0.1;
      if (isExact100) {
        probBadge.textContent = '100.0% ✅';
        probBadge.style.color = 'var(--win-green)';
      } else {
        probBadge.textContent = `${totalWeight.toFixed(1)}% ⚠️ (Normalisé à 100%)`;
        probBadge.style.color = '#F59E0B';
      }
    }

    if (count === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Aucun segment. Cliquez sur "+ Ajouter un Segment".</td></tr>';
      return;
    }

    tbody.innerHTML = this.editedSegments.map((seg, idx) => {
      const isPhysical = seg.type === 'physical';
      const weightVal = parseFloat(seg.weight) || 0;
      const pctNormalized = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(1) : '0.0';

      return `
        <tr data-index="${idx}">
          <td style="font-weight:700; color:var(--gold-light); text-align:center;">${idx + 1}</td>
          <td>
            <input type="color" value="${seg.color || (isPhysical ? '#DC2626' : (idx % 2 === 0 ? '#0B2252' : '#0F2C69'))}"
              onchange="AdminBDE.updateSegmentField(${idx}, 'color', this.value)"
              title="Choisir la couleur du segment" />
          </td>
          <td>
            <input type="text" value="${seg.icon || (isPhysical ? '🥤' : '🪙')}" maxlength="4" style="text-align:center;"
              oninput="AdminBDE.updateSegmentField(${idx}, 'icon', this.value)"
              placeholder="🪙" />
          </td>
          <td>
            <input type="text" value="${seg.label || ''}"
              oninput="AdminBDE.updateSegmentField(${idx}, 'label', this.value)"
              placeholder="Ex: 500 Coins ou Red Bull" required />
          </td>
          <td>
            <select onchange="AdminBDE.updateSegmentField(${idx}, 'type', this.value)">
              <option value="coins" ${seg.type === 'coins' ? 'selected' : ''}>🪙 Coins</option>
              <option value="physical" ${seg.type === 'physical' ? 'selected' : ''}>📦 Produit Physique</option>
              <option value="special" ${seg.type === 'special' ? 'selected' : ''}>✨ Spécial</option>
            </select>
          </td>
          <td>
            <input type="text" value="${seg.value !== undefined ? seg.value : (seg.type === 'coins' ? (seg.coins !== undefined ? seg.coins : '') : (seg.product?.name || seg.product?.itemId || ''))}"
              oninput="AdminBDE.updateSegmentField(${idx}, 'value', this.value)"
              placeholder="${isPhysical ? 'ID ou Nom produit' : 'Nombre de coins'}" />
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <input type="number" step="0.1" min="0.1" max="100" value="${weightVal}" style="width:58px; text-align:right;"
                oninput="AdminBDE.updateSegmentField(${idx}, 'weight', parseFloat(this.value) || 0)" />
              <span style="font-size:0.75rem; color:var(--text-muted);">%</span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-align:right;">≈ ${pctNormalized}% réel</div>
          </td>
          <td style="text-align:center;">
            <button class="btn btn-outline" onclick="AdminBDE.removeSegment(${idx})"
              style="padding:4px 7px; font-size:0.8rem; border-color:#EF4444; color:#FCA5A5;"
              ${count <= 2 ? 'disabled title="Minimum 2 segments"' : 'title="Supprimer ce segment"'}>
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateSegmentField(index, field, value) {
    if (!this.editedSegments[index]) return;

    if (field === 'weight') {
      this.editedSegments[index].weight = Math.max(0.1, parseFloat(value) || 0.1);
    } else if (field === 'value') {
      const num = Number(value);
      this.editedSegments[index].value = (!isNaN(num) && value !== '') ? num : value;
      if (this.editedSegments[index].type === 'coins') {
        this.editedSegments[index].coins = (!isNaN(num) && value !== '') ? Math.max(0, num) : 0;
      }
    } else {
      this.editedSegments[index][field] = value;
    }

    // Mise à jour rapide de la jauge et du canvas sans ré-injecter tout le HTML (évite la perte de focus)
    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const probBadge = document.getElementById('adminWheelProbSumBadge');
    const previewWeightEl = document.getElementById('adminPreviewTotalWeight');

    if (previewWeightEl) previewWeightEl.textContent = `${totalWeight.toFixed(1)}%`;
    if (probBadge) {
      const isExact100 = Math.abs(totalWeight - 100) < 0.1;
      if (isExact100) {
        probBadge.textContent = '100.0% ✅';
        probBadge.style.color = 'var(--win-green)';
      } else {
        probBadge.textContent = `${totalWeight.toFixed(1)}% ⚠️ (Normalisé à 100%)`;
        probBadge.style.color = '#F59E0B';
      }
    }

    this.drawAdminWheelPreview();
  },

  addSegment() {
    if (this.editedSegments.length >= 24) {
      window.UI.showToast('Une roue ne peut pas comporter plus de 24 segments.', 'warning');
      return;
    }

    const defaultColors = ['#0B2252', '#0F2C69', '#14367B', '#0A1E45', '#DC2626', '#D97706', '#059669'];
    const color = defaultColors[this.editedSegments.length % defaultColors.length];

    this.editedSegments.push({
      id: 'seg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      icon: '🎁',
      label: 'Lot ' + (this.editedSegments.length + 1),
      type: 'coins',
      value: 100,
      weight: 10,
      color: color
    });

    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  removeSegment(index) {
    if (this.editedSegments.length <= 2) {
      window.UI.showToast('Une roue doit comporter au minimum 2 segments.', 'warning');
      return;
    }

    this.editedSegments.splice(index, 1);
    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  resetWheelSegments() {
    if (!this.currentWheelId) return;
    const wheel = this.wheelsData.find(w => w.id === this.currentWheelId);
    if (!wheel) return;

    this.editedSegments = JSON.parse(JSON.stringify(wheel.segments || []));
    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
    window.UI.showToast('Modifications réinitialisées aux valeurs sauvegardées.', 'info');
  },

  async saveWheelSegments() {
    if (!this.currentWheelId) return;
    const wheel = this.wheelsData.find(w => w.id === this.currentWheelId);
    const wheelName = wheel ? wheel.name : this.currentWheelId;

    if (this.editedSegments.length < 2) {
      window.UI.showToast('La roue doit comporter au moins 2 segments.', 'error');
      return;
    }

    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const confirmMsg = `Confirmez-vous la modification de la roue "${wheelName}" ?\n\n`
      + `• Nombre de segments : ${this.editedSegments.length}\n`
      + `• Somme des probabilités : ${totalWeight.toFixed(1)}% (sera normalisée à 100%)\n\n`
      + `⚠️ Les modifications seront appliquées immédiatement pour tous les élèves en jeu.`;

    if (!confirm(confirmMsg)) return;

    try {
      const saveBtn = document.getElementById('adminSaveWheelBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Sauvegarde en cours...';
      }

      const res = await window.API.adminUpdateWheelSegments(this.currentWheelId, this.editedSegments);
      window.UI.showToast(res.message || 'Récompenses de la roue sauvegardées avec succès !', 'success', 5000);

      // Mettre à jour les données locales
      if (res.wheel) {
        const idx = this.wheelsData.findIndex(w => w.id === this.currentWheelId);
        if (idx !== -1) {
          this.wheelsData[idx] = res.wheel;
        }
        this.editedSegments = JSON.parse(JSON.stringify(res.wheel.segments || []));
        this.renderSegmentsTable();
        this.drawAdminWheelPreview();
      }

      // Si le jeu FortuneWheels est instancié sur la page, mettre à jour son cache
      if (window.FortuneWheels && typeof window.FortuneWheels.loadWheelArena === 'function') {
        if (window.FortuneWheels.currentWheelId === this.currentWheelId) {
          window.FortuneWheels.loadWheelArena(this.currentWheelId);
        }
      }
    } catch (err) {
      console.error('Erreur sauvegarde roue:', err);
      window.UI.showToast('Erreur lors de la sauvegarde : ' + err.message, 'error');
    } finally {
      const saveBtn = document.getElementById('adminSaveWheelBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Sauvegarder les Récompenses';
      }
    }
  },

  drawAdminWheelPreview(rotationAngle = 0) {
    const canvas = document.getElementById('adminWheelPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 10;

    const segments = this.editedSegments || [];
    const count = segments.length || 8;
    const segAngle = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);

    // Dessiner chaque secteur
    for (let i = 0; i < count; i++) {
      const seg = segments[i] || { label: 'Coins', color: '#0A2552' };
      const startAngle = i * segAngle;
      const endAngle = (i + 1) * segAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      const isPhysical = seg.type === 'physical';
      ctx.fillStyle = seg.color || (isPhysical ? '#DC2626' : (i % 2 === 0 ? '#0B2252' : '#0F2C69'));
      ctx.fill();

      ctx.strokeStyle = isPhysical ? '#F87171' : 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Contenu du segment (icône + texte)
      ctx.save();
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Icône
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillText(seg.icon || (isPhysical ? '🥤' : '🪙'), radius - 12, 0);

      // Label court
      ctx.font = isPhysical ? 'bold 10px Outfit, sans-serif' : '600 10px Outfit, sans-serif';
      ctx.fillStyle = isPhysical ? '#FFF' : '#FFE27A';
      const labelText = (seg.label || '').length > 13 ? (seg.label || '').substring(0, 11) + '..' : (seg.label || '');
      ctx.fillText(labelText, radius - 34, 0);

      ctx.restore();
    }

    // Bordure extérieure or avec rivets
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#D4AF37';
    ctx.stroke();

    const rivetCount = count * 2;
    for (let j = 0; j < rivetCount; j++) {
      const rivetAngle = (j * 2 * Math.PI) / rivetCount;
      const rx = Math.cos(rivetAngle) * (radius + 2);
      const ry = Math.sin(rivetAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = j % 2 === 0 ? '#FFE27A' : '#FFF';
      ctx.fill();
    }

    // Moyeu central
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#061226';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪐', 0, 0);

    ctx.restore();
  },

  testSpinPreview() {
    if (this.previewSpinning || this.editedSegments.length < 2) return;
    this.previewSpinning = true;

    const testBtn = document.getElementById('adminTestSpinBtn');
    if (testBtn) testBtn.disabled = true;

    const duration = 3800; // 3.8s
    const startTime = performance.now();
    const startAngle = this.previewAngle;
    const fullTurns = 4;
    const randomExtra = Math.random() * 2 * Math.PI;
    const targetAngle = startAngle + (fullTurns * 2 * Math.PI) + randomExtra;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out quintic
      const ease = 1 - Math.pow(1 - progress, 4.5);
      const currentRotation = startAngle + (targetAngle - startAngle) * ease;
      this.previewAngle = currentRotation % (2 * Math.PI);

      this.drawAdminWheelPreview(currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.previewSpinning = false;
        if (testBtn) testBtn.disabled = false;
      }
    };

    requestAnimationFrame(animate);
  },

  // ==========================================
  // GESTION DES CONCOURS & DÉFIS BDE (ADMIN)
  // ==========================================
  openContestModal() {
    const modal = document.getElementById('adminContestModal');
    if (!modal) return;

    // Réinitialiser le formulaire
    const form = document.getElementById('formAdminContest');
    if (form) form.reset();

    // Date de fin par défaut (+3 jours)
    const endInput = document.getElementById('contestInputEndDate');
    if (endInput) {
      const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      endInput.value = d.toISOString().slice(0, 16);
    }

    modal.classList.add('active');
  },

  applyContestPreset(preset) {
    const titleInput = document.getElementById('contestInputTitle');
    const descInput = document.getElementById('contestInputDesc');
    const gameSelect = document.getElementById('contestSelectGame');
    const critSelect = document.getElementById('contestSelectCriterion');
    const minBetInput = document.getElementById('contestInputMinBet');
    const prizeInput = document.getElementById('contestInputPrizePool');

    switch (preset) {
      case 'crash_mult':
        if (titleInput) titleInput.value = '🚀 Défi Crash : Plus Gros Multiplicateur';
        if (descInput) descInput.value = 'Encaisse avec le multiplicateur le plus élevé possible avant le crash du vaisseau !';
        if (gameSelect) gameSelect.value = 'crash';
        if (critSelect) critSelect.value = 'highest_multiplier';
        if (minBetInput) minBetInput.value = 20;
        if (prizeInput) prizeInput.value = 25000;
        break;
      case 'bj_profit':
        if (titleInput) titleInput.value = '🃏 Tournoi Blackjack : Roi des Gains';
        if (descInput) descInput.value = 'Bats le croupier et accumule le plus gros profit net sur les tables !';
        if (gameSelect) gameSelect.value = 'blackjack';
        if (critSelect) critSelect.value = 'total_profit';
        if (minBetInput) minBetInput.value = 50;
        if (prizeInput) prizeInput.value = 30000;
        break;
      case 'slots_win':
        if (titleInput) titleInput.value = '🎰 Jackpot Slots : Plus Gros Gain Unique';
        if (descInput) descInput.value = 'Décroche la combinaison légendaire ou les Free Spins les plus rémunérateurs en un seul tour !';
        if (gameSelect) gameSelect.value = 'slots';
        if (critSelect) critSelect.value = 'highest_win';
        if (minBetInput) minBetInput.value = 20;
        if (prizeInput) prizeInput.value = 20000;
        break;
      case 'dragon_summit':
        if (titleInput) titleInput.value = '🐉 Ascension Dragon Tower : Plus Haut Sommet';
        if (descInput) descInput.value = 'Gravis le plus grand nombre d\'étages sans tomber sur un œuf piégé !';
        if (gameSelect) gameSelect.value = 'dragon-tower';
        if (critSelect) critSelect.value = 'highest_multiplier';
        if (minBetInput) minBetInput.value = 20;
        if (prizeInput) prizeInput.value = 20000;
        break;
      case 'all_wager':
        if (titleInput) titleInput.value = '👑 Casino Master : Plus Gros Joueur';
        if (descInput) descInput.value = 'Celui qui brasse le plus de jetons sur l\'ensemble des jeux du casino !';
        if (gameSelect) gameSelect.value = 'all';
        if (critSelect) critSelect.value = 'total_wagered';
        if (minBetInput) minBetInput.value = 10;
        if (prizeInput) prizeInput.value = 40000;
        break;
    }

    if (window.UI?.showToast) {
      window.UI.showToast('Modèle appliqué au formulaire !', 'info', 1500);
    }
  },

  async saveContest() {
    const title = document.getElementById('contestInputTitle')?.value;
    const description = document.getElementById('contestInputDesc')?.value;
    const gameType = document.getElementById('contestSelectGame')?.value;
    const criterion = document.getElementById('contestSelectCriterion')?.value;
    const minBet = parseInt(document.getElementById('contestInputMinBet')?.value, 10) || 10;
    const prizePool = parseInt(document.getElementById('contestInputPrizePool')?.value, 10) || 10000;
    const endDateRaw = document.getElementById('contestInputEndDate')?.value;

    if (!title || !title.trim()) {
      window.UI?.showToast('Veuillez renseigner le titre du concours.', 'error');
      return;
    }

    const endDate = endDateRaw ? new Date(endDateRaw).toISOString() : null;

    try {
      await window.API.adminCreateContest({
        title,
        description,
        gameType,
        criterion,
        minBet,
        prizePool,
        endDate
      });

      window.UI?.showToast('🏆 Concours créé et publié avec succès !', 'success');
      const modal = document.getElementById('adminContestModal');
      if (modal) modal.classList.remove('active');

      this.loadContests();
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors de la création du concours.', 'error');
    }
  },

  async loadContests() {
    const tbody = document.getElementById('adminContestsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
          Chargement des concours en cours...
        </td>
      </tr>
    `;

    try {
      const res = await window.API.getContests(true);
      const contests = res.contests || [];

      if (contests.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
              Aucun concours créé pour le moment. Clique sur "➕ Créer un Concours" pour lancer un premier événement !
            </td>
          </tr>
        `;
        return;
      }

      const getGameIcon = (g) => {
        const icons = {
          'crash': '🚀 Crash',
          'blackjack': '🃏 Blackjack',
          'slots': '🎰 Slots',
          'roulette': '🔴 Roulette',
          'dice': '🎲 Dés',
          'slider': '🎯 Slider',
          'plinko': '💧 Plinko',
          'video-poker': '🎴 Vidéo Poker',
          'dragon-tower': '🐉 Dragon Tower',
          'all': '🌐 Tous'
        };
        return icons[g] || g;
      };

      const getCritName = (c) => {
        const crits = {
          'highest_multiplier': '🎯 Plus Gros Mult',
          'highest_win': '💰 Plus Gros Gain',
          'total_profit': '📈 Gains Cumulés (Profit)',
          'total_wins': '🏆 Nb Victoires',
          'total_wagered': '🔥 Volume Misé'
        };
        return crits[c] || c;
      };

      tbody.innerHTML = contests.map((c, i) => {
        const isEnded = c.status === 'ended';
        const top1 = c.top3 && c.top3[0];
        let leaderText = '-';
        if (top1) {
          leaderText = `<strong>${top1.username}</strong> (${c.criterion === 'highest_multiplier' ? 'x' + Number(top1.score).toFixed(2) : Number(top1.score).toLocaleString('fr-FR')})`;
        }

        return `
          <tr>
            <td style="color:var(--text-muted); font-weight:700;">${i + 1}</td>
            <td>
              <div style="font-weight:700; color:#FFF;">${c.title}</div>
              <div style="font-size:0.75rem; color:var(--gold-light);">${getGameIcon(c.gameType)} • Min: ${c.minBet || 10} 🪙</div>
            </td>
            <td><span style="font-size:0.8rem; color:#cbd5e1;">${getCritName(c.criterion)}</span></td>
            <td><strong style="color:var(--gold-light);">${Number(c.prizePool).toLocaleString('fr-FR')} 🪙</strong></td>
            <td style="text-align:center;"><span style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:10px; font-size:0.8rem;">👥 ${c.participantsCount || 0}</span></td>
            <td><span style="font-size:0.8rem;">${leaderText}</span></td>
            <td>
              ${isEnded
                ? `<span class="badge" style="background:rgba(148,163,184,0.15); border:1px solid #94a3b8; color:#94a3b8; padding:2px 8px; border-radius:6px; font-size:0.72rem;">🏁 Terminé</span>`
                : `<span class="badge" style="background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#34d399; padding:2px 8px; border-radius:6px; font-size:0.72rem;">🔥 En cours</span>`
              }
            </td>
            <td style="text-align:right;">
              <div style="display:inline-flex; gap:6px;">
                ${!isEnded ? `
                  <button class="btn btn-gold btn-sm btn-distribute-contest" data-id="${c.id}" data-title="${encodeURIComponent(c.title)}" title="Clôturer le concours et verser les gains aux gagnants">
                    🎁 Clôturer & Payer
                  </button>
                ` : `
                  <span style="font-size:0.75rem; color:var(--text-muted); align-self:center; margin-right:4px;">
                    ${c.prizesDistributed ? '✓ Payé' : 'Clos'}
                  </span>
                `}
                <button class="btn btn-outline btn-sm btn-delete-contest" data-id="${c.id}" data-title="${encodeURIComponent(c.title)}" style="color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Supprimer définitivement ce concours">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Attacher événements d'actions
      tbody.querySelectorAll('.btn-distribute-contest').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id, 10);
          const title = decodeURIComponent(btn.dataset.title || '');
          this.distributeContestPrizes(id, title);
        });
      });

      tbody.querySelectorAll('.btn-delete-contest').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id, 10);
          const title = decodeURIComponent(btn.dataset.title || '');
          this.deleteContest(id, title);
        });
      });

    } catch (err) {
      console.error('Erreur loadContests admin:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:2rem; color:#fca5a5;">
            ⚠️ Erreur lors du chargement des concours.
          </td>
        </tr>
      `;
    }
  },

  async distributeContestPrizes(id, title) {
    if (!confirm(`Es-tu sûr de vouloir clôturer le concours "${title}" et distribuer les récompenses aux 3 meilleurs élèves ?`)) {
      return;
    }

    try {
      const res = await window.API.adminDistributeContestPrizes(id);
      window.UI?.showToast(res.message || 'Récompenses distribuées avec succès !', 'success');
      this.loadContests();
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors de la distribution des gains.', 'error');
    }
  },

  async deleteContest(id, title) {
    if (!confirm(`Es-tu sûr de vouloir supprimer définitivement le concours "${title}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      await window.API.adminDeleteContest(id);
      window.UI?.showToast('Concours supprimé.', 'info');
      this.loadContests();
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors de la suppression.', 'error');
    }
  },

  // ==========================================
  // GESTION DES ANNONCES OFFICIELLES BDE
  // ==========================================
  async loadAnnouncements() {
    const listEl = document.getElementById('adminAnnouncementsList');
    if (!listEl) return;

    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);"><span class="spinner-small" style="display:inline-block; margin-right:8px;"></span> Chargement des annonces...</td></tr>';

    try {
      const res = await window.API.adminGetAnnouncements();
      const announcements = res.announcements || [];
      const totalStudents = res.totalStudents || 0;
      this.announcementsCache = announcements;

      // Métriques
      const totalCountEl = document.getElementById('adminTotalAnnouncementsCount');
      const activeCountEl = document.getElementById('adminActiveAnnouncementsCount');
      const viewsCountEl = document.getElementById('adminTotalAnnouncementViewsCount');

      const activeCount = announcements.filter(a => a.is_active && !a.is_expired).length;
      const totalViews = announcements.reduce((sum, a) => sum + (a.views_count || 0), 0);

      if (totalCountEl) totalCountEl.textContent = announcements.length.toLocaleString('fr-FR');
      if (activeCountEl) activeCountEl.textContent = activeCount.toLocaleString('fr-FR');
      if (viewsCountEl) viewsCountEl.textContent = totalViews.toLocaleString('fr-FR');

      if (announcements.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted);">Aucune annonce publiée pour le moment. Clique sur "Nouvelle Annonce" pour en créer une !</td></tr>';
        return;
      }

      listEl.innerHTML = announcements.map(ann => {
        const isExpired = ann.is_expired;
        const isActive = ann.is_active;

        let statusBadge = '';
        if (isExpired) {
          statusBadge = '<span style="background:rgba(239,68,68,0.2); color:#F87171; border:1px solid rgba(239,68,68,0.4); padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">⏱️ Expirée</span>';
        } else if (isActive) {
          statusBadge = '<span style="background:rgba(16,185,129,0.2); color:#34D399; border:1px solid rgba(16,185,129,0.4); padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">🟢 Active</span>';
        } else {
          statusBadge = '<span style="background:rgba(156,163,175,0.2); color:#9CA3AF; border:1px solid rgba(156,163,175,0.4); padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">⚪ Inactive</span>';
        }

        const dateStr = ann.created_at ? new Date(ann.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const expStr = ann.expires_at ? new Date(ann.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '<span style="color:var(--text-muted);">Permanente</span>';

        const viewsStat = `${ann.views_count}/${ann.total_students} élèves <span style="color:var(--text-muted); font-size:0.75rem;">(${ann.percentage_viewed}%)</span>`;

        return `
          <tr>
            <td>
              <div style="font-weight:700; color:#FFF; font-size:0.95rem; margin-bottom:0.25rem;">
                📢 ${escapeHtml(ann.title)}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; max-width:340px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                ${escapeHtml(ann.content)}
              </div>
            </td>
            <td><span style="font-size:0.82rem; color:var(--text-secondary);">${dateStr}</span></td>
            <td><span style="font-size:0.82rem; color:var(--text-secondary);">${expStr}</span></td>
            <td>
              <div style="font-weight:700; color:var(--gold-light); font-size:0.9rem;">
                ${viewsStat}
              </div>
              <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:4px; overflow:hidden;">
                <div style="width:${Math.min(100, ann.percentage_viewed)}%; height:100%; background:var(--gold-primary);"></div>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td style="text-align:right;">
              <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end; flex-wrap:wrap;">
                <button class="admin-btn-action" style="border-color:#F59E0B; color:#FBBF24;" onclick="AdminBDE.openAnnouncementModal(${JSON.stringify(ann).replace(/"/g, '&quot;')})" title="Modifier cette annonce">
                  ✏️ Modifier
                </button>
                <button class="admin-btn-action" style="border-color:${isActive ? '#9CA3AF' : '#10B981'}; color:${isActive ? '#D1D5DB' : '#34D399'};" onclick="AdminBDE.toggleAnnouncement(${ann.id})" title="${isActive ? 'Désactiver l’annonce' : 'Activer l’annonce'}">
                  ${isActive ? '⏸️ Désactiver' : '▶️ Activer'}
                </button>
                <button class="admin-btn-action admin-btn-delete" onclick="AdminBDE.deleteAnnouncement(${ann.id}, '${escapeHtml(ann.title)}')" title="Supprimer définitivement l'annonce">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Erreur loadAnnouncements:', err);
      listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#EF4444;">Erreur lors du chargement des annonces.</td></tr>';
    }
  },

  openAnnouncementModal(ann = null) {
    const modal = document.getElementById('adminAnnouncementModal');
    if (!modal) return;

    const modalTitle = document.getElementById('adminAnnouncementModalTitle');
    const idInput = document.getElementById('adminAnnounceId');
    const titleInput = document.getElementById('adminAnnounceTitle');
    const contentInput = document.getElementById('adminAnnounceContent');
    const expiresInput = document.getElementById('adminAnnounceExpiresAt');
    const activeCheck = document.getElementById('adminAnnounceActive');
    const submitBtn = document.getElementById('btnSubmitAdminAnnouncementModal');

    if (ann) {
      if (modalTitle) modalTitle.textContent = '✏️ Modifier l\'Annonce BDE';
      if (idInput) idInput.value = ann.id;
      if (titleInput) titleInput.value = ann.title || '';
      if (contentInput) contentInput.value = ann.content || '';
      if (expiresInput) {
        if (ann.expires_at) {
          const d = new Date(ann.expires_at);
          // Format YYYY-MM-DDTHH:MM pour input datetime-local
          const pad = n => String(n).padStart(2, '0');
          expiresInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } else {
          expiresInput.value = '';
        }
      }
      if (activeCheck) activeCheck.checked = Boolean(ann.is_active);
      if (submitBtn) submitBtn.textContent = '💾 Mettre à jour l\'Annonce';
    } else {
      if (modalTitle) modalTitle.textContent = '📢 Publier une Annonce Officielle BDE';
      if (idInput) idInput.value = '';
      if (titleInput) titleInput.value = '';
      if (contentInput) contentInput.value = '';
      if (expiresInput) expiresInput.value = '';
      if (activeCheck) activeCheck.checked = true;
      if (submitBtn) submitBtn.textContent = '💾 Publier l\'Annonce';
    }

    modal.classList.add('active');
  },

  closeAnnouncementModal() {
    const modal = document.getElementById('adminAnnouncementModal');
    if (modal) modal.classList.remove('active');
  },

  async saveAnnouncement() {
    const id = document.getElementById('adminAnnounceId')?.value;
    const title = document.getElementById('adminAnnounceTitle')?.value.trim();
    const content = document.getElementById('adminAnnounceContent')?.value.trim();
    const expiresAt = document.getElementById('adminAnnounceExpiresAt')?.value || null;
    const isActive = document.getElementById('adminAnnounceActive')?.checked ? 1 : 0;
    const submitBtn = document.getElementById('btnSubmitAdminAnnouncementModal');

    if (!title || !content) {
      window.UI?.showToast('Le titre et le message sont obligatoires.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';
    }

    try {
      if (id) {
        await window.API.adminUpdateAnnouncement(id, {
          title,
          content,
          expires_at: expiresAt,
          is_active: isActive
        });
        window.UI?.showToast('Annonce mise à jour avec succès !', 'success');
      } else {
        await window.API.adminCreateAnnouncement({
          title,
          content,
          expires_at: expiresAt,
          is_active: isActive
        });
        window.UI?.showToast('Annonce publiée avec succès !', 'success');
      }

      this.closeAnnouncementModal();
      this.loadAnnouncements();
    } catch (err) {
      console.error('Erreur saveAnnouncement:', err);
      window.UI?.showToast(err.message || 'Erreur lors de l\'enregistrement de l\'annonce.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = id ? '💾 Mettre à jour l\'Annonce' : '💾 Publier l\'Annonce';
      }
    }
  },

  async toggleAnnouncement(id) {
    try {
      const res = await window.API.adminToggleAnnouncement(id);
      window.UI?.showToast(res.message || 'Statut mis à jour !', 'info');
      this.loadAnnouncements();
    } catch (err) {
      console.error('Erreur toggleAnnouncement:', err);
      window.UI?.showToast(err.message || 'Erreur lors du basculement.', 'error');
    }
  },

  async deleteAnnouncement(id, title) {
    if (!confirm(`Es-tu sûr de vouloir supprimer définitivement l'annonce "${title}" ? Toutes les statistiques de lecture seront effacées.`)) {
      return;
    }

    try {
      await window.API.adminDeleteAnnouncement(id);
      window.UI?.showToast('Annonce supprimée définitivement.', 'info');
      this.loadAnnouncements();
    } catch (err) {
      console.error('Erreur deleteAnnouncement:', err);
      window.UI?.showToast(err.message || 'Erreur lors de la suppression.', 'error');
    }
  },

  // ==========================================
  // SECTION JOUEURS EN LIGNE (ADMIN BDE)
  // ==========================================

  async loadOnlinePlayers(showLoading = false) {
    const tbody = document.getElementById('adminOnlinePlayersList');
    if (showLoading && tbody && this.onlinePlayersCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted);"><span class="live-pulse-dot" style="margin-right:0.5rem;"></span> Détection des joueurs connectés...</td></tr>`;
    }
    try {
      const res = await window.API.adminGetOnlinePlayers();
      if (res) {
        this.onOnlinePlayersUpdated(res);
      }
    } catch (err) {
      console.error('Erreur chargement joueurs en ligne:', err);
      if (tbody && this.onlinePlayersCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--lose-red);">Erreur lors de la récupération des joueurs en ligne (${err.message || 'serveur injoignable'}).</td></tr>`;
      }
    }
  },

  onOnlinePlayersUpdated(data) {
    if (!data) return;
    this.onlinePlayersCache = Array.isArray(data.players) ? data.players : [];

    // Mise à jour des cartes de synthèse
    const totalCount = Number(data.totalOnline !== undefined ? data.totalOnline : this.onlinePlayersCache.length);
    const totalTabs = Number(data.totalTabs !== undefined ? data.totalTabs : this.onlinePlayersCache.reduce((s, p) => s + (p.tabCount || 1), 0));
    const totalCoins = Number(data.totalCoins !== undefined ? data.totalCoins : this.onlinePlayersCache.reduce((s, p) => s + (p.coins || 0), 0));
    const activeCount = Number(data.activeRecentCount !== undefined ? data.activeRecentCount : this.onlinePlayersCache.filter(p => (p.idleSeconds || 0) <= 120).length);

    const elTotal = document.getElementById('adminOnlineTotalCount');
    const elActive = document.getElementById('adminOnlineActiveCount');
    const elTabs = document.getElementById('adminOnlineTotalTabs');
    const elCoins = document.getElementById('adminOnlineTotalCoins');
    const elBadge = document.getElementById('adminOnlineTabBadge');

    if (elTotal) elTotal.textContent = totalCount;
    if (elActive) elActive.textContent = activeCount;
    if (elTabs) elTabs.textContent = totalTabs;
    if (elCoins) elCoins.textContent = `${totalCoins.toLocaleString('fr-FR')} 🪙`;
    if (elBadge) {
      elBadge.textContent = totalCount;
      elBadge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
    }

    // Si l'onglet actif est "online", rafraîchir l'affichage du tableau
    if (this.activeTab === 'online') {
      this.renderOnlinePlayers();
    }
  },

  renderOnlinePlayers() {
    const tbody = document.getElementById('adminOnlinePlayersList');
    if (!tbody) return;

    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const formatDuration = (seconds) => {
      if (seconds < 45) return "À l'instant";
      if (seconds < 90) return "Il y a 1 min";
      if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      if (mins === 0) return `Il y a ${hours} h`;
      return `Il y a ${hours} h ${mins} min`;
    };

    const formatAgo = (seconds) => {
      if (seconds < 20) return "à l'instant";
      if (seconds < 60) return `${Math.floor(seconds)} s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
      const hours = Math.floor(seconds / 3600);
      return `${hours} h`;
    };

    const searchQuery = (document.getElementById('adminOnlineSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('adminOnlineStatusFilter')?.value || 'all';
    const sortBy = document.getElementById('adminOnlineSortSelect')?.value || 'connected:desc';

    // Filtrer la liste
    let players = this.onlinePlayersCache.filter(p => {
      if (searchQuery) {
        const usernameMatch = (p.username || '').toLowerCase().includes(searchQuery);
        const firstMatch = (p.firstName || '').toLowerCase().includes(searchQuery);
        const lastMatch = (p.lastName || '').toLowerCase().includes(searchQuery);
        const fullMatch = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(searchQuery);
        if (!usernameMatch && !firstMatch && !lastMatch && !fullMatch) return false;
      }

      const idle = p.idleSeconds !== undefined ? p.idleSeconds : Math.floor((Date.now() - (p.lastActivityAt || p.connectedAt || Date.now())) / 1000);

      if (statusFilter === 'active' && idle > 120) return false;
      if (statusFilter === 'idle' && idle <= 120) return false;
      if (statusFilter === 'multitab' && (p.tabCount || 1) <= 1) return false;

      return true;
    });

    // Trier la liste
    players.sort((a, b) => {
      switch (sortBy) {
        case 'connected:asc':
          return (a.connectedAt || 0) - (b.connectedAt || 0);
        case 'connected:desc':
          return (b.connectedAt || 0) - (a.connectedAt || 0);
        case 'activity:desc':
          return (b.lastActivityAt || 0) - (a.lastActivityAt || 0);
        case 'coins:desc':
          return (b.coins || 0) - (a.coins || 0);
        case 'coins:asc':
          return (a.coins || 0) - (b.coins || 0);
        case 'username:asc':
          return (a.username || '').localeCompare(b.username || '');
        case 'name:asc': {
          const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim() || a.username || '';
          const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim() || b.username || '';
          return nameA.localeCompare(nameB);
        }
        default:
          return (b.connectedAt || 0) - (a.connectedAt || 0);
      }
    });

    if (players.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
            <div style="font-size:2.2rem; margin-bottom:0.6rem;">💤</div>
            <div style="font-weight:700; color:var(--text-secondary); margin-bottom:0.25rem;">Aucun joueur en ligne</div>
            <div style="font-size:0.85rem;">${searchQuery || statusFilter !== 'all' ? 'Aucun élève connecté ne correspond aux filtres actuels.' : 'Aucun élève n\'est actuellement connecté sur le site.'}</div>
          </td>
        </tr>
      `;
      return;
    }

    const now = Date.now();
    tbody.innerHTML = players.map(p => {
      const connectedSec = p.connectedSeconds !== undefined ? p.connectedSeconds : Math.max(0, Math.floor((now - (p.connectedAt || now)) / 1000));
      const idleSec = p.idleSeconds !== undefined ? p.idleSeconds : Math.max(0, Math.floor((now - (p.lastActivityAt || now)) / 1000));
      const connectedDateStr = p.connectedAt ? new Date(p.connectedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
      
      const tabCount = p.tabCount || 1;
      const initial = (p.username || '?').charAt(0).toUpperCase();

      // Badge d'activité
      let activityBadge = '';
      if (idleSec <= 120) {
        activityBadge = `<span class="online-status-pill status-active" title="Dernière interaction il y a ${idleSec}s"><span class="pulse-icon">●</span> Actif (${formatAgo(idleSec)})</span>`;
      } else if (idleSec <= 600) {
        activityBadge = `<span class="online-status-pill status-idle" title="Inactif depuis ${formatAgo(idleSec)}">⏸️ Inactif (${formatAgo(idleSec)})</span>`;
      } else {
        activityBadge = `<span class="online-status-pill status-away" title="Aucune interaction depuis ${formatAgo(idleSec)}">💤 Absent (${formatAgo(idleSec)})</span>`;
      }

      // Nom & Prénom
      let fullNameDisplay = '<span style="color:var(--text-muted); font-style:italic;">Non renseigné</span>';
      if (p.lastName || p.firstName) {
        const last = (p.lastName || '').toUpperCase();
        const first = p.firstName || '';
        fullNameDisplay = `<div style="font-weight:600; color:#FFF;">${esc(last)} ${esc(first)}</div>`;
      }

      // Sessions
      const sessionsDisplay = tabCount > 1
        ? `<span class="tab-counter-pill multi" title="${tabCount} onglets ou fenêtres ouverts">📱💻 ${tabCount} onglets</span>`
        : `<span class="tab-counter-pill" title="1 onglet ouvert">💻 1 onglet</span>`;

      // Rôle
      const roleBadge = p.role === 'admin'
        ? `<span class="admin-role-badge role-admin" style="font-size:0.68rem; padding:0.18rem 0.5rem;">👑 Admin BDE</span>`
        : `<span class="admin-role-badge role-student" style="font-size:0.68rem; padding:0.18rem 0.5rem;">🎓 Élève</span>`;

      // Safe JSON data for button
      const safeUsernameAttr = esc(p.username);

      return `
        <tr>
          <td>
            <div class="admin-user-cell admin-clickable-user" onclick="AdminBDE.openPlayerDetailModal(${p.userId})" title="Voir la fiche détaillée de ${safeUsernameAttr}">
              <div class="admin-user-avatar">${esc(initial)}</div>
              <div>
                <div style="font-weight:700; color:var(--gold-light); font-size:0.95rem;">${esc(p.username)} <span style="font-size:0.75rem; opacity:0.7;">📊</span></div>
                <div style="margin-top:0.2rem;">${roleBadge}</div>
              </div>
            </div>
          </td>
          <td>${fullNameDisplay}</td>
          <td>
            <span style="font-weight:700; color:var(--gold-primary); font-family:var(--font-mono); font-size:0.95rem;">
              ${Number(p.coins || 0).toLocaleString('fr-FR')} 🪙
            </span>
          </td>
          <td>
            <div style="font-weight:600; color:#FFF;">${formatDuration(connectedSec)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Depuis ${connectedDateStr}</div>
          </td>
          <td>${activityBadge}</td>
          <td>${sessionsDisplay}</td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end; flex-wrap:wrap;">
              <button class="admin-btn-action" style="border-color:var(--gold-primary); color:var(--gold-light);"
                data-action="view-player" data-user-id="${p.userId}"
                onclick="AdminBDE.openPlayerDetailModal(${p.userId})"
                title="Fiche détaillée et statistiques de ${safeUsernameAttr}">
                📊 Fiche
              </button>
              <button class="admin-btn-action admin-btn-coins" 
                data-action="edit-coins" data-user-id="${p.userId}"
                onclick="AdminBDE.openUserCoinsModal(${p.userId})"
                title="Ajuster le solde de ${safeUsernameAttr}">
                🪙 Solde
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==========================================
  // SECTION FICHE JOUEUR DÉTAILLÉE (ADMIN)
  // ==========================================

  currentPlayerId: null,
  currentPlayerData: null,
  currentPlayerGamesPage: 1,
  currentPlayerActiveTab: 'games',

  async openPlayerDetailModal(userId, page = 1) {
    if (!userId) return;
    this.currentPlayerId = userId;
    this.currentPlayerGamesPage = page;

    const modal = document.getElementById('adminPlayerDetailModal');
    if (!modal) return;
    modal.classList.add('active');

    // Réinitialiser les affichages
    const elUsername = document.getElementById('playerDetailUsername');
    const elFullName = document.getElementById('playerDetailFullName');
    const elEmail = document.getElementById('playerDetailEmail');
    const elId = document.getElementById('playerDetailId');

    if (elUsername) elUsername.textContent = 'Chargement...';
    if (elFullName) elFullName.textContent = 'Vérification en cours...';
    if (elEmail) elEmail.textContent = '...';
    if (elId) elId.textContent = userId;

    const gamesListEl = document.getElementById('playerDetailGamesList');
    if (gamesListEl) gamesListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);"><span class="spinner-small" style="display:inline-block; margin-right:8px;"></span> Chargement de la fiche joueur...</td></tr>';
    
    const promosListEl = document.getElementById('playerDetailPromosList');
    if (promosListEl) promosListEl.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">Chargement...</td></tr>';
    
    const adjustListEl = document.getElementById('playerDetailAdjustmentsList');
    if (adjustListEl) adjustListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Chargement...</td></tr>';
    
    const delivListEl = document.getElementById('playerDetailDeliveriesList');
    if (delivListEl) delivListEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Chargement...</td></tr>';

    try {
      const data = await window.API.adminGetUserDetails(userId, { page, limit: 15 });
      this.currentPlayerData = data;
      this.renderPlayerDetailData(data);
    } catch (err) {
      console.error('Erreur openPlayerDetailModal:', err);
      window.UI?.showToast(err.message || 'Impossible de charger la fiche joueur.', 'error');
      if (gamesListEl) {
        gamesListEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--lose-red);">Erreur: ${window.escapeHtml ? window.escapeHtml(err.message) : err.message}</td></tr>`;
      }
    }
  },

  async loadPlayerGamesPage(page) {
    if (!this.currentPlayerId) return;
    this.currentPlayerGamesPage = page;

    const tbody = document.getElementById('playerDetailGamesList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);"><span class="spinner-small" style="display:inline-block; margin-right:8px;"></span> Chargement de la page ' + page + '...</td></tr>';
    }

    try {
      const data = await window.API.adminGetUserDetails(this.currentPlayerId, { page, limit: 15 });
      if (this.currentPlayerData) {
        this.currentPlayerData.games = data.games;
        this.currentPlayerData.pagination = data.pagination;
      } else {
        this.currentPlayerData = data;
      }
      this.renderPlayerGamesTab(data.games, data.pagination);
    } catch (err) {
      console.error('Erreur loadPlayerGamesPage:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--lose-red);">Erreur lors du chargement des parties.</td></tr>`;
    }
  },

  closePlayerDetailModal() {
    const modal = document.getElementById('adminPlayerDetailModal');
    if (modal) modal.classList.remove('active');
    this.currentPlayerId = null;
  },

  switchPlayerDetailTab(tabName) {
    this.currentPlayerActiveTab = tabName;
    document.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const tabs = ['games', 'promos', 'adjustments', 'deliveries'];
    tabs.forEach(t => {
      const el = document.getElementById(`playerContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (el) {
        el.style.display = (t === tabName) ? 'block' : 'none';
      }
    });
  },

  renderPlayerDetailData(data) {
    if (!data || !data.user) return;
    const u = data.user;
    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Header info
    const elUsername = document.getElementById('playerDetailUsername');
    const elFullName = document.getElementById('playerDetailFullName');
    const elEmail = document.getElementById('playerDetailEmail');
    const elId = document.getElementById('playerDetailId');
    const elAvatar = document.getElementById('playerDetailAvatar');
    const elRoleBadge = document.getElementById('playerDetailRoleBadge');
    const elVipBadge = document.getElementById('playerDetailVipBadge');
    const elOnlineStatus = document.getElementById('playerDetailOnlineStatus');

    if (elUsername) elUsername.textContent = u.username;
    if (elFullName) {
      const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      elFullName.textContent = full || 'Nom non renseigné';
    }
    if (elEmail) {
      elEmail.innerHTML = u.email
        ? `✉️ ${esc(u.email)} ${u.email_verified ? '<span title="Email vérifié" style="color:#34D399; font-weight:700;">✓</span>' : '<span title="Email non vérifié" style="color:#F87171; font-weight:700;">⚠️</span>'}`
        : '<em>Aucun email</em>';
    }
    if (elId) elId.textContent = u.id;
    if (elAvatar) elAvatar.textContent = (u.username || '?').charAt(0).toUpperCase();

    // Rôle badge
    if (elRoleBadge) {
      if (u.role === 'admin') {
        elRoleBadge.className = 'admin-role-badge role-admin';
        elRoleBadge.textContent = '🛡️ Admin BDE';
      } else {
        elRoleBadge.className = 'admin-role-badge role-student';
        elRoleBadge.textContent = '🎓 Élève';
      }
    }

    // VIP badge & Multiplicateur
    const currentTier = (u.vipInfo && u.vipInfo.currentTier) ? u.vipInfo.currentTier : (u.vipInfo || {});
    const vipName = currentTier.name || currentTier.rank || 'Bronze';
    const vipIcon = currentTier.icon || '🥉';
    const vipBadgeClass = currentTier.badgeClass || 'vip-bronze';
    const vipMultiplier = currentTier.bonusMultiplier || 1.0;

    if (elVipBadge) {
      elVipBadge.className = `vip-badge ${vipBadgeClass}`;
      elVipBadge.textContent = `${vipIcon} ${vipName.toUpperCase()}`;
    }

    // Online status
    if (elOnlineStatus) {
      if (u.isOnline) {
        elOnlineStatus.className = 'online-status-pill status-active';
        elOnlineStatus.innerHTML = '<span class="pulse-icon">●</span> En ligne';
      } else {
        elOnlineStatus.className = 'online-status-pill status-away';
        elOnlineStatus.innerHTML = '⚪ Hors ligne';
      }
    }

    // 4 Key metric cards
    const elCoins = document.getElementById('playerDetailCoins');
    const elWager = document.getElementById('playerDetailWager');
    const elIp = document.getElementById('playerDetailIp');
    const elIpWarning = document.getElementById('playerDetailIpWarning');
    const elCreatedAt = document.getElementById('playerDetailCreatedAt');
    const elGamesCount = document.getElementById('playerDetailGamesCount');
    const elBiggestWin = document.getElementById('playerDetailBiggestWin');
    const elStreak = document.getElementById('playerDetailStreak');
    const elVipMultiplier = document.getElementById('playerDetailVipMultiplier');

    if (elCoins) elCoins.textContent = `${Number(u.coins || 0).toLocaleString('fr-FR')} 🪙`;
    if (elWager) elWager.textContent = `${Number(u.total_wagered || 0).toLocaleString('fr-FR')} 🪙`;

    const createdAtStr = u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    if (elCreatedAt) elCreatedAt.textContent = createdAtStr;

    // IP Registration & multi-account warning
    if (elIp) {
      elIp.textContent = u.registration_ip || 'Non enregistrée';
    }
    if (elIpWarning) {
      if (u.sameIpAccountsCount > 0) {
        const otherNames = (u.sameIpAccounts || []).map(a => a.username).join(', ');
        elIpWarning.innerHTML = `Inscrit le ${createdAtStr} • <span style="color:#F87171; font-weight:700;">⚠️ ${u.sameIpAccountsCount} autre(s) compte(s) avec cette IP :</span> <span style="color:#FCA5A5;">${esc(otherNames)}</span>`;
      } else {
        elIpWarning.innerHTML = `Inscrit le ${createdAtStr} • <span style="color:#34D399;">✓ IP d'inscription unique</span>`;
      }
    }

    if (elGamesCount) elGamesCount.textContent = (data.pagination?.totalGames || u.games_played || 0).toLocaleString('fr-FR');
    if (elBiggestWin) elBiggestWin.textContent = `${Number(u.biggest_win || 0).toLocaleString('fr-FR')} 🪙`;
    if (elStreak) elStreak.textContent = u.daily_streak || 0;
    if (elVipMultiplier) elVipMultiplier.textContent = `x${Number(vipMultiplier || 1.0).toFixed(2)}`;

    // Tab badges
    const badgeGames = document.getElementById('playerTabBadgeGames');
    const badgePromos = document.getElementById('playerTabBadgePromos');
    const badgeAdjustments = document.getElementById('playerTabBadgeAdjustments');
    const badgeDeliveries = document.getElementById('playerTabBadgeDeliveries');

    if (badgeGames) badgeGames.textContent = (data.pagination?.totalGames || 0).toLocaleString('fr-FR');
    if (badgePromos) badgePromos.textContent = (data.promoCodes?.length || 0);
    if (badgeAdjustments) badgeAdjustments.textContent = (data.adjustments?.length || 0);
    if (badgeDeliveries) badgeDeliveries.textContent = (data.deliveries?.length || 0);

    // Breakdown par type de jeu
    const breakdownEl = document.getElementById('playerGamesBreakdown');
    if (breakdownEl) {
      if (data.statsByGame && data.statsByGame.length > 0) {
        const gameIcons = {
          blackjack: '🃏 Blackjack',
          roulette: '🎡 Roulette',
          slots: '🎰 Machines',
          mines: '💣 Mines',
          crash: '🚀 Crash',
          plinko: '⚪ Plinko',
          keno: '🎱 Keno',
          dice: '🎲 Dés',
          wheel: '🎡 Roue',
          videopoker: '🎴 Vidéo Poker',
          dragontower: '🐲 Tour Dragon',
          scratch: '🎫 Grattage'
        };
        breakdownEl.innerHTML = data.statsByGame.map(s => {
          const name = gameIcons[s.game_type] || s.game_type;
          const net = s.net_profit || 0;
          const netColor = net > 0 ? '#34D399' : (net < 0 ? '#F87171' : 'var(--text-muted)');
          return `
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.35rem 0.65rem; font-size:0.78rem;">
              <strong>${name}</strong>: ${s.count} parties · P/L: <span style="font-weight:700; color:${netColor};">${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')} 🪙</span>
            </div>
          `;
        }).join('');
      } else {
        breakdownEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">Aucune partie enregistrée pour ce joueur.</div>';
      }
    }

    // Render Tab 1 : Games
    this.renderPlayerGamesTab(data.games || [], data.pagination || {});

    // Render Tab 2 : Promo Codes
    this.renderPlayerPromosTab(data.promoCodes || []);

    // Render Tab 3 : Admin Adjustments
    this.renderPlayerAdjustmentsTab(data.adjustments || []);

    // Render Tab 4 : Deliveries
    this.renderPlayerDeliveriesTab(data.deliveries || []);
  },

  renderPlayerGamesTab(games, pagination) {
    const tbody = document.getElementById('playerDetailGamesList');
    if (!tbody) return;
    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (!games || games.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucune partie jouée sur cette page.</td></tr>';
      return;
    }

    const gameNames = {
      blackjack: '🃏 Blackjack',
      roulette: '🎡 Roulette',
      slots: '🎰 Machines à Sous',
      mines: '💣 Mines',
      crash: '🚀 Crash Spatial',
      plinko: '⚪ Plinko',
      keno: '🎱 Keno Cosmique',
      dice: '🎲 Dés Cosmiques',
      wheel: '🎡 Roue de la Fortune',
      videopoker: '🎴 Vidéo Poker',
      dragontower: '🐲 Tour du Dragon',
      scratch: '🎫 Carte à Gratter'
    };

    tbody.innerHTML = games.map(g => {
      const dateStr = g.created_at ? new Date(g.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const gameLabel = gameNames[g.game_type] || g.game_type;
      const profit = g.profit !== undefined ? g.profit : (g.payout - g.bet);

      let profitDisplay = '<span style="color:var(--text-muted);">0 🪙</span>';
      if (profit > 0) {
        profitDisplay = `<strong style="color:var(--win-green); font-weight:700;">+${profit.toLocaleString('fr-FR')} 🪙</strong>`;
      } else if (profit < 0) {
        profitDisplay = `<strong style="color:var(--lose-red); font-weight:700;">${profit.toLocaleString('fr-FR')} 🪙</strong>`;
      }

      let resultBadge = '';
      if (g.payout > 0) {
        resultBadge = `<span class="badge" style="background:rgba(16,185,129,0.18); color:#34D399; border:1px solid rgba(16,185,129,0.4); padding:2px 6px; border-radius:4px; font-size:0.75rem;">Gagné (${g.payout.toLocaleString('fr-FR')} 🪙)</span>`;
      } else {
        resultBadge = `<span class="badge" style="background:rgba(239,68,68,0.15); color:#F87171; border:1px solid rgba(239,68,68,0.3); padding:2px 6px; border-radius:4px; font-size:0.75rem;">Perdu</span>`;
      }

      // Details summary
      let detailsSummary = '-';
      if (g.details) {
        if (typeof g.details === 'object') {
          const keys = Object.keys(g.details).filter(k => k !== 'deck' && k !== 'cards');
          if (keys.length > 0) {
            detailsSummary = keys.slice(0, 3).map(k => `${k}: ${g.details[k]}`).join(', ');
          }
        } else {
          detailsSummary = String(g.details);
        }
      }

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:0.8rem; font-family:var(--font-mono);">${dateStr}</td>
          <td><strong style="color:#FFF;">${gameLabel}</strong></td>
          <td><span style="font-family:var(--font-mono); font-weight:600; color:var(--gold-light);">${Number(g.bet || 0).toLocaleString('fr-FR')} 🪙</span></td>
          <td>${resultBadge}</td>
          <td>${profitDisplay}</td>
          <td style="font-size:0.75rem; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(JSON.stringify(g.details || ''))}">${esc(detailsSummary)}</td>
        </tr>
      `;
    }).join('');

    // Pagination
    const page = pagination.page || 1;
    const totalPages = pagination.totalPages || 1;
    const pageInfo = document.getElementById('playerGamesPageInfo');
    const btnPrev = document.getElementById('btnPlayerGamesPrev');
    const btnNext = document.getElementById('btnPlayerGamesNext');

    if (pageInfo) pageInfo.textContent = `Page ${page} / ${totalPages} (${pagination.totalGames || 0} parties)`;
    if (btnPrev) btnPrev.disabled = (page <= 1);
    if (btnNext) btnNext.disabled = (page >= totalPages);
  },

  renderPlayerPromosTab(promos) {
    const tbody = document.getElementById('playerDetailPromosList');
    if (!tbody) return;
    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (!promos || promos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucun code promo BDE utilisé par cet élève.</td></tr>';
      return;
    }

    tbody.innerHTML = promos.map(p => {
      const dateStr = p.used_at ? new Date(p.used_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      return `
        <tr>
          <td><span style="font-family:var(--font-mono); font-weight:700; color:var(--gold-light); background:rgba(212,175,55,0.12); padding:3px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.25);">${esc(p.code)}</span></td>
          <td><strong style="color:var(--win-green); font-size:0.95rem;">+${Number(p.coins_awarded || 0).toLocaleString('fr-FR')} 🪙</strong></td>
          <td style="color:var(--text-secondary); font-size:0.82rem;">${dateStr}</td>
        </tr>
      `;
    }).join('');
  },

  renderPlayerAdjustmentsTab(adjustments) {
    const tbody = document.getElementById('playerDetailAdjustmentsList');
    if (!tbody) return;
    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (!adjustments || adjustments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucun ajustement manuel effectué par un administrateur sur ce compte.</td></tr>';
      return;
    }

    tbody.innerHTML = adjustments.map(a => {
      const dateStr = a.created_at ? new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const modeLabel = a.mode === 'add' ? '➕ Ajout' : (a.mode === 'remove' ? '➖ Retrait' : '⚙️ Définition');

      let varDisplay = '';
      if (a.mode === 'add') {
        varDisplay = `<strong style="color:var(--win-green);">+${Number(a.amount).toLocaleString('fr-FR')} 🪙</strong>`;
      } else if (a.mode === 'remove') {
        varDisplay = `<strong style="color:var(--lose-red);">-${Number(a.amount).toLocaleString('fr-FR')} 🪙</strong>`;
      } else {
        varDisplay = `<strong style="color:var(--gold-primary);">${Number(a.amount).toLocaleString('fr-FR')} 🪙</strong>`;
      }

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:0.8rem; font-family:var(--font-mono);">${dateStr}</td>
          <td><strong style="color:#FFF;">🛡️ ${esc(a.admin_username || 'Admin BDE')}</strong></td>
          <td><span style="font-size:0.8rem; color:var(--text-secondary);">${modeLabel}</span></td>
          <td>${varDisplay}</td>
          <td style="font-size:0.8rem; font-family:var(--font-mono); color:var(--text-secondary);">
            ${Number(a.previous_balance || 0).toLocaleString('fr-FR')} ➔ <strong style="color:#FFF;">${Number(a.new_balance || 0).toLocaleString('fr-FR')} 🪙</strong>
          </td>
          <td>
            <div style="background:rgba(255,255,255,0.05); border-left:3px solid var(--gold-primary); padding:4px 8px; border-radius:4px; font-size:0.82rem; color:#E2E8F0;">
              📝 "${esc(a.reason || 'Aucune note')}"
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPlayerDeliveriesTab(deliveries) {
    const tbody = document.getElementById('playerDetailDeliveriesList');
    if (!tbody) return;
    const esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (!deliveries || deliveries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucune demande de récompense ou lot pour ce joueur.</td></tr>';
      return;
    }

    tbody.innerHTML = deliveries.map(d => {
      const dateStr = d.created_at ? new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      
      let statusBadge = '';
      if (d.status === 'delivered') {
        statusBadge = '<span class="stock-badge in-stock">✅ Livré</span>';
      } else if (d.status === 'cancelled') {
        statusBadge = '<span class="stock-badge out-of-stock">❌ Annulé</span>';
      } else {
        statusBadge = '<span class="stock-badge low-stock">⏳ En attente</span>';
      }

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:0.8rem; font-family:var(--font-mono);">${dateStr}</td>
          <td>
            <div style="font-weight:700; color:#FFF;">${esc(d.item_name)}</div>
            ${d.variant_name ? `<div style="font-size:0.75rem; color:var(--gold-light);">${esc(d.variant_name)}</div>` : ''}
          </td>
          <td><span style="font-size:0.85rem; color:var(--text-secondary);">${esc(d.room_location || '-')}</span></td>
          <td><span style="font-size:0.85rem; font-family:var(--font-mono); color:var(--text-muted);">${esc(d.phone || '-')}</span></td>
          <td>${statusBadge}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${esc(d.notes || '-')}</td>
        </tr>
      `;
    }).join('');
  }
};

window.AdminBDE = AdminBDE;
