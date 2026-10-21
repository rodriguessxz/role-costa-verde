// Camada de dados com a MESMA interface para dois "backends":
//  - modo local: localStorage (antes do Firebase estar configurado / sem login)
//  - modo nuvem: Firestore em trips/{TRIP_ID}/{colecao}
// As views só falam com este módulo: assinar(), adicionar(), atualizar(), remover().
import { TRIP_ID } from './firebase-config.js';
import { firebaseAtivo, iniciarFirebase } from './firebase.js';

const LS_PREFIX = 'role:';
const COLECOES = ['lugares', 'gastos', 'config'];

// Estado em memória + ouvintes por coleção
const cache = Object.fromEntries(COLECOES.map((c) => [c, []]));
const ouvintes = Object.fromEntries(COLECOES.map((c) => [c, new Set()]));
let modo = 'local'; // 'local' | 'nuvem'
let cancelarSnapshots = [];

export const getModo = () => modo;

/* ---------------- utilidades ---------------- */

function emitir(colecao) {
  for (const cb of ouvintes[colecao]) cb(cache[colecao]);
}

function novoId(prefixo = 'id') {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function lsLer(colecao) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + colecao) || '[]'); }
  catch { return []; }
}

function lsSalvar(colecao) {
  try { localStorage.setItem(LS_PREFIX + colecao, JSON.stringify(cache[colecao])); }
  catch (e) { console.warn('[store] localStorage indisponível', e); }
}

/* ---------------- seed ---------------- */

/** Busca o seed.json publicado junto com o app. */
export async function carregarSeed() {
  const resp = await fetch(`${import.meta.env.BASE_URL}seed.json`);
  const json = await resp.json();
  return json.lugares || [];
}

/* ---------------- inicialização ---------------- */

/** Modo local: carrega do localStorage; na 1ª vez, popula com o seed. */
export async function iniciarLocal() {
  pararNuvem();
  modo = 'local';
  for (const c of COLECOES) cache[c] = lsLer(c);
  if (!localStorage.getItem(LS_PREFIX + 'seeded')) {
    try {
      cache.lugares = await carregarSeed();
      lsSalvar('lugares');
      localStorage.setItem(LS_PREFIX + 'seeded', '1');
    } catch (e) { console.warn('[store] não consegui carregar o seed', e); }
  }
  COLECOES.forEach(emitir);
}

/** Modo nuvem: escuta as coleções do Firestore em tempo real (com cache offline). */
export async function iniciarNuvem() {
  if (!firebaseAtivo) return iniciarLocal();
  const { db, fs } = await iniciarFirebase();
  pararNuvem();
  modo = 'nuvem';
  for (const c of COLECOES) {
    const ref = fs.collection(db, 'trips', TRIP_ID, c);
    const cancelar = fs.onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        cache[c] = snap.docs.map((d) => ({ id: d.id, ...d.data(), _pendente: d.metadata.hasPendingWrites }));
        emitir(c);
      },
      (err) => console.error(`[store] erro ao ouvir ${c}`, err)
    );
    cancelarSnapshots.push(cancelar);
  }
}

function pararNuvem() {
  cancelarSnapshots.forEach((f) => f());
  cancelarSnapshots = [];
}

/* ---------------- API pública ---------------- */

/** Assina uma coleção. Chama cb imediatamente com o estado atual. Retorna função pra cancelar. */
export function assinar(colecao, cb) {
  ouvintes[colecao].add(cb);
  cb(cache[colecao]);
  return () => ouvintes[colecao].delete(cb);
}

export const obter = (colecao, id) => cache[colecao].find((x) => x.id === id);
export const listar = (colecao) => cache[colecao];

/** Remove campos internos e undefined antes de salvar. */
function limpar(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k.startsWith('_') || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export async function adicionar(colecao, dados, id = novoId(colecao.slice(0, 3))) {
  const doc = { ...limpar(dados), atualizadoEm: new Date().toISOString() };
  if (modo === 'nuvem') {
    const { db, fs } = await iniciarFirebase();
    // Não damos await no set: offline ele resolve só quando sincroniza.
    fs.setDoc(fs.doc(db, 'trips', TRIP_ID, colecao, id), doc).catch(avisarErro);
  } else {
    cache[colecao] = [...cache[colecao], { id, ...doc }];
    lsSalvar(colecao);
    emitir(colecao);
  }
  return id;
}

export async function atualizar(colecao, id, parcial) {
  const mudancas = { ...limpar(parcial), atualizadoEm: new Date().toISOString() };
  if (modo === 'nuvem') {
    const { db, fs } = await iniciarFirebase();
    fs.setDoc(fs.doc(db, 'trips', TRIP_ID, colecao, id), mudancas, { merge: true }).catch(avisarErro);
  } else {
    cache[colecao] = cache[colecao].map((x) => (x.id === id ? { ...x, ...mudancas } : x));
    lsSalvar(colecao);
    emitir(colecao);
  }
}

export async function remover(colecao, id) {
  if (modo === 'nuvem') {
    const { db, fs } = await iniciarFirebase();
    fs.deleteDoc(fs.doc(db, 'trips', TRIP_ID, colecao, id)).catch(avisarErro);
  } else {
    cache[colecao] = cache[colecao].filter((x) => x.id !== id);
    lsSalvar(colecao);
    emitir(colecao);
  }
}

/**
 * Importa lugares em lote (seed ou dados locais) sem sobrescrever o que já existe.
 * Retorna quantos foram adicionados.
 */
export async function importarLugares(lista) {
  const existentes = new Set(cache.lugares.map((l) => l.id));
  const novos = lista.filter((l) => l.id && !existentes.has(l.id));
  if (modo === 'nuvem') {
    const { db, fs } = await iniciarFirebase();
    // writeBatch aceita até 500 operações
    for (let i = 0; i < novos.length; i += 400) {
      const batch = fs.writeBatch(db);
      for (const l of novos.slice(i, i + 400)) {
        batch.set(fs.doc(db, 'trips', TRIP_ID, 'lugares', l.id), {
          ...limpar(l), atualizadoEm: new Date().toISOString()
        });
      }
      batch.commit().catch(avisarErro);
    }
  } else {
    cache.lugares = [...cache.lugares, ...novos];
    lsSalvar('lugares');
    emitir('lugares');
  }
  return novos.length;
}

/** Exporta tudo como JSON (backup). */
export function exportarTudo() {
  return { exportadoEm: new Date().toISOString(), modo, ...Object.fromEntries(COLECOES.map((c) => [c, cache[c]])) };
}

/** Dados que ficaram salvos no localStorage (pra migrar pra nuvem depois do login). */
export function dadosLocais() {
  return Object.fromEntries(COLECOES.map((c) => [c, lsLer(c)]));
}

function avisarErro(e) {
  console.error('[store]', e);
  window.dispatchEvent(new CustomEvent('store-erro', { detail: e }));
}
