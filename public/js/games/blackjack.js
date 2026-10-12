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
    const splitBtn = document.getElementById('bjSplitBtn');

    if (dealBtn) dealBtn.addEventListener('click', () => this.deal());
    if (hitBtn) hitBtn.addEventListener('click', () => this.hit());
    if (standBtn) standBtn.addEventListener('click', () => this.stand());
    if (doubleBtn) doubleBtn.addEventListener('click', () => this.double());
    if (splitBtn) splitBtn.addEventListener('click', () => this.split());

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
        if (action === 'half') this.setBet(Math.max(10, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        if (window.sound) window.sound.playChip();
      });
    });

    const betInput = document.getElementById('bjBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.currentBet = val;
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
    const playerCards2El = document.getElementById('bjPlayerCards2');
    const dealerScoreEl = document.getElementById('bjDealerScore');
    const playerScoreEl = document.getElementById('bjPlayerScore');
    const playerScore2El = document.getElementById('bjPlayerScore2');

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

    if (playerCards2El && data.playerHand2) {
      playerCards2El.innerHTML = '';
      data.playerHand2.forEach(c => {
        playerCards2El.appendChild(this.createCardElement(c, false, false));
      });
    }

    if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore !== undefined ? data.dealerScore : '-';
    if (playerScoreEl) playerScoreEl.textContent = data.playerScore !== undefined ? data.playerScore : '-';
    if (playerScore2El) playerScore2El.textContent = data.playerScore2 !== undefined ? data.playerScore2 : '-';

    this.updateControls(data);
  },

  updateControls(data) {
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');
    const splitBtn = document.getElementById('bjSplitBtn');

    const handBox1 = document.getElementById('bjHandBox1');
    const handBox2 = document.getElementById('bjHandBox2');
    const handTitle1 = document.getElementById('bjHandTitle1');
    const handTag1 = document.getElementById('bjHandTag1');
    const handTag2 = document.getElementById('bjHandTag2');
    const handBetDisp1 = document.getElementById('bjHandBetDisplay1');
    const handBetDisp2 = document.getElementById('bjHandBetDisplay2');

    // Mise à jour de l'affichage des deux mains si split
    if (data.hasSplit) {
      if (handBox2) handBox2.style.display = 'flex';
      if (handTitle1) handTitle1.textContent = 'Main 1';
      if (handTag1) handTag1.style.display = 'inline-block';
      if (handTag2) handTag2.style.display = 'inline-block';
      if (handBetDisp1) {
        handBetDisp1.style.display = 'inline-block';
        handBetDisp1.textContent = `${data.bet} 🪙`;
      }
      if (handBetDisp2) {
        handBetDisp2.style.display = 'inline-block';
        handBetDisp2.textContent = `${data.bet2 || data.bet} 🪙`;
      }

      if (data.activeHand === 1) {
        if (handBox1) {
          handBox1.classList.add('bj-hand-active');
          handBox1.classList.remove('bj-hand-dimmed');
        }
        if (handBox2) {
          handBox2.classList.remove('bj-hand-active');
          handBox2.classList.add('bj-hand-dimmed');
        }
        if (handTag1) {
          handTag1.textContent = '👉 En cours';
          handTag1.className = 'bj-hand-tag';
        }
        if (handTag2) {
          handTag2.textContent = 'En attente';
          handTag2.className = 'bj-hand-tag';
        }
      } else if (data.activeHand === 2) {
        if (handBox1) {
          handBox1.classList.remove('bj-hand-active');
          handBox1.classList.add('bj-hand-dimmed');
        }
        if (handBox2) {
          handBox2.classList.add('bj-hand-active');
          handBox2.classList.remove('bj-hand-dimmed');
        }
        if (handTag1) {
          if (data.status1 === 'bust') {
            handTag1.textContent = '💥 Bust';
            handTag1.className = 'bj-hand-tag bj-hand-busted';
          } else {
            handTag1.textContent = 'Terminée';
            handTag1.className = 'bj-hand-tag';
          }
        }
        if (handTag2) {
          handTag2.textContent = '👉 En cours';
          handTag2.className = 'bj-hand-tag';
        }
      }
    } else {
      if (handBox2) handBox2.style.display = 'none';
      if (handBox1) {
        handBox1.classList.add('bj-hand-active');
        handBox1.classList.remove('bj-hand-dimmed', 'bj-hand-busted');
      }
      if (handTitle1) handTitle1.textContent = 'Ta Main';
      if (handTag1) handTag1.style.display = 'none';
      if (handTag2) handTag2.style.display = 'none';
      if (handBetDisp1) handBetDisp1.style.display = 'none';
      if (handBetDisp2) handBetDisp2.style.display = 'none';
    }

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
      if (dealBtn) dealBtn.style.display = 'inline-flex';
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
      window.UI.showToast('Mise invalide (minimum 10 coins).', 'error');
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

    if (window.State) {
      window.State.deductBet(this.currentBet);
    }

    try {
      const data = await window.API.dealBlackjack(this.currentBet);

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

  async split() {
    if (this.isDealing) return;

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour splitter (seconde mise requise).', 'error');
      return;
    }

    this.isDealing = true;
    const banner = document.getElementById('bjResultBanner');
    if (banner) banner.style.display = 'none';

    if (window.State) {
      window.State.deductBet(this.currentBet);
    }

    try {
      const data = await window.API.splitBlackjack();

      const playerCardsEl = document.getElementById('bjPlayerCards');
      const playerCards2El = document.getElementById('bjPlayerCards2');
      const playerScoreEl = document.getElementById('bjPlayerScore');
      const playerScore2El = document.getElementById('bjPlayerScore2');
      const dealerScoreEl = document.getElementById('bjDealerScore');

      // Vider les deux rangées de cartes joueur pour l'animation
      if (playerCardsEl) playerCardsEl.innerHTML = '';
      if (playerCards2El) playerCards2El.innerHTML = '';

      // Animation du split :
      // 1. Placer Carte 1 dans Main 1
      if (playerCardsEl && data.playerHand[0]) {
        playerCardsEl.appendChild(this.createCardElement(data.playerHand[0], false, false));
      }
      // 2. Placer Carte 2 dans Main 2
      if (playerCards2El && data.playerHand2[0]) {
        playerCards2El.appendChild(this.createCardElement(data.playerHand2[0], false, false));
      }
      await this.sleep(350);

      // 3. Distribuer nouvelle carte pour Main 1
      if (playerCardsEl && data.playerHand[1]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCardsEl.appendChild(this.createCardElement(data.playerHand[1], false, true));
        await this.sleep(400);
      }

      // 4. Distribuer nouvelle carte pour Main 2
      if (playerCards2El && data.playerHand2[1]) {
        this.pulseShoe();
        if (window.sound) window.sound.playCard();
        playerCards2El.appendChild(this.createCardElement(data.playerHand2[1], false, true));
        await this.sleep(400);
      }

      if (playerScoreEl) playerScoreEl.textContent = data.playerScore !== undefined ? data.playerScore : '-';
      if (playerScore2El) playerScore2El.textContent = data.playerScore2 !== undefined ? data.playerScore2 : '-';

      this.updateControls(data);

      // Si As splittés : le croupier joue directement
      if (data.status === 'finished') {
        await this.playDealerSequence(data);
        if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore;
        this.handleFinish(data);
      } else {
        window.UI.showToast('Main splittée ! Joue ta Main 1.', 'info');
      }

      this.isDealing = false;
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  async hit() {
    if (this.isDealing) return;
    this.isDealing = true;

    try {
      const data = await window.API.hitBlackjack();

      const playerCardsEl = document.getElementById('bjPlayerCards');
      const playerCards2El = document.getElementById('bjPlayerCards2');
      const playerScoreEl = document.getElementById('bjPlayerScore');
      const playerScore2El = document.getElementById('bjPlayerScore2');

      if (data.hasSplit) {
        // En cas de split, déterminer quelle main a reçu la carte
        if (data.hand1Busted) {
          // La main 1 vient de sauter (bust)
          const newCard = data.playerHand[data.playerHand.length - 1];
          if (playerCardsEl && newCard) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCardsEl.appendChild(this.createCardElement(newCard, false, true));
            await this.sleep(400);
          }
          window.UI.showToast('Main 1 a sauté (> 21) ! Au tour de la Main 2.', 'warning');
        } else if (data.activeHand === 2 && data.status1 === 'stand') {
          // La main 1 a atteint 21 ou fini
          const newCard = data.playerHand[data.playerHand.length - 1];
          if (playerCardsEl && newCard) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCardsEl.appendChild(this.createCardElement(newCard, false, true));
            await this.sleep(400);
          }
          window.UI.showToast('Main 1 à 21 ! Au tour de la Main 2.', 'success');
        } else if (data.activeHand === 1) {
          // Tirage normal sur Main 1
          const newCard = data.playerHand[data.playerHand.length - 1];
          if (playerCardsEl && newCard) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCardsEl.appendChild(this.createCardElement(newCard, false, true));
            await this.sleep(400);
          }
        } else {
          // Tirage sur Main 2
          const newCard = data.playerHand2[data.playerHand2.length - 1];
          if (playerCards2El && newCard) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCards2El.appendChild(this.createCardElement(newCard, false, true));
            await this.sleep(400);
          }
        }

        if (playerScoreEl) playerScoreEl.textContent = data.playerScore;
        if (playerScore2El) playerScore2El.textContent = data.playerScore2;
      } else {
        // Cas sans split
        const newCard = data.playerHand[data.playerHand.length - 1];
        if (playerCardsEl && newCard) {
          this.pulseShoe();
          if (window.sound) window.sound.playCard();
          playerCardsEl.appendChild(this.createCardElement(newCard, false, true));
          await this.sleep(400);
        }
        if (playerScoreEl) playerScoreEl.textContent = data.playerScore;
      }

      this.isDealing = false;
      this.updateControls(data);

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
      const data = await window.API.standBlackjack();

      if (data.hasSplit && data.status === 'playing' && data.activeHand === 2) {
        // Main 1 validée, début de la Main 2
        window.UI.showToast('Main 1 validée. Au tour de la Main 2.', 'info');
        this.isDealing = false;
        this.updateControls(data);
        return;
      }

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

    if (window.State) {
      window.State.deductBet(this.currentBet);
    }

    try {
      const data = await window.API.doubleBlackjack();

      const playerCardsEl = document.getElementById('bjPlayerCards');
      const playerCards2El = document.getElementById('bjPlayerCards2');
      const playerScoreEl = document.getElementById('bjPlayerScore');
      const playerScore2El = document.getElementById('bjPlayerScore2');

      if (data.hasSplit) {
        if (data.hand1Doubled || data.activeHand === 2) {
          // Main 1 a été doublée
          const lastCard1 = data.playerHand[data.playerHand.length - 1];
          if (playerCardsEl && lastCard1) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCardsEl.appendChild(this.createCardElement(lastCard1, false, true));
            await this.sleep(450);
          }
          if (playerScoreEl) playerScoreEl.textContent = data.playerScore;
          window.UI.showToast('Main 1 doublée ! Au tour de la Main 2.', 'info');
        } else {
          // Main 2 a été doublée
          const lastCard2 = data.playerHand2[data.playerHand2.length - 1];
          if (playerCards2El && lastCard2) {
            this.pulseShoe();
            if (window.sound) window.sound.playCard();
            playerCards2El.appendChild(this.createCardElement(lastCard2, false, true));
            await this.sleep(450);
          }
          if (playerScore2El) playerScore2El.textContent = data.playerScore2;
        }

        if (data.status === 'playing') {
          this.isDealing = false;
          this.updateControls(data);
          return;
        }
      } else {
        // Sans split
        const lastPlayerCard = data.playerHand[data.playerHand.length - 1];
        if (playerCardsEl && lastPlayerCard) {
          this.pulseShoe();
          if (window.sound) window.sound.playCard();
          playerCardsEl.appendChild(this.createCardElement(lastPlayerCard, false, true));
          await this.sleep(450);
        }
        if (playerScoreEl) playerScoreEl.textContent = data.playerScore;
      }

      // Résoudre la main du croupier si partie terminée
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

    // --- CAS SPLIT : Affichage détaillé par main et total combiné ---
    if (data.hasSplit) {
      const formatOutcome = (outcome, payout, score) => {
        if (outcome === 'win' || outcome === 'dealer_bust') {
          return `<span style="color:#34D399; font-weight:700;">Gagnée (+${payout} 🪙) [Score ${score}]</span>`;
        } else if (outcome === 'push') {
          return `<span style="color:#FDE047; font-weight:700;">Push (+${payout} 🪙) [Score ${score}]</span>`;
        } else {
          return `<span style="color:#EF4444; font-weight:700;">${outcome === 'bust' ? 'Bust' : 'Perdue'} (0 🪙) [Score ${score}]</span>`;
        }
      };

      const out1 = formatOutcome(data.outcome1, data.payout1 || 0, data.playerScore);
      const out2 = formatOutcome(data.outcome2, data.payout2 || 0, data.playerScore2);
      const totalBet = (data.bet || 0) + (data.bet2 || data.bet || 0);
      const totalPayout = data.payout || 0;
      const net = totalPayout - totalBet;

      let netBadge = '';
      if (net > 0) {
        netBadge = `<span style="color:#34D399; font-weight:800;">+${net} 🪙 Net</span>`;
        banner.className = 'result-banner win';
        if (window.sound) window.sound.playWin();
        if (window.UI) window.UI.triggerConfetti();
      } else if (net === 0) {
        netBadge = `<span style="color:#FDE047; font-weight:800;">Égalité (0 Net)</span>`;
        banner.className = 'result-banner';
        banner.style.color = '#FDE047';
        banner.style.borderColor = '#FDE047';
      } else {
        netBadge = `<span style="color:#EF4444; font-weight:800;">${net} 🪙 Net</span>`;
        banner.className = 'result-banner lose';
        if (window.sound) window.sound.playLose();
      }

      banner.innerHTML = `
        <div style="font-size:0.92rem; line-height:1.4;">
          <div><strong>Main 1 :</strong> ${out1}</div>
          <div><strong>Main 2 :</strong> ${out2}</div>
        </div>
        <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.15); font-size:1.15rem; font-weight:800;">
          Total : ${totalPayout} 🪙 • Bilan : ${netBadge}
        </div>
      `;
      banner.style.display = 'block';

      if (window.State && data.coins !== undefined) {
        window.State.setGameAnimating(false, data.coins);
      }
      return;
    }

    // --- CAS NORMAL SANS SPLIT ---
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

    if (window.State && data.coins !== undefined) {
      window.State.setGameAnimating(false, data.coins);
    }
  }
};

window.BlackjackGame = BlackjackGame;
