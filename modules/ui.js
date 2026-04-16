import { state } from './state.js';

export function setStatus(html) {
  document.getElementById('status').innerHTML = html;
}

export function updateLocationInfo() {
  if (state.userLat !== null && state.userLng !== null) {
    if (state.userCity) {
      document.getElementById('locationInfo').textContent =
        `Position actuelle : ${state.userCity} (${state.userLat.toFixed(5)}°N, ${state.userLng.toFixed(5)}°O)`;
    } else {
      document.getElementById('locationInfo').textContent =
        `Position actuelle : ${state.userLat.toFixed(5)}°N, ${state.userLng.toFixed(5)}°O`;
    }
  } else {
    document.getElementById('locationInfo').textContent =
      "Position inconnue (veuillez vous géolocaliser ou choisir un emplacement).";
  }
}

export function updateMetaDescription(text) {
  let meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute('content', text);
  }
}

export function renderCards(stations) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  stations.forEach((s, i) => {
    const rank = i + 1;
    let rankClass = '';
    if (rank === 1) rankClass = 'top-1';
    else if (rank === 2) rankClass = 'top-2';
    else if (rank === 3) rankClass = 'top-3';

    const isFirst = i === 0;
    const stationName = s.Name ?? 'Station inconnue';
    const stationBrand = s.brand ?? '—';
    const stationAddress = s.Address ?? '—';
    const stationRegion = s.Region ?? '—';

    const card = document.createElement('div');
    card.className = `card shadow-sm mb-3 ${isFirst ? 'border-success' : ''}`;
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <!-- ══ VUE DESKTOP (≥768px) ══ -->
      <div class="d-none d-md-block">
        <div class="card-body">
          <div class="card-top d-flex justify-content-between align-items-start">
            <div>
              <span class="rank-badge ${rankClass} me-2 shadow-sm">
                <span class="visually-hidden">Position numéro </span><span aria-hidden="true">${rank}</span>
              </span>
              <span class="fw-bold fs-5">${stationName}</span>
            </div>
            <span class="badge bg-primary rounded-pill px-3 py-2 shadow-sm">${stationBrand}</span>
          </div>
          <div class="row align-items-center mt-2">
            <div class="col-md-7 mb-2 mb-md-0">
              <div class="text-muted small"><i class="bi bi-geo-alt" aria-hidden="true"></i> ${stationAddress}</div>
              <div class="text-muted small"><i class="bi bi-map" aria-hidden="true"></i> ${stationRegion} · ${s.PostalCode ?? ''}</div>
              <div class="mt-2"><span class="badge bg-success text-white">${s.Status ?? ''}</span></div>
            </div>
            <div class="col-md-5 text-md-end">
              <div class="price-text">
                <span class="visually-hidden">Prix : ${s.price.toFixed(1)} cents par litre</span>
                <span aria-hidden="true">${s.price.toFixed(1)}<span class="price-unit"> ¢/L</span></span>
              </div>
              <div class="text-muted small fw-bold mb-2"><i class="bi bi-car-front" aria-hidden="true"></i> ${s.distance_km} km</div>
              <a href="https://www.google.com/maps/dir/?api=1&origin=${state.userLat},${state.userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary w-100" aria-label="Obtenir l'itinéraire vers ${stationName} sur Google Maps" title="Itinéraire Google Maps vers ${stationName}">
                <i class="bi bi-map" aria-hidden="true"></i> Itinéraire
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ VUE MOBILE (<768px) ══ -->
      <div class="d-block d-md-none">
        <div class="card-body p-4 position-relative">
          ${isFirst ? '<span class="position-absolute top-0 start-50 translate-middle-x badge bg-success rounded-bottom px-4 py-2 shadow-sm" style="font-size:0.85rem;"><i class="bi bi-star-fill text-warning me-1"></i>Moins cher</span>' : ''}
          <div class="d-flex justify-content-between align-items-center mb-3 ${isFirst ? 'mt-3' : ''}">
            <div class="pe-2 overflow-hidden">
              <h3 class="h5 fw-bold mb-1 text-dark text-truncate">${stationName}</h3>
              <span class="badge bg-light text-dark border px-2 py-1">${stationBrand}</span>
            </div>
            <div class="text-end ps-2">
              <div style="font-size:2.5rem;line-height:1;letter-spacing:-1px;font-weight:900;color:#000;">
                ${s.price.toFixed(1)}<span style="font-size:1.1rem;font-weight:700;color:#6c757d;">¢</span>
              </div>
            </div>
          </div>
          <div class="d-flex align-items-center text-muted small mb-4 flex-wrap gap-2">
            <div class="d-flex align-items-center"><i class="bi bi-geo-alt-fill text-secondary me-1"></i><span class="text-truncate" style="max-width:200px;">${stationAddress}</span></div>
            <div class="fw-bold text-dark bg-light px-3 py-1 rounded-pill d-flex align-items-center"><i class="bi bi-car-front-fill text-primary me-1"></i> ${s.distance_km} km</div>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&origin=${state.userLat},${state.userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}"
             target="_blank" rel="noopener noreferrer"
             class="btn btn-primary w-100 fw-bold rounded-pill shadow-sm text-white"
             style="min-height:54px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;background-color:#0033A0;border:none;">
            <i class="bi bi-cursor-fill me-2 fs-5"></i> C'est parti !
          </a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

