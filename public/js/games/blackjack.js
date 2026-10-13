// Blackjack Game Frontend Logic — Marsabet
// Multi-mains (1 à 3 mains simultanées) + Split + Distribution séquentielle animée & Flip 3D

const BlackjackGame = {
  currentBet: 50,
  handsCount: 1,
  inGame: false,
  isDealing: false,

  init() {
    this.bindEvents();
    this.updateBetSummary();
    this.checkExistingGame();
  },

  bindEvents() {
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');
    const splitBtn = document.getElementById('bjSplitBtn');

    if (dealBtn) dealBtn.addEventListener('click', () => this.deal());
    if (hitBtn) hitBtn.addEventListener('click', () => this.hit());
    if (standBtn) standBtn.addEventListener('click', () => this.stand());
    if (doubleBtn) doubleBtn.addEventListener('click', () => this.double());
    if (splitBtn) splitBtn.addEventListener('click', () => this.split());

    // Sélecteur de nombre de mains (1, 2 ou 3)
    document.querySelectorAll('#bjHandsSelector .bj-hand-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const count = parseInt(e.currentTarget.dataset.hands, 10) || 1;
        this.setHandsCount(count);
        if (window.sound && typeof window.sound.playChip === 'function') window.sound.playChip();
      });
    });

    // Puces de mise rapide
    document.querySelectorAll('#view-blackjack .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.currentTarget.dataset.val, 10);
        this.setBet(val);
        if (window.sound && typeof window.sound.playChip === 'function') window.sound.playChip();
      });
    });

    // Multiplicateurs de mise (½, 2×, MAX)
    const multBtns = document.querySelectorAll('#view-blackjack .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(10, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) {
          const maxPerHand = Math.max(10, Math.floor(window.State.user.coins / this.handsCount));
          this.setBet(maxPerHand);
        }
        if (window.sound && typeof window.sound.playChip === 'function') window.sound.playChip();
      });
    });

    // Champ de saisie numérique de la mise
    const betInput = document.getElementById('bjBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          this.currentBet = val;
          this.updateBetSummary();
        }
      });
      betInput.addEventListener('change', (e) => {
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.target.value, 10);
        this.setBet(isNaN(val) || val < 10 ? 10 : val);
      });
    }
  },

  setBet(val) {
    this.currentBet = Math.max(10, val);
    const input = document.getElementById('bjBetInput');
    if (input) input.value = this.currentBet;
    this.updateBetSummary();
  },

  setHandsCount(count) {
    this.handsCount = Math.max(1, Math.min(3, count));
    document.querySelectorAll('#bjHandsSelector .bj-hand-pill-btn').forEach(btn => {
      const bHands = parseInt(btn.dataset.hands, 10);
      btn.classList.toggle('active', bHands === this.handsCount);
    });
    const badge = document.getElementById('bjHandsCountBadge');
    if (badge) {
      badge.textContent = `${this.handsCount} main${this.handsCount > 1 ? 's' : ''}`;
    }
    this.updateBetSummary();
  },

  updateBetSummary() {
    const total = this.currentBet * this.handsCount;
    const totalDisp = document.getElementById('bjTotalBetDisplay');
    if (totalDisp) totalDisp.textContent = `${total} 🪙`;

    const dealBtn = document.getElementById('bjDealBtn');
    if (dealBtn && !this.inGame) {
      dealBtn.textContent = `🃏 DISTRIBUER (${this.handsCount > 1 ? this.handsCount + ' mains • ' : ''}${total} 🪙)`;
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  pulseShoe() {
    const shoe = document.getElementById('bjDeckShoe');
    if (shoe) {
      shoe.classList.remove('card-dealing');
      void shoe.offsetWidth; // Force reflow
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

    // Face arrière (Cosmique Marsabet)
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
    const dealerScoreEl = document.getElementById('bjDealerScore');

    if (dealerCardsEl && data.dealerHand) {
      dealerCardsEl.innerHTML = '';
      data.dealerHand.forEach((c, idx) => {
        const isHidden = (idx === 1 && (c.rank === '?' || data.status === 'playing'));
        dealerCardsEl.appendChild(this.createCardElement(c, isHidden, false));
      });
    }

    if (dealerScoreEl) {
      dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';
    }

    const hands = data.hands && Array.isArray(data.hands) ? data.hands : [
      { id: 1, cards: data.playerHand, score: data.playerScore, bet: data.bet, status: data.status1 || 'playing' },
      ...(data.playerHand2 ? [{ id: 2, cards: data.playerHand2, score: data.playerScore2, bet: data.bet2 || data.bet, status: data.status2 || 'waiting' }] : [])
    ];

    [1, 2, 3].forEach(id => {
      const handBox = document.getElementById(`bjHandBox${id}`);
      const cardsEl = document.getElementById(id === 1 ? 'bjPlayerCards' : `bjPlayerCards${id}`);
      const scoreEl = document.getElementById(id === 1 ? 'bjPlayerScore' : `bjPlayerScore${id}`);
      const handData = hands.find(h => h.id === id);

      if (handData && cardsEl) {
        if (handBox) handBox.style.display = 'flex';
        cardsEl.innerHTML = '';
        (handData.cards || []).forEach(c => {
          cardsEl.appendChild(this.createCardElement(c, false, false));
        });
        if (scoreEl) scoreEl.textContent = handData.score !== undefined ? handData.score : '-';
      } else if (handBox) {
        handBox.style.display = 'none';
      }
    });

    this.updateControls(data);
  },

  updateControls(data) {
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');
    const splitBtn = document.getElementById('bjSplitBtn');

    const hands = data.hands && Array.isArray(data.hands) ? data.hands : [
      { id: 1, cards: data.playerHand, score: data.playerScore, bet: data.bet, status: data.status1 },
      ...(data.playerHand2 ? [{ id: 2, cards: data.playerHand2, score: data.playerScore2, bet: data.bet2, status: data.status2 }] : [])
    ];

    const isMultiOrSplit = hands.length > 1;

    [1, 2, 3].forEach(id => {
      const handBox = document.getElementById(`bjHandBox${id}`);
      const titleEl = document.getElementById(`bjHandTitle${id}`);
      const tagEl = document.getElementById(`bjHandTag${id}`);
      const betBadge = document.getElementById(`bjHandBetDisplay${id}`);
      const handData = hands.find(h => h.id === id);

      if (!handData) {
        if (handBox) handBox.style.display = 'none';
        return;
      }

      if (handBox) handBox.style.display = 'flex';
      if (titleEl) titleEl.textContent = isMultiOrSplit ? `Main ${id}` : 'Ta Main';
      if (betBadge) {
        betBadge.style.display = 'inline-block';
        betBadge.textContent = `${handData.bet || data.bet} 🪙`;
      }

      if (data.status === 'playing') {
        if (data.activeHand === id) {
          if (handBox) {
            handBox.classList.add('bj-hand-active');
            handBox.classList.remove('bj-hand-dimmed', 'bj-hand-busted');
          }
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            tagEl.textContent = '👉 En cours';
            tagEl.className = 'bj-hand-tag';
          }
        } else if (id < data.activeHand || handData.status === 'bust' || handData.status === 'stand' || handData.status === 'doubled' || handData.status === 'blackjack') {
          if (handBox) {
            handBox.classList.remove('bj-hand-active');
            handBox.classList.add('bj-hand-dimmed');
            if (handData.status === 'bust') handBox.classList.add('bj-hand-busted');
          }
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            if (handData.status === 'bust') {
              tagEl.textContent = '💥 Bust';
              tagEl.className = 'bj-hand-tag bj-hand-busted';
            } else if (handData.status === 'blackjack') {
              tagEl.textContent = '👑 21 BJ';
              tagEl.className = 'bj-hand-tag';
            } else {
              tagEl.textContent = `Validée (${handData.score || ''})`;
              tagEl.className = 'bj-hand-tag';
            }
          }
        } else {
          if (handBox) {
            handBox.classList.remove('bj-hand-active', 'bj-hand-busted');
            handBox.classList.add('bj-hand-dimmed');
          }
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            tagEl.textContent = 'En attente';
            tagEl.className = 'bj-hand-tag';
          }
        }
      } else {
        // État fin de tour
        if (handBox) {
          handBox.classList.remove('bj-hand-active');
          if (handData.outcome === 'bust') handBox.classList.add('bj-hand-busted');
        }
        if (tagEl) {
          tagEl.style.display = 'inline-block';
          if (handData.outcome === 'win' || handData.outcome === 'dealer_bust') {
            tagEl.textContent = `✅ Gagnée (+${handData.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else if (handData.outcome === 'push') {
            tagEl.textContent = `🤝 Égalité (${handData.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else if (handData.outcome === 'blackjack') {
            tagEl.textContent = `👑 Blackjack (+${handData.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else {
            tagEl.textContent = handData.outcome === 'bust' ? '💥 Bust (0 🪙)' : '❌ Perdue (0 🪙)';
            tagEl.className = 'bj-hand-tag bj-hand-busted';
          }
        }
      }
    });

    // Désactiver le sélecteur de mains pendant une partie en cours
    document.querySelectorAll('#bjHandsSelector .bj-hand-pill-btn').forEach(btn => {
      btn.disabled = (data.status === 'playing');
    });

    if (data.status === 'playing') {
      this.inGame = true;
      if (dealBtn) dealBtn.style.display = 'none';
      if (hitBtn) hitBtn.style.display = 'inline-flex';
      if (standBtn) standBtn.style.display = 'inline-flex';
      if (doubleBtn) {
        doubleBtn.style.display = data.canDouble ? 'inline-flex' : 'none';
      }
      if (splitBtn) {
        splitBtn.style.display = data.canSplit ? 'inline-flex' : 'none';
      }
    } else {
      this.inGame = false;
      if (dealBtn) {
        dealBtn.style.display = 'inline-flex';
        this.updateBetSummary();
      }
      if (hitBtn) hitBtn.style.display = 'none';
      if (standBtn) standBtn.style.display = 'none';
      if (doubleBtn) doubleBtn.style.display = 'none';
      if (splitBtn) splitBtn.style.display = 'none';
    }
  },

  async deal() {
    if (this.isDealing) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Veuillez vous connecter pour jouer.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const betInput = document.getElementById('bjBetInput');
    if (betInput) {
      const val = parseInt(betInput.value, 10);
      if (!isNaN(val)) this.currentBet = val;
    }

    if (!Number.isInteger(this.currentBet) || this.currentBet < 10) {
      window.UI.showToast('Mise invalide (minimum 10 coins par main).', 'error');
      return;
    }

    const totalBet = this.currentBet * this.handsCount;

    if (window.State.user.coins < totalBet) {
      window.UI.showToast(`Solde insuffisant pour miser ${this.handsCount} mains (${totalBet} jetons requis).`, 'error');
      return;
    }

    const banner = document.getElementById('bjResultBanner');
    if (banner) banner.style.display = 'none';

    this.isDealing = true;
    const dealBtn = document.getElementById('bjDealBtn');
    if (dealBtn) dealBtn.disabled = true;

    if (window.State) {
      window.State.deductBet(totalBet);
    }

    try {
      const data = await window.API.dealBlackjack(this.currentBet, this.handsCount);

      const dealerCardsEl = document.getElementById('bjDealerCards');
      const dealerScoreEl = document.getElementById('bjDealerScore');

      if (dealerCardsEl) dealerCardsEl.innerHTML = '';
      if (dealerScoreEl) dealerScoreEl.textContent = '-';

      const hands = data.hands || [];
      hands.forEach(h => {
        const box = document.getElementById(`bjHandBox${h.id}`);
        const cardsEl = document.getElementById(h.id === 1 ? 'bjPlayerCards' : `bjPlayerCards${h.id}`);
        const scoreEl = document.getElementById(h.id === 1 ? 'bjPlayerScore' : `bjPlayerScore${h.id}`);
        if (box) box.style.display = 'flex';
        if (cardsEl) cardsEl.innerHTML = '';
        if (scoreEl) scoreEl.textContent = '-';
      });

      [1, 2, 3].forEach(id => {
        if (!hands.find(h => h.id === id)) {
          const box = document.getElementById(`bjHandBox${id}`);
          if (box) box.style.display = 'none';
        }
      });

      // Distribution animée séquentielle carte par carte :
      // 1. Première carte pour chaque main joueur
      for (const h of hands) {
        const cardsEl = document.getElementById(h.id === 1 ? 'bjPlayerCards' : `bjPlayerCards${h.id}`);
        if (cardsEl && h.cards[0]) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(h.cards[0], false, true));
          await this.sleep(300);
        }
      }

      // 2. Première carte du croupier (face visible)
      if (dealerCardsEl && data.dealerHand[0]) {
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[0], false, true));
        await this.sleep(300);
      }

      // 3. Seconde carte pour chaque main joueur
      for (const h of hands) {
        const cardsEl = document.getElementById(h.id === 1 ? 'bjPlayerCards' : `bjPlayerCards${h.id}`);
        if (cardsEl && h.cards[1]) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(h.cards[1], false, true));
          await this.sleep(300);
        }
      }

      // 4. Seconde carte du croupier (face cachée — dos cosmique)
      if (dealerCardsEl && data.dealerHand[1]) {
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[1], true, true));
        await this.sleep(300);
      }

      // Révéler les scores de départ
      hands.forEach(h => {
        const scoreEl = document.getElementById(h.id === 1 ? 'bjPlayerScore' : `bjPlayerScore${h.id}`);
        if (scoreEl) scoreEl.textContent = h.score !== undefined ? h.score : '-';
      });
      if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';

      this.isDealing = false;
      if (dealBtn) dealBtn.disabled = false;
      this.updateControls(data);

      if (data.status === 'finished') {
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
      const prevActiveId = document.querySelector('.bj-hand-box.bj-hand-active')
        ? parseInt(document.querySelector('.bj-hand-box.bj-hand-active').id.replace('bjHandBox', ''), 10)
        : 1;

      const data = await window.API.hitBlackjack();

      // Trouver la main qui vient de recevoir la carte
      const hands = data.hands || [];
      const playedHand = hands.find(h => h.id === prevActiveId) || hands[0];

      if (playedHand) {
        const cardsEl = document.getElementById(playedHand.id === 1 ? 'bjPlayerCards' : `bjPlayerCards${playedHand.id}`);
        const scoreEl = document.getElementById(playedHand.id === 1 ? 'bjPlayerScore' : `bjPlayerScore${playedHand.id}`);
        const lastCard = playedHand.cards[playedHand.cards.length - 1];

        if (cardsEl && lastCard) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(lastCard, false, true));
          await this.sleep(400);
        }
        if (scoreEl) scoreEl.textContent = playedHand.score;

        if (playedHand.status === 'bust') {
          window.UI.showToast(`Main ${playedHand.id} a sauté (> 21) !`, 'warning');
        } else if (playedHand.score === 21) {
          window.UI.showToast(`Main ${playedHand.id} : 21 atteint !`, 'success');
        }
      }

      this.isDealing = false;
      this.updateControls(data);

      if (data.status === 'playing' && data.activeHand !== prevActiveId) {
        window.UI.showToast(`Au tour de la Main ${data.activeHand} !`, 'info');
      }

      if (data.status === 'finished') {
        await this.playDealerSequence(data);
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
      const prevActiveId = document.querySelector('.bj-hand-box.bj-hand-active')
        ? parseInt(document.querySelector('.bj-hand-box.bj-hand-active').id.replace('bjHandBox', ''), 10)
        : 1;

      const data = await window.API.standBlackjack();

      if (data.status === 'playing') {
        window.UI.showToast(`Main ${prevActiveId} validée. Au tour de la Main ${data.activeHand} !`, 'info');
        this.isDealing = false;
        this.updateControls(data);
        return;
      }

      // Si partie terminée : résoudre le croupier et afficher le bilan
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

    if (window.State) {
      window.State.deductBet(this.currentBet);
    }

    try {
      const prevActiveId = document.querySelector('.bj-hand-box.bj-hand-active')
        ? parseInt(document.querySelector('.bj-hand-box.bj-hand-active').id.replace('bjHandBox', ''), 10)
        : 1;

      const data = await window.API.doubleBlackjack();

      const hands = data.hands || [];
      const playedHand = hands.find(h => h.id === prevActiveId) || hands[0];

      if (playedHand) {
        const cardsEl = document.getElementById(playedHand.id === 1 ? 'bjPlayerCards' : `bjPlayerCards${playedHand.id}`);
        const scoreEl = document.getElementById(playedHand.id === 1 ? 'bjPlayerScore' : `bjPlayerScore${playedHand.id}`);
        const lastCard = playedHand.cards[playedHand.cards.length - 1];

        if (cardsEl && lastCard) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(lastCard, false, true));
          await this.sleep(450);
        }
        if (scoreEl) scoreEl.textContent = playedHand.score;
        window.UI.showToast(`Main ${playedHand.id} doublée !`, 'info');
      }

      if (data.status === 'playing') {
        this.isDealing = false;
        this.updateControls(data);
        window.UI.showToast(`Au tour de la Main ${data.activeHand} !`, 'info');
        return;
      }

      await this.playDealerSequence(data);
      this.isDealing = false;
      this.updateControls(data);
      this.handleFinish(data);
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  async split() {
    if (this.isDealing) return;
    this.isDealing = true;

    if (window.State) {
      window.State.deductBet(this.currentBet);
    }

    try {
      const data = await window.API.splitBlackjack();
      this.renderInstantTable(data);
      window.UI.showToast('Main splittée ! Joue ta main active.', 'info');
      this.isDealing = false;

      if (data.status === 'finished') {
        await this.playDealerSequence(data);
        this.handleFinish(data);
      }
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  // Animation Flip 3D pour révéler la carte cachée du croupier (index 1)
  async revealHiddenDealerCard(trueCard) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    if (!dealerCardsEl || dealerCardsEl.children.length < 2) return;

    const hiddenCardWrapper = dealerCardsEl.children[1];
    if (!hiddenCardWrapper) return;

    const cardDiv = hiddenCardWrapper.querySelector('.bj-card');
    if (!cardDiv) return;

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
    cardDiv.classList.remove('flipped');
    await this.sleep(600);
  },

  async playDealerSequence(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');

    // 1. Retourner la carte cachée du croupier
    if (data.dealerHand && data.dealerHand[1]) {
      await this.revealHiddenDealerCard(data.dealerHand[1]);
    }

    // 2. Tirer séquentiellement chaque carte additionnelle du croupier (> 2 cartes)
    if (data.dealerHand && data.dealerHand.length > 2) {
      for (let i = 2; i < data.dealerHand.length; i++) {
        await this.sleep(450);
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
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

    const hands = data.hands && Array.isArray(data.hands) ? data.hands : [
      { id: 1, outcome: data.outcome, payout: data.payout, score: data.playerScore, bet: data.bet }
    ];

    const formatHandResult = (h) => {
      const scoreTxt = `[Score ${h.score || 21}]`;
      if (h.outcome === 'blackjack') {
        return `<span style="color:#fbbf24; font-weight:700;">👑 Main ${h.id} : Blackjack (+${h.payout} 🪙) ${scoreTxt}</span>`;
      } else if (h.outcome === 'win' || h.outcome === 'dealer_bust') {
        return `<span style="color:#34D399; font-weight:700;">🎉 Main ${h.id} : Gagnée (+${h.payout} 🪙) ${scoreTxt}</span>`;
      } else if (h.outcome === 'push') {
        return `<span style="color:#FDE047; font-weight:700;">🤝 Main ${h.id} : Égalité Push (+${h.payout} 🪙) ${scoreTxt}</span>`;
      } else if (h.outcome === 'bust') {
        return `<span style="color:#EF4444; font-weight:700;">💥 Main ${h.id} : Bust (0 🪙) ${scoreTxt}</span>`;
      } else {
        return `<span style="color:#EF4444; font-weight:700;">❌ Main ${h.id} : Perdue (0 🪙) ${scoreTxt}</span>`;
      }
    };

    const totalBet = data.totalBet || hands.reduce((sum, h) => sum + (h.bet || 0), 0);
    const totalPayout = data.payout !== undefined ? data.payout : 0;
    const net = totalPayout - totalBet;

    let netBadge = '';
    if (net > 0) {
      netBadge = `<span style="color:#34D399; font-weight:800;">+${net} 🪙 Net</span>`;
      banner.className = 'result-banner win';
      if (window.sound && typeof window.sound.playWin === 'function') window.sound.playWin();
      if (window.UI && typeof window.UI.triggerConfetti === 'function') window.UI.triggerConfetti();
    } else if (net === 0) {
      netBadge = `<span style="color:#FDE047; font-weight:800;">Égalité (0 Net)</span>`;
      banner.className = 'result-banner';
      banner.style.color = '#FDE047';
      banner.style.borderColor = '#FDE047';
    } else {
      netBadge = `<span style="color:#EF4444; font-weight:800;">${net} 🪙 Net</span>`;
      banner.className = 'result-banner lose';
      if (window.sound && typeof window.sound.playLose === 'function') window.sound.playLose();
    }

    banner.innerHTML = `
      <div style="font-size:0.92rem; line-height:1.5;">
        ${hands.map(h => `<div>${formatHandResult(h)}</div>`).join('')}
      </div>
      <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.15); font-size:1.12rem; font-weight:800;">
        Total : ${totalPayout} 🪙 • Bilan : ${netBadge}
      </div>
    `;
    banner.style.display = 'block';

    if (window.State && data.coins !== undefined) {
      window.State.setGameAnimating(false, data.coins);
    }
  }
};

window.BlackjackGame = BlackjackGame;
