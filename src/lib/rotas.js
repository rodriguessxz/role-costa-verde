// Rota REAL de carro entre dois pontos, via OSRM (servidor público de demonstração, sem chave).
// É uma estimativa de carro: não considera estrada de terra fechada, balsa, barco ou trilha.
const BASE = 'https://router.project-osrm.org/route/v1/driving/';

/** @returns {Promise<{km:number, min:number}>} ou lança erro se sem rede / sem rota */
export async function rotaDeCarro(a, b, { signal } = {}) {
  const r = await fetch(`${BASE}${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal });
  if (!r.ok) throw new Error(`rota ${r.status}`);
  const j = await r.json();
  const rota = j.routes?.[0];
  if (!rota) throw new Error('sem rota');
  return { km: rota.distance / 1000, min: Math.round(rota.duration / 60) };
}
