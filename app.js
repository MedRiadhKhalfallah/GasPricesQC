const API_URL = 'https://regieessencequebec.ca/stations.geojson.gz';

// Variables de position
let userLat = null;
let userLng = null;
let userCity = null; // Nom de la ville (API IP)

let currentStations = []; // Stockage global pour le comparateur
let comparatorStations = []; // Stations actuellement dans le comparateur

// ── Haversine distance (km) ─────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return Number.parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

// ── Parse prix selon le type d'essence ──────────────
function getPrice(prices, gasType) {
  if (!Array.isArray(prices)) return null;
  const regex = new RegExp(gasType, 'i');
  const entry = prices.find(p => regex.test(p.GasType) && p.IsAvailable);
  if (!entry) return null;
  const num = Number.parseFloat(String(entry.Price).replaceAll(/[^\d.]/g, ''));
  return Number.isNaN(num) ? null : num;
}

// ── Fetch + décompresse le GeoJSON .gz ─────────────────────────
async function fetchGeoJSON() {
  const response = await fetch(API_URL);
  console.log(response)
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);

  // Le navigateur décompresse souvent automatiquement le GZIP si les en-têtes sont corrects.
  // On tente de lire directement en JSON. Si cela échoue et qu'on doit vraiment décompresser manuellement,
  // on devra le faire, mais l'erreur "incorrect header check" indique que les données sont déjà décompressées.
  return await response.json();
}

// ── Filtre, enrichit et trie les stations ──────────────────────
function processStations(geojson, lat, lng, radiusKm, maxResults, gasType, brandFilter) {
  return geojson.features
    .filter(f => f.geometry?.coordinates)
    .map(feature => {
      const [fLng, fLat] = feature.geometry.coordinates;
      const distance_km = haversine(lat, lng, fLat, fLng);
      const price = getPrice(feature.properties.Prices, gasType);
      return { ...feature.properties, price, distance_km, coordinates: [fLng, fLat] };
    })
    .filter(s => {
      if (s.price === null || s.distance_km > radiusKm) return false;
      if (brandFilter) {
        const pattern = new RegExp(brandFilter, 'i');
        if (!pattern.test(s.brand || '') && !pattern.test(s.Name || '')) return false;
      }
      return true;
    })
    .sort((a, b) =>
      a.price !== b.price
        ? a.price - b.price
        : a.distance_km - b.distance_km
    )
    .slice(0, maxResults);
}

// ── Rendu des cartes ───────────────────────────────────────────
function renderCards(stations) {
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
              <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary w-100" aria-label="Obtenir l'itinéraire vers ${stationName} sur Google Maps" title="Itinéraire Google Maps vers ${stationName}">
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
          <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}"
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

// ── SEO : Mise à jour dynamique de la meta description ──────────
function updateMetaDescription(text) {
  let meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute('content', text);
  }
}

// ── UI helpers ─────────────────────────────────────────────────
function setStatus(html) {
  document.getElementById('status').innerHTML = html;
}

function updateLocationInfo() {
  if (userLat !== null && userLng !== null) {
    if (userCity) {
      document.getElementById('locationInfo').textContent =
        `Position actuelle : ${userCity} (${userLat.toFixed(5)}°N, ${userLng.toFixed(5)}°O)`;
    } else {
      document.getElementById('locationInfo').textContent =
        `Position actuelle : ${userLat.toFixed(5)}°N, ${userLng.toFixed(5)}°O`;
    }
  } else {
    document.getElementById('locationInfo').textContent =
      "Position inconnue (veuillez vous géolocaliser ou choisir un emplacement).";
  }
}

// ── Gestion du LocalStorage ──────────────────────────────────────
function savePreferences(filters) {
  const prefs = {
    lat: userLat,
    lng: userLng,
    city: userCity,
    radius: filters.radiusKm,
    max: filters.maxResults,
    gasType: filters.gasType,
    brand: filters.brandFilter
  };
  localStorage.setItem('gasPreferences', JSON.stringify(prefs));
}

function loadPreferences() {
  try {
    const data = localStorage.getItem('gasPreferences');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Erreur lors de la lecture du LocalStorage", e);
  }
  return null;
}

// ── Outils de Géolocalisation (Navigateur + API IP Fallback) ────────────────
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée par le navigateur."));
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { timeout: 5000, enableHighAccuracy: true } // Timeout bas (5s) pour passer vite au fallback si l'utilisateur ignore la demande
      );
    }
  });
}

