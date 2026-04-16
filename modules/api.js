const API_URL = 'https://regieessencequebec.ca/stations.geojson.gz';

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return Number.parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export function getPrice(prices, gasType) {
  if (!Array.isArray(prices)) return null;
  const regex = new RegExp(gasType, 'i');
  const entry = prices.find(p => regex.test(p.GasType) && p.IsAvailable);
  if (!entry) return null;
  const num = Number.parseFloat(String(entry.Price).replaceAll(/[^\d.]/g, ''));
  return Number.isNaN(num) ? null : num;
}

export async function fetchGeoJSON() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);
  return await response.json();
}

export function processStations(geojson, lat, lng, radiusKm, maxResults, gasType, brandFilter) {
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

