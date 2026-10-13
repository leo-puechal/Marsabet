// Marsabet API Client

const API = {
  baseUrl: (typeof window !== 'undefined' && (window.REACT_APP_API_URL || window.MARSABET_API_URL)) || '/api',

  getToken() {
    return localStorage.getItem('marsabet_token');
  },

  setToken(token) {
    localStorage.setItem('marsabet_token', token);
  },

  clearToken() {
    localStorage.removeItem('marsabet_token');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
          this.clearToken();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error(data.error || 'Une erreur est survenue.');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth endpoints
  async register(username, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async claimDailyBonus() {
    return this.request('/auth/daily-bonus', {
      method: 'POST'
    });
  },

  // User & Stats
  async getLeaderboard() {
    return this.request('/leaderboard');
  },

  async getProfile() {
    return this.request('/user/profile');
  },

  async confirmWheelDelivery(data) {
    return this.request('/wheels/confirm-delivery', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Fortune Wheels Endpoints
  async getWheels() {
    return this.request('/wheels');
  },

  async getWheelDetails(wheelId) {
    return this.request(`/wheels/${encodeURIComponent(wheelId)}`);
  },

  async spinFortuneWheel(wheelId) {
    return this.request(`/wheels/${encodeURIComponent(wheelId)}/spin`, {
      method: 'POST'
    });
  },

  async getMyRewards() {
    return this.request('/wheels/my-rewards');
  },

  async becomeAdmin(secretKey) {
    return this.request('/auth/become-admin', {
      method: 'POST',
      body: JSON.stringify({ secretKey })
    });
  },

  // Admin BDE Endpoints pour le suivi des livraisons
  async adminGetDeliveries(status = 'all', search = '') {
    let url = `/admin/deliveries?status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.request(url);
  },

  async adminMarkDelivered(deliveryId) {
    return this.request(`/admin/deliveries/${encodeURIComponent(deliveryId)}/deliver`, {
      method: 'PATCH'
    });
  },

  async adminGetAllOrders(status = 'all', search = '') {
    return this.adminGetDeliveries(status, search);
  },

  // Wheels Admin Endpoints
  async adminGetWheels() {
    return this.request('/admin/wheels');
  },

  async adminUpdateWheelSegments(id, segments) {
    return this.request(`/admin/wheels/${id}/segments`, {
      method: 'PUT',
      body: JSON.stringify({ segments })
    });
  },

  // Users Admin Endpoints (Gestion des comptes, soldes, rôles et suppression)
  async adminGetUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/users${q ? '?' + q : ''}`);
  },

  async adminUpdateUserCoins(userId, data) {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/coins`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async adminUpdateUserRole(userId, role) {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  },

  async adminDeleteUser(userId) {
    return this.request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  // Promo Codes Admin & User Endpoints
  async redeemPromoCode(code) {
    return this.request('/users/redeem-code', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  async getMyPromoCodes() {
    return this.request('/users/my-codes');
  },

  async adminGetPromoCodes() {
    return this.request('/admin/promo-codes');
  },

  async adminCreatePromoCode(data) {
    return this.request('/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async adminTogglePromoCode(id) {
    return this.request(`/admin/promo-codes/${id}/toggle`, {
      method: 'PATCH'
    });
  },

  async adminDeletePromoCode(id) {
    return this.request(`/admin/promo-codes/${id}`, {
      method: 'DELETE'
    });
  },

  async getGlobalStats() {
    return this.request('/stats');
  },

  // Games endpoints
  async getSlotsState() {
    return this.request('/games/slots/state');
  },

  async spinSlots(data) {
    const payload = typeof data === 'object' ? data : { bet: data };
    return this.request('/games/slots/spin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async gambleSlots(choice) {
    return this.request('/games/slots/gamble', {
      method: 'POST',
      body: JSON.stringify({ choice })
    });
  },

  async collectSlotsGamble() {
    return this.request('/games/slots/collect', {
      method: 'POST'
    });
  },

  async getBlackjackState() {
    return this.request('/games/blackjack/state');
  },

  async dealBlackjack(bet, handsCount = 1, sidebets = {}) {
    return this.request('/games/blackjack/deal', {
      method: 'POST',
      body: JSON.stringify({ bet, handsCount, sidebets })
    });
  },

  async hitBlackjack() {
    return this.request('/games/blackjack/hit', {
      method: 'POST'
    });
  },

  async standBlackjack() {
    return this.request('/games/blackjack/stand', {
      method: 'POST'
    });
  },

  async doubleBlackjack() {
    return this.request('/games/blackjack/double', {
      method: 'POST'
    });
  },

  async splitBlackjack() {
    return this.request('/games/blackjack/split', {
      method: 'POST'
    });
  },

  async spinRoulette(bets) {
    return this.request('/games/roulette/spin', {
      method: 'POST',
      body: JSON.stringify({ bets })
    });
  },

  async rollDice(bet, mode, options) {
    return this.request('/games/dice/roll', {
      method: 'POST',
      body: JSON.stringify({ bet, mode, options })
    });
  },

  async spinWheel(bet) {
    return this.request('/games/wheel/spin', {
      method: 'POST',
      body: JSON.stringify({ bet })
    });
  },

  async dropPlinko(bet, risk, ballCount = 1) {
    return this.request('/games/plinko/drop', {
      method: 'POST',
      body: JSON.stringify({ bet, risk, ballCount })
    });
  },

  // Free Daily Wheel
  async getFreeWheelStatus() {
    return this.request('/games/free-wheel/status');
  },

  async spinFreeWheel() {
    return this.request('/games/free-wheel/spin', {
      method: 'POST'
    });
  },

  // Slider
  async playSlider(data) {
    return this.request('/games/slider/play', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Crash
  async getCrashHistory() {
    return this.request('/games/crash/history');
  },

  async startCrash(param) {
    const body = (typeof param === 'object' && param !== null) ? param : { bet: param };
    return this.request('/games/crash/play', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async cashoutCrash(param1, param2) {
    const body = (typeof param1 === 'object' && param1 !== null) ? param1 : { gameId: param1, multiplier: param2 };
    return this.request('/games/crash/cashout', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async finishCrash(param) {
    const body = (typeof param === 'object' && param !== null) ? param : { gameId: param };
    return this.request('/games/crash/finish', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // Vidéo Poker (Jacks or Better)
  async getVideoPokerState() {
    return this.request('/games/video-poker/state');
  },

  async dealVideoPoker(bet) {
    return this.request('/games/video-poker/deal', {
      method: 'POST',
      body: JSON.stringify({ bet })
    });
  },

  async drawVideoPoker(holds) {
    return this.request('/games/video-poker/draw', {
      method: 'POST',
      body: JSON.stringify({ holds })
    });
  },

  // Dragon Tower
  async getDragonTowerState() {
    return this.request('/games/dragon-tower/state');
  },

  async startDragonTower(bet, difficulty = 'medium') {
    return this.request('/games/dragon-tower/start', {
      method: 'POST',
      body: JSON.stringify({ bet, difficulty })
    });
  },

  async stepDragonTower(tileIndex) {
    return this.request('/games/dragon-tower/step', {
      method: 'POST',
      body: JSON.stringify({ tileIndex })
    });
  },

  async cashoutDragonTower() {
    return this.request('/games/dragon-tower/cashout', {
      method: 'POST'
    });
  }
};

window.API = API;