async function getIPLocation() {
  console.log("Appel à l'API geojs.io...");
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
  if (!response.ok) throw new Error("Erreur de l'API IP");
  const data = await response.json();
  console.log("Résultat API IP:", data);
  return { lat: Number.parseFloat(data.latitude), lng: Number.parseFloat(data.longitude), city: data.city };
}

// ── Geolocation Automatique au Démarrage ──────────────────────────────────────
async function initGeolocation() {
  setStatus('<div class="spinner-border text-primary" role="status"></div> <div class="mt-2 text-muted">Recherche de votre position...</div>');

  // Vérifier d'abord les préférences sauvegardées
  const prefs = loadPreferences();
  if (prefs && prefs.lat !== null && prefs.lng !== null) {
    console.log("Préférences trouvées dans le LocalStorage", prefs);
    userLat = prefs.lat;
    userLng = prefs.lng;
    userCity = prefs.city;

    // Restaurer les filtres dans l'interface (desktop)
    if (prefs.radius) document.getElementById('radius').value = prefs.radius;
    if (prefs.max) document.getElementById('maxResults').value = prefs.max;
    if (prefs.gasType) document.getElementById('gasType').value = prefs.gasType;
    if (prefs.brand) document.getElementById('brandFilter').value = prefs.brand;

    // Synchroniser les filtres desktop vers mobile
    syncDesktopToMob();

    updateLocationInfo();
    setStatus('<div class="alert alert-success py-2">✅ Position et filtres restaurés !</div>');
    search();
    return;
  }

  try {
    // 1. Appel DIRECT a l'API IP car la géoloc navigateur est souvent bloquée/lente en développement local
    const ipPos = await getIPLocation();
    userLat = ipPos.lat;
    userLng = ipPos.lng;
    userCity = ipPos.city;
    updateLocationInfo();
    setStatus('<div class="alert alert-info">Position trouvée via votre adresse IP.</div>');
    search();
  } catch (ipErr) {
    console.warn("Échec géolocalisation par IP...", ipErr);
    try {
      // 2. Fallback au GPS du navigateur si l'IP a échoué (très rare)
      const pos = await getUserLocation();
      userLat = pos.lat;
      userLng = pos.lng;
      userCity = null; // Pas de nom de ville direct avec le navigateur
      updateLocationInfo();
      search();
    } catch (err) {
      console.warn("Échec géolocalisation navigateur...", err);
      // 3. Dernier recours : Centre-ville de Montréal
      userLat = 45.5017;
      userLng = -73.5673;
      userCity = "Montréal (Défaut)";
      updateLocationInfo();
      setStatus('<div class="alert alert-warning">Localisation introuvable. Affichage de Montréal par défaut. Utilisez le bouton "Changer d\'emplacement".</div>');
      search();
    }
  }
}

// ── Geolocation Manuel (Bouton dans Modal) ───────────────────────────────────
document.getElementById('btnGeo').addEventListener('click', async () => {
  const btn = document.getElementById('btnGeo');
  const initialHtml = btn.innerHTML;

  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Recherche en cours...';
  btn.disabled = true;

  try {
    let pos;
    try {
      // Pour le bouton manuel (action explicite de l'utilisateur), on tente le "vrai" GPS d'abord...
      pos = await getUserLocation();
      userCity = null; // réinitialiser la ville si on bascule sur les coordonnées "pures" du GPS
    } catch (err) {
      console.warn("Navigateur bloqué, passage à l'IP...");
      // ... et on se rabat sur l'IP s'il a refusé.
      pos = await getIPLocation();
      userCity = pos.city;
    }

    document.getElementById('manualLat').value = pos.lat.toFixed(6);
    document.getElementById('manualLng').value = pos.lng.toFixed(6);
    document.getElementById('citySelect').value = ""; // Reset city

    if (map && marker) {
      map.setView([pos.lat, pos.lng], 12);
      marker.setLatLng([pos.lat, pos.lng]);
    }
  } catch (finalErr) {
    alert("Impossible d'obtenir la position (Navigateur bloqué et API IP indisponible).");
  } finally {
    btn.innerHTML = initialHtml;
    btn.disabled = false;
  }
});

// ── Gestion du Modal d'emplacement & de la carte (Leaflet) ───────────────────
let map, marker;

const locationModalEl = document.getElementById('locationModal');
locationModalEl.addEventListener('shown.bs.modal', () => {
  // S'assurer qu'on a au moins une coordonnée à afficher dans la modal
  const startLat = userLat || 45.5017;
  const startLng = userLng || -73.5673;

  if (!map) {
    map = L.map('map').setView([startLat, startLng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    marker = L.marker([startLat, startLng]).addTo(map);

    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      document.getElementById('manualLat').value = lat.toFixed(6);
      document.getElementById('manualLng').value = lng.toFixed(6);
      marker.setLatLng([lat, lng]);
      document.getElementById('citySelect').value = ""; // Reset city
    });
  } else {
    map.invalidateSize();
    map.setView([startLat, startLng], 12);
    marker.setLatLng([startLat, startLng]);
  }
  document.getElementById('manualLat').value = startLat.toFixed(6);
  document.getElementById('manualLng').value = startLng.toFixed(6);
});

