// 🗺️ Mapa com pins por tipo, filtros e "perto de mim".
import L from 'leaflet';
import { assinar } from '../store.js';
import { temCoord, posicaoAtual, CENTRO_REGIAO } from '../lib/geo.js';
import { esc, html, toast, tipoInfo, STATUS, lerFiltros, aplicarFiltros, barraFiltros, formatarDuracao, DIFICULDADES } from '../ui.js';

// Lembra a última visão do mapa entre trocas de aba
let ultimaVisao = null;

/** Ícone redondo com emoji, colorido pelo tipo (sem depender de imagens). */
function icone(l) {
  const t = tipoInfo(l.tipo);
  const classes = ['pin', `pin-${l.status || 'quero-ir'}`, l.coordAprox ? 'pin-aprox' : ''].join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${classes}" style="--cor:${t.cor}">${t.emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16]
  });
}

function popup(l) {
  const t = tipoInfo(l.tipo);
  const extras = [
    l.dificuldade && `🥾 ${DIFICULDADES[l.dificuldade] || l.dificuldade}`,
    l.duracaoMin && `⏱️ ${formatarDuracao(l.duracaoMin)}`,
    l.acesso === 'barco' && '⛵ barco',
    l.reservaNecessaria && '📞 reservar'
  ].filter(Boolean).join(' · ');
  return `<div class="pop">
    <strong>${t.emoji} ${esc(l.nome)}</strong>
    ${extras ? `<div class="pop-meta">${esc(extras)}</div>` : ''}
    <div class="pop-meta">${STATUS[l.status || 'quero-ir'].emoji} ${STATUS[l.status || 'quero-ir'].rotulo}${l.coordAprox ? ' · 📍 posição aproximada' : ''}</div>
    <a class="btn btn-sm" href="#/lugar/${encodeURIComponent(l.id)}">Ver ficha →</a>
  </div>`;
}

export function render(container) {
  const filtros = lerFiltros();
  const el = html(`<section class="mapa-wrap">
    <div id="mapa"></div>
    <button class="fab fab-gps" aria-label="Perto de mim">📍</button>
  </section>`);
  container.append(el);

  const map = L.map(el.querySelector('#mapa'), { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  if (ultimaVisao) map.setView(ultimaVisao.centro, ultimaVisao.zoom);
  else map.setView([CENTRO_REGIAO.lat, CENTRO_REGIAO.lng], 10);
  map.on('moveend', () => { ultimaVisao = { centro: map.getCenter(), zoom: map.getZoom() }; });

  const camada = L.layerGroup().addTo(map);
  let todos = [];

  const desenhar = () => {
    camada.clearLayers();
    for (const l of aplicarFiltros(todos, filtros)) {
      if (!temCoord(l)) continue; // sem coordenada: só aparece na lista
      L.marker([l.lat, l.lng], { icon: icone(l) }).bindPopup(popup(l)).addTo(camada);
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
