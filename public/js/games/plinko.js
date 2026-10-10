// Plinko Game Frontend Logic with Canvas Physics

const PlinkoGame = {
  isDropping: false,
  currentBet: 25,
  currentRisk: 'medium',
  rows: 12,
  pegs: [],
  multipliers: [24, 10, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 10, 24],

  init() {
    this.initBoard();
    this.bindEvents();
    this.draw();
  },

  bindEvents() {
    const dropBtn = document.getElementById('plinkoDropBtn');
    if (dropBtn) dropBtn.addEventListener('click', () => this.drop());

    // Niveaux de risque
    document.querySelectorAll('.risk-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.isDropping) return;
        document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentRisk = e.currentTarget.dataset.risk;

        if (this.currentRisk === 'low') {
          this.multipliers = [8, 4, 2, 1.4, 1.1, 0.8, 0.6, 0.8, 1.1, 1.4, 2, 4, 8];
        } else if (this.currentRisk === 'medium') {
          this.multipliers = [24, 10, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 10, 24];
        } else {
          this.multipliers = [50, 20, 7, 2.5, 0.6, 0.2, 0, 0.2, 0.6, 2.5, 7, 20, 50];
        }
        this.draw();
      });
    });

    document.querySelectorAll('#view-plinko .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    const multBtns = document.querySelectorAll('#view-plinko .btn-mult');
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
    const input = document.getElementById('plinkoBetInput');
    if (input) input.value = this.currentBet;
  },

  initBoard() {
    this.pegs = [];
    const width = 480;
    const height = 480;
    const startY = 40;
    const endY = height - 60;
    const rowSpacing = (endY - startY) / this.rows;

    for (let r = 0; r <= this.rows; r++) {
      const pegsInRow = r + 3;
      const rowWidth = (pegsInRow - 1) * 32;
      const startX = (width - rowWidth) / 2;

      for (let p = 0; p < pegsInRow; p++) {
        this.pegs.push({
          x: startX + (p * 32),
          y: startY + (r * rowSpacing),
          r: 3.5,
          hit: false
        });
      }
    }
  },

  draw(ball = null, activeBucket = -1) {
    const canvas = document.getElementById('plinkoCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 480;
    canvas.height = 480;

    ctx.clearRect(0, 0, 480, 480);

    // Dessin des clous
    this.pegs.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.hit ? '#FDE047' : '#FFFFFF';
      if (p.hit) {
        ctx.shadowColor = '#FDE047';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Dessin des paniers en bas
    const bucketY = 480 - 32;
    const bucketsCount = this.multipliers.length;
    const bucketWidth = 440 / bucketsCount;
    const startBucketX = 20;

    for (let i = 0; i < bucketsCount; i++) {
      const bx = startBucketX + (i * bucketWidth);
      ctx.beginPath();
      ctx.roundRect(bx + 2, bucketY, bucketWidth - 4, 26, 6);

      const isTarget = i === activeBucket;
      const mult = this.multipliers[i];

      if (mult >= 10) ctx.fillStyle = isTarget ? '#EF4444' : 'rgba(239, 68, 68, 0.7)';
      else if (mult >= 2) ctx.fillStyle = isTarget ? '#F59E0B' : 'rgba(245, 158, 11, 0.7)';
      else if (mult >= 1) ctx.fillStyle = isTarget ? '#10B981' : 'rgba(16, 185, 129, 0.7)';
      else ctx.fillStyle = isTarget ? '#3B82F6' : 'rgba(59, 130, 246, 0.6)';

      ctx.fill();
      ctx.strokeStyle = isTarget ? '#FFF' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isTarget ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, bx + bucketWidth / 2, bucketY + 16);
    }

    // Dessin de la bille animée
    if (ball) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFE27A';
      ctx.shadowColor = '#D4AF37';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  },

  async drop() {
    if (this.isDropping) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour jouer au Plinko.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour miser.', 'error');
      return;
    }

    this.isDropping = true;
    const dropBtn = document.getElementById('plinkoDropBtn');
    if (dropBtn) dropBtn.disabled = true;

    const banner = document.getElementById('plinkoResultBanner');
    if (banner) banner.style.display = 'none';

    try {
      const data = await window.API.dropPlinko(this.currentBet, this.currentRisk);

      // Calcul des étapes clés de position le long du chemin
      const startX = 240;
      const startY = 20;
      const rowSpacing = (480 - 60 - 40) / this.rows;

      const keyframes = [{ x: startX, y: startY }];
      let currentX = startX;

      data.path.forEach((step, rowIdx) => {
        const nextY = 40 + (rowIdx * rowSpacing);
        // déviation 16px à gauche (-16) ou droite (+16)
        currentX += (step === 1 ? 16 : -16);
        keyframes.push({ x: currentX, y: nextY + (rowSpacing / 2) });
      });

      // Panier final
      const bucketY = 480 - 24;
      keyframes.push({ x: currentX, y: bucketY });

      // Animation fluide de la bille entre les keyframes
      let currentK = 0;
      let t = 0;
      const speed = 0.08;

      const anim = () => {
        if (currentK >= keyframes.length - 1) {
          // Bille arrivée dans le panier !
          this.draw(null, data.bucketIndex);
          this.isDropping = false;
          if (dropBtn) dropBtn.disabled = false;

          window.State.updateCoins(data.coins);

          if (banner) {
            if (data.multiplier >= 1) {
              banner.textContent = `🎯 Multiplicateur ${data.multiplier}x ! +${data.payout} JETONS !`;
              banner.className = 'result-banner win';
              banner.style.display = 'block';
              if (data.multiplier >= 5) {
                window.sound.playJackpot();
                window.UI.triggerConfetti();
              } else {
                window.sound.playWin();
              }
            } else {
              banner.textContent = `💧 Multiplicateur ${data.multiplier}x (+${data.payout} jetons)`;
              banner.className = 'result-banner lose';
              banner.style.display = 'block';
              window.sound.playLose();
            }
          }
          return;
        }

        const p1 = keyframes[currentK];
        const p2 = keyframes[currentK + 1];

        t += speed;
        const bx = p1.x + (p2.x - p1.x) * t;
        const by = p1.y + (p2.y - p1.y) * t;

        if (t >= 1) {
          t = 0;
          currentK++;
          window.sound.playSpinTick();
        }

        this.draw({ x: bx, y: by });
        requestAnimationFrame(anim);
      };

      requestAnimationFrame(anim);
    } catch (err) {
      this.isDropping = false;
      if (dropBtn) dropBtn.disabled = false;
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.PlinkoGame = PlinkoGame;
