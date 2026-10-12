// Admin BDE Module for Marsabet

const AdminBDE = {
  activeTab: 'orders', // 'orders', 'promos', 'wheels'

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Onglets Admin
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Filtres des demandes de livraison
    const statusFilter = document.getElementById('adminOrdersStatusFilter');
    const searchFilter = document.getElementById('adminOrdersSearchInput');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadOrders());
    }

    if (searchFilter) {
      searchFilter.addEventListener('input', () => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadOrders(), 350);
      });
    }

    // Modal Création Code Promo
    const openPromoBtn = document.getElementById('adminOpenCreatePromoBtn');
    if (openPromoBtn) {
      openPromoBtn.addEventListener('click', () => this.openPromoModal());
    }

    const closePromoModal = document.getElementById('closeAdminPromoModal');
    if (closePromoModal) {
      closePromoModal.addEventListener('click', () => {
        const m = document.getElementById('adminPromoModal');
        if (m) m.classList.remove('active');
      });
    }

    const genPromoBtn = document.getElementById('btnGeneratePromoCode');
    if (genPromoBtn) {
      genPromoBtn.addEventListener('click', () => {
        const input = document.getElementById('promoInputCode');
        if (input) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let r = 'MARSA-';
          for (let i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
          input.value = r;
        }
      });
    }

    const formPromo = document.getElementById('formAdminPromo');
    if (formPromo) {
      formPromo.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePromoCode();
      });
    }

    // Gestion des Roues de la Fortune
    const wheelSelect = document.getElementById('adminWheelSelect');
    if (wheelSelect) {
      wheelSelect.addEventListener('change', (e) => {
        this.selectWheel(e.target.value);
      });
    }

    const addSegmentBtn = document.getElementById('adminAddSegmentBtn');
    if (addSegmentBtn) {
      addSegmentBtn.addEventListener('click', () => this.addSegment());
    }

    const resetWheelBtn = document.getElementById('adminResetWheelBtn');
    if (resetWheelBtn) {
      resetWheelBtn.addEventListener('click', () => this.resetWheelSegments());
    }

    const saveWheelBtn = document.getElementById('adminSaveWheelBtn');
    if (saveWheelBtn) {
      saveWheelBtn.addEventListener('click', () => this.saveWheelSegments());
    }

    const testSpinBtn = document.getElementById('adminTestSpinBtn');
    if (testSpinBtn) {
      testSpinBtn.addEventListener('click', () => this.testSpinPreview());
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    const areaOrders = document.getElementById('adminTabOrders');
    const areaPromos = document.getElementById('adminTabPromos');
    const areaWheels = document.getElementById('adminTabWheels');

    if (areaOrders) areaOrders.style.display = (tab === 'orders') ? 'block' : 'none';
    if (areaPromos) areaPromos.style.display = (tab === 'promos') ? 'block' : 'none';
    if (areaWheels) areaWheels.style.display = (tab === 'wheels') ? 'block' : 'none';

    if (tab === 'orders') this.loadOrders();
    if (tab === 'promos') this.loadPromoCodes();
    if (tab === 'wheels') this.loadWheels();
  },

  async markDelivered(deliveryId) {
    if (!deliveryId) return;
    try {
      const data = await window.API.adminMarkDelivered(deliveryId);
      window.UI.showToast(data.message || 'Demande marquée comme livrée !', 'success', 4000);
      if (window.sound && typeof window.sound.playWin === 'function') {
        window.sound.playWin();
      }
      this.loadOrders();
    } catch (err) {
      console.error('Erreur marquer livré:', err);
      window.UI.showToast(err.message || 'Erreur lors de la validation de la livraison.', 'error');
    }
  },

  async loadOrders() {
    const listEl = document.getElementById('adminOrdersList');
    if (!listEl) return;

    const status = document.getElementById('adminOrdersStatusFilter')?.value || 'all';
    const search = document.getElementById('adminOrdersSearchInput')?.value || '';

    listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Chargement des livraisons...</td></tr>';

    try {
      const data = await window.API.adminGetDeliveries(status, search);
      const deliveries = data.deliveries || data.orders || [];

      if (deliveries.length === 0) {
        listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Aucune demande de livraison trouvée.</td></tr>';
        return;
      }

      listEl.innerHTML = deliveries.map(d => {
        const isDelivered = d.status === 'delivered';
        const isShop = d.source === 'shop';

        // Badge Email BDE
        let emailBadge = '';
        if (d.email_status === 'sent') {
          emailBadge = '<span style="color:#22C55E; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:3px;">✉️ Envoyé</span>';
        } else if (d.email_status === 'not_configured') {
          emailBadge = '<span style="color:var(--text-muted); font-size:0.8rem;" title="EMAIL_PASS non configuré dans .env">⚠️ Non config.</span>';
        } else {
          emailBadge = `<span style="color:#EF4444; font-size:0.8rem; font-weight:600;" title="${escapeHtml(d.email_error || 'Erreur d\'envoi')}">❌ Échec</span>`;
        }

        // Badge Statut
        const statusBadge = isDelivered
          ? '<span style="display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; background:rgba(34,197,94,0.15); border:1px solid #22C55E; color:#22C55E; font-size:0.8rem; font-weight:600;">✅ Livré</span>'
          : '<span style="display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; background:rgba(245,158,11,0.15); border:1px solid #F59E0B; color:#F59E0B; font-size:0.8rem; font-weight:600;">⏳ À livrer</span>';

        // Origine
        const originBadge = isShop
          ? '<span class="vip-badge" style="background:rgba(59,130,246,0.15); border:1px solid #3b82f6; color:#93c5fd; font-size:0.75rem;">🛍️ Boutique</span>'
          : '<span class="vip-badge" style="background:rgba(212,175,55,0.15); border:1px solid var(--gold-primary); color:var(--gold-light); font-size:0.75rem;">🎡 Roue</span>';

        // Action
        let actionCell = '';
        if (isDelivered) {
          actionCell = `<span style="font-size:0.75rem; color:var(--text-muted);">Livré par ${escapeHtml(d.delivered_by_admin || 'Admin')}<br>${new Date(d.delivered_at).toLocaleDateString('fr-FR')}</span>`;
        } else {
          actionCell = `<button class="btn btn-gold btn-mark-delivered" data-id="${d.id}" style="padding:0.35rem 0.75rem; font-size:0.8rem; white-space:nowrap;">✔ Marquer Livré</button>`;
        }

        const dateStr = new Date(d.created_at).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        return `
          <tr>
            <td style="font-size:0.82rem; color:var(--text-secondary); white-space:nowrap;">${dateStr}</td>
            <td>
              <strong style="color:#FFF;">${escapeHtml(d.last_name)} ${escapeHtml(d.first_name)}</strong>
              <br><small style="color:var(--text-muted); font-size:0.78rem;">@${escapeHtml(d.username)}</small>
            </td>
            <td>
              <span style="color:var(--gold-light); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                📍 ${escapeHtml(d.room_location)}
              </span>
              ${d.notes ? `<br><small style="color:#CBD5E1; font-size:0.78rem; display:inline-block; margin-top:2px;">📝 <em>${escapeHtml(d.notes)}</em></small>` : ''}
            </td>
            <td style="font-size:0.85rem;">
              ${d.phone ? `<a href="tel:${escapeHtml(d.phone)}" style="color:var(--text-secondary); text-decoration:none;">📞 ${escapeHtml(d.phone)}</a>` : '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>'}
            </td>
            <td>
              <strong>${d.icon || '🎁'} ${escapeHtml(d.item_name)}</strong>
              ${d.variant_name ? `<br><small style="color:var(--text-muted); font-size:0.78rem;">${escapeHtml(d.variant_name)}</small>` : ''}
              <span style="font-size:0.8rem; color:var(--text-secondary);"> (x${d.quantity || 1})</span>
            </td>
            <td>${originBadge}</td>
            <td>${emailBadge}</td>
            <td>${statusBadge}</td>
            <td>${actionCell}</td>
          </tr>
        `;
      }).join('');

      // Attacher les écouteurs pour "Marquer Livré"
      listEl.querySelectorAll('.btn-mark-delivered').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          if (confirm('Confirmer que cette commande a bien été livrée à l\'élève ?')) {
            this.markDelivered(id);
          }
        });
      });
    } catch (err) {
      console.error('Erreur chargement livraisons admin:', err);
      listEl.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--lose-red); padding:1.5rem;">Erreur lors du chargement des livraisons.</td></tr>';
    }
  },

  // ======================== GESTION CODES PROMO ========================
  openPromoModal() {
    const modal = document.getElementById('adminPromoModal');
    if (!modal) return;
    const form = document.getElementById('formAdminPromo');
    if (form) form.reset();
    const codeInput = document.getElementById('promoInputCode');
    if (codeInput) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let r = 'MARSA-';
      for (let i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
      codeInput.value = r;
    }
    const usesInput = document.getElementById('promoInputMaxUses');
    if (usesInput) usesInput.value = '50';
    const coinsInput = document.getElementById('promoInputCoins');
    if (coinsInput) coinsInput.value = '1000';
    modal.classList.add('active');
  },

  async savePromoCode() {
    const code = document.getElementById('promoInputCode')?.value.trim();
    const coinsAmount = parseInt(document.getElementById('promoInputCoins')?.value);
    const maxUses = parseInt(document.getElementById('promoInputMaxUses')?.value);
    const expiresAt = document.getElementById('promoInputExpiresAt')?.value || null;

    if (!code) {
      window.UI.showToast('Veuillez entrer un code.', 'error');
      return;
    }

    try {
      const res = await window.API.adminCreatePromoCode({ code, coinsAmount, maxUses, expiresAt });
      window.UI.showToast(res.message || 'Code promo créé avec succès !', 'success');
      const modal = document.getElementById('adminPromoModal');
      if (modal) modal.classList.remove('active');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async loadPromoCodes() {
    const listEl = document.getElementById('adminPromosList');
    if (!listEl) return;
    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Chargement des codes promo...</td></tr>';

    try {
      const data = await window.API.adminGetPromoCodes();
      const codes = data.codes || [];

      // Mettre à jour les métriques
      const countEl = document.getElementById('adminPromoCount');
      const activeEl = document.getElementById('adminPromoActiveCount');
      const usesEl = document.getElementById('adminPromoUsesCount');
      const coinsEl = document.getElementById('adminPromoCoinsCount');

      if (countEl) countEl.textContent = codes.length;
      if (activeEl) activeEl.textContent = codes.filter(c => c.is_active && !c.is_expired && !c.is_limit_reached).length;
      const totalUses = codes.reduce((acc, c) => acc + (c.current_uses || 0), 0);
      const totalCoins = codes.reduce((acc, c) => acc + ((c.current_uses || 0) * c.coins_amount), 0);
      if (usesEl) usesEl.textContent = totalUses;
      if (coinsEl) coinsEl.textContent = totalCoins.toLocaleString() + ' 🪙';

      if (codes.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Aucun code promo créé. Clique sur "Nouveau Code Promo" pour en créer un !</td></tr>';
        return;
      }

      listEl.innerHTML = codes.map(c => {
        const percent = Math.min(100, Math.round((c.current_uses / c.max_uses) * 100));
        let statusBadge = '<span class="order-status pending" style="background:rgba(16,185,129,0.2); color:#34D399; border:1px solid #10B981;">Actif</span>';
        if (!c.is_active) {
          statusBadge = '<span class="order-status" style="background:rgba(148,163,184,0.2); color:#94A3B8; border:1px solid #64748B;">Désactivé</span>';
        } else if (c.is_expired) {
          statusBadge = '<span class="order-status" style="background:rgba(239,68,68,0.2); color:#FCA5A5; border:1px solid #EF4444;">Expiré</span>';
        } else if (c.is_limit_reached) {
          statusBadge = '<span class="order-status" style="background:rgba(245,158,11,0.2); color:#FCD34D; border:1px solid #F59E0B;">Limite atteinte</span>';
        }

        const expText = c.expires_at ? new Date(c.expires_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '<span style="color:var(--text-muted);">Illimitée</span>';

        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <code style="font-family:var(--font-mono); font-weight:800; font-size:1.05rem; color:var(--gold-light); background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.4); letter-spacing:1px;">${c.code}</code>
                <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${c.code}'); window.UI.showToast('Code ${c.code} copié !', 'info');" style="padding:2px 6px; font-size:0.75rem;" title="Copier le code">📋</button>
              </div>
            </td>
            <td><strong style="color:var(--gold-light);">${c.coins_amount.toLocaleString()} 🪙</strong></td>
            <td>
              <div style="min-width:120px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:3px;">
                  <span>${c.current_uses} / ${c.max_uses}</span>
                  <span style="color:var(--text-muted);">${percent}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                  <div style="background:var(--gold-primary); height:100%; width:${percent}%;"></div>
                </div>
              </div>
            </td>
            <td style="font-size:0.85rem;">${expText}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-outline" onclick="AdminBDE.togglePromoCode(${c.id})" style="padding:4px 8px; font-size:0.75rem;" title="Activer / Désactiver">
                  ${c.is_active ? '⏸️ Désactiver' : '▶️ Activer'}
                </button>
                <button class="btn btn-outline" onclick="AdminBDE.deletePromoCode(${c.id}, '${c.code}')" style="padding:4px 8px; font-size:0.75rem; border-color:#EF4444; color:#FCA5A5;" title="Supprimer">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#EF4444;">Erreur : ${err.message}</td></tr>`;
    }
  },

  async togglePromoCode(id) {
    try {
      const res = await window.API.adminTogglePromoCode(id);
      window.UI.showToast(res.message, 'success');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  async deletePromoCode(id, code) {
    if (!confirm(`Supprimer définitivement le code promo "${code}" ?`)) return;
    try {
      const res = await window.API.adminDeletePromoCode(id);
      window.UI.showToast(res.message, 'info');
      this.loadPromoCodes();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // GESTION DYNAMIQUE DES ROUES DE LA FORTUNE
  // ==========================================
  wheelsData: [],
  currentWheelId: null,
  editedSegments: [],
  previewAngle: 0,
  previewSpinning: false,

  async loadWheels() {
    const select = document.getElementById('adminWheelSelect');
    if (!select) return;

    try {
      select.innerHTML = '<option value="">Chargement des roues...</option>';
      const data = await window.API.adminGetWheels();
      this.wheelsData = data.wheels || [];

      if (!this.wheelsData.length) {
        select.innerHTML = '<option value="">Aucune roue trouvée</option>';
        return;
      }

      select.innerHTML = this.wheelsData.map(w => `
        <option value="${w.id}">${w.name} (${w.isFree ? 'Gratuit / 24h' : w.cost + ' coins'})</option>
      `).join('');

      const targetId = this.currentWheelId && this.wheelsData.some(w => w.id === this.currentWheelId)
        ? this.currentWheelId
        : this.wheelsData[0].id;

      select.value = targetId;
      this.selectWheel(targetId);
    } catch (err) {
      console.error('Erreur chargement roues admin:', err);
      window.UI.showToast('Erreur lors du chargement des roues : ' + err.message, 'error');
    }
  },

  selectWheel(wheelId) {
    this.currentWheelId = wheelId;
    const wheel = this.wheelsData.find(w => w.id === wheelId);
    if (!wheel) return;

    // Cloner profondément les segments pour modification sans toucher au cache tant que pas sauvegardé
    this.editedSegments = JSON.parse(JSON.stringify(wheel.segments || []));

    // Mettre à jour la bannière d'information
    const nameEl = document.getElementById('adminWheelCurrentName');
    const typeEl = document.getElementById('adminWheelCurrentType');
    if (nameEl) nameEl.textContent = wheel.name;
    if (typeEl) typeEl.textContent = wheel.isFree ? '🎁 Gratuite (Cooldown 24h)' : `🪙 Payante (${wheel.cost} Coins)`;

    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  renderSegmentsTable() {
    const tbody = document.getElementById('adminWheelSegmentsTbody');
    const segCountEl = document.getElementById('adminWheelSegCount');
    const probBadge = document.getElementById('adminWheelProbSumBadge');
    const previewCountEl = document.getElementById('adminPreviewCount');
    const previewWeightEl = document.getElementById('adminPreviewTotalWeight');

    if (!tbody) return;

    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const count = this.editedSegments.length;

    if (segCountEl) segCountEl.textContent = count;
    if (previewCountEl) previewCountEl.textContent = count;
    if (previewWeightEl) previewWeightEl.textContent = `${totalWeight.toFixed(1)}%`;

    // Indicateur de probabilité
    if (probBadge) {
      const isExact100 = Math.abs(totalWeight - 100) < 0.1;
      if (isExact100) {
        probBadge.textContent = '100.0% ✅';
        probBadge.style.color = 'var(--win-green)';
      } else {
        probBadge.textContent = `${totalWeight.toFixed(1)}% ⚠️ (Normalisé à 100%)`;
        probBadge.style.color = '#F59E0B';
      }
    }

    if (count === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Aucun segment. Cliquez sur "+ Ajouter un Segment".</td></tr>';
      return;
    }

    tbody.innerHTML = this.editedSegments.map((seg, idx) => {
      const isPhysical = seg.type === 'physical';
      const weightVal = parseFloat(seg.weight) || 0;
      const pctNormalized = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(1) : '0.0';

      return `
        <tr data-index="${idx}">
          <td style="font-weight:700; color:var(--gold-light); text-align:center;">${idx + 1}</td>
          <td>
            <input type="color" value="${seg.color || (isPhysical ? '#DC2626' : (idx % 2 === 0 ? '#0B2252' : '#0F2C69'))}"
              onchange="AdminBDE.updateSegmentField(${idx}, 'color', this.value)"
              title="Choisir la couleur du segment" />
          </td>
          <td>
            <input type="text" value="${seg.icon || (isPhysical ? '🥤' : '🪙')}" maxlength="4" style="text-align:center;"
              oninput="AdminBDE.updateSegmentField(${idx}, 'icon', this.value)"
              placeholder="🪙" />
          </td>
          <td>
            <input type="text" value="${seg.label || ''}"
              oninput="AdminBDE.updateSegmentField(${idx}, 'label', this.value)"
              placeholder="Ex: 500 Coins ou Red Bull" required />
          </td>
          <td>
            <select onchange="AdminBDE.updateSegmentField(${idx}, 'type', this.value)">
              <option value="coins" ${seg.type === 'coins' ? 'selected' : ''}>🪙 Coins</option>
              <option value="physical" ${seg.type === 'physical' ? 'selected' : ''}>📦 Produit Physique</option>
              <option value="special" ${seg.type === 'special' ? 'selected' : ''}>✨ Spécial</option>
            </select>
          </td>
          <td>
            <input type="text" value="${seg.value !== undefined ? seg.value : (seg.type === 'coins' ? (seg.coins !== undefined ? seg.coins : '') : (seg.product?.name || seg.product?.itemId || ''))}"
              oninput="AdminBDE.updateSegmentField(${idx}, 'value', this.value)"
              placeholder="${isPhysical ? 'ID ou Nom produit' : 'Nombre de coins'}" />
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <input type="number" step="0.1" min="0.1" max="100" value="${weightVal}" style="width:58px; text-align:right;"
                oninput="AdminBDE.updateSegmentField(${idx}, 'weight', parseFloat(this.value) || 0)" />
              <span style="font-size:0.75rem; color:var(--text-muted);">%</span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-align:right;">≈ ${pctNormalized}% réel</div>
          </td>
          <td style="text-align:center;">
            <button class="btn btn-outline" onclick="AdminBDE.removeSegment(${idx})"
              style="padding:4px 7px; font-size:0.8rem; border-color:#EF4444; color:#FCA5A5;"
              ${count <= 2 ? 'disabled title="Minimum 2 segments"' : 'title="Supprimer ce segment"'}>
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateSegmentField(index, field, value) {
    if (!this.editedSegments[index]) return;

    if (field === 'weight') {
      this.editedSegments[index].weight = Math.max(0.1, parseFloat(value) || 0.1);
    } else if (field === 'value') {
      const num = Number(value);
      this.editedSegments[index].value = (!isNaN(num) && value !== '') ? num : value;
      if (this.editedSegments[index].type === 'coins') {
        this.editedSegments[index].coins = (!isNaN(num) && value !== '') ? Math.max(0, num) : 0;
      }
    } else {
      this.editedSegments[index][field] = value;
    }

    // Mise à jour rapide de la jauge et du canvas sans ré-injecter tout le HTML (évite la perte de focus)
    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const probBadge = document.getElementById('adminWheelProbSumBadge');
    const previewWeightEl = document.getElementById('adminPreviewTotalWeight');

    if (previewWeightEl) previewWeightEl.textContent = `${totalWeight.toFixed(1)}%`;
    if (probBadge) {
      const isExact100 = Math.abs(totalWeight - 100) < 0.1;
      if (isExact100) {
        probBadge.textContent = '100.0% ✅';
        probBadge.style.color = 'var(--win-green)';
      } else {
        probBadge.textContent = `${totalWeight.toFixed(1)}% ⚠️ (Normalisé à 100%)`;
        probBadge.style.color = '#F59E0B';
      }
    }

    this.drawAdminWheelPreview();
  },

  addSegment() {
    if (this.editedSegments.length >= 24) {
      window.UI.showToast('Une roue ne peut pas comporter plus de 24 segments.', 'warning');
      return;
    }

    const defaultColors = ['#0B2252', '#0F2C69', '#14367B', '#0A1E45', '#DC2626', '#D97706', '#059669'];
    const color = defaultColors[this.editedSegments.length % defaultColors.length];

    this.editedSegments.push({
      id: 'seg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      icon: '🎁',
      label: 'Lot ' + (this.editedSegments.length + 1),
      type: 'coins',
      value: 100,
      weight: 10,
      color: color
    });

    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  removeSegment(index) {
    if (this.editedSegments.length <= 2) {
      window.UI.showToast('Une roue doit comporter au minimum 2 segments.', 'warning');
      return;
    }

    this.editedSegments.splice(index, 1);
    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
  },

  resetWheelSegments() {
    if (!this.currentWheelId) return;
    const wheel = this.wheelsData.find(w => w.id === this.currentWheelId);
    if (!wheel) return;

    this.editedSegments = JSON.parse(JSON.stringify(wheel.segments || []));
    this.renderSegmentsTable();
    this.drawAdminWheelPreview();
    window.UI.showToast('Modifications réinitialisées aux valeurs sauvegardées.', 'info');
  },

  async saveWheelSegments() {
    if (!this.currentWheelId) return;
    const wheel = this.wheelsData.find(w => w.id === this.currentWheelId);
    const wheelName = wheel ? wheel.name : this.currentWheelId;

    if (this.editedSegments.length < 2) {
      window.UI.showToast('La roue doit comporter au moins 2 segments.', 'error');
      return;
    }

    const totalWeight = this.editedSegments.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0);
    const confirmMsg = `Confirmez-vous la modification de la roue "${wheelName}" ?\n\n`
      + `• Nombre de segments : ${this.editedSegments.length}\n`
      + `• Somme des probabilités : ${totalWeight.toFixed(1)}% (sera normalisée à 100%)\n\n`
      + `⚠️ Les modifications seront appliquées immédiatement pour tous les élèves en jeu.`;

    if (!confirm(confirmMsg)) return;

    try {
      const saveBtn = document.getElementById('adminSaveWheelBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Sauvegarde en cours...';
      }

      const res = await window.API.adminUpdateWheelSegments(this.currentWheelId, this.editedSegments);
      window.UI.showToast(res.message || 'Récompenses de la roue sauvegardées avec succès !', 'success', 5000);

      // Mettre à jour les données locales
      if (res.wheel) {
        const idx = this.wheelsData.findIndex(w => w.id === this.currentWheelId);
        if (idx !== -1) {
          this.wheelsData[idx] = res.wheel;
        }
        this.editedSegments = JSON.parse(JSON.stringify(res.wheel.segments || []));
        this.renderSegmentsTable();
        this.drawAdminWheelPreview();
      }

      // Si le jeu FortuneWheels est instancié sur la page, mettre à jour son cache
      if (window.FortuneWheels && typeof window.FortuneWheels.loadWheelArena === 'function') {
        if (window.FortuneWheels.currentWheelId === this.currentWheelId) {
          window.FortuneWheels.loadWheelArena(this.currentWheelId);
        }
      }
    } catch (err) {
      console.error('Erreur sauvegarde roue:', err);
      window.UI.showToast('Erreur lors de la sauvegarde : ' + err.message, 'error');
    } finally {
      const saveBtn = document.getElementById('adminSaveWheelBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Sauvegarder les Récompenses';
      }
    }
  },

  drawAdminWheelPreview(rotationAngle = 0) {
    const canvas = document.getElementById('adminWheelPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 10;

    const segments = this.editedSegments || [];
    const count = segments.length || 8;
    const segAngle = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);

    // Dessiner chaque secteur
    for (let i = 0; i < count; i++) {
      const seg = segments[i] || { label: 'Coins', color: '#0A2552' };
      const startAngle = i * segAngle;
      const endAngle = (i + 1) * segAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      const isPhysical = seg.type === 'physical';
      ctx.fillStyle = seg.color || (isPhysical ? '#DC2626' : (i % 2 === 0 ? '#0B2252' : '#0F2C69'));
      ctx.fill();

      ctx.strokeStyle = isPhysical ? '#F87171' : 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Contenu du segment (icône + texte)
      ctx.save();
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Icône
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillText(seg.icon || (isPhysical ? '🥤' : '🪙'), radius - 12, 0);

      // Label court
      ctx.font = isPhysical ? 'bold 10px Outfit, sans-serif' : '600 10px Outfit, sans-serif';
      ctx.fillStyle = isPhysical ? '#FFF' : '#FFE27A';
      const labelText = (seg.label || '').length > 13 ? (seg.label || '').substring(0, 11) + '..' : (seg.label || '');
      ctx.fillText(labelText, radius - 34, 0);

      ctx.restore();
    }

    // Bordure extérieure or avec rivets
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#D4AF37';
    ctx.stroke();

    const rivetCount = count * 2;
    for (let j = 0; j < rivetCount; j++) {
      const rivetAngle = (j * 2 * Math.PI) / rivetCount;
      const rx = Math.cos(rivetAngle) * (radius + 2);
      const ry = Math.sin(rivetAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = j % 2 === 0 ? '#FFE27A' : '#FFF';
      ctx.fill();
    }

    // Moyeu central
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#061226';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪐', 0, 0);

    ctx.restore();
  },

  testSpinPreview() {
    if (this.previewSpinning || this.editedSegments.length < 2) return;
    this.previewSpinning = true;

    const testBtn = document.getElementById('adminTestSpinBtn');
    if (testBtn) testBtn.disabled = true;

    const duration = 3800; // 3.8s
    const startTime = performance.now();
    const startAngle = this.previewAngle;
    const fullTurns = 4;
    const randomExtra = Math.random() * 2 * Math.PI;
    const targetAngle = startAngle + (fullTurns * 2 * Math.PI) + randomExtra;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease out quintic
      const ease = 1 - Math.pow(1 - progress, 4.5);
      const currentRotation = startAngle + (targetAngle - startAngle) * ease;
      this.previewAngle = currentRotation % (2 * Math.PI);

      this.drawAdminWheelPreview(currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.previewSpinning = false;
        if (testBtn) testBtn.disabled = false;
      }
    };

    requestAnimationFrame(animate);
  }
};

window.AdminBDE = AdminBDE;
