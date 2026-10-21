// Busca de lugares na internet (Photon, geocoder aberto baseado no OpenStreetMap; sem chave).
import { CENTRO_REGIAO, distanciaKm } from './geo.js';

const URL_BUSCA = 'https://photon.komoot.io/api/';

/** Chuta o tipo do app a partir das tags do OpenStreetMap. Função pura. */
export function tipoDoResultado({ osm_key: k, osm_value: v } = {}) {
  if (v === 'camp_site' || v === 'caravan_site') return 'camping';
  if (v === 'waterfall') return 'cachoeira';
  if (v === 'beach' || v === 'bay' || v === 'cape') return 'praia';
  if (['peak', 'hill', 'viewpoint', 'path', 'footway', 'track', 'trailhead', 'hiking'].includes(v)) return 'trilha';
  if (['supermarket', 'convenience', 'fuel', 'pharmacy', 'bakery', 'marketplace', 'bus_station', 'ferry_terminal', 'atm'].includes(v)) return 'apoio';
  if (k === 'shop') return 'apoio';
  return 'trilha';
}

/** Converte uma feature do Photon no formato do app. Devolve null se não tiver nome/coordenada. */
export function converterResultado(f) {
  const p = f?.properties || {};
  const [lng, lat] = f?.geometry?.coordinates || [];
  if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const detalhe = [p.district || p.locality || p.street, p.city || p.county, p.state].filter(Boolean).join(', ');
  return { nome: p.name, detalhe, lat, lng, tipo: tipoDoResultado(p), id: `${p.osm_type || ''}${p.osm_id || ''}` };
}

/** Resultados da região (até 120 km do litoral Ubatuba–Paraty) vêm antes; ordem original dentro de cada grupo. */
export function priorizarPerto(lista) {
  const perto = (r) => distanciaKm(CENTRO_REGIAO, r) <= 120;
  return [...lista.filter(perto), ...lista.filter((r) => !perto(r))];
}

/** Busca por texto, puxando resultados pra perto de Ubatuba–Paraty. Lança erro se sem rede. */
export async function buscarLugares(q, { limite = 6, signal } = {}) {
  const url = new URL(URL_BUSCA);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limite * 2));
  url.searchParams.set('lat', String(CENTRO_REGIAO.lat));
  url.searchParams.set('lon', String(CENTRO_REGIAO.lng));
  url.searchParams.set('location_bias_scale', '0.6');
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`busca ${r.status}`);
  const j = await r.json();
  return priorizarPerto((j.features || []).map(converterResultado).filter(Boolean)).slice(0, limite);
}
