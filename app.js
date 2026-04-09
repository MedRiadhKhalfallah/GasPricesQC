const API_URL = 'https://regieessencequebec.ca/stations.geojson.gz';

// Variables de position
let userLat = null;
let userLng = null;
let userCity = null; // Nom de la ville (API IP)

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

    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-3';
    card.innerHTML = `
      <div class="card-body">
        <div class="card-top d-flex justify-content-between align-items-start">
          <div>
            <span class="rank-badge ${rankClass} me-2 shadow-sm">${rank}</span>
            <span class="fw-bold fs-5">${s.Name ?? 'Station inconnue'}</span>
          </div>
          <span class="badge bg-primary rounded-pill px-3 py-2 shadow-sm">${s.brand ?? '—'}</span>
        </div>
        
        <div class="row align-items-center mt-2">
          <div class="col-md-7 mb-2 mb-md-0">
            <div class="text-muted small"><i class="bi bi-geo-alt"></i> ${s.Address ?? '—'}</div>
            <div class="text-muted small"><i class="bi bi-map"></i> ${s.Region ?? '—'} · ${s.PostalCode ?? ''}</div>
            <div class="mt-2"><span class="badge bg-success text-white">${s.Status ?? ''}</span></div>
          </div>
          
          <div class="col-md-5 text-md-end">
            <div class="price-text">${s.price.toFixed(1)}<span class="price-unit"> ¢/L</span></div>
            <div class="text-muted small fw-bold mb-2"><i class="bi bi-car-front"></i> ${s.distance_km} km</div>
            <button class="btn btn-sm btn-outline-secondary w-100" onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${s.coordinates[1]},${s.coordinates[0]}', '_blank')">
              <i class="bi bi-map"></i> Itinéraire
            </button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
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

// ── Recherche principale ───────────────────────────────────────
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
    } else {
      setStatus('');
      const header = document.getElementById('resultsHeader');
      header.classList.remove('d-none');
      header.textContent =
        `${stations.length} station(s) trouvée(s) · rayon ${radiusKm} km · triées par prix ↑`;
      renderCards(stations);
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

// Lancer la géolocalisation automatiquement au chargement (qui lancera ensuite search)
initGeolocation();
