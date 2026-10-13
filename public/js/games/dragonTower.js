// Marsabet Casino — Dragon Tower (Ascension de la Tour & Multiplicateurs)
// Moteur d'interface client & synchronisation serveur

const DragonTowerGame = {
  status: 'idle', // 'idle' | 'playing' | 'stepping'
  bet: 50,
  difficulty: 'medium', // 'easy' | 'medium' | 'hard'
  currentFloor: 1,
  currentMultiplier: 1.0,
  potentialPayout: 0,
  revealed: [],
  difficulties: {
    easy: { name: 'Facile', tilesPerFloor: 4, trapsPerFloor: 1, multipliers: [1.26, 1.68, 2.24, 2.98, 3.98, 5.30, 7.07, 9.43, 12.58] },
    medium: { name: 'Moyen', tilesPerFloor: 3, trapsPerFloor: 1, multipliers: [1.41, 2.12, 3.19, 4.78, 7.18, 10.76, 16.14, 24.22, 36.33] },
    hard: { name: 'Difficile', tilesPerFloor: 2, trapsPerFloor: 1, multipliers: [1.89, 3.78, 7.56, 15.12, 30.24, 60.48, 120.96, 241.92, 483.84] }
  },
  totalFloors: 9,
  recentHistory: [],
  isInitialized: false,

  async init() {
    this.bindEvents();
    this.updatePotentialDisplay();

    try {
      const state = await window.API.getDragonTowerState();
      if (state.difficulties) {
        this.difficulties = state.difficulties;
      }
      if (state.recentHistory) {
        this.recentHistory = state.recentHistory;
        this.renderHistory();
      }

      if (state.activeGame) {
        this.status = 'playing';
        this.bet = state.bet || 50;
        this.difficulty = state.difficulty || 'medium';
        this.currentFloor = state.currentFloor || 1;
        this.currentMultiplier = state.currentMultiplier || 1.0;
        this.potentialPayout = state.potentialPayout || this.bet;
        this.revealed = state.revealed || [];

        const betInput = document.getElementById('dtBetInput');
        if (betInput) betInput.value = this.bet;
        this.updateDifficultyPills();

        this.renderTower();
        this.setControlsPlaying();
      } else {
        this.resetToIdle();
      }
    } catch (err) {
      console.warn('Erreur chargement état Dragon Tower:', err);
      this.resetToIdle();
    }
  },

  bindEvents() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Bouton Démarrer
    const startBtn = document.getElementById('dtStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // Bouton Encaisser
    const cashoutBtn = document.getElementById('dtCashoutBtn');
    if (cashoutBtn) {
      cashoutBtn.addEventListener('click', () => this.cashout());
    }

    // Sélecteur de Difficulté
    document.querySelectorAll('#view-dragon-tower .dt-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.status !== 'idle') return;
        const diff = btn.dataset.diff;
        if (this.difficulties[diff]) {
          this.difficulty = diff;
          this.updateDifficultyPills();
          this.renderTower();
          this.updatePotentialDisplay();
          if (window.sound?.playChip) window.sound.playChip();
        }
      });
    });

    // Input Mise
    const betInput = document.getElementById('dtBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 10) val = 10;
        this.bet = val;
        this.updatePotentialDisplay();
      });
    }

    // Jetons Rapides
    document.querySelectorAll('#view-dragon-tower .casino-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.status !== 'idle') return;
        const val = parseInt(chip.dataset.val, 10);
        if (!isNaN(val)) {
          if (window.sound?.playChip) window.sound.playChip();
          this.bet = (this.bet || 0) + val;
          const input = document.getElementById('dtBetInput');
          if (input) input.value = this.bet;
          this.updatePotentialDisplay();
        }
      });
    });

    // Multiplicateurs de Mise
    document.querySelectorAll('#view-dragon-tower .btn-mult').forEach(btn => {
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

        const input = document.getElementById('dtBetInput');
        if (input) input.value = this.bet;
        this.updatePotentialDisplay();
        if (window.sound?.playChip) window.sound.playChip();
      });
    });
  },

  updateDifficultyPills() {
    document.querySelectorAll('#view-dragon-tower .dt-diff-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === this.difficulty);
    });
    const cfg = this.difficulties[this.difficulty] || this.difficulties.medium;
    const topMultEl = document.getElementById('dtSummitMultiplier');
    if (topMultEl && cfg.multipliers) {
      topMultEl.textContent = `×${cfg.multipliers[8]}`;
    }
  },

  updatePotentialDisplay() {
    const cfg = this.difficulties[this.difficulty] || this.difficulties.medium;
    const maxMult = (cfg.multipliers && cfg.multipliers[8]) || 36.33;
    const maxVal = Math.floor((this.bet || 50) * maxMult);

    const maxEl = document.getElementById('dtMaxPotentialGain');
    if (maxEl) {
      maxEl.textContent = `${Number(maxVal).toLocaleString('fr-FR')} 🪙`;
    }

    const nextMultEl = document.getElementById('dtNextFloorMultiplier');
    if (nextMultEl) {
      if (this.status === 'playing') {
        const nextMult = cfg.multipliers[this.currentFloor - 1] || maxMult;
        nextMultEl.textContent = `×${nextMult}`;
      } else {
        const firstMult = cfg.multipliers[0];
        nextMultEl.textContent = `×${firstMult}`;
      }
    }
  },

  resetToIdle() {
    this.status = 'idle';
    this.currentFloor = 1;
    this.currentMultiplier = 1.0;
    this.potentialPayout = 0;
    this.revealed = [];
    this.updateDifficultyPills();
    this.renderTower();
    this.setControlsIdle();
    this.hideResultBanner();
  },

  setControlsIdle() {
    const startBtn = document.getElementById('dtStartBtn');
    const cashoutBtn = document.getElementById('dtCashoutBtn');
    const betInput = document.getElementById('dtBetInput');

    if (startBtn) {
      startBtn.style.display = 'block';
      startBtn.disabled = false;
    }
    if (cashoutBtn) {
      cashoutBtn.style.display = 'none';
      cashoutBtn.disabled = true;
    }
    if (betInput) betInput.disabled = false;
    document.querySelectorAll('#view-dragon-tower .dt-diff-btn, #view-dragon-tower .casino-chip, #view-dragon-tower .btn-mult').forEach(el => {
      el.disabled = false;
    });
  },

  setControlsPlaying() {
    const startBtn = document.getElementById('dtStartBtn');
    const cashoutBtn = document.getElementById('dtCashoutBtn');
    const betInput = document.getElementById('dtBetInput');

    if (startBtn) startBtn.style.display = 'none';
    if (cashoutBtn) {
      cashoutBtn.style.display = 'block';
      if (this.currentFloor > 1) {
        cashoutBtn.disabled = false;
        cashoutBtn.innerHTML = `💰 ENCAISSER ${Number(this.potentialPayout).toLocaleString('fr-FR')} 🪙 (×${this.currentMultiplier})`;
      } else {
        cashoutBtn.disabled = true;
        cashoutBtn.innerHTML = `💰 ENCAISSER (Franchis l'étage 1)`;
      }
    }
    if (betInput) betInput.disabled = true;
    document.querySelectorAll('#view-dragon-tower .dt-diff-btn, #view-dragon-tower .casino-chip, #view-dragon-tower .btn-mult').forEach(el => {
      el.disabled = true;
    });
  },

  renderTower(allTraps = null, explodedTile = null) {
    const arena = document.getElementById('dtTowerArena');
    if (!arena) return;

    const diffCfg = this.difficulties[this.difficulty] || this.difficulties.medium;
    const tilesCount = diffCfg.tilesPerFloor || 3;
    const multipliers = diffCfg.multipliers || [];

    let html = '';

    // Étage 1 à 9
    for (let floor = 1; floor <= this.totalFloors; floor++) {
      const isCompleted = floor < this.currentFloor;
      const isActive = floor === this.currentFloor && this.status === 'playing';
      const isLocked = floor > this.currentFloor && !allTraps;
      const mult = multipliers[floor - 1];

      let floorClass = 'dt-floor';
      if (isCompleted) floorClass += ' completed';
      else if (isActive) floorClass += ' active';
      else if (isLocked) floorClass += ' locked';

      // Cases de l'étage
      let tilesHtml = '';
      for (let tile = 0; tile < tilesCount; tile++) {
        let tileClass = 'dt-tile';
        let tileContent = '';

        // Vérifier si cette case a été jouée
        const rev = this.revealed.find(r => r.floor === floor && r.tile === tile);

        if (rev) {
          if (rev.status === 'safe') {
            tileClass += ' safe';
            tileContent = '💎';
          } else if (rev.status === 'trap') {
            tileClass += ' trap-exploded';
            tileContent = '💥';
          }
        } else if (allTraps) {
          // Partie terminée, révélation de toutes les cases
          const trapTile = allTraps[floor - 1];
          if (tile === trapTile) {
            if (explodedTile && explodedTile.floor === floor && explodedTile.tile === tile) {
              tileClass += ' trap-exploded';
              tileContent = '💥';
            } else {
              tileClass += ' trap-revealed';
              tileContent = '🥚';
            }
          } else {
            tileClass += ' safe-revealed';
            tileContent = '💎';
          }
        }

        tilesHtml += `
          <div class="${tileClass}" data-floor="${floor}" data-tile="${tile}">
            ${tileContent}
          </div>
        `;
      }

      html += `
        <div class="${floorClass}" data-floor-row="${floor}">
          <div class="dt-floor-info">
            <span class="dt-floor-num">Étage ${floor}</span>
            <span class="dt-floor-mult">×${mult}</span>
          </div>
          <div class="dt-tiles-grid tiles-${tilesCount}">
            ${tilesHtml}
          </div>
        </div>
      `;
    }

    arena.innerHTML = html;

    // Attacher les clics sur les cases actives
    if (this.status === 'playing') {
      const activeFloorRow = arena.querySelector(`.dt-floor.active`);
      if (activeFloorRow) {
        activeFloorRow.querySelectorAll('.dt-tile').forEach(tileEl => {
          tileEl.addEventListener('click', () => {
            const tileIdx = parseInt(tileEl.dataset.tile, 10);
            this.handleStep(tileIdx);
          });
        });
      }
    }
  },

  async startGame() {
    const betInput = document.getElementById('dtBetInput');
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
    const startBtn = document.getElementById('dtStartBtn');
    if (startBtn) startBtn.disabled = true;

    this.hideResultBanner();

    // Déduction instantanée du solde local
    if (window.State?.deductBet) {
      window.State.deductBet(betVal);
    }

    try {
      const res = await window.API.startDragonTower(this.bet, this.difficulty);
      this.status = 'playing';
      this.currentFloor = res.currentFloor || 1;
      this.currentMultiplier = 1.0;
      this.potentialPayout = this.bet;
      this.revealed = [];

      if (window.sound?.playCard) window.sound.playCard();

      this.renderTower();
      this.setControlsPlaying();
      this.updatePotentialDisplay();
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors du démarrage.', 'error');
      this.resetToIdle();
    }
  },

  async handleStep(tileIndex) {
    if (this.status !== 'playing') return;
    this.status = 'stepping';

    try {
      const res = await window.API.stepDragonTower(tileIndex);

      if (res.status === 'lost') {
        // Piège touché !
        if (window.sound?.playLose) window.sound.playLose();

        this.revealed.push({ floor: res.floor, tile: tileIndex, status: 'trap' });
        this.renderTower(res.allTraps, { floor: res.floor, tile: tileIndex });

        this.showResultBanner(`💥 Piège du Dragon touché à l'étage ${res.floor} ! Tu as perdu ${this.bet} 🪙.`, 'vp-loss');
        if (window.State && res.userCoins !== undefined) {
          window.State.setGameAnimating(false, res.userCoins);
        }

        this.addHistoryItem({
          difficulty: this.difficulty,
          floorReached: res.floor,
          profit: -this.bet,
          outcome: 'loss'
        });

        this.status = 'idle';
        this.setControlsIdle();

      } else if (res.status === 'completed') {
        // Sommet atteint (9ème étage réussi) !
        if (window.sound?.playJackpot) window.sound.playJackpot();
        if (window.UI?.triggerConfetti) window.UI.triggerConfetti();

        this.revealed.push({ floor: 9, tile: tileIndex, status: 'safe' });
        this.renderTower(res.allTraps);

        this.showResultBanner(`👑 SOMMET ATTEINT ! Le Dragon s'incline devant toi ! Gain : +${res.payout.toLocaleString('fr-FR')} 🪙 (×${res.multiplier})`, 'vp-jackpot');
        if (window.State && res.userCoins !== undefined) {
          window.State.setGameAnimating(false, res.userCoins);
        }

        this.addHistoryItem({
          difficulty: this.difficulty,
          floorReached: 9,
          profit: res.profit,
          multiplier: res.multiplier,
          outcome: 'win'
        });

        this.status = 'idle';
        this.setControlsIdle();

      } else if (res.status === 'safe') {
        // Étage réussi, ascension au suivant
        if (window.sound?.playScatter) {
          window.sound.playScatter(this.currentFloor);
        } else if (window.sound?.playChip) {
          window.sound.playChip();
        }

        this.revealed.push({ floor: res.floor, tile: tileIndex, status: 'safe' });
        this.currentFloor = res.nextFloor;
        this.currentMultiplier = res.currentMultiplier;
        this.potentialPayout = res.potentialPayout;

        this.status = 'playing';
        this.renderTower();
        this.setControlsPlaying();
        this.updatePotentialDisplay();
      }
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors du franchissement.', 'error');
      this.status = 'playing';
      this.renderTower();
    }
  },

  async cashout() {
    if (this.status !== 'playing' || this.currentFloor <= 1) return;

    const cashoutBtn = document.getElementById('dtCashoutBtn');
    if (cashoutBtn) cashoutBtn.disabled = true;

    try {
      const res = await window.API.cashoutDragonTower();

      if (window.sound?.playWin) window.sound.playWin();
      this.renderTower(res.allTraps);

      this.showResultBanner(`💰 ENCAISSEMENT RÉUSSI ! Tu repars avec +${res.payout.toLocaleString('fr-FR')} 🪙 (Étage ${res.floor} • ×${res.multiplier})`, 'vp-win');

      if (window.State && res.userCoins !== undefined) {
        window.State.setGameAnimating(false, res.userCoins);
      }

      this.addHistoryItem({
        difficulty: this.difficulty,
        floorReached: res.floor,
        profit: res.profit,
        multiplier: res.multiplier,
        outcome: 'win'
      });

      this.status = 'idle';
      this.setControlsIdle();
    } catch (err) {
      window.UI?.showToast(err.message || 'Erreur lors de l\'encaissement.', 'error');
      if (cashoutBtn) cashoutBtn.disabled = false;
    }
  },

  showResultBanner(message, cssClass) {
    const banner = document.getElementById('dtResultBanner');
    if (banner) {
      banner.className = `result-banner ${cssClass}`;
      banner.innerHTML = message;
      banner.style.display = 'block';
    }
  },

  hideResultBanner() {
    const banner = document.getElementById('dtResultBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.className = 'result-banner';
    }
  },

  renderHistory() {
    const container = document.getElementById('dtHistoryList');
    if (!container) return;

    if (!this.recentHistory || this.recentHistory.length === 0) {
      container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Aucune ascension enregistrée</span>`;
      return;
    }

    container.innerHTML = this.recentHistory.slice(0, 10).map(h => {
      const isWin = (h.profit > 0 || h.outcome === 'win');
      const diffLabel = (this.difficulties[h.difficulty] && this.difficulties[h.difficulty].name) || h.difficulty;
      return `
        <div class="dt-history-item ${isWin ? 'win' : 'loss'}">
          <span style="font-weight:700;">Étage ${h.floorReached || 1}</span>
          <span>${diffLabel}</span>
          <span>${isWin ? `+${h.profit.toLocaleString('fr-FR')} 🪙` : `-${Math.abs(h.profit || h.bet || 0).toLocaleString('fr-FR')} 🪙`}</span>
        </div>
      `;
    }).join('');
  },

  addHistoryItem(item) {
    this.recentHistory.unshift(item);
    this.renderHistory();
  }
};

window.DragonTowerGame = DragonTowerGame;
