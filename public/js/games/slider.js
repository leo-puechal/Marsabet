// public/js/games/slider.js
// Marsabet - Jeu Slider Over/Under Indépendant

const SliderGame = {
    bet: 10,
    target: 50.0,
    mode: 'over', // 'over' or 'under'
    isRolling: false,
    history: [],

    init() {
        this.bindEvents();
        this.updateCalculations();
        this.renderHistory();
    },

    bindEvents() {
        const sliderInput = document.getElementById('sliderRange');
        if (sliderInput) {
            sliderInput.addEventListener('input', (e) => {
                this.target = parseFloat(e.target.value);
                this.updateCalculations();
            });
        }

        const modeOverBtn = document.getElementById('sliderModeOver');
        const modeUnderBtn = document.getElementById('sliderModeUnder');
        if (modeOverBtn && modeUnderBtn) {
            modeOverBtn.addEventListener('click', () => {
                this.mode = 'over';
                modeOverBtn.classList.add('active');
                modeUnderBtn.classList.remove('active');
                this.updateCalculations();
            });

            modeUnderBtn.addEventListener('click', () => {
                this.mode = 'under';
                modeUnderBtn.classList.add('active');
                modeOverBtn.classList.remove('active');
                this.updateCalculations();
            });
        }

        // Bet modifiers
        const betInput = document.getElementById('sliderBetInput');
        if (betInput) {
            betInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) this.bet = val;
            });
        }

        document.querySelectorAll('.slider-bet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const userBalance = (window.State?.user?.coins !== undefined) 
                    ? window.State.user.coins 
                    : ((window.User && window.User.balance) || 1000);
                if (action === 'half') this.bet = Math.max(10, Math.floor(this.bet / 2));
                else if (action === 'double') this.bet = Math.min(userBalance, this.bet * 2);
                else if (action === 'min') this.bet = 10;
                else if (action === 'max') this.bet = userBalance;

                if (betInput) betInput.value = this.bet;
                if (window.sound && typeof window.sound.playChip === 'function') {
                    window.sound.playChip();
                }
            });
        });

        // Quick target shortcuts
        document.querySelectorAll('.target-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseFloat(btn.dataset.target);
                if (!isNaN(val)) {
                    this.target = val;
                    if (sliderInput) sliderInput.value = val;
                    this.updateCalculations();
                }
            });
        });

        const playBtn = document.getElementById('sliderPlayBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.play());
        }
    },

    updateCalculations() {
        // Formule alignée sur le moteur serveur (97% RTP)
        let winChance = 0;
        if (this.mode === 'under') {
            winChance = Math.max(1, Math.min(98, this.target));
        } else {
            winChance = Math.max(1, Math.min(98, 100 - this.target));
        }

        const multiplier = Math.max(1.01, (97 / winChance));

        const targetDisplay = document.getElementById('sliderTargetDisplay');
        const chanceDisplay = document.getElementById('sliderChanceDisplay');
        const multDisplay = document.getElementById('sliderMultiplierDisplay');
        const profitDisplay = document.getElementById('sliderProfitDisplay');
        const winZoneEl = document.getElementById('sliderWinZone');
        const thumbIndicator = document.getElementById('sliderTargetIndicator');

        if (targetDisplay) targetDisplay.textContent = this.target.toFixed(1);
        if (chanceDisplay) chanceDisplay.textContent = winChance.toFixed(1) + '%';
        if (multDisplay) multDisplay.textContent = '×' + multiplier.toFixed(2);
        if (profitDisplay) {
            const potentialProfit = Math.round(this.bet * multiplier) - this.bet;
            profitDisplay.textContent = '+' + potentialProfit.toLocaleString('fr-FR') + ' 🪙';
        }

        // Win zone visual positioning
        if (winZoneEl) {
            if (this.mode === 'under') {
                winZoneEl.style.left = '0%';
                winZoneEl.style.width = `${this.target}%`;
            } else {
                winZoneEl.style.left = `${this.target}%`;
                winZoneEl.style.width = `${100 - this.target}%`;
            }
        }

        if (thumbIndicator) {
            thumbIndicator.style.left = `${this.target}%`;
            thumbIndicator.textContent = this.target.toFixed(1);
        }
    },

    async play() {
        if (this.isRolling) return;

        const betInput = document.getElementById('sliderBetInput');
        if (betInput) this.bet = parseInt(betInput.value, 10) || this.bet;

        const userBalance = (window.State?.user?.coins !== undefined) 
            ? window.State.user.coins 
            : ((window.User && window.User.balance) || 0);

        const toastFn = (window.UI && window.UI.showToast) || window.showToast;
        if (!Number.isInteger(this.bet) || this.bet < 10) {
            if (toastFn) toastFn('Mise invalide (minimum 10 coins).', 'error');
            return;
        }

        if (this.bet > userBalance) {
            if (toastFn) toastFn('Solde insuffisant pour cette mise.', 'error');
            return;
        }

        if (window.State && this.bet > 0) {
            window.State.deductBet(this.bet);
        }

        this.isRolling = true;
        const playBtn = document.getElementById('sliderPlayBtn');
        if (playBtn) {
            playBtn.disabled = true;
            playBtn.innerHTML = '<span class="spinner-small"></span> Tirage en cours...';
        }

        try {
            if (window.sound && typeof window.sound.playSpinTick === 'function') {
                window.sound.playSpinTick();
            } else if (window.AudioController && window.AudioController.playSliderTick) {
                window.AudioController.playSliderTick();
            }

            const res = await window.API.playSlider({
                bet: this.bet,
                target: this.target,
                mode: this.mode
            });

            if (!res.success && res.error) {
                const toastFn = (window.UI && window.UI.showToast) || window.showToast;
                if (toastFn) toastFn(res.error || res.message || 'Erreur lors du tirage', 'error');
                if (window.State) window.State.setGameAnimating(false);
                this.resetState();
                return;
            }

            const gameData = res.data || res;

            // Animate puck to result
            await this.animateResult(gameData);

            // Update user balance at end of puck animation
            const newBalance = gameData.balance !== undefined ? gameData.balance : gameData.coins;
            if (newBalance !== undefined) {
                if (window.State && typeof window.State.setGameAnimating === 'function') {
                    window.State.setGameAnimating(false, newBalance);
                } else if (window.State && typeof window.State.updateCoins === 'function') {
                    window.State.updateCoins(newBalance);
                }
                if (window.User) {
                    window.User.balance = newBalance;
                }
            }

            // Record to history
            this.addToHistory(gameData);

            if (gameData.isWin) {
                if (window.sound && typeof window.sound.playWin === 'function') {
                    window.sound.playWin();
                } else if (window.AudioController && window.AudioController.playWin) {
                    window.AudioController.playWin();
                }
                const toastFn = (window.UI && window.UI.showToast) || window.showToast;
                if (toastFn) {
                    toastFn(`Victoire ! Tu as gagné ${gameData.payout} coins (x${gameData.multiplier})`, 'success');
                }
            } else {
                if (window.sound && typeof window.sound.playLose === 'function') {
                    window.sound.playLose();
                } else if (window.AudioController && window.AudioController.playLoss) {
                    window.AudioController.playLoss();
                }
            }

        } catch (err) {
            console.error('Slider play error:', err);
            const toastFn = (window.UI && window.UI.showToast) || window.showToast;
            if (toastFn) toastFn('Erreur serveur lors de la partie : ' + err.message, 'error');
        } finally {
            this.resetState();
        }
    },

    animateResult(data) {
        return new Promise(resolve => {
            const puck = document.getElementById('sliderPuck');
            const resultBadge = document.getElementById('sliderResultBadge');
            if (!puck) {
                resolve();
                return;
            }

            puck.classList.add('rolling');
            puck.style.display = 'flex';

            let step = 0;
            const totalSteps = 24;
            const finalRoll = data.roll;

            const interval = setInterval(() => {
                step++;
                // Slight jitter animation towards the final roll
                const progress = step / totalSteps;
                const randomVal = Math.random() * 100;
                const currentPos = (1 - progress) * randomVal + progress * finalRoll;

                puck.style.left = `${Math.max(0, Math.min(100, currentPos))}%`;
                puck.textContent = currentPos.toFixed(1);

                if (window.AudioController && window.AudioController.playSliderTick && step % 4 === 0) {
                    window.AudioController.playSliderTick();
                }

                if (step >= totalSteps) {
                    clearInterval(interval);
                    puck.classList.remove('rolling');
                    puck.style.left = `${finalRoll}%`;
                    puck.textContent = finalRoll.toFixed(2);

                    if (data.isWin) {
                        puck.classList.add('win');
                        puck.classList.remove('loss');
                    } else {
                        puck.classList.add('loss');
                        puck.classList.remove('win');
                    }

                    if (resultBadge) {
                        resultBadge.className = `slider-result-badge ${data.isWin ? 'badge-win' : 'badge-loss'}`;
                        resultBadge.innerHTML = `Résultat : <strong>${finalRoll.toFixed(2)}</strong> ${data.isWin ? '✓ GAGNÉ' : '✗ PERDU'}`;
                        resultBadge.style.display = 'inline-flex';
                    }

                    setTimeout(resolve, 600);
                }
            }, 35);
        });
    },

    addToHistory(data) {
        this.history.unshift(data);
        if (this.history.length > 12) this.history.pop();
        this.renderHistory();
    },

    renderHistory() {
        const container = document.getElementById('sliderHistoryTrack');
        if (!container) return;

        if (this.history.length === 0) {
            container.innerHTML = '<span class="history-empty">Aucun tirage récent</span>';
            return;
        }

        container.innerHTML = this.history.map(item => `
            <div class="slider-hist-item ${item.isWin ? 'hist-win' : 'hist-loss'}" title="${item.mode.toUpperCase()} ${item.target} • Gain: ${item.payout}">
                <span class="hist-roll">${item.roll.toFixed(1)}</span>
                <span class="hist-mult">×${item.multiplier.toFixed(2)}</span>
            </div>
        `).join('');
    },

    resetState() {
        this.isRolling = false;
        const playBtn = document.getElementById('sliderPlayBtn');
        if (playBtn) {
            playBtn.disabled = false;
            playBtn.innerHTML = '🎯 Lancer le curseur';
        }
    }
};

window.SliderGame = SliderGame;
