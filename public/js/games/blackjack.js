// Blackjack Game Frontend Logic

const BlackjackGame = {
  currentBet: 50,
  inGame: false,

  init() {
    this.bindEvents();
    this.checkExistingGame();
  },

  bindEvents() {
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');

    if (dealBtn) dealBtn.addEventListener('click', () => this.deal());
    if (hitBtn) hitBtn.addEventListener('click', () => this.hit());
    if (standBtn) standBtn.addEventListener('click', () => this.stand());
    if (doubleBtn) doubleBtn.addEventListener('click', () => this.double());

    // Puces de mise
    document.querySelectorAll('#view-blackjack .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this.inGame) return;
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    const multBtns = document.querySelectorAll('#view-blackjack .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        if (this.inGame) return;
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(1, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        window.sound.playChip();
      });
    });
  },

  setBet(val) {
    this.currentBet = Math.max(1, val);
    const input = document.getElementById('bjBetInput');
    if (input) input.value = this.currentBet;
  },

  renderCard(card) {
    const el = document.createElement('div');
    if (card.color === 'hidden' || card.rank === '?') {
      el.className = 'bj-card card-hidden';
      return el;
    }

    el.className = `bj-card ${card.color || 'black'}`;
    el.innerHTML = `
      <div class="card-top">
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${card.suit}</span>
      </div>
      <div class="card-center">${card.suit}</div>
      <div class="card-bottom">
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${card.suit}</span>
      </div>
    `;
    return el;
  },

  updateTable(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const playerCardsEl = document.getElementById('bjPlayerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');
    const playerScoreEl = document.getElementById('bjPlayerScore');

    if (dealerCardsEl && data.dealerHand) {
      dealerCardsEl.innerHTML = '';
      data.dealerHand.forEach(c => dealerCardsEl.appendChild(this.renderCard(c)));
    }

    if (playerCardsEl && data.playerHand) {
      playerCardsEl.innerHTML = '';
      data.playerHand.forEach(c => playerCardsEl.appendChild(this.renderCard(c)));
    }

    if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';
    if (playerScoreEl) playerScoreEl.textContent = data.playerScore !== undefined ? data.playerScore : '-';

    // Boutons d'action
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');

    if (data.status === 'playing') {
      this.inGame = true;
      if (dealBtn) dealBtn.style.display = 'none';
      if (hitBtn) hitBtn.style.display = 'inline-flex';
      if (standBtn) standBtn.style.display = 'inline-flex';
      if (doubleBtn) {
        doubleBtn.style.display = data.canDouble ? 'inline-flex' : 'none';
      }
    } else {
      this.inGame = false;
      if (dealBtn) dealBtn.style.display = 'inline-flex';
      if (hitBtn) hitBtn.style.display = 'none';
      if (standBtn) standBtn.style.display = 'none';
      if (doubleBtn) doubleBtn.style.display = 'none';
    }
  },

  async checkExistingGame() {
    if (!window.State.isAuthenticated) return;
    try {
      const data = await window.API.getBlackjackState();
      if (data.activeGame) {
        this.updateTable(data);
      }
    } catch (e) {}
  },

  async deal() {
    if (!window.State.isAuthenticated) {
      window.UI.showToast('Veuillez vous connecter pour jouer.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour miser.', 'error');
      return;
    }

    const banner = document.getElementById('bjResultBanner');
    if (banner) banner.style.display = 'none';

    window.sound.playCard();

    try {
      const data = await window.API.dealBlackjack(this.currentBet);
      if (data.coins !== undefined) window.State.updateCoins(data.coins);
      this.updateTable(data);

      if (data.status === 'finished') {
        this.handleFinish(data);
      }
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async hit() {
    window.sound.playCard();
    try {
      const data = await window.API.hitBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);
      this.updateTable(data);

      if (data.status === 'finished') {
        this.handleFinish(data);
      }
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async stand() {
    window.sound.playCard();
    try {
      const data = await window.API.standBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);
      this.updateTable(data);
      this.handleFinish(data);
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async double() {
    window.sound.playChip();
    window.sound.playCard();
    try {
      const data = await window.API.doubleBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);
      this.updateTable(data);
      this.handleFinish(data);
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  handleFinish(data) {
    const banner = document.getElementById('bjResultBanner');
    if (!banner) return;

    if (data.outcome === 'blackjack') {
      banner.textContent = `👑 BLACKJACK NATUREL ! +${data.payout} JETONS !`;
      banner.className = 'result-banner win';
      banner.style.display = 'block';
      window.sound.playJackpot();
      window.UI.triggerConfetti();
    } else if (data.outcome === 'win' || data.outcome === 'dealer_bust') {
      banner.textContent = `🎉 VICTOIRE ! +${data.payout} JETONS !`;
      banner.className = 'result-banner win';
      banner.style.display = 'block';
      window.sound.playWin();
      window.UI.triggerConfetti();
    } else if (data.outcome === 'push') {
      banner.textContent = `🤝 ÉGALITÉ (PUSH) : Mise remboursée (+${data.payout})`;
      banner.className = 'result-banner';
      banner.style.color = '#FDE047';
      banner.style.borderColor = '#FDE047';
      banner.style.display = 'block';
    } else {
      banner.textContent = data.outcome === 'bust' ? '💥 BUST (> 21) ! Partie perdue.' : '❌ La maison l’emporte ce coup-ci.';
      banner.className = 'result-banner lose';
      banner.style.display = 'block';
      window.sound.playLose();
    }
  }
};

window.BlackjackGame = BlackjackGame;
