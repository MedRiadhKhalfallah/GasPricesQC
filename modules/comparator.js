import { state } from './state.js';

export function renderComparator() {
  const bodyMobile   = document.getElementById('comparatorBody');
  const bodyDesktop  = document.getElementById('comparatorBodyDesktop');
  const wrapDesktop  = document.getElementById('comparatorContainerDesktop');
  const capacityInput = document.getElementById('tankCapacity');
  const fab = document.getElementById('fabComparator');
  const fabBadge = document.getElementById('fabBadge');

  if (!state.comparatorStations || state.comparatorStations.length < 2) {
    if (fab) { fab.classList.remove('d-flex'); fab.classList.add('d-none'); }
    if (bodyMobile) bodyMobile.innerHTML = '';
    if (bodyDesktop) bodyDesktop.innerHTML = '';
    if (wrapDesktop) wrapDesktop.classList.remove('d-md-block');
    return;
  }

  if (fab) { fab.classList.remove('d-none'); fab.classList.add('d-flex'); }
  if (fabBadge) fabBadge.textContent = state.comparatorStations.length;
  if (wrapDesktop) wrapDesktop.classList.add('d-md-block');

  const capacity = Number.parseFloat(capacityInput.value) || 25;

  const totals = state.comparatorStations.map(s => {
    const dPL = s.dPL || 0; const fD = s.fD || 0;
    return Math.max(0, (Math.max(0, s.price - dPL) * capacity / 100) - fD);
  });
  const bestTotal = Math.min(...totals);

  const buildDesktopHtml = () => {
    let h = '<div class="row g-3 text-center">';
    const rankColors = ['#ffd700','#c0c0c0','#cd7f32'];
    state.comparatorStations.forEach((s, i) => {
      const total = totals[i];
      const diff = (total - bestTotal).toFixed(2);
      const dPL = s.dPL || 0; const fD = s.fD || 0;
      const rankColor = i < 3 ? rankColors[i] : '#6c757d';
      const priceText = dPL > 0
        ? `<del class="text-danger small">${s.price.toFixed(1)}</del> <strong class="text-success">${Math.max(0, s.price - dPL).toFixed(1)}</strong>`
        : s.price.toFixed(1);
      const diffBadge = diff === "0.00"
        ? '<span class="badge bg-success">Meilleur prix</span>'
        : `<span class="badge bg-danger text-white">+ ${diff} $</span>`;
      h += `
        <div class="col-12 col-md-4">
          <div class="p-3 border rounded shadow-sm h-100 d-flex flex-column justify-content-between position-relative" style="background-color:#f8f9fa;">
            <button type="button" class="btn-close position-absolute top-0 end-0 m-2" aria-label="Retirer" onclick="window.removeStation(${i})"></button>
            <div>
              <div class="fw-bold mb-2 badge" style="background-color:${rankColor};color:${i===0?'#000':'#fff'};font-size:1rem;">Trio ${i+1}</div>
              <div class="text-truncate fw-bold mb-1" title="${s.Name}">${s.Name||'Station inconnue'}</div>
              <div class="small text-muted mb-2">${s.brand||'—'}</div>
            </div>
            <div>
              <div class="fs-4 text-quebec fw-bold mb-1">${total.toFixed(2)}<span class="fs-6 text-muted ms-1">$</span></div>
              <div class="small text-muted mb-3">${priceText} ¢/L</div>
              <div class="mb-3">${diffBadge}</div>
              <div class="row g-1 text-start">
                <div class="col-6">
                  <label for="dpl_d_${i}" class="form-label" style="font-size:.70rem;margin-bottom:2px;"><i class="bi bi-tag-fill"></i> Rabais (¢/L)</label>
                  <input type="number" id="dpl_d_${i}" class="form-control form-control-sm text-center" value="${dPL}" min="0" step="0.1" oninput="window.syncDiscount(${i},'dpl_d_${i}','fpd_d_${i}')">
                </div>
                <div class="col-6">
                  <label for="fpd_d_${i}" class="form-label" style="font-size:.70rem;margin-bottom:2px;"><i class="bi bi-cash"></i> Prime ($)</label>
                  <input type="number" id="fpd_d_${i}" class="form-control form-control-sm text-center" value="${fD}" min="0" step="0.25" oninput="window.syncDiscount(${i},'dpl_d_${i}','fpd_d_${i}')">
                </div>
              </div>
            </div>
          </div>
        </div>`;
    });
    h += '</div>';
    return h;
  };

  const buildMobileHtml = () => {
    let h = '<div class="d-flex flex-column gap-3 pb-3">';
    state.comparatorStations.forEach((s, i) => {
      const total = totals[i];
      const diff = (total - bestTotal).toFixed(2);
      const dPL = s.dPL || 0; const fD = s.fD || 0;
      const priceText = dPL > 0
        ? `<del class="text-danger small">${s.price.toFixed(1)}</del> <strong class="text-success fs-5">${Math.max(0, s.price - dPL).toFixed(1)}</strong>`
        : `<strong class="fs-5">${s.price.toFixed(1)}</strong>`;
      const cardStyle = diff === "0.00"
        ? 'border:2px solid #198754;background-color:#f8fff9;'
        : 'background-color:#fff;border:1px solid #dee2e6;';
      const indicator = diff === "0.00"
        ? '<span class="badge bg-success rounded-pill px-3 py-1 shadow-sm"><i class="bi bi-check-circle-fill me-1"></i> Meilleur choix</span>'
        : `<span class="badge bg-danger rounded-pill px-3 py-1 shadow-sm text-white"><i class="bi bi-arrow-up text-white me-1"></i> +${diff}$</span>`;

      h += `
        <div class="card p-3 shadow-sm rounded-4 position-relative" style="${cardStyle}">
          <button type="button" class="btn-close position-absolute top-0 end-0 m-3" aria-label="Retirer" onclick="window.removeStation(${i})"></button>
          
          <div class="d-flex align-items-center mb-2 pr-4">
            <div class="rounded-circle bg-light text-dark d-flex justify-content-center align-items-center border me-3" style="width: 40px; height: 40px; font-weight: bold; flex-shrink: 0;">${i+1}</div>
            <div class="overflow-hidden">
              <h6 class="fw-bold mb-0 text-truncate text-dark" title="${s.Name}">${s.Name || 'Station'}</h6>
              <div class="small text-muted text-truncate">${s.brand || '—'}</div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-3 p-2 bg-white rounded border">
            <div>
              <div class="text-muted small fw-bold">Prix au litre</div>
              <div>${priceText} <span class="small">¢/L</span></div>
            </div>
            <div class="text-end">
              <div class="text-muted small fw-bold">Total (${capacity}L)</div>
              <div class="text-dark fw-black" style="font-size:1.8rem; line-height:1;">${total.toFixed(2)}<span class="fs-5 text-muted">$</span></div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>${indicator}</div>
          </div>

          <div class="row g-2">
            <div class="col-6">
              <label for="dpl_m_${i}" class="form-label small fw-bold text-muted mb-1"><i class="bi bi-tag-fill text-primary"></i> Rabais</label>
              <div class="input-group input-group-sm">
                <input type="number" id="dpl_m_${i}" class="form-control text-center fw-bold bg-light" value="${dPL}" min="0" step="0.1" oninput="window.syncDiscount(${i},'dpl_m_${i}','fpd_m_${i}')">
                <span class="input-group-text bg-light border-start-0 text-muted">¢</span>
              </div>
            </div>
            <div class="col-6">
              <label for="fpd_m_${i}" class="form-label small fw-bold text-muted mb-1"><i class="bi bi-cash-stack text-success"></i> Prime</label>
              <div class="input-group input-group-sm">
                <span class="input-group-text bg-light border-end-0 text-muted">$</span>
                <input type="number" id="fpd_m_${i}" class="form-control text-center fw-bold bg-light" value="${fD}" min="0" step="0.25" oninput="window.syncDiscount(${i},'dpl_m_${i}','fpd_m_${i}')">
              </div>
            </div>
          </div>
        </div>`;
    });
    h += '</div>';
    return h;
  };

  if (bodyDesktop) bodyDesktop.innerHTML = buildDesktopHtml();
  if (bodyMobile) {
    bodyMobile.innerHTML = buildMobileHtml();
  }
}

