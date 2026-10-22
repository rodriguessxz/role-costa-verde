// Explorar lugares próximos com dados REAIS do OpenStreetMap (API Overpass, grátis e sem chave).
// Aqui só tem lógica pura: montar a consulta e converter a resposta. O fetch fica em explorar.js.
import { distanciaKm } from './geo.js';

/**
 * Categorias do Explorar → filtros OSM (Overpass) e como viram tipo/subtipo no app.
 * `rapida`: consultas da busca rápida (Photon), que filtra por tag OSM mas precisa de um termo de nome.
 */
export const CATEGORIAS = {
  praia: { rotulo: 'Praias', emoji: '🏖️', tipo: 'praia', filtros: ['["natural"="beach"]'], rapida: [{ q: 'praia', tag: 'natural:beach' }] },
  cachoeira: { rotulo: 'Cachoeiras', emoji: '💦', tipo: 'cachoeira', filtros: ['["waterway"="waterfall"]'], rapida: [{ q: 'cachoeira', tag: 'waterway:waterfall' }] },
  trilha: {
    rotulo: 'Trilhas', emoji: '🥾', tipo: 'trilha',
    filtros: ['["route"="hiking"]', '["highway"="trailhead"]', '["natural"="peak"]', '["tourism"="viewpoint"]'],
    rapida: [{ q: 'trilha', tag: 'highway:trailhead' }, { q: 'pico', tag: 'natural:peak' }, { q: 'mirante', tag: 'tourism:viewpoint' }]
  },
  camping: { rotulo: 'Campings', emoji: '⛺', tipo: 'camping', filtros: ['["tourism"~"^(camp_site|caravan_site)$"]'], rapida: [{ q: 'camping', tag: 'tourism:camp_site' }] },
  hospedagem: {
    rotulo: 'Hospedagem', emoji: '🏠', tipo: 'hospedagem', filtros: ['["tourism"~"^(hotel|hostel|guest_house|chalet|apartment)$"]'],
    rapida: [{ q: 'pousada', tag: 'tourism:guest_house' }, { q: 'hotel', tag: 'tourism:hotel' }]
  },
  restaurante: { rotulo: 'Comer', emoji: '🍽️', tipo: 'restaurante', filtros: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'], rapida: [{ q: 'restaurante', tag: 'amenity:restaurant' }] },
  mercado: { rotulo: 'Mercados', emoji: '🛒', tipo: 'apoio', subtipo: 'mercado', filtros: ['["shop"~"^(supermarket|convenience|bakery|greengrocer)$"]'], rapida: [{ q: 'mercado', tag: 'shop:supermarket' }] },
  posto: { rotulo: 'Postos', emoji: '⛽', tipo: 'apoio', subtipo: 'posto', filtros: ['["amenity"="fuel"]'], rapida: [{ q: 'posto', tag: 'amenity:fuel' }] },
  estacionamento: { rotulo: 'Estacionar', emoji: '🅿️', tipo: 'apoio', subtipo: 'estacionamento', filtros: ['["amenity"="parking"]'], rapida: [{ q: 'estacionamento', tag: 'amenity:parking' }] },
  servico: { rotulo: 'Serviços', emoji: '💊', tipo: 'apoio', subtipo: 'servico', filtros: ['["amenity"~"^(pharmacy|hospital|clinic|atm)$"]'], rapida: [{ q: 'farmácia', tag: 'amenity:pharmacy' }] }
};

/** Categorias consultadas na busca rápida quando o usuário não escolheu nenhuma ("Tudo"). */
export const CATEGORIAS_PRINCIPAIS = ['praia', 'cachoeira', 'trilha', 'camping', 'hospedagem', 'restaurante', 'mercado', 'posto'];

/**
 * Plano da busca rápida (Photon): lista de { q, tag? }. Pura.
 * - com texto e sem categoria: uma consulta só, pelo nome;
 * - com categoria: o texto (ou o termo da categoria) filtrado pela tag OSM;
 * - "Tudo" sem texto: uma consulta por categoria principal (só a primeira variante, pra não exagerar).
 */
export function planoRapido(cats, texto = '') {
  const t = texto.trim();
  if (!cats.length) return t ? [{ q: t }] : CATEGORIAS_PRINCIPAIS.map((c) => CATEGORIAS[c].rapida[0]);
  return cats.flatMap((c) => CATEGORIAS[c].rapida.map((r) => (t ? { q: t, tag: r.tag } : r)));
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');

/**
 * Monta a consulta Overpass.
 * @param {string[]} cats chaves de CATEGORIAS (vazio = todas)
 * @param {{lat:number,lng:number}} centro
 * @param {number} raioM raio em metros
 * @param {string} [nome] filtra por parte do nome
 */
export function montarConsulta(cats, centro, raioM, nome = '') {
  const chaves = cats.length ? cats : Object.keys(CATEGORIAS);
  const around = `(around:${Math.round(raioM)},${centro.lat},${centro.lng})`;
  const filtroNome = nome.trim() ? `["name"~"${escaparRegex(nome.trim())}",i]` : '';
  const linhas = chaves.flatMap((c) => CATEGORIAS[c].filtros.map((f) => `nwr${f}${filtroNome}${around};`));
  return `[out:json][timeout:25];(${linhas.join('')});out center tags 120;`;
}

/** Qual categoria do Explorar descreve essas tags OSM? */
export function categoriaDasTags(t = {}) {
  if (t.natural === 'beach') return 'praia';
  if (t.waterway === 'waterfall') return 'cachoeira';
  if (['camp_site', 'caravan_site'].includes(t.tourism)) return 'camping';
  if (['hotel', 'hostel', 'guest_house', 'chalet', 'apartment'].includes(t.tourism)) return 'hospedagem';
  if (['restaurant', 'cafe', 'fast_food'].includes(t.amenity)) return 'restaurante';
  if (t.amenity === 'fuel') return 'posto';
  if (t.amenity === 'parking') return 'estacionamento';
  if (['pharmacy', 'hospital', 'clinic', 'atm'].includes(t.amenity)) return 'servico';
  if (t.shop) return 'mercado';
  return 'trilha';
}

const SERVICO = { pharmacy: 'Farmácia', hospital: 'Hospital', clinic: 'Clínica', atm: 'Caixa eletrônico' };

/** Endereço montado só com o que a fonte tem. */
export function enderecoDasTags(t = {}) {
  const rua = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
  return [rua, t['addr:suburb'], t['addr:city']].filter(Boolean).join(' · ');
}

/**
 * Converte um elemento Overpass em "resultado" do app. Devolve null sem coordenada ou nome.
 * Campos que a fonte não tem ficam undefined (a tela mostra "indisponível").
 */
export function converterElemento(el, origem) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cat = categoriaDasTags(t);
  const info = CATEGORIAS[cat];
  const nome = t.name || (cat === 'estacionamento' ? 'Estacionamento (sem nome)' : SERVICO[t.amenity] || '');
  if (!nome) return null;
  return {
    osmId: `${el.type}/${el.id}`,
    nome,
    categoria: cat,
    tipo: info.tipo,
    subtipo: info.subtipo || undefined,
    lat, lng,
    distanciaKm: origem ? distanciaKm(origem, { lat, lng }) : undefined,
    endereco: enderecoDasTags(t) || undefined,
    telefone: t.phone || t['contact:phone'] || undefined,
    site: t.website || t['contact:website'] || undefined,
    horario: t.opening_hours || undefined,
    pago: t.fee === 'yes' ? true : t.fee === 'no' ? false : undefined,
    acessoInfo: t.access && t.access !== 'yes' ? `Acesso: ${t.access}` : undefined,
    estrutura: [t.toilets === 'yes' && 'banheiro', t.shower === 'yes' && 'chuveiro', t.drinking_water === 'yes' && 'água potável',
      t.power_supply === 'yes' && 'energia', t.internet_access === 'wlan' && 'wi-fi'].filter(Boolean),
    fonteUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`
  };
}

/** Converte a resposta inteira, tira repetidos e ordena do mais perto pro mais longe. */
export function converterResposta(json, origem) {
  const vistos = new Set();
  return (json?.elements || [])
    .map((e) => converterElemento(e, origem))
    .filter((r) => r && !vistos.has(r.osmId) && vistos.add(r.osmId))
    .sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9));
}

/** Junta resultados completos (Overpass) com os da busca rápida, sem repetir; os completos têm prioridade. */
export function mesclarResultados(completos, rapidos) {
  const ids = new Set(completos.map((r) => r.osmId));
  const extras = rapidos.filter((r) => !r.osmId || !ids.has(r.osmId));
  return [...completos, ...extras].sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9));
}
