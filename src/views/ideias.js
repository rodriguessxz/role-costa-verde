// 💡 Ideias e planos: possibilidades de rolê ainda não confirmadas, com votos dos dois viajantes.
import { assinarVarias, listar, adicionar, atualizar, remover, obter } from '../store.js';
import { salvarEdicao } from '../edicao.js';
import { abrirAdicionarAoRoteiro } from '../acoes.js';
import { ico } from '../icons.js';
import { esc, html, toast, tipoInfo, vazio, abrirModal, confirmar, quemMexeu, contarCurtidas } from '../ui.js';
import { tempoRelativo } from '../lib/tempo.js';

const STATUS_IDEIA = {
  nova: { rotulo: 'Nova', emoji: '💡' },
  avaliando: { rotulo: 'Avaliando', emoji: '🔍' },
  aprovada: { rotulo: 'Aprovada', emoji: '✅' },
  descartada: { rotulo: 'Descartada', emoji: '🚫' }
};
const ROTULOS = { titulo: 'Título', descricao: 'Detalhes', status: 'Status', tags: 'Tags', lugarId: 'Lugar vinculado' };
let filtro = '';

const meuId = () => window.__usuario?.uid || 'local';
const tagsDe = (s) => String(s || '').split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);

function abrirEditor(ideia) {
  const base = ideia ? { ...ideia } : null;
  const lugares = [...listar('lugares')].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const { el, fechar } = abrirModal({
    titulo: ideia ? 'Editar ideia' : 'Nova ideia',
    corpo: `<form class="form">
      <label>Qual é a ideia?<input class="input" name="titulo" required value="${esc(ideia?.titulo || '')}" placeholder="Ex.: dormir uma noite na Praia do Sono"/></label>
      <label>Detalhes<textarea class="input" name="descricao" rows="4" placeholder="Como chegar, quanto custa, quem indicou…">${esc(ideia?.descricao || '')}</textarea></label>
      <div class="grid2">
        <label>Status<select class="input" name="status">${Object.entries(STATUS_IDEIA).map(([k, v]) => `<option value="${k}" ${(ideia?.status || 'nova') === k ? 'selected' : ''}>${v.emoji} ${v.rotulo}</option>`).join('')}</select></label>
        <label>Tags<input class="input" name="tags" value="${esc((ideia?.tags || []).join(', '))}" placeholder="praia, barato"/></label>
      </div>
      <label>Lugar relacionado (opcional)<select class="input" name="lugarId"><option value="">Nenhum</option>
        ${lugares.map((l) => `<option value="${esc(l.id)}" ${l.id === ideia?.lugarId ? 'selected' : ''}>${tipoInfo(l.tipo).emoji} ${esc(l.nome)}</option>`).join('')}</select></label>
      <button class="btn btn-grande" type="submit">Salvar</button>
      ${ideia ? '<button class="btn btn-perigo" type="button" data-apagar>Apagar ideia</button>' : ''}
      ${ideia ? `<p class="dica">${quemMexeu(ideia)}</p>` : ''}
    </form>`
  });
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dados = {
      titulo: String(fd.get('titulo')).trim(),
      descricao: String(fd.get('descricao')).trim(),
      status: fd.get('status'),
      tags: tagsDe(fd.get('tags')),
      lugarId: fd.get('lugarId') || ''
    };
    if (ideia) {
      if (!(await salvarEdicao('ideias', ideia.id, base, dados, ROTULOS))) return;
    } else {
      await adicionar('ideias', { ...dados, curtidas: { [meuId()]: true } });
    }
    fechar();
    toast('💡 Ideia salva');
  });
  el.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Apagar esta ideia?', texto: 'Não dá para desfazer.', rotuloOk: 'Apagar', perigo: true })) {
      remover('ideias', ideia.id);
      fechar();
    }
  });
}

