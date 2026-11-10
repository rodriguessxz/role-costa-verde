// Testes da IA: contexto, validação do plano, simulação e cliente Gemini (partes puras).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contextoViagem, matrizDistancias, extrairJson, validarPlano, simularPlano, planoDeGravacao, avisosDoPlano,
  promptAjusteRoteiro, promptMensagemContato, markdownBasico
} from './ia.js';
import { analisarDia } from './roteiro.js';
import { escolherModelo, montarCorpo, lerResposta, classificarErro, ErroIA } from './gemini.js';

const lugares = [
  { id: 'l1', nome: 'Praia do Sono', tipo: 'praia', regiao: 'paraty', status: 'quero-ir', lat: -23.31, lng: -44.72, telefone: '(24) 99999-1111', contato: '24988887777', email: 'a@b.com' },
  { id: 'l2', nome: 'Camping do Zé', tipo: 'camping', regiao: 'trindade', status: 'planejado', lat: -23.36, lng: -44.72, precoNoite: 80, reservaNecessaria: true, instagram: '@ze' },
  { id: 'l3', nome: 'Cachoeira Longe', tipo: 'cachoeira', regiao: 'ubatuba-sul', status: 'ideia', lat: -23.5, lng: -45.1 },
  { id: 'l4', nome: 'Descartado', tipo: 'praia', status: 'descartado' }
];
const dias = [{ id: 'd1', titulo: 'Dia 1', ordem: 1, data: '2026-12-23' }, { id: 'd2', titulo: 'Dia 2', ordem: 2 }];
const atividades = [
  { id: 'a1', diaId: 'd1', lugarId: 'l1', titulo: 'Praia do Sono', ordem: 1, horaInicio: '09:00', duracaoMin: 120 },
  { id: 'a2', diaId: 'd1', lugarId: 'l2', titulo: 'Camping do Zé', ordem: 2, confirmada: true },
  { id: 'a3', diaId: 'd2', lugarId: 'l3', titulo: 'Cachoeira Longe', ordem: 1 },
  { id: 'a4', diaId: 'd2', titulo: 'Atividade feita', ordem: 2, feito: true },
  { id: 'a5', diaId: '', titulo: 'Comprar gelo', ordem: 1 }
];
const estado = { dias, atividades, lugares };

test('contexto: tem ids e dados úteis, mas NUNCA telefone, e-mail ou Instagram', () => {
  const c = contextoViagem({ viagem: { nome: 'Rolê', inicio: '2026-12-23', fim: '2027-01-06' }, lugares, dias, atividades, notas: [], itens: [{ texto: 'Barraca', feito: false }], interacoes: [] }, new Date(2026, 10, 10));
  assert.match(c, /HOJE: 2026-11-10/);
  assert.match(c, /\[d1\] Dia 1/);
  assert.match(c, /\[a2\].*\{conf\}/);
  assert.match(c, /lugar:l2 \| Camping do Zé \| camping \| trindade \| planejado/);
  assert.match(c, /R\$80\/noite/);
  assert.doesNotMatch(c, /99999|98888|a@b\.com|@ze/);
  assert.doesNotMatch(c, /Descartado/); // descartados ficam de fora
  assert.match(c, /BANCO/);
});

test('distâncias entre lugares citados', () => {
  const m = matrizDistancias(lugares, ['l1', 'l2', 'l4']); // l4 sem coordenada é ignorado
  assert.match(m, /l1 ↔ l2: \d+ km/);
  assert.doesNotMatch(m, /l4/);
});

test('extrairJson aceita cerca de markdown e texto em volta', () => {
  assert.deepEqual(extrairJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJson('Claro! {"a":{"b":2}} pronto'), { a: { b: 2 } });
  assert.equal(extrairJson('sem json'), null);
  assert.equal(extrairJson('{quebrado'), null);
});

