// Admin BDE Module for Marsabet

const AdminBDE = {
  activeTab: 'claims', // 'claims', 'products', 'orders'

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

    // Scanner / Validation de code
    const claimInput = document.getElementById('adminClaimInput');
    const validateBtn = document.getElementById('adminValidateClaimBtn');
    const checkBtn = document.getElementById('adminCheckClaimBtn');

    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkCode());
    }

    if (validateBtn) {
      validateBtn.addEventListener('click', () => this.validateCode());
    }

    if (claimInput) {
      claimInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.validateCode();
        }
      });
    }

    // Filtres des commandes
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

    // Modal Ajout Produit
    const addProductBtn = document.getElementById('adminAddProductBtn');
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => this.openProductModal());
    }

    const formProduct = document.getElementById('formAdminProduct');
    if (formProduct) {
      formProduct.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    const closeProductModal = document.getElementById('closeAdminProductModal');
    if (closeProductModal) {
      closeProductModal.addEventListener('click', () => {
        const m = document.getElementById('adminProductModal');
        if (m) m.classList.remove('active');
      });
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    const areaClaims = document.getElementById('adminTabClaims');
    const areaProducts = document.getElementById('adminTabProducts');
    const areaOrders = document.getElementById('adminTabOrders');

    if (areaClaims) areaClaims.style.display = (tab === 'claims') ? 'block' : 'none';
    if (areaProducts) areaProducts.style.display = (tab === 'products') ? 'block' : 'none';
    if (areaOrders) areaOrders.style.display = (tab === 'orders') ? 'block' : 'none';

    if (tab === 'products') this.loadProducts();
    if (tab === 'orders') this.loadOrders();
  },

  async checkCode() {
    const input = document.getElementById('adminClaimInput');
    const code = input ? input.value.trim() : '';
    if (!code) {
      window.UI.showToast('Veuillez entrer un code de retrait.', 'error');
      return;
    }

    const resultBox = document.getElementById('claimValidationResult');
    try {
      const data = await window.API.adminCheckCode(code);
      const o = data.order;
      if (resultBox) {
        if (o.status === 'collected') {
          resultBox.className = 'claim-validation-result warning';
          resultBox.innerHTML = `
            <div style="font-size:1.1rem; font-weight:bold; color:var(--lose-red); margin-bottom:0.5rem;">
              ⚠️ ATTENTION : CE CODE A DÉJÀ ÉTÉ RETIRÉ !
            </div>
            <div><strong>Élève :</strong> ${escapeHtml(o.username)}</div>
            <div><strong>Produit :</strong> ${o.icon || '🎁'} ${escapeHtml(o.item_name)}</div>
            <div><strong>Date de retrait :</strong> ${new Date(o.collected_at).toLocaleString('fr-FR')}</div>
            <div style="color:var(--lose-red); font-weight:bold; margin-top:0.5rem;">⛔ NE PAS DONNER LE PRODUIT (doublon).</div>
          `;
        } else {
          resultBox.className = 'claim-validation-result success';
          resultBox.innerHTML = `
            <div style="font-size:1.1rem; font-weight:bold; color:var(--win-green); margin-bottom:0.5rem;">
              ✅ CODE VALIDE — EN ATTENTE DE RETRAIT
            </div>
            <div><strong>Élève :</strong> ${escapeHtml(o.username)}</div>
            <div><strong>Produit à donner :</strong> <span style="font-size:1.2rem;">${o.icon || '🎁'}</span> <strong>${escapeHtml(o.item_name)}</strong></div>
            <div><strong>Coins payés :</strong> ${o.coins_paid.toLocaleString()} 🪙</div>
            <div><strong>Commandé le :</strong> ${new Date(o.created_at).toLocaleString('fr-FR')}</div>
          `;
        }
      }
    } catch (err) {
      if (resultBox) {
        resultBox.className = 'claim-validation-result warning';
        resultBox.innerHTML = `<div style="color:var(--lose-red); font-weight:bold;">❌ ${escapeHtml(err.message)}</div>`;
      }
    }
  },

  async validateCode() {
    const input = document.getElementById('adminClaimInput');
    const code = input ? input.value.trim() : '';
    if (!code) {
      window.UI.showToast('Entre un code de retrait à valider.', 'error');
      return;
    }

    const resultBox = document.getElementById('claimValidationResult');

    try {
      const data = await window.API.adminValidateCode(code);
      window.UI.showToast(data.message, 'success', 5000);
      window.sound.playWin();
      window.UI.triggerConfetti();

      if (resultBox) {
        resultBox.className = 'claim-validation-result success';
        resultBox.innerHTML = `
          <div style="font-size:1.2rem; font-weight:800; color:var(--win-green); margin-bottom:0.5rem;">
            🎉 RETRAIT VALIDÉ AVEC SUCCÈS !
          </div>
          <div style="font-size:1rem; margin-bottom:0.25rem;">
            Remets le produit physique à l'élève : <strong>${data.order.icon || '🎁'} ${escapeHtml(data.order.item_name)}</strong>
          </div>
          <div><strong>Élève :</strong> ${escapeHtml(data.order.username)}</div>
          <div><strong>Code marqué retiré :</strong> <code>${data.order.claim_code}</code></div>
        `;
      }

      if (input) input.value = '';
    } catch (err) {
      window.sound.playLose();
      window.UI.showToast(err.message, 'error', 5000);
      if (resultBox) {
        resultBox.className = 'claim-validation-result warning';
        resultBox.innerHTML = `
          <div style="font-size:1.1rem; font-weight:bold; color:var(--lose-red); margin-bottom:0.5rem;">
            ⛔ ERREUR VALIDATION RETRAIT
          </div>
          <p>${escapeHtml(err.message)}</p>
        `;
      }
    }
  },

  async loadOrders() {
    const listEl = document.getElementById('adminOrdersList');
    if (!listEl) return;

    const status = document.getElementById('adminOrdersStatusFilter')?.value || 'all';
    const search = document.getElementById('adminOrdersSearchInput')?.value || '';

    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Chargement des commandes...</td></tr>';

    try {
      const data = await window.API.adminGetAllOrders(status, search);
      const orders = data.orders || [];

      if (orders.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Aucune commande trouvée.</td></tr>';
        return;
      }

      listEl.innerHTML = orders.map(o => {
        const isCollected = o.status === 'collected';
        return `
          <tr>
            <td><code style="font-family:var(--font-mono); font-weight:bold; color:var(--gold-light);">${o.claim_code}</code></td>
            <td><strong>${escapeHtml(o.username)}</strong></td>
            <td>${o.icon || '🎁'} ${escapeHtml(o.item_name)}</td>
            <td>${o.coins_paid.toLocaleString()} 🪙</td>
            <td>
              <span class="order-status ${isCollected ? 'collected' : 'pending'}">
                ${isCollected ? '✅ Retiré' : '⏳ En attente'}
              </span>
            </td>
            <td style="font-size:0.8rem; color:var(--text-muted);">
              ${isCollected ? 'Retiré le ' + new Date(o.collected_at).toLocaleDateString('fr-FR') : 'Commandé le ' + new Date(o.created_at).toLocaleDateString('fr-FR')}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--lose-red);">Erreur lors du chargement.</td></tr>';
    }
  },

  async loadProducts() {
    const listEl = document.getElementById('adminProductsList');
    if (!listEl) return;
    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Chargement des stocks...</td></tr>';

    try {
      const data = await window.API.adminGetProducts();
      const products = data.products || [];

      listEl.innerHTML = products.map(p => {
        const isLow = p.stock > 0 && p.stock <= 5;
        const isOut = p.stock === 0;
        let badgeClass = 'in-stock';
        let badgeText = `${p.stock} en stock`;
        if (isOut) { badgeClass = 'out-of-stock'; badgeText = '0 (Épuisé)'; }
        else if (isLow) { badgeClass = 'low-stock'; badgeText = `${p.stock} (Faible)`; }

        return `
          <tr style="${!p.is_active ? 'opacity:0.5;' : ''}">
            <td><span style="font-size:1.5rem;">${p.icon}</span></td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td style="color:var(--gold-light); font-weight:bold;">${p.price.toLocaleString()} 🪙</td>
            <td><span class="stock-badge ${badgeClass}">${badgeText}</span></td>
            <td>
              <button class="btn btn-outline btn-quick-stock" data-id="${p.id}" data-change="10" style="padding:2px 8px; font-size:0.75rem;">+10</button>
              <button class="btn btn-outline btn-quick-stock" data-id="${p.id}" data-change="-1" style="padding:2px 8px; font-size:0.75rem;">-1</button>
            </td>
            <td>
              <button class="btn btn-outline btn-edit-product" data-product='${JSON.stringify(p).replace(/'/g, "&#39;")}' style="padding:4px 8px; font-size:0.8rem;">✏️ Modifier</button>
            </td>
          </tr>
        `;
      }).join('');

      // Boutons ajustement rapide de stock
      listEl.querySelectorAll('.btn-quick-stock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const delta = parseInt(e.currentTarget.dataset.change);
          const prod = products.find(x => x.id === id);
          if (prod) {
            const newStock = Math.max(0, prod.stock + delta);
            await window.API.adminUpdateProduct(id, { stock: newStock });
            window.UI.showToast(`Stock de ${prod.name} mis à jour : ${newStock}`, 'success');
            this.loadProducts();
          }
        });
      });

      // Boutons édition complète
      listEl.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const p = JSON.parse(e.currentTarget.dataset.product);
          this.openProductModal(p);
        });
      });
    } catch (err) {
      listEl.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--lose-red);">Erreur produits admin.</td></tr>';
    }
  },

  openProductModal(product = null) {
    const modal = document.getElementById('adminProductModal');
    const title = document.getElementById('adminProductModalTitle');
    const idInput = document.getElementById('adminProdId');
    const nameInput = document.getElementById('adminProdName');
    const catInput = document.getElementById('adminProdCategory');
    const priceInput = document.getElementById('adminProdPrice');
    const stockInput = document.getElementById('adminProdStock');
    const iconInput = document.getElementById('adminProdIcon');
    const descInput = document.getElementById('adminProdDesc');

    if (!modal) return;
    modal.classList.add('active');

    if (product) {
      if (title) title.textContent = '✏️ Modifier le Produit BDE';
      if (idInput) { idInput.value = product.id; idInput.disabled = true; }
      if (nameInput) nameInput.value = product.name;
      if (catInput) catInput.value = product.category;
      if (priceInput) priceInput.value = product.price;
      if (stockInput) stockInput.value = product.stock;
      if (iconInput) iconInput.value = product.icon;
      if (descInput) descInput.value = product.description || '';
    } else {
      if (title) title.textContent = '➕ Ajouter un Produit Physique BDE';
      if (idInput) { idInput.value = ''; idInput.disabled = false; }
      if (nameInput) nameInput.value = '';
      if (catInput) catInput.value = 'boisson';
      if (priceInput) priceInput.value = '5000';
      if (stockInput) stockInput.value = '50';
      if (iconInput) iconInput.value = '🥤';
      if (descInput) descInput.value = '';
    }
  },

  async saveProduct() {
    const idInput = document.getElementById('adminProdId');
    const isEdit = idInput && idInput.disabled;
    const id = idInput ? idInput.value.trim() : '';

    const payload = {
      name: document.getElementById('adminProdName')?.value.trim(),
      category: document.getElementById('adminProdCategory')?.value,
      price: parseInt(document.getElementById('adminProdPrice')?.value),
      stock: parseInt(document.getElementById('adminProdStock')?.value),
      icon: document.getElementById('adminProdIcon')?.value.trim(),
      description: document.getElementById('adminProdDesc')?.value.trim()
    };

    try {
      if (isEdit) {
        await window.API.adminUpdateProduct(id, payload);
        window.UI.showToast('Produit BDE mis à jour !', 'success');
      } else {
        await window.API.adminCreateProduct({ id: id || undefined, ...payload });
        window.UI.showToast('Nouveau produit physique ajouté !', 'success');
      }

      const modal = document.getElementById('adminProductModal');
      if (modal) modal.classList.remove('active');
      this.loadProducts();
    } catch (err) {
      window.UI.showToast(err.message, 'error');
    }
  }
};

window.AdminBDE = AdminBDE;
