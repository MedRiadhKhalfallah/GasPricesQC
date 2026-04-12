const API_URL = 'https://regieessencequebec.ca/stations.geojson.gz';
let map;
let allStations = []; // Raw GeoJSON features
let markersLayer = L.layerGroup();
let userMarker = null;
let userLat = null;
let userLng = null;

// ── Haversine distance (km) ─────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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

// ── Initialisation de la carte ──────────────────────
function initMap() {
  // Centre initial au Québec
  map = L.map('map').setView([46.8139, -71.2080], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer.addTo(map);

  // Charger les données
  fetchStations();

  // Écouteurs d'événements
  document.getElementById('gasTypeMap').addEventListener('change', renderMarkers);
  document.getElementById('radiusMap').addEventListener('change', renderMarkers);
  document.getElementById('btnGeoMap').addEventListener('click', geolocateAndCenter);

  // Exécuter géolocalisation si le localStorage le permet, sinon centrer
  const prefs = loadPreferences();
  if (prefs && prefs.lat && prefs.lng) {
    centerMapOn(prefs.lat, prefs.lng, 12);
  } else {
    geolocateAndCenter();
  }
}

function loadPreferences() {
  try {
    const data = localStorage.getItem('gasPreferences');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  return null;
}

async function geolocateAndCenter() {
  const btn = document.getElementById('btnGeoMap');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => centerMapOn(pos.coords.latitude, pos.coords.longitude, 13),
        async err => {
            // Fallback API IP
            const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const data = await res.json();
            centerMapOn(Number(data.latitude), Number(data.longitude), 11);
        },
        { timeout: 5000 }
      );
    }
  } catch (e) {
    console.warn("Géolocalisation échouée.");
  } finally {
    btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
  }
}

function centerMapOn(lat, lng, zoomLevel) {
  userLat = lat;
  userLng = lng;
  map.setView([lat, lng], zoomLevel);
  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#0033A0',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map).bindPopup("Votre position");
  } else {
    userMarker.setLatLng([lat, lng]);
  }
  renderMarkers(); // Recalculer les tops 3 du rayon actuel
}

// ── Récupération des données ──────────────────────
async function fetchStations() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    allStations = data.features.filter(f => f.geometry?.coordinates);
    renderMarkers();
  } catch (err) {
    console.error("Erreur chargement GeoJSON", err);
    alert("Erreur de chargement des stations.");
  }
}

// ── Rendu des marqueurs HTML ──────────────────────
function renderMarkers() {
  markersLayer.clearLayers();
  if (!allStations || allStations.length === 0) return;

  const gasType = document.getElementById('gasTypeMap').value;
  const radiusKm = Number.parseFloat(document.getElementById('radiusMap').value) || 10;

  // 1. Filtrer selon le rayon
  const validStations = [];
  allStations.forEach(feature => {
    const price = getPrice(feature.properties.Prices, gasType);
    if (price === null) return;

    const [fLng, fLat] = feature.geometry.coordinates;
    let distance = null;
    if (userLat !== null && userLng !== null) {
      distance = haversine(userLat, userLng, fLat, fLng);
    }

    // Ignorer si on est en dehors du rayon sélectionné
    if (distance !== null && distance > radiusKm) return;

    validStations.push({ feature, price, distance, fLat, fLng });
  });

  // 2. Trier pour identifier les 3 stations les moins chères (Top 3)
  validStations.sort((a, b) => a.price !== b.price ? a.price - b.price : (a.distance && b.distance ? a.distance - b.distance : 0));

  // 3. Rendu sur la carte
  validStations.forEach((s, index) => {
    const name = s.feature.properties.Name || 'Station';
    const displayBrand = (s.feature.properties.brand || '').substring(0, 10); // Tronquer

    // Attribution des classes TOP 3 et changements visuels de couleur
    let rankClass = '';
    if (index === 0) rankClass = 'top-1';      // Vert foncé intense + scale
    else if (index === 1) rankClass = 'top-2'; // Vert menthe + scale
    else if (index === 2) rankClass = 'top-3'; // Bleu turquoise

    const iconHtml = `<div class="gas-price-marker ${rankClass}">${s.price.toFixed(1)}¢ <span class="brand">${displayBrand}</span></div>`;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: '', // Pas de défaut Leaflet
      iconSize: null,
      iconAnchor: [20, 35]
    });

    const popupHtml = `
      <div style="font-family: inherit; text-align: center;">
        ${rankClass ? `<span class="badge bg-success mb-2 w-100">🔥 Top ${index + 1} Moins Cher !</span>` : ''}
        <h6 style="margin: 0; font-weight: bold; color: #0033A0;">${name}</h6>
        <div style="font-size: 0.8rem; color: #6c757d; margin-bottom: 5px;">${s.feature.properties.Address || ''}</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #d32f2f;">${s.price.toFixed(1)} ¢/L <small>(${gasType})</small></div>
        ${s.distance !== null ? `<div style="font-size: 0.85rem; color: #333;"><i class="bi bi-car-front"></i> ${s.distance} km</div>` : ''}
        <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${s.fLat},${s.fLng}" target="_blank" class="btn btn-sm btn-primary w-100 mt-2" style="background-color: #0033A0; border-color: #0033A0;"><i class="bi bi-cursor"></i> Itinéraire</a>
      </div>
    `;

    const marker = L.marker([s.fLat, s.fLng], { icon: customIcon });
    marker.bindPopup(popupHtml);

    markersLayer.addLayer(marker);
  });
}

// Initialiser après DOM
document.addEventListener('DOMContentLoaded', initMap);

