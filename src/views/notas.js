// 📝 Anotações: dicas, logística e decisões. Compartilhadas, com autor e data de atualização.
import { assinarVarias, listar, adicionar, remover, obter } from '../store.js';
import { salvarEdicao } from '../edicao.js';
import { esc, html, toast, tipoInfo, vazio, abrirModal, confirmar, quemMexeu } from '../ui.js';
import { tempoRelativo } from '../lib/tempo.js';

let filtroTag = '';
let busca = '';

const ROTULOS = { titulo: 'Título', texto: 'Texto', tags: 'Tags', lugarId: 'Lugar vinculado', fixada: 'Fixada' };
const tagsDe = (s) => String(s || '').split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);

function abrirEditor(nota) {
  const base = nota ? { ...nota } : null;
  const lugares = [...listar('lugares')].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const { el, fechar } = abrirModal({
    titulo: nota ? 'Editar anotação' : 'Nova anotação',
    corpo: `<form class="form">
      <label>Título (opcional)<input class="input" name="titulo" value="${esc(nota?.titulo || '')}" placeholder="Ex.: Horário do barco"/></label>
      <label>Anotação<textarea class="input" name="texto" rows="8" required placeholder="Escreva à vontade…">${esc(nota?.texto || '')}</textarea></label>
      <label>Tags (separadas por vírgula)<input class="input" name="tags" value="${esc((nota?.tags || []).join(', '))}" placeholder="logística, barco, contato"/></label>
      <label>Vincular a um lugar (opcional)<select class="input" name="lugarId"><option value="">Nenhum</option>
        ${lugares.map((l) => `<option value="${esc(l.id)}" ${l.id === nota?.lugarId ? 'selected' : ''}>${tipoInfo(l.tipo).emoji} ${esc(l.nome)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="fixada" ${nota?.fixada ? 'checked' : ''}/> Fixar no topo</label>
      <button class="btn btn-grande" type="submit">Salvar</button>
      ${nota ? '<button class="btn btn-perigo" type="button" data-apagar>Apagar anotação</button>' : ''}
      ${nota ? `<p class="dica">${quemMexeu(nota)}</p>` : ''}
    </form>`
  });
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dados = {
      titulo: String(fd.get('titulo')).trim(),
      texto: String(fd.get('texto')).trim(),
      tags: tagsDe(fd.get('tags')),
      lugarId: fd.get('lugarId') || '',
      fixada: fd.has('fixada')
    };
    if (nota) {
      if (!(await salvarEdicao('notas', nota.id, base, dados, ROTULOS))) return;
    } else {
      await adicionar('notas', dados);
    }
    fechar();
    toast('📝 Anotação salva');
  });
  el.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Apagar esta anotação?', texto: 'Não dá para desfazer.', rotuloOk: 'Apagar', perigo: true })) {
      remover('notas', nota.id);
      fechar();
      toast('🗑️ Apagada');
    }
  });
}

export function render(container) {
  const el = html(`<section class="pagina">
    <div class="cabeca-lista"><h1>Anotações</h1><button class="btn btn-sm" data-acao="nova">+ Nova</button></div>
    <form class="anotar-rapido" data-form="rapido">
      <input class="input" name="texto" placeholder="Anotar rápido… (Enter salva)" autocomplete="off" enterkeyhint="done"/>
    </form>
    <input type="search" class="input" data-busca placeholder="Buscar nas anotações" value="${esc(busca)}"/>
    <div class="chips" data-tags></div>
    <div class="lista" data-lista></div>
  </section>`);
  container.append(el);
  const listaEl = el.querySelector('[data-lista]');

  function desenhar() {
    const todas = listar('notas');
    const tags = [...new Set(todas.flatMap((n) => n.tags || []))].sort();
    el.querySelector('[data-tags]').innerHTML = tags.length
      ? [`<button class="chip chip-sm ${filtroTag ? '' : 'on'}" data-tag="">Todas</button>`, ...tags.map((t) => `<button class="chip chip-sm ${filtroTag === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`)].join('')
      : '';
    const q = busca.trim().toLowerCase();
    const itens = todas
      .filter((n) => (!filtroTag || (n.tags || []).includes(filtroTag)) && (!q || `${n.titulo || ''} ${n.texto || ''} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(!!b.fixada) - Number(!!a.fixada) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    if (!itens.length) {
      listaEl.innerHTML = todas.length
        ? vazio({ emoji: '🔎', titulo: 'Nenhuma anotação encontrada', texto: 'Tente outra palavra ou limpe o filtro de tag.' })
        : vazio({ emoji: '📝', titulo: 'Sem anotações ainda', texto: 'Guarde aqui horários de barco, telefones, dicas de acesso e decisões da viagem.', acao: { rotulo: 'Escrever a primeira', id: 'nova' } });
      return;
    }
    listaEl.innerHTML = itens.map((n) => {
      const lugar = n.lugarId ? obter('lugares', n.lugarId) : null;
      return `<article class="nota ${n.fixada ? 'fixada' : ''} ${n._pendente ? 'pendente' : ''}" data-id="${esc(n.id)}" tabindex="0" role="button">
        <div class="nota-topo"><b>${n.fixada ? '📌 ' : ''}${esc(n.titulo || 'Sem título')}</b><small>${tempoRelativo(n.atualizadoEm)}</small></div>
        <p>${esc(n.texto)}</p>
        <div class="nota-rodape">
          ${(n.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}
          ${lugar ? `<a class="tag" href="#/lugar/${encodeURIComponent(lugar.id)}">${tipoInfo(lugar.tipo).emoji} ${esc(lugar.nome)}</a>` : ''}
          <small>${esc(n.atualizadoPor || n.criadoPor || '')}</small>
        </div>
      </article>`;
    }).join('');
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="nova"], [data-vazio="nova"]')) return abrirEditor(null);
    const tag = e.target.closest('[data-tag]');
    if (tag) { filtroTag = tag.dataset.tag; return desenhar(); }
    if (e.target.closest('a')) return;
    const card = e.target.closest('.nota');
    if (card) abrirEditor(obter('notas', card.dataset.id));
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('nota')) abrirEditor(obter('notas', e.target.dataset.id));
  });
  el.querySelector('[data-busca]').addEventListener('input', (e) => { busca = e.target.value; desenhar(); });
  el.querySelector('[data-form="rapido"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = String(new FormData(e.target).get('texto')).trim();
    if (!texto) return;
    adicionar('notas', { titulo: '', texto, tags: [], lugarId: '', fixada: false });
    e.target.reset();
    toast('📝 Anotado');
  });

  return assinarVarias(['notas', 'lugares'], desenhar);
}
