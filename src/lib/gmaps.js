// Ler o que o Google Maps entrega quando a pessoa COMPARTILHA ou COPIA um lugar (lógica PURA).
// Não usa API nenhuma: só interpreta o texto/URL que a própria pessoa colou ou compartilhou.

const NUM = '-?\\d{1,3}(?:\\.\\d+)?';
const ehLatLng = (lat, lng) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Primeiro link http(s) dentro de um texto. */
export function acharUrl(texto = '') {
  const m = /https?:\/\/[^\s<>"']+/i.exec(texto);
  return m ? m[0].replace(/[).,;]+$/, '') : '';
}

/** É um endereço do Google Maps (inclusive encurtado)? */
export const ehLinkGoogleMaps = (url = '') =>
  /^https?:\/\/((www|maps)\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(url) || /^https?:\/\/maps\.google\./i.test(url);

/** Coordenadas escondidas num link longo do Google Maps (ou escritas soltas, "lat, lng"). Null se não achar. */
export function coordenadasDe(texto = '') {
  const padroes = [
    new RegExp(`!3d(${NUM})!4d(${NUM})`), // posição exata do lugar
    new RegExp(`@(${NUM}),(${NUM})`), // centro da tela do mapa
    new RegExp(`[?&](?:q|ll|query|destination|center)=(${NUM})(?:,|%2C)\\s*(${NUM})`, 'i'),
    new RegExp(`(?:^|[^\\d.-])(${NUM}),\\s*(${NUM})(?:$|[^\\d.])`) // "-23.43, -45.08" copiado do Google
  ];
  for (const p of padroes) {
    const m = p.exec(texto);
    if (m && ehLatLng(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

/** Nome do lugar escrito no caminho de um link longo: /maps/place/Camping+Sununga/@... */
export function nomeDoLink(url = '') {
  const m = /\/maps\/place\/([^/@?]+)/i.exec(url);
  if (!m) return '';
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch { return m[1].replace(/\+/g, ' ').trim(); }
}

/**
 * Interpreta um texto compartilhado/colado do Google Maps.
 * O app do Google costuma mandar: "Nome do lugar\nEndereço\nhttps://maps.app.goo.gl/..."
 * @returns {{nome:string, endereco:string, url:string, lat:number|null, lng:number|null, ehGoogle:boolean}}
 */
export function interpretarCompartilhado({ title = '', text = '', url = '' } = {}) {
  const todo = [title, text, url].filter(Boolean).join('\n');
  const link = url || acharUrl(todo);
  const linhas = todo.replace(/https?:\/\/[^\s<>"']+/gi, '\n').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nomeLink = nomeDoLink(link);
  const nome = (nomeLink || (title && !/^https?:/i.test(title) ? title.trim() : '') || linhas[0] || '').slice(0, 200);
  const endereco = linhas.find((l) => l !== nome && !/^(-?\d+[.,]\d+\s*[,;]\s*)/.test(l)) || '';
  const coords = coordenadasDe(link) || coordenadasDe(todo.replace(link, ''));
  return {
    nome,
    endereco: endereco.slice(0, 300),
    url: link,
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
    ehGoogle: ehLinkGoogleMaps(link)
  };
}

/** Texto de busca para o mapa do Google: "camping em Ubatuba". */
export const consultaGoogle = (termo, local) => [termo, local && `em ${local}`].filter(Boolean).join(' ').trim();

/** Endereço do mapa do Google que pode ser embutido numa <iframe> (modo de busca, sem chave). */
export const urlEmbutida = (consulta) => `https://www.google.com/maps?q=${encodeURIComponent(consulta)}&output=embed&hl=pt-BR`;

/** Link para abrir a mesma busca no app/site do Google Maps. */
export const urlAbrirNoGoogle = (consulta) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;

/** Palpite do tipo de lugar pelo nome (o usuário confirma na tela). Pura. */
export function tipoPeloNome(nome = '') {
  const n = nome.toLowerCase();
  if (/\b(camping|camp|glamping|área de camping)\b/.test(n)) return 'camping';
  if (/\b(pousada|hotel|hostel|chal[eé]s?|suítes?|suites?|flats?|resort)\b/.test(n)) return 'hospedagem';
  if (/\b(restaurante|bar|lanchonete|pizzaria|padaria|caf[eé]|quiosque|sorveteria|churrascaria)\b/.test(n)) return 'restaurante';
  if (/\b(cachoeira|po[cç]o|queda)\b/.test(n)) return 'cachoeira';
  if (/\b(trilha|pico|mirante|morro)\b/.test(n)) return 'trilha';
  if (/\bpraia\b/.test(n)) return 'praia';
  if (/\b(mercado|supermercado|posto|farm[aá]cia|padaria|empório|emporio)\b/.test(n)) return 'apoio';
  return 'camping';
}
