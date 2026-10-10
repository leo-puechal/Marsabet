// Free Daily Wheel Frontend Logic — Marsabet

const FreeWheelGame = {
  isSpinning: false,
  currentRotation: 0,
  countdownInterval: null,
  status: null,

  segments: [
    { index: 0, coins: 50, label: '50 🪙', color: '#1E3A8A' },
    { index: 1, coins: 150, label: '150 🪙', color: '#0D9488' },
    { index: 2, coins: 100, label: '100 🪙', color: '#3B82F6' },
    { index: 3, coins: 350, label: '350 🪙', color: '#8B5CF6' },
    { index: 4, coins: 200, label: '200 🪙', color: '#10B981' },
    { index: 5, coins: 500, label: '⭐ 500 🪙', color: '#F59E0B' },
    { index: 6, coins: 75, label: '75 🪙', color: '#1E3A8A' },
    { index: 7, coins: 250, label: '250 🪙', color: '#06B6D4' },
    { index: 8, coins: 125, label: '125 🪙', color: '#3B82F6' },
    { index: 9, coins: 1000, label: '👑 1 000 🪙', color: '#D4AF37' },
    { index: 10, coins: 300, label: '300 🪙', color: '#8B5CF6' },
    { index: 11, coins: 750, label: '🔥 750 🪙', color: '#EF4444' }
  ],

  init() {
    this.drawWheel();
    this.bindEvents();
    if (window.State.isAuthenticated) {
      this.fetchStatus();
    }
  },

  bindEvents() {
    const spinBtn = document.getElementById('freeWheelSpinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spin());
    }

    // Bouton retour lobby
    const backBtn = document.querySelector('#view-free-wheel .btn-back-lobby');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.Router) {
          window.Router.navigate('/lobby');
        } else if (window.UI) {
          window.UI.switchView('lobby');
        }
      });
    }
  },

  formatTime(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  async fetchStatus() {
    if (!window.State.isAuthenticated) return;
    try {
      const data = await window.API.getFreeWheelStatus();
      this.status = data;
      this.updateStatusUI(data);
    } catch (err) {
      console.error('Erreur chargement statut roue gratuite:', err);
    }
  },

  updateStatusUI(data) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const spinBtn = document.getElementById('freeWheelSpinBtn');
    const countdownEls = document.querySelectorAll('.free-wheel-countdown-text');
    const streakEl = document.getElementById('freeWheelStreakDisplay');
    const streakBonusEl = document.getElementById('freeWheelStreakBonusDisplay');
    const lobbyBadge = document.getElementById('lobbyFreeWheelBadge');
    const lobbyCountdown = document.getElementById('lobbyFreeWheelCountdown');
    const gamesCountdown = document.getElementById('gamesFreeWheelCountdown');

    const streak = data.streak || 0;
    const streakBonusPercent = Math.min(Math.max(streak - 1, 0) * 10, 70);

    if (streakEl) streakEl.textContent = `${streak} jour${streak > 1 ? 's' : ''}`;
    if (streakBonusEl) streakBonusEl.textContent = `+${streakBonusPercent}%`;

    let remaining = data.remainingMs || 0;

    const renderTick = () => {
      if (remaining <= 0 || data.canSpin) {
        countdownEls.forEach(el => {
          el.textContent = 'Disponible !';
          el.classList.add('ready');
        });
        if (lobbyCountdown) lobbyCountdown.textContent = '🎁 Prêt à tourner !';
        if (gamesCountdown) gamesCountdown.textContent = '🎁 Prêt à tourner !';
        if (lobbyBadge) {
          lobbyBadge.textContent = 'DISPONIBLE';
          lobbyBadge.style.background = 'rgba(16, 185, 129, 0.3)';
        }
        if (spinBtn && !this.isSpinning) {
          spinBtn.disabled = false;
          spinBtn.innerHTML = '🎁 Lancer mon Spin Quotidien Gratuit !';
        }
        if (this.countdownInterval) clearInterval(this.countdownInterval);
      } else {
        const timeStr = this.formatTime(remaining);
        countdownEls.forEach(el => {
          el.textContent = timeStr;
          el.classList.remove('ready');
        });
        if (lobbyCountdown) lobbyCountdown.textContent = `Prochain spin dans ${timeStr}`;
        if (gamesCountdown) gamesCountdown.textContent = `Prochain spin dans ${timeStr}`;
        if (lobbyBadge) {
          lobbyBadge.textContent = 'EN ATTENTE';
          lobbyBadge.style.background = 'rgba(100, 116, 139, 0.2)';
        }
        if (spinBtn && !this.isSpinning) {
          spinBtn.disabled = true;
          spinBtn.innerHTML = `⏳ Prochain spin dans ${timeStr}`;
        }
      }
    };

    renderTick();

    if (!data.canSpin && remaining > 0) {
      this.countdownInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
          data.canSpin = true;
          renderTick();
        } else {
          renderTick();
        }
      }, 1000);
    }
  },

  drawWheel() {
    const canvas = document.getElementById('freeWheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = size / 2 - 10;

    const totalSegs = this.segments.length;
    const arc = (Math.PI * 2) / totalSegs;

    ctx.clearRect(0, 0, size, size);

    // Bague extérieure émeraude & dorée
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
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

      // Texte du gain
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, radius - 16, 6);
      ctx.restore();
    }

    // Rivets décoratifs
    for (let i = 0; i < totalSegs; i++) {
      const angle = i * arc;
      const x = center + (radius + 2) * Math.cos(angle);
      const y = center + (radius + 2) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFE27A';
      ctx.fill();
    }
  },

  async spin() {
    if (this.isSpinning) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour faire tourner la roue quotidienne gratuite.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const banner = document.getElementById('freeWheelResultBanner');
    if (banner) banner.style.display = 'none';

    const spinBtn = document.getElementById('freeWheelSpinBtn');
    if (spinBtn) spinBtn.disabled = true;

    try {
      const data = await window.API.spinFreeWheel();
      this.isSpinning = true;

      // Calcul de la rotation
      // Pointer au sommet (270 deg / -90 deg)
      const canvas = document.getElementById('freeWheelCanvas');
      const segmentAngle = 360 / this.segments.length; // 30 deg
      // Position angulaire du centre du segment gagnant
      const winningCenterAngle = (data.segmentIndex * segmentAngle) + (segmentAngle / 2);

      // Le pointeur est en haut (270°). On veut que le segment s'arrête en haut :
      const targetDegree = (360 - winningCenterAngle + 270) % 360;
      const fullRotations = 6 * 360; // 6 tours complets
      const currentMod = this.currentRotation % 360;
      const additionalRotation = (targetDegree - currentMod + 360) % 360;
      const finalRotation = this.currentRotation + fullRotations + additionalRotation;

      this.currentRotation = finalRotation;

      if (canvas) {
        canvas.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.8, 0.33, 1)';
        canvas.style.transform = `rotate(${finalRotation}deg)`;
      }

      // Son de tic-tac
      let ticks = 0;
      const tickInterval = setInterval(() => {
        ticks++;
        if (window.sound) window.sound.playWheelTick();
        if (ticks > 25) clearInterval(tickInterval);
      }, 140);

      setTimeout(() => {
        this.isSpinning = false;
        clearInterval(tickInterval);

        // Mise à jour des coins et de l'état
        window.State.updateCoins(data.coins);

        // Affichage du résultat
        if (banner) {
          let bonusText = '';
          if (data.streakBonusPercent > 0) {
            bonusText += ` • Bonus Série J+${data.streak} (+${data.streakBonusPercent}%)`;
          }
          if (data.vipMultiplier > 1) {
            bonusText += ` • Bonus VIP ${data.vipInfo?.currentTier?.name || ''} (x${data.vipMultiplier})`;
          }

          banner.innerHTML = `
            <div style="font-size:1.4rem; font-weight:800; color:var(--gold-light);">
              🎁 FÉLICITATIONS ! Tu as gagné ${data.finalCoins.toLocaleString()} 🪙 !
            </div>
            <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.3rem;">
              Gain de base : ${data.baseCoins} 🪙 ${bonusText}
            </div>
          `;
          banner.className = 'result-banner win';
          banner.style.display = 'block';
        }

        if (window.sound) window.sound.playJackpot();
        if (window.UI) {
          window.UI.triggerConfetti();
          window.UI.showToast(`🎁 +${data.finalCoins} coins ajoutés à ton solde virtuel !`, 'success');
        }

        // Relancer le compte à rebours de 24h
        this.fetchStatus();
      }, 4600);

    } catch (err) {
      this.isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.FreeWheelGame = FreeWheelGame;
