// Contatos com campings e outros locais: funil, canais e resumo das conversas (lógica PURA).
// Cada conversa é uma "interação" (trips/{id}/interacoes); a etapa atual fica no próprio lugar (`etapaContato`).

/** Etapas do funil, na ordem em que costumam acontecer. */
export const ETAPAS = {
  triagem: { rotulo: 'Para triar', emoji: '🔎' },
  'a-contatar': { rotulo: 'A contatar', emoji: '📌' },
  contatado: { rotulo: 'Contatado', emoji: '📞' },
  aguardando: { rotulo: 'Aguardando resposta', emoji: '⏳' },
  respondeu: { rotulo: 'Respondeu', emoji: '💬' },
  reservado: { rotulo: 'Reservado', emoji: '✅' },
  'sem-vaga': { rotulo: 'Sem vaga', emoji: '🚫' },
  'sem-interesse': { rotulo: 'Sem interesse', emoji: '🗑️' }
};

export const CANAIS = {
  whatsapp: { rotulo: 'WhatsApp', emoji: '💬' },
  telefone: { rotulo: 'Ligação', emoji: '📞' },
  email: { rotulo: 'E-mail', emoji: '✉️' },
  instagram: { rotulo: 'Instagram', emoji: '📷' },
  presencial: { rotulo: 'Pessoalmente', emoji: '🧍' },
  outro: { rotulo: 'Outro', emoji: '📝' }
};

export const TIPOS_VALOR = { noite: 'por noite', pessoa: 'por pessoa', pacote: 'pacote fechado', outro: 'outro' };

/** Etapas que ainda pedem ação nossa (o resto está resolvido ou esperando o local). */
export const ETAPAS_ABERTAS = ['a-contatar', 'contatado', 'aguardando', 'respondeu'];

/** Interações de um lugar, da mais recente pra mais antiga. */
export const interacoesDoLugar = (interacoes, lugarId) =>
  interacoes.filter((i) => i.lugarId === lugarId).sort((a, b) => String(b.data).localeCompare(String(a.data)));

/** "R$ 80 por noite" a partir de uma interação (vazio se não houver valor). */
export function textoValor(i) {
  if (i?.valor === null || i?.valor === undefined || i?.valor === '' || !Number.isFinite(Number(i.valor))) return '';
  const v = Number(i.valor).toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(Number(i.valor)) ? 0 : 2 });
  return `R$ ${v}${TIPOS_VALOR[i.valorTipo] && i.valorTipo !== 'outro' ? ` ${TIPOS_VALOR[i.valorTipo]}` : ''}`;
}

/** Situação de uma data de retorno em relação a hoje: 'atrasado' | 'hoje' | 'proximo' | null. */
export function situacaoRetorno(retornoEm, hoje = new Date()) {
  const [a, m, d] = String(retornoEm || '').split('-').map(Number);
  if (!a) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((new Date(a, m - 1, d) - h) / 86400000);
  return dias < 0 ? 'atrasado' : dias === 0 ? 'hoje' : 'proximo';
}

/**
 * Resumo para listas e cartões.
 * - ultima: a conversa mais recente
 * - valor: o valor mais recente que alguém nos passou (com quando e quais datas)
 * - retornoEm: o combinado de retorno da ÚLTIMA conversa (se houve conversa depois, vale a dela)
 */
export function resumoContatos(lista) {
  const ordenadas = [...lista].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const ultima = ordenadas[0] || null;
  const comValor = ordenadas.find((i) => textoValor(i));
  return {
    total: ordenadas.length,
    ultima,
    valor: comValor ? { texto: textoValor(comValor), datas: comValor.datas || '', data: comValor.data } : null,
    retornoEm: ultima?.retornoEm || ''
  };
}

/** A etapa que vale para o lugar: a escolhida; sem escolha, deduz pela existência de conversas. */
export function etapaDoLugar(lugar, interacoes = []) {
  if (lugar?.etapaContato) return lugar.etapaContato;
  return interacoes.length ? 'contatado' : '';
}
