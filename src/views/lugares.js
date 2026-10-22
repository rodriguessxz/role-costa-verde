// 📍 Lugares salvos: a biblioteca da viagem (busca, filtros, ordenação por distância).
import { assinarVarias, listar } from '../store.js';
import { distanciaKm, formatarKm, posicaoAtual, temCoord } from '../lib/geo.js';
import {
  esc, html, toast, tipoInfo, STATUS, REGIOES, lerFiltros, salvarFiltros, aplicarFiltros, barraFiltros,
  formatarDuracao, precisaCompletar, DIFICULDADES, vazio, TIPOS
} from '../ui.js';

let posicao = null; // última posição conhecida (mantida entre telas)
let ordem = 'regiao';
let soFavoritos = false;

function card(l, noRoteiro) {
  const t = tipoInfo(l.tipo);
  const st = STATUS[l.status || 'quero-ir'] || STATUS['quero-ir'];
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
      <span class="card-titulo">${l.favorito ? '<span class="estrela-on" title="Favorito">★</span> ' : ''}${esc(l.nome)}</span>
      <span class="card-meta">${meta}</span>
      <span class="card-badges">
        <span class="badge badge-status">${st.emoji} ${esc(st.rotulo)}</span>
        ${noRoteiro ? '<span class="badge badge-ok">📌 no roteiro</span>' : ''}
        ${precisaCompletar(l) ? '<span class="badge badge-alerta">✏️ completar dados</span>' : ''}
        ${l.reservaNecessaria && l.tipo === 'camping' ? '<span class="badge badge-coral">📞 reservar</span>' : ''}
        ${l.wikilocUrl ? '<span class="badge">Wikiloc</span>' : ''}
        ${l.gpxNoRelogio ? '<span class="badge badge-ok">⌚ GPX</span>' : ''}
      </span>
    </span>
  </a>`;
}

export function render(container, { params = [] } = {}) {
  const filtros = lerFiltros();
  // #/lugares/tipo/praia → abre já filtrado
  if (params[0] === 'tipo' && TIPOS[params[1]]) { filtros.tipos = [params[1]]; salvarFiltros(filtros); }

  const el = html(`<section class="pagina">
    <div class="cabeca-lista"><h1>Lugares</h1><span class="contagem"></span></div>
    <div class="busca-linha">
      <input type="search" class="input" placeholder="Buscar nome, tag, região, anotação…" value="${esc(filtros.busca)}" />
      <select class="input select-ordem" aria-label="Ordenar">
        <option value="regiao">Por região</option>
        <option value="perto">Mais perto</option>
        <option value="prioridade">Prioridade</option>
        <option value="recentes">Recentes</option>
        <option value="nome">A–Z</option>
      </select>
    </div>
    <div class="chips"><button class="chip chip-sm" data-fav>★ Só favoritos</button></div>
    <div class="lista"></div>
    <a class="btn btn-sec rodape-acao" href="#/explorar">Explorar mais lugares</a>
  </section>`);
  container.append(el);
  const cab = el.querySelector('.busca-linha');
  cab.after(barraFiltros(filtros, () => desenhar()));

  const listaEl = el.querySelector('.lista');
  const sel = el.querySelector('.select-ordem');
  const botaoFav = el.querySelector('[data-fav]');
  sel.value = ordem;
  botaoFav.classList.toggle('on', soFavoritos);
  let todos = [];

  function desenhar() {
    const noRoteiro = new Set(listar('atividades').map((a) => a.lugarId).filter(Boolean));
    let itens = aplicarFiltros(todos, { ...filtros, busca: '' });
    const q = filtros.busca.trim().toLowerCase();
    if (q) {
      itens = itens.filter((l) => `${l.nome} ${l.descricao || ''} ${l.observacoes || ''} ${l.endereco || ''} ${(l.tags || []).join(' ')} ${REGIOES[l.regiao] || ''}`.toLowerCase().includes(q));
    }
    if (soFavoritos) itens = itens.filter((l) => l.favorito);
    const cartao = (l) => card(l, noRoteiro.has(l.id));

    if (ordem === 'perto' && posicao) {
      itens = [...itens].sort((a, b) =>
        (temCoord(a) ? distanciaKm(posicao, a) : 1e9) - (temCoord(b) ? distanciaKm(posicao, b) : 1e9));
      listaEl.innerHTML = itens.map(cartao).join('');
    } else if (ordem === 'nome') {
      listaEl.innerHTML = [...itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(cartao).join('');
    } else if (ordem === 'prioridade') {
      listaEl.innerHTML = [...itens].sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || a.nome.localeCompare(b.nome, 'pt-BR')).map(cartao).join('');
    } else if (ordem === 'recentes') {
      listaEl.innerHTML = [...itens].sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm))).map(cartao).join('');
    } else {
      // Agrupa por região, na ordem do litoral (SP → RJ)
      const grupos = Object.keys(REGIOES).concat(['']);
      listaEl.innerHTML = grupos.map((r) => {
        const doGrupo = itens.filter((l) => (l.regiao || '') === r || (r === '' && !REGIOES[l.regiao]))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        if (!doGrupo.length) return '';
        return `<h3 class="grupo">${esc(REGIOES[r] || 'Sem região')} <small>${doGrupo.length}</small></h3>${doGrupo.map(cartao).join('')}`;
      }).join('');
    }
    el.querySelector('.contagem').textContent = `${itens.length} ${itens.length === 1 ? 'lugar' : 'lugares'}`;
    if (!itens.length) {
      listaEl.innerHTML = todos.length
        ? vazio({ emoji: '🔎', titulo: 'Nada com esses filtros', texto: 'Toque em "Todos" ou limpe a busca para ver tudo de novo.' })
        : vazio({ emoji: '🗺️', titulo: 'A biblioteca está vazia', texto: 'Salve lugares do Explorar ou adicione manualmente. Dá para importar a lista inicial em Configurações.', acao: { rotulo: 'Explorar agora', href: '#/explorar' } });
    }
  }

  el.querySelector('input[type=search]').addEventListener('input', (e) => {
    filtros.busca = e.target.value;
    desenhar();
  });
  botaoFav.addEventListener('click', () => { soFavoritos = !soFavoritos; botaoFav.classList.toggle('on', soFavoritos); desenhar(); });

  sel.addEventListener('change', async () => {
    ordem = sel.value;
    if (ordem === 'perto' && !posicao) {
      toast('📡 Pegando sua localização…');
      posicao = await posicaoAtual();
      if (!posicao) { toast('Sem GPS — ordenando por região'); ordem = 'regiao'; sel.value = 'regiao'; }
    }
    desenhar();
  });

  return assinarVarias(['lugares', 'atividades'], () => { todos = listar('lugares'); desenhar(); });
}
