// Mensagens prontas para mandar aos campings (WhatsApp). Pura: sem rede, sem IA, funciona offline.
// Tom humano e descontraído, mas sem inventar nada: só usa o que a dupla já sabe (nome, região, datas, pessoas).

export const VARIANTES = {
  descolada: { rotulo: 'Descolada' },
  curta: { rotulo: 'Curta e direta' },
  educada: { rotulo: 'Mais educada' }
};

const NOMES_PADRAO = new Set(['', 'eu', 'parça', 'parca']);

/** "2026-12-23" → "23/12". */
export function dataDiaMes(iso) {
  const [a, m, d] = String(iso || '').split('-');
  return a && m && d ? `${d}/${m}` : '';
}

/** Texto de datas a partir do período da viagem: "entre 23/12 e 06/01 (as datas são flexíveis)". */
export function textoDatas(inicio, fim) {
  const i = dataDiaMes(inicio);
  const f = dataDiaMes(fim);
  if (i && f) return `entre ${i} e ${f} (as datas são flexíveis)`;
  if (i) return `a partir de ${i}`;
  return 'nas próximas semanas';
}

/** "eu e um amigo", "eu e mais 2 amigos", "eu". */
export function quemVai(pessoas = 2) {
  const n = Math.max(1, Math.round(Number(pessoas) || 1));
  if (n === 1) return 'eu';
  if (n === 2) return 'eu e um amigo';
  return `eu e mais ${n - 1} amigos`;
}

const primeiroNome = (nome) => {
  const n = String(nome || '').trim().split(/\s+/)[0] || '';
  return NOMES_PADRAO.has(n.toLowerCase()) ? '' : n;
};

/**
 * Monta a mensagem.
 * @param {{variante?:keyof typeof VARIANTES, camping:string, regiao?:string, datas?:string, pessoas?:number, meuNome?:string}} p
 */
export function montarMensagem({ variante = 'descolada', camping, regiao = '', datas = '', pessoas = 2, meuNome = '' }) {
  const nome = primeiroNome(meuNome);
  const onde = regiao ? `por aí em ${regiao}` : 'por essa região';
  const quando = datas || 'nas próximas semanas';
  const quem = quemVai(pessoas);
  // tira parênteses do nome ("Camping X (Praia Y)") para não aninhar parênteses no texto
  const limpo = String(camping || '').replace(/\s*\([^)]*\)/g, '').trim();
  const local = limpo ? ` (${limpo})` : '';

  if (variante === 'curta') {
    return `Oi, tudo bem?${nome ? ` Aqui é o ${nome}.` : ''} Vamos estar ${onde} ${quando}, ${quem}. Vocês têm vaga pra acampar${local}? Qual o valor da noite? Valeu! 🙏`;
  }
  if (variante === 'educada') {
    return `Olá, tudo bem?${nome ? ` Meu nome é ${nome}, muito prazer.` : ' Muito prazer!'}\n\nEstamos planejando acampar ${onde} ${quando} (${quem}) e encontrei o contato de vocês${local}.\n\nGostaria de saber se há disponibilidade para esse período e quais são os valores. Se puderem, me informem também sobre a estrutura (banheiro, chuveiro) e como funciona a reserva.\n\nDesde já, muito obrigado!`;
  }
  return `Fala, tudo joia? 😄${nome ? ` Aqui é o ${nome}, muito prazer!` : ' Muito prazer!'}\n\n${quem.charAt(0).toUpperCase() + quem.slice(1)} vamos estar ${onde} ${quando} e tô procurando um lugar pra acampar. Achei o contato de vocês${local} e curti demais!\n\nVocês teriam vaga pra gente nessas datas? E como estão os valores (por noite ou por pessoa)? Se rolar, me conta também como é a estrutura (banheiro, chuveiro) e como faço pra reservar.\n\nValeu demais, fico no aguardo! 🏕️🤙`;
}

/** Link do WhatsApp com a mensagem já preenchida. Null se o número for inválido. Pura. */
export function linkWhatsApp(numero, texto) {
  const d = String(numero || '').replace(/\D/g, '').replace(/^55/, '');
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}?text=${encodeURIComponent(texto)}` : null;
}
