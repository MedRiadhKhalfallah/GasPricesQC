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
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

// ── Parse prix selon le type d'essence ──────────────
function getPrice(prices, gasType) {
  if (!Array.isArray(prices)) return null;
  const regex = new RegExp(gasType, 'i');
  const entry = prices.find(p => regex.test(p.GasType) && p.IsAvailable);
  if (!entry) return null;
  const num = parseFloat(String(entry.Price).replace(/[^\d.]/g, ''));
  return isNaN(num) ? null : num;
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

    const stationName = s.Name ?? 'Station inconnue';
    const stationBrand = s.brand ?? '—';
    const stationAddress = s.Address ?? '—';
    const stationRegion = s.Region ?? '—';

    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-3';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Station ${stationName} — ${s.price.toFixed(1)}¢/L à ${s.distance_km} km`);
    card.innerHTML = `
      <div class="card-body">
        <div class="card-top d-flex justify-content-between align-items-start">
          <div>
            <span class="rank-badge ${rankClass} me-2 shadow-sm" aria-label="Position numéro ${rank}">${rank}</span>
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
            <div class="price-text" aria-label="Prix : ${s.price.toFixed(1)} cents par litre">${s.price.toFixed(1)}<span class="price-unit"> ¢/L</span></div>
            <div class="text-muted small fw-bold mb-2"><i class="bi bi-car-front" aria-hidden="true"></i> ${s.distance_km} km</div>
            <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary w-100" aria-label="Obtenir l'itinéraire vers ${stationName} sur Google Maps" title="Itinéraire Google Maps vers ${stationName}">
              <i class="bi bi-map" aria-hidden="true"></i> Itinéraire
            </a>
          </div>
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
  return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude), city: data.city };
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

    // Restaurer les filtres dans l'interface
    if (prefs.radius) document.getElementById('radius').value = prefs.radius;
    if (prefs.max) document.getElementById('maxResults').value = prefs.max;
    if (prefs.gasType) document.getElementById('gasType').value = prefs.gasType;
    if (prefs.brand) document.getElementById('brandFilter').value = prefs.brand;

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
  const lat = parseFloat(document.getElementById('manualLat').value);
  const lng = parseFloat(document.getElementById('manualLng').value);

  if (!isNaN(lat) && !isNaN(lng)) {
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

  const radiusKm  = parseFloat(document.getElementById('radius').value) || 10;
  const maxResults = parseInt(document.getElementById('maxResults').value) || 20;
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
      document.title = "Aucun résultat — Prix d'essence Québec";
      updateMetaDescription("Aucune station d'essence trouvée avec ces critères. Modifiez vos filtres ou augmentez le rayon de recherche pour trouver des stations au Québec.");
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

// ── Comparateur Top 3 ─────────────────────────���────────────────
window.updateDiscount = function(index) {
  const dPL = parseFloat(document.getElementById(`discountPerLiter_${index}`).value) || 0;
  const fD = parseFloat(document.getElementById(`fixedDiscount_${index}`).value) || 0;
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
  const container = document.getElementById('comparatorContainer');
  const body = document.getElementById('comparatorBody');
  const capacityInput = document.getElementById('tankCapacity');

  if (!comparatorStations || comparatorStations.length < 2) {
    container.classList.add('d-none');
    return;
  }

  container.classList.remove('d-none');

  const capacity = parseFloat(capacityInput.value) || 25;

  let html = '<div class="row g-3 text-center">';

  // Pre-calculate effective totals to find the best alternative
  const totals = comparatorStations.map((s) => {
    const dPL = s.dPL || 0;
    const fD = s.fD || 0;
    const effectivePrice = Math.max(0, s.price - dPL);
    return Math.max(0, (effectivePrice * capacity / 100) - fD);
  });

  const bestTotal = Math.min(...totals);

  comparatorStations.forEach((s, i) => {
    const total = totals[i];
    const diff = (total - bestTotal).toFixed(2);
    const dPL = s.dPL || 0;
    const fD = s.fD || 0;

    let diffBadge = '';
    if (diff === "0.00") {
      diffBadge = '<span class="badge bg-success">Meilleur prix</span>';
    } else {
      diffBadge = `<span class="badge bg-danger text-white">+ ${diff} $</span>`;
    }

    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
    const rankColor = i < 3 ? rankColors[i] : '#6c757d';

    // Formatting original vs discounted price per liter
    const priceText = dPL > 0
      ? `<del class="text-danger small">${s.price.toFixed(1)}</del> <strong class="text-success">${Math.max(0, s.price - dPL).toFixed(1)}</strong>`
      : s.price.toFixed(1);

    html += `
      <div class="col-12 col-md-4">
        <div class="p-3 border rounded shadow-sm h-100 d-flex flex-column justify-content-between position-relative" style="background-color: #f8f9fa;">
          <button type="button" class="btn-close position-absolute top-0 end-0 m-2" aria-label="Retirer du comparateur" onclick="removeStation(${i})"></button>
          <div>
            <div class="fw-bold mb-2 badge" style="background-color: ${rankColor}; color: ${i === 0 ? '#000' : '#fff'}; font-size: 1rem;">Trio ${i + 1}</div>
            <div class="text-truncate fw-bold mb-1" title="${s.Name}">${s.Name || 'Station inconnue'}</div>
            <div class="small text-muted mb-2">${s.brand || '—'}</div>
          </div>
          <div>
            <div class="fs-4 text-quebec fw-bold mb-1">${total.toFixed(2)}<span class="fs-6 text-muted ms-1">$</span></div>
            <div class="small text-muted mb-3">${priceText} ¢/L</div>
            <div class="mb-3">${diffBadge}</div>
            
            <div class="row g-1 text-start">
              <div class="col-6">
                <label for="discountPerLiter_${i}" class="form-label" style="font-size: 0.70rem; margin-bottom: 2px;"><i class="bi bi-tag-fill"></i> Rabais (¢/L)</label>
                <input type="number" id="discountPerLiter_${i}" class="form-control form-control-sm text-center" value="${dPL}" min="0" step="0.1" oninput="updateDiscount(${i})">
              </div>
              <div class="col-6">
                <label for="fixedDiscount_${i}" class="form-label text-truncate" style="font-size: 0.70rem; margin-bottom: 2px;" title="Prime au plein ($)"><i class="bi bi-cash"></i> Prime ($)</label>
                <input type="number" id="fixedDiscount_${i}" class="form-control form-control-sm text-center" value="${fD}" min="0" step="0.25" oninput="updateDiscount(${i})">
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  body.innerHTML = html;
}

