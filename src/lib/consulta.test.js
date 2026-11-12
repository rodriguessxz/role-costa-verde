import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarConsulta, rotuloImportacao } from './consulta.js';
import { montarUrlBusca, converterNominatim, converterListaNominatim, escolherArea, dividirCaixa, caixaComMinimo, caixaEmVoltaDe } from './nominatim.js';

test('consulta: categoria + local, só categoria, nome livre', () => {
  let i = interpretarConsulta('camping em paraty');
  assert.deepEqual([i.categoria, i.local, i.nome], ['camping', 'paraty', '']);
  i = interpretarConsulta('Campings em Ubatuba');
  assert.deepEqual([i.categoria, i.local], ['camping', 'Ubatuba']);
  i = interpretarConsulta('praias');
  assert.deepEqual([i.categoria, i.local, i.nome], ['praia', '', '']);
  i = interpretarConsulta('pousada em Trindade');
  assert.deepEqual([i.categoria, i.termo, i.local], ['hospedagem', 'pousada', 'Trindade']);
  i = interpretarConsulta('farmácia em Paraty-Mirim');
  assert.deepEqual([i.categoria, i.local], ['servico', 'Paraty-Mirim']);
  i = interpretarConsulta('pousada do sol em paraty'); // sobra "sol" = nome de estabelecimento
  assert.deepEqual([i.categoria, i.nome, i.local], ['hospedagem', 'sol', 'paraty']);
  i = interpretarConsulta('Praia do Sono');
  assert.deepEqual([i.categoria, i.nome], ['praia', 'sono']);
  i = interpretarConsulta('paraty');
  assert.deepEqual([i.categoria, i.nome], [null, 'paraty']);
  assert.equal(interpretarConsulta('').texto, '');
});

test('consulta: rótulo do botão acompanha a busca', () => {
  const rot = { camping: 'Campings', praia: 'Praias' };
  assert.equal(rotuloImportacao(interpretarConsulta('camping em paraty'), rot), 'campings em Paraty');
  assert.equal(rotuloImportacao(interpretarConsulta('praias'), rot), 'praias');
  assert.equal(rotuloImportacao(interpretarConsulta('Camping do Zé'), rot), '“Camping do Zé”');
  assert.equal(rotuloImportacao(interpretarConsulta(''), rot), 'Importar resultados para triagem');
});

test('nominatim: url com caixa (oeste,norte,leste,sul) e limites', () => {
  const u = new URL(montarUrlBusca({ q: 'camping', caixa: { s: -23.3, n: -23.0, w: -44.9, e: -44.6 } }));
  assert.equal(u.searchParams.get('viewbox'), '-44.9,-23,-44.6,-23.3');
  assert.equal(u.searchParams.get('bounded'), '1');
  assert.equal(u.searchParams.get('extratags'), '1');
  assert.equal(new URL(montarUrlBusca({ q: 'x' })).searchParams.get('bounded'), null);
});

test('nominatim: conversão traz telefone/site quando existem e nada quando não', () => {
  const item = { osm_type: 'node', osm_id: 7, lat: '-23.2', lon: '-44.7', name: 'Camping do Rancho', category: 'tourism', type: 'camp_site',
    extratags: { phone: '+55 24 99885 2054;+55 24 3333-1111', website: 'https://x.com', email: 'a@b.com', toilets: 'yes' }, address: { road: 'Rua A', city: 'Paraty' } };
  const r = converterNominatim(item);
  assert.deepEqual([r.osmId, r.categoria, r.tipo, r.telefone, r.email, r.site], ['node/7', 'camping', 'camping', '+55 24 99885 2054', 'a@b.com', 'https://x.com']);
  assert.deepEqual(r.estrutura, ['banheiro']);
  assert.match(r.endereco, /Rua A/);
  const sem = converterNominatim({ osm_type: 'way', osm_id: 9, lat: '1', lon: '2', name: 'Camping X', category: 'tourism', type: 'camp_site' });
  assert.equal(sem.telefone, undefined);
  assert.equal(converterNominatim({ lat: '1', lon: '2', category: 'tourism', type: 'camp_site' }), null); // sem nome
  const lista = converterListaNominatim([item, item, { ...item, osm_id: 8, name: 'Praia X', category: 'natural', type: 'beach' }], { categoria: 'camping' });
  assert.equal(lista.length, 1); // repetido e outra categoria ficam de fora
});

test('nominatim: escolher a área certa, mínimo para locais pequenos e divisão em grade', () => {
  const itens = [
    { category: 'boundary', name: 'Paraty', lat: '-23.2', lon: '-44.7', boundingbox: ['-23.37', '-22.91', '-44.89', '-44.50'] },
    { category: 'boundary', name: 'Paraty', lat: '-26.4', lon: '-48.8', boundingbox: ['-26.6', '-26.2', '-48.9', '-48.6'] }, // outro estado: longe
    { category: 'boundary', name: 'Paraty (distrito)', lat: '-23.15', lon: '-44.7', boundingbox: ['-23.3', '-23.0', '-44.88', '-44.61'] }
  ];
  const a = escolherArea(itens, { lat: -23.33, lng: -44.88 });
  assert.equal(a.rotulo, 'Paraty');
  assert.ok(a.caixa.n - a.caixa.s > 0.4); // a maior, não a do distrito
  const pequena = caixaComMinimo({ s: -23.36, n: -23.35, w: -44.73, e: -44.72 }, { lat: -23.355, lng: -44.725 }, 6);
  assert.ok(pequena.n - pequena.s > 0.1);
  const partes = dividirCaixa({ s: 0, n: 2, w: 0, e: 2 }, 2);
  assert.equal(partes.length, 4);
  assert.deepEqual(partes[3], { s: 1, n: 2, w: 1, e: 2 });
  assert.ok(caixaEmVoltaDe({ lat: -23, lng: -44 }, 10).e > -44);
});
