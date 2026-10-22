// Último resultado do Explorar, guardado no aparelho: reabre a tela sem refazer a busca
// e deixa o Mapa mostrar os resultados. É só cache de leitura (não substitui "lugares salvos").
const KEY = 'role:explorar:ultimo';
let memoria = null;

export function lerExplorar() {
  if (memoria) return memoria;
  try { memoria = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { memoria = null; }
  return memoria;
}

/** @param {{origem, raio:number, cats:string[], texto:string, resultados:Array, em:string}} e */
export function guardarExplorar(e) {
  memoria = e;
  try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* ok */ }
}