document.getElementById('tankCapacity').addEventListener('input', renderComparator);

// ── Modal Ajout de Station ────���─────────────────────────────────
const addStationModalEl = document.getElementById('addStationModal');
addStationModalEl.addEventListener('show.bs.modal', renderModalList);
document.getElementById('modalBrandFilter').addEventListener('input', renderModalList);

function renderModalList() {
  const filterText = document.getElementById('modalBrandFilter').value.trim().toLowerCase();
  const list = document.getElementById('modalStationsList');
  list.innerHTML = '';

  // On exclut les stations déjà dans le comparateur
  const inComparatorIds = comparatorStations.map(s => s.id || s.Name + s.Address);
  const available = currentStations.filter(s => !inComparatorIds.includes(s.id || s.Name + s.Address));

  const filtered = available.filter(s => {
    if(!filterText) return true;
    return (s.Name || '').toLowerCase().includes(filterText) || (s.brand || '').toLowerCase().includes(filterText);
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="text-muted p-3 text-center">Aucune station disponible à ajouter.</div>';
    return;
  }

  filtered.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-1 rounded border';
    btn.innerHTML = `
      <div>
        <div class="fw-bold">${s.Name || 'Station inconnue'} <span class="badge bg-primary rounded-pill ms-1">${s.brand || '—'}</span></div>
        <div class="small text-muted">${s.Address || '—'} · <i class="bi bi-car-front"></i> ${s.distance_km} km</div>
      </div>
      <div class="text-end">
        <div class="fw-bold text-danger">${s.price.toFixed(1)} ¢/L</div>
      </div>
    `;
    btn.onclick = () => {
      comparatorStations.push({...s, dPL: 0, fD: 0});
      renderComparator();
      const modal = bootstrap.Modal.getInstance(addStationModalEl);
      modal.hide();
    };
    list.appendChild(btn);
  });
}

// Lancer la géolocalisation automatiquement au chargement (qui lancera ensuite search)
initGeolocation();
