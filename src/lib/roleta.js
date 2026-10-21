// 🎲 Roleta do rolê — lógica PURA (sem DOM, sem rede), fácil de testar.
// Recebe a lista de lugares + contexto e devolve sugestões pontuadas.
import { distanciaKm, minutosDeslocamento, temCoord } from './geo.js';

export const TEMPOS = {
  curto: { rotulo: '1–2h', minutos: 120 },
  meio: { rotulo: 'Meio dia', minutos: 300 },
  dia: { rotulo: 'Dia todo', minutos: 600 }
};

export const ENERGIAS = {
  boa: { rotulo: '🦥 De boa', permite: ['facil'] },
  normal: { rotulo: '🙂 Normal', permite: ['facil', 'moderada'] },
  sofrer: { rotulo: '🔥 Bora sofrer', permite: ['facil', 'moderada', 'dificil'] }
};

// Tipos que contam como "rolê" (camping e apoio não são sorteados)
const TIPOS_ROLE = ['trilha', 'cachoeira', 'praia'];

/** Duração padrão quando o lugar não informa. */
const duracaoPadrao = (l) => l.duracaoMin ?? ({ trilha: 180, cachoeira: 90, praia: 120 }[l.tipo] ?? 120);

/** Dificuldade padrão quando não informada. */
const dificuldadeDe = (l) => l.dificuldade || (l.tipo === 'trilha' ? 'moderada' : 'facil');

/**
 * @param {Array} lugares
 * @param {{tempo:keyof TEMPOS, energia:keyof ENERGIAS, clima:'sol'|'nublado'|'chuva'|'chuva-forte',
 *          posicao?:{lat,lng}, incluirFeitos?:boolean, aleatorio?:()=>number}} ctx
 * @returns {Array<{lugar, pontos, motivos:string[], distanciaKm?:number}>} ordenado do melhor pro pior
 */
export function sugerir(lugares, ctx) {
  const { tempo, energia, clima = 'sol', posicao = null, incluirFeitos = false, aleatorio = Math.random } = ctx;
  const limiteMin = TEMPOS[tempo]?.minutos ?? 300;
  const permitidas = ENERGIAS[energia]?.permite ?? ENERGIAS.normal.permite;
  const chovendo = clima === 'chuva' || clima === 'chuva-forte';

  const resultado = [];
  for (const l of lugares) {
    if (!TIPOS_ROLE.includes(l.tipo)) continue;
    if (l.status === 'descartado') continue;
    if (l.status === 'fui' && !incluirFeitos) continue;

    const dif = dificuldadeDe(l);
    if (!permitidas.includes(dif)) continue;

    // Chuva: nada difícil, nada de barco, nada de costão; chuva forte tira cachoeira (cabeça d'água)
    const tags = l.tags || [];
    if (chovendo && (dif === 'dificil' || l.acesso === 'barco' || tags.includes('costao'))) continue;
    if (clima === 'chuva-forte' && l.tipo === 'cachoeira') continue;

    // Tempo: duração + ida e volta
    let km = null;
    let desloc = 0;
    if (posicao && temCoord(l)) {
      km = distanciaKm(posicao, l);
      desloc = minutosDeslocamento(km) * 2;
    }
    const total = duracaoPadrao(l) + desloc;
    if (total > limiteMin) continue;

    // Pontuação: perto é melhor, aproveitar bem o tempo é melhor, um pouco de sorte
    const motivos = [];
    let pontos = 50;
    if (km !== null) {
      pontos += Math.max(0, 30 - km); // até +30 se for colado
      motivos.push(km < 5 ? 'pertinho' : `${Math.round(km)} km daqui`);
    }
    const aproveitamento = total / limiteMin; // 0..1
    pontos += aproveitamento * 15;
    if (energia === 'sofrer' && dif === 'dificil') { pontos += 25; motivos.push('do jeito que vocês pediram: puxado 🔥'); }
    if (energia === 'boa' && l.tipo !== 'trilha') { pontos += 10; motivos.push('zero esforço'); }
    if (clima === 'sol' && l.tipo === 'praia') { pontos += 10; motivos.push('dia de sol pede praia'); }
    if (chovendo && l.tipo === 'cachoeira') { pontos += 5; motivos.push('já vai se molhar mesmo'); }
    if (tags.includes('vista') && clima === 'sol') { pontos += 8; motivos.push('vista garantida com céu aberto'); }
    if (tags.includes('classico')) { pontos += 5; motivos.push('clássico da região'); }
    if (!l.duracaoMin) motivos.push('duração estimada');
    pontos += aleatorio() * 12; // tempero

    resultado.push({ lugar: l, pontos, motivos, distanciaKm: km, minutosTotal: total });
  }
  return resultado.sort((a, b) => b.pontos - a.pontos);
}

/** Sorteia entre os 3 melhores (o "giro" da roleta). */
export function girar(sugestoes, aleatorio = Math.random) {
  if (!sugestoes.length) return null;
  const top = sugestoes.slice(0, 3);
  return top[Math.floor(aleatorio() * top.length)];
}
