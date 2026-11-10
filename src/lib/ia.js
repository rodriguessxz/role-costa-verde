// IA do Rolê — lógica PURA (sem rede, sem DOM): monta o contexto da viagem, valida o que a IA propõe
// e simula o resultado ANTES de qualquer coisa ser gravada. A IA só sugere; quem aplica é a pessoa.
import { distanciaKm, temCoord } from './geo.js';
import { ordenarDias, atividadesDoDia, horaParaMin } from './roteiro.js';
import { ETAPAS, interacoesDoLugar, resumoContatos, etapaDoLugar, situacaoRetorno } from './contatos.js';

const SEM_CONTATO = true; // telefone, e-mail e Instagram NUNCA vão para a IA (privacidade)

/* ------------------------------------------------------------------ */
/* Contexto da viagem                                                  */
/* ------------------------------------------------------------------ */

const ABERTOS = ['ideia', 'avaliar', 'quero-ir', 'planejado', 'confirmado'];
const corta = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Resumo compacto (texto) da viagem para a IA. Só dados que ajudam a decidir; sem telefone/e-mail.
 * @param d { viagem, lugares, dias, atividades, notas, listas, itens, interacoes }
 */
export function contextoViagem(d, hoje = new Date(), { maxLugares = 60, maxNotas = 12 } = {}) {
  void SEM_CONTATO;
  const v = d.viagem || {};
  const lugares = d.lugares || [];
  const dias = ordenarDias(d.dias || []);
  const atividades = d.atividades || [];
  const interacoes = d.interacoes || [];
  const lugarPorId = new Map(lugares.map((l) => [l.id, l]));
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const linhas = [];

  linhas.push(`HOJE: ${iso}`);
  linhas.push(`VIAGEM: ${corta(v.nome, 80)} | ${corta(v.roteiro, 60)} | de ${v.inicio || '?'} a ${v.fim || '?'} | 2 pessoas, camping`);

  linhas.push('ROTEIRO (dia/atividade com [id]; "conf"=confirmada, "B"=plano B, "feita"):');
  const descAtiv = (a) => {
    const l = a.lugarId ? lugarPorId.get(a.lugarId) : null;
    const marcas = [a.confirmada && 'conf', a.alternativa && 'B', a.feito && 'feita'].filter(Boolean).join(',');
    return `  - [${a.id}] ${a.horaInicio || '--:--'}${a.duracaoMin ? ` ${a.duracaoMin}min` : ''} ${corta(a.titulo || l?.nome, 70)}${l ? ` (lugar:${l.id}, ${l.tipo})` : ''}${marcas ? ` {${marcas}}` : ''}`;
  };
  if (!dias.length) linhas.push('  (nenhum dia criado)');
  for (const dia of dias) {
    linhas.push(`[${dia.id}] ${corta(dia.titulo, 60)}${dia.data ? ` (${dia.data})` : ''}${dia.regiao ? ` região:${dia.regiao}` : ''}${dia.nota ? ` nota:${corta(dia.nota, 60)}` : ''}`);
    const doDia = atividadesDoDia(atividades, dia.id);
    linhas.push(...(doDia.length ? doDia.map(descAtiv) : ['  (vazio)']));
  }
  const banco = atividadesDoDia(atividades, '');
  if (banco.length) { linhas.push('BANCO (sem dia):'); linhas.push(...banco.map(descAtiv)); }

  // lugares: os que já estão no roteiro, favoritos e em andamento primeiro
  const noRoteiro = new Set(atividades.map((a) => a.lugarId).filter(Boolean));
  const peso = (l) => (noRoteiro.has(l.id) ? 0 : l.favorito ? 1 : ['planejado', 'confirmado'].includes(l.status) ? 2 : 3);
  const lista = lugares.filter((l) => l.status !== 'descartado')
    .sort((a, b) => peso(a) - peso(b) || (b.prioridade || 0) - (a.prioridade || 0)).slice(0, maxLugares);
  linhas.push('LUGARES SALVOS (lugar:id | nome | tipo | região | status | etapa de contato | detalhes):');
  for (const l of lista) {
    const inter = interacoesDoLugar(interacoes, l.id);
    const r = resumoContatos(inter);
    const etapa = etapaDoLugar(l, inter);
    const detalhes = [
      l.dificuldade && `dif:${l.dificuldade}`, l.duracaoMin && `${l.duracaoMin}min`, l.acesso && `acesso:${l.acesso}`,
      l.precoNoite && `R$${l.precoNoite}/noite`, l.reservaNecessaria && 'reserva', r.valor && `valor informado:${r.valor.texto}${r.valor.datas ? ` (${r.valor.datas})` : ''}`,
      l.favorito && 'favorito', noRoteiro.has(l.id) && 'no roteiro'
    ].filter(Boolean).join(', ');
    linhas.push(`lugar:${l.id} | ${corta(l.nome, 60)} | ${l.tipo} | ${l.regiao || '-'} | ${l.status || 'quero-ir'} | ${etapa ? ETAPAS[etapa]?.rotulo : '-'} | ${detalhes}`);
  }
  if (lugares.length > lista.length) linhas.push(`(+${lugares.length - lista.length} lugares omitidos)`);

  const abertos = lugares.filter((l) => l.tipo === 'camping' && ABERTOS.includes(l.status || 'quero-ir'));
  const retornos = abertos.filter((l) => {
    const r = resumoContatos(interacoesDoLugar(interacoes, l.id));
    return r.retornoEm && ['atrasado', 'hoje'].includes(situacaoRetorno(r.retornoEm, hoje));
  });
  if (retornos.length) linhas.push(`RETORNOS PENDENTES AGORA: ${retornos.map((l) => corta(l.nome, 40)).join('; ')}`);

  const itens = d.itens || [];
  if (itens.length) linhas.push(`CHECKLIST: ${itens.filter((i) => i.feito).length}/${itens.length} itens prontos; faltam: ${itens.filter((i) => !i.feito).slice(0, 15).map((i) => corta(i.texto, 30)).join(', ')}`);

  const notas = [...(d.notas || [])].sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm))).slice(0, maxNotas);
  if (notas.length) linhas.push(`ANOTAÇÕES RECENTES:\n${notas.map((n) => `  - ${corta(n.titulo, 40)}: ${corta(n.texto, 100)}`).join('\n')}`);

  return linhas.join('\n');
}

