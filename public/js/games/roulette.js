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
        const val = parseInt(e.currentTarget.dataset.val, 10);
        this.setChip(val);
        document.querySelectorAll('#view-roulette .casino-chip').forEach(c => c.style.transform = '');
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.1)';
        window.sound.playChip();
      });
    });

    // Champ de saisie personnalisé
    const customChipInput = document.getElementById('rouletteCustomChipInput');
    if (customChipInput) {
      customChipInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          this.selectedChip = val;
          document.querySelectorAll('#view-roulette .casino-chip').forEach(c => c.style.transform = '');
        }
      });
      customChipInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setChip(isNaN(val) || val <= 0 ? 10 : val);
      });
    }

    // Multiplicateurs de jeton
    document.querySelectorAll('#view-roulette .btn-mult').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setChip(Math.max(1, Math.floor(this.selectedChip / 2)));
        if (action === 'double') this.setChip(this.selectedChip * 2);
        if (action === 'max' && window.State.user) this.setChip(window.State.user.coins);
        document.querySelectorAll('#view-roulette .casino-chip').forEach(c => c.style.transform = '');
        window.sound.playChip();
      });
    });
  },

  setChip(val) {
    this.selectedChip = Math.max(1, val);
    const input = document.getElementById('rouletteCustomChipInput');
    if (input) input.value = this.selectedChip;
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

  drawWheel(ballDistanceOverride = null) {
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
    const ballDistance = ballDistanceOverride !== null ? ballDistanceOverride : (radius - 20);
    const bx = Math.cos(this.ballAngle) * ballDistance;
    const by = Math.sin(this.ballAngle) * ballDistance;

    ctx.beginPath();
    ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
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

    const totalBet = this.currentBets.reduce((acc, b) => acc + b.amount, 0);
    if (totalBet < 10) {
      window.UI.showToast('Mise totale minimale sur la roulette : 10 coins.', 'error');
      return;
    }

    if (window.State && window.State.user && window.State.user.coins < totalBet) {
      window.UI.showToast('Solde insuffisant pour placer ces paris.', 'error');
      return;
    }

    if (window.State && totalBet > 0) {
      window.State.deductBet(totalBet);
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('rouletteSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    const banner = document.getElementById('rouletteResultBanner');
    if (banner) banner.style.display = 'none';

    try {
      // Le résultat final est tiré côté serveur AVANT le lancement de l'animation
      const data = await window.API.spinRoulette(this.currentBets);

      const totalSlices = this.wheelNumbers.length;
      const sliceAngle = (Math.PI * 2) / totalSlices;
      const twoPi = Math.PI * 2;

      // Index exact du numéro gagnant sur le cylindre
      const targetIndex = this.wheelNumbers.indexOf(data.winningNumber);

      const startWheel = this.wheelAngle;
      const startBall = this.ballAngle;

      // 1. La roue tourne dans le sens des aiguilles d'une montre (rotation positive)
      const wheelRotations = 1.35;
      const deltaWheel = wheelRotations * twoPi;
      const finalWheel = startWheel + deltaWheel;

      // 2. Position angulaire mondiale du centre de la case cible à la fin de la rotation
      const finalPocketAngle = finalWheel + (targetIndex * sliceAngle) + (sliceAngle / 2);

      // 3. La bille tourne DANS LE SENS INVERSE (sens trigonométrique inverse / horaire inversé)
      // On cherche finalBall tel que finalBall % 2π === finalPocketAngle % 2π et finalBall < startBall
      let diff = (finalPocketAngle - startBall) % twoPi;
      if (diff < 0) diff += twoPi;

      // 6 tours complets en sens inverse pour une course spectaculaire et réaliste
      const extraRevolutions = 6;
      const finalBall = startBall + diff - ((extraRevolutions + 1) * twoPi);

      // Durée totale de l'animation : 4.8 secondes
      const duration = 4800;
      const start = performance.now();
      const outerRadius = 140 - 8 - 7;  // Sur la piste extérieure
      const innerRadius = 140 - 8 - 20; // Dans la case finale

      let lastTickAngle = startBall;

      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        // Décélération progressive cubique réaliste (ralentissement net dans les 2 dernières secondes)
        const ease = 1 - Math.pow(1 - progress, 3.2);

        this.wheelAngle = startWheel + (finalWheel - startWheel) * ease;
        this.ballAngle = startBall + (finalBall - startBall) * ease;

        // Effet de descente de la piste vers le réceptacle dans les 2 dernières secondes
        let currentDist = outerRadius;
        if (progress > 0.58) {
          const dropT = Math.min(1, (progress - 0.58) / 0.38);
          const dropEase = 1 - Math.pow(1 - dropT, 2);
          currentDist = outerRadius - (outerRadius - innerRadius) * dropEase;
        }

        // Ticks sonores synchronisés avec le passage de la bille sur les cloisons
        const angleTraveledSinceLastTick = Math.abs(this.ballAngle - lastTickAngle);
        if (angleTraveledSinceLastTick >= (sliceAngle * 0.95)) {
          window.sound.playSpinTick();
          lastTickAngle = this.ballAngle;
        }

        this.drawWheel(currentDist);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Bille arrêtée exactement sur la case gagnante sans correction
          this.drawWheel(innerRadius);
          this.isSpinning = false;
          if (spinBtn) spinBtn.disabled = false;

          if (window.State && data.coins !== undefined) {
            window.State.setGameAnimating(false, data.coins);
          }

          if (banner) {
            const colText = data.color === 'red' ? 'Rouge' : (data.color === 'black' ? 'Noir' : 'Vert');
            if (data.isWin) {
              banner.textContent = `🎯 Numéro ${data.winningNumber} (${colText}) ! Gain : +${data.totalPayout.toLocaleString()} JETONS !`;
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
      if (window.State) window.State.setGameAnimating(false);
      window.UI.showToast(err.message || 'Erreur lors du lancer de roulette', 'error');
    }
  }
};

window.RouletteGame = RouletteGame;