export function render(container) {
  const el = html(`<section class="pagina">
    <div class="cabeca-lista"><h1>Ideias</h1><button class="btn btn-sm" data-acao="nova">+ Nova</button></div>
    <p class="sub">Possibilidades ainda não confirmadas. Curtam as que gostarem e decidam depois.</p>
    <div class="chips" data-filtros></div>
    <div class="lista" data-lista></div>
  </section>`);
  container.append(el);
  const listaEl = el.querySelector('[data-lista]');

  function desenhar() {
    const todas = listar('ideias');
    el.querySelector('[data-filtros]').innerHTML = [
      `<button class="chip chip-sm ${filtro ? '' : 'on'}" data-f="">Todas ${todas.length}</button>`,
      ...Object.entries(STATUS_IDEIA).map(([k, v]) => `<button class="chip chip-sm ${filtro === k ? 'on' : ''}" data-f="${k}">${v.emoji} ${v.rotulo} ${todas.filter((i) => (i.status || 'nova') === k).length}</button>`)
    ].join('');
    const itens = todas.filter((i) => !filtro || (i.status || 'nova') === filtro)
      .sort((a, b) => contarCurtidas(b.curtidas) - contarCurtidas(a.curtidas) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    if (!itens.length) {
      listaEl.innerHTML = todas.length
        ? vazio({ emoji: '🔎', titulo: 'Nenhuma ideia nesse filtro' })
        : vazio({ emoji: '💡', titulo: 'Nenhuma ideia ainda', texto: 'Qualquer rolê que passar pela cabeça entra aqui. Quando forem decidir, é só filtrar e votar.', acao: { rotulo: 'Registrar a primeira ideia', id: 'nova' } });
      return;
    }
    listaEl.innerHTML = itens.map((i) => {
      const st = STATUS_IDEIA[i.status || 'nova'];
      const lugar = i.lugarId ? obter('lugares', i.lugarId) : null;
      const curti = !!(i.curtidas && !Array.isArray(i.curtidas) && i.curtidas[meuId()]);
      return `<article class="ideia ${i._pendente ? 'pendente' : ''}" data-id="${esc(i.id)}">
        <div class="ideia-topo"><span class="badge">${st.emoji} ${st.rotulo}</span><small>${esc(i.criadoPor || '')} · ${tempoRelativo(i.criadoEm || i.atualizadoEm)}</small></div>
        <b>${esc(i.titulo)}</b>
        ${i.descricao ? `<p>${esc(i.descricao)}</p>` : ''}
        <div class="nota-rodape">
          ${(i.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}
          ${lugar ? `<a class="tag" href="#/lugar/${encodeURIComponent(lugar.id)}">${tipoInfo(lugar.tipo).emoji} ${esc(lugar.nome)}</a>` : ''}
        </div>
        <div class="ideia-acoes">
          <button class="btn btn-sm ${curti ? '' : 'btn-sec'}" data-acao="curtir" aria-pressed="${curti}">👍 ${contarCurtidas(i.curtidas) || ''}</button>
          <button class="btn btn-sm btn-sec" data-acao="roteiro">${ico('roteiro')} Pôr no roteiro</button>
          <button class="btn btn-sm btn-sec" data-acao="editar">Editar</button>
        </div>
      </article>`;
    }).join('');
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="nova"], [data-vazio="nova"]')) return abrirEditor(null);
    const f = e.target.closest('[data-f]');
    if (f) { filtro = f.dataset.f; return desenhar(); }
    const acao = e.target.closest('[data-acao]');
    const card = e.target.closest('.ideia');
    if (!acao || !card) return;
    const i = obter('ideias', card.dataset.id);
    if (!i) return;
    if (acao.dataset.acao === 'editar') return abrirEditor(i);
    if (acao.dataset.acao === 'curtir') {
      const ja = i.curtidas && !Array.isArray(i.curtidas) && i.curtidas[meuId()];
      // mapa por usuário: o "curtir" do outro não é sobrescrito
      return atualizar('ideias', i.id, { curtidas: { [meuId()]: !ja } });
    }
    if (acao.dataset.acao === 'roteiro') {
      abrirAdicionarAoRoteiro({ lugarId: i.lugarId || '', titulo: i.titulo });
      if ((i.status || 'nova') === 'nova') atualizar('ideias', i.id, { status: 'avaliando' });
    }
  });

  return assinarVarias(['ideias', 'lugares'], desenhar);
}
