// Formatação de datas/horas em português (funções puras).

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou dd/mm. */
export function tempoRelativo(iso, agora = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((agora - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** "2026-12-23" → "23 dez". */
export function dataCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-').map(Number);
  if (!a || !m || !d) return '';
  return `${d} ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}`;
}

/** Dias inteiros entre hoje e uma data ISO (negativo se já passou). */
export function diasAte(iso, hoje = new Date()) {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  if (!a) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((new Date(a, m - 1, d) - h) / 86400000);
}