export function syncDiscount(index, dplId, fpdId) {
  const dPL = Number.parseFloat(document.getElementById(dplId)?.value) || 0;
  const fD  = Number.parseFloat(document.getElementById(fpdId)?.value) || 0;
  if (state.comparatorStations[index]) {
    state.comparatorStations[index].dPL = Math.max(0, dPL);
    state.comparatorStations[index].fD  = Math.max(0, fD);
  }

  const activeElId = document.activeElement ? document.activeElement.id : null;
  const selectionStart = document.activeElement && document.activeElement.selectionStart ? document.activeElement.selectionStart : null;
  const selectionEnd = document.activeElement && document.activeElement.selectionEnd ? document.activeElement.selectionEnd : null;

  renderComparator();

  if (activeElId) {
    const el = document.getElementById(activeElId);
    if (el) {
      el.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        el.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

export function renderModalStations(filterText = '') {
  const listElement = document.getElementById('modalStationsList');
  if(!listElement) return;
  listElement.innerHTML = '';

  const pattern = new RegExp(filterText, 'i');

  state.currentStations.forEach((s) => {
    if (state.comparatorStations.find(c => c.Name === s.Name && c.distance_km === s.distance_km && c.price === s.price)) {
      return;
    }
    if (filterText && !pattern.test(s.brand || '') && !pattern.test(s.Name || '')) {
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-1 rounded';
    btn.innerHTML = `
      <div>
        <div class="fw-bold">${s.Name || 'Station inconnue'}</div>
        <div class="small text-muted">${s.brand || '—'} · ${s.distance_km} km</div>
      </div>
      <div class="fw-bold text-success">${s.price.toFixed(1)} <span class="small">¢/L</span></div>
    `;
    btn.addEventListener('click', () => {
      state.comparatorStations.push({...s, dPL: 0, fD: 0});
      renderComparator();
      const modalEl = document.getElementById('addStationModal');
      // Optional access to global bootstrap
      if (typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
      }
    });
    listElement.appendChild(btn);
  });

  if (listElement.innerHTML === '') {
    listElement.innerHTML = '<div class="text-center text-muted p-3">Aucune station disponible à ajouter.</div>';
  }
}