/** Distâncias em linha reta (km) entre os lugares citados, para a IA não "chutar" deslocamentos. */
export function matrizDistancias(lugares, ids, { maxLugares = 22 } = {}) {
  const uteis = ids.map((id) => lugares.find((l) => l.id === id)).filter((l) => l && temCoord(l)).slice(0, maxLugares);
  const linhas = [];
  for (let i = 0; i < uteis.length; i++) {
    for (let j = i + 1; j < uteis.length; j++) {
      linhas.push(`${uteis[i].id} ↔ ${uteis[j].id}: ${Math.round(distanciaKm(uteis[i], uteis[j]))} km`);
    }
  }
  return linhas.join('\n');
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export const INSTRUCAO_BASE = `Você é o assistente de planejamento de uma viagem de camping de duas pessoas entre Ubatuba (SP) e Paraty (RJ).
Responda sempre em português do Brasil, de forma curta, prática e amigável.
Use SOMENTE os dados do contexto para falar do que a dupla já salvou. Nunca invente telefone, preço, horário de funcionamento,
disponibilidade de vaga, condição de estrada, previsão do tempo ou tempo de deslocamento: se não souber, diga que precisa confirmar.
Distâncias do contexto são em linha reta; estradas serpenteiam, então o tempo real costuma ser bem maior.
Se algo depender de reserva, maré, barco ou chuva, lembre de confirmar antes de ir.`;

/** Instrução de sistema do chat: regras + contexto atual da viagem. */
export const instrucaoChat = (contexto, extra = '') => `${INSTRUCAO_BASE}\n${extra ? `${extra}\n` : ''}\n=== CONTEXTO DA VIAGEM ===\n${contexto}`;

const ESQUEMA_PLANO = `Responda APENAS com um objeto JSON (sem texto fora dele, sem markdown) neste formato:
{
  "resumo": "1 a 3 frases explicando a proposta",
  "operacoes": [
    {"tipo":"criar_dia","ref":"d1","titulo":"Dia 3 — Trindade","data":"","regiao":"trindade"},
    {"tipo":"mover","atividadeId":"<id>","paraDia":"<id do dia | ref criada antes | vazio para o banco>","posicao":1},
    {"tipo":"adicionar","lugarId":"<id de lugar salvo>","titulo":"<opcional se lugarId>","paraDia":"<id ou ref>","horaInicio":"09:00","duracaoMin":120,"alternativa":false,"motivo":"por quê"},
    {"tipo":"ajustar_horario","atividadeId":"<id>","horaInicio":"10:30","duracaoMin":90},
    {"tipo":"marcar_plano_b","atividadeId":"<id>","alternativa":true}
  ],
  "avisos": ["coisas que precisam ser confirmadas"]
}
Regras:
- Use apenas ids que aparecem no contexto. Não invente ids nem lugares: para atividades livres use "titulo" sem "lugarId".
- NÃO altere atividades marcadas {conf} (confirmadas) nem {feita}.
- Para tirar algo de um dia sem apagar, mova para o banco (paraDia vazio). Nunca apague nada.
- Agrupe por proximidade usando as distâncias fornecidas; evite voltar e ir entre regiões distantes no mesmo dia.
- Só informe horário/duração quando tiver base (duração do lugar, pedido da pessoa). Na dúvida, deixe horaInicio vazio.
- No máximo 30 operações. Se a instrução não exigir mudanças, devolva "operacoes": [] e explique no resumo.`;

/** Prompt para "ajustar/recalcular o roteiro". Devolve { sistema, usuario } (a resposta esperada é JSON). */
export function promptAjusteRoteiro(dados, instrucao, hoje = new Date()) {
  const contexto = contextoViagem(dados, hoje);
  const ids = [...new Set([
    ...(dados.atividades || []).map((a) => a.lugarId).filter(Boolean),
    ...(dados.lugares || []).filter((l) => l.status !== 'descartado').map((l) => l.id)
  ])];
  const dist = matrizDistancias(dados.lugares || [], ids);
  return {
    sistema: `${INSTRUCAO_BASE}\nVocê vai propor mudanças no ROTEIRO. Quem decide é a dupla: suas operações aparecem como prévia e só valem se aprovadas.\n\n${ESQUEMA_PLANO}\n\n=== CONTEXTO DA VIAGEM ===\n${contexto}\n\n=== DISTÂNCIAS EM LINHA RETA ===\n${dist || '(sem coordenadas suficientes)'}`,
    usuario: `Pedido da dupla: ${corta(instrucao, 600) || 'Organize o roteiro de forma mais eficiente.'}`
  };
}

/** Prompt para rascunhar uma mensagem de contato com um camping/hospedagem. Resposta: texto simples. */
export function promptMensagemContato({ lugar, viagem = {}, interacoes = [], canal = 'whatsapp', perguntas = [], datas = '', pessoas = 2 }) {
  const r = resumoContatos(interacoes);
  const historico = interacoes.slice(0, 4).map((i) => `- ${corta(i.texto, 160)}${i.valor ? ` (valor: ${i.valor})` : ''}`).join('\n');
  return {
    sistema: `${INSTRUCAO_BASE}\nEscreva UMA mensagem pronta para enviar por ${canal === 'email' ? 'e-mail (com assunto na 1ª linha: "Assunto: ...")' : 'WhatsApp (curta, sem formalidade excessiva, sem emojis demais)'}.
Não invente fatos sobre o local nem prometa nada que a dupla não decidiu. Termine agradecendo. Não inclua telefone nem dados pessoais. Devolva só a mensagem.`,
    usuario: `Local: ${corta(lugar.nome, 80)} (${lugar.tipo}${lugar.regiao ? `, ${lugar.regiao}` : ''}).
Somos ${pessoas} pessoas, vamos de barraca.
Datas: ${corta(datas, 100) || `entre ${viagem.inicio || '?'} e ${viagem.fim || '?'} (flexível)`}.
Queremos saber: ${perguntas.length ? perguntas.join('; ') : 'se há vaga e qual o valor'}.
${historico ? `Conversas anteriores (não repita o que já sabemos):\n${historico}${r.valor ? `\nÚltimo valor informado: ${r.valor.texto}` : ''}` : 'É o primeiro contato.'}`
  };
}

/* ------------------------------------------------------------------ */
/* Resposta da IA → plano seguro                                       */
/* ------------------------------------------------------------------ */

/** Tira cercas de markdown e acha o primeiro objeto JSON do texto. Devolve null se não for JSON. */
export function extrairJson(texto = '') {
  let t = String(texto).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const REF = /^[a-z0-9_-]{1,20}$/i;
const MAX_OPS = 30;

/**
 * Confere cada operação proposta contra os dados REAIS. Nada de ids inventados, nada de mexer em
 * atividade confirmada/feita, nada de apagar. Devolve as operações limpas e as recusadas (com motivo).
 * @param estado { dias, atividades, lugares }
 */
export function validarPlano(plano, estado) {
  if (!plano || typeof plano !== 'object' || !Array.isArray(plano.operacoes)) {
    return { ok: false, erro: 'A resposta da IA não veio no formato esperado.', operacoes: [], rejeitadas: [], resumo: '', avisos: [] };
  }
  const diasIds = new Set((estado.dias || []).map((d) => d.id));
  const ativPorId = new Map((estado.atividades || []).map((a) => [a.id, a]));
  const lugaresIds = new Set((estado.lugares || []).map((l) => l.id));
  const refs = new Set();
  const operacoes = [];
  const rejeitadas = [];
  const rejeitar = (op, motivo) => rejeitadas.push({ op, motivo });

  const destinoOk = (v) => v === '' || v === null || v === undefined || diasIds.has(v) || refs.has(v);
  const protegida = (a) => a.confirmada || a.feito;
  const num = (v, min, max) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : null);
  const hora = (v) => (HORA.test(String(v || '')) ? String(v) : '');

  for (const bruta of plano.operacoes.slice(0, MAX_OPS)) {
    const op = bruta && typeof bruta === 'object' ? bruta : {};
    switch (op.tipo) {
      case 'criar_dia': {
        const ref = String(op.ref || '');
        if (!REF.test(ref) || refs.has(ref) || diasIds.has(ref)) { rejeitar(op, 'Referência do novo dia inválida ou repetida'); break; }
        if (!corta(op.titulo, 120)) { rejeitar(op, 'Novo dia sem nome'); break; }
        refs.add(ref);
        operacoes.push({ tipo: 'criar_dia', ref, titulo: corta(op.titulo, 120), data: /^\d{4}-\d{2}-\d{2}$/.test(op.data || '') ? op.data : '', regiao: String(op.regiao || '').slice(0, 30) });
        break;
      }
      case 'mover': {
        const a = ativPorId.get(op.atividadeId);
        if (!a) { rejeitar(op, 'Atividade que não existe'); break; }
        if (protegida(a)) { rejeitar(op, `“${corta(a.titulo, 40)}” está confirmada ou feita: não mexo`); break; }
        if (!destinoOk(op.paraDia)) { rejeitar(op, 'Dia de destino que não existe'); break; }
        operacoes.push({ tipo: 'mover', atividadeId: a.id, paraDia: op.paraDia || '', posicao: num(op.posicao, 1, 99) });
        break;
      }
      case 'adicionar': {
        if (op.lugarId && !lugaresIds.has(op.lugarId)) { rejeitar(op, 'Lugar que não está salvo'); break; }
        const lugar = op.lugarId ? (estado.lugares || []).find((l) => l.id === op.lugarId) : null;
        const titulo = corta(op.titulo || lugar?.nome, 200);
        if (!titulo) { rejeitar(op, 'Atividade sem nome'); break; }
        if (!destinoOk(op.paraDia)) { rejeitar(op, 'Dia de destino que não existe'); break; }
        const duplicada = op.lugarId && (estado.atividades || []).some((a) => a.lugarId === op.lugarId && (a.diaId || '') === (op.paraDia || ''));
        if (duplicada) { rejeitar(op, `“${titulo}” já está nesse dia`); break; }
        operacoes.push({
          tipo: 'adicionar', lugarId: op.lugarId || '', titulo, paraDia: op.paraDia || '', posicao: num(op.posicao, 1, 99),
          horaInicio: hora(op.horaInicio), duracaoMin: num(op.duracaoMin, 5, 1440), alternativa: Boolean(op.alternativa), motivo: corta(op.motivo, 160)
        });
        break;
      }
      case 'ajustar_horario': {
        const a = ativPorId.get(op.atividadeId);
        if (!a) { rejeitar(op, 'Atividade que não existe'); break; }
        if (protegida(a)) { rejeitar(op, `“${corta(a.titulo, 40)}” está confirmada ou feita: não mexo`); break; }
        operacoes.push({ tipo: 'ajustar_horario', atividadeId: a.id, horaInicio: hora(op.horaInicio), duracaoMin: num(op.duracaoMin, 5, 1440) });
        break;
      }
      case 'marcar_plano_b': {
        const a = ativPorId.get(op.atividadeId);
        if (!a) { rejeitar(op, 'Atividade que não existe'); break; }
        if (protegida(a)) { rejeitar(op, `“${corta(a.titulo, 40)}” está confirmada ou feita: não mexo`); break; }
        operacoes.push({ tipo: 'marcar_plano_b', atividadeId: a.id, alternativa: Boolean(op.alternativa) });
        break;
      }
      default:
        rejeitar(op, `Tipo de operação não permitido (${corta(op.tipo, 20) || 'vazio'})`);
    }
  }
  if (plano.operacoes.length > MAX_OPS) rejeitar({}, `Passou de ${MAX_OPS} operações: o resto foi ignorado`);

  return {
    ok: true,
    operacoes,
    rejeitadas,
    resumo: corta(plano.resumo, 500),
    avisos: (Array.isArray(plano.avisos) ? plano.avisos : []).map((x) => corta(x, 200)).filter(Boolean).slice(0, 8)
  };
}

/* ------------------------------------------------------------------ */
/* Simulação (prévia) e plano de gravação                              */
/* ------------------------------------------------------------------ */

/**
 * Aplica as operações VALIDADAS numa cópia em memória e devolve como o roteiro ficaria.
 * @returns {{ dias:Array, banco:Array, mudancas:string[], atividades:Array }}
 */
export function simularPlano(estado, operacoes) {
  const dias = ordenarDias(estado.dias || []).map((d) => ({ ...d }));
  const ativs = (estado.atividades || []).map((a) => ({
    ...a,
    diaId: a.diaId || '',
    _antes: { diaId: a.diaId || '', ordem: a.ordem ?? 0, horaInicio: a.horaInicio || '', duracaoMin: a.duracaoMin ?? null, alternativa: !!a.alternativa }
  }));
  const lugares = new Map((estado.lugares || []).map((l) => [l.id, l]));
  const mudancas = [];
  let contadorNovas = 0;

  const lista = (diaId) => ativs.filter((a) => a.diaId === diaId).sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0));
  const nomeDia = (id) => (id === '' ? 'o banco de atividades' : `“${corta(dias.find((d) => d.id === id)?.titulo || id, 50)}”`);
  const resolver = (v) => (v ? (dias.some((d) => d.id === v) ? v : `ref:${v}`) : '');
  const colocar = (a, diaId, posicao) => {
    const outros = lista(diaId).filter((x) => x.id !== a.id);
    const idx = posicao ? Math.min(posicao - 1, outros.length) : outros.length;
    outros.splice(idx, 0, a);
    a.diaId = diaId;
    outros.forEach((x, i) => { x.ordem = i + 1; });
  };

  for (const op of operacoes) {
    if (op.tipo === 'criar_dia') {
      dias.push({ id: `ref:${op.ref}`, titulo: op.titulo, data: op.data, regiao: op.regiao, ordem: Math.max(0, ...dias.map((d) => d.ordem ?? 0)) + 1, nova: true });
      mudancas.push(`Criar o dia “${op.titulo}”`);
    } else if (op.tipo === 'mover') {
      const a = ativs.find((x) => x.id === op.atividadeId);
      const antes = nomeDia(a.diaId);
      colocar(a, resolver(op.paraDia), op.posicao);
      mudancas.push(`Mover “${corta(a.titulo, 50)}” de ${antes} para ${nomeDia(a.diaId)}${op.posicao ? ` (posição ${op.posicao})` : ''}`);
    } else if (op.tipo === 'adicionar') {
      contadorNovas += 1;
      const lugar = op.lugarId ? lugares.get(op.lugarId) : null;
      const nova = {
        id: `nova:${contadorNovas}`, titulo: op.titulo, lugarId: op.lugarId, horaInicio: op.horaInicio, duracaoMin: op.duracaoMin,
        alternativa: op.alternativa, confirmada: false, feito: false, diaId: '', ordem: 0, nova: true, motivo: op.motivo, tipoLugar: lugar?.tipo,
        _antes: null
      };
      ativs.push(nova);
      colocar(nova, resolver(op.paraDia), op.posicao);
      mudancas.push(`Adicionar “${corta(op.titulo, 50)}” em ${nomeDia(nova.diaId)}${op.horaInicio ? ` às ${op.horaInicio}` : ''}${op.motivo ? ` — ${op.motivo}` : ''}`);
    } else if (op.tipo === 'ajustar_horario') {
      const a = ativs.find((x) => x.id === op.atividadeId);
      a.horaInicio = op.horaInicio;
      if (op.duracaoMin !== null) a.duracaoMin = op.duracaoMin;
      mudancas.push(`Ajustar “${corta(a.titulo, 50)}”: ${op.horaInicio || 'sem horário'}${op.duracaoMin ? `, ${op.duracaoMin} min` : ''}`);
    } else if (op.tipo === 'marcar_plano_b') {
      const a = ativs.find((x) => x.id === op.atividadeId);
      a.alternativa = op.alternativa;
      mudancas.push(`${op.alternativa ? 'Marcar como plano B' : 'Tirar de plano B'}: “${corta(a.titulo, 50)}”`);
    }
  }

  return {
    dias: dias.map((d) => ({ ...d, atividades: lista(d.id) })),
    banco: lista(''),
    mudancas,
    atividades: ativs
  };
}