test('validarPlano: recusa ids inventados, confirmadas/feitas e tipos não permitidos', () => {
  const r = validarPlano({
    resumo: 'ok',
    operacoes: [
      { tipo: 'criar_dia', ref: 'n1', titulo: 'Dia 3' },
      { tipo: 'mover', atividadeId: 'a3', paraDia: 'n1', posicao: 1 }, // válido (ref criada antes)
      { tipo: 'mover', atividadeId: 'a2', paraDia: 'd2' }, // confirmada
      { tipo: 'mover', atividadeId: 'a4', paraDia: 'd1' }, // feita
      { tipo: 'mover', atividadeId: 'xx', paraDia: 'd1' }, // não existe
      { tipo: 'mover', atividadeId: 'a1', paraDia: 'd9' }, // dia não existe
      { tipo: 'adicionar', lugarId: 'zzz', paraDia: 'd1' }, // lugar inventado
      { tipo: 'adicionar', lugarId: 'l1', paraDia: 'd1' }, // já está no dia
      { tipo: 'adicionar', lugarId: 'l3', paraDia: 'd1', horaInicio: '25:99', duracaoMin: 90 }, // hora inválida vira vazio
      { tipo: 'apagar', atividadeId: 'a1' }, // tipo proibido
      { tipo: 'marcar_plano_b', atividadeId: 'a5', alternativa: true }
    ]
  }, estado);
  assert.equal(r.ok, true);
  assert.deepEqual(r.operacoes.map((o) => o.tipo), ['criar_dia', 'mover', 'adicionar', 'marcar_plano_b']);
  assert.equal(r.operacoes[2].horaInicio, '');
  assert.equal(r.operacoes[2].duracaoMin, 90);
  assert.equal(r.rejeitadas.length, 7);
  assert.ok(r.rejeitadas.some((x) => /confirmada ou feita/.test(x.motivo)));
  assert.ok(r.rejeitadas.some((x) => /não permitido/.test(x.motivo)));
});

test('validarPlano: formato inesperado não quebra', () => {
  assert.equal(validarPlano(null, estado).ok, false);
  assert.equal(validarPlano({ operacoes: 'x' }, estado).ok, false);
  assert.equal(validarPlano({ operacoes: [] }, estado).operacoes.length, 0);
  const muitas = validarPlano({ operacoes: Array.from({ length: 50 }, () => ({ tipo: 'marcar_plano_b', atividadeId: 'a5', alternativa: true })) }, estado);
  assert.equal(muitas.operacoes.length, 30);
});

test('simularPlano e planoDeGravacao: mover, criar dia, adicionar e ajustar', () => {
  const v = validarPlano({
    operacoes: [
      { tipo: 'criar_dia', ref: 'n1', titulo: 'Dia 3 — Trindade', regiao: 'trindade' },
      { tipo: 'mover', atividadeId: 'a3', paraDia: 'n1', posicao: 1 },
      { tipo: 'mover', atividadeId: 'a5', paraDia: 'd1', posicao: 1 }, // do banco para o início do dia 1
      { tipo: 'adicionar', lugarId: 'l2', paraDia: 'n1', horaInicio: '15:00', duracaoMin: 60, motivo: 'perto' },
      { tipo: 'ajustar_horario', atividadeId: 'a1', horaInicio: '08:30' }
    ]
  }, estado);
  const sim = simularPlano(estado, v.operacoes);
  const d1 = sim.dias.find((d) => d.id === 'd1');
  assert.deepEqual(d1.atividades.map((a) => a.id), ['a5', 'a1', 'a2']); // a5 entrou na frente; ordem renumerada
  assert.deepEqual(d1.atividades.map((a) => a.ordem), [1, 2, 3]);
  assert.equal(d1.atividades.find((a) => a.id === 'a1').horaInicio, '08:30');
  assert.equal(d1.atividades.find((a) => a.id === 'a1').duracaoMin, 120); // duração mantida
  const d3 = sim.dias.find((d) => d.id === 'ref:n1');
  assert.deepEqual(d3.atividades.map((a) => a.id), ['a3', 'nova:1']);
  assert.equal(sim.banco.length, 0);
  assert.equal(sim.mudancas.length, 5);

  const g = planoDeGravacao(sim);
  assert.equal(g.criarDias.length, 1);
  assert.equal(g.criarAtividades.length, 1);
  assert.equal(g.criarAtividades[0].diaId, 'ref:n1');
  const porId = Object.fromEntries(g.atualizar.map((u) => [u.id, u]));
  assert.deepEqual(porId.a3.campos, { diaId: 'ref:n1' }); // a ordem já era 1: só o dia muda
  assert.deepEqual(porId.a3.antes, { diaId: 'd2' }); // guardado para desfazer
  assert.equal(porId.a1.campos.horaInicio, '08:30');
  // confirmadas/feitas nunca são alteradas pela IA; só a numeração da fila se ajusta em volta delas
  assert.deepEqual(porId.a2.campos, { ordem: 3 });
  assert.ok(!porId.a4); // fila de origem não precisa renumerar: a ordem relativa se mantém
});

