// Testes das funções puras. Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sugerir, girar } from './roleta.js';
import { calcularSaldo } from './gastos.js';
import { distanciaKm, temCoord } from './geo.js';
import { classificarClima } from './clima.js';

const seed = JSON.parse(readFileSync(new URL('../../public/seed.json', import.meta.url))).lugares;
const fixo = () => 0.5;
const paraty = { lat: -23.219, lng: -44.714 };

test('distância Paraty → Trindade fica entre 10 e 25 km', () => {
  const d = distanciaKm(paraty, { lat: -23.352, lng: -44.722 });
  assert.ok(d > 10 && d < 25, `deu ${d}`);
});

test('lugares sem coordenada não quebram', () => {
  assert.equal(temCoord({ lat: null, lng: null }), false);
  const r = sugerir(seed, { tempo: 'dia', energia: 'sofrer', clima: 'sol', posicao: paraty, aleatorio: fixo });
  assert.ok(r.length > 0);
});

test('energia "de boa" só sugere fácil', () => {
  const r = sugerir(seed, { tempo: 'dia', energia: 'boa', clima: 'sol', posicao: paraty, aleatorio: fixo });
  assert.ok(r.length > 0);
  for (const s of r) assert.equal(s.lugar.dificuldade || 'facil', 'facil');
});

test('com chuva não sugere barco nem trilha difícil', () => {
  const r = sugerir(seed, { tempo: 'dia', energia: 'sofrer', clima: 'chuva', posicao: paraty, aleatorio: fixo });
  for (const s of r) {
    assert.notEqual(s.lugar.acesso, 'barco');
    assert.notEqual(s.lugar.dificuldade, 'dificil');
  }
});

test('chuva forte tira cachoeira', () => {
  const r = sugerir(seed, { tempo: 'dia', energia: 'normal', clima: 'chuva-forte', posicao: paraty, aleatorio: fixo });
  assert.ok(r.every((s) => s.lugar.tipo !== 'cachoeira'));
});

test('1–2h perto de Paraty não sugere coisa de Ubatuba sul', () => {
  const r = sugerir(seed, { tempo: 'curto', energia: 'normal', clima: 'sol', posicao: paraty, aleatorio: fixo });
  assert.ok(r.every((s) => s.lugar.regiao !== 'ubatuba-sul'));
});

test('descartado e fui ficam de fora', () => {
  const lugares = [
    { id: 'a', tipo: 'praia', status: 'descartado', lat: -23.2, lng: -44.7 },
    { id: 'b', tipo: 'praia', status: 'fui', lat: -23.2, lng: -44.7 },
    { id: 'c', tipo: 'praia', status: 'quero-ir', lat: -23.2, lng: -44.7 }
  ];
  const r = sugerir(lugares, { tempo: 'meio', energia: 'boa', clima: 'sol', posicao: paraty, aleatorio: fixo });
  assert.deepEqual(r.map((s) => s.lugar.id), ['c']);
});

test('girar devolve um dos 3 melhores', () => {
  const r = sugerir(seed, { tempo: 'dia', energia: 'normal', clima: 'sol', posicao: paraty, aleatorio: fixo });
  const g = girar(r, () => 0.99);
  assert.ok(r.slice(0, 3).includes(g));
  assert.equal(girar([]), null);
});

test('racha de gastos', () => {
  const s = calcularSaldo([
    { valor: 100, pagoPor: 'A' },
    { valor: 40, pagoPor: 'B' },
    { valor: 30, pagoPor: 'A', divisao: 'so-quem-pagou' }
  ], ['A', 'B']);
  assert.equal(s.total, 170);
  // A pagou 130, parte dele = 50+20+30 = 100 → recebe 30
  assert.deepEqual(s.resumo, { devedor: 'B', credor: 'A', valor: 30 });
});

test('classificação de clima', () => {
  assert.equal(classificarClima(0, 0), 'sol');
  assert.equal(classificarClima(3, 0), 'nublado');
  assert.equal(classificarClima(61, 1), 'chuva');
  assert.equal(classificarClima(95, 0), 'chuva-forte');
});
