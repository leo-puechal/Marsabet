// Slots Game Frontend Logic

const SlotsGame = {
  isSpinning: false,
  currentBet: 20,

  // Mapping symboles
  symbolIcons: {
    mars: '🪐',
    diamond: '💎',
    crown: '👑',
    seven: '🎰',
    clover: '🍀',
    grape: '🍇',
    lemon: '🍋',
    cherry: '🍒'
  },

  init() {
    this.bindEvents();
    this.renderInitialReels();
  },

  bindEvents() {
    const spinBtn = document.getElementById('slotsSpinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spin());
    }

    // Puces de mise
    document.querySelectorAll('#view-slots .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    // Multiplicateurs x2, 1/2, max
    const multBtns = document.querySelectorAll('#view-slots .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(1, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        window.sound.playChip();
      });
    });

    const input = document.getElementById('slotsBetInput');
    if (input) {
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) this.setBet(val);
      });
    }
  },

  setBet(val) {
    this.currentBet = Math.max(1, val);
    const input = document.getElementById('slotsBetInput');
    if (input) input.value = this.currentBet;
  },

  renderInitialReels() {
    for (let c = 0; c < 5; c++) {
      const reelEl = document.getElementById(`slot-reel-${c}`);
      if (!reelEl) continue;
      reelEl.innerHTML = '';
      const strip = document.createElement('div');
      strip.className = 'slot-strip';
      strip.id = `slot-strip-${c}`;

      // 3 symboles par défaut
      const defaultSyms = ['🍒', '🍋', '🍇', '🍀', '🎰', '👑', '💎', '🪐'];
      for (let r = 0; r < 3; r++) {
        const cell = document.createElement('div');
        cell.className = 'slot-cell';
        cell.id = `slot-cell-${c}-${r}`;
        cell.textContent = defaultSyms[(c + r) % defaultSyms.length];
        strip.appendChild(cell);
      }
      reelEl.appendChild(strip);
    }
  },

  async spin() {
    if (this.isSpinning) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Veuillez vous connecter pour jouer.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour cette mise.', 'error');
      return;
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('slotsSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    const banner = document.getElementById('slotsResultBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.className = 'result-banner';
    }

    // Réinitialiser les animations gagnantes précédentes
    document.querySelectorAll('.slot-cell').forEach(c => c.classList.remove('win-cell'));

    // Démarrer l'animation de rotation des 5 rouleaux
    for (let c = 0; c < 5; c++) {
      const strip = document.getElementById(`slot-strip-${c}`);
      if (strip) strip.classList.add('spinning');
    }

    // Son de rotation répétitif
    const spinSoundInterval = setInterval(() => {
      window.sound.playSpinTick();
    }, 120);

    try {
      const data = await window.API.spinSlots(this.currentBet);

      // Arrêt progressif des rouleaux (délai de 300ms entre chaque colonne)
      for (let c = 0; c < 5; c++) {
        await new Promise(r => setTimeout(r, 250));
        const strip = document.getElementById(`slot-strip-${c}`);
        if (strip) {
          strip.classList.remove('spinning');
          // Remplacer par les vrais symboles reçus du serveur
          for (let r = 0; r < 3; r++) {
            const cell = document.getElementById(`slot-cell-${c}-${r}`);
            if (cell) {
              const symId = data.grid[c][r];
              cell.textContent = this.symbolIcons[symId] || '🍒';
            }
          }
        }
      }

      clearInterval(spinSoundInterval);

      // Mettre à jour le solde
      window.State.updateCoins(data.coins);

      // Affichage du résultat
      if (banner) {
        if (data.isWin) {
          banner.textContent = `🎉 GAIN : +${data.payout} JETONS ! (${data.winningLines.length} ligne${data.winningLines.length > 1 ? 's' : ''})`;
          banner.className = 'result-banner win';
          banner.style.display = 'block';

          // Marquer les cellules victorieuses
          data.winningLines.forEach(line => {
            line.coords.forEach(([col, row]) => {
              const cell = document.getElementById(`slot-cell-${col}-${row}`);
              if (cell) cell.classList.add('win-cell');
            });
          });

          if (data.isJackpot) {
            window.sound.playJackpot();
            window.UI.triggerConfetti();
          } else {
            window.sound.playWin();
            if (data.isBigWin) window.UI.triggerConfetti();
          }
        } else {
          banner.textContent = '❌ Perdu pour ce tour';
          banner.className = 'result-banner lose';
          banner.style.display = 'block';
          window.sound.playLose();
        }
      }
    } catch (err) {
      clearInterval(spinSoundInterval);
      for (let c = 0; c < 5; c++) {
        const strip = document.getElementById(`slot-strip-${c}`);
        if (strip) strip.classList.remove('spinning');
      }
      window.UI.showToast(err.message, 'error');
    } finally {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
    }
  }
};

window.SlotsGame = SlotsGame;
