// Google Places API (New) — integração OPCIONAL. Só funciona com uma chave que a própria dupla cria no Google Cloud.
// ATENÇÃO CUSTO: a API exige conta de faturamento (cartão), embora o uso dentro da cota mensal gratuita não gere cobrança.
// Por isso o app trava sozinho em LIMITE_MENSAL buscas por aparelho (bem abaixo da cota gratuita).
// Partes puras (pedido, conversão, cota) separadas do fetch para testar.

const URL_BUSCA = 'https://places.googleapis.com/v1/places:searchText';
export const LIMITE_MENSAL = 400;

const CAMPOS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.rating', 'places.userRatingCount',
  'places.nationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri', 'places.regularOpeningHours', 'places.primaryType',
  'places.primaryTypeDisplayName', 'places.types', 'places.businessStatus'
].join(',');

/** Monta o pedido de busca por texto (uma chamada traz até 20 lugares com tudo que precisamos). */
export function montarPedidoPlaces({ consulta, centro, raioM = 20000 }) {
  const corpo = { textQuery: consulta, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 };
  if (centro) corpo.locationBias = { circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius: Math.min(raioM, 50000) } };
  return { url: URL_BUSCA, corpo, campos: CAMPOS };
}

/** Tipo do app a partir dos tipos do Google. */
export function tipoDoApp(types = [], primario = '') {
  const t = new Set([primario, ...types]);
  const tem = (...ks) => ks.some((k) => t.has(k));
  if (tem('campground', 'rv_park', 'camping_cabin')) return 'camping';
  if (tem('lodging', 'hotel', 'guest_house', 'hostel', 'bed_and_breakfast', 'resort_hotel', 'cottage')) return 'hospedagem';
  if (tem('restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'fast_food_restaurant')) return 'restaurante';
  if (tem('supermarket', 'grocery_store', 'convenience_store', 'gas_station', 'pharmacy', 'parking', 'atm')) return 'apoio';
  if (tem('beach')) return 'praia';
  if (tem('hiking_area', 'national_park', 'park', 'tourist_attraction')) return 'trilha';
  return 'camping';
}

/** Converte um "place" da API no formato de resultado do app. Null sem nome/posição. */
export function converterPlace(p) {
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  const nome = p?.displayName?.text;
  if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    googlePlaceId: p.id,
    nome,
    tipo: tipoDoApp(p.types, p.primaryType),
    tipoRotulo: p.primaryTypeDisplayName?.text || '',
    lat, lng,
    endereco: p.formattedAddress || undefined,
    nota: Number.isFinite(p.rating) ? p.rating : undefined,
    avaliacoes: Number.isFinite(p.userRatingCount) ? p.userRatingCount : undefined,
    telefone: p.nationalPhoneNumber || undefined,
    site: p.websiteUri || undefined,
    googleMapsUri: p.googleMapsUri || undefined,
    abertoAgora: typeof p.regularOpeningHours?.openNow === 'boolean' ? p.regularOpeningHours.openNow : undefined,
    horarios: p.regularOpeningHours?.weekdayDescriptions || [],
    situacao: p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? p.businessStatus : undefined
  };
}

export const converterRespostaPlaces = (json) => (json?.places || []).map(converterPlace).filter(Boolean);

/* ---------------- trava de cota (por aparelho, por mês) ---------------- */

const mesDe = (agora) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

/** Uso do mês corrente (zera sozinho quando o mês vira). */
export const usoDoMes = (uso, agora = new Date()) => (uso && uso.mes === mesDe(agora) ? uso : { mes: mesDe(agora), n: 0 });
export const restantes = (uso, agora = new Date(), limite = LIMITE_MENSAL) => Math.max(0, limite - usoDoMes(uso, agora).n);
export const contarUso = (uso, agora = new Date()) => ({ mes: mesDe(agora), n: usoDoMes(uso, agora).n + 1 });

const KEY = 'role:places-uso';
export function lerUso() { try { return usoDoMes(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return usoDoMes(null); } }
function gravarUso(u) { try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* ok */ } }

/** Erro com `.tipo`: 'cota' | 'chave' | 'limite' | 'offline' | 'falha'. */
export class ErroPlaces extends Error { constructor(tipo, msg) { super(msg); this.tipo = tipo; } }

export const MENSAGENS_PLACES = {
  cota: `Você atingiu o limite de ${LIMITE_MENSAL} buscas detalhadas deste mês neste aparelho (trava para nunca gerar cobrança). O mapa do Google continua funcionando.`,
  chave: 'A chave do Google Places não foi aceita ou a “Places API (New)” não está ativada no projeto. Confira em Configurações.',
  limite: 'O Google limitou as buscas por agora. Tente de novo mais tarde.',
  offline: 'Sem internet.',
  falha: 'Não consegui buscar no Google agora.'
};

/** Faz a busca. Conta 1 uso ANTES de chamar (se falhar, não devolve: melhor errar para o lado seguro). */
export async function buscarPlaces({ chave, consulta, centro, raioM, signal }) {
  if (restantes(lerUso()) <= 0) throw new ErroPlaces('cota', 'cota');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErroPlaces('offline', 'offline');
  gravarUso(contarUso(lerUso()));
  const { url, corpo, campos } = montarPedidoPlaces({ consulta, centro, raioM });
  let r;
  try {
    r = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': campos }, body: JSON.stringify(corpo) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ErroPlaces('falha', e.message);
  }
  if (r.status === 429) throw new ErroPlaces('limite', 'limite');
  if ([400, 401, 403].includes(r.status)) throw new ErroPlaces('chave', `erro ${r.status}`);
  if (!r.ok) throw new ErroPlaces('falha', `erro ${r.status}`);
  return converterRespostaPlaces(await r.json());
}
