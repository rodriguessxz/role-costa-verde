// Dados da viagem (nome, datas) e "quem sou eu" (pessoa 1 ou 2 da dupla).
import { obter } from './store.js';

const PADRAO = { nome: 'Rolê Costa Verde', inicio: '2026-12-23', fim: '2027-01-06', roteiro: 'Ubatuba ⇄ Paraty' };

/** Config da viagem com padrões (o que a dupla não editou continua o combinado no CLAUDE.md). */
export function getViagem() {
  const v = obter('config', 'viagem') || {};
  return { ...PADRAO, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x)) };
}

/** Nomes da dupla (config/pessoas) — mesma fonte do racha de gastos. */
export function nomesDupla() {
  const c = obter('config', 'pessoas');
  return { a: c?.a || 'Eu', b: c?.b || 'Parça' };
}

const EU_KEY = 'role:eu';
/** 'a' ou 'b': qual das duas pessoas está usando este aparelho. */
export function euSou() {
  try { return localStorage.getItem(EU_KEY) === 'b' ? 'b' : 'a'; } catch { return 'a'; }
}
export function definirEuSou(v) {
  try { localStorage.setItem(EU_KEY, v); } catch { /* ok */ }
}
