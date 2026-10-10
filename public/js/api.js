// Marsabet API Client

const API = {
  baseUrl: '/api',

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

  async getShopItems() {
    return this.request('/user/shop');
  },

  async orderShopProduct(productId, variantName = null) {
    return this.request('/user/shop/order', {
      method: 'POST',
      body: JSON.stringify({ productId, variantName })
    });
  },

  async getMyOrders() {
    return this.request('/user/shop/my-orders');
  },

  async becomeAdmin(secretKey) {
    return this.request('/auth/become-admin', {
      method: 'POST',
      body: JSON.stringify({ secretKey })
    });
  },

  // Admin BDE Endpoints
  async adminCheckCode(code) {
    return this.request(`/admin/claims/check?code=${encodeURIComponent(code)}`);
  },

  async adminValidateCode(code) {
    return this.request('/admin/claims/validate', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  async adminGetAllOrders(status = 'all', search = '') {
    let url = `/admin/orders?status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.request(url);
  },

  async adminGetProducts() {
    return this.request('/admin/products');
  },

  async adminCreateProduct(data) {
    return this.request('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async adminUpdateProduct(id, data) {
    return this.request(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async adminDeleteProduct(id) {
    return this.request(`/admin/products/${id}`, {
      method: 'DELETE'
    });
  },

  async getGlobalStats() {
    return this.request('/stats');
  },

  // Games endpoints
  async spinSlots(bet) {
    return this.request('/games/slots/spin', {
      method: 'POST',
      body: JSON.stringify({ bet })
    });
  },

  async getBlackjackState() {
    return this.request('/games/blackjack/state');
  },

  async dealBlackjack(bet) {
    return this.request('/games/blackjack/deal', {
      method: 'POST',
      body: JSON.stringify({ bet })
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

  async dropPlinko(bet, risk) {
    return this.request('/games/plinko/drop', {
      method: 'POST',
      body: JSON.stringify({ bet, risk })
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
  }
};

window.API = API;
