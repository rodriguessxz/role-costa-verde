// Testes da lógica pura do "sistema completo": conflitos, tempo, roteiro e OpenStreetMap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camposAlterados, conflitos } from './conflito.js';
import { tempoRelativo, diasAte, dataCurta } from './tempo.js';
import { mover, analisarDia, atividadesDoDia, horaParaMin } from './roteiro.js';
import { tipoDoResultado, converterFeatureRapida, caixaEmVolta } from './geocode.js';
import { mesclarResultados, planoRapido, montarConsulta, converterResposta, categoriaDasTags } from './osm.js';

test('conflito: só vira conflito se o OUTRO mudou o mesmo campo para outro valor', () => {
  const base = { nome: 'A', descricao: 'x', preco: 10 };
  const minhas = camposAlterados(base, { nome: 'B', descricao: 'x', preco: 10, atualizadoEm: 'z' });
  assert.deepEqual(minhas, { nome: 'B' });
  assert.deepEqual(conflitos(base, { ...base, preco: 20 }, minhas), []); // outro mexeu em campo diferente
  assert.deepEqual(conflitos(base, { ...base, nome: 'C' }, minhas), ['nome']); // mesmo campo, valor diferente
  assert.deepEqual(conflitos(base, { ...base, nome: 'B' }, minhas), []); // mesmo valor: sem conflito
  assert.deepEqual(conflitos(base, null, minhas), []); // registro apagado: sem o que comparar
  assert.deepEqual(camposAlterados({ a: undefined, t: [] }, { a: "", t: [] }), {}); // vazio não é mudança
});

test('tempo relativo e datas', () => {
  const agora = Date.parse('2026-10-22T12:00:00Z');
  assert.equal(tempoRelativo('2026-10-22T11:58:00Z', agora), 'há 2 min');
  assert.equal(tempoRelativo('2026-10-22T09:00:00Z', agora), 'há 3 h');
  assert.equal(tempoRelativo('2026-10-21T10:00:00Z', agora), 'ontem');
  assert.equal(diasAte('2026-12-23', new Date(2026, 9, 22)), 62);
  assert.equal(dataCurta('2026-12-23'), '23 dez');
  assert.equal(dataCurta(''), '');
});

test('roteiro: mover renumera; analisarDia avisa conflito e não inventa aviso sem dados', () => {
  const lista = [{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }, { id: 'c', ordem: 3 }];
  assert.deepEqual(mover(lista, 'c', -1), [{ id: 'a', ordem: 1 }, { id: 'c', ordem: 2 }, { id: 'b', ordem: 3 }]);
  assert.deepEqual(mover(lista, 'a', -1), []); // já é o primeiro
  assert.equal(horaParaMin('09:30'), 570);
  assert.equal(horaParaMin('abc'), null);

  const lugares = { x: { lat: -23.2, lng: -44.7 }, y: { lat: -23.4, lng: -45.0 } };
  const ativs = [
    { id: '1', lugarId: 'x', horaInicio: '09:00', duracaoMin: 120, ordem: 1, diaId: 'd' },
    { id: '2', lugarId: 'y', horaInicio: '10:00', duracaoMin: 60, ordem: 2, diaId: 'd' },
    { id: '3', lugarId: 'x', horaInicio: '11:10', duracaoMin: 60, ordem: 3, diaId: 'd' }
  ];
  const r = analisarDia(atividadesDoDia(ativs, 'd'), (a) => lugares[a.lugarId]);
  assert.match(r[1].avisos[0], /Conflito de horário/);
  assert.match(r[2].avisos[0], /Deslocamento apertado/);
  assert.equal(r[0].trecho, null);
  assert.ok(r[1].trecho.km > 20);

  const semDados = analisarDia([{ id: 'p' }, { id: 'q' }], () => null);
  assert.deepEqual(semDados.map((x) => x.avisos.length), [0, 0]);

  // plano B não entra na conta de conflito
  const planoB = analisarDia([
    { id: '1', horaInicio: '09:00', duracaoMin: 120 },
    { id: '2', horaInicio: '10:00', duracaoMin: 60, alternativa: true }
  ], () => null);
  assert.equal(planoB[1].avisos.length, 0);
});

