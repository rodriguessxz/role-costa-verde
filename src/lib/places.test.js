import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPedidoPlaces, converterPlace, converterRespostaPlaces, tipoDoApp, usoDoMes, restantes, contarUso, LIMITE_MENSAL } from './places.js';

test('places: pedido de busca com viés de localização e campos pedidos', () => {
  const p = montarPedidoPlaces({ consulta: 'camping em Ubatuba', centro: { lat: -23.43, lng: -45.08 }, raioM: 90000 });
  assert.equal(p.corpo.textQuery, 'camping em Ubatuba');
  assert.equal(p.corpo.languageCode, 'pt-BR');
  assert.equal(p.corpo.locationBias.circle.radius, 50000); // máximo permitido
  assert.match(p.campos, /places\.nationalPhoneNumber/);
  assert.equal(montarPedidoPlaces({ consulta: 'x' }).corpo.locationBias, undefined);
});

test('places: conversão e tipos', () => {
  const r = converterPlace({
    id: 'ChIJ1', displayName: { text: 'Camping Sununga' }, formattedAddress: 'R. Hamilton Prado, 361', location: { latitude: -23.49, longitude: -45.17 },
    rating: 4.6, userRatingCount: 1051, nationalPhoneNumber: '(12) 3842-0000', websiteUri: 'https://x.com', googleMapsUri: 'https://maps.google.com/?cid=1',
    regularOpeningHours: { openNow: true, weekdayDescriptions: ['seg: 8–18'] }, primaryType: 'campground', types: ['campground', 'lodging']
  });
  assert.deepEqual([r.nome, r.tipo, r.nota, r.avaliacoes, r.abertoAgora, r.telefone], ['Camping Sununga', 'camping', 4.6, 1051, true, '(12) 3842-0000']);
  assert.equal(converterPlace({ displayName: { text: 'Sem posição' } }), null);
  const sem = converterPlace({ id: 'x', displayName: { text: 'Mínimo' }, location: { latitude: 1, longitude: 2 } });
  assert.equal(sem.telefone, undefined); // o que a fonte não traz fica indefinido
  assert.equal(sem.nota, undefined);
  assert.equal(converterRespostaPlaces({ places: [{ id: 'x', displayName: { text: 'A' }, location: { latitude: 1, longitude: 2 } }, {}] }).length, 1);
  assert.equal(converterRespostaPlaces({}).length, 0);
  assert.equal(tipoDoApp(['restaurant']), 'restaurante');
  assert.equal(tipoDoApp(['gas_station']), 'apoio');
  assert.equal(tipoDoApp(['hotel']), 'hospedagem');
});

test('places: trava de cota mensal zera ao virar o mês', () => {
  const nov = new Date(2026, 10, 10);
  let uso = usoDoMes(null, nov);
  assert.equal(restantes(uso, nov), LIMITE_MENSAL);
  for (let i = 0; i < 3; i++) uso = contarUso(uso, nov);
  assert.equal(restantes(uso, nov), LIMITE_MENSAL - 3);
  assert.equal(restantes({ mes: '2026-11', n: LIMITE_MENSAL }, nov), 0);
  assert.equal(restantes({ mes: '2026-11', n: LIMITE_MENSAL }, new Date(2026, 11, 1)), LIMITE_MENSAL); // dezembro: zerou
});
