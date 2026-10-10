// Plinko Game Frontend Logic with Multi-Ball Canvas Physics

const PlinkoGame = {
  isDropping: false,
  currentBet: 25,
  ballCount: 1,
  currentRisk: 'medium',
  rows: 12,
  pegs: [],
  multipliers: [24, 10, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 10, 24],

  init() {
    this.initBoard();
    this.bindEvents();
    this.updateCostDisplay();
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

    // Puces de mise
    document.querySelectorAll('#view-plinko .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    // Multiplicateurs de mise (1/2, 2x, MAX)
    const multBtns = document.querySelectorAll('#view-plinko .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(10, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State.user) {
          const maxAffordableUnit = Math.max(10, Math.floor(window.State.user.coins / this.ballCount));
          this.setBet(maxAffordableUnit);
        }
        window.sound.playChip();
      });
    });

    // Écoute de l'input de mise directe
    const betInput = document.getElementById('plinkoBetInput');
    if (betInput) {
      betInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 10;
        this.currentBet = Math.max(10, val);
        this.updateCostDisplay();
      });
    }

    // Sélecteur de billes (1 à 10)
    document.querySelectorAll('.ball-count-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.isDropping) return;
        const count = parseInt(e.currentTarget.dataset.count) || 1;
        this.setBallCount(count);
        window.sound.playChip();
      });
    });
  },

  setBet(val) {
    this.currentBet = Math.max(10, val);
    const input = document.getElementById('plinkoBetInput');
    if (input) input.value = this.currentBet;
    this.updateCostDisplay();
  },

  setBallCount(count) {
    this.ballCount = Math.max(1, Math.min(10, count));
    document.querySelectorAll('.ball-count-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.count) === this.ballCount);
    });
    this.updateCostDisplay();
  },

  updateCostDisplay() {
    const totalCost = this.currentBet * this.ballCount;
    const unitLabel = document.getElementById('plinkoUnitCostLabel');
    const countLabel = document.getElementById('plinkoCountLabel');
    const totalLabel = document.getElementById('plinkoTotalCostLabel');
    const dropBtn = document.getElementById('plinkoDropBtn');

    if (unitLabel) unitLabel.textContent = `${this.currentBet.toLocaleString()} coins`;
    if (countLabel) countLabel.textContent = `${this.ballCount} ${this.ballCount > 1 ? 'billes' : 'bille'}`;
    if (totalLabel) totalLabel.textContent = `${totalCost.toLocaleString()} coins`;

    if (dropBtn) {
      dropBtn.textContent = `💧 LÂCHER ${this.ballCount} ${this.ballCount > 1 ? 'BILLES' : 'BILLE'} (${totalCost.toLocaleString()} coins)`;
    }
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
          hit: false,
          hitIntensity: 0
        });
      }
    }
  },

  draw(balls = [], activeBuckets = new Set()) {
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

      if (p.hitIntensity > 0) {
        ctx.fillStyle = '#FDE047';
        ctx.shadowColor = '#FDE047';
        ctx.shadowBlur = 8 * p.hitIntensity;
        p.hitIntensity = Math.max(0, p.hitIntensity - 0.05);
      } else {
        ctx.fillStyle = '#FFFFFF';
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

      const isTarget = activeBuckets.has(i);
      const mult = this.multipliers[i];

      if (mult >= 10) ctx.fillStyle = isTarget ? '#EF4444' : 'rgba(239, 68, 68, 0.7)';
      else if (mult >= 2) ctx.fillStyle = isTarget ? '#F59E0B' : 'rgba(245, 158, 11, 0.7)';
      else if (mult >= 1) ctx.fillStyle = isTarget ? '#10B981' : 'rgba(16, 185, 129, 0.7)';
      else ctx.fillStyle = isTarget ? '#3B82F6' : 'rgba(59, 130, 246, 0.6)';

      ctx.fill();
      ctx.strokeStyle = isTarget ? '#FFF' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isTarget ? 2.5 : 1;
      ctx.stroke();

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, bx + bucketWidth / 2, bucketY + 16);
    }

    // Dessin des billes actives
    balls.forEach(b => {
      if (!b.active) return;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);

      // Dégradé ou couleur selon l'index de la bille
      ctx.fillStyle = b.color || '#FFE27A';
      ctx.shadowColor = b.glow || '#D4AF37';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Numéro de bille au centre
      if (b.index) {
        ctx.fillStyle = '#0A1F44';
        ctx.font = 'bold 8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.index), b.x, b.y);
      }
    });
  },

  async drop() {
    if (this.isDropping) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour jouer au Plinko.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const totalCost = this.currentBet * this.ballCount;
    if (window.State.user.coins < totalCost) {
      window.UI.showToast(`Solde insuffisant pour miser ${totalCost.toLocaleString()} coins.`, 'error');
      return;
    }

    this.isDropping = true;
    const dropBtn = document.getElementById('plinkoDropBtn');
    if (dropBtn) dropBtn.disabled = true;

    const banner = document.getElementById('plinkoResultBanner');
    if (banner) banner.style.display = 'none';

    const breakdownBox = document.getElementById('plinkoBreakdownBox');
    if (breakdownBox) breakdownBox.style.display = 'none';

    try {
      const data = await window.API.dropPlinko(this.currentBet, this.currentRisk, this.ballCount);

      const rowSpacing = (480 - 60 - 40) / this.rows;
      const bucketY = 480 - 24;
      const palette = ['#FFE27A', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#FBBF24', '#38BDF8', '#4ADE80', '#FB7185', '#E879F9'];

      // Génération des trajectoires physiques distinctes pour chaque bille
      const ballsData = data.balls || [{
        ballIndex: 1,
        path: data.path,
        bucketIndex: data.bucketIndex,
        multiplier: data.multiplier,
        payout: data.payout
      }];

      const ballSims = ballsData.map((b, idx) => {
        // Léger décalage horizontal au départ pour chaque bille (physique variée)
        const startX = 240 + ((idx % 2 === 0 ? 1 : -1) * (idx * 1.5)) + ((Math.random() - 0.5) * 4);
        const startY = 15;
        const keyframes = [{ x: startX, y: startY }];
        let currentX = startX;

        b.path.forEach((step, rowIdx) => {
          const pegRowY = 40 + (rowIdx * rowSpacing);
          // Déviation à gauche (-16) ou droite (+16) avec légère fluctuation naturelle
          const jitter = (Math.random() - 0.5) * 2;
          currentX += (step === 1 ? 16 : -16) + jitter;
          keyframes.push({ x: currentX, y: pegRowY + (rowSpacing / 2) });
        });

        // Point d'atterrissage dans le panier
        keyframes.push({ x: currentX, y: bucketY });

        return {
          index: b.ballIndex || idx + 1,
          keyframes,
          currentK: 0,
          t: 0,
          speed: 0.075 + (Math.random() * 0.015), // Vitesses physiques légèrement différentes
          delayMs: idx * 130, // Décalage de départ échelonné (quelques ms entre chaque bille)
          hasStarted: false,
          finished: false,
          active: false,
          x: startX,
          y: startY,
          bucketIndex: b.bucketIndex,
          multiplier: b.multiplier,
          payout: b.payout,
          color: palette[idx % palette.length],
          glow: palette[idx % palette.length]
        };
      });

      const activeBuckets = new Set();
      const startTime = performance.now();
      let lastTickTime = 0;

      const anim = (now) => {
        const elapsed = now - startTime;
        let allFinished = true;

        ballSims.forEach(sim => {
          if (sim.finished) return;

          if (!sim.hasStarted) {
            if (elapsed >= sim.delayMs) {
              sim.hasStarted = true;
              sim.active = true;
            } else {
              allFinished = false;
              return;
            }
          }

          allFinished = false;

          if (sim.currentK >= sim.keyframes.length - 1) {
            sim.finished = true;
            sim.active = false;
            activeBuckets.add(sim.bucketIndex);
            return;
          }

          const p1 = sim.keyframes[sim.currentK];
          const p2 = sim.keyframes[sim.currentK + 1];

          sim.t += sim.speed;
          sim.x = p1.x + (p2.x - p1.x) * sim.t;
          sim.y = p1.y + (p2.y - p1.y) * sim.t;

          // Détecter si la bille frappe un clou
          this.pegs.forEach(p => {
            const dx = sim.x - p.x;
            const dy = sim.y - p.y;
            if (dx * dx + dy * dy < 80) {
              p.hit = true;
              p.hitIntensity = 1;
            }
          });

          if (sim.t >= 1) {
            sim.t = 0;
            sim.currentK++;

            if (now - lastTickTime > 65) {
              window.sound.playSpinTick();
              lastTickTime = now;
            }
          }
        });

        this.draw(ballSims, activeBuckets);

        if (!allFinished) {
          requestAnimationFrame(anim);
        } else {
          // Toutes les billes ont atterri !
          this.draw([], activeBuckets);
          this.isDropping = false;
          if (dropBtn) dropBtn.disabled = false;

          // Mise à jour du solde utilisateur
          window.State.updateCoins(data.coins);

          // Affichage du résultat global
          const totalPayout = data.totalPayout !== undefined ? data.totalPayout : data.payout;
          const totalBet = data.totalBet || totalCost;
          const netGain = data.netGain !== undefined ? data.netGain : (totalPayout - totalBet);

          if (banner) {
            const countText = ballSims.length > 1 ? `${ballSims.length} billes` : '1 bille';
            if (netGain >= 0) {
              banner.textContent = `🎯 ${countText} : +${totalPayout.toLocaleString()} coins (Gain net : +${netGain.toLocaleString()}) !`;
              banner.className = 'result-banner win';
              banner.style.display = 'block';

              if (totalPayout >= totalBet * 3) {
                window.sound.playJackpot();
                window.UI.triggerConfetti();
              } else {
                window.sound.playWin();
              }
            } else {
              banner.textContent = `💧 ${countText} : +${totalPayout.toLocaleString()} coins (${netGain.toLocaleString()} net)`;
              banner.className = 'result-banner lose';
              banner.style.display = 'block';
              window.sound.playLose();
            }
          }

          // Affichage du détail par bille
          if (breakdownBox) {
            const ballList = document.getElementById('plinkoBallList');
            const summaryBadge = document.getElementById('plinkoSummaryBadge');

            if (summaryBadge) {
              summaryBadge.textContent = `${totalPayout.toLocaleString()} coins gagnés`;
              summaryBadge.className = `breakdown-badge ${netGain >= 0 ? 'win' : 'lose'}`;
            }

            if (ballList) {
              ballList.innerHTML = ballSims.map(sim => {
                const statusClass = sim.multiplier > 1 ? 'win' : (sim.multiplier === 1 ? 'neutral' : 'lose');
                return `
                  <div class="plinko-ball-pill ${statusClass}">
                    <div class="pill-top">
                      <span>Bille #${sim.index}</span>
                      <span>${sim.multiplier}x</span>
                    </div>
                    <div class="pill-payout">
                      ${sim.payout > 0 ? `+${sim.payout.toLocaleString()}` : '0'} coins
                    </div>
                  </div>
                `;
              }).join('');
            }

            breakdownBox.style.display = 'block';
          }
        }
      };

      requestAnimationFrame(anim);
    } catch (err) {
      this.isDropping = false;
      if (dropBtn) dropBtn.disabled = false;
      window.UI.showToast(err.message || 'Erreur lors du lancer Plinko', 'error');
    }
  }
};

window.PlinkoGame = PlinkoGame;
