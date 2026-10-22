// Chamada à API Overpass (OpenStreetMap). Tenta o servidor principal e depois espelhos públicos.
// Sem chave, sem custo; por isso respeitamos o limite: uma consulta por vez, tempo máximo por servidor
// e erro claro quando estão ocupados.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const TEMPO_MAX_MS = 14000;

/** Erro com `.tipo`: 'ocupado' (limite/timeout do servidor), 'offline' ou 'falha'. */
function erro(tipo, msg) { return Object.assign(new Error(msg), { tipo }); }

/** fetch que desiste depois de TEMPO_MAX_MS, mas também obedece ao `signal` de quem chamou. */
async function buscarComLimite(url, opcoes, signalExterno) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('tempo'), TEMPO_MAX_MS);
  const aoCancelar = () => ctrl.abort('cancelado');
  signalExterno?.addEventListener('abort', aoCancelar);
  try {
    return await fetch(url, { ...opcoes, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    signalExterno?.removeEventListener('abort', aoCancelar);
  }
}

export async function consultarOverpass(consulta, { signal } = {}) {
  if (!navigator.onLine) throw erro('offline', 'Sem internet');
  let ultimo = erro('falha', 'Sem resposta');
  for (const ep of ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('cancelado', 'AbortError');
    try {
      const r = await buscarComLimite(ep, { method: 'POST', body: new URLSearchParams({ data: consulta }) }, signal);
      if (!r.ok) { ultimo = erro([429, 502, 503, 504].includes(r.status) ? 'ocupado' : 'falha', `Erro ${r.status}`); continue; }
      try {
        return await r.json();
      } catch {
        ultimo = erro('ocupado', 'Resposta inválida (servidor sobrecarregado)');
      }
    } catch (e) {
      if (signal?.aborted) throw new DOMException('cancelado', 'AbortError');
      ultimo = erro(!navigator.onLine ? 'offline' : e.name === 'AbortError' ? 'ocupado' : 'falha', e.message);
    }
  }
  throw ultimo;
}