document.getElementById('citySelect').addEventListener('change', (e) => {
  const val = e.target.value;
  if (val) {
    const [lat, lng] = val.split(',').map(Number);
    document.getElementById('manualLat').value = lat.toFixed(6);
    document.getElementById('manualLng').value = lng.toFixed(6);

    // Mettre à jour le nom de la ville sélectionnée manuellement
    userCity = e.target.options[e.target.selectedIndex].text;

    if (map && marker) {
      map.setView([lat, lng], 11);
      marker.setLatLng([lat, lng]);
    }
  }
});

document.getElementById('btnSaveLocation').addEventListener('click', () => {
  const lat = Number.parseFloat(document.getElementById('manualLat').value);
  const lng = Number.parseFloat(document.getElementById('manualLng').value);

  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    userLat = lat;
    userLng = lng;

    // Si l'utilisateur a cliqué librement sur la carte sans passer par CitySelect
    if (document.getElementById('citySelect').value === "") {
        userCity = null;
    }

    updateLocationInfo();

    // Fermer la modal Bootstrap (nécessite l'instance Modal)
    const modalEl = document.getElementById('locationModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();

    // Relancer la recherche immédiatement avec la nouvelle position
    setStatus('<div class="alert alert-success py-2">✅ Nouvel emplacement défini !</div>');
    search();
  }
});

// ── Recherche principale ────────────────────────────────��──────
document.getElementById('btnSearch').addEventListener('click', search);

async function search() {
  if (userLat === null || userLng === null) {
    setStatus('<div class="alert alert-warning">Veuillez d\'abord choisir un emplacement ou autoriser la géolocalisation.</div>');
    return;
  }

  const radiusKm  = Number.parseFloat(document.getElementById('radius').value) || 10;
  const maxResults = Number.parseInt(document.getElementById('maxResults').value) || 20;
  const gasType = document.getElementById('gasType').value || 'Régulier';
  const brandFilter = document.getElementById('brandFilter').value.trim();
  const btn = document.getElementById('btnSearch');

  // Sauvegarder les choix dans le localStorage à chaque recherche
  savePreferences({ radiusKm, maxResults, gasType, brandFilter });

  btn.disabled = true;
  document.getElementById('grid').innerHTML = '';
  document.getElementById('resultsHeader').classList.add('d-none');
  setStatus('<div class="spinner-border text-danger" role="status"></div> <div class="mt-2 text-muted">Chargement des données…</div>');

  try {
    const geojson = await fetchGeoJSON();
    setStatus('<div class="spinner-border text-danger" role="status"></div> <div class="mt-2 text-muted">Traitement des stations…</div>');

    const stations = processStations(geojson, userLat, userLng, radiusKm, maxResults, gasType, brandFilter);

    if (stations.length === 0) {
      setStatus(`<div class="alert alert-warning">Aucune station trouvée avec ces critères.</div>`);
      document.title = "Recherche de prix d'essence au Québec — Comparateur gratuit";
      updateMetaDescription("Trouvez les prix d'essence les moins chers (Régulier, Super, Diesel) au Québec. Utilisez notre comparateur interactif pour explorer les stations et économiser sur votre plein.");
    } else {
      setStatus('');
      const header = document.getElementById('resultsHeader');
      header.classList.remove('d-none');
      header.textContent =
        `${stations.length} station(s) trouvée(s) · rayon ${radiusKm} km · triées par prix ↑`;

      currentStations = stations;
      // On réinitialise le comparateur avec le top 3 par défaut, et on nettoie les rabais
      comparatorStations = stations.slice(0, 3).map(s => ({...s, dPL: 0, fD: 0}));
      renderComparator();
      renderCards(stations);

      // SEO : mise à jour dynamique du titre de la page et de la meta description
      const locationLabel = userCity || 'votre position';
      document.title = `${gasType} dès ${stations[0].price.toFixed(1)}¢/L près de ${locationLabel} — Prix d'essence Québec`;
      updateMetaDescription(`${stations.length} stations d'essence trouvées près de ${locationLabel}. Meilleur prix ${gasType} : ${stations[0].price.toFixed(1)}¢/L. Comparez les prix en temps réel au Québec.`);
    }
  } catch (err) {
    console.error(err);
    setStatus(`
      <div class="alert alert-danger text-start">
        <strong>Erreur :</strong> ${err.message}<br><br>
        <small>Si l'erreur est liée au CORS, ouvrez le fichier via un serveur local :<br>
        <code>npx serve .</code> ou <code>python -m http.server 8080</code></small>
      </div>
    `);
  } finally {
    btn.disabled = false;
  }
}

