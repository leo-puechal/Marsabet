// Marsabet Casino — Vidéo Poker (Jacks or Better)
// Moteur d'interface client & synchronisation serveur

const VideoPokerGame = {
  status: 'idle', // 'idle' | 'deal' | 'drawing'
  bet: 50,
  hand: [],
  holds: new Set(),
  paytable: [
    { id: 'royal_flush', name: 'Quinte Flush Royale', multiplier: 250 },
    { id: 'straight_flush', name: 'Quinte Flush', multiplier: 50 },
    { id: 'four_of_a_kind', name: 'Carré', multiplier: 25 },
    { id: 'full_house', name: 'Full', multiplier: 9 },
    { id: 'flush', name: 'Couleur', multiplier: 6 },
    { id: 'straight', name: 'Suite', multiplier: 4 },
    { id: 'three_of_a_kind', name: 'Brelan', multiplier: 3 },
    { id: 'two_pair', name: 'Deux Paires', multiplier: 2 },
    { id: 'jacks_or_better', name: 'Valets ou mieux', multiplier: 1 }
  ],
  isInitialized: false,

  async init() {
    this.bindEvents();
    this.updateMaxPotentialGain();
    this.renderPaytable();

    try {
      const state = await window.API.getVideoPokerState();
      if (state.paytable && state.paytable.length) {
        this.paytable = state.paytable;
        this.renderPaytable();
      }

      if (state.activeGame && state.hand) {
        this.status = 'deal';
        this.bet = state.bet || 50;
        const betInput = document.getElementById('vpBetInput');
        if (betInput) betInput.value = this.bet;
        this.updateMaxPotentialGain();

        this.hand = state.hand;
        this.holds.clear();
        this.renderCards(this.hand, false);
        this.updateActionBtn('🔄 TIRER', false);
        this.setInstruction('Choisis les cartes à GARDER, puis clique sur TIRER.');

        if (state.initialEvaluation && state.initialEvaluation.isWin) {
          this.highlightPaytable(state.initialEvaluation.id);
        }
      } else {
        this.resetToIdle();
      }
    } catch (err) {
      console.warn('Erreur chargement état vidéo poker:', err);
      this.resetToIdle();
    }
  },

  bindEvents() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Bouton Action Principal
    const actionBtn = document.getElementById('vpActionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => this.handleActionClick());
    }

    // Input Mise
    const betInput = document.getElementById('vpBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 10) val = 10;
        this.bet = val;
        this.updateMaxPotentialGain();
      });
    }

    // Jetons Rapides
    document.querySelectorAll('#view-video-poker .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this.status !== 'idle') return;
        const val = parseInt(chip.dataset.val, 10);
        if (!isNaN(val)) {
          if (window.sound?.playChip) window.sound.playChip();
          this.bet = (this.bet || 0) + val;
          const input = document.getElementById('vpBetInput');
          if (input) input.value = this.bet;
          this.updateMaxPotentialGain();
        }
      });
    });

    // Multiplicateurs de Mise
    document.querySelectorAll('#view-video-poker .btn-mult').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.status !== 'idle') return;
        const action = btn.dataset.action;
        const userCoins = window.State?.user?.coins || 1000;

        if (action === 'half') {
          this.bet = Math.max(10, Math.floor(this.bet / 2));
        } else if (action === 'double') {
          this.bet = Math.min(userCoins, this.bet * 2);
        } else if (action === 'max') {
          this.bet = Math.max(10, userCoins);
        }

        const input = document.getElementById('vpBetInput');
        if (input) input.value = this.bet;
        this.updateMaxPotentialGain();
        if (window.sound?.playChip) window.sound.playChip();
      });
    });
  },

  updateMaxPotentialGain() {
    const el = document.getElementById('vpMaxPotentialGain');
    if (el) {
      const topMult = (this.paytable && this.paytable[0]?.multiplier) || 250;
      const potential = (this.bet || 50) * topMult;
      el.textContent = `${Number(potential).toLocaleString('fr-FR')} 🪙`;
    }
  },

  renderPaytable(highlightId = null) {
    const grid = document.getElementById('vpPaytableGrid');
    if (!grid) return;

    grid.innerHTML = this.paytable.map(row => {
      const isHigh = row.id === highlightId;
      return `
        <div class="vp-pay-row ${isHigh ? 'highlight' : ''}" id="vp-pay-${row.id}">
          <span class="vp-pay-name">${row.name}</span>
          <span class="vp-pay-mult">×${row.multiplier}</span>
        </div>
      `;
    }).join('');
  },

  highlightPaytable(id) {
    document.querySelectorAll('.vp-pay-row').forEach(r => r.classList.remove('highlight'));
    if (!id) return;
    const target = document.getElementById(`vp-pay-${id}`);
    if (target) {
      target.classList.add('highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  resetToIdle() {
    this.status = 'idle';
    this.holds.clear();
    this.highlightPaytable(null);
    this.updateActionBtn('🎴 DISTRIBUER', false);
    this.setInstruction('Place ta mise et clique sur DISTRIBUER pour recevoir 5 cartes.');
    this.hideResultBanner();
    this.renderBlankCards();
  },

  renderBlankCards() {
    const container = document.getElementById('vpCardsContainer');
    if (!container) return;

    container.innerHTML = [0, 1, 2, 3, 4].map(i => `
      <div class="vp-card-slot" data-index="${i}">
        <div class="vp-hold-badge">GARDE</div>
        <div class="vp-card-wrapper">
          <div class="vp-card is-back">
            <div class="vp-card-front black"></div>
            <div class="vp-card-back">
              <div class="vp-card-back-inner">
                <span class="crest">🪐</span>
                <span class="crest-text">MARSABET</span>
              </div>
            </div>
          </div>
        </div>
        <button class="vp-hold-btn" disabled>GARDER</button>
      </div>
    `).join('');
  },

  renderCards(cards, animateIndices = []) {
    const container = document.getElementById('vpCardsContainer');
    if (!container) return;

    container.innerHTML = cards.map((card, i) => {
      const isHeld = this.holds.has(i);
      const isRed = (card.suit === '♥' || card.suit === '♦');
      const isAnimated = Array.isArray(animateIndices) && animateIndices.includes(i);

      let centerContent = card.suit;
      if (['J', 'Q', 'K'].includes(card.rank)) {
        const avatars = { 'K': '👑', 'Q': '👸', 'J': '⚔️' };
        centerContent = `
          <div class="figure-illustration">
            <span class="figure-avatar">${avatars[card.rank] || '👑'}</span>
            <span class="figure-suit-mini">${card.suit}</span>
          </div>
        `;
      } else if (card.rank === 'A') {
        centerContent = `<div class="ace-center">${card.suit}</div>`;
      } else {
        centerContent = `
          <div class="number-center">
            <span class="pip-val">${card.rank}</span>
            <span class="pip-suit">${card.suit}</span>
          </div>
        `;
      }

      return `
        <div class="vp-card-slot ${isHeld ? 'held' : ''} ${this.status === 'deal' ? 'can-hold' : ''}" data-index="${i}">
          <div class="vp-hold-badge">GARDE</div>
          <div class="vp-card-wrapper">
            <div class="vp-card ${isAnimated ? 'anim-deal' : ''}">
              <div class="vp-card-front ${isRed ? 'red' : 'black'}">
                <div class="card-corner card-top-left">
                  <span class="card-rank">${card.rank}</span>
                  <span class="card-suit">${card.suit}</span>
                </div>
                <div class="card-center">${centerContent}</div>
                <div class="card-corner card-bottom-right">
                  <span class="card-rank">${card.rank}</span>
                  <span class="card-suit">${card.suit}</span>
                </div>
              </div>
              <div class="vp-card-back">
                <div class="vp-card-back-inner">
                  <span class="crest">🪐</span>
                  <span class="crest-text">MARSABET</span>
                </div>
              </div>
            </div>
          </div>
          <button class="vp-hold-btn" ${this.status !== 'deal' ? 'disabled' : ''}>
            ${isHeld ? '✓ GARDÉ' : 'GARDER'}
          </button>
        </div>
      `;
    }).join('');

    // Attacher événements de clic sur les cartes pour Hold/Unhold
    container.querySelectorAll('.vp-card-slot').forEach(slot => {
      slot.addEventListener('click', (e) => {
        const index = parseInt(slot.dataset.index, 10);
        this.toggleHold(index);
      });
    });
  },

  toggleHold(index) {
    if (this.status !== 'deal') return;
    if (isNaN(index) || index < 0 || index >= 5) return;

    if (this.holds.has(index)) {
      this.holds.delete(index);
    } else {
      this.holds.add(index);
    }

    if (window.sound?.playChip) window.sound.playChip();

    // Mettre à jour visuellement le slot
    const slot = document.querySelector(`.vp-card-slot[data-index="${index}"]`);
    if (slot) {
      const isHeld = this.holds.has(index);
      slot.classList.toggle('held', isHeld);
      const btn = slot.querySelector('.vp-hold-btn');
      if (btn) btn.textContent = isHeld ? '✓ GARDÉ' : 'GARDER';
    }
  },

  async handleActionClick() {
    if (this.status === 'idle') {
      await this.startDeal();
    } else if (this.status === 'deal') {
      await this.startDraw();
    }
  },

  async startDeal() {
    const betInput = document.getElementById('vpBetInput');
    const betVal = parseInt(betInput?.value, 10) || this.bet || 50;

    if (betVal < 10) {
      window.UI?.showToast('Mise minimale : 10 coins.', 'error');
      return;
    }

    const currentCoins = window.State?.user?.coins || 0;
    if (currentCoins < betVal) {
      window.UI?.showToast('Solde insuffisant pour cette mise.', 'error');
      return;
    }

    this.bet = betVal;
    this.updateActionBtn('Distribution...', true);
    this.hideResultBanner();
    this.highlightPaytable(null);

    // Déduction instantanée du solde local
    if (window.State?.deductBet) {
      window.State.deductBet(betVal);
    }

    try {
      const res = await window.API.dealVideoPoker(this.bet);
      this.hand = res.hand;
      this.status = 'deal';
      this.holds.clear();

      if (window.sound?.playCard) {
        window.sound.playCard();
      }

      this.renderCards(this.hand, [0, 1, 2, 3, 4]);
      this.updateActionBtn('🔄 TIRER', false);
      this.setInstruction('Clique sur les cartes que tu souhaites GARDER, puis clique sur TIRER.');

      if (res.initialEvaluation && res.initialEvaluation.isWin) {
        this.highlightPaytable(res.initialEvaluation.id);
        this.showToastHand(`Main servie : ${res.initialEvaluation.name} !`);
      }
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors de la distribution.', 'error');
      this.resetToIdle();
    }
  },

  async startDraw() {
    this.status = 'drawing';
    this.updateActionBtn('Tirage en cours...', true);
    this.setInstruction('Remplacement des cartes...');

    const holdsArray = Array.from(this.holds);

    try {
      const res = await window.API.drawVideoPoker(holdsArray);
      const replaced = res.replacedIndices || [];

      // Animer le flip / remplacement des cartes
      if (replaced.length > 0 && window.sound?.playCard) {
        window.sound.playCard();
      }

      this.hand = res.finalHand;
      this.renderCards(this.hand, replaced);

      // Évaluation et fin de manche
      setTimeout(() => {
        this.finishHand(res);
      }, 450);

    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors du tirage final.', 'error');
      this.resetToIdle();
    }
  },

  finishHand(res) {
    this.status = 'idle';
    this.updateActionBtn('🎴 NOUVELLE MAIN', false);

    const isWin = res.isWin;
    const evalData = res.evaluation || {};

    if (isWin) {
      this.highlightPaytable(evalData.id);

      // Marquage des cartes gagnantes
      document.querySelectorAll('.vp-card-slot').forEach(slot => {
        slot.classList.add('winning-card');
      });

      if (evalData.multiplier >= 25) {
        if (window.sound?.playJackpot) window.sound.playJackpot();
        if (window.UI?.triggerConfetti) window.UI.triggerConfetti();
        this.showResultBanner(`🏆 ${evalData.name.toUpperCase()} ! Gain : +${res.payout.toLocaleString('fr-FR')} 🪙 (×${evalData.multiplier})`, 'vp-jackpot');
      } else {
        if (window.sound?.playWin) window.sound.playWin();
        this.showResultBanner(`🎉 ${evalData.name} ! Gain : +${res.payout.toLocaleString('fr-FR')} 🪙 (×${evalData.multiplier})`, 'vp-win');
      }

      this.setInstruction(`Félicitations ! Tu remportes ${res.payout.toLocaleString('fr-FR')} 🪙.`);
    } else {
      if (window.sound?.playLose) window.sound.playLose();
      this.highlightPaytable(null);
      this.showResultBanner(`Perdu — Aucune combinaison gagnante`, 'vp-loss');
      this.setInstruction('Aucune combinaison. Retente ta chance pour toucher le jackpot !');
    }

    // Synchronisation du solde
    if (window.State && res.userCoins !== undefined) {
      window.State.setGameAnimating(false, res.userCoins);
    }
  },

  updateActionBtn(text, disabled) {
    const btn = document.getElementById('vpActionBtn');
    if (btn) {
      btn.innerHTML = text;
      btn.disabled = !!disabled;
    }
  },

  setInstruction(text) {
    const el = document.getElementById('vpInstruction');
    if (el) el.textContent = text;
  },

  showResultBanner(message, cssClass) {
    const banner = document.getElementById('vpResultBanner');
    if (banner) {
      banner.className = `result-banner ${cssClass}`;
      banner.innerHTML = message;
      banner.style.display = 'block';
    }
  },

  hideResultBanner() {
    const banner = document.getElementById('vpResultBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.className = 'result-banner';
    }
  },

  showToastHand(msg) {
    window.UI?.showToast(msg, 'info', 2500);
  }
};

window.VideoPokerGame = VideoPokerGame;
