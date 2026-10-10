// Blackjack Game Frontend Logic — Marsabet
// Distribution séquentielle animée carte par carte + Flip 3D

const BlackjackGame = {
  currentBet: 50,
  inGame: false,
  isDealing: false,

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
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        if (window.sound) window.sound.playChip();
      });
    });

    const multBtns = document.querySelectorAll('#view-blackjack .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(1, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        if (window.sound) window.sound.playChip();
      });
    });
  },

  setBet(val) {
    this.currentBet = Math.max(1, val);
    const input = document.getElementById('bjBetInput');
    if (input) input.value = this.currentBet;
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  pulseShoe() {
    const shoe = document.getElementById('bjDeckShoe');
    if (shoe) {
      shoe.classList.remove('card-dealing');
      void shoe.offsetWidth; // Trigger reflow
      shoe.classList.add('card-dealing');
    }
  },

  createCardElement(card, isFacedown = false, animate = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `bj-card-wrapper ${animate ? 'animate-deal' : ''}`;

    const cardDiv = document.createElement('div');
    cardDiv.className = `bj-card ${isFacedown ? 'flipped' : ''}`;

    // Face avant
    const color = (card.suit === '♥' || card.suit === '♦' || card.color === 'red') ? 'red' : 'black';
    const rank = card.rank && card.rank !== '?' ? card.rank : '';
    const suit = card.suit && card.suit !== '?' ? card.suit : '';

    let centerHtml = suit;
    if (['J', 'Q', 'K'].includes(rank)) {
      const figureGlyphs = { 'K': '👑', 'Q': '👸', 'J': '⚔️' };
      centerHtml = `
        <div class="figure-illustration">
          <span class="figure-avatar">${figureGlyphs[rank] || '👑'}</span>
          <span class="figure-suit-mini">${suit}</span>
        </div>
      `;
    } else if (rank === 'A') {
      centerHtml = `<div class="ace-center">${suit}</div>`;
    } else if (rank) {
      centerHtml = `
        <div class="number-center">
          <span class="pip-val">${rank}</span>
          <span class="pip-suit">${suit}</span>
        </div>
      `;
    }

    const frontDiv = document.createElement('div');
    frontDiv.className = `bj-card-front ${color}`;
    frontDiv.innerHTML = `
      <div class="card-corner card-top-left">
        <span class="card-rank">${rank}</span>
        <span class="card-suit">${suit}</span>
      </div>
      <div class="card-center">${centerHtml}</div>
      <div class="card-corner card-bottom-right">
        <span class="card-rank">${rank}</span>
        <span class="card-suit">${suit}</span>
      </div>
    `;

    // Face arrière (Cosmique Mars)
    const backDiv = document.createElement('div');
    backDiv.className = 'bj-card-back';
    backDiv.innerHTML = `
      <div class="card-back-pattern">
        <div class="card-back-crest">
          <span class="crest-icon">🪐</span>
          <span class="crest-text">MARSABET</span>
        </div>
      </div>
    `;

    cardDiv.appendChild(frontDiv);
    cardDiv.appendChild(backDiv);
    wrapper.appendChild(cardDiv);

    return wrapper;
  },

  async checkExistingGame() {
    if (!window.State.isAuthenticated) return;
    try {
      const data = await window.API.getBlackjackState();
      if (data.activeGame) {
        this.renderInstantTable(data);
      }
    } catch (e) {}
  },

  renderInstantTable(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const playerCardsEl = document.getElementById('bjPlayerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');
    const playerScoreEl = document.getElementById('bjPlayerScore');

    if (dealerCardsEl && data.dealerHand) {
      dealerCardsEl.innerHTML = '';
      data.dealerHand.forEach((c, idx) => {
        const isHidden = (idx === 1 && (c.rank === '?' || data.status === 'playing'));
        dealerCardsEl.appendChild(this.createCardElement(c, isHidden, false));
      });
    }

    if (playerCardsEl && data.playerHand) {
      playerCardsEl.innerHTML = '';
      data.playerHand.forEach(c => {
        playerCardsEl.appendChild(this.createCardElement(c, false, false));
      });
    }

    if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';
    if (playerScoreEl) playerScoreEl.textContent = data.playerScore !== undefined ? data.playerScore : '-';

    this.updateControls(data);
  },

  updateControls(data) {
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

  async deal() {
    if (this.isDealing) return;

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

    // Verrouiller les contrôles
    this.isDealing = true;
    const dealBtn = document.getElementById('bjDealBtn');
    if (dealBtn) dealBtn.disabled = true;

    try {
      const data = await window.API.dealBlackjack(this.currentBet);
      if (data.coins !== undefined) window.State.updateCoins(data.coins);

      const dealerCardsEl = document.getElementById('bjDealerCards');
      const playerCardsEl = document.getElementById('bjPlayerCards');
      const dealerScoreEl = document.getElementById('bjDealerScore');
      const playerScoreEl = document.getElementById('bjPlayerScore');

      // Vider la table
      if (dealerCardsEl) dealerCardsEl.innerHTML = '';
      if (playerCardsEl) playerCardsEl.innerHTML = '';
      if (dealerScoreEl) dealerScoreEl.textContent = '-';
      if (playerScoreEl) playerScoreEl.textContent = '-';

      // Séquence de distribution une par une (ordre casino officiel) :
      // 1. Joueur Carte 1 (Face Visible)
      if (playerCardsEl && data.playerHand[0]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCardsEl.appendChild(this.createCardElement(data.playerHand[0], false, true));
        await this.sleep(400);
      }

      // 2. Croupier Carte 1 (Face Visible — Up-card)
      if (dealerCardsEl && data.dealerHand[0]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[0], false, true));
        await this.sleep(400);
      }

      // 3. Joueur Carte 2 (Face Visible)
      if (playerCardsEl && data.playerHand[1]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCardsEl.appendChild(this.createCardElement(data.playerHand[1], false, true));
        await this.sleep(400);
      }

      // 4. Croupier Carte 2 (Face Cachée — Hole-card avec dos de carte stylisé)
      if (dealerCardsEl && data.dealerHand[1]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[1], true, true));
        await this.sleep(400);
      }

      // Révéler les scores après la distribution
      if (playerScoreEl) playerScoreEl.textContent = data.playerScore !== undefined ? data.playerScore : '-';
      if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';

      this.isDealing = false;
      if (dealBtn) dealBtn.disabled = false;
      this.updateControls(data);

      if (data.status === 'finished') {
        // En cas de Blackjack naturel immédiat, retourner la carte cachée (index 1)
        if (data.dealerHand && data.dealerHand[1]) {
          await this.revealHiddenDealerCard(data.dealerHand[1]);
        }
        if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore;
        this.handleFinish(data);
      }

    } catch (err) {
      this.isDealing = false;
      if (dealBtn) dealBtn.disabled = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  async hit() {
    if (this.isDealing) return;
    this.isDealing = true;

    try {
      const data = await window.API.hitBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);

      const playerCardsEl = document.getElementById('bjPlayerCards');
      const playerScoreEl = document.getElementById('bjPlayerScore');

      // Ajouter uniquement la nouvelle carte tirée
      const newCard = data.playerHand[data.playerHand.length - 1];
      if (playerCardsEl && newCard) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCardsEl.appendChild(this.createCardElement(newCard, false, true));
        await this.sleep(400);
      }

      if (playerScoreEl) playerScoreEl.textContent = data.playerScore;

      this.isDealing = false;
      this.updateControls(data);

      if (data.status === 'finished') {
        if (data.dealerHand && data.dealerHand[1]) {
          await this.revealHiddenDealerCard(data.dealerHand[1]);
        }
        const dealerScoreEl = document.getElementById('bjDealerScore');
        if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore;
        this.handleFinish(data);
      }
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  async stand() {
    if (this.isDealing) return;
    this.isDealing = true;

    try {
      const data = await window.API.standBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);

      // Résoudre les cartes du croupier avec animations
      await this.playDealerSequence(data);

      this.isDealing = false;
      this.updateControls(data);
      this.handleFinish(data);
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  async double() {
    if (this.isDealing) return;
    this.isDealing = true;

    if (window.sound) window.sound.playChip();

    try {
      const data = await window.API.doubleBlackjack();
      if (data.coins !== undefined) window.State.updateCoins(data.coins);

      // 1 carte supplémentaire pour le joueur
      const playerCardsEl = document.getElementById('bjPlayerCards');
      const playerScoreEl = document.getElementById('bjPlayerScore');
      const lastPlayerCard = data.playerHand[data.playerHand.length - 1];

      if (playerCardsEl && lastPlayerCard) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCardsEl.appendChild(this.createCardElement(lastPlayerCard, false, true));
        await this.sleep(450);
      }

      if (playerScoreEl) playerScoreEl.textContent = data.playerScore;

      // Résoudre ensuite la main du croupier
      await this.playDealerSequence(data);

      this.isDealing = false;
      this.updateControls(data);
      this.handleFinish(data);
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  // Animation Flip 3D pour révéler la carte cachée du croupier (index 1)
  async revealHiddenDealerCard(trueCard) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    if (!dealerCardsEl || dealerCardsEl.children.length < 2) return;

    // La carte cachée du croupier est la 2ème carte (index 1) !
    const hiddenCardWrapper = dealerCardsEl.children[1];
    if (!hiddenCardWrapper) return;

    const cardDiv = hiddenCardWrapper.querySelector('.bj-card');
    if (!cardDiv) return;

    // Si on a les vraies infos de la carte, les injecter dans la face avant
    if (trueCard && trueCard.rank && trueCard.rank !== '?') {
      const frontDiv = cardDiv.querySelector('.bj-card-front');
      if (frontDiv) {
        const color = (trueCard.suit === '♥' || trueCard.suit === '♦' || trueCard.color === 'red') ? 'red' : 'black';
        frontDiv.className = `bj-card-front ${color}`;

        const rank = trueCard.rank;
        const suit = trueCard.suit;

        let centerHtml = suit;
        if (['J', 'Q', 'K'].includes(rank)) {
          const figureGlyphs = { 'K': '👑', 'Q': '👸', 'J': '⚔️' };
          centerHtml = `
            <div class="figure-illustration">
              <span class="figure-avatar">${figureGlyphs[rank] || '👑'}</span>
              <span class="figure-suit-mini">${suit}</span>
            </div>
          `;
        } else if (rank === 'A') {
          centerHtml = `<div class="ace-center">${suit}</div>`;
        } else {
          centerHtml = `
            <div class="number-center">
              <span class="pip-val">${rank}</span>
              <span class="pip-suit">${suit}</span>
            </div>
          `;
        }

        frontDiv.innerHTML = `
          <div class="card-corner card-top-left">
            <span class="card-rank">${rank}</span>
            <span class="card-suit">${suit}</span>
          </div>
          <div class="card-center">${centerHtml}</div>
          <div class="card-corner card-bottom-right">
            <span class="card-rank">${rank}</span>
            <span class="card-suit">${suit}</span>
          </div>
        `;
      }
    }

    if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
    // Déclencher la rotation 3D fluide
    cardDiv.classList.remove('flipped');
    await this.sleep(600);
  },

  // Déroulé complet du croupier : révélation + cartes supplémentaires tirées une par une
  async playDealerSequence(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');

    // 1. Retourner la carte cachée (index 1)
    if (data.dealerHand && data.dealerHand[1]) {
      await this.revealHiddenDealerCard(data.dealerHand[1]);
    }

    // 2. Tirer séquentiellement chaque carte additionnelle du croupier (> 2 cartes)
    if (data.dealerHand && data.dealerHand.length > 2) {
      for (let i = 2; i < data.dealerHand.length; i++) {
        await this.sleep(450);
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[i], false, true));
      }
      await this.sleep(300);
    }

    if (dealerScoreEl) {
      dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';
    }
  },

  handleFinish(data) {
    const banner = document.getElementById('bjResultBanner');
    if (!banner) return;

    if (data.outcome === 'blackjack') {
      banner.textContent = `👑 BLACKJACK NATUREL ! +${data.payout} JETONS !`;
      banner.className = 'result-banner win';
      banner.style.display = 'block';
      if (window.sound) window.sound.playJackpot();
      if (window.UI) window.UI.triggerConfetti();
    } else if (data.outcome === 'win' || data.outcome === 'dealer_bust') {
      banner.textContent = `🎉 VICTOIRE ! +${data.payout} JETONS !`;
      banner.className = 'result-banner win';
      banner.style.display = 'block';
      if (window.sound) window.sound.playWin();
      if (window.UI) window.UI.triggerConfetti();
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
      if (window.sound) window.sound.playLose();
    }
  }
};

window.BlackjackGame = BlackjackGame;
