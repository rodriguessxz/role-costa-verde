// 🗺️ Mapa com pins por tipo, filtros e "perto de mim".
import L from 'leaflet';
import { assinar } from '../store.js';
import { salvarAchado } from '../achados.js';
import { temCoord, posicaoAtual, linkGoogleMaps, CENTRO_REGIAO } from '../lib/geo.js';
import { esc, html, toast, tipoInfo, STATUS, lerFiltros, aplicarFiltros, barraFiltros, campoBusca, formatarDuracao, DIFICULDADES } from '../ui.js';

// Lembra a última visão do mapa entre trocas de aba
let ultimaVisao = null;

/** Ícone redondo com emoji, colorido pelo tipo (sem depender de imagens). */
function icone(l) {
  const t = tipoInfo(l.tipo);
  const classes = ['pin', `pin-${l.status || 'quero-ir'}`, l.coordAprox ? 'pin-aprox' : ''].join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${classes}" style="--cor:${t.cor}"><span>${t.emoji}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38]
  });
}

/** Folha para um lugar achado na busca (ainda não salvo). */
function folhaAchadoHtml(r) {
  const t = tipoInfo(r.tipo);
  return `<div class="folha-topo" style="--cor:${t.cor}">
      <span class="card-emoji">${t.emoji}</span>
      <div><div class="folha-nome">${esc(r.nome)}</div><div class="folha-meta">${esc(r.detalhe || 'Resultado da busca')}</div></div>
    </div>
    <div class="acoes">
      <button class="btn" data-acao="salvar">➕ Salvar na lista</button>
      <a class="btn btn-sec" href="${linkGoogleMaps(r)}" target="_blank" rel="noopener">🧭 Rota</a>
    </div>`;
}

/** Conteúdo da folha que sobe ao tocar num pin. */
function folhaHtml(l) {
  const t = tipoInfo(l.tipo);
  const st = STATUS[l.status || 'quero-ir'];
  const extras = [
    l.dificuldade && `🥾 ${DIFICULDADES[l.dificuldade] || l.dificuldade}`,
    l.duracaoMin && `⏱️ ${formatarDuracao(l.duracaoMin)}`,
    l.acesso === 'barco' && '⛵ barco',
    l.reservaNecessaria && '📞 reservar'
  ].filter(Boolean);
  const meta = [t.rotulo, `${st.emoji} ${st.rotulo}`, ...extras, l.coordAprox && '📍 posição aproximada'].filter(Boolean).join(' · ');
  return `<div class="folha-topo" style="--cor:${t.cor}">
      <span class="card-emoji">${t.emoji}</span>
      <div><div class="folha-nome">${esc(l.nome)}</div><div class="folha-meta">${esc(meta)}</div></div>
    </div>
    <div class="acoes">
      <a class="btn" href="#/lugar/${encodeURIComponent(l.id)}">Ver ficha</a>
      <a class="btn btn-sec" href="${linkGoogleMaps(l)}" target="_blank" rel="noopener">🧭 Rota</a>
    </div>`;
}

export function render(container) {
  const filtros = lerFiltros();
  const el = html(`<section class="mapa-wrap">
    <div id="mapa"></div>
    <button class="fab fab-gps" aria-label="Perto de mim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.500"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg></button>
    <div class="folha" role="dialog" aria-live="polite"></div>
  </section>`);
  container.append(el);

  const map = L.map(el.querySelector('#mapa'), { zoomControl: false, attributionControl: true });
  // Tiles OpenStreetMap (no modo escuro o CSS inverte as cores do mapa)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  if (ultimaVisao) map.setView(ultimaVisao.centro, ultimaVisao.zoom);
  else map.setView([CENTRO_REGIAO.lat, CENTRO_REGIAO.lng], 10);
  map.on('moveend', () => { ultimaVisao = { centro: map.getCenter(), zoom: map.getZoom() }; });

  const camada = L.layerGroup().addTo(map);
  let todos = [];

  // Folha de baixo: mostra o lugar tocado e destaca o pin
  const folha = el.querySelector('.folha');
  let pinSel = null;
  const fecharFolha = () => {
    folha.classList.remove('aberta');
    if (achado) { marcaAchado?.remove(); marcaAchado = null; achado = null; }
    pinSel?.getElement()?.querySelector('.pin')?.classList.remove('pin-sel');
    pinSel = null;
  };
  const abrirFolha = (l, marcador) => {
    pinSel?.getElement()?.querySelector('.pin')?.classList.remove('pin-sel');
    pinSel = marcador;
    marcador.getElement()?.querySelector('.pin')?.classList.add('pin-sel');
    folha.innerHTML = folhaHtml(l);
    folha.classList.add('aberta');
    map.panTo([l.lat, l.lng], { animate: true });
  };
  map.on('click', fecharFolha);

  // Busca ativa: voa até o resultado e oferece salvar
  let achado = null;
  let marcaAchado = null;
  const limparAchado = () => { marcaAchado?.remove(); marcaAchado = null; achado = null; };
  el.prepend(Object.assign(campoBusca({
    placeholder: 'Buscar camping, praia, trilha…',
    onEscolher: (r) => {
      limparAchado();
      achado = r;
      marcaAchado = L.marker([r.lat, r.lng], { icon: icone({ tipo: r.tipo, status: 'quero-ir' }) }).addTo(map);
      map.flyTo([r.lat, r.lng], 15);
      folha.innerHTML = folhaAchadoHtml(r);
      folha.classList.add('aberta');
    }
  }), { className: 'busca-geo mapa-busca' }));
  folha.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-acao="salvar"]') || !achado) return;
    const id = await salvarAchado(achado);
    toast('✨ Salvo na lista!');
    limparAchado();
    location.hash = `#/lugar/${encodeURIComponent(id)}`;
  });

  const desenhar = () => {
    fecharFolha();
    camada.clearLayers();
    for (const l of aplicarFiltros(todos, filtros)) {
      if (!temCoord(l)) continue; // sem coordenada: só aparece na lista
      const marcador = L.marker([l.lat, l.lng], { icon: icone(l) }).addTo(camada);
      marcador.on('click', () => abrirFolha(l, marcador));
    }
  };

  // Filtros flutuando em cima do mapa
  el.prepend(barraFiltros(filtros, desenhar));

  const cancelar = assinar('lugares', (lugares) => { todos = lugares; desenhar(); });

  // "Perto de mim": centraliza no GPS e mostra um pontinho azul
  let meuPonto = null;
  el.querySelector('.fab-gps').addEventListener('click', async () => {
    toast('📡 Procurando você…');
    const pos = await posicaoAtual();
    if (!pos) return toast('Não consegui sua localização (GPS desligado ou sem permissão)');
    if (meuPonto) meuPonto.remove();
    meuPonto = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2a7de1', fillOpacity: 1 }).addTo(map);
    map.setView([pos.lat, pos.lng], 13);
  });

  // Leaflet precisa recalcular tamanho depois que o container entra na tela
  setTimeout(() => map.invalidateSize(), 50);

  return () => { cancelar(); map.remove(); };
}
