// Dice Game Frontend Logic

const DiceGame = {
  isRolling: false,
  currentBet: 25,
  currentMode: 'classic', // 'classic' ou 'over_under'
  selectedCrapsBet: 'seven',
  diceIcons: ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const rollBtn = document.getElementById('diceRollBtn');
    if (rollBtn) rollBtn.addEventListener('click', () => this.roll());

    // Switch de mode
    const tabClassic = document.getElementById('tabDiceClassic');
    const tabSlider = document.getElementById('tabDiceSlider');
    const areaClassic = document.getElementById('diceClassicArea');
    const areaSlider = document.getElementById('diceSliderArea');

    if (tabClassic && tabSlider) {
      tabClassic.addEventListener('click', () => {
        this.currentMode = 'classic';
        tabClassic.classList.add('active');
        tabSlider.classList.remove('active');
        if (areaClassic) areaClassic.style.display = 'block';
        if (areaSlider) areaSlider.style.display = 'none';
      });

      tabSlider.addEventListener('click', () => {
        this.currentMode = 'over_under';
        tabSlider.classList.add('active');
        tabClassic.classList.remove('active');
        if (areaClassic) areaClassic.style.display = 'none';
        if (areaSlider) areaSlider.style.display = 'block';
      });
    }

    // Choix des paris Craps
    document.querySelectorAll('.dice-bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dice-bet-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedCrapsBet = e.currentTarget.dataset.type;
        window.sound.playChip();
      });
    });

    // Curseur Over/Under
    const slider = document.getElementById('diceTargetSlider');
    const targetValDisplay = document.getElementById('diceTargetDisplay');
    const multDisplay = document.getElementById('diceMultDisplay');
    const conditionSelect = document.getElementById('diceConditionSelect');

    const updateSliderStats = () => {
      if (!slider) return;
      const val = parseFloat(slider.value);
      if (targetValDisplay) targetValDisplay.textContent = val.toFixed(0);
      const cond = conditionSelect ? conditionSelect.value : 'over';
      const winChance = cond === 'over' ? 100 - val : val;
      const mult = (97 / winChance).toFixed(2);
      if (multDisplay) multDisplay.textContent = `${mult}x`;
    };

    if (slider) slider.addEventListener('input', updateSliderStats);
    if (conditionSelect) conditionSelect.addEventListener('change', updateSliderStats);

    // Jetons de mise
    document.querySelectorAll('#view-dice .casino-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = parseInt(e.currentTarget.dataset.val);
        this.setBet(val);
        window.sound.playChip();
      });
    });

    const input = document.getElementById('diceBetInput');
    if (input) {
      input.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) this.setBet(val);
      });
    }
  },

  setBet(val) {
    this.currentBet = Math.max(1, val);
    const input = document.getElementById('diceBetInput');
    if (input) input.value = this.currentBet;
  },

  async roll() {
    if (this.isRolling) return;

    if (!window.State.isAuthenticated) {
      window.UI.showToast('Connecte-toi pour lancer les dés.', 'error');
      window.UI.openAuthModal('login');
      return;
    }

    if (window.State.user.coins < this.currentBet) {
      window.UI.showToast('Solde insuffisant pour cette mise.', 'error');
      return;
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

    const slider = document.getElementById('diceTargetSlider');
    const cond = document.getElementById('diceConditionSelect');

    const options = this.currentMode === 'classic'
      ? { betType: this.selectedCrapsBet }
      : { target: slider ? slider.value : 50, condition: cond ? cond.value : 'over' };

    try {
      const data = await window.API.rollDice(this.currentBet, this.currentMode, options);

      // Simulation de lancer 700ms
      await new Promise(r => setTimeout(r, 700));

      if (die1) {
        die1.classList.remove('rolling');
        die1.textContent = this.diceIcons[data.die1 || 1];
      }
      if (die2) {
        die2.classList.remove('rolling');
        die2.textContent = this.diceIcons[data.die2 || 6];
      }

      if (data.mode === 'over_under') {
        const rollDisplay = document.getElementById('diceRollNumberDisplay');
        if (rollDisplay) rollDisplay.textContent = data.roll.toFixed(2);
      }

      window.State.updateCoins(data.coins);

      if (banner) {
        if (data.won) {
          banner.textContent = `🎲 GAGNÉ ! +${data.payout} JETONS (x${data.multiplier})`;
          banner.className = 'result-banner win';
          banner.style.display = 'block';
          window.sound.playWin();
          window.UI.triggerConfetti();
        } else {
          banner.textContent = `❌ PERDU ! Tirage : ${data.mode === 'classic' ? 'Total ' + data.sum : data.roll}`;
          banner.className = 'result-banner lose';
          banner.style.display = 'block';
          window.sound.playLose();
        }
      }
    } catch (err) {
      if (die1) die1.classList.remove('rolling');
      if (die2) die2.classList.remove('rolling');
      window.UI.showToast(err.message, 'error');
    } finally {
      this.isRolling = false;
      if (rollBtn) rollBtn.disabled = false;
    }
  }
};

window.DiceGame = DiceGame;
