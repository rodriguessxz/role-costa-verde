// Importar TODOS os lugares de uma busca digitada (ex.: "camping em Paraty") pela abrangência da área.
// Entende categoria + cidade/região, descobre a área no mapa, varre a área inteira e cria um lead para cada lugar.
import { importarLote } from './acoes.js';
import { interpretarConsulta } from './lib/consulta.js';
import { localizarArea, buscarNaArea, caixaEmVoltaDe } from './lib/nominatim.js';
import { buscaRapida } from './lib/geocode.js';
import { CENTRO_REGIAO, CENTROS_REGIAO } from './lib/geo.js';

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Atalhos de lugares conhecidos da região, usados se o mapa não achar o nome digitado. */
const APELIDOS = [
  [/ubatuba/, 'ubatuba-centro'], [/picinguaba|puruba|prumirim/, 'ubatuba-norte'], [/maranduba|lagoinha|sununga/, 'ubatuba-sul'],
  [/trindade/, 'trindade'], [/mirim|mamangua/, 'paraty-mirim'], [/paraty|parati/, 'paraty']
];

function areaPorApelido(texto) {
  const t = sem(texto);
  const achado = APELIDOS.find(([re]) => re.test(t));
  const centro = achado ? CENTROS_REGIAO[achado[1]] : null;
  return centro ? { rotulo: texto, centro, caixa: caixaEmVoltaDe(centro, 12) } : null;
}

/** Texto que será procurado no mapa. */
function termoDeBusca(i) {
  if (i.categoria) return i.nome ? `${i.termo} ${i.nome}` : i.termo;
  return i.nome || i.texto;
}

/**
 * @param {string} texto o que a pessoa digitou na busca
 * @param {{localPadrao?:string, aoProgresso?:(msg:string)=>void, signal?:AbortSignal}} opcoes
 * @returns {Promise<{novos:number, jaExistiam:number, total:number, comTelefone:number, local:string}>}
 */
export async function importarPorConsulta(texto, { localPadrao = '', aoProgresso, signal } = {}) {
  const i = interpretarConsulta(texto);
  if (!i.texto) throw new Error('Digite o que buscar');
  const localTexto = i.local || localPadrao;

  let area = null;
  if (localTexto) {
    aoProgresso?.(`Localizando ${localTexto}…`);
    try { area = await localizarArea(localTexto, CENTRO_REGIAO, { signal }); } catch (e) { if (signal?.aborted) throw e; }
    area = area || areaPorApelido(localTexto);
  }
  area = area || { rotulo: 'litoral Ubatuba–Paraty', centro: CENTRO_REGIAO, caixa: caixaEmVoltaDe(CENTRO_REGIAO, 25) };

  aoProgresso?.(`Buscando em ${area.rotulo}…`);
  let lista = [];
  try {
    lista = await buscarNaArea({
      q: termoDeBusca(i), caixa: area.caixa, categoria: i.categoria && !i.nome ? i.categoria : null, origem: area.centro, signal,
      aoAvancar: (n) => aoProgresso?.(`Achados em ${area.rotulo}: ${n}`)
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    // plano B: busca rápida em círculo (menos completa, mas funciona se o serviço principal falhar)
    if (!i.categoria) throw e;
    lista = await buscaRapida([i.categoria], area.centro, 15, '', { signal });
  }
  if (!lista.length) return { novos: 0, jaExistiam: 0, total: 0, comTelefone: 0, local: area.rotulo };

  aoProgresso?.(`Importando ${lista.length} lugares…`);
  const { novos, jaExistiam } = await importarLote(lista);
  return { novos, jaExistiam, total: lista.length, comTelefone: lista.filter((r) => r.telefone).length, local: area.rotulo };
}
