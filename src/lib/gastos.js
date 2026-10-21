// Racha de gastos entre 2 pessoas — lógica pura.

/**
 * Calcula quanto cada um pagou, a parte justa e quem deve pra quem.
 * @param {Array<{valor:number, pagoPor:string, divisao?:'igual'|'so-quem-pagou'}>} gastos
 * @param {[string,string]} pessoas nomes/ids das duas pessoas
 */
export function calcularSaldo(gastos, pessoas) {
  const [a, b] = pessoas;
  const pago = { [a]: 0, [b]: 0 };
  const deve = { [a]: 0, [b]: 0 }; // parte que cabe a cada um
  let total = 0;

  for (const g of gastos) {
    const v = Number(g.valor) || 0;
    if (!(g.pagoPor in pago)) continue;
    pago[g.pagoPor] += v;
    total += v;
    if (g.divisao === 'so-quem-pagou') deve[g.pagoPor] += v;
    else { deve[a] += v / 2; deve[b] += v / 2; }
  }

  // saldo positivo = tem a receber
  const saldoA = round2(pago[a] - deve[a]);
  let resumo = null;
  if (Math.abs(saldoA) >= 0.01) {
    resumo = saldoA > 0
      ? { devedor: b, credor: a, valor: saldoA }
      : { devedor: a, credor: b, valor: -saldoA };
  }
  return { total: round2(total), pago, resumo };
}

const round2 = (n) => Math.round(n * 100) / 100;

export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
