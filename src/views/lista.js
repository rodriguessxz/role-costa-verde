// 📋 Lista com busca, filtros e ordenação por distância.
import { assinar } from '../store.js';
import { salvarAchado } from '../achados.js';
import { distanciaKm, formatarKm, posicaoAtual, temCoord } from '../lib/geo.js';
import {
  esc, html, toast, tipoInfo, STATUS, REGIOES, lerFiltros, aplicarFiltros, barraFiltros, campoBusca,
  formatarDuracao, precisaCompletar, DIFICULDADES
} from '../ui.js';

let posicao = null; // última posição conhecida (mantida entre telas)
let ordem = 'regiao';

function card(l) {
  const t = tipoInfo(l.tipo);
  const km = posicao && temCoord(l) ? distanciaKm(posicao, l) : null;
  const meta = [
    REGIOES[l.regiao],
    l.duracaoMin && `⏱️ ${formatarDuracao(l.duracaoMin)}`,
    l.dificuldade && `🥾 ${DIFICULDADES[l.dificuldade] || l.dificuldade}`,
    l.acesso === 'barco' && '⛵',
    km !== null && `📍 ${formatarKm(km)}`
  ].filter(Boolean).map(esc).join(' · ');
  return `<a class="card card-lugar status-${l.status || 'quero-ir'}" href="#/lugar/${encodeURIComponent(l.id)}" style="--cor:${t.cor}">
    <span class="card-emoji">${t.emoji}</span>
    <span class="card-corpo">
      <span class="card-titulo">${esc(l.nome)}</span>
      <span class="card-meta">${meta}</span>
      <span class="card-badges">
        ${l.status === 'fui' ? '<span class="badge badge-ok">✅ fui</span>' : ''}
        ${l.status === 'descartado' ? '<span class="badge">🚫 descartado</span>' : ''}
        ${precisaCompletar(l) ? '<span class="badge badge-alerta">✏️ completar dados</span>' : ''}
        ${l.reservaNecessaria && l.tipo === 'camping' ? '<span class="badge badge-coral">📞 reservar</span>' : ''}
        ${l.wikilocUrl ? '<span class="badge">Wikiloc</span>' : ''}
        ${l.gpxNoRelogio ? '<span class="badge badge-ok">⌚ GPX</span>' : ''}
      </span>
    </span>
  </a>`;
}

export function render(container) {
  const filtros = lerFiltros();
  const el = html(`<section class="pagina">
    <div class="cabeca-lista"><h1>Lugares</h1><span class="contagem"></span></div>
    <div class="busca-linha">
      <input type="search" class="input" placeholder="Buscar lugar, tag, região…" value="${esc(filtros.busca)}" />
      <select class="input select-ordem" aria-label="Ordenar">
        <option value="regiao">Por região</option>
        <option value="perto">Mais perto</option>
        <option value="nome">A–Z</option>
      </select>
    </div>
    <div class="lista"></div>
  </section>`);
  container.append(el);
  el.querySelector('.busca-linha').after(barraFiltros(filtros, () => desenhar()));
  // Busca na internet: acha um lugar novo e já salva na lista
  el.querySelector('.busca-linha').before(campoBusca({
    placeholder: '🔎 Achar lugar novo na internet…',
    onEscolher: async (r) => {
      const id = await salvarAchado(r);
      toast('✨ Salvo: ' + r.nome);
      location.hash = `#/lugar/${encodeURIComponent(id)}`;
    }
  }));

  const listaEl = el.querySelector('.lista');
  const sel = el.querySelector('.select-ordem');
  sel.value = ordem;
  let todos = [];

  function desenhar() {
    let itens = aplicarFiltros(todos, filtros);
    if (ordem === 'perto' && posicao) {
      itens = [...itens].sort((a, b) =>
        (temCoord(a) ? distanciaKm(posicao, a) : 1e9) - (temCoord(b) ? distanciaKm(posicao, b) : 1e9));
      listaEl.innerHTML = itens.map(card).join('');
    } else if (ordem === 'nome') {
      itens = [...itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      listaEl.innerHTML = itens.map(card).join('');
    } else {
      // Agrupa por região, na ordem do litoral (SP → RJ)
      const grupos = Object.keys(REGIOES).concat(['']);
      listaEl.innerHTML = grupos.map((r) => {
        const doGrupo = itens.filter((l) => (l.regiao || '') === r || (r === '' && !REGIOES[l.regiao]))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        if (!doGrupo.length) return '';
        return `<h3 class="grupo">${esc(REGIOES[r] || 'Sem região')} <small>${doGrupo.length}</small></h3>${doGrupo.map(card).join('')}`;
      }).join('');
    }
    el.querySelector('.contagem').textContent = `${itens.length} ${itens.length === 1 ? 'lugar' : 'lugares'}`;
    if (!itens.length) listaEl.innerHTML = '<p class="vazio">Nada por aqui com esses filtros 🤷</p>';
  }

  el.querySelector('input[type=search]').addEventListener('input', (e) => {
    filtros.busca = e.target.value;
    desenhar();
  });

  sel.addEventListener('change', async () => {
    ordem = sel.value;
    if (ordem === 'perto' && !posicao) {
      toast('📡 Pegando sua localização…');
      posicao = await posicaoAtual();
      if (!posicao) { toast('Sem GPS — ordenando por região'); ordem = 'regiao'; sel.value = 'regiao'; }
    }
    desenhar();
  });

  return assinar('lugares', (l) => { todos = l; desenhar(); });
}
