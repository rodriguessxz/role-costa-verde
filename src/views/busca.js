// 🔎 Busca global: lugares, anotações, ideias, atividades do roteiro e itens de checklist.
import { assinarVarias, listar } from '../store.js';
import { esc, html, tipoInfo, STATUS, REGIOES, vazio } from '../ui.js';

let ultima = '';

const casa = (q, ...campos) => campos.join(' ').toLowerCase().includes(q);

function buscar(q) {
  const lugares = listar('lugares').filter((l) => casa(q, l.nome, l.descricao, l.observacoes, l.endereco, (l.tags || []).join(' '), REGIOES[l.regiao]));
  const notas = listar('notas').filter((n) => casa(q, n.titulo, n.texto, (n.tags || []).join(' ')));
  const ideias = listar('ideias').filter((i) => casa(q, i.titulo, i.descricao, (i.tags || []).join(' ')));
  const dias = listar('dias');
  const atividades = listar('atividades').filter((a) => casa(q, a.titulo, a.nota));
  const listas = listar('listas');
  const itens = listar('itens').filter((i) => casa(q, i.texto, i.obs));
  const comentarios = listar('comentarios').filter((c) => casa(q, c.texto));
  return { lugares, notas, ideias, atividades, itens, comentarios, dias, listas };
}

const secao = (titulo, linhas) => (linhas.length ? `<section class="bloco-simples"><h3>${titulo} <small>${linhas.length}</small></h3><div class="lista-simples">${linhas.join('')}</div></section>` : '');
const linha = (href, emoji, titulo, sub) => `<a class="linha-ativ" href="${href}"><span class="linha-hora">${emoji}</span><span class="linha-corpo"><b>${esc(titulo)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>`;

export function render(container) {
  const el = html(`<section class="pagina">
    <h1>Buscar</h1>
    <div class="busca-grande"><input type="search" class="input" placeholder="Lugares, anotações, ideias, roteiro, checklist…" value="${esc(ultima)}" autocomplete="off"/></div>
    <div data-saida></div>
  </section>`);
  container.append(el);
  const entrada = el.querySelector('input');
  const saida = el.querySelector('[data-saida]');

  function desenhar() {
    ultima = entrada.value;
    const q = ultima.trim().toLowerCase();
    if (q.length < 2) {
      saida.innerHTML = vazio({ emoji: '🔎', titulo: 'Busque em tudo', texto: 'Procure por nome de lugar, trecho de anotação, ideia, atividade do roteiro ou item do checklist.' });
      return;
    }
    const r = buscar(q);
    const total = r.lugares.length + r.notas.length + r.ideias.length + r.atividades.length + r.itens.length + r.comentarios.length;
    if (!total) { saida.innerHTML = vazio({ emoji: '🌫️', titulo: `Nada encontrado para “${ultima.trim()}”`, texto: 'Confira a grafia ou use o Explorar para achar lugares novos.', acao: { rotulo: 'Ir para Explorar', href: '#/explorar' } }); return; }
    const lugarPorId = (id) => listar('lugares').find((l) => l.id === id);
    saida.innerHTML = [
      secao('Lugares', r.lugares.map((l) => linha(`#/lugar/${encodeURIComponent(l.id)}`, tipoInfo(l.tipo).emoji, l.nome, `${STATUS[l.status || 'quero-ir']?.rotulo || ''}${REGIOES[l.regiao] ? ` · ${REGIOES[l.regiao]}` : ''}`))),
      secao('Anotações', r.notas.map((n) => linha('#/notas', '📝', n.titulo || String(n.texto).slice(0, 50), String(n.texto).slice(0, 80)))),
      secao('Ideias', r.ideias.map((i) => linha('#/ideias', '💡', i.titulo, i.descricao ? String(i.descricao).slice(0, 80) : ''))),
      secao('Roteiro', r.atividades.map((a) => linha('#/roteiro', '📌', a.titulo, r.dias.find((d) => d.id === a.diaId)?.titulo || 'Sem dia'))),
      secao('Checklist', r.itens.map((i) => linha('#/checklist', i.feito ? '✅' : '⬜', i.texto, r.listas.find((l) => l.id === i.listaId)?.nome || ''))),
      secao('Comentários', r.comentarios.map((c) => linha(`#/lugar/${encodeURIComponent(c.lugarId)}`, '💬', String(c.texto).slice(0, 60), lugarPorId(c.lugarId)?.nome || '')))
    ].join('');
  }
  entrada.addEventListener('input', desenhar);
  setTimeout(() => entrada.focus({ preventScroll: true }), 50);
  return assinarVarias(['lugares', 'notas', 'ideias', 'dias', 'atividades', 'listas', 'itens', 'comentarios'], desenhar);
}
