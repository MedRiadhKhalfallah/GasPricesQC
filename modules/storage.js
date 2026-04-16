import { state } from './state.js';

export function savePreferences(filters) {
  const prefs = {
    lat: state.userLat,
    lng: state.userLng,
    city: state.userCity,
    radius: filters.radiusKm,
    max: filters.maxResults,
    gasType: filters.gasType,
    brand: filters.brandFilter
  };
  localStorage.setItem('gasPreferences', JSON.stringify(prefs));
}

export function loadPreferences() {
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