/** O que de fato precisa ser gravado para chegar ao resultado simulado. */
export function planoDeGravacao(simulacao) {
  const criarDias = simulacao.dias.filter((d) => d.nova).map((d) => ({ ref: d.id, titulo: d.titulo, data: d.data || '', regiao: d.regiao || '', ordem: d.ordem }));
  const criarAtividades = simulacao.atividades.filter((a) => a.nova).map((a) => ({
    ref: a.id, diaId: a.diaId, lugarId: a.lugarId || '', titulo: a.titulo, horaInicio: a.horaInicio || '', duracaoMin: a.duracaoMin ?? null,
    alternativa: !!a.alternativa, confirmada: false, feito: false, ordem: a.ordem
  }));
  const atualizar = [];
  for (const a of simulacao.atividades) {
    if (a.nova) continue;
    const campos = {};
    if (a.diaId !== a._antes.diaId) campos.diaId = a.diaId;
    if (a.ordem !== a._antes.ordem) campos.ordem = a.ordem;
    if ((a.horaInicio || '') !== a._antes.horaInicio) campos.horaInicio = a.horaInicio || '';
    if ((a.duracaoMin ?? null) !== a._antes.duracaoMin) campos.duracaoMin = a.duracaoMin ?? null;
    if (!!a.alternativa !== a._antes.alternativa) campos.alternativa = !!a.alternativa;
    if (Object.keys(campos).length) {
      // o que já era: usado para DESFAZER
      const antes = Object.fromEntries(Object.keys(campos).map((k) => [k, a._antes[k]]));
      atualizar.push({ id: a.id, campos, antes });
    }
  }
  return { criarDias, criarAtividades, atualizar };
}

