// Busca de lugares na internet (Photon, geocoder aberto baseado no OpenStreetMap; sem chave).
import { CENTRO_REGIAO, distanciaKm } from './geo.js';
import { CATEGORIAS, categoriaDasTags, planoRapido } from './osm.js';

const URL_BUSCA = 'https://photon.komoot.io/api/';

/** Chuta o tipo do app a partir das tags do OpenStreetMap. Função pura. */
export function tipoDoResultado({ osm_key: k, osm_value: v } = {}) {
  if (v === 'camp_site' || v === 'caravan_site') return 'camping';
  if (v === 'waterfall') return 'cachoeira';
  if (['restaurant', 'cafe', 'fast_food', 'bar'].includes(v)) return 'restaurante';
  if (['hotel', 'hostel', 'guest_house', 'chalet', 'apartment'].includes(v)) return 'hospedagem';
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

/* ---------- Busca rápida por categoria (fallback e complemento do Overpass) ---------- */

const TIPO_OSM = { N: 'node', W: 'way', R: 'relation' };

/** Converte uma feature do Photon no mesmo formato de resultado do Explorar. Pura. */
export function converterFeatureRapida(f, origem) {
  const p = f?.properties || {};
  const [lng, lat] = f?.geometry?.coordinates || [];
  if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cat = categoriaDasTags({ [p.osm_key]: p.osm_value });
  const info = CATEGORIAS[cat];
  const tipoOsm = TIPO_OSM[p.osm_type];
  const rua = [p.street, p.housenumber].filter(Boolean).join(', ');
  return {
    osmId: tipoOsm && p.osm_id ? `${tipoOsm}/${p.osm_id}` : undefined,
    nome: p.name,
    categoria: cat,
    tipo: info.tipo,
    subtipo: info.subtipo,
    lat, lng,
    distanciaKm: origem ? distanciaKm(origem, { lat, lng }) : undefined,
    endereco: [rua, p.district || p.locality, p.city || p.county].filter(Boolean).join(' · ') || undefined,
    fonteUrl: tipoOsm && p.osm_id ? `https://www.openstreetmap.org/${tipoOsm}/${p.osm_id}` : undefined,
    estrutura: [],
    rapida: true // veio da busca rápida: sem telefone, horário ou site
  };
}

/** Caixa (bbox) em volta do ponto, em "minLon,minLat,maxLon,maxLat". Pura. */
export function caixaEmVolta({ lat, lng }, raioKm) {
  const dLat = raioKm / 111;
  const dLng = raioKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join(',');
}

async function consultarRapida({ q, tag }, origem, raioKm, signal) {
  const url = new URL(URL_BUSCA);
  url.searchParams.set('q', q);
  if (tag) url.searchParams.set('osm_tag', tag);
  url.searchParams.set('bbox', caixaEmVolta(origem, raioKm));
  url.searchParams.set('limit', '25');
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`busca ${r.status}`);
  return ((await r.json()).features || []).map((f) => converterFeatureRapida(f, origem)).filter(Boolean);
}

/**
 * Busca rápida por categoria/nome dentro do raio. Lança erro só se TODAS as consultas falharem.
 * Resultados dentro do raio, sem repetidos, do mais perto pro mais longe.
 */
export async function buscaRapida(cats, origem, raioKm, texto, { signal } = {}) {
  const plano = planoRapido(cats, texto);
  const respostas = [];
  for (let i = 0; i < plano.length; i += 3) { // 3 por vez: educado com o serviço gratuito
    const lote = plano.slice(i, i + 3);
    respostas.push(...await Promise.all(lote.map((p) => consultarRapida(p, origem, raioKm, signal).catch((e) => (e.name === 'AbortError' ? Promise.reject(e) : null)))));
  }
  if (respostas.every((r) => r === null)) throw new Error('busca rápida indisponível');
  const vistos = new Set();
  return respostas.flat().filter(Boolean)
    .filter((r) => r.distanciaKm <= raioKm * 1.05 && (!r.osmId || (!vistos.has(r.osmId) && vistos.add(r.osmId))))
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}
