// public/js/games/crash.js
// Marsabet - Jeu de Crash avec animation courbe, fusée et cashout temps réel

const CrashGame = {
    state: 'idle', // 'idle' | 'running' | 'cashed_out' | 'crashed'
    bet: 10,
    currentMultiplier: 1.00,
    targetCrashPoint: 1.00,
    gameId: null,
    startTime: null,
    animationFrameId: null,
    history: [],
    canvas: null,
    ctx: null,
    particles: [],

    init() {
        this.canvas = document.getElementById('crashCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.drawIdleStage();
        }

        this.bindEvents();
        this.loadHistory();
    },

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        if (this.ctx) {
            this.ctx.resetTransform();
            this.ctx.scale(dpr, dpr);
        }
        if (this.state === 'idle') {
            this.drawIdleStage();
        }
    },

    bindEvents() {
        const betInput = document.getElementById('crashBetInput');
        if (betInput) {
            betInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                    this.bet = val;
                    this.updatePreviewPayout();
                }
            });
        }

        document.querySelectorAll('.crash-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const userBalance = (window.User && window.User.balance) || 1000;
                if (action === 'half') this.bet = Math.max(1, Math.floor(this.bet / 2));
                else if (action === 'double') this.bet = Math.min(userBalance, this.bet * 2);
                else if (action === 'min') this.bet = 5;
                else if (action === 'max') this.bet = userBalance;

                if (betInput) betInput.value = this.bet;
                this.updatePreviewPayout();
            });
        });

        const actionBtn = document.getElementById('crashActionBtn');
        if (actionBtn) {
            actionBtn.addEventListener('click', () => {
                if (this.state === 'idle' || this.state === 'crashed' || this.state === 'cashed_out') {
                    this.startGame();
                } else if (this.state === 'running') {
                    this.cashout();
                }
            });
        }
    },

    async loadHistory() {
        try {
            const res = await API.getCrashHistory();
            if (res.success && res.history) {
                this.history = res.history;
                this.renderHistory();
            }
        } catch (e) {
            console.error('Erreur chargement historique crash:', e);
        }
    },

    renderHistory() {
        const bar = document.getElementById('crashHistoryBar');
        if (!bar) return;

        if (!this.history || this.history.length === 0) {
            bar.innerHTML = '<span style="color:#64748b; font-size:0.8rem;">En attente de tours...</span>';
            return;
        }

        bar.innerHTML = this.history.map(point => {
            const val = Number(point);
            let pillClass = 'pill-low';
            if (val >= 10.0) pillClass = 'pill-epic';
            else if (val >= 3.0) pillClass = 'pill-high';
            else if (val >= 1.5) pillClass = 'pill-mid';

            return `<div class="crash-history-pill ${pillClass}">×${val.toFixed(2)}</div>`;
        }).join('');
    },

    updatePreviewPayout() {
        const previewEl = document.getElementById('crashPreviewProfit');
        if (previewEl) {
            const estimated = Math.floor(this.bet * this.currentMultiplier);
            previewEl.textContent = `${estimated.toLocaleString('fr-FR')} 🪙`;
        }
    },

    async startGame() {
        const betInput = document.getElementById('crashBetInput');
        if (betInput) this.bet = parseInt(betInput.value, 10) || this.bet;

        const userBalance = (window.User && window.User.balance) || 0;
        if (this.bet <= 0 || this.bet > userBalance) {
            if (window.showToast) window.showToast('Solde insuffisant pour cette mise.', 'error');
            return;
        }

        const actionBtn = document.getElementById('crashActionBtn');
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<span class="spinner-small"></span> Préparation...';
        }

        try {
            const res = await API.startCrash({ bet: this.bet });
            if (!res.success) {
                if (window.showToast) window.showToast(res.message || 'Impossible de lancer la partie', 'error');
                this.setIdleUI();
                return;
            }

            // Deduct user balance in UI
            if (window.User && res.data.coins !== undefined) {
                window.User.balance = res.data.coins;
                if (window.updateUserUI) window.updateUserUI();
            }

            this.gameId = res.data.gameId;
            this.targetCrashPoint = Number(res.data.crashPoint);
            this.currentMultiplier = 1.00;
            this.state = 'running';
            this.particles = [];
            this.startTime = performance.now();

            // Set button to Cashout
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.className = 'btn-crash-action btn-cashout';
                actionBtn.innerHTML = `ENCAISSER <span class="subtext">+${this.bet} 🪙</span>`;
            }

            const multDisplay = document.getElementById('crashMultiplierDisplay');
            if (multDisplay) {
                multDisplay.className = 'crash-multiplier-big tension-low';
                multDisplay.textContent = '×1.00';
            }

            const statusLabel = document.getElementById('crashStatusLabel');
            if (statusLabel) {
                statusLabel.className = 'crash-status-label';
                statusLabel.textContent = 'FUSÉE EN VOL...';
            }

            // Start animation loop
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            this.loop(performance.now());

        } catch (err) {
            console.error('Erreur startCrash:', err);
            if (window.showToast) window.showToast('Erreur serveur au décollage', 'error');
            this.setIdleUI();
        }
    },

    async cashout() {
        if (this.state !== 'running' || !this.gameId) return;

        const frozenMultiplier = this.currentMultiplier;
        this.state = 'cashed_out';

        const actionBtn = document.getElementById('crashActionBtn');
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.className = 'btn-crash-action btn-bet';
            actionBtn.innerHTML = 'Encaissé !';
        }

        try {
            const res = await API.cashoutCrash({
                gameId: this.gameId,
                multiplier: frozenMultiplier
            });

            if (res.success && res.data.won) {
                if (window.AudioController && window.AudioController.playWin) {
                    window.AudioController.playWin();
                }

                if (window.User && res.data.coins !== undefined) {
                    window.User.balance = res.data.coins;
                    if (window.updateUserUI) window.updateUserUI();
                }

                const statusLabel = document.getElementById('crashStatusLabel');
                if (statusLabel) {
                    statusLabel.className = 'crash-status-label status-cashed';
                    statusLabel.textContent = `ENCAISSÉ : +${res.data.payout} 🪙 (×${res.data.multiplier.toFixed(2)})`;
                }

                if (window.showToast) {
                    window.showToast(`Félicitations ! Vous avez encaissé ${res.data.payout} jetons à ×${res.data.multiplier.toFixed(2)}`, 'success');
                }
            } else {
                // Already crashed edge
                this.handleCrash();
            }
        } catch (err) {
            console.error('Erreur cashout:', err);
        }
    },

    loop(timestamp) {
        if (this.state !== 'running' && this.state !== 'cashed_out') return;

        const elapsedSec = (timestamp - this.startTime) / 1000;
        
        // Formule de progression exponentielle progressive
        // x(t) = 1.00 + 0.08 * t + 0.04 * t^2
        const calculatedMult = 1.00 + (elapsedSec * 0.10) + Math.pow(elapsedSec * 0.22, 2.1);
        this.currentMultiplier = Math.max(1.00, calculatedMult);

        // Update multiplier UI display
        const multDisplay = document.getElementById('crashMultiplierDisplay');
        if (multDisplay) {
            multDisplay.textContent = `×${this.currentMultiplier.toFixed(2)}`;

            // Dynamic tension classes
            if (this.currentMultiplier >= 10.0) multDisplay.className = 'crash-multiplier-big tension-epic';
            else if (this.currentMultiplier >= 4.0) multDisplay.className = 'crash-multiplier-big tension-high';
            else if (this.currentMultiplier >= 2.0) multDisplay.className = 'crash-multiplier-big tension-mid';
            else multDisplay.className = 'crash-multiplier-big tension-low';
        }

        // Update cashout button value
        if (this.state === 'running') {
            const actionBtn = document.getElementById('crashActionBtn');
            if (actionBtn) {
                const livePayout = Math.floor(this.bet * this.currentMultiplier);
                actionBtn.innerHTML = `ENCAISSER <span class="subtext">+${livePayout} 🪙</span>`;
            }
        }

        this.updatePreviewPayout();

        // Check if crash target hit
        if (this.currentMultiplier >= this.targetCrashPoint) {
            this.handleCrash();
            return;
        }

        // Draw Canvas Frame
        this.renderCanvasFrame(elapsedSec);

        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
    },

    async handleCrash() {
        this.state = 'crashed';
        this.currentMultiplier = this.targetCrashPoint;

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        // Play crash sound
        if (window.AudioController && window.AudioController.playCrash) {
            window.AudioController.playCrash();
        }

        const multDisplay = document.getElementById('crashMultiplierDisplay');
        if (multDisplay) {
            multDisplay.className = 'crash-multiplier-big crashed';
            multDisplay.textContent = `×${this.targetCrashPoint.toFixed(2)}`;
        }

        const statusLabel = document.getElementById('crashStatusLabel');
        if (statusLabel) {
            statusLabel.className = 'crash-status-label status-crashed';
            statusLabel.textContent = `CRASHÉ À ×${this.targetCrashPoint.toFixed(2)}`;
        }

        // Draw explosion on canvas
        this.renderExplosion();

        // Tell server round finished if not cashed
        try {
            await API.finishCrash({ gameId: this.gameId });
        } catch (e) {
            // Ignored
        }

        // Add crash point to top history
        this.history.unshift(this.targetCrashPoint);
        if (this.history.length > 15) this.history.pop();
        this.renderHistory();

        // Delay before re-enabling place bet
        setTimeout(() => {
            this.setIdleUI();
        }, 1800);
    },

    setIdleUI() {
        this.state = 'idle';
        const actionBtn = document.getElementById('crashActionBtn');
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.className = 'btn-crash-action btn-bet';
            actionBtn.innerHTML = '🚀 DÉCOLLER';
        }
        const statusLabel = document.getElementById('crashStatusLabel');
        if (statusLabel) {
            statusLabel.className = 'crash-status-label';
            statusLabel.textContent = 'PRÊT AU DÉCOLLAGE';
        }
        this.updatePreviewPayout();
    },

    renderCanvasFrame(elapsedSec) {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        this.ctx.clearRect(0, 0, w, h);

        // Curve origin & current rocket position
        const padX = 40;
        const padY = 40;
        const startX = padX;
        const startY = h - padY;

        // Progress normalized along screen
        // Curves up towards top-right
        const maxTime = 12; // Visual scaling
        const progress = Math.min(1, elapsedSec / maxTime);
        const currentX = startX + (w - padX * 2 - 60) * Math.min(1, Math.pow(progress, 0.85));
        const currentY = startY - (h - padY * 2 - 40) * Math.min(1, Math.pow(progress, 1.8));

        // Draw curved glow trajectory
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo((startX + currentX) / 2, startY, currentX, currentY);

        let strokeColor = '#38bdf8';
        if (this.currentMultiplier >= 10.0) strokeColor = '#ec4899';
        else if (this.currentMultiplier >= 4.0) strokeColor = '#ffd700';
        else if (this.currentMultiplier >= 2.0) strokeColor = '#10b981';

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = strokeColor;
        this.ctx.shadowBlur = 15;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw rocket body / symbol
        this.ctx.save();
        this.ctx.translate(currentX, currentY);

        // Calculate tangent angle for rocket heading
        const angle = Math.atan2(currentY - startY, currentX - startX) * 0.5 - 0.2;
        this.ctx.rotate(angle);

        // Flame effect
        const flameLength = 12 + Math.random() * 8;
        this.ctx.fillStyle = '#ff7b00';
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0);
        this.ctx.lineTo(-15 - flameLength, -4);
        this.ctx.lineTo(-15 - flameLength * 1.3, 0);
        this.ctx.lineTo(-15 - flameLength, 4);
        this.ctx.closePath();
        this.ctx.fill();

        // Inner blue flame
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 0);
        this.ctx.lineTo(-15 - flameLength * 0.6, -2);
        this.ctx.lineTo(-15 - flameLength * 0.8, 0);
        this.ctx.lineTo(-15 - flameLength * 0.6, 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Rocket emoji / icon
        this.ctx.font = '28px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🚀', 0, 0);

        this.ctx.restore();
    },

    renderExplosion() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        let frames = 0;
        const maxFrames = 25;

        // Generate burst particles
        const particles = Array.from({ length: 40 }, () => ({
            x: w * 0.75,
            y: h * 0.35,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            size: Math.random() * 5 + 3,
            color: ['#ef4444', '#f97316', '#ffd700', '#ffffff'][Math.floor(Math.random() * 4)],
            alpha: 1
        }));

        const animExplosion = () => {
            frames++;
            this.ctx.clearRect(0, 0, w, h);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha = Math.max(0, 1 - (frames / maxFrames));

                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = p.alpha;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            });

            this.ctx.globalAlpha = 1;

            if (frames < maxFrames) {
                requestAnimationFrame(animExplosion);
            } else {
                this.drawIdleStage();
            }
        };

        animExplosion();
    },

    drawIdleStage() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        this.ctx.clearRect(0, 0, w, h);

        // Grid lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = 40; x < w; x += 60) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }

        for (let y = 40; y < h; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }

        // Draw idle resting rocket at bottom left
        this.ctx.font = '28px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🚀', 50, h - 50);
    }
};

window.CrashGame = CrashGame;
