// Dice Game Frontend Logic — Craps Cosmique Marsabet

const DiceGame = {
  isRolling: false,
  currentBet: 25,
  selectedCrapsBet: 'seven',
  diceIcons: ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const rollBtn = document.getElementById('diceRollBtn');
    if (rollBtn) rollBtn.addEventListener('click', () => this.roll());

    // Choix des paris Craps
    document.querySelectorAll('.dice-bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dice-bet-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedCrapsBet = e.currentTarget.dataset.type;
        if (window.sound) window.sound.playChip();
      });
    });

    // Jetons de mise
    document.querySelectorAll('#view-dice .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        if (window.sound) window.sound.playChip();
      });
    });

    const multBtns = document.querySelectorAll('#view-dice .btn-mult');
    multBtns.forEach(b => {
      b.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'half') this.setBet(Math.max(1, Math.floor(this.currentBet / 2)));
        if (action === 'double') this.setBet(this.currentBet * 2);
        if (action === 'max' && window.State && window.State.user) this.setBet(window.State.user.coins);
        if (window.sound) window.sound.playChip();
      });
    });

    const input = document.getElementById('diceBetInput');
    if (input) {
      input.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.currentBet = val;
      });
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setBet(isNaN(val) || val < 10 ? 10 : val);
      });
    }
  },

  setBet(val) {
    this.currentBet = Math.max(10, val);
    const input = document.getElementById('diceBetInput');
    if (input) input.value = this.currentBet;
  },

  async roll() {
    if (this.isRolling) return;

    if (!window.State || !window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour lancer les dés.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    const input = document.getElementById('diceBetInput');
    if (input) {
      const val = parseInt(input.value, 10);
      if (!isNaN(val)) this.currentBet = val;
    }

    if (!Number.isInteger(this.currentBet) || this.currentBet < 10) {
      window.UI.showToast('Mise invalide (minimum 10 coins).', 'error');
      return;
    }

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour cette mise.', 'error');
      return;
    }

    if (window.State && this.currentBet > 0) {
      window.State.deductBet(this.currentBet);
    }

    this.isRolling = true;
    const rollBtn = document.getElementById('diceRollBtn');
    if (rollBtn) rollBtn.disabled = true;

    const banner = document.getElementById('diceResultBanner');
    if (banner) banner.style.display = 'none';

    const die1 = document.getElementById('die1');
    const die2 = document.getElementById('die2');
    if (die1) die1.classList.add('rolling');
    if (die2) die2.classList.add('rolling');

    try {
      const data = await window.API.rollDice(this.currentBet, 'classic', { betType: this.selectedCrapsBet });

      // Animation de roulement 650ms
      await new Promise(r => setTimeout(r, 650));

      if (die1) {
        die1.classList.remove('rolling');
        die1.textContent = this.diceIcons[data.die1 || 1];
      }
      if (die2) {
        die2.classList.remove('rolling');
        die2.textContent = this.diceIcons[data.die2 || 6];
      }

      // Mettre à jour le solde uniquement après l'arrêt des dés
      if (window.State && data.coins !== undefined) {
        window.State.setGameAnimating(false, data.coins);
      }

      if (banner) {
        if (data.won) {
          banner.textContent = `🎲 GAGNÉ ! Total ${data.sum} • +${data.payout} JETONS (x${data.multiplier})`;
          banner.className = 'result-banner win';
          banner.style.display = 'block';
          if (window.sound) window.sound.playWin();
          if (window.UI) window.UI.triggerConfetti();
        } else {
          banner.textContent = `❌ PERDU ! Total ${data.sum} (Dés : ${data.die1} + ${data.die2})`;
          banner.className = 'result-banner lose';
          banner.style.display = 'block';
          if (window.sound) window.sound.playLose();
        }
      }
    } catch (err) {
      if (die1) die1.classList.remove('rolling');
      if (die2) die2.classList.remove('rolling');
      if (window.State) window.State.setGameAnimating(false);
      window.UI.showToast(err.message, 'error');
    } finally {
      this.isRolling = false;
      if (rollBtn) rollBtn.disabled = false;
    }
  }
};

window.DiceGame = DiceGame;