// ── Comparateur Top 3 ─────────────────────────────────────────
window.updateDiscount = function(index) {
  const dPL = Number.parseFloat(document.getElementById(`discountPerLiter_${index}`).value) || 0;
  const fD = Number.parseFloat(document.getElementById(`fixedDiscount_${index}`).value) || 0;
  if(comparatorStations[index]) {
    comparatorStations[index].dPL = Math.max(0, dPL);
    comparatorStations[index].fD = Math.max(0, fD);
  }
  renderComparator();
};

window.removeStation = function(index) {
  comparatorStations.splice(index, 1);
  renderComparator();
};

function renderComparator() {
  const bodyMobile   = document.getElementById('comparatorBody');
  const bodyDesktop  = document.getElementById('comparatorBodyDesktop');
  const wrapDesktop  = document.getElementById('comparatorContainerDesktop');
  const capacityInput = document.getElementById('tankCapacity');
  const fab = document.getElementById('fabComparator');
  const fabBadge = document.getElementById('fabBadge');

  if (!comparatorStations || comparatorStations.length < 2) {
    if (fab) { fab.classList.remove('d-flex'); fab.classList.add('d-none'); }
    if (bodyMobile) bodyMobile.innerHTML = '';
    if (bodyDesktop) bodyDesktop.innerHTML = '';
    // Cacher le wrapper desktop PARTOUT : retirer d-md-block, garder d-none
    if (wrapDesktop) wrapDesktop.classList.remove('d-md-block');
    return;
  }

  // FAB uniquement visible sur mobile (d-md-none reste, on enlève juste d-none)
  if (fab) { fab.classList.remove('d-none'); fab.classList.add('d-flex'); }
  if (fabBadge) fabBadge.textContent = comparatorStations.length;
  // Montrer le wrapper desktop UNIQUEMENT sur desktop (d-none reste pour mobile)
  if (wrapDesktop) wrapDesktop.classList.add('d-md-block');

  const capacity = Number.parseFloat(capacityInput.value) || 25;

  const totals = comparatorStations.map(s => {
    const dPL = s.dPL || 0; const fD = s.fD || 0;
    return Math.max(0, (Math.max(0, s.price - dPL) * capacity / 100) - fD);
  });
  const bestTotal = Math.min(...totals);

  // ── HTML commun (utilisé pour les deux conteneurs) ──
  const buildDesktopHtml = () => {
    let h = '<div class="row g-3 text-center">';
    const rankColors = ['#ffd700','#c0c0c0','#cd7f32'];
    comparatorStations.forEach((s, i) => {
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
            <button type="button" class="btn-close position-absolute top-0 end-0 m-2" aria-label="Retirer" onclick="removeStation(${i})"></button>
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
                  <input type="number" id="dpl_d_${i}" class="form-control form-control-sm text-center" value="${dPL}" min="0" step="0.1" oninput="syncDiscount(${i},'dpl_d_${i}','fpd_d_${i}')">
                </div>
                <div class="col-6">
                  <label for="fpd_d_${i}" class="form-label" style="font-size:.70rem;margin-bottom:2px;"><i class="bi bi-cash"></i> Prime ($)</label>
                  <input type="number" id="fpd_d_${i}" class="form-control form-control-sm text-center" value="${fD}" min="0" step="0.25" oninput="syncDiscount(${i},'dpl_d_${i}','fpd_d_${i}')">
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
    comparatorStations.forEach((s, i) => {
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
          <button type="button" class="btn-close position-absolute top-0 end-0 m-3" aria-label="Retirer" onclick="removeStation(${i})"></button>
          
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
                <input type="number" id="dpl_m_${i}" class="form-control text-center fw-bold bg-light" value="${dPL}" min="0" step="0.1" oninput="syncDiscount(${i},'dpl_m_${i}','fpd_m_${i}')">
                <span class="input-group-text bg-light border-start-0 text-muted">¢</span>
              </div>
            </div>
            <div class="col-6">
              <label for="fpd_m_${i}" class="form-label small fw-bold text-muted mb-1"><i class="bi bi-cash-stack text-success"></i> Prime</label>
              <div class="input-group input-group-sm">
                <span class="input-group-text bg-light border-end-0 text-muted">$</span>
                <input type="number" id="fpd_m_${i}" class="form-control text-center fw-bold bg-light" value="${fD}" min="0" step="0.25" oninput="syncDiscount(${i},'dpl_m_${i}','fpd_m_${i}')">
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

// Synchronise les deux instances de champs (desktop + mobile) simultanément
window.syncDiscount = function(index, dplId, fpdId) {
  const dPL = Number.parseFloat(document.getElementById(dplId)?.value) || 0;
  const fD  = Number.parseFloat(document.getElementById(fpdId)?.value) || 0;
  if (comparatorStations[index]) {
    comparatorStations[index].dPL = Math.max(0, dPL);
    comparatorStations[index].fD  = Math.max(0, fD);
  }

  // Get active element to restore focus
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
};

// ── Ajout de stations dans le comparateur (Modal) ────────────────
function renderModalStations(filterText = '') {
  const listElement = document.getElementById('modalStationsList');
  if(!listElement) return;
  listElement.innerHTML = '';
  
  const pattern = new RegExp(filterText, 'i');
  
  currentStations.forEach((s) => {
    // Ne pas afficher si déjà dans le comparateur
    if (comparatorStations.find(c => c.Name === s.Name && c.distance_km === s.distance_km && c.price === s.price)) {
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
      comparatorStations.push({...s, dPL: 0, fD: 0});
      renderComparator();
      const modalEl = document.getElementById('addStationModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if(modal) modal.hide();
    });
    listElement.appendChild(btn);
  });
  
  if (listElement.innerHTML === '') {
    listElement.innerHTML = '<div class="text-center text-muted p-3">Aucune station disponible à ajouter.</div>';
  }
}

const addStationModalEl = document.getElementById('addStationModal');
if (addStationModalEl) {
  addStationModalEl.addEventListener('show.bs.modal', () => {
    const filterInput = document.getElementById('modalBrandFilter');
    if(filterInput) filterInput.value = '';
    renderModalStations();
  });
}

const modalBrandFilterEl = document.getElementById('modalBrandFilter');
if (modalBrandFilterEl) {
  modalBrandFilterEl.addEventListener('input', (e) => {
    renderModalStations(e.target.value);
  });
}

// Compat anciens appels depuis oninput legacy
window.updateDiscount = function() { renderComparator(); };

document.getElementById('tankCapacity').addEventListener('input', renderComparator);
if(document.getElementById('tankCapacityMob')) document.getElementById('tankCapacityMob').addEventListener('input', () => {
  document.getElementById('tankCapacity').value = document.getElementById('tankCapacityMob').value;
  renderComparator();
});

// ── Synchronisation filtres mobile ↔ desktop ───────────────────
function syncMobToDesktop() {
  const pairs = [
    ['gasTypeMob',    'gasType'],
    ['radiusMob',     'radius'],
    ['brandFilterMob','brandFilter'],
    ['maxResultsMob', 'maxResults'],
  ];
  pairs.forEach(([mobId, deskId]) => {
    const mob  = document.getElementById(mobId);
    const desk = document.getElementById(deskId);
    if (mob && desk) desk.value = mob.value;
  });
}

function syncDesktopToMob() {
  const pairs = [
    ['gasType',    'gasTypeMob'],
    ['radius',     'radiusMob'],
    ['brandFilter','brandFilterMob'],
    ['maxResults', 'maxResultsMob'],
  ];
  pairs.forEach(([deskId, mobId]) => {
    const mob  = document.getElementById(mobId);
    const desk = document.getElementById(deskId);
    if (mob && desk) mob.value = desk.value;
  });
}

let filterDebounceTimer;

['gasTypeMob', 'radiusMob', 'brandFilterMob', 'maxResultsMob'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      syncMobToDesktop();
      clearTimeout(filterDebounceTimer);
      filterDebounceTimer = setTimeout(search, 300);
    });
    el.addEventListener('input', () => {
      syncMobToDesktop();
      clearTimeout(filterDebounceTimer);
      filterDebounceTimer = setTimeout(search, 500);
    });
  }
});

['gasType', 'radius', 'brandFilter', 'maxResults'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', syncDesktopToMob);
  if (el) el.addEventListener('input', syncDesktopToMob);
});

// Touche Entrée sur les champs texte/nombre desktop et mobile → lancer la recherche
['brandFilter', 'radius', 'maxResults', 'brandFilterMob', 'radiusMob', 'maxResultsMob'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncMobToDesktop();
        clearTimeout(filterDebounceTimer);
        search();
      }
    });
  }
});


// Lancer la géolocalisation automatiquement au chargement (qui lancera ensuite search)
initGeolocation();
