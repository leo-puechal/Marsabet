// =========================================================
// MARSABET 5x3 VIDEO SLOT MACHINE - FRONTEND ENGINE
// =========================================================

const SlotsGame = {
  isSpinning: false,
  isAutoplay: false,
  autoplayRemaining: 0,
  activeLines: 20,
  betPerLine: 1,

  // État des tours gratuits (Free Spins)
  freeSpinsState: {
    isActive: false,
    remaining: 0,
    total: 0,
    multiplier: 3,
    accumulatedWin: 0
  },

  // 20 Lignes de paiement vidéo standards avec coordonnées et couleurs
  paylinesData: [
    { id: 1, name: 'Ligne Centrale', coords: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], color: '#FFD700' },
    { id: 2, name: 'Ligne Haute', coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], color: '#38BDF8' },
    { id: 3, name: 'Ligne Basse', coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], color: '#F43F5E' },
    { id: 4, name: 'V Plongeant', coords: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]], color: '#A855F7' },
    { id: 5, name: 'V Inversé', coords: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], color: '#22C55E' },
    { id: 6, name: 'Descente Douce', coords: [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]], color: '#F97316' },
    { id: 7, name: 'Montée Douce', coords: [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]], color: '#EC4899' },
    { id: 8, name: 'U Inversé', coords: [[0, 1], [1, 0], [2, 0], [3, 0], [4, 1]], color: '#EAB308' },
    { id: 9, name: 'U Creux', coords: [[0, 1], [1, 2], [2, 2], [3, 2], [4, 1]], color: '#06B6D4' },
    { id: 10, name: 'Zig-Zag 1', coords: [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]], color: '#84CC16' },
    { id: 11, name: 'Zig-Zag 2', coords: [[0, 1], [1, 2], [2, 1], [3, 0], [4, 1]], color: '#8B5CF6' },
    { id: 12, name: 'Pont Haut', coords: [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]], color: '#F59E0B' },
    { id: 13, name: 'Pont Bas', coords: [[0, 2], [1, 1], [2, 1], [3, 1], [4, 2]], color: '#10B981' },
    { id: 14, name: 'Créneau Haut', coords: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]], color: '#6366F1' },
    { id: 15, name: 'Créneau Bas', coords: [[0, 2], [1, 1], [2, 2], [3, 1], [4, 2]], color: '#EF4444' },
    { id: 16, name: 'Pic Médian Haut', coords: [[0, 1], [1, 1], [2, 0], [3, 1], [4, 1]], color: '#14B8A6' },
    { id: 17, name: 'Creux Médian Bas', coords: [[0, 1], [1, 1], [2, 2], [3, 1], [4, 1]], color: '#D946EF' },
    { id: 18, name: 'Creux Profond', coords: [[0, 0], [1, 0], [2, 2], [3, 0], [4, 0]], color: '#F472B6' },
    { id: 19, name: 'Pic Profond', coords: [[0, 2], [1, 2], [2, 0], [3, 2], [4, 2]], color: '#38BDF8' },
    { id: 20, name: 'Onde Cosmique', coords: [[0, 0], [1, 2], [2, 0], [3, 2], [4, 0]], color: '#FBBF24' }
  ],

  // État du Quitte ou Double (Gamble)
  gambleState: {
    currentAmount: 0,
    isGambling: false
  },

  // Mapping des métadonnées de symboles pour l'affichage visuel
  symbolMeta: {
    'mars': { icon: '🪐', badge: 'JACKPOT', label: 'Marsabet' },
    'diamond': { icon: '💎', badge: 'DIAMANT', label: 'Diamant' },
    'canette': { icon: '🥤', badge: 'BDE', label: 'Canette' },
    'choc': { icon: '🍫', badge: 'BDE', label: 'Chocolat' },
    'chips': { icon: '🥔', badge: 'BDE', label: 'Chips' },
    'cafe': { icon: '☕', badge: 'BDE', label: 'Café' },
    'A': { icon: '🂱', badge: 'AS', label: 'As' },
    'K': { icon: '🃎', badge: 'ROI', label: 'Roi' },
    'Q': { icon: '🃍', badge: 'DAME', label: 'Dame' },
    'J': { icon: '🃋', badge: 'VALET', label: 'Valet' },
    '10': { icon: '🔟', badge: '10', label: '10' },
    'wild': { icon: '🌟', badge: 'WILD x2', label: 'Wild Cosmique' },
    'scatter': { icon: '⚡', badge: 'SCATTER', label: 'Scatter' }
  },

  init() {
    this.bindEvents();
    this.renderInitialReels();
    this.updateControlsDisplay();
    this.fetchInitialState();
  },

  async fetchInitialState() {
    try {
      if (!window.State || !window.State.isAuthenticated) return;
      const data = await window.API.getSlotsState();
      if (data && data.paylines && Array.isArray(data.paylines)) {
        this.paylinesData = data.paylines;
      }
      if (data && data.session && data.session.free_spins_remaining > 0) {
        this.freeSpinsState = {
          isActive: true,
          remaining: data.session.free_spins_remaining,
          total: data.session.free_spins_total,
          multiplier: data.session.free_spins_multiplier || 3,
          accumulatedWin: data.session.free_spins_accumulated_win || 0
        };
        this.updateFreeSpinsBanner();
      }
    } catch (e) {
      console.warn('Erreur chargement état initial slots:', e);
    }
  },

  bindEvents() {
    // Bouton de rotation principal (SPIN)
    const spinBtn = document.getElementById('slotsSpinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => {
        if (this.isAutoplay) {
          this.stopAutoplay();
        } else {
          this.spin();
        }
      });
    }

    // Bouton Autoplay
    const autoBtn = document.getElementById('btnSlotsAutoplay');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => this.toggleAutoplay());
    }

    // Contrôle Lignes Actives : Stepper (− et +) pas à pas
    const btnLinesMinus = document.getElementById('btnStepLinesMinus');
    const btnLinesPlus = document.getElementById('btnStepLinesPlus');
    if (btnLinesMinus) {
      btnLinesMinus.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        this.setActiveLines(this.activeLines - 1);
        if (window.sound) window.sound.playChip();
      });
    }
    if (btnLinesPlus) {
      btnLinesPlus.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        this.setActiveLines(this.activeLines + 1);
        if (window.sound) window.sound.playChip();
      });
    }

    // Contrôle Lignes Actives : Saisie directe
    const inputLines = document.getElementById('slotsLinesInput');
    if (inputLines) {
      inputLines.addEventListener('input', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.setActiveLines(val);
      });
      inputLines.addEventListener('change', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const val = parseInt(e.target.value, 10);
        this.setActiveLines(isNaN(val) ? 20 : val);
      });
    }

    // Contrôle Lignes Actives : Raccourcis Rapides (Pills 1, 5, 10, 15, 20)
    document.querySelectorAll('#slotsLinesPills .btn-line-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const count = parseInt(pill.dataset.lines, 10);
        if (!isNaN(count)) {
          this.setActiveLines(count);
          if (window.sound) window.sound.playChip();
        }
      });
    });

    // Flancs Numérotés (Tags 1 à 20) : Aperçu au survol & activation au clic
    document.querySelectorAll('.line-tag').forEach(tag => {
      const lineNum = parseInt(tag.dataset.line, 10);
      tag.addEventListener('mouseenter', () => {
        this.previewPayline(lineNum);
      });
      tag.addEventListener('mouseleave', () => {
        this.clearPaylinePreview();
      });
      tag.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        this.setActiveLines(lineNum);
        if (window.sound) window.sound.playChip();
      });
    });

    // Boutons de contrôle : Mise par ligne (+ / -)
    const btnBetMinus = document.getElementById('btnStepBetMinus');
    const btnBetPlus = document.getElementById('btnStepBetPlus');
    const betSteps = [1, 2, 5, 10, 25, 50, 100];

    if (btnBetMinus) {
      btnBetMinus.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        let idx = betSteps.findIndex(s => s >= this.betPerLine);
        if (idx > 0) this.setBetPerLine(betSteps[idx - 1]);
        else this.setBetPerLine(Math.max(1, this.betPerLine - 1));
        if (window.sound) window.sound.playChip();
      });
    }
    if (btnBetPlus) {
      btnBetPlus.addEventListener('click', () => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        let idx = betSteps.findIndex(s => s > this.betPerLine);
        if (idx !== -1) this.setBetPerLine(betSteps[idx]);
        else this.setBetPerLine(this.betPerLine + 5);
        if (window.sound) window.sound.playChip();
      });
    }

    // Saisie libre de la mise par ligne
    const inputBetLine = document.getElementById('slotsBetPerLineInput');
    if (inputBetLine) {
      inputBetLine.addEventListener('input', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          this.betPerLine = val;
          this.updateTotalDisplay();
        }
      });
      inputBetLine.addEventListener('change', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const val = parseInt(e.target.value, 10);
        this.setBetPerLine(isNaN(val) || val <= 0 ? 1 : val);
      });
    }

    // Puces rapides de mise par ligne
    document.querySelectorAll('#view-slots .quick-bet-chips .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const betLine = parseInt(e.currentTarget.dataset.betPerLine, 10);
        if (!isNaN(betLine)) {
          this.setBetPerLine(betLine);
          if (window.sound) window.sound.playChip();
        }
      });
    });

    // Multiplicateurs (MIN, ½, 2x, MAX)
    document.querySelectorAll('#view-slots .bet-multipliers .btn-mult').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.isSpinning || this.freeSpinsState.isActive) return;
        const action = e.currentTarget.dataset.action;
        if (action === 'min') this.setBetPerLine(1);
        if (action === 'half') this.setBetPerLine(Math.max(1, Math.floor(this.betPerLine / 2)));
        if (action === 'double') this.setBetPerLine(this.betPerLine * 2);
        if (action === 'max' && window.State && window.State.user) {
          const maxLineBet = Math.max(1, Math.floor(window.State.user.coins / this.activeLines));
          this.setBetPerLine(Math.min(100, maxLineBet));
        }
        if (window.sound) window.sound.playChip();
      });
    });

    // Modale Table des Gains
    const openPaytableBtn = document.getElementById('btnOpenPaytable');
    const closePaytableBtn = document.getElementById('closePaytableModal');
    const paytableModal = document.getElementById('slotsPaytableModal');

    if (openPaytableBtn && paytableModal) {
      openPaytableBtn.addEventListener('click', () => paytableModal.classList.add('active'));
    }
    if (closePaytableBtn && paytableModal) {
      closePaytableBtn.addEventListener('click', () => paytableModal.classList.remove('active'));
    }
    if (paytableModal) {
      paytableModal.addEventListener('click', (e) => {
        if (e.target === paytableModal) paytableModal.classList.remove('active');
      });
    }

    // Barre Quitte ou Double (Gamble)
    const btnTriggerGamble = document.getElementById('btnTriggerGamble');
    const btnCollectGamble = document.getElementById('btnCollectGamble');

    if (btnTriggerGamble) {
      btnTriggerGamble.addEventListener('click', () => this.openGambleModal());
    }
    if (btnCollectGamble) {
      btnCollectGamble.addEventListener('click', () => this.collectGamble());
    }

    // Modale Quitte ou Double
    const gambleModal = document.getElementById('slotsGambleModal');
    const closeGambleBtn = document.getElementById('closeGambleModal');
    const btnGambleCashout = document.getElementById('btnGambleCashout');
    const btnRed = document.getElementById('btnGambleChooseRed');
    const btnBlack = document.getElementById('btnGambleChooseBlack');

    if (closeGambleBtn) closeGambleBtn.addEventListener('click', () => this.closeGambleModal());
    if (btnGambleCashout) btnGambleCashout.addEventListener('click', () => this.collectGamble());
    if (btnRed) btnRed.addEventListener('click', () => this.executeGamble('red'));
    if (btnBlack) btnBlack.addEventListener('click', () => this.executeGamble('black'));

    // Modale Bonus Free Spins Célébration
    const bonusModal = document.getElementById('slotsBonusModal');
    const closeBonusBtn = document.getElementById('closeBonusModal');
    const startBonusBtn = document.getElementById('btnStartBonusSpins');

    if (closeBonusBtn && bonusModal) {
      closeBonusBtn.addEventListener('click', () => bonusModal.classList.remove('active'));
    }
    if (startBonusBtn && bonusModal) {
      startBonusBtn.addEventListener('click', () => {
        bonusModal.classList.remove('active');
        this.spin();
      });
    }
  },

  setActiveLines(count) {
    this.activeLines = Math.max(1, Math.min(20, count));
    this.updateControlsDisplay();
  },

  setBetPerLine(amount) {
    this.betPerLine = Math.max(1, amount);
    this.updateControlsDisplay();
  },

  updateTotalDisplay() {
    const dispTotal = document.getElementById('slotsTotalBetDisplay');
    const total = this.freeSpinsState.isActive ? 0 : (this.activeLines * this.betPerLine);
    if (dispTotal) {
      dispTotal.textContent = `${total.toLocaleString('fr-FR')} 🪙`;
    }
    const betSummary = document.getElementById('slotsBetPerLineSummary');
    if (betSummary) {
      betSummary.textContent = `${this.betPerLine} 🪙 / ligne`;
    }
  },

  updateControlsDisplay() {
    const dispLines = document.getElementById('displayLinesCount');
    const inputLines = document.getElementById('slotsLinesInput');
    const linesBadge = document.getElementById('slotsActiveLinesBadge');
    const linesDetailed = document.getElementById('slotsLinesBadgeDetailed');
    const coverageBar = document.getElementById('slotsCoverageBarFill');

    if (dispLines) dispLines.textContent = this.activeLines;
    if (inputLines && parseInt(inputLines.value, 10) !== this.activeLines) {
      inputLines.value = this.activeLines;
    }

    const pct = Math.round((this.activeLines / 20) * 100);
    if (linesDetailed) linesDetailed.textContent = `${this.activeLines} / 20 • ${pct}%`;
    if (linesBadge) linesBadge.textContent = `${this.activeLines} Lignes • RTP 95.2%`;
    if (coverageBar) coverageBar.style.width = `${pct}%`;

    // Pills de sélection
    document.querySelectorAll('#slotsLinesPills .btn-line-pill').forEach(pill => {
      const pCount = parseInt(pill.dataset.lines, 10);
      pill.classList.toggle('active', pCount === this.activeLines);
    });

    // Champs de mise
    const dispBetLine = document.getElementById('displayBetPerLine');
    const inputBetLine = document.getElementById('slotsBetPerLineInput');
    if (dispBetLine) dispBetLine.textContent = this.betPerLine;
    if (inputBetLine && parseInt(inputBetLine.value, 10) !== this.betPerLine) {
      inputBetLine.value = this.betPerLine;
    }

    // Puces actives
    document.querySelectorAll('#view-slots .quick-bet-chips .casino-chip').forEach(chip => {
      const b = parseInt(chip.dataset.betPerLine, 10);
      chip.classList.toggle('active-chip', b === this.betPerLine);
    });

    this.updateTotalDisplay();

    // Mise en surbrillance des tags latéraux
    for (let i = 1; i <= 20; i++) {
      const tag = document.querySelector(`.line-tag[data-line="${i}"]`);
      if (tag) {
        tag.classList.toggle('active', i <= this.activeLines);
      }
    }
  },

  // Aperçu interactif d'une ligne de paiement au survol d'un tag
  previewPayline(lineNum) {
    if (this.isSpinning) return;
    const line = this.paylinesData.find(l => l.id === lineNum);
    if (!line) return;

    const svg = document.getElementById('slotsPaylinesSvg');
    const container = document.getElementById('slotsReelsContainer');
    const badge = document.getElementById('slotsPaylinePreviewBadge');
    const badgeText = document.getElementById('slotsPreviewBadgeText');

    if (badge && badgeText) {
      badgeText.textContent = `👁️ Ligne ${line.id} : ${line.name} (Couleur : ${line.color})`;
      badge.style.display = 'block';
    }

    if (!svg || !container) return;
    const contRect = container.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${contRect.width} ${contRect.height}`);

    // Retirer les précédents aperçus
    const oldPrev = svg.querySelector('.payline-svg-preview');
    if (oldPrev) oldPrev.remove();

    const points = [];
    line.coords.forEach(([col, row]) => {
      const cell = document.getElementById(`slot-cell-${col}-${row}`);
      if (cell) {
        cell.classList.add('preview-line-cell');
        const r = cell.getBoundingClientRect();
        const cx = (r.left - contRect.left) + r.width / 2;
        const cy = (r.top - contRect.top) + r.height / 2;
        points.push(`${cx},${cy}`);
      }
    });

    if (points.length >= 2) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      path.setAttribute('points', points.join(' '));
      path.setAttribute('stroke', line.color || '#FFD700');
      path.setAttribute('class', 'payline-svg-preview');
      svg.appendChild(path);
    }
  },

  clearPaylinePreview() {
    const svg = document.getElementById('slotsPaylinesSvg');
    if (svg) {
      const oldPrev = svg.querySelector('.payline-svg-preview');
      if (oldPrev) oldPrev.remove();
    }
    document.querySelectorAll('.slot-cell.preview-line-cell').forEach(c => {
      c.classList.remove('preview-line-cell');
    });
    const badge = document.getElementById('slotsPaylinePreviewBadge');
    if (badge) badge.style.display = 'none';
  },

  renderInitialReels() {
    const defaultGrid = [
      ['mars', 'A', 'cafe'],
      ['diamond', 'wild', '10'],
      ['scatter', 'canette', 'J'],
      ['choc', 'K', 'chips'],
      ['Q', 'diamond', 'mars']
    ];

    for (let c = 0; c < 5; c++) {
      const reelEl = document.getElementById(`slot-reel-${c}`);
      if (!reelEl) continue;
      reelEl.innerHTML = '';

      const strip = document.createElement('div');
      strip.className = 'slot-strip';
      strip.id = `slot-strip-${c}`;

      for (let r = 0; r < 3; r++) {
        const symId = defaultGrid[c][r] || 'canette';
        const cell = this.createCellElement(symId, c, r);
        strip.appendChild(cell);
      }
      reelEl.appendChild(strip);
    }
  },

  createCellElement(symId, col, row) {
    const meta = this.symbolMeta[symId] || { icon: '❓', badge: symId, label: symId };
    const cell = document.createElement('div');
    cell.className = 'slot-cell';
    cell.id = `slot-cell-${col}-${row}`;
    cell.dataset.symbol = symId;

    cell.innerHTML = `
      <div class="cell-icon">${meta.icon}</div>
      <div class="cell-badge">${meta.badge}</div>
    `;
    return cell;
  },

  updateFreeSpinsBanner() {
    const banner = document.getElementById('slotsFreeSpinsBanner');
    const cabinet = document.getElementById('slotsCabinet');
    const spinBtn = document.getElementById('slotsSpinBtn');
    const currNum = document.getElementById('fsCurrentNum');
    const totalNum = document.getElementById('fsTotalNum');
    const accumEl = document.getElementById('fsAccumulatedWin');

    if (this.freeSpinsState.isActive) {
      if (banner) banner.classList.add('active');
      if (cabinet) cabinet.classList.add('bonus-mode');
      if (currNum) currNum.textContent = (this.freeSpinsState.total - this.freeSpinsState.remaining + 1);
      if (totalNum) totalNum.textContent = this.freeSpinsState.total;
      if (accumEl) accumEl.textContent = this.freeSpinsState.accumulatedWin.toLocaleString();
      if (spinBtn) {
        spinBtn.innerHTML = `⚡ TOUR GRATUIT (${this.freeSpinsState.remaining} RESTANTS)`;
        spinBtn.style.background = 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)';
        spinBtn.style.borderColor = '#38BDF8';
      }
    } else {
      if (banner) banner.classList.remove('active');
      if (cabinet) cabinet.classList.remove('bonus-mode');
      if (spinBtn) {
        spinBtn.innerHTML = `🎰 TOURNER`;
        spinBtn.style.background = '';
        spinBtn.style.borderColor = '';
      }
    }
    this.updateControlsDisplay();
  },

  // =========================================================
  // GESTION DU SPIN PRINCIPAL (5 ROULEAUX SÉQUENTIELS)
  // =========================================================
  async spin() {
    if (this.isSpinning) return;

    if (!window.State || !window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour lancer la machine à sous.', 'error');
      window.UI.openAuthModal('login');
      this.stopAutoplay();
      return;
    }

    const inputBet = document.getElementById('slotsBetPerLineInput');
    if (inputBet) {
      const val = parseInt(inputBet.value, 10);
      if (!isNaN(val) && val > 0) this.betPerLine = val;
    }

    const totalBet = this.freeSpinsState.isActive ? 0 : (this.activeLines * this.betPerLine);
    if (!this.freeSpinsState.isActive) {
      if (!Number.isInteger(totalBet) || totalBet < 10) {
        window.UI.showToast('Mise totale minimale : 10 coins.', 'error');
        this.stopAutoplay();
        return;
      }
      if (window.State.user.coins < totalBet) {
        window.UI.showToast('Solde insuffisant pour couvrir cette mise.', 'error');
        this.stopAutoplay();
        return;
      }
    }

    if (totalBet > 0 && window.State) {
      window.State.deductBet(totalBet);
    } else if (window.State) {
      window.State.setGameAnimating(true);
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('slotsSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    // Masquer les gains précédents et réinitialiser les tracés SVG
    this.clearWinningHighlights();
    this.hideGambleBar();

    const banner = document.getElementById('slotsResultBanner');
    if (banner) banner.style.display = 'none';

    // Démarrer l'animation de rotation avec motion blur sur les 5 rouleaux
    for (let c = 0; c < 5; c++) {
      const strip = document.getElementById(`slot-strip-${c}`);
      if (strip) strip.classList.add('spinning');
    }

    // Son continu de rotation
    const spinSoundInterval = setInterval(() => {
      if (window.sound && typeof window.sound.playSpinTick === 'function') {
        window.sound.playSpinTick();
      }
    }, 110);

    try {
      // Appel API serveur
      const data = await window.API.spinSlots({
        betPerLine: this.betPerLine,
        linesCount: this.activeLines
      });

      // Arrêt séquentiel progressif des 5 rouleaux (délai de 180ms entre chaque colonne)
      let scatterCountAccum = 0;
      for (let c = 0; c < 5; c++) {
        await new Promise(r => setTimeout(r, 200));

        const strip = document.getElementById(`slot-strip-${c}`);
        if (strip) {
          strip.classList.remove('spinning');

          // Insérer les vrais symboles générés par le serveur
          for (let r = 0; r < 3; r++) {
            const symId = data.grid[c][r];
            const cell = document.getElementById(`slot-cell-${c}-${r}`);
            if (cell) {
              const meta = this.symbolMeta[symId] || { icon: '❓', badge: symId };
              cell.dataset.symbol = symId;
              cell.innerHTML = `
                <div class="cell-icon">${meta.icon}</div>
                <div class="cell-badge">${meta.badge}</div>
              `;
              if (symId === 'scatter') scatterCountAccum++;
            }
          }
        }

        // Effet sonore d'arrêt du rouleau
        if (window.sound && typeof window.sound.playReelStop === 'function') {
          window.sound.playReelStop(c);
        }

        // Son d'anticipation si un Scatter apparaît
        const hasScatterInCol = data.grid[c].includes('scatter');
        if (hasScatterInCol && window.sound && typeof window.sound.playScatter === 'function') {
          window.sound.playScatter(scatterCountAccum);
        }
      }

      clearInterval(spinSoundInterval);

      // Mettre à jour le solde uniquement après l'arrêt complet de tous les rouleaux
      if (window.State && data.coins !== undefined) {
        window.State.setGameAnimating(false, data.coins);
      }

      // Mise à jour de l'état Free Spins
      if (data.freeSpinsState) {
        if (data.freeSpinsState.justTriggered) {
          // Nouveau bonus déclenché !
          this.freeSpinsState = {
            isActive: true,
            remaining: data.freeSpinsState.remaining,
            total: data.freeSpinsState.total,
            multiplier: data.freeSpinsState.multiplier || 3,
            accumulatedWin: 0
          };
          this.showBonusCelebrationModal(data.freeSpinsState.total);
        } else if (data.freeSpinsState.isActive) {
          this.freeSpinsState = {
            isActive: !data.freeSpinsState.justFinished,
            remaining: data.freeSpinsState.remaining,
            total: data.freeSpinsState.total,
            multiplier: data.freeSpinsState.multiplier || 3,
            accumulatedWin: data.freeSpinsState.accumulatedWin
          };
          if (data.freeSpinsState.justFinished) {
            window.UI.showToast(`🎉 Fin des Tours Gratuits ! Gain cumulé : +${data.freeSpinsState.accumulatedWin.toLocaleString()} 🪙 !`, 'success', 6000);
          }
        } else {
          this.freeSpinsState.isActive = false;
        }
        this.updateFreeSpinsBanner();
      }

      // Traitement des gains
      if (data.isWin) {
        this.handleWin(data);
      } else {
        if (banner) {
          banner.textContent = '❌ Aucun gain sur ce tour.';
          banner.className = 'result-banner lose';
          banner.style.display = 'block';
        }
        if (window.sound && typeof window.sound.playLose === 'function') {
          window.sound.playLose();
        }
      }

    } catch (err) {
      clearInterval(spinSoundInterval);
      for (let c = 0; c < 5; c++) {
        const strip = document.getElementById(`slot-strip-${c}`);
        if (strip) strip.classList.remove('spinning');
      }
      window.UI.showToast(err.message || 'Erreur lors du tour de rouleaux.', 'error');
      this.stopAutoplay();
    } finally {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;

      // Continuer Autoplay si activé
      if (this.isAutoplay) {
        this.autoplayRemaining--;
        if (this.autoplayRemaining <= 0 || (this.freeSpinsState.isActive && this.freeSpinsState.remaining <= 0)) {
          this.stopAutoplay();
        } else {
          setTimeout(() => {
            if (this.isAutoplay) this.spin();
          }, 1200);
        }
      }
    }
  },

  handleWin(data) {
    const banner = document.getElementById('slotsResultBanner');
    const winningLines = data.winningLines || [];

    // Message bannière
    let title = `🎉 GAIN : +${data.payout.toLocaleString()} JETONS !`;
    if (data.isJackpot) title = `🪐 JACKPOT COSMIQUE : +${data.payout.toLocaleString()} 🪙 !`;
    else if (data.isMegaWin) title = `💥 MÉGA GAIN : +${data.payout.toLocaleString()} 🪙 !`;
    else if (data.isBigWin) title = `✨ GROS GAIN : +${data.payout.toLocaleString()} 🪙 !`;

    if (banner) {
      banner.textContent = `${title} (${winningLines.length} ligne${winningLines.length > 1 ? 's' : ''}${data.scatter.payout > 0 ? ' + Scatters' : ''})`;
      banner.className = 'result-banner win';
      banner.style.display = 'block';
    }

    // Effets sonores et confettis
    if (data.isJackpot || data.isMegaWin) {
      if (window.sound && typeof window.sound.playJackpot === 'function') window.sound.playJackpot();
      if (window.UI && typeof window.UI.triggerConfetti === 'function') window.UI.triggerConfetti();
    } else if (data.isBigWin) {
      if (window.sound && typeof window.sound.playBigWin === 'function') window.sound.playBigWin();
      if (window.UI && typeof window.UI.triggerConfetti === 'function') window.UI.triggerConfetti();
    } else {
      if (window.sound && typeof window.sound.playWin === 'function') window.sound.playWin();
    }

    // Mise en surbrillance des cellules victorieuses
    winningLines.forEach(line => {
      line.coords.forEach(([col, row]) => {
        const cell = document.getElementById(`slot-cell-${col}-${row}`);
        if (cell) cell.classList.add('win-cell');
      });
    });

    if (data.scatter && data.scatter.coords) {
      data.scatter.coords.forEach(([col, row]) => {
        const cell = document.getElementById(`slot-cell-${col}-${row}`);
        if (cell) cell.classList.add('win-cell');
      });
    }

    // Tracer les lignes SVG gagnantes
    this.drawWinningPaylines(winningLines);

    // Proposer Quitte ou Double si en mode régulier
    if (!this.freeSpinsState.isActive && data.canGamble && data.payout > 0) {
      this.showGambleBar(data.payout);
    }
  },

  drawWinningPaylines(winningLines) {
    const svg = document.getElementById('slotsPaylinesSvg');
    if (!svg) return;
    svg.innerHTML = '';

    const container = document.getElementById('slotsReelsContainer');
    if (!container) return;

    const contRect = container.getBoundingClientRect();
    const width = contRect.width;
    const height = contRect.height;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    winningLines.forEach(line => {
      const points = [];
      line.coords.forEach(([col, row]) => {
        const cell = document.getElementById(`slot-cell-${col}-${row}`);
        if (cell) {
          const r = cell.getBoundingClientRect();
          const cx = (r.left - contRect.left) + r.width / 2;
          const cy = (r.top - contRect.top) + r.height / 2;
          points.push(`${cx},${cy}`);
        }
      });

      if (points.length >= 2) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        path.setAttribute('points', points.join(' '));
        path.setAttribute('stroke', line.color || '#FFD700');
        path.setAttribute('class', 'payline-svg-path');
        svg.appendChild(path);
      }
    });
  },

  clearWinningHighlights() {
    document.querySelectorAll('.slot-cell').forEach(c => c.classList.remove('win-cell'));
    const svg = document.getElementById('slotsPaylinesSvg');
    if (svg) svg.innerHTML = '';
  },

  // =========================================================
  // GESTION DU BONUS FREE SPINS
  // =========================================================
  showBonusCelebrationModal(count) {
    const modal = document.getElementById('slotsBonusModal');
    const countEl = document.getElementById('bonusModalFsCount');
    if (countEl) countEl.textContent = count;
    if (modal) modal.classList.add('active');

    if (window.sound && typeof window.sound.playBonusTrigger === 'function') {
      window.sound.playBonusTrigger();
    }
    if (window.UI && typeof window.UI.triggerConfetti === 'function') {
      window.UI.triggerConfetti();
    }
  },

  // =========================================================
  // GESTION DE L'AUTOPLAY
  // =========================================================
  toggleAutoplay() {
    if (this.isAutoplay) {
      this.stopAutoplay();
    } else {
      const count = prompt('Nombre de tours automatiques (10, 25, 50, 100) :', '25');
      const num = parseInt(count);
      if (!isNaN(num) && num > 0) {
        this.startAutoplay(num);
      }
    }
  },

  startAutoplay(count) {
    this.isAutoplay = true;
    this.autoplayRemaining = Math.min(100, count);
    const btn = document.getElementById('btnSlotsAutoplay');
    if (btn) {
      btn.classList.add('active');
      btn.textContent = `⏹️ STOP (${this.autoplayRemaining})`;
    }
    this.spin();
  },

  stopAutoplay() {
    this.isAutoplay = false;
    this.autoplayRemaining = 0;
    const btn = document.getElementById('btnSlotsAutoplay');
    if (btn) {
      btn.classList.remove('active');
      btn.textContent = `🔁 AUTO`;
    }
  },

  // =========================================================
  // QUITTE OU DOUBLE (GAMBLE / DOUBLE OR NOTHING)
  // =========================================================
  showGambleBar(amount) {
    this.gambleState.currentAmount = amount;
    const bar = document.getElementById('slotsGambleBar');
    const amtEl = document.getElementById('gambleCurrentWinAmount');
    if (amtEl) amtEl.textContent = `${amount.toLocaleString()} 🪙`;
    if (bar) bar.style.display = 'flex';
  },

  hideGambleBar() {
    const bar = document.getElementById('slotsGambleBar');
    if (bar) bar.style.display = 'none';
  },

  openGambleModal() {
    this.hideGambleBar();
    const modal = document.getElementById('slotsGambleModal');
    const stakeEl = document.getElementById('gambleModalStake');
    const potEl = document.getElementById('gambleModalPotential');
    const msgEl = document.getElementById('gambleFeedbackMsg');

    // Réinitialisation de la carte 3D vers son dos luxueux
    const cardInner = document.getElementById('gambleCardInner');
    const cardFront = document.getElementById('gambleCardFront');
    if (cardInner) {
      cardInner.className = 'gamble-card-inner';
    }
    if (cardFront) {
      cardFront.className = 'gamble-card-face gamble-card-front';
    }

    const rankTL = document.getElementById('gambleCardRankTL');
    const suitTL = document.getElementById('gambleCardSuitTL');
    const centerSuit = document.getElementById('gambleCardCenterSuit');
    const rankBR = document.getElementById('gambleCardRankBR');
    const suitBR = document.getElementById('gambleCardSuitBR');

    if (rankTL) rankTL.textContent = '?';
    if (suitTL) suitTL.textContent = '🃏';
    if (centerSuit) centerSuit.textContent = '🃏';
    if (rankBR) rankBR.textContent = '?';
    if (suitBR) suitBR.textContent = '🃏';

    if (stakeEl) stakeEl.textContent = `${this.gambleState.currentAmount.toLocaleString('fr-FR')} 🪙`;
    if (potEl) potEl.textContent = `${(this.gambleState.currentAmount * 2).toLocaleString('fr-FR')} 🪙`;
    if (msgEl) msgEl.style.display = 'none';

    if (modal) modal.classList.add('active');
  },

  closeGambleModal() {
    const modal = document.getElementById('slotsGambleModal');
    if (modal) modal.classList.remove('active');
  },

  async executeGamble(choice) {
    if (this.gambleState.isGambling || this.gambleState.currentAmount <= 0) return;
    this.gambleState.isGambling = true;

    const redBtn = document.getElementById('btnGambleChooseRed');
    const blackBtn = document.getElementById('btnGambleChooseBlack');
    const cashoutBtn = document.getElementById('btnGambleCashout');
    if (redBtn) redBtn.disabled = true;
    if (blackBtn) blackBtn.disabled = true;
    if (cashoutBtn) cashoutBtn.disabled = true;

    try {
      const cardInner = document.getElementById('gambleCardInner');
      const cardFront = document.getElementById('gambleCardFront');
      const stakeEl = document.getElementById('gambleModalStake');
      const potEl = document.getElementById('gambleModalPotential');
      const msgEl = document.getElementById('gambleFeedbackMsg');

      // Si la carte était déjà retournée (gain consécutif), la remettre face cachée avant le nouveau tirage
      if (cardInner && cardInner.classList.contains('flipped')) {
        cardInner.className = 'gamble-card-inner';
        await new Promise(r => setTimeout(r, 300));
      }

      const data = await window.API.gambleSlots(choice);

      // Mettre à jour les éléments de la carte
      const rankTL = document.getElementById('gambleCardRankTL');
      const suitTL = document.getElementById('gambleCardSuitTL');
      const centerSuit = document.getElementById('gambleCardCenterSuit');
      const rankBR = document.getElementById('gambleCardRankBR');
      const suitBR = document.getElementById('gambleCardSuitBR');

      if (rankTL) rankTL.textContent = data.drawnCard.rank;
      if (suitTL) suitTL.textContent = data.drawnCard.suit;
      if (centerSuit) centerSuit.textContent = data.drawnCard.suit;
      if (rankBR) rankBR.textContent = data.drawnCard.rank;
      if (suitBR) suitBR.textContent = data.drawnCard.suit;

      if (cardFront) {
        cardFront.className = `gamble-card-face gamble-card-front card-${data.drawnCard.color}`;
      }

      // Son de distribution de carte
      if (window.sound && typeof window.sound.playCardDeal === 'function') {
        window.sound.playCardDeal();
      }

      // Retourner la carte en 3D
      if (cardInner) {
        cardInner.classList.add('flipped');
      }

      // Laisser le temps à la rotation 3D de s'effectuer
      await new Promise(r => setTimeout(r, 450));

      // Ajouter le halo de victoire ou de défaite
      if (cardInner) {
        cardInner.classList.add(data.won ? 'is-win' : 'is-loss');
      }

      if (window.State && data.coins !== undefined) {
        window.State.setGameAnimating(false, data.coins);
      }

      if (data.won) {
        // Doublé !
        this.gambleState.currentAmount = data.newAmount;
        if (window.sound && typeof window.sound.playWin === 'function') window.sound.playWin();

        if (stakeEl) stakeEl.textContent = `${data.newAmount.toLocaleString('fr-FR')} 🪙`;
        if (potEl) potEl.textContent = `${(data.newAmount * 2).toLocaleString('fr-FR')} 🪙`;

        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(34, 197, 94, 0.15)';
          msgEl.style.border = '1.5px solid #22c55e';
          msgEl.style.color = '#4ade80';
          msgEl.textContent = data.message;
        }
      } else {
        // Perdu
        this.gambleState.currentAmount = 0;
        if (window.sound && typeof window.sound.playLose === 'function') window.sound.playLose();

        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(239, 68, 68, 0.15)';
          msgEl.style.border = '1.5px solid #ef4444';
          msgEl.style.color = '#f87171';
          msgEl.textContent = data.message;
        }

        setTimeout(() => {
          this.closeGambleModal();
        }, 1900);
      }
    } catch (err) {
      window.UI.showToast(err.message || 'Erreur Quitte ou Double.', 'error');
    } finally {
      this.gambleState.isGambling = false;
      if (redBtn) redBtn.disabled = false;
      if (blackBtn) blackBtn.disabled = false;
      if (cashoutBtn) cashoutBtn.disabled = false;
    }
  },

  async collectGamble() {
    try {
      await window.API.collectSlotsGamble();
      window.UI.showToast(`💰 Gain de ${this.gambleState.currentAmount.toLocaleString('fr-FR')} 🪙 sécurisé !`, 'success');
      this.gambleState.currentAmount = 0;
      this.hideGambleBar();
      this.closeGambleModal();
    } catch (e) {
      this.closeGambleModal();
    }
  }
};

window.SlotsGame = SlotsGame;
