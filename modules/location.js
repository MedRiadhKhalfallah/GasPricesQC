export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée par le navigateur."));
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { timeout: 5000, enableHighAccuracy: true } 
      );
    }
  });
}

export async function getIPLocation() {
  console.log("Appel à l'API geojs.io...");
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
  if (!response.ok) throw new Error("Erreur de l'API IP");
  const data = await response.json();
  console.log("Résultat API IP:", data);
  return { lat: Number.parseFloat(data.latitude), lng: Number.parseFloat(data.longitude), city: data.city };
}

