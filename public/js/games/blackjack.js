// Blackjack Game Frontend Logic — Marsabet
// Multi-mains (1 à 3 mains simultanées) + Split garanti côte à côte
// Sélecteur de jetons visuels (10, 50, 100, 500, 1000) & Sidebets (Perfect Pairs, 21+3, Insurance)

const BlackjackGame = {
  // État des mises
  mainBet: 50,
  handsCount: 1,
  sidebets: {
    perfectPairs: 0,
    plus3: 0,
    insurance: 0
  },
  selectedChip: 50,
  activeBetSpot: 'main', // 'main' | 'perfectPairs' | 'plus3' | 'insurance'
  lastBets: null,

  inGame: false,
  isDealing: false,

  init() {
    this.bindEvents();
    this.updateBetDisplays();
    this.checkExistingGame();
  },

  bindEvents() {
    // Boutons de contrôle de jeu
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
        this.playChipSound();
      });
    });

    // Sélection du jeton actif dans le rack (10, 50, 100, 500, 1000)
    document.querySelectorAll('#bjChipsRack .bj-casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const val = parseInt(e.currentTarget.dataset.val, 10) || 50;
        this.selectChip(val);
        // Clic cumulable : ajoute directement la valeur à l'emplacement actif
        this.addChipToActiveSpot(val);
        this.playChipSound();
      });
    });

    // Onglets de choix de la zone de mise (Mise principale, Perfect Pairs, 21+3, Assurance)
    document.querySelectorAll('#bjSpotTabs .bj-spot-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const target = e.currentTarget.dataset.target;
        this.setActiveSpot(target);
        this.playChipSound();
      });
    });

    // Clics directs sur les spots du tapis (Felt Spots)
    document.querySelectorAll('#bjFeltSpots .bj-felt-spot').forEach(spot => {
      spot.addEventListener('click', (e) => {
        if (this.inGame || this.isDealing) return;
        const target = e.currentTarget.dataset.spot;
        this.setActiveSpot(target);
        // Ajoute la valeur du jeton sélectionné
        this.addChipToActiveSpot(this.selectedChip);
        this.playChipSound();
      });
    });

    // Boutons de gestion des mises
    const clearAllBtn = document.getElementById('bjClearAllBetsBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (this.inGame || this.isDealing) return;
        this.clearAllBets();
        this.playChipSound();
      });
    }

    const clearActiveBtn = document.getElementById('bjClearActiveSpotBtn');
    if (clearActiveBtn) {
      clearActiveBtn.addEventListener('click', () => {
        if (this.inGame || this.isDealing) return;
        this.clearActiveSpot();
        this.playChipSound();
      });
    }

    const rebetBtn = document.getElementById('bjRebetBtn');
    if (rebetBtn) {
      rebetBtn.addEventListener('click', () => {
        if (this.inGame || this.isDealing) return;
        this.rebet();
        this.playChipSound();
      });
    }

    const doubleBetsBtn = document.getElementById('bjDoubleBetsBtn');
    if (doubleBetsBtn) {
      doubleBetsBtn.addEventListener('click', () => {
        if (this.inGame || this.isDealing) return;
        this.doubleAllBets();
        this.playChipSound();
      });
    }

    // Saisie Personnalisée de la Mise
    const betInput = document.getElementById('bjBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        if (this.inGame || this.isDealing) return;
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        this.setCustomBetForActiveSpot(val);
      });
    }

    // Multiplicateurs de mise personnalisée (½, 2×, MAX)
    document.querySelectorAll('#bjBetPanel .btn-mult').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.inGame || this.isDealing) return;
        const action = btn.dataset.action;
        const spot = this.activeBetSpot || 'main';
        let currentVal = (spot === 'main') ? this.mainBet : (this.sidebets[spot] || 0);
        const userCoins = window.State?.user?.coins || 1000;

        if (action === 'half') {
          currentVal = Math.max(0, Math.floor(currentVal / 2));
        } else if (action === 'double') {
          currentVal = Math.min(userCoins, currentVal > 0 ? currentVal * 2 : 50);
        } else if (action === 'max') {
          currentVal = Math.max(10, userCoins);
        }

        this.setCustomBetForActiveSpot(currentVal);
        const input = document.getElementById('bjBetInput');
        if (input) input.value = currentVal;
        this.playChipSound();
      });
    });

    // Initialisation du drag & drop et du rendu visuel des jetons empilés
    this.initDragAndDrop();
    this.updateBetDisplays();
  },

  playChipSound() {
    if (window.sound && typeof window.sound.playChip === 'function') {
      window.sound.playChip();
    }
  },

  selectChip(val) {
    this.selectedChip = val;
    document.querySelectorAll('#bjChipsRack .bj-casino-chip').forEach(c => {
      const cVal = parseInt(c.dataset.val, 10);
      c.classList.toggle('active-chip', cVal === val);
    });
  },

  setActiveSpot(target) {
    this.activeBetSpot = target;
    // Mettre à jour l'onglet actif
    document.querySelectorAll('#bjSpotTabs .bj-spot-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.target === target);
    });
    // Mettre à jour le spot du tapis actif
    document.querySelectorAll('#bjFeltSpots .bj-felt-spot').forEach(s => {
      s.classList.toggle('active-spot', s.dataset.spot === target);
    });

    const labels = {
      'main': 'Main Principale',
      'perfectPairs': 'Perfect Pairs (25:1)',
      'plus3': '21 + 3 (40:1)',
      'insurance': 'Assurance (2:1)'
    };
    const spotLabelEl = document.getElementById('bjActiveSpotLabel');
    if (spotLabelEl) {
      spotLabelEl.textContent = labels[target] || 'Main Principale';
    }

    const betInput = document.getElementById('bjBetInput');
    if (betInput) {
      const val = (target === 'main') ? this.mainBet : (this.sidebets[target] || 0);
      betInput.value = val;
    }
  },

  setCustomBetForActiveSpot(val) {
    if (this.inGame || this.isDealing) return;
    const spot = this.activeBetSpot || 'main';
    if (spot === 'main') {
      this.mainBet = val;
    } else if (spot === 'perfectPairs') {
      this.sidebets.perfectPairs = val;
    } else if (spot === 'plus3') {
      this.sidebets.plus3 = val;
    } else if (spot === 'insurance') {
      const maxIns = Math.max(10, Math.floor(this.mainBet / 2));
      this.sidebets.insurance = Math.min(maxIns, val);
    }
    this.updateBetDisplays(false);
  },

  addChipToSpot(spotName, val) {
    if (this.inGame || this.isDealing) return;
    this.setActiveSpot(spotName);
    if (spotName === 'main') {
      this.mainBet += val;
    } else if (spotName === 'perfectPairs') {
      this.sidebets.perfectPairs += val;
    } else if (spotName === 'plus3') {
      this.sidebets.plus3 += val;
    } else if (spotName === 'insurance') {
      const maxIns = Math.max(10, Math.floor(this.mainBet / 2));
      this.sidebets.insurance = Math.min(maxIns, this.sidebets.insurance + val);
    }
    this.playChipSound();
    this.updateBetDisplays();
  },

  addChipToActiveSpot(val) {
    this.addChipToSpot(this.activeBetSpot || 'main', val);
  },

  clearActiveSpot() {
    if (this.activeBetSpot === 'main') {
      this.mainBet = 0;
    } else if (this.activeBetSpot === 'perfectPairs') {
      this.sidebets.perfectPairs = 0;
    } else if (this.activeBetSpot === 'plus3') {
      this.sidebets.plus3 = 0;
    } else if (this.activeBetSpot === 'insurance') {
      this.sidebets.insurance = 0;
    }
    this.updateBetDisplays();
  },

  clearAllBets() {
    this.mainBet = 0;
    this.sidebets.perfectPairs = 0;
    this.sidebets.plus3 = 0;
    this.sidebets.insurance = 0;
    this.updateBetDisplays();
  },

  doubleAllBets() {
    this.mainBet = this.mainBet > 0 ? this.mainBet * 2 : 50;
    this.sidebets.perfectPairs *= 2;
    this.sidebets.plus3 *= 2;
    this.sidebets.insurance = Math.min(Math.floor(this.mainBet / 2), this.sidebets.insurance * 2);
    this.updateBetDisplays();
  },

  rebet() {
    if (!this.lastBets) {
      if (window.UI) window.UI.showToast('Aucune mise précédente à rejouer.', 'info');
      return;
    }
    this.mainBet = this.lastBets.mainBet;
    this.sidebets = { ...this.lastBets.sidebets };
    this.setHandsCount(this.lastBets.handsCount || 1);
    this.updateBetDisplays();
  },

  initDragAndDrop() {
    const chips = document.querySelectorAll('#bjChipsRack .bj-casino-chip');
    const spots = document.querySelectorAll('#bjFeltSpots .bj-felt-spot');

    chips.forEach(chip => {
      chip.setAttribute('draggable', 'true');

      chip.addEventListener('dragstart', (e) => {
        if (this.inGame || this.isDealing) {
          e.preventDefault();
          return;
        }
        const val = parseInt(chip.dataset.val, 10) || 50;
        this.draggedChipVal = val;
        chip.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(val));
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      chip.addEventListener('dragend', () => {
        this.draggedChipVal = null;
        chip.classList.remove('dragging');
        spots.forEach(s => s.classList.remove('drag-over'));
      });
    });

    spots.forEach(spot => {
      spot.addEventListener('dragover', (e) => {
        if (this.inGame || this.isDealing) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        spot.classList.add('drag-over');
      });

      spot.addEventListener('dragleave', () => {
        spot.classList.remove('drag-over');
      });

      spot.addEventListener('drop', (e) => {
        if (this.inGame || this.isDealing) return;
        e.preventDefault();
        spot.classList.remove('drag-over');
        let val = null;
        if (e.dataTransfer) {
          val = parseInt(e.dataTransfer.getData('text/plain'), 10);
        }
        if (!val || isNaN(val)) {
          val = this.draggedChipVal || this.selectedChip || 50;
        }
        const target = spot.dataset.spot;
        if (target) {
          this.addChipToSpot(target, val);
        }
      });
    });

    // Touch events pour mobile et tablettes (glisser-déposer au doigt fluide)
    let touchProxy = null;
    let activeTouchChipVal = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let hasMoved = false;

    chips.forEach(chip => {
      chip.addEventListener('touchstart', (e) => {
        if (this.inGame || this.isDealing) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        hasMoved = false;
        activeTouchChipVal = parseInt(chip.dataset.val, 10) || 50;
      }, { passive: true });

      chip.addEventListener('touchmove', (e) => {
        if (this.inGame || this.isDealing || !activeTouchChipVal) return;
        const touch = e.touches[0];
        const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        if (dist > 8) {
          hasMoved = true;
          if (!touchProxy) {
            touchProxy = document.createElement('div');
            touchProxy.className = `bj-touch-drag-proxy chip-${activeTouchChipVal}`;
            touchProxy.innerHTML = `<span class="chip-inner" style="width:32px; height:32px; border-radius:50%; background:rgba(15,33,46,0.92); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-family:var(--font-mono); font-size:0.75rem;">${activeTouchChipVal >= 1000 ? '1K' : activeTouchChipVal}</span>`;
            document.body.appendChild(touchProxy);
          }
          touchProxy.style.left = `${touch.clientX}px`;
          touchProxy.style.top = `${touch.clientY}px`;

          const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
          const hoveredSpot = elemUnder ? elemUnder.closest('.bj-felt-spot') : null;
          spots.forEach(s => {
            if (s === hoveredSpot) {
              s.classList.add('drag-over');
            } else {
              s.classList.remove('drag-over');
            }
          });
        }
      }, { passive: true });

      chip.addEventListener('touchend', (e) => {
        if (touchProxy) {
          touchProxy.remove();
          touchProxy = null;
        }
        spots.forEach(s => s.classList.remove('drag-over'));

        if (hasMoved && activeTouchChipVal) {
          const touch = e.changedTouches[0];
          const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
          const dropSpot = elemUnder ? elemUnder.closest('.bj-felt-spot') : null;
          if (dropSpot && dropSpot.dataset.spot) {
            this.addChipToSpot(dropSpot.dataset.spot, activeTouchChipVal);
          }
          activeTouchChipVal = null;
          hasMoved = false;
        } else if (!hasMoved && activeTouchChipVal) {
          // Tap simple sans déplacement : conserve le comportement clic rapide
          this.selectChip(activeTouchChipVal);
          this.addChipToActiveSpot(activeTouchChipVal);
          this.playChipSound();
          activeTouchChipVal = null;
        }
      });

      chip.addEventListener('touchcancel', () => {
        if (touchProxy) {
          touchProxy.remove();
          touchProxy = null;
        }
        spots.forEach(s => s.classList.remove('drag-over'));
        activeTouchChipVal = null;
        hasMoved = false;
      });
    });
  },

  decomposeAmountIntoChips(amount) {
    if (!amount || amount <= 0) return [];
    const denoms = [1000, 500, 100, 50, 10];
    const chips = [];
    let rem = amount;
    for (const d of denoms) {
      while (rem >= d) {
        chips.push(d);
        rem -= d;
        if (chips.length >= 7) break;
      }
      if (chips.length >= 7) break;
    }
    if (rem > 0 && chips.length < 7) {
      chips.push(10);
    }
    return chips.reverse();
  },

  renderChipStack(spotName, amount) {
    const container = document.getElementById(`bjChipStack_${spotName}`);
    if (!container) return;

    if (!amount || amount <= 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    const chips = this.decomposeAmountIntoChips(amount);
    const rotations = [-5, 6, -3, 8, -7, 4, -6, 5];

    container.innerHTML = chips.map((val, idx) => {
      const rot = rotations[idx % rotations.length];
      const bottom = idx * 3.5;
      const isTop = idx === chips.length - 1;
      const labelHtml = isTop ? `<span class="stacked-chip-label">${val >= 1000 ? '1K' : val}</span>` : '';
      return `<div class="bj-stacked-chip chip-stack-${val}" style="bottom:${bottom}px; transform:rotate(${rot}deg); z-index:${idx + 1};">${labelHtml}</div>`;
    }).join('');
  },

  renderAllChipStacks() {
    this.renderChipStack('main', this.mainBet);
    this.renderChipStack('perfectPairs', this.sidebets.perfectPairs);
    this.renderChipStack('plus3', this.sidebets.plus3);
    this.renderChipStack('insurance', this.sidebets.insurance);
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
    this.updateBetDisplays();
  },

  calculateTotalRequired() {
    const mainTotal = this.mainBet * this.handsCount;
    const ppTotal = this.sidebets.perfectPairs * this.handsCount;
    const plus3Total = this.sidebets.plus3 * this.handsCount;
    const insTotal = this.sidebets.insurance;
    return mainTotal + ppTotal + plus3Total + insTotal;
  },

  updateBetDisplays(syncInput = true) {
    const totalRequired = this.calculateTotalRequired();

    // Synchronisation de la saisie personnalisée
    if (syncInput) {
      const betInput = document.getElementById('bjBetInput');
      if (betInput) {
        const spot = this.activeBetSpot || 'main';
        const val = (spot === 'main') ? this.mainBet : (this.sidebets[spot] || 0);
        betInput.value = val;
      }
    }

    // Mettre à jour les onglets de mise
    const tabMain = document.getElementById('bjTabAmountMain');
    const tabPP = document.getElementById('bjTabAmountPP');
    const tabPlus3 = document.getElementById('bjTabAmountPlus3');
    const tabIns = document.getElementById('bjTabAmountIns');
    if (tabMain) tabMain.textContent = `${this.mainBet} 🪙`;
    if (tabPP) tabPP.textContent = `${this.sidebets.perfectPairs} 🪙`;
    if (tabPlus3) tabPlus3.textContent = `${this.sidebets.plus3} 🪙`;
    if (tabIns) tabIns.textContent = `${this.sidebets.insurance} 🪙`;

    // Mettre à jour les spots sur le tapis
    const feltMain = document.getElementById('bjFeltDisplayMain');
    const feltPP = document.getElementById('bjFeltDisplayPP');
    const feltPlus3 = document.getElementById('bjFeltDisplayPlus3');
    const feltIns = document.getElementById('bjFeltDisplayInsurance');
    if (feltMain) feltMain.textContent = `${this.mainBet} 🪙`;
    if (feltPP) feltPP.textContent = `${this.sidebets.perfectPairs} 🪙`;
    if (feltPlus3) feltPlus3.textContent = `${this.sidebets.plus3} 🪙`;
    if (feltIns) feltIns.textContent = `${this.sidebets.insurance} 🪙`;

    // Récapitulatif détaillé du coût
    const bdMain = document.getElementById('bjBreakdownMain');
    if (bdMain) {
      bdMain.textContent = `${this.mainBet} 🪙 × ${this.handsCount} = ${this.mainBet * this.handsCount} 🪙`;
    }

    const ppWrap = document.getElementById('bjBreakdownPPWrapper');
    const bdPP = document.getElementById('bjBreakdownPP');
    if (ppWrap && bdPP) {
      if (this.sidebets.perfectPairs > 0) {
        ppWrap.style.display = 'flex';
        bdPP.textContent = `${this.sidebets.perfectPairs} 🪙 × ${this.handsCount} = ${this.sidebets.perfectPairs * this.handsCount} 🪙`;
      } else {
        ppWrap.style.display = 'none';
      }
    }

    const p3Wrap = document.getElementById('bjBreakdownPlus3Wrapper');
    const bdPlus3 = document.getElementById('bjBreakdownPlus3');
    if (p3Wrap && bdPlus3) {
      if (this.sidebets.plus3 > 0) {
        p3Wrap.style.display = 'flex';
        bdPlus3.textContent = `${this.sidebets.plus3} 🪙 × ${this.handsCount} = ${this.sidebets.plus3 * this.handsCount} 🪙`;
      } else {
        p3Wrap.style.display = 'none';
      }
    }

    const insWrap = document.getElementById('bjBreakdownInsWrapper');
    const bdIns = document.getElementById('bjBreakdownIns');
    if (insWrap && bdIns) {
      if (this.sidebets.insurance > 0) {
        insWrap.style.display = 'flex';
        bdIns.textContent = `${this.sidebets.insurance} 🪙`;
      } else {
        insWrap.style.display = 'none';
      }
    }

    // Affichage global
    const totalDisp = document.getElementById('bjTotalBetDisplay');
    if (totalDisp) totalDisp.textContent = `${totalRequired} 🪙`;

    const dealBtn = document.getElementById('bjDealBtn');
    if (dealBtn && !this.inGame) {
      dealBtn.textContent = `🃏 DISTRIBUER (${totalRequired} 🪙)`;
    }

    // Mise à jour des piles visuelles de jetons sur chaque spot
    this.renderAllChipStacks();
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  pulseShoe() {
    const shoe = document.getElementById('bjDeckShoe');
    if (shoe) {
      shoe.classList.remove('card-dealing');
      void shoe.offsetWidth;
      shoe.classList.add('card-dealing');
    }
  },

  createCardElement(card, isFacedown = false, animate = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `bj-card-wrapper ${animate ? 'animate-deal' : ''}`;

    const cardDiv = document.createElement('div');
    cardDiv.className = `bj-card ${isFacedown ? 'flipped' : ''}`;

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
    try {
      const data = await window.API.getBlackjackState();
      if (data && data.activeGame) {
        if (data.handsCount) {
          this.handsCount = data.handsCount;
        }
        this.renderInstantTable(data);
      }
    } catch (e) {}
  },

  // Rendu dynamique complet de toutes les mains du joueur (garantit l'affichage côté à côte après split)
  renderDynamicHands(data, renderCards = true) {
    const container = document.getElementById('bjPlayerHandsContainer');
    if (!container) return;

    const hands = data.hands && Array.isArray(data.hands) ? data.hands : [
      { id: 1, cards: data.playerHand, score: data.playerScore, bet: data.bet, status: data.status1 || 'playing' }
    ];

    const isMultiOrSplit = hands.length > 1;

    // S'assurer que le container a les bons conteneurs pour chaque main
    hands.forEach((hand, idx) => {
      let handBox = document.getElementById(`bjHandBox${hand.id}`);
      if (!handBox) {
        // Création dynamique de la boîte pour la nouvelle main (ex: split)
        handBox = document.createElement('div');
        handBox.className = 'bj-hand-box';
        handBox.id = `bjHandBox${hand.id}`;
        handBox.setAttribute('data-hand-id', hand.id);
        handBox.innerHTML = `
          <div class="bj-area-label">
            <span id="bjHandTitle${hand.id}">Main ${hand.id}</span>
            <span class="bj-score-badge" id="bjPlayerScore${hand.id}">-</span>
            <span class="bj-hand-tag" id="bjHandTag${hand.id}">En attente</span>
            <span class="bj-hand-bet-badge" id="bjHandBetDisplay${hand.id}">${hand.bet} 🪙</span>
          </div>
          <div class="bj-cards-row" id="bjPlayerCards${hand.id}"></div>
        `;
        container.appendChild(handBox);
      }

      handBox.style.display = 'flex';

      const titleEl = document.getElementById(`bjHandTitle${hand.id}`);
      const scoreEl = document.getElementById(`bjPlayerScore${hand.id}`) || document.getElementById('bjPlayerScore');
      const tagEl = document.getElementById(`bjHandTag${hand.id}`);
      const betEl = document.getElementById(`bjHandBetDisplay${hand.id}`);
      const cardsEl = document.getElementById(`bjPlayerCards${hand.id}`) || document.getElementById('bjPlayerCards');

      if (titleEl) {
        titleEl.textContent = isMultiOrSplit ? `Main ${hand.id}` : 'Ta Main';
      }
      if (scoreEl) {
        if (hand.score !== undefined && hand.score !== null) {
          scoreEl.textContent = hand.score;
        } else if (renderCards) {
          scoreEl.textContent = '-';
        }
      }
      if (betEl) {
        betEl.style.display = 'inline-block';
        betEl.textContent = `${hand.bet} 🪙`;
      }

      // Rendu des cartes de cette main :
      // On peuple les cartes si renderCards est vrai OU si le conteneur est vide alors que la main en possède.
      // Si renderCards est faux et qu'il y a déjà des cartes affichées, on les préserve intactes (pas de wipe !).
      if (cardsEl) {
        if (renderCards || cardsEl.children.length === 0) {
          if (hand.cards && hand.cards.length > 0) {
            cardsEl.innerHTML = '';
            hand.cards.forEach(c => {
              cardsEl.appendChild(this.createCardElement(c, false, false));
            });
          }
        }
      }

      // Gestion des statuts et surbrillances
      if (data.status === 'playing') {
        if (data.activeHand === hand.id) {
          handBox.className = 'bj-hand-box bj-hand-active';
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            tagEl.textContent = '👉 En cours';
            tagEl.className = 'bj-hand-tag';
          }
        } else if (hand.id < data.activeHand || hand.status === 'bust' || hand.status === 'stand' || hand.status === 'doubled' || hand.status === 'blackjack') {
          handBox.className = `bj-hand-box bj-hand-dimmed ${hand.status === 'bust' ? 'bj-hand-busted' : ''}`;
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            if (hand.status === 'bust') {
              tagEl.textContent = '💥 Bust';
              tagEl.className = 'bj-hand-tag bj-hand-busted';
            } else if (hand.status === 'blackjack') {
              tagEl.textContent = '👑 21 BJ';
              tagEl.className = 'bj-hand-tag';
            } else {
              tagEl.textContent = `Validée (${hand.score || ''})`;
              tagEl.className = 'bj-hand-tag';
            }
          }
        } else {
          handBox.className = 'bj-hand-box bj-hand-dimmed';
          if (tagEl) {
            tagEl.style.display = 'inline-block';
            tagEl.textContent = 'En attente';
            tagEl.className = 'bj-hand-tag';
          }
        }
      } else {
        // État fin de tour : chaque main affiche son verdict distinct
        handBox.classList.remove('bj-hand-active');
        if (hand.outcome === 'bust') handBox.classList.add('bj-hand-busted');

        if (tagEl) {
          tagEl.style.display = 'inline-block';
          if (hand.outcome === 'win' || hand.outcome === 'dealer_bust') {
            tagEl.textContent = `✅ Gagnée (+${hand.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else if (hand.outcome === 'push') {
            tagEl.textContent = `🤝 Égalité (${hand.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else if (hand.outcome === 'blackjack') {
            tagEl.textContent = `👑 Blackjack (+${hand.payout} 🪙)`;
            tagEl.className = 'bj-hand-tag';
          } else {
            tagEl.textContent = hand.outcome === 'bust' ? '💥 Bust (0 🪙)' : '❌ Perdue (0 🪙)';
            tagEl.className = 'bj-hand-tag bj-hand-busted';
          }
        }
      }
    });

    // Masquer les boîtes de mains inutilisées si hands.length < éléments présents
    const allBoxes = container.querySelectorAll('.bj-hand-box');
    allBoxes.forEach(box => {
      const boxId = parseInt(box.getAttribute('data-hand-id'), 10);
      if (!hands.some(h => h.id === boxId)) {
        box.style.display = 'none';
      }
    });
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

    this.renderDynamicHands(data);
    this.updateControls(data);
  },

  updateControls(data) {
    const dealBtn = document.getElementById('bjDealBtn');
    const hitBtn = document.getElementById('bjHitBtn');
    const standBtn = document.getElementById('bjStandBtn');
    const doubleBtn = document.getElementById('bjDoubleBtn');
    const splitBtn = document.getElementById('bjSplitBtn');

    // Désactiver le sélecteur de mains et la saisie de mise pendant une partie en cours
    document.querySelectorAll('#bjHandsSelector .bj-hand-pill-btn').forEach(btn => {
      btn.disabled = (data.status === 'playing');
    });
    const betInput = document.getElementById('bjBetInput');
    if (betInput) betInput.disabled = (data.status === 'playing');
    document.querySelectorAll('#bjBetPanel .btn-mult').forEach(btn => {
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
      if (dealBtn) dealBtn.style.display = 'inline-flex';
      if (hitBtn) hitBtn.style.display = 'none';
      if (standBtn) standBtn.style.display = 'none';
      if (doubleBtn) doubleBtn.style.display = 'none';
      if (splitBtn) splitBtn.style.display = 'none';
      this.updateBetDisplays();
    }
  },

  resetTable() {
    const banner = document.getElementById('bjResultBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.textContent = '';
      banner.className = 'result-banner';
    }

    const dealerCardsEl = document.getElementById('bjDealerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');
    if (dealerCardsEl) dealerCardsEl.innerHTML = '';
    if (dealerScoreEl) dealerScoreEl.textContent = '-';

    const container = document.getElementById('bjPlayerHandsContainer');
    if (container) {
      container.querySelectorAll('.bj-hand-box').forEach(box => {
        box.className = 'bj-hand-box';
        const cardsEl = box.querySelector('.bj-cards-row');
        const scoreEl = box.querySelector('.bj-score-badge');
        const tagEl = box.querySelector('.bj-hand-tag');
        if (cardsEl) cardsEl.innerHTML = '';
        if (scoreEl) scoreEl.textContent = '-';
        if (tagEl) {
          tagEl.style.display = 'none';
          tagEl.className = 'bj-hand-tag';
        }
      });
    }
  },

  async deal() {
    if (this.inGame || this.isDealing) return;

    if (!this.mainBet || this.mainBet < 10) {
      if (window.UI) window.UI.showToast('La mise principale minimale est de 10 coins.', 'warning');
      return;
    }

    const totalRequired = this.calculateTotalRequired();

    // Vérification du solde utilisateur
    if (window.State && window.State.user && window.State.user.coins < totalRequired) {
      window.UI.showToast(`Solde insuffisant : ${totalRequired} 🪙 requis (Solde : ${window.State.user.coins} 🪙).`, 'error');
      return;
    }

    this.isDealing = true;

    // Sauvegarde des mises pour le bouton Rejouer
    this.lastBets = {
      mainBet: this.mainBet,
      sidebets: { ...this.sidebets },
      handsCount: this.handsCount
    };

    try {
      const data = await window.API.dealBlackjack(this.mainBet, this.handsCount, this.sidebets);

      if (window.State) {
        window.State.deductBet(totalRequired);
        window.State.setGameAnimating(true);
      }

      // La donne est confirmée par le serveur : réinitialisation visuelle pour la nouvelle manche
      this.resetTable();

      // Distribution séquentielle animée
      await this.playSequentialDeal(data);

      this.isDealing = false;
      this.updateControls(data);

      // Si le tour se termine immédiatement (Blackjack croupier ou joueur)
      if (data.status === 'finished') {
        await this.playDealerSequence(data);
        this.handleFinish(data);
      }
    } catch (err) {
      this.isDealing = false;
      if (window.State) window.State.setGameAnimating(false);
      window.UI.showToast(err.message, 'error');

      // Si une partie est déjà en cours sur le serveur, on restaure la table immédiatement
      if (err.message && err.message.includes('déjà en cours')) {
        await this.checkExistingGame();
      } else {
        this.updateControls({ status: 'error' });
      }
    }
  },

  async playSequentialDeal(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');
    const hands = data.hands || [];

    // Vider explicitement les cartes pour la distribution animée
    if (dealerCardsEl) dealerCardsEl.innerHTML = '';
    if (dealerScoreEl) dealerScoreEl.textContent = '-';

    // 1. Initialiser la disposition des boîtes de mains SANS injecter de cartes statiques
    this.renderDynamicHands({ ...data, status: 'playing' }, false);
    hands.forEach(h => {
      const cardsEl = document.getElementById(`bjPlayerCards${h.id}`) || document.getElementById('bjPlayerCards');
      const scoreEl = document.getElementById(`bjPlayerScore${h.id}`) || document.getElementById('bjPlayerScore');
      if (cardsEl) cardsEl.innerHTML = '';
      if (scoreEl) scoreEl.textContent = '-';
    });

    // 2. 1ère carte pour chaque main joueur
    for (const h of hands) {
      const cardsEl = document.getElementById(`bjPlayerCards${h.id}`) || document.getElementById('bjPlayerCards');
      if (cardsEl && h.cards && h.cards[0]) {
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
        cardsEl.appendChild(this.createCardElement(h.cards[0], false, true));
        await this.sleep(220);
      }
    }

    // 3. 1ère carte visible pour le croupier
    if (dealerCardsEl && data.dealerHand && data.dealerHand[0]) {
      this.pulseShoe();
      if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
      dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[0], false, true));
      if (dealerScoreEl) dealerScoreEl.textContent = data.dealerScore;
      await this.sleep(220);
    }

    // 4. 2ème carte pour chaque main joueur et mise à jour du score
    for (const h of hands) {
      const cardsEl = document.getElementById(`bjPlayerCards${h.id}`) || document.getElementById('bjPlayerCards');
      const scoreEl = document.getElementById(`bjPlayerScore${h.id}`) || document.getElementById('bjPlayerScore');
      if (cardsEl && h.cards && h.cards[1]) {
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
        cardsEl.appendChild(this.createCardElement(h.cards[1], false, true));
        if (scoreEl) scoreEl.textContent = h.score;
        await this.sleep(220);
      }
    }

    // 5. 2ème carte cachée pour le croupier
    if (dealerCardsEl && data.dealerHand && data.dealerHand[1]) {
      this.pulseShoe();
      if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
      dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[1], true, true));
      await this.sleep(250);
    }

    // Mettre à jour les statuts après distribution sans altérer les cartes
    this.renderDynamicHands(data, false);

    // Afficher des toasts si des sidebets ont gagné dès la distribution
    if (data.sidebets) {
      const ppWins = (data.sidebets.perfectPairs || []).filter(p => p.win);
      const p3Wins = (data.sidebets.plus3 || []).filter(p => p.win);
      if (ppWins.length > 0) {
        window.UI.showToast(`🎯 Perfect Pairs Gagné ! (+${ppWins.reduce((s, p) => s + p.payout, 0)} 🪙)`, 'success');
      }
      if (p3Wins.length > 0) {
        window.UI.showToast(`🃏 21+3 Poker Gagné ! (+${p3Wins.reduce((s, p) => s + p.payout, 0)} 🪙)`, 'success');
      }
    }
  },

  async hit() {
    if (this.isDealing) return;
    this.isDealing = true;

    try {
      const activeBox = document.querySelector('.bj-hand-box.bj-hand-active');
      const prevActiveId = activeBox ? parseInt(activeBox.getAttribute('data-hand-id'), 10) : 1;

      const data = await window.API.hitBlackjack();

      const hands = data.hands || [];
      const playedHand = hands.find(h => h.id === prevActiveId) || hands[0];

      if (playedHand) {
        const cardsEl = document.getElementById(`bjPlayerCards${playedHand.id}`) || document.getElementById('bjPlayerCards');
        const scoreEl = document.getElementById(`bjPlayerScore${playedHand.id}`) || document.getElementById('bjPlayerScore');
        const lastCard = playedHand.cards[playedHand.cards.length - 1];

        if (cardsEl && lastCard) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(lastCard, false, true));
          await this.sleep(380);
        }
        if (scoreEl) scoreEl.textContent = playedHand.score;

        if (playedHand.status === 'bust') {
          window.UI.showToast(`Main ${playedHand.id} a sauté (> 21) !`, 'warning');
        } else if (playedHand.score === 21) {
          window.UI.showToast(`Main ${playedHand.id} : 21 atteint !`, 'success');
        }
      }

      this.isDealing = false;
      this.renderDynamicHands(data, false);
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
      const activeBox = document.querySelector('.bj-hand-box.bj-hand-active');
      const prevActiveId = activeBox ? parseInt(activeBox.getAttribute('data-hand-id'), 10) : 1;

      const data = await window.API.standBlackjack();

      if (data.status === 'playing') {
        window.UI.showToast(`Main ${prevActiveId} validée. Au tour de la Main ${data.activeHand} !`, 'info');
        this.isDealing = false;
        this.renderDynamicHands(data, false);
        this.updateControls(data);
        return;
      }

      // Partie terminée : résoudre le croupier
      await this.playDealerSequence(data);
      this.isDealing = false;
      this.renderDynamicHands(data, false);
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
      window.State.deductBet(this.mainBet);
    }

    try {
      const activeBox = document.querySelector('.bj-hand-box.bj-hand-active');
      const prevActiveId = activeBox ? parseInt(activeBox.getAttribute('data-hand-id'), 10) : 1;

      const data = await window.API.doubleBlackjack();

      const hands = data.hands || [];
      const playedHand = hands.find(h => h.id === prevActiveId) || hands[0];

      if (playedHand) {
        const cardsEl = document.getElementById(`bjPlayerCards${playedHand.id}`) || document.getElementById('bjPlayerCards');
        const scoreEl = document.getElementById(`bjPlayerScore${playedHand.id}`) || document.getElementById('bjPlayerScore');
        const lastCard = playedHand.cards[playedHand.cards.length - 1];

        if (cardsEl && lastCard) {
          this.pulseShoe();
          if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
          cardsEl.appendChild(this.createCardElement(lastCard, false, true));
          await this.sleep(380);
        }
        if (scoreEl) scoreEl.textContent = playedHand.score;
      }

      this.isDealing = false;
      this.renderDynamicHands(data, false);
      this.updateControls(data);

      if (data.status === 'playing') {
        window.UI.showToast(`Main ${prevActiveId} doublée. Au tour de la Main ${data.activeHand} !`, 'info');
        return;
      }

      await this.playDealerSequence(data);
      this.handleFinish(data);
    } catch (err) {
      this.isDealing = false;
      window.UI.showToast(err.message, 'error');
    }
  },

  // Split : les deux mains restent visibles côte à côte sans jamais disparaître
  async split() {
    if (this.isDealing) return;
    this.isDealing = true;

    if (window.State) {
      window.State.deductBet(this.mainBet);
    }

    try {
      const data = await window.API.splitBlackjack();
      // Re-rendu complet dynamique garantissant que toutes les mains s'affichent côte à côte
      this.renderDynamicHands(data);
      this.updateControls(data);
      window.UI.showToast('Main splittée ! Les deux mains sont prêtes.', 'info');
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
    await this.sleep(550);
  },

  async playDealerSequence(data) {
    const dealerCardsEl = document.getElementById('bjDealerCards');
    const dealerScoreEl = document.getElementById('bjDealerScore');

    if (!dealerCardsEl || !data.dealerHand) return;

    // Révéler la carte cachée
    if (dealerCardsEl.children.length >= 2 && data.dealerHand.length >= 2) {
      await this.revealHiddenDealerCard(data.dealerHand[1]);
    } else {
      dealerCardsEl.innerHTML = '';
      data.dealerHand.forEach(c => {
        dealerCardsEl.appendChild(this.createCardElement(c, false, false));
      });
    }

    // Tirer les cartes supplémentaires (index >= 2)
    for (let i = 2; i < data.dealerHand.length; i++) {
      if (dealerCardsEl.children.length <= i) {
        this.pulseShoe();
        if (window.sound && typeof window.sound.playCard === 'function') window.sound.playCard();
        dealerCardsEl.appendChild(this.createCardElement(data.dealerHand[i], false, true));
        await this.sleep(450);
      }
    }

    if (dealerScoreEl) {
      dealerScoreEl.textContent = data.dealerScore;
    }
  },

  handleFinish(data) {
    this.inGame = false;
    this.renderDynamicHands(data);
    this.updateControls(data);

    const banner = document.getElementById('bjResultBanner');
    if (!banner) return;

    const hands = data.hands || [];
    const totalBet = data.totalBet || this.calculateTotalRequired();
    const totalPayout = data.payout || 0;
    const net = totalPayout - totalBet;

    let bannerHtml = '<div style="font-size:0.92rem; line-height:1.45;">';

    hands.forEach((h, idx) => {
      let statusStr = '';
      if (h.outcome === 'win' || h.outcome === 'dealer_bust') {
        statusStr = `<span style="color:#34D399; font-weight:700;">Gagnée (+${h.payout} 🪙) [Score ${h.score}]</span>`;
      } else if (h.outcome === 'push') {
        statusStr = `<span style="color:#FDE047; font-weight:700;">Égalité (+${h.payout} 🪙) [Score ${h.score}]</span>`;
      } else if (h.outcome === 'blackjack') {
        statusStr = `<span style="color:#34D399; font-weight:800;">👑 Blackjack (+${h.payout} 🪙)</span>`;
      } else {
        statusStr = `<span style="color:#EF4444; font-weight:700;">${h.outcome === 'bust' ? 'Bust' : 'Perdue'} (0 🪙) [Score ${h.score}]</span>`;
      }
      bannerHtml += `<div><strong>Main ${h.id} :</strong> ${statusStr}</div>`;
    });

    // Détail des Sidebets si présentes
    if (data.sidebets && data.sidebets.totalSidebetsBet > 0) {
      bannerHtml += `<div style="margin-top:0.35rem; padding-top:0.35rem; border-top:1px dashed rgba(255,255,255,0.15); font-size:0.84rem;">`;
      const ppWins = (data.sidebets.perfectPairs || []).filter(p => p.win);
      const p3Wins = (data.sidebets.plus3 || []).filter(p => p.win);

      if (data.sidebets.perfectPairs && data.sidebets.perfectPairs.length > 0) {
        const ppTotalPayout = data.sidebets.perfectPairs.reduce((s, p) => s + (p.payout || 0), 0);
        bannerHtml += `<div><strong>Perfect Pairs :</strong> ${ppTotalPayout > 0 ? `<span style="color:#34D399;">+${ppTotalPayout} 🪙 (${ppWins.map(w => w.label).join(', ')})</span>` : '<span style="color:#EF4444;">Perdu</span>'}</div>`;
      }

      if (data.sidebets.plus3 && data.sidebets.plus3.length > 0) {
        const p3TotalPayout = data.sidebets.plus3.reduce((s, p) => s + (p.payout || 0), 0);
        bannerHtml += `<div><strong>21+3 Poker :</strong> ${p3TotalPayout > 0 ? `<span style="color:#34D399;">+${p3TotalPayout} 🪙 (${p3Wins.map(w => w.label).join(', ')})</span>` : '<span style="color:#EF4444;">Perdu</span>'}</div>`;
      }

      if (data.sidebets.insurance && data.sidebets.insurance.bet > 0) {
        const ins = data.sidebets.insurance;
        bannerHtml += `<div><strong>Assurance :</strong> ${ins.win ? `<span style="color:#34D399;">+${ins.payout} 🪙 (2:1)</span>` : '<span style="color:#EF4444;">Perdue</span>'}</div>`;
      }
      bannerHtml += `</div>`;
    }

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

    bannerHtml += `
      <div style="margin-top:0.45rem; padding-top:0.45rem; border-top:1px solid rgba(255,255,255,0.2); font-size:1.15rem; font-weight:800;">
        Paiement total : ${totalPayout} 🪙 • Bilan : ${netBadge}
      </div>
    </div>`;

    banner.innerHTML = bannerHtml;
    banner.style.display = 'block';

    if (window.State && data.coins !== undefined) {
      window.State.setGameAnimating(false, data.coins);
    }
  }
};

window.BlackjackGame = BlackjackGame;
