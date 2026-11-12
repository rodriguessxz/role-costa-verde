// Entende o que a pessoa DIGITOU na busca ("camping em Paraty", "praias Ubatuba", "pousada do sol") — lógica PURA.
// Serve para o botão de importar acompanhar a busca: categoria + local (cidade/região) ou nome livre.

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** [chave da categoria do app, expressão (sem acento, minúscula), termo que o mapa entende] */
const CATEGORIAS = [
  ['camping', /\b(campings?|acampamentos?|area de camping)\b/g, 'camping'],
  ['hospedagem', /\b(pousadas?|hoteis|hotel|hostels?|chales?|hospedagens?)\b/g, 'pousada'],
  ['praia', /\bpraias?\b/g, 'praia'],
  ['cachoeira', /\b(cachoeiras?|pocos?|quedas? d agua)\b/g, 'cachoeira'],
  ['trilha', /\b(trilhas?|mirantes?|picos?)\b/g, 'trilha'],
  ['restaurante', /\b(restaurantes?|bares?|lanchonetes?|pizzarias?|padarias?|cafes?|quiosques?)\b/g, 'restaurante'],
  ['mercado', /\b(mercados?|supermercados?|mercearias?)\b/g, 'mercado'],
  ['posto', /\b(postos?|gasolina|combustivel)\b/g, 'posto'],
  ['estacionamento', /\bestacionamentos?\b/g, 'estacionamento'],
  ['servico', /\b(farmacias?|hospitais|hospital|caixas? eletronicos?)\b/g, 'farmacia']
];

const PREPOSICAO = /\b(?:em|no|na|nos|nas|perto de|perto d[oa]|proximo a|proximo de|proximo)\s+(.+)$/;
const LIGACAO = /\b(?:de|do|da|dos|das|em|no|na|e|a|o|os|as|perto|proximo|proximos|todos|todas|todo|toda)\b/g;

/**
 * @returns {{categoria:string|null, termo:string, local:string, nome:string, texto:string}}
 *  - categoria/termo: o tipo de lugar reconhecido (ex.: camping)
 *  - local: cidade/região escrita depois de "em" (ex.: "Paraty")
 *  - nome: sobra que parece nome de estabelecimento (ex.: "do sol" em "pousada do sol")
 */
export function interpretarConsulta(texto) {
  const original = String(texto || '').trim().replace(/\s+/g, ' ');
  const t = sem(original);
  let local = '';
  let resto = t;
  const m = PREPOSICAO.exec(t);
  if (m) {
    local = original.slice(original.length - m[1].length).trim();
    resto = t.slice(0, m.index).trim();
  }
  let categoria = null;
  let termo = '';
  for (const [chave, re, termoBusca] of CATEGORIAS) {
    re.lastIndex = 0;
    if (re.test(resto)) { categoria = chave; termo = termoBusca; resto = resto.replace(re, ' '); break; }
  }
  const sobra = resto.replace(LIGACAO, ' ').replace(/\s+/g, ' ').trim();
  if (categoria) return { categoria, termo, local, nome: sobra, texto: original };
  // sem categoria: "Paraty" sozinho é um lugar; "Camping" já foi tratado; o resto vira nome livre
  return { categoria: null, termo: '', local, nome: m ? sobra : original, texto: original };
}

const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rótulo do botão de importar, de acordo com a busca. */
export function rotuloImportacao(i, rotulosCategoria = {}) {
  if (!i.texto) return 'Importar resultados para triagem';
  const cat = i.categoria ? (rotulosCategoria[i.categoria] || i.categoria).toLowerCase() : '';
  if (i.categoria && !i.nome) return `${cat}${i.local ? ` em ${maiuscula(i.local)}` : ''}`;
  if (i.categoria && i.nome) return `“${i.texto}”`;
  return `“${i.nome || i.texto}”${i.local ? ` em ${maiuscula(i.local)}` : ''}`;
}
