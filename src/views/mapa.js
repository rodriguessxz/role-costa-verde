// 🗺️ Mapa: lugares salvos, resultados do Explorar e o trajeto de um dia do roteiro.
// Rotas: #/mapa · #/mapa/dia/:id (paradas do dia, na ordem) · #/mapa/lugar/:id (foca num lugar).
import L from 'leaflet';
import { assinarVarias, listar, obter } from '../store.js';
import { modalSalvarResultado, abrirAdicionarAoRoteiro } from '../acoes.js';
import { lerExplorar } from '../explorar-estado.js';
import { temCoord, posicaoAtual, linkGoogleMaps, CENTRO_REGIAO } from '../lib/geo.js';
import { atividadesDoDia } from '../lib/roteiro.js';
import { ico } from '../icons.js';
import {
  esc, html, toast, tipoInfo, STATUS, lerFiltros, aplicarFiltros, barraFiltros, campoBusca,
  formatarDuracao, DIFICULDADES
} from '../ui.js';

// Lembra a última visão do mapa entre trocas de aba
let ultimaVisao = null;
let mostrarExplorar = true;

/** Pin em gota, colorido pelo tipo. `rotulo` troca o emoji (ex.: número da parada). */
function icone(l, { rotulo, extra = '' } = {}) {
  const t = tipoInfo(l.tipo);
  const classes = ['pin', `pin-${l.status || 'quero-ir'}`, l.coordAprox ? 'pin-aprox' : '', extra].join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${classes}" style="--cor:${t.cor}"><span>${rotulo ?? t.emoji}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38]
  });
}

function folhaLugar(l) {
  const t = tipoInfo(l.tipo);
  const st = STATUS[l.status || 'quero-ir'] || STATUS['quero-ir'];
  const extras = [
    l.dificuldade && `🥾 ${DIFICULDADES[l.dificuldade] || l.dificuldade}`,
    l.duracaoMin && `⏱️ ${formatarDuracao(l.duracaoMin)}`,
    l.acesso === 'barco' && '⛵ barco',
    l.reservaNecessaria && '📞 reservar'
  ].filter(Boolean);
  const meta = [t.rotulo, `${st.emoji} ${st.rotulo}`, ...extras, l.coordAprox && '📍 posição aproximada'].filter(Boolean).join(' · ');
  return `<div class="folha-topo" style="--cor:${t.cor}">
      <span class="card-emoji">${t.emoji}</span>
      <div><div class="folha-nome">${l.favorito ? '★ ' : ''}${esc(l.nome)}</div><div class="folha-meta">${esc(meta)}</div></div>
    </div>
    <div class="acoes">
      <a class="btn" href="#/lugar/${encodeURIComponent(l.id)}">Ver ficha</a>
      <button class="btn btn-sec" data-acao="roteiro">+ Roteiro</button>
      <a class="btn btn-sec" href="${linkGoogleMaps(l)}" target="_blank" rel="noopener">🧭 Rota</a>
    </div>`;
}

function folhaResultado(r) {
  const t = tipoInfo(r.tipo);
  return `<div class="folha-topo" style="--cor:${t.cor}">
      <span class="card-emoji">${t.emoji}</span>
      <div><div class="folha-nome">${esc(r.nome)}</div><div class="folha-meta">${esc(r.endereco || r.detalhe || 'Resultado da busca · ainda não salvo')}</div></div>
    </div>
    <div class="acoes">
      <button class="btn" data-acao="salvar">➕ Salvar</button>
      <a class="btn btn-sec" href="${linkGoogleMaps(r)}" target="_blank" rel="noopener">🧭 Rota</a>
    </div>`;
}

function folhaParada(a, n, lugar) {
  const t = lugar ? tipoInfo(lugar.tipo) : { emoji: '📌', cor: '#14758a' };
  return `<div class="folha-topo" style="--cor:${t.cor}">
      <span class="card-emoji">${n}</span>
      <div><div class="folha-nome">${esc(a.titulo || lugar?.nome || 'Parada')}</div><div class="folha-meta">${[a.horaInicio, a.duracaoMin && formatarDuracao(a.duracaoMin), a.confirmada && 'confirmada', a.alternativa && 'plano B'].filter(Boolean).map(esc).join(' · ') || 'Parada do dia'}</div></div>
    </div>
    <div class="acoes">
      ${lugar ? `<a class="btn" href="#/lugar/${encodeURIComponent(lugar.id)}">Ver ficha</a>` : ''}
      ${lugar && temCoord(lugar) ? `<a class="btn btn-sec" href="${linkGoogleMaps(lugar)}" target="_blank" rel="noopener">🧭 Rota</a>` : ''}
    </div>`;
}

