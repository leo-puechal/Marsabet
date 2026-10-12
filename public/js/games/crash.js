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

    getUserBalance() {
        if (window.State && window.State.user && typeof window.State.user.coins === 'number') {
            return window.State.user.coins;
        }
        if (window.User && typeof window.User.balance === 'number') {
            return window.User.balance;
        }
        return 0;
    },

    notify(msg, type = 'info') {
        if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast(msg, type);
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[CrashGame] [${type}] ${msg}`);
        }
    },

    onShow() {
        this.resizeCanvas();
        this.drawIdleStage();
        this.loadHistory();
    },

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.parentElement?.clientWidth || 700;
        const height = rect.height || this.canvas.parentElement?.clientHeight || 400;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
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
                const userBalance = this.getUserBalance() || 1000;
                if (action === 'half') this.bet = Math.max(10, Math.floor(this.bet / 2));
                else if (action === 'double') this.bet = Math.min(userBalance, this.bet * 2);
                else if (action === 'min') this.bet = 10;
                else if (action === 'max') this.bet = Math.max(10, userBalance);

                if (betInput) betInput.value = this.bet;
                if (window.sound && typeof window.sound.playChip === 'function') {
                    window.sound.playChip();
                }
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
            const res = await window.API.getCrashHistory();
            const history = res.history || res.data?.history || [];
            if (Array.isArray(history)) {
                this.history = history;
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

        if (!window.State || !window.State.isAuthenticated) {
            this.notify('Connecte-toi pour lancer une partie de Crash.', 'warning');
            if (window.UI && typeof window.UI.openAuthModal === 'function') {
                window.UI.openAuthModal('login');
            }
            return;
        }

        const userBalance = this.getUserBalance();
        if (!Number.isInteger(this.bet) || this.bet < 10) {
            this.notify('Mise invalide (minimum 10 coins).', 'error');
            return;
        }
        if (this.bet > userBalance) {
            this.notify(`Solde insuffisant pour miser ${this.bet} coins (solde actuel : ${userBalance} coins).`, 'error');
            return;
        }

        this.resizeCanvas();

        const actionBtn = document.getElementById('crashActionBtn');
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<span class="spinner-small"></span> Préparation...';
        }

        try {
            const res = await window.API.startCrash({ bet: this.bet });
            const data = res.data || res;

            if (!res.success && res.error) {
                this.notify(res.error || res.message || 'Impossible de lancer la partie', 'error');
                this.setIdleUI();
                return;
            }

            // Déduire la mise du solde dans l'interface et activer la protection d'animation
            const newCoins = data.coins !== undefined ? data.coins : (res.coins !== undefined ? res.coins : userBalance - this.bet);
            if (window.State && typeof window.State.deductBet === 'function') {
                window.State.deductBet(this.bet);
            } else if (window.State && typeof window.State.updateCoins === 'function') {
                window.State.updateCoins(newCoins);
            }
            if (window.User) {
                window.User.balance = newCoins;
            }

            this.gameId = data.gameId || res.gameId;
            this.targetCrashPoint = Number(data.crashPoint || res.crashPoint);
            this.currentMultiplier = 1.00;
            this.state = 'running';
            this.particles = [];
            this.startTime = performance.now();

            if (window.sound && typeof window.sound.playSpinTick === 'function') {
                window.sound.playSpinTick();
            }

            // Mettre à jour le bouton en "ENCAISSER"
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
            this.notify('Erreur serveur au décollage : ' + (err.message || 'problème de connexion'), 'error');
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
            const res = await window.API.cashoutCrash({
                gameId: this.gameId,
                multiplier: frozenMultiplier
            });
            const data = res.data || res;

            if (data.won) {
                if (window.sound && typeof window.sound.playWin === 'function') {
                    window.sound.playWin();
                } else if (window.AudioController && window.AudioController.playWin) {
                    window.AudioController.playWin();
                }
                if (window.UI && typeof window.UI.launchConfetti === 'function') {
                    window.UI.launchConfetti();
                } else if (window.UI && typeof window.UI.triggerConfetti === 'function') {
                    window.UI.triggerConfetti();
                }

                if (window.State && data.coins !== undefined) {
                    if (typeof window.State.setGameAnimating === 'function') {
                        window.State.setGameAnimating(false, data.coins);
                    } else {
                        window.State.updateCoins(data.coins);
                    }
                }
                if (window.User && data.coins !== undefined) {
                    window.User.balance = data.coins;
                }

                const statusLabel = document.getElementById('crashStatusLabel');
                if (statusLabel) {
                    statusLabel.className = 'crash-status-label status-cashed';
                    statusLabel.textContent = `ENCAISSÉ : +${data.payout} 🪙 (×${Number(data.multiplier).toFixed(2)})`;
                }

                this.notify(`🎉 Félicitations ! Tu as encaissé ${data.payout} jetons à ×${Number(data.multiplier).toFixed(2)} !`, 'success');
            } else {
                // Déjà crashé côté serveur
                this.handleCrash();
            }
        } catch (err) {
            console.error('Erreur cashout:', err);
            this.notify(err.message || 'Erreur lors de l’encaissement', 'error');
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
        if (window.sound && typeof window.sound.playLose === 'function') {
            window.sound.playLose();
        } else if (window.AudioController && window.AudioController.playCrash) {
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

        if (window.State && typeof window.State.setGameAnimating === 'function') {
            window.State.setGameAnimating(false);
        }

        // Tell server round finished if not cashed
        try {
            await window.API.finishCrash({ gameId: this.gameId });
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
