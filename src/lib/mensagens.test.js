import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarMensagem, textoDatas, quemVai, dataDiaMes, linkWhatsApp, VARIANTES } from './mensagens.js';

test('mensagens: datas e quantidade de pessoas', () => {
  assert.equal(dataDiaMes('2026-12-23'), '23/12');
  assert.equal(textoDatas('2026-12-23', '2027-01-06'), 'entre 23/12 e 06/01 (as datas são flexíveis)');
  assert.equal(textoDatas('', ''), 'nas próximas semanas');
  assert.equal(quemVai(2), 'eu e um amigo');
  assert.equal(quemVai(1), 'eu');
  assert.equal(quemVai(4), 'eu e mais 3 amigos');
});

test('mensagens: as 3 variantes trazem apresentação, região, datas, vaga e valores', () => {
  const base = { camping: 'Camping do Zé', regiao: 'Paraty', datas: 'entre 23/12 e 06/01 (as datas são flexíveis)', pessoas: 2, meuNome: 'Arthur Rodrigues' };
  for (const v of Object.keys(VARIANTES)) {
    const m = montarMensagem({ ...base, variante: v });
    assert.match(m, /Arthur/, v);
    assert.doesNotMatch(m, /Rodrigues/, v); // só o primeiro nome
    assert.match(m, /Paraty/, v);
    assert.match(m, /23\/12/, v);
    assert.match(m, /Camping do Zé/, v);
    assert.match(m, /vaga|disponibilidade/, v);
    assert.match(m, /valor/i, v);
    assert.doesNotMatch(m, /[{}]|undefined|null/, v); // nada de variável sobrando
  }
  assert.notEqual(montarMensagem({ ...base, variante: 'curta' }), montarMensagem({ ...base, variante: 'descolada' }));
  assert.match(montarMensagem({ ...base, variante: 'descolada' }), /joia/);
});

test('mensagens: sem nome, sem região e sem nome do camping não quebra nem inventa', () => {
  const m = montarMensagem({ camping: '', meuNome: 'Eu', pessoas: 1 });
  assert.match(m, /por essa região/);
  assert.match(m, /nas próximas semanas/);
  assert.doesNotMatch(m, /Aqui é o/);
  assert.doesNotMatch(m, /\(\)/);
  assert.match(m, /^Fala, tudo joia/);
});

test('mensagens: link do WhatsApp com texto codificado e número validado', () => {
  assert.equal(linkWhatsApp('(24) 99876-5432', 'oi tudo bem?'), 'https://wa.me/5524998765432?text=oi%20tudo%20bem%3F');
  assert.equal(linkWhatsApp('+55 24 99876-5432', 'x'), 'https://wa.me/5524998765432?text=x');
  assert.equal(linkWhatsApp('123', 'x'), null);
  assert.equal(linkWhatsApp('', 'x'), null);
});

test('mensagens: parênteses do nome do local não aninham', () => {
  const m = montarMensagem({ camping: 'Camping do Orlando (Praia do Cruzeiro)', regiao: 'Paraty', meuNome: 'Ana' });
  assert.match(m, /\(Camping do Orlando\)/);
  assert.doesNotMatch(m, /\(\(|\)\)/);
  assert.match(montarMensagem({ camping: 'X', meuNome: '' }), /Muito prazer!/);
});
