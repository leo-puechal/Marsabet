// European Roulette Frontend Logic with Canvas Animation

const RouletteGame = {
  isSpinning: false,
  selectedChip: 25,
  currentBets: [], // array de { type, value, amount }
  wheelNumbers: [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ],
  redNumbers: new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
  wheelAngle: 0,
  ballAngle: 0,

  init() {
    this.drawWheel();
    this.bindEvents();
    this.renderBoard();
  },

  bindEvents() {
    const spinBtn = document.getElementById('rouletteSpinBtn');
    const clearBtn = document.getElementById('rouletteClearBtn');

    if (spinBtn) spinBtn.addEventListener('click', () => this.spin());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearBets());

    // Puces sélectionnées
    document.querySelectorAll('#view-roulette .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.selectedChip = val;
        document.querySelectorAll('#view-roulette .casino-chip').forEach(c => c.style.transform = '');
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.1)';
        window.sound.playChip();
      });
    });
  },

  renderBoard() {
    const grid = document.getElementById('rouletteNumbersGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // L'ordre des 3 rangées de la roulette :
    // Rangée 1 : 3, 6, 9, ... 36
    // Rangée 2 : 2, 5, 8, ... 35
    // Rangée 3 : 1, 4, 7, ... 34
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 12; col++) {
        const num = (col * 3) + (3 - row);
        const cell = document.createElement('div');
        const isRed = this.redNumbers.has(num);
        cell.className = `num-cell ${isRed ? 'red' : 'black'}`;
        cell.id = `roulette-num-${num}`;
        cell.textContent = num;
        cell.dataset.type = 'number';
        cell.dataset.value = num;

        cell.addEventListener('click', () => this.addBet('number', num, cell));
        grid.appendChild(cell);
      }
    }

    // Zero
    const zeroCell = document.getElementById('roulette-num-0');
    if (zeroCell) {
      zeroCell.addEventListener('click', () => this.addBet('number', 0, zeroCell));
    }

    // Paris extérieurs
    document.querySelectorAll('.outside-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        const val = e.currentTarget.dataset.value;
        this.addBet(type, val, e.currentTarget);
      });
    });
  },

  addBet(type, value, element) {
    if (this.isSpinning) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour miser.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const totalCurrentBet = this.currentBets.reduce((acc, b) => acc + b.amount, 0);
    if (window.State.user.coins < totalCurrentBet + this.selectedChip) {
      window.UI.showToast('Solde insuffisant pour ce jeton !', 'error');
      return;
    }

    window.sound.playChip();

    const existing = this.currentBets.find(b => b.type === type && String(b.value) === String(value));
    if (existing) {
      existing.amount += this.selectedChip;
    } else {
      this.currentBets.push({ type, value, amount: this.selectedChip });
    }

    // Afficher badge sur l'élément
    let badge = element.querySelector('.chip-placed-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chip-placed-badge';
      element.appendChild(badge);
    }
    const currentBetAmount = existing ? existing.amount : this.selectedChip;
    badge.textContent = currentBetAmount;

    this.updateTotalBetDisplay();
  },

  clearBets() {
    if (this.isSpinning) return;
    this.currentBets = [];
    document.querySelectorAll('.chip-placed-badge').forEach(b => b.remove());
    this.updateTotalBetDisplay();
  },

  updateTotalBetDisplay() {
    const total = this.currentBets.reduce((acc, b) => acc + b.amount, 0);
    const display = document.getElementById('rouletteTotalBet');
    if (display) display.textContent = total.toLocaleString();
  },

  drawWheel() {
    const canvas = document.getElementById('rouletteCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    // Bordure dorée extérieure
    ctx.beginPath();
    ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.stroke();

    const totalSlices = this.wheelNumbers.length;
    const sliceAngle = (Math.PI * 2) / totalSlices;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.wheelAngle);

    for (let i = 0; i < totalSlices; i++) {
      const num = this.wheelNumbers[i];
      const angle = i * sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + sliceAngle);
      ctx.closePath();

      if (num === 0) {
        ctx.fillStyle = '#047857';
      } else if (this.redNumbers.has(num)) {
        ctx.fillStyle = '#DC2626';
      } else {
        ctx.fillStyle = '#111827';
      }
      ctx.fill();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dessiner numéro
      ctx.save();
      ctx.rotate(angle + sliceAngle / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(num), radius - 8, 4);
      ctx.restore();
    }

    ctx.restore();

    // Dessiner la bille
    ctx.save();
    ctx.translate(center, center);
    const ballDistance = radius - 22;
    const bx = Math.cos(this.ballAngle) * ballDistance;
    const by = Math.sin(this.ballAngle) * ballDistance;

    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  },

  async spin() {
    if (this.isSpinning) return;
    if (this.currentBets.length === 0) {
      window.UI.showToast('Place au moins un jeton sur le tapis !', 'error');
      return;
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('rouletteSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    const banner = document.getElementById('rouletteResultBanner');
    if (banner) banner.style.display = 'none';

    try {
      const data = await window.API.spinRoulette(this.currentBets);

      // Calcul de l'animation de la roue et de la bille
      const sliceAngle = (Math.PI * 2) / this.wheelNumbers.length;
      // Index du numéro gagnant sur la roue
      const targetIndex = data.wheelIndex;
      // Position cible
      const targetAngle = -(targetIndex * sliceAngle) - (sliceAngle / 2) + (Math.PI * 1.5);

      const startWheel = this.wheelAngle;
      const startBall = this.ballAngle;
      const totalRotations = 6;
      const finalWheel = targetAngle + (Math.PI * 2 * totalRotations);
      const finalBall = finalWheel + (Math.PI * 2 * 3);

      const duration = 4000;
      const start = performance.now();

      const soundTickInterval = setInterval(() => {
        window.sound.playSpinTick();
      }, 90);

      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

        this.wheelAngle = startWheel + (finalWheel - startWheel) * ease;
        this.ballAngle = startBall + (finalBall - startBall) * ease;
        this.drawWheel();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          clearInterval(soundTickInterval);
          this.isSpinning = false;
          if (spinBtn) spinBtn.disabled = false;

          window.State.updateCoins(data.coins);

          if (banner) {
            const colText = data.color === 'red' ? 'Rouge' : (data.color === 'black' ? 'Noir' : 'Vert');
            if (data.isWin) {
              banner.textContent = `🎯 Numéro ${data.winningNumber} (${colText}) ! Gain : +${data.totalPayout} JETONS !`;
              banner.className = 'result-banner win';
              banner.style.display = 'block';
              window.sound.playWin();
              window.UI.triggerConfetti();
            } else {
              banner.textContent = `🎯 Numéro ${data.winningNumber} (${colText}) — Pas de gain ce tour.`;
              banner.className = 'result-banner lose';
              banner.style.display = 'block';
              window.sound.playLose();
            }
          }
        }
      };

      requestAnimationFrame(animate);
    } catch (err) {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.RouletteGame = RouletteGame;
