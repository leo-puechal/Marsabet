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
        if (action === 'half') this.setBet(Math.max(1, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) this.setBet(window.State.user.coins);
        window.sound.playChip();
      });
    });
  },

  setBet(val) {
    this.currentBet = Math.max(1, val);
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

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour miser.', 'error');
      return;
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('wheelSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    const banner = document.getElementById('wheelResultBanner');
    if (banner) banner.style.display = 'none';

    try {
      const data = await window.API.spinWheel(this.currentBet);

      // Calcul de la rotation en degrés
      // Le pointeur est en haut (270° ou -90°)
      const segAngle = 360 / this.segments.length; // 22.5 deg
      const targetDeg = data.targetAngle;
      const extraSpins = 360 * 6; // 6 tours complets
      // Pour aligner avec le pointeur en haut :
      const finalDeg = this.currentRotation + extraSpins + (270 - (this.currentRotation % 360) - targetDeg);
      this.currentRotation = finalDeg;

      const canvas = document.getElementById('wheelCanvas');
      if (canvas) {
        canvas.style.transition = 'transform 4s cubic-bezier(0.12, 0.9, 0.2, 1)';
        canvas.style.transform = `rotate(${finalDeg}deg)`;
      }

      const tickSoundInterval = setInterval(() => {
        window.sound.playSpinTick();
      }, 100);

      setTimeout(() => {
        clearInterval(tickSoundInterval);
        this.isSpinning = false;
        if (spinBtn) spinBtn.disabled = false;

        window.State.updateCoins(data.coins);

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
      }, 4100);
    } catch (err) {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.WheelGame = WheelGame;