test('simularPlano: sem operações não muda nada', () => {
  const sim = simularPlano(estado, []);
  const g = planoDeGravacao(sim);
  assert.deepEqual([g.criarDias.length, g.criarAtividades.length, g.atualizar.length], [0, 0, 0]);
});

test('avisosDoPlano reaproveita a análise de conflitos do roteiro', () => {
  const sim = simularPlano({ dias: [{ id: 'd', titulo: 'D', ordem: 1 }], atividades: [
    { id: 'x', diaId: 'd', titulo: 'X', ordem: 1, horaInicio: '09:00', duracaoMin: 120 },
    { id: 'y', diaId: 'd', titulo: 'Y', ordem: 2, horaInicio: '10:00', duracaoMin: 30 }
  ], lugares: [] }, []);
  const avisos = avisosDoPlano(sim, [], analisarDia);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Conflito de horário/);
});

test('prompts: ajuste traz instrução e esquema; mensagem não vaza contato', () => {
  const p = promptAjusteRoteiro({ viagem: {}, lugares, dias, atividades, notas: [], itens: [], interacoes: [] }, 'agrupe por proximidade', new Date(2026, 10, 10));
  assert.match(p.sistema, /Responda APENAS com um objeto JSON/);
  assert.match(p.sistema, /DISTÂNCIAS EM LINHA RETA/);
  assert.match(p.usuario, /agrupe por proximidade/);
  const m = promptMensagemContato({ lugar: lugares[1], viagem: { inicio: '2026-12-23', fim: '2027-01-06' }, interacoes: [{ texto: 'disse que tem vaga', valor: 90 }], perguntas: ['valor', 'pix'] });
  assert.match(m.usuario, /Camping do Zé/);
  assert.match(m.usuario, /valor; pix/);
  assert.doesNotMatch(m.sistema + m.usuario, /instagram|@ze|99999/i);
});

test('gemini: escolher modelo, corpo, resposta e erros', () => {
  const modelos = [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
  ];
  assert.equal(escolherModelo(modelos), 'gemini-3-flash');
  assert.equal(escolherModelo([]), '');

  const c = montarCorpo({ sistema: 'S', mensagens: [{ papel: 'user', texto: 'oi' }, { papel: 'model', texto: 'olá' }], json: true });
  assert.equal(c.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(c.contents.map((x) => x.role), ['user', 'model']);
  assert.equal(c.tools, undefined);
  const w = montarCorpo({ sistema: 'S', mensagens: [{ papel: 'user', texto: 'x' }], json: true, web: true });
  assert.equal(w.generationConfig.responseMimeType, undefined); // web e JSON forçado não combinam
  assert.deepEqual(w.tools, [{ google_search: {} }]);

  const r = lerResposta({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Olá ' }, { text: 'mundo' }] },
    groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a.com', title: 'A' } }, { web: { uri: 'https://a.com', title: 'A' } }], webSearchQueries: ['q'] } }] });
  assert.equal(r.texto, 'Olá mundo');
  assert.deepEqual(r.fontes, [{ titulo: 'A', uri: 'https://a.com' }]);
  assert.throws(() => lerResposta({ promptFeedback: { blockReason: 'SAFETY' } }), (e) => e instanceof ErroIA && e.tipo === 'bloqueio');
  assert.throws(() => lerResposta({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }), (e) => e.tipo === 'bloqueio');
  assert.equal(lerResposta({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x' }] } }] }).cortada, true);

  assert.equal(classificarErro(429, {}).tipo, 'limite');
  assert.equal(classificarErro(400, { error: { message: 'API key not valid', status: 'INVALID_ARGUMENT' } }).tipo, 'chave');
  assert.equal(classificarErro(403, {}).tipo, 'chave');
  assert.equal(classificarErro(404, {}).tipo, 'modelo');
  assert.equal(classificarErro(503, {}).tipo, 'rede');
});

test('markdown básico: escapa HTML, negrito, listas e links', () => {
  assert.equal(markdownBasico('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(markdownBasico('Olá **mundo**'), '<p>Olá <strong>mundo</strong></p>');
  assert.equal(markdownBasico('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(markdownBasico('1. um\n2. dois\n\nfim'), '<ol><li>um</li><li>dois</li></ol><p>fim</p>');
  assert.match(markdownBasico('veja https://exemplo.com/x.'), /<a href="https:\/\/exemplo\.com\/x" target="_blank" rel="noopener noreferrer">https:\/\/exemplo\.com\/x<\/a>\./);
  assert.doesNotMatch(markdownBasico('[x](javascript:alert(1))'), /<a /);
});