/** Avisos de horário/deslocamento no roteiro SIMULADO (mesma análise da tela de Roteiro). */
export function avisosDoPlano(simulacao, lugares, analisar) {
  const porId = new Map(lugares.map((l) => [l.id, l]));
  const avisos = [];
  for (const dia of simulacao.dias) {
    const analise = analisar(dia.atividades, (a) => (a.lugarId ? porId.get(a.lugarId) : null));
    analise.forEach((r, i) => r.avisos.forEach((t) => avisos.push(`${corta(dia.titulo, 40)} · ${corta(dia.atividades[i].titulo, 40)}: ${t}`)));
  }
  return avisos;
}

/** Quantos minutos de "folga" faltam para o dia caber? (soma das durações conhecidas) — usado só como dica. */
export const minutosPlanejados = (atividades) => atividades.filter((a) => !a.alternativa).reduce((s, a) => s + (a.duracaoMin || 0), 0);
export { horaParaMin };

/* ------------------------------------------------------------------ */
/* Markdown básico → HTML seguro                                       */
/* ------------------------------------------------------------------ */

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** **negrito**, *itálico*, `código`, listas, parágrafos e links http(s). Sempre escapa antes. */
export function markdownBasico(texto = '') {
  const inline = (linha) => escHtml(linha)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const blocos = [];
  let lista = null;
  const fechar = () => { if (lista) { blocos.push(`<${lista.tag}>${lista.itens.join('')}</${lista.tag}>`); lista = null; } };
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.trimEnd();
    const item = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(linha);
    if (item) {
      const tag = item[1] ? 'ol' : 'ul';
      if (!lista || lista.tag !== tag) { fechar(); lista = { tag, itens: [] }; }
      lista.itens.push(`<li>${inline(item[2])}</li>`);
    } else if (!linha.trim()) {
      fechar();
    } else {
      fechar();
      const titulo = /^#{1,3}\s+(.*)$/.exec(linha);
      blocos.push(titulo ? `<p><strong>${inline(titulo[1])}</strong></p>` : `<p>${inline(linha)}</p>`);
    }
  }
  fechar();
  return blocos.join('');
}
