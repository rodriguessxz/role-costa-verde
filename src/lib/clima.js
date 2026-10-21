// Previsão do tempo via Open-Meteo (grátis, sem chave), com cache em localStorage
// para funcionar offline com a última previsão conhecida.

const CHAVE = 'role:clima';

/**
 * Classifica o clima atual em 'sol' | 'nublado' | 'chuva' | 'chuva-forte'
 * a partir do weather_code (WMO) e da precipitação.
 */
export function classificarClima(codigo, precipitacaoMm = 0) {
  if (precipitacaoMm >= 5 || [65, 67, 82, 95, 96, 99].includes(codigo)) return 'chuva-forte';
  if (precipitacaoMm > 0.2 || (codigo >= 51 && codigo <= 82)) return 'chuva';
  if (codigo >= 2) return 'nublado';
  return 'sol';
}

export const ROTULO_CLIMA = {
  sol: '☀️ sol',
  nublado: '⛅ nublado',
  chuva: '🌧️ chuva',
  'chuva-forte': '⛈️ chuva forte'
};

/** Busca o clima atual na posição. Usa cache de até 3h se estiver offline. */
export async function climaAgora({ lat, lng }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}`
    + '&current=temperature_2m,precipitation,weather_code&timezone=America%2FSao_Paulo';
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const dado = {
      tipo: classificarClima(j.current.weather_code, j.current.precipitation),
      temp: Math.round(j.current.temperature_2m),
      em: Date.now()
    };
    try { localStorage.setItem(CHAVE, JSON.stringify(dado)); } catch { /* ok */ }
    return dado;
  } catch {
    try {
      const cache = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (cache && Date.now() - cache.em < 3 * 3600 * 1000) return { ...cache, doCache: true };
    } catch { /* ok */ }
    return null;
  }
}
