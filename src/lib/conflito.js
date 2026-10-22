// Edição colaborativa sem sobrescrever em silêncio (lógica PURA).
// Ideia: ao salvar, só mandamos os campos que a pessoa mudou. Se OUTRA pessoa mudou
// o mesmo campo enquanto a edição estava aberta, isso é um conflito e a pessoa decide.

const ignorar = (k) => k === 'id' || k.startsWith('_') || ['atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor'].includes(k);
// vazio, undefined e lista vazia contam como "sem valor" (formulários devolvem "" onde o dado não existe)
const norm = (v) => (v === "" || v === undefined || (Array.isArray(v) && !v.length) ? null : v);
const igual = (a, b) => JSON.stringify(norm(a) ?? null) === JSON.stringify(norm(b) ?? null);

/** Campos de `novo` que diferem de `base` (o que a pessoa realmente mexeu). */
export function camposAlterados(base, novo) {
  const out = {};
  for (const [k, v] of Object.entries(novo)) {
    if (ignorar(k)) continue;
    if (!igual(base?.[k], v)) out[k] = v;
  }
  return out;
}

/**
 * Campos que EU mudei e que o outro também mudou (para outro valor) desde que abri a edição.
 * @param base    versão que eu abri
 * @param atual   versão que está no servidor agora
 * @param minhas  só as minhas mudanças (saída de camposAlterados)
 */
export function conflitos(base, atual, minhas) {
  if (!atual) return [];
  return Object.keys(minhas).filter((k) =>
    !ignorar(k) && !igual(base?.[k], atual[k]) && !igual(atual[k], minhas[k]));
}
