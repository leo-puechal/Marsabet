// Wheel of Fortune Frontend Logic

const WheelGame = {
  isSpinning: false,
  currentBet: 50,
  currentRotation: 0,

  segments: [
    { index: 0, label: '0x', color: '#334155' },
    { index: 1, label: '1.2x', color: '#10B981' },
    { index: 2, label: '2x', color: '#3B82F6' },
    { index: 3, label: '0x', color: '#334155' },
    { index: 4, label: '1.5x', color: '#06B6D4' },
    { index: 5, label: '3x', color: '#8B5CF6' },
    { index: 6, label: '0.5x', color: '#F59E0B' },
    { index: 7, label: '5x', color: '#EC4899' },
    { index: 8, label: '0x', color: '#334155' },
    { index: 9, label: '1.2x', color: '#10B981' },
    { index: 10, label: '2x', color: '#3B82F6' },
    { index: 11, label: '10x', color: '#EF4444' },
    { index: 12, label: '0.5x', color: '#F59E0B' },
    { index: 13, label: '1.5x', color: '#06B6D4' },
    { index: 14, label: '3x', color: '#8B5CF6' },
    { index: 15, label: '👑 25x', color: '#D4AF37' }
  ],

  init() {
    this.drawWheel();
    this.bindEvents();
  },

  bindEvents() {
    const spinBtn = document.getElementById('wheelSpinBtn');
    if (spinBtn) spinBtn.addEventListener('click', () => this.spin());

    document.querySelectorAll('#view-wheel .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    const multBtns = document.querySelectorAll('#view-wheel .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(10, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        window.sound.playChip();
      });
    });

    const input = document.getElementById('wheelBetInput');
    if (input) {
      input.addEventListener('input', (e) => {
        if (this.isSpinning) return;
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.currentBet = val;
      });
      input.addEventListener('change', (e) => {
        if (this.isSpinning) return;
        const val = parseInt(e.target.value, 10);
        this.setBet(isNaN(val) || val < 10 ? 10 : val);
      });
    }
  },

  setBet(val) {
    this.currentBet = Math.max(10, val);
    const input = document.getElementById('wheelBetInput');
    if (input) input.value = this.currentBet;
  },

  drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = size / 2 - 8;

    const totalSegs = this.segments.length;
    const arc = (Math.PI * 2) / totalSegs;

    ctx.clearRect(0, 0, size, size);

    // Bague extérieure dorée
    ctx.beginPath();
    ctx.arc(center, center, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 8;
    ctx.stroke();

    for (let i = 0; i < totalSegs; i++) {
      const seg = this.segments[i];
      const angle = i * arc;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + arc);
      ctx.closePath();

      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = '#061124';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texte du multiplicateur
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Cinzel, Outfit, sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, radius - 20, 6);
      ctx.restore();
    }
  },

  async spin() {
    if (this.isSpinning) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour lancer la roue.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const input = document.getElementById('wheelBetInput');
    if (input) {
      const val = parseInt(input.value, 10);
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

    if (window.State && this.currentBet > 0) {
      window.State.deductBet(this.currentBet);
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('wheelSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    const banner = document.getElementById('wheelResultBanner');
    if (banner) banner.style.display = 'none';

    try {
      const data = await window.API.spinWheel(this.currentBet);

      // =========================================================================
      // CALCUL D'ANGLE EXACT DU CASINO :
      // - Segment k a son centre à (k + 0.5) * segAngle (depuis 3h00 / 0°)
      // - Pointeur au sommet (12h00) = 270°
      // - Condition d'arrêt au pointeur : targetMod = 270 - segCenter (mod 360)
      // =========================================================================
      const segAngle = 360 / this.segments.length;
      const segCenter = (data.segmentIndex + 0.5) * segAngle;
      const targetMod = (((270 - segCenter) % 360) + 360) % 360;
      const currentMod = (((this.currentRotation % 360) + 360) % 360);
      let additional = (targetMod - currentMod);
      if (additional < 0) additional += 360;

      const finalDeg = this.currentRotation + (360 * 6) + additional;
      this.currentRotation = finalDeg;

      const canvas = document.getElementById('wheelCanvas');
      if (canvas) {
        canvas.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.9, 0.2, 1)';
        canvas.style.transform = `rotate(${finalDeg}deg)`;
      }

      const tickSoundInterval = setInterval(() => {
        window.sound.playSpinTick();
      }, 120);

      setTimeout(() => {
        clearInterval(tickSoundInterval);
        this.isSpinning = false;
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.style.pointerEvents = 'auto';
        }

        // Mettre à jour le solde uniquement après l'arrêt complet de la roue
        if (window.State && data.coins !== undefined) {
          window.State.setGameAnimating(false, data.coins);
        }

        if (banner) {
          if (data.won) {
            banner.textContent = `🎡 VICTOIRE : ${data.segment.label} (+${data.payout} JETONS) !`;
            banner.className = 'result-banner win';
            banner.style.display = 'block';

            if (data.multiplier >= 10) {
              window.sound.playJackpot();
              window.UI.triggerConfetti();
            } else {
              window.sound.playWin();
              window.UI.triggerConfetti();
            }
          } else {
            banner.textContent = `🎡 Segment 0x — Perdu pour ce tour.`;
            banner.className = 'result-banner lose';
            banner.style.display = 'block';
            window.sound.playLose();
          }
        }
      }, 4600);
    } catch (err) {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      if (window.State) window.State.setGameAnimating(false);
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.WheelGame = WheelGame;
