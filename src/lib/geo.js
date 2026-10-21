// Utilidades geográficas — funções puras + wrapper de geolocalização.

/** Coordenada válida? (lugares com lat/lng null não vão pro mapa) */
export const temCoord = (l) => Number.isFinite(l?.lat) && Number.isFinite(l?.lng);

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimativa grosseira de deslocamento: estrada serpenteia (×1.6) a ~40 km/h. */
export const minutosDeslocamento = (km) => Math.round(((km * 1.6) / 40) * 60);

export function formatarKm(km) {
  if (!Number.isFinite(km)) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Centro aproximado da região (meio do caminho Ubatuba–Paraty), usado sem GPS. */
export const CENTRO_REGIAO = { lat: -23.33, lng: -44.88 };

/** Pega a posição atual do celular. Resolve null se negado/indisponível. */
export function posicaoAtual({ timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

/** Links de navegação externa */
export const linkGoogleMaps = (l) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
export const linkWaze = (l) => `https://waze.com/ul?ll=${l.lat},${l.lng}&navigate=yes`;