export function render(container, { params = [] } = {}) {
  const filtros = lerFiltros();
  const modoDia = params[0] === 'dia' ? params[1] : null;
  const focoLugar = params[0] === 'lugar' ? params[1] : null;
  let focado = false;

  const el = html(`<section class="mapa-wrap">
    <div id="mapa"></div>
    <button class="fab fab-gps" aria-label="Perto de mim">${ico('gps')}</button>
    <div class="folha" role="dialog" aria-live="polite"></div>
  </section>`);
  container.append(el);

  const map = L.map(el.querySelector('#mapa'), { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  if (ultimaVisao && !modoDia && !focoLugar) map.setView(ultimaVisao.centro, ultimaVisao.zoom);
  else map.setView([CENTRO_REGIAO.lat, CENTRO_REGIAO.lng], 10);
  map.on('moveend', () => { if (!modoDia && !focoLugar) ultimaVisao = { centro: map.getCenter(), zoom: map.getZoom() }; });

  const camada = L.layerGroup().addTo(map);
  const folha = el.querySelector('.folha');
  let todos = [];
  let selecionado = null; // marcador com a folha aberta
  let atual = null; // { tipo: 'lugar'|'resultado'|'parada', dados }

  /* ---------- folha de baixo ---------- */
  const marcarSel = (m, on) => m?.getElement()?.querySelector('.pin')?.classList.toggle('pin-sel', on);
  const fecharFolha = () => {
    folha.classList.remove('aberta');
    marcarSel(selecionado, false);
    selecionado = null;
    atual = null;
  };
  function abrirFolha(conteudo, marcador, dadosAtuais) {
    marcarSel(selecionado, false);
    selecionado = marcador;
    atual = dadosAtuais;
    marcarSel(marcador, true);
    folha.innerHTML = conteudo;
    folha.classList.add('aberta');
  }
  map.on('click', fecharFolha);
  folha.addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!acao || !atual) return;
    if (acao === 'roteiro' && atual.tipo === 'lugar') abrirAdicionarAoRoteiro({ lugarId: atual.dados.id, titulo: atual.dados.nome });
    if (acao === 'salvar' && atual.tipo === 'resultado') {
      const id = await modalSalvarResultado(atual.dados);
      if (id) fecharFolha();
    }
  });

  /* ---------- desenho ---------- */
  function desenhar() {
    fecharFolha();
    camada.clearLayers();
    if (modoDia) return desenharDia();

    const salvosOsm = new Set(listar('lugares').map((l) => l.osmId).filter(Boolean));
    // resultados do Explorar (ainda não salvos), mais discretos
    const exp = lerExplorar();
    if (mostrarExplorar && exp?.resultados?.length) {
      for (const r of exp.resultados) {
        if (salvosOsm.has(r.osmId)) continue;
        const m = L.marker([r.lat, r.lng], { icon: icone(r, { extra: 'pin-resultado' }) }).addTo(camada);
        m.on('click', () => abrirFolha(folhaResultado(r), m, { tipo: 'resultado', dados: r }));
      }
    }
    for (const l of aplicarFiltros(todos, filtros)) {
      if (!temCoord(l)) continue; // sem coordenada: só aparece na lista
      const m = L.marker([l.lat, l.lng], { icon: icone(l) }).addTo(camada);
      m.on('click', () => abrirFolha(folhaLugar(l), m, { tipo: 'lugar', dados: l }));
      if (focoLugar === l.id && !focado) {
        focado = true;
        map.setView([l.lat, l.lng], 15);
        setTimeout(() => abrirFolha(folhaLugar(l), m, { tipo: 'lugar', dados: l }), 300);
      }
    }
  }

  /** Paradas do dia, numeradas na ordem, ligadas por uma linha (reta: não é rota real). */
  function desenharDia() {
    const paradas = atividadesDoDia(listar('atividades'), modoDia)
      .map((a) => ({ a, l: a.lugarId ? obter('lugares', a.lugarId) : null }))
      .filter(({ l }) => l && temCoord(l));
    const principais = paradas.filter(({ a }) => !a.alternativa);
    principais.forEach(({ a, l }, i) => {
      const m = L.marker([l.lat, l.lng], { icon: icone(l, { rotulo: String(i + 1) }) }).addTo(camada);
      m.on('click', () => abrirFolha(folhaParada(a, i + 1, l), m, { tipo: 'parada', dados: a }));
    });
    paradas.filter(({ a }) => a.alternativa).forEach(({ a, l }) => {
      const m = L.marker([l.lat, l.lng], { icon: icone(l, { rotulo: 'B', extra: 'pin-resultado' }) }).addTo(camada);
      m.on('click', () => abrirFolha(folhaParada(a, 'B', l), m, { tipo: 'parada', dados: a }));
    });
    if (principais.length > 1) {
      L.polyline(principais.map(({ l }) => [l.lat, l.lng]), { color: '#ff6a4d', weight: 3, dashArray: '8 8', opacity: 0.85 }).addTo(camada);
    }
    if (paradas.length) map.fitBounds(L.latLngBounds(paradas.map(({ l }) => [l.lat, l.lng])), { padding: [60, 60], maxZoom: 15 });
  }

  /* ---------- topo do mapa ---------- */
  if (modoDia) {
    const dia = obter('dias', modoDia);
    el.prepend(html(`<div class="mapa-dia"><div><b>${esc(dia?.titulo || 'Dia')}</b><small>Paradas na ordem do roteiro · linha reta, não é rota</small></div>
      <a class="btn btn-sm btn-sec" href="#/roteiro">Voltar</a></div>`));
  } else {
    const topo = html('<div class="mapa-topo"></div>');
    el.prepend(topo);
    // Busca por nome na internet: voa até o resultado e oferece salvar
    let marcaAchado = null;
    topo.append(Object.assign(campoBusca({
      placeholder: 'Buscar camping, praia, trilha…',
      onEscolher: (r) => {
        marcaAchado?.remove();
        marcaAchado = L.marker([r.lat, r.lng], { icon: icone(r, { extra: 'pin-resultado' }) }).addTo(map);
        marcaAchado.on('click', () => abrirFolha(folhaResultado(r), marcaAchado, { tipo: 'resultado', dados: r }));
        map.flyTo([r.lat, r.lng], 15);
        abrirFolha(folhaResultado(r), marcaAchado, { tipo: 'resultado', dados: r });
      }
    }), { className: 'busca-geo mapa-busca' }));
    topo.append(barraFiltros(filtros, desenhar));
    const exp = lerExplorar();
    if (exp?.resultados?.length) {
      const linhaChips = html('<div class="chips"></div>');
      const chip = html(`<button class="chip chip-sm ${mostrarExplorar ? 'on' : ''}">Resultados do Explorar (${exp.resultados.length})</button>`);
      chip.addEventListener('click', () => { mostrarExplorar = !mostrarExplorar; chip.classList.toggle('on', mostrarExplorar); desenhar(); });
      linhaChips.append(chip);
      linhaChips.className = 'chips mapa-extra';
      topo.append(linhaChips);
    }
  }

  // "Perto de mim": centraliza no GPS e mostra um pontinho azul
  let meuPonto = null;
  el.querySelector('.fab-gps').addEventListener('click', async () => {
    toast('📡 Procurando você…');
    const pos = await posicaoAtual();
    if (!pos) return toast('Não consegui sua localização (GPS desligado ou sem permissão)');
    meuPonto?.remove();
    meuPonto = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2a7de1', fillOpacity: 1 }).addTo(map);
    map.setView([pos.lat, pos.lng], 13);
  });

  // Leaflet precisa recalcular tamanho depois que o container entra na tela
  setTimeout(() => map.invalidateSize(), 50);

  const cancelar = assinarVarias(['lugares', 'atividades', 'dias'], () => { todos = listar('lugares'); desenhar(); });
  return () => { cancelar(); map.remove(); };
}
