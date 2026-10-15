// Marsabet Fortune Wheels & Physical Rewards System
// Client-side visual rendering & smooth deceleration canvas physics connected to secure server odds

const FortuneWheels = {
  currentWheel: null,
  currentWheelId: null,
  wheelsData: {},
  cooldownTimer: null,
  activeFilter: 'all',

  // Physique de rotation
  isSpinning: false,
  wheelAngle: 0,
  targetAngle: 0,
  spinStartTime: 0,
  spinDuration: 4600, // 4.6 secondes pour une sensation casino réaliste
  startAngle: 0,

  init() {
    // Écouteur pour fermer la modale de gain physique
    const closeBtn = document.getElementById('closePhysicalWinModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePhysicalModal());
    }

    const skipBtn = document.getElementById('skipPhysicalDeliveryBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.closePhysicalModal());
    }

    const modal = document.getElementById('physicalWinModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closePhysicalModal();
      });
    }

    // Bouton pour demander la livraison directe du lot physique
    const requestDeliveryBtn = document.getElementById('requestPhysicalDeliveryBtn');
    if (requestDeliveryBtn) {
      requestDeliveryBtn.addEventListener('click', () => {
        this.closePhysicalModal();
        if (window.openDeliveryModal && this.lastPhysicalOrder) {
          window.openDeliveryModal({
            source: 'wheel',
            orderId: this.lastPhysicalOrder.id,
            productName: this.lastPhysicalItem?.label || this.lastPhysicalItem?.name,
            icon: this.lastPhysicalItem?.icon || '🥤',
            quantity: 1
          });
        }
      });
    }

    // Écouteur du bouton Spin de l'arène
    const spinBtn = document.getElementById('wheelArenaSpinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spinCurrentWheel());
    }

    // Écouteurs pour les filtres de la section Récompenses
    this.initRewardFilters();
  },

  initRewardFilters() {
    // Filtres sur la vue dédiée /recompenses
    const dedicatedContainer = document.getElementById('dedicatedRewardFilters');
    if (dedicatedContainer && !dedicatedContainer.dataset.initialized) {
      dedicatedContainer.dataset.initialized = 'true';
      dedicatedContainer.querySelectorAll('[data-reward-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          dedicatedContainer.querySelectorAll('[data-reward-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeFilter = btn.dataset.rewardFilter || 'all';
          this.renderDedicatedRewardsList();
        });
      });
    }

    // Filtres sur le profil élève
    const profileContainer = document.getElementById('profileRewardsContainer');
    if (profileContainer && !profileContainer.dataset.initialized) {
      profileContainer.dataset.initialized = 'true';
      profileContainer.querySelectorAll('[data-reward-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          profileContainer.querySelectorAll('[data-reward-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeFilter = btn.dataset.rewardFilter || 'all';
          this.renderProfileRewardsList();
        });
      });
    }
  },

  // ==========================================
  // 1. LISTING DES ROUES (/roues)
  // ==========================================
  async loadWheelsList() {
    const container = document.getElementById('wheelsGridContainer');
    const heroCoins = document.getElementById('wheelsHeroCoins');
    if (heroCoins && window.State && window.State.user) {
      heroCoins.textContent = window.UI.formatCoins(window.State.user.coins) + ' 🪙';
    }

    try {
      const data = await window.API.getWheels();
      const wheels = data.wheels || [];

      // Mettre en cache
      wheels.forEach(w => {
        this.wheelsData[w.id] = w;
      });

      if (!container) return;

      container.innerHTML = wheels.map(wheel => {
        const isFree = wheel.isFree || wheel.type === 'free';
        const isSafety = wheel.id === 'filet_securite';
        const badgeClass = wheel.badgeClass || (isSafety ? 'badge-safety' : (isFree ? 'badge-free' : 'badge-coins'));
        const badgeText = wheel.badge || (isSafety ? '🛟 FILET DE SÉCURITÉ' : (isFree ? '✨ 100% GRATUIT' : `${wheel.cost} 🪙 COINS`));
        const isLocked = !!wheel.lockedDueToBalance;

        let actionStatusHtml = '';
        if (isLocked) {
          actionStatusHtml = '<span style="color:#F87171; font-weight:700; font-size:0.85rem;">🔒 Disponible uniquement sous 1 000 coins</span>';
        } else if (isFree) {
          if (wheel.canSpin) {
            actionStatusHtml = isSafety
              ? '<span style="color:#38BDF8; font-weight:700;">🛟 Recharge de secours prête !</span>'
              : '<span style="color:#34D399; font-weight:700;">🎁 Tour gratuit prêt !</span>';
          } else {
            const countdownStr = this.formatDuration(wheel.remainingMs);
            actionStatusHtml = `<span class="wheel-list-timer" data-wheel-id="${wheel.id}" data-ms="${wheel.remainingMs}" style="color:var(--text-muted); font-size:0.85rem;">⏱️ Prêt dans ${countdownStr}</span>`;
          }
        } else {
          const remaining = (wheel.remainingSpinsToday !== undefined) ? wheel.remainingSpinsToday : 5;
          const maxSpins = wheel.maxSpins || 5;
          if (remaining <= 0 || wheel.limitReached) {
            actionStatusHtml = `<span style="color:#EF4444; font-weight:700; font-size:0.85rem;">🚫 0/${maxSpins} tour restant aujourd'hui</span>`;
          } else {
            actionStatusHtml = `<span style="color:var(--gold-light); font-weight:600; font-size:0.85rem;">⚡ ${remaining}/${maxSpins} tours restants aujourd'hui</span>`;
          }
        }

        // Preview des lots
        const previewPrizes = (wheel.segments || []).slice(0, 4).map(s => {
          const isPhys = s.type === 'physical';
          const icon = s.icon || (isPhys ? '🎁' : '🪙');
          return `<span style="font-size:0.8rem; background:rgba(255,255,255,0.05); padding:3px 7px; border-radius:4px; border:1px solid rgba(255,255,255,0.08); ${isPhys ? 'color:#FCA5A5; border-color:rgba(239,68,68,0.3);' : ''}">${escapeHtml(icon)} ${escapeHtml(s.label)}</span>`;
        }).join('');

        const lockedBannerHtml = isLocked
          ? '<div class="wheel-card-locked-banner"><span>⚠️</span> Disponible uniquement sous 1 000 coins</div>'
          : '';

        return `
          <div class="wheel-card ${isLocked ? 'wheel-card-locked' : ''}" data-wheel-id="${wheel.id}" onclick="FortuneWheels.openWheel('${escapeHtml(wheel.id)}')">
            <div>
              <div class="wheel-card-header">
                <div class="wheel-card-icon">${escapeHtml(wheel.icon || '🎡')}</div>
                <span class="${badgeClass}">${badgeText}</span>
              </div>
              <h3 class="wheel-card-title">${escapeHtml(wheel.name)}</h3>
              <p class="wheel-card-desc">${escapeHtml(wheel.description)}</p>
              ${lockedBannerHtml}
              
              <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.85rem; margin-bottom:1.25rem;">
                ${previewPrizes}
              </div>
            </div>

            <div class="wheel-card-footer">
              <div>${actionStatusHtml}</div>
              <button class="btn ${isLocked ? 'btn-secondary' : 'btn-gold'}" style="padding:0.6rem 1.25rem; font-size:0.9rem; ${isLocked ? 'opacity:0.75;' : ''}">
                ${isLocked ? '🔒 Voir' : 'Entrer ▶'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Lancer le timer pour les comptes à rebours de la liste
      this.startListingTimers();

    } catch (err) {
      if (container) {
        container.innerHTML = `<div style="color:#EF4444; padding:2rem; text-align:center;">Erreur lors du chargement des roues : ${escapeHtml(err.message)}</div>`;
      }
    }
  },

  openWheel(wheelId) {
    if (window.Router) {
      window.Router.navigate(`/roues/${wheelId}`);
    } else if (window.UI) {
      window.UI.switchView('wheel-arena');
      this.loadWheelArena(wheelId);
    }
  },

  startListingTimers() {
    if (this.listingInterval) clearInterval(this.listingInterval);
    this.listingInterval = setInterval(() => {
      document.querySelectorAll('.wheel-list-timer').forEach(el => {
        let ms = parseInt(el.dataset.ms, 10);
        if (ms > 1000) {
          ms -= 1000;
          el.dataset.ms = ms;
          el.textContent = `⏱️ Prêt dans ${this.formatDuration(ms)}`;
        } else {
          el.outerHTML = '<span style="color:#34D399; font-weight:700;">🎁 Tour gratuit prêt !</span>';
        }
      });
    }, 1000);
  },

  // ==========================================
  // 2. ARÈNE DE ROUE DÉDIÉE (/roues/:id)
  // ==========================================
  async loadWheelArena(wheelId) {
    this.currentWheelId = wheelId;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    // Réinitialiser la bannière et le statut
    const banner = document.getElementById('wheelArenaBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.className = 'result-banner';
    }

    try {
      const data = await window.API.getWheelDetails(wheelId);
      const wheel = data.wheel;
      this.currentWheel = wheel;
      this.wheelsData[wheel.id] = wheel;

      // Header de l'arène
      const nameEl = document.getElementById('wheelArenaName');
      const iconEl = document.getElementById('wheelArenaIcon');
      const subtitleEl = document.getElementById('wheelArenaSubtitle');
      const costBadge = document.getElementById('wheelArenaCostBadge');
      const centerIcon = document.getElementById('wheelCenterIcon');

      if (nameEl) nameEl.textContent = wheel.name;
      if (iconEl) iconEl.textContent = wheel.icon || '🎡';
      if (subtitleEl) subtitleEl.textContent = wheel.description;
      if (centerIcon) centerIcon.textContent = wheel.icon || '🪐';

      if (costBadge) {
        if (wheel.id === 'filet_securite') {
          costBadge.innerHTML = '<span class="badge-safety">🛟 FILET DE SÉCURITÉ (5 MIN)</span>';
        } else if (wheel.isFree || wheel.type === 'free') {
          costBadge.innerHTML = '<span class="badge-free">✨ 100% GRATUIT (24H)</span>';
        } else {
          const rem = (wheel.remainingSpinsToday !== undefined) ? wheel.remainingSpinsToday : 5;
          const max = wheel.maxSpins || 5;
          costBadge.innerHTML = `<span class="badge-coins">🪙 ${wheel.cost} COINS</span> <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:4px 8px; margin-left:6px; color:var(--gold-light); font-weight:600;">${rem}/${max} tours restants aujourd'hui</span>`;
        }
      }

      // Rendre les probabilités et lots
      this.renderOddsList(wheel.segments || []);

      // Configurer les contrôles & cooldown
      this.updateArenaControls(wheel);

      // Dessiner la roue Canvas
      this.drawWheelCanvas();

    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  renderOddsList(segments) {
    const listEl = document.getElementById('wheelArenaOddsList');
    if (!listEl) return;

    listEl.innerHTML = segments.map((seg, idx) => {
      const isPhysical = seg.type === 'physical';
      const oddPercent = seg.probability ? (seg.probability * 100).toFixed(1) + '%' : '~' + Math.round(100 / segments.length) + '%';
      const color = seg.color || (isPhysical ? '#EF4444' : (idx % 2 === 0 ? '#0B2252' : '#0F2C69'));

      return `
        <div class="segment-odd-item ${isPhysical ? 'is-physical' : ''}">
          <div style="display:flex; align-items:center;">
            <div class="odd-color-dot" style="background:${color};"></div>
            <span style="margin-right:0.4rem;">${escapeHtml(seg.icon || (isPhysical ? '🥤' : '🪙'))}</span>
            <span class="odd-label">${escapeHtml(seg.label)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${isPhysical ? '<span style="font-size:0.7rem; background:#EF4444; color:#FFF; padding:2px 6px; border-radius:4px; font-weight:700;">RARE BDE</span>' : ''}
            <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--gold-light); font-weight:700;">${oddPercent}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  updateArenaControls(wheel) {
    const spinBtn = document.getElementById('wheelArenaSpinBtn');
    const cooldownBox = document.getElementById('wheelArenaCooldownBox');
    const cooldownText = document.getElementById('wheelArenaCooldownTime');
    const statusText = document.getElementById('wheelArenaStatusText');

    if (this.isSpinning) {
      if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.style.pointerEvents = 'none';
      }
      return;
    }

    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    // Vérification de restriction de solde max (ex: Filet de Sécurité < 1000 coins)
    if (wheel.lockedDueToBalance) {
      if (cooldownBox) cooldownBox.style.display = 'none';
      const userCoins = window.State?.user?.coins ?? (wheel.userCoins || 0);
      if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<span>🔒</span> DISPONIBLE UNIQUEMENT SOUS 1 000 COINS';
        spinBtn.style.background = '#334155';
        spinBtn.style.color = '#94A3B8';
        spinBtn.style.boxShadow = 'none';
      }
      if (statusText) {
        statusText.innerHTML = `<span style="color:#F87171; font-weight:700;">🔒 Filet de sécurité réservé aux élèves ayant moins de 1 000 coins (ton solde actuel : ${userCoins.toLocaleString('fr-FR')} 🪙).</span>`;
      }
      return;
    }

    if (wheel.isFree || wheel.type === 'free') {
      const isSafety = wheel.id === 'filet_securite';
      if (wheel.canSpin) {
        if (cooldownBox) cooldownBox.style.display = 'none';
        if (spinBtn) {
          spinBtn.disabled = false;
          if (isSafety) {
            spinBtn.innerHTML = '<span>🛟</span> TOURNER LE FILET DE SÉCURITÉ !';
            spinBtn.style.background = 'linear-gradient(135deg, #0284C7 0%, #0369A1 50%, #075985 100%)';
          } else {
            spinBtn.innerHTML = '<span>🎁</span> LANCER MON TOUR GRATUIT !';
            spinBtn.style.background = 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #059669 100%)';
          }
          spinBtn.style.color = '#FFF';
        }
        if (statusText) {
          statusText.textContent = isSafety
            ? '🛟 Tour de secours prêt ! Clique pour te renflouer gratuitement.'
            : '🎉 Tour gratuit prêt ! Clique pour lancer.';
        }
      } else {
        if (cooldownBox) cooldownBox.style.display = 'flex';
        let remaining = wheel.remainingMs || 0;
        if (cooldownText) cooldownText.textContent = this.formatDuration(remaining);

        if (spinBtn) {
          spinBtn.disabled = true;
          spinBtn.innerHTML = `<span>⏱️</span> EN RECHARGE (${this.formatDuration(remaining)})`;
          spinBtn.style.background = '#334155';
          spinBtn.style.color = '#94A3B8';
        }
        if (statusText) {
          statusText.textContent = isSafety
            ? '⏱️ Prochain rechargement disponible dès la fin du compte à rebours (5 min).'
            : '⏱️ Ton prochain tour gratuit sera disponible dès la fin du compte à rebours.';
        }

        this.cooldownTimer = setInterval(() => {
          remaining -= 1000;
          if (remaining <= 0) {
            clearInterval(this.cooldownTimer);
            wheel.canSpin = true;
            wheel.remainingMs = 0;
            this.updateArenaControls(wheel);
          } else {
            if (cooldownText) cooldownText.textContent = this.formatDuration(remaining);
            if (spinBtn && spinBtn.disabled) {
              spinBtn.innerHTML = `<span>⏱️</span> EN RECHARGE (${this.formatDuration(remaining)})`;
            }
          }
        }, 1000);
      }
    } else {
      // Roue en coins
      if (cooldownBox) cooldownBox.style.display = 'none';
      const userCoins = window.State?.user?.coins || 0;
      const canAfford = userCoins >= wheel.cost;
      const remainingSpins = (wheel.remainingSpinsToday !== undefined) ? wheel.remainingSpinsToday : 5;
      const maxSpins = wheel.maxSpins || 5;
      const limitReached = wheel.limitReached || remainingSpins <= 0;

      if (spinBtn) {
        if (limitReached) {
          spinBtn.disabled = true;
          spinBtn.style.background = '#334155';
          spinBtn.style.color = '#94A3B8';
          spinBtn.innerHTML = `<span>🚫</span> LIMITE ATTEINTE (0/${maxSpins})`;
          if (statusText) statusText.textContent = 'Limite quotidienne atteinte, reviens demain';
        } else if (!canAfford) {
          spinBtn.disabled = true;
          spinBtn.style.background = '#334155';
          spinBtn.style.color = '#94A3B8';
          spinBtn.innerHTML = `<span>🚫</span> SOLDE INSUFFISANT (${wheel.cost} COINS)`;
          if (statusText) statusText.textContent = `Il te manque ${(wheel.cost - userCoins).toLocaleString()} coins pour lancer cette roue. (${remainingSpins}/${maxSpins} tours restants aujourd'hui)`;
        } else {
          spinBtn.disabled = false;
          spinBtn.style.background = 'linear-gradient(135deg, #FFE27A 0%, #D4AF37 50%, #997819 100%)';
          spinBtn.style.color = '#061226';
          spinBtn.innerHTML = `<span>🪙</span> TOURNER LA ROUE (${wheel.cost} COINS)`;
          if (statusText) statusText.textContent = `${remainingSpins}/${maxSpins} tours restants aujourd'hui (Coût : ${wheel.cost} coins virtuels)`;
        }
      }
    }
  },

  // ==========================================
  // 3. CANVAS & PHYSIQUE DE ROTATION
  // ==========================================
  drawWheelCanvas() {
    const canvas = document.getElementById('wheelArenaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 14;

    const segments = this.currentWheel?.segments || [];
    const count = segments.length || 8;
    const segAngle = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.wheelAngle);

    // Dessiner les segments
    for (let i = 0; i < count; i++) {
      const seg = segments[i] || { label: 'Coins', color: '#0A2552' };
      const startAngle = i * segAngle;
      const endAngle = (i + 1) * segAngle;

      // Tracé du secteur
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Couleur
      const isPhysical = seg.type === 'physical';
      ctx.fillStyle = seg.color || (isPhysical ? '#DC2626' : (i % 2 === 0 ? '#0B2252' : '#0F2C69'));
      ctx.fill();

      // Bordure intérieure dorée
      ctx.strokeStyle = isPhysical ? '#F87171' : 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Texte et icône du segment
      ctx.save();
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Icône
      ctx.font = 'bold 22px Outfit, sans-serif';
      ctx.fillText(seg.icon || (isPhysical ? '🥤' : '🪙'), radius - 20, 0);

      // Label
      ctx.font = isPhysical ? 'bold 13px Outfit, sans-serif' : '600 13px Outfit, sans-serif';
      ctx.fillStyle = isPhysical ? '#FFF' : '#FFE27A';
      ctx.fillText(seg.label, radius - 52, 0);

      ctx.restore();
    }

    // Bordure extérieure en or brossé avec rivets
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#D4AF37';
    ctx.stroke();

    // Rivets dorés
    const rivetCount = count * 2;
    for (let j = 0; j < rivetCount; j++) {
      const rivetAngle = (j * 2 * Math.PI) / rivetCount;
      const rx = Math.cos(rivetAngle) * (radius + 2);
      const ry = Math.sin(rivetAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(rx, ry, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = j % 2 === 0 ? '#FFE27A' : '#FFF';
      ctx.fill();
    }

    ctx.restore();
  },

  async spinCurrentWheel() {
    if (this.isSpinning || !this.currentWheel) return;

    const spinBtn = document.getElementById('wheelArenaSpinBtn');
    const banner = document.getElementById('wheelArenaBanner');
    if (banner) banner.style.display = 'none';

    // Verrouillage strict anti double-clic
    this.isSpinning = true;
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.style.pointerEvents = 'none';
      spinBtn.innerHTML = '<span>⚡</span> LA ROUE TOURNE...';
    }

    const cost = this.currentWheel.cost || 0;
    if (window.State && cost > 0) {
      window.State.deductBet(cost);
    } else if (window.State) {
      window.State.setGameAnimating(true);
    }

    try {
      const data = await window.API.spinFortuneWheel(this.currentWheel.id);
      const winningIndex = (data.winningIndex !== undefined) ? data.winningIndex : data.segmentIndex;
      const wonItem = data.wonItem || data.segment;
      const isPhysical = !!data.isPhysical;
      const userCoins = data.userCoins || data.coins;
      const segments = this.currentWheel.segments || [];
      const totalSegments = segments.length || 8;

      // =========================================================================
      // CALCUL D'ANGLE MATHÉMATIQUE EXACT & INFAILLIBLE :
      // - Dans le Canvas, le secteur k s'étend de k*segAngle à (k+1)*segAngle.
      // - Son centre exact est à (k + 0.5) * segAngle (sens horaire depuis 3h00).
      // - Le pointeur fixe est au sommet de la roue (12h00), soit 3*PI/2 rad (270°).
      // - Rotation de la roue dans le repère mondial : (segCenter + targetAngle).
      // - Condition d'alignement parfait : segCenter + targetAngle = 3*PI/2 (mod 2*PI).
      // - targetAngle = 3*PI/2 - segCenter (mod 2*PI).
      // =========================================================================
      const TWO_PI = 2 * Math.PI;
      const segAngle = TWO_PI / totalSegments;
      const segCenter = (winningIndex + 0.5) * segAngle;

      const targetMod = (((1.5 * Math.PI - segCenter) % TWO_PI) + TWO_PI) % TWO_PI;
      const currentMod = ((this.wheelAngle % TWO_PI) + TWO_PI) % TWO_PI;

      let additionalAngle = (targetMod - currentMod);
      if (additionalAngle < 0) {
        additionalAngle += TWO_PI;
      }

      // Au moins 6 tours complets pour un suspense réaliste de 4.8 secondes
      const fullSpins = 6 * TWO_PI;
      this.startAngle = this.wheelAngle;
      this.targetAngle = this.wheelAngle + fullSpins + additionalAngle;
      this.spinDuration = 4800;
      this.spinStartTime = performance.now();

      // Animation avec décélération progressive quintic ease-out
      this.animateSpin(() => {
        this.onSpinCompleted(data);
      });

    } catch (err) {
      this.isSpinning = false;
      if (spinBtn) {
        spinBtn.style.pointerEvents = 'auto';
      }
      if (window.State) window.State.setGameAnimating(false);
      this.updateArenaControls(this.currentWheel);
      window.UI.showToast(err.message, 'error');
    }
  },

  animateSpin(onComplete) {
    const now = performance.now();
    const elapsed = now - this.spinStartTime;
    const progress = Math.min(elapsed / this.spinDuration, 1);

    // Décélération progressive (quintic ease-out sur 4.8 secondes)
    const easeOut = 1 - Math.pow(1 - progress, 4.2);
    const prevAngle = this.wheelAngle;
    this.wheelAngle = this.startAngle + (this.targetAngle - this.startAngle) * easeOut;

    // Détection de passage de cran pour cliquetis audio
    const count = this.currentWheel?.segments?.length || 8;
    const segAngle = (2 * Math.PI) / count;
    const prevSeg = Math.floor(prevAngle / segAngle);
    const curSeg = Math.floor(this.wheelAngle / segAngle);
    if (curSeg !== prevSeg && window.sound && typeof window.sound.playSpinTick === 'function') {
      window.sound.playSpinTick();
    }

    this.drawWheelCanvas();

    if (progress < 1) {
      requestAnimationFrame(() => this.animateSpin(onComplete));
    } else {
      this.wheelAngle = this.targetAngle;
      this.drawWheelCanvas();
      this.isSpinning = false;
      const spinBtn = document.getElementById('wheelArenaSpinBtn');
      if (spinBtn) spinBtn.style.pointerEvents = 'auto';
      if (onComplete) onComplete();
    }
  },

  onSpinCompleted(data) {
    const wonItem = data.wonItem || data.segment;
    const isPhysical = !!data.isPhysical;
    const userCoins = data.userCoins || data.coins;

    // Mettre à jour le solde uniquement après la fin de la rotation
    if (window.State && userCoins !== undefined) {
      window.State.setGameAnimating(false, userCoins);
    }

    // Sons et effets de victoire
    if (window.sound && typeof window.sound.playWin === 'function') {
      window.sound.playWin();
    }

    if (isPhysical) {
      // Confettis de célébration
      if (window.UI && typeof window.UI.launchConfetti === 'function') {
        window.UI.launchConfetti();
      }
      this.lastPhysicalItem = wonItem;
      this.lastPhysicalOrder = data.order;

      // Déclenchement automatique de la demande de livraison (modal + email BDE)
      if (window.openDeliveryModal && data.order) {
        window.openDeliveryModal({
          source: 'wheel',
          orderId: data.order.id,
          productName: wonItem.label || wonItem.name,
          icon: wonItem.icon || '🥤',
          quantity: 1
        });
      } else {
        this.showPhysicalWinModal(wonItem, data.order);
      }
    } else {
      // Gain en coins
      const banner = document.getElementById('wheelArenaBanner');
      if (banner) {
        banner.style.display = 'block';
        banner.className = 'result-banner win';
        banner.innerHTML = `🎉 GAGNÉ ! +${escapeHtml(wonItem.coins || wonItem.label)} COINS crédités immédiatement à ton solde !`;
      }
      window.UI.showToast(`🎉 Tu as remporté ${wonItem.label} !`, 'success');
    }

    // Mettre à jour l'état de recharge de la roue immédiatement
    if (this.currentWheel.type === 'free' || this.currentWheel.isFree) {
      this.currentWheel.canSpin = false;
      const remainingMs = data.remainingMs || (this.currentWheel.cooldownHours || 24) * 3600 * 1000;
      this.currentWheel.remainingMs = remainingMs;
      if (this.wheelsData[this.currentWheel.id]) {
        this.wheelsData[this.currentWheel.id].canSpin = false;
        this.wheelsData[this.currentWheel.id].remainingMs = remainingMs;
      }
      this.updateArenaControls(this.currentWheel);
    } else {
      if (data.remainingSpinsToday !== undefined) {
        this.currentWheel.remainingSpinsToday = data.remainingSpinsToday;
        this.currentWheel.spinsToday = data.spinsToday;
        this.currentWheel.limitReached = data.limitReached;
        if (this.wheelsData[this.currentWheel.id]) {
          this.wheelsData[this.currentWheel.id].remainingSpinsToday = data.remainingSpinsToday;
          this.wheelsData[this.currentWheel.id].spinsToday = data.spinsToday;
          this.wheelsData[this.currentWheel.id].limitReached = data.limitReached;
        }
      }
      const costBadge = document.getElementById('wheelArenaCostBadge');
      if (costBadge) {
        const rem = (this.currentWheel.remainingSpinsToday !== undefined) ? this.currentWheel.remainingSpinsToday : 5;
        const max = this.currentWheel.maxSpins || 5;
        costBadge.innerHTML = `<span class="badge-coins">🪙 ${this.currentWheel.cost} COINS</span> <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:4px 8px; margin-left:6px; color:var(--gold-light); font-weight:600;">${rem}/${max} tours restants aujourd'hui</span>`;
      }
      this.updateArenaControls(this.currentWheel);
    }
  },

  // ==========================================
  // 4. MODALE GAIN PHYSIQUE RARE
  // ==========================================
  showPhysicalWinModal(wonItem, order) {
    const modal = document.getElementById('physicalWinModal');
    const nameEl = document.getElementById('physicalWinModalName');
    const iconEl = document.getElementById('physicalWinModalIcon');

    if (nameEl) nameEl.textContent = wonItem.label || wonItem.name;
    if (iconEl) iconEl.textContent = wonItem.icon || '🥤';

    if (modal) modal.classList.add('active');
  },

  closePhysicalModal() {
    const modal = document.getElementById('physicalWinModal');
    if (modal) modal.classList.remove('active');
  },

  // ==========================================
  // 5. SECTION "MES DEMANDES DE RÉCUPÉRATION"
  // ==========================================
  async loadMyRewards() {
    this.renderDedicatedRewardsList();
    this.renderProfileRewardsList();
  },

  async fetchAllUserRewards() {
    try {
      const data = await window.API.getMyRewards();
      return data.rewards || data.deliveries || [];
    } catch (err) {
      console.warn('Erreur chargement récompenses :', err);
      return [];
    }
  },

  async renderDedicatedRewardsList() {
    const container = document.getElementById('dedicatedRewardsList');
    if (!container) return;

    const rewards = await this.fetchAllUserRewards();

    // Compteurs
    const pendingCount = rewards.filter(r => r.status === 'pending' || r.status === 'pending_info').length;
    const deliveredCount = rewards.filter(r => r.status === 'delivered').length;

    const pEl = document.getElementById('rewardsPendingCount');
    const cEl = document.getElementById('rewardsCollectedCount');
    const tEl = document.getElementById('rewardsTotalCount');
    if (pEl) pEl.textContent = pendingCount;
    if (cEl) cEl.textContent = deliveredCount;
    if (tEl) tEl.textContent = rewards.length;

    // Filtrage
    const filtered = rewards.filter(r => {
      if (this.activeFilter === 'pending') return r.status === 'pending' || r.status === 'pending_info';
      if (this.activeFilter === 'delivered' || this.activeFilter === 'collected') return r.status === 'delivered';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--bg-glass-border);">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">📦</div>
          <h3 style="color:#FFF; font-size:1.15rem; margin-bottom:0.4rem;">Aucune demande de livraison dans cette catégorie</h3>
          <p style="font-size:0.9rem; margin-bottom:1.25rem;">Tourne les <strong>Roues de la Fortune</strong> pour te faire livrer des boissons et snacks dans ta salle !</p>
          <button class="btn btn-gold" onclick="window.Router ? window.Router.navigate('/roues') : window.UI.switchView('wheels')">🎡 Découvrir les Roues ▶</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(r => this.buildRewardCardHtml(r)).join('');
    this.bindCardDeliveryButtons(container);
  },

  async renderProfileRewardsList() {
    const container = document.getElementById('profileOrdersList');
    if (!container) return;

    const rewards = await this.fetchAllUserRewards();

    const filtered = rewards.filter(r => {
      if (this.activeFilter === 'pending') return r.status === 'pending' || r.status === 'pending_info';
      if (this.activeFilter === 'delivered' || this.activeFilter === 'collected') return r.status === 'delivered';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:2rem 1rem; color:var(--text-muted);">
          Aucune demande de livraison pour le moment. Fais tourner une roue de la fortune !
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(r => this.buildRewardCardHtml(r)).join('');
    this.bindCardDeliveryButtons(container);
  },

  bindCardDeliveryButtons(container) {
    if (!container) return;
    container.querySelectorAll('.btn-card-complete-delivery').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        const icon = e.currentTarget.dataset.icon;
        if (window.openDeliveryModal) {
          window.openDeliveryModal({
            source: 'wheel',
            orderId: id,
            productName: name,
            icon: icon
          });
        }
      });
    });
  },

  buildRewardCardHtml(reward) {
    const isDelivered = reward.status === 'delivered';
    const isPendingInfo = reward.status === 'pending_info';
    const sourceLabel = '🎡 Roue de la Fortune';

    let statusText = '⏳ En cours de livraison';
    let statusClass = 'status-pending';
    if (isDelivered) {
      statusText = '✅ Livré par le BDE';
      statusClass = 'status-collected';
    } else if (isPendingInfo) {
      statusText = '⚠️ Salle à préciser';
      statusClass = 'status-warning';
    }

    let emailBadge = '';
    if (reward.email_status === 'sent') {
      emailBadge = '<span style="color:#22C55E; font-size:0.75rem; font-weight:600;">✉️ BDE Notifié</span>';
    } else if (reward.email_status === 'not_configured') {
      emailBadge = '<span style="color:var(--text-muted); font-size:0.75rem;">📋 Enregistré</span>';
    } else {
      emailBadge = '<span style="color:var(--text-muted); font-size:0.75rem;">📋 En attente BDE</span>';
    }

    return `
      <div class="reward-ticket-card ${statusClass}">
        <div class="reward-ticket-header">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span class="reward-ticket-icon">${reward.icon || '🎁'}</span>
            <div>
              <div class="reward-ticket-title">${this.escapeHtml(reward.item_name)}</div>
              <span class="reward-source-badge">${sourceLabel}</span>
            </div>
          </div>
          <span class="reward-status-pill ${statusClass}">${statusText}</span>
        </div>

        <div class="reward-ticket-code-zone" style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:var(--radius-sm); padding:0.6rem 0.8rem; margin:0.75rem 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div style="font-size:0.8rem; color:var(--gold-light); font-weight:600;">
                📍 Lieu : ${this.escapeHtml(reward.room_location || 'À préciser')}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                Élève : ${this.escapeHtml(reward.first_name || '')} ${this.escapeHtml(reward.last_name || '')}
              </div>
              ${reward.notes ? `
                <div style="font-size:0.75rem; color:#CBD5E1; margin-top:3px; font-style:italic;">
                  📝 Précision : ${this.escapeHtml(reward.notes)}
                </div>
              ` : ''}
            </div>
            <div>
              ${emailBadge}
            </div>
          </div>

          ${isPendingInfo ? `
            <button class="btn btn-gold btn-card-complete-delivery" data-id="${reward.id}" data-name="${this.escapeHtml(reward.item_name)}" data-icon="${reward.icon || '🎁'}" style="width:100%; margin-top:0.6rem; padding:0.4rem; font-size:0.8rem;">
              📦 Renseigner ma salle pour livraison
            </button>
          ` : ''}
        </div>

        <div class="reward-ticket-footer">
          <span>${isDelivered ? 'Livré le ' + this.formatDate(reward.delivered_at) : 'Demandé le ' + this.formatDate(reward.created_at)}</span>
          <span style="color:var(--text-secondary); font-size:0.78rem;">Livraison directe BDE</span>
        </div>
      </div>
    `;
  },

  // ==========================================
  // HELPERS
  // ==========================================
  formatDuration(ms) {
    if (!ms || ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
};

window.FortuneWheels = FortuneWheels;

// Initialiser après le chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FortuneWheels.init());
} else {
  FortuneWheels.init();
}
