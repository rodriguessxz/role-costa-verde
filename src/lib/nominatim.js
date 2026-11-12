// Busca por ÁREA no OpenStreetMap via Nominatim: rápida, gratuita, sem chave e já traz telefone/site/horário quando existem.
// Política de uso: no máximo 1 consulta por segundo e sem varreduras gigantes; aqui são poucas consultas por importação.
import { distanciaKm } from './geo.js';
import { categoriaDasTags, CATEGORIAS, enderecoDasTags } from './osm.js';

const URL_BUSCA = 'https://nominatim.openstreetmap.org/search';
export const LIMITE_NOMINATIM = 40;

/** Caixa = { s, n, w, e } em graus. */

/** Caixa mínima em volta de um ponto (para locais pequenos, como uma praia ou vila). */
export function caixaEmVoltaDe({ lat, lng }, raioKm) {
  const dLat = raioKm / 111;
  const dLng = raioKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, n: lat + dLat, w: lng - dLng, e: lng + dLng };
}

/** Divide a caixa em n×n partes (para passar de 40 resultados por consulta). */
export function dividirCaixa(c, n = 2) {
  const partes = [];
  const dLat = (c.n - c.s) / n;
  const dLng = (c.e - c.w) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) partes.push({ s: c.s + i * dLat, n: c.s + (i + 1) * dLat, w: c.w + j * dLng, e: c.w + (j + 1) * dLng });
  }
  return partes;
}

const area = (c) => Math.max(0, c.n - c.s) * Math.max(0, c.e - c.w);

/** Caixa do Nominatim ([sul, norte, oeste, leste] em texto) → { s, n, w, e }. */
export const caixaDoNominatim = (bb) => (Array.isArray(bb) && bb.length === 4
  ? { s: Number(bb[0]), n: Number(bb[1]), w: Number(bb[2]), e: Number(bb[3]) } : null);

/**
 * Escolhe, entre os resultados de uma busca por nome de lugar, a área administrativa mais plausível:
 * perto do centro de referência (litoral Ubatuba–Paraty) e a maior delas.
 */
export function escolherArea(itens, centroRef, maxKm = 150) {
  const candidatos = (itens || [])
    .filter((i) => ['boundary', 'place'].includes(i.category) || i.addresstype)
    .map((i) => ({ i, caixa: caixaDoNominatim(i.boundingbox), lat: Number(i.lat), lng: Number(i.lon) }))
    .filter((x) => x.caixa && Number.isFinite(x.lat) && distanciaKm(centroRef, { lat: x.lat, lng: x.lng }) <= maxKm);
  candidatos.sort((a, b) => area(b.caixa) - area(a.caixa));
  const c = candidatos[0];
  return c ? { rotulo: String(c.i.name || c.i.display_name || '').split(',')[0], centro: { lat: c.lat, lng: c.lng }, caixa: c.caixa } : null;
}

/** Garante um tamanho mínimo: locais pequenos (uma vila) viram uma caixa de ~`minKm` de raio. */
export function caixaComMinimo(caixa, centro, minKm = 6) {
  const minima = caixaEmVoltaDe(centro, minKm);
  return {
    s: Math.min(caixa.s, minima.s), n: Math.max(caixa.n, minima.n), w: Math.min(caixa.w, minima.w), e: Math.max(caixa.e, minima.e)
  };
}

/** Endereço da consulta de busca dentro de uma caixa. */
export function montarUrlBusca({ q, caixa, limite = LIMITE_NOMINATIM }) {
  const u = new URL(URL_BUSCA);
  u.searchParams.set('q', q);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', String(limite));
  u.searchParams.set('extratags', '1');
  u.searchParams.set('addressdetails', '1');
  u.searchParams.set('accept-language', 'pt-BR');
  u.searchParams.set('countrycodes', 'br');
  if (caixa) {
    u.searchParams.set('viewbox', `${caixa.w},${caixa.n},${caixa.e},${caixa.s}`); // oeste,norte,leste,sul
    u.searchParams.set('bounded', '1');
  }
  return u.toString();
}

const limpaFone = (f) => (f ? String(f).split(/[;,]/)[0].trim() : undefined);

