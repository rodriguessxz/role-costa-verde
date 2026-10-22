// Lógica PURA do roteiro: ordenar, mover e achar conflitos. Nada de rede aqui.
import { distanciaKm, minutosDeslocamento, temCoord } from './geo.js';

export const horaParaMin = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Dias na ordem escolhida (depois por data). */
export const ordenarDias = (dias) =>
  [...dias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.data || '').localeCompare(String(b.data || '')));

/** Atividades de um dia ('' = banco de atividades sem dia), na ordem. */
export const atividadesDoDia = (atividades, diaId) =>
  atividades.filter((a) => (a.diaId || '') === (diaId || '')).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/**
 * Sobe/desce um item numa lista já ordenada. Devolve as novas ordens [{id, ordem}]
 * (renumera tudo 1..n, então nunca dá empate). Vazio se não dá pra mover.
 */
export function mover(lista, id, delta) {
  const i = lista.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return [];
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia.map((x, k) => ({ id: x.id, ordem: k + 1 }));
}

/** Próxima ordem para colocar um item no fim de uma lista. */
export const proximaOrdem = (lista) => Math.max(0, ...lista.map((x) => x.ordem ?? 0)) + 1;

/**
 * Analisa um dia: trecho entre atividades consecutivas e avisos.
 * Só avisa quando há dados suficientes (horários e/ou coordenadas). Tempos são ESTIMATIVAS
 * em linha reta, nunca rota real (ver lib/rotas.js). Planos B ficam fora da conta.
 * @returns {Array<{trecho:{km:number,minEst:number}|null, avisos:string[]}>} um item por atividade
 */
export function analisarDia(ativs, lugarDe) {
  return ativs.map((a, i) => {
    const avisos = [];
    let trecho = null;
    const ini = horaParaMin(a.horaInicio);
    const ant = ativs.slice(0, i).reverse().find((x) => !x.alternativa);
    if (ant && !a.alternativa) {
      const la = lugarDe(ant);
      const lb = lugarDe(a);
      if (la && lb && temCoord(la) && temCoord(lb)) {
        const km = distanciaKm(la, lb);
        trecho = { km, minEst: minutosDeslocamento(km) };
      }
      const iniAnt = horaParaMin(ant.horaInicio);
      const fimAnt = iniAnt !== null && ant.duracaoMin ? iniAnt + ant.duracaoMin : null;
      if (ini !== null && fimAnt !== null) {
        if (ini < fimAnt) avisos.push('Conflito de horário com a atividade anterior');
        else if (trecho && ini - fimAnt < trecho.minEst) avisos.push(`Deslocamento apertado (estimativa ~${trecho.minEst} min)`);
      }
    }
    return { trecho, avisos };
  });
}