test('osm: consulta, conversão e campos ausentes ficam indefinidos', () => {
  const q = montarConsulta(['posto'], { lat: -23.2, lng: -44.7 }, 5000, 'sho"p');
  assert.match(q, /nwr\["amenity"="fuel"\]\["name"~"sho\\"p",i\]\(around:5000,-23.2,-44.7\)/);
  assert.match(montarConsulta([], { lat: 1, lng: 2 }, 1000), /natural"="beach/);
  assert.equal(categoriaDasTags({ amenity: 'parking' }), 'estacionamento');

  const res = converterResposta({
    elements: [
      { type: 'node', id: 2, lat: -23.25, lon: -44.7, tags: { name: 'Longe', tourism: 'camp_site', fee: 'yes', toilets: 'yes' } },
      { type: 'way', id: 1, center: { lat: -23.201, lon: -44.701 }, tags: { name: 'Perto', natural: 'beach' } },
      { type: 'node', id: 3, lat: -23.2, lon: -44.7, tags: { natural: 'peak' } }, // sem nome: descartado
      { type: 'node', id: 2, lat: -23.25, lon: -44.7, tags: { name: 'Longe' } } // repetido
    ]
  }, { lat: -23.2, lng: -44.7 });
  assert.deepEqual(res.map((r) => r.nome), ['Perto', 'Longe']);
  assert.equal(res[0].telefone, undefined);
  assert.equal(res[0].pago, undefined);
  assert.equal(res[1].pago, true);
  assert.deepEqual(res[1].estrutura, ['banheiro']);
  assert.equal(res[0].fonteUrl, 'https://www.openstreetmap.org/way/1');
});

test('geocode: restaurante e hospedagem', () => {
  assert.equal(tipoDoResultado({ osm_key: 'amenity', osm_value: 'restaurant' }), 'restaurante');
  assert.equal(tipoDoResultado({ osm_key: 'tourism', osm_value: 'guest_house' }), 'hospedagem');
});

test('busca rápida: plano, caixa e conversão', () => {
  assert.deepEqual(planoRapido([], 'sono'), [{ q: 'sono' }]);
  assert.deepEqual(planoRapido(['camping'], ''), [{ q: 'camping', tag: 'tourism:camp_site' }]);
  assert.deepEqual(planoRapido(['posto'], 'ipiranga'), [{ q: 'ipiranga', tag: 'amenity:fuel' }]);
  assert.equal(planoRapido([], '').length, 8);
  const caixa = caixaEmVolta({ lat: -23.3, lng: -44.7 }, 10).split(',').map(Number);
  assert.ok(caixa[0] < -44.7 && caixa[2] > -44.7 && caixa[1] < -23.3 && caixa[3] > -23.3);
  const r = converterFeatureRapida({
    geometry: { coordinates: [-44.72, -23.36] },
    properties: { name: 'Praia X', osm_key: 'natural', osm_value: 'beach', osm_type: 'R', osm_id: 99, city: 'Paraty' }
  }, { lat: -23.36, lng: -44.72 });
  assert.deepEqual([r.osmId, r.categoria, r.tipo, r.endereco, r.rapida], ['relation/99', 'praia', 'praia', 'Paraty', true]);
  assert.equal(r.telefone, undefined);
});

test('mesclar: completos têm prioridade e não repete', () => {
  const m = mesclarResultados(
    [{ osmId: 'node/1', nome: 'A completo', distanciaKm: 2, telefone: '1' }],
    [{ osmId: 'node/1', nome: 'A rápido', distanciaKm: 2 }, { osmId: 'node/2', nome: 'B', distanciaKm: 1 }]
  );
  assert.deepEqual(m.map((r) => r.nome), ['B', 'A completo']);
});