/** Converte um item do Nominatim em "resultado" do app. Null se não tiver nome ou posição. */
export function converterNominatim(item, origem) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  const x = item?.extratags || {};
  const nome = item?.name || item?.namedetails?.name;
  if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tags = { [item.category]: item.type, ...x };
  const cat = categoriaDasTags(tags);
  const info = CATEGORIAS[cat];
  const a = item.address || {};
  const endereco = enderecoDasTags({
    'addr:street': a.road, 'addr:housenumber': a.house_number, 'addr:suburb': a.suburb || a.neighbourhood || a.village || a.hamlet, 'addr:city': a.city || a.town || a.municipality
  });
  const tipoOsm = item.osm_type;
  return {
    osmId: tipoOsm && item.osm_id ? `${tipoOsm}/${item.osm_id}` : undefined,
    nome,
    categoria: cat,
    tipo: info.tipo,
    subtipo: info.subtipo || undefined,
    lat, lng,
    distanciaKm: origem ? distanciaKm(origem, { lat, lng }) : undefined,
    endereco: endereco || undefined,
    telefone: limpaFone(x.phone || x['contact:phone'] || x['contact:mobile'] || x.mobile),
    email: x.email || x['contact:email'] || undefined,
    site: x.website || x['contact:website'] || undefined,
    horario: x.opening_hours || undefined,
    pago: x.fee === 'yes' ? true : x.fee === 'no' ? false : undefined,
    estrutura: [x.toilets === 'yes' && 'banheiro', x.shower === 'yes' && 'chuveiro', x.drinking_water === 'yes' && 'água potável', x.power_supply === 'yes' && 'energia'].filter(Boolean),
    fonteUrl: tipoOsm && item.osm_id ? `https://www.openstreetmap.org/${tipoOsm}/${item.osm_id}` : undefined
  };
}

/** Converte a lista, tira repetidos e (se pedido) filtra pela categoria buscada. */
export function converterListaNominatim(itens, { origem, categoria } = {}) {
  const vistos = new Set();
  return (itens || [])
    .map((i) => converterNominatim(i, origem))
    .filter((r) => r && (!categoria || r.categoria === categoria))
    .filter((r) => !r.osmId || (!vistos.has(r.osmId) && vistos.add(r.osmId)));
}

/* ---------------- rede ---------------- */

let ultima = 0;
async function consultar(url, signal) {
  const espera = ultima + 1100 - Date.now(); // 1 consulta por segundo
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const aoCancelar = () => ctrl.abort();
  signal?.addEventListener('abort', aoCancelar);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`nominatim ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', aoCancelar);
  }
}

/** Acha a área (cidade/região) escrita pela pessoa. Resolve null se não achar. */
export async function localizarArea(nomeLocal, centroRef, { signal } = {}) {
  const itens = await consultar(montarUrlBusca({ q: nomeLocal, limite: 8 }), signal);
  const a = escolherArea(itens, centroRef);
  return a ? { ...a, caixa: caixaComMinimo(a.caixa, a.centro) } : null;
}

/**
 * Busca TUDO que casa com `q` dentro da caixa. Se a primeira consulta lotar (40), divide a área em 4 e repete
 * (no máximo 5 consultas), para cobrir a cidade inteira.
 * @param {(n:number)=>void} [aoAvancar] recebe o total acumulado
 */
export async function buscarNaArea({ q, caixa, categoria, origem, signal, aoAvancar }) {
  const juntar = (brutos) => converterListaNominatim(brutos, { origem, categoria });
  let brutos = await consultar(montarUrlBusca({ q, caixa }), signal);
  let todos = juntar(brutos);
  aoAvancar?.(todos.length);
  if (brutos.length >= LIMITE_NOMINATIM) {
    for (const parte of dividirCaixa(caixa, 2)) {
      try {
        brutos = [...brutos, ...await consultar(montarUrlBusca({ q, caixa: parte }), signal)];
        todos = juntar(brutos);
        aoAvancar?.(todos.length);
      } catch (e) {
        if (signal?.aborted) throw e; // as partes que falharem são só puladas
      }
    }
  }
  return todos;
}
