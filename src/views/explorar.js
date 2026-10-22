// 🧭 Explorar: achar praias, trilhas, campings, mercados, postos e serviços perto de um ponto.
// Dados reais do OpenStreetMap (Overpass) + busca por nome (Photon). Nada é inventado:
// o que a fonte não informa aparece como "indisponível".
import L from 'leaflet';
import { assinar, listar } from '../store.js';
import { CATEGORIAS, montarConsulta, converterResposta, mesclarResultados } from '../lib/osm.js';
import { consultarOverpass } from '../lib/overpass.js';
import { buscarLugares, buscaRapida } from '../lib/geocode.js';
import { CENTRO_REGIAO, posicaoAtual, linkGoogleMaps, formatarKm } from '../lib/geo.js';
import { tempoRelativo } from '../lib/tempo.js';
import { guardarExplorar, lerExplorar } from '../explorar-estado.js';
import { modalSalvarResultado, salvarResultado, abrirAdicionarAoRoteiro } from '../acoes.js';
import { ico } from '../icons.js';
import { esc, html, toast, tipoInfo, vazio, REGIOES, debounce } from '../ui.js';

// Centros aproximados de cada região (usados só como ponto de partida da busca).
const CENTROS = {
  'ubatuba-centro': { lat: -23.4336, lng: -45.0838 },
  'ubatuba-norte': { lat: -23.3650, lng: -44.8480 },
  'ubatuba-sul': { lat: -23.4950, lng: -45.1600 },
  trindade: { lat: -23.3590, lng: -44.7240 },
  paraty: { lat: -23.2178, lng: -44.7131 },
  'paraty-mirim': { lat: -23.2930, lng: -44.6480 }
};
const RAIOS = [2, 5, 10, 25];
const POR_PAGINA = 25;

// Preferências mantidas entre visitas à aba
const estado = {
  origem: null, // { lat, lng, rotulo }
  raio: 5,
  cats: [], // [] = todas
  texto: '',
  resultados: [],
  nomeAchados: [],
  mostrando: POR_PAGINA,
  status: 'inicio', // inicio | carregando | ok | vazio | erro
  erro: '',
  em: null
};

function corPin(tipo) { return tipoInfo(tipo).cor; }

export function render(container) {
  const salvo = lerExplorar();
  if (!estado.origem && salvo?.origem) {
    Object.assign(estado, { origem: salvo.origem, raio: salvo.raio, cats: salvo.cats, texto: salvo.texto || '', resultados: salvo.resultados || [], em: salvo.em, status: salvo.resultados?.length ? 'ok' : 'inicio' });
  }
  if (!estado.origem) estado.origem = { ...CENTRO_REGIAO, rotulo: 'Entre Ubatuba e Paraty' };

  const el = html(`<section class="pagina explorar">
    <div class="explorar-cab">
      <h1>Explorar</h1>
      <p class="sub">Praias, trilhas, campings, mercados, postos e serviços perto de um ponto.</p>
    </div>

    <form class="explorar-busca" data-form="busca">
      <input type="search" class="input" name="q" placeholder="Nome ou palavra-chave" value="${esc(estado.texto)}" autocomplete="off" enterkeyhint="search" />
      <button class="btn" type="submit">Buscar</button>
    </form>

    <div class="explorar-origem">
      <div class="chips">
        <button class="chip chip-gps" data-acao="gps">${ico('gps')} Minha localização</button>
        ${Object.entries(CENTROS).map(([k]) => `<button class="chip" data-regiao="${k}">${esc(REGIOES[k])}</button>`).join('')}
      </div>
      <p class="dica" data-origem></p>
    </div>

    <div class="explorar-controles">
      <div class="segmentado-mini" data-raios aria-label="Raio da busca">${RAIOS.map((r) => `<button data-raio="${r}">${r} km</button>`).join('')}</div>
      <div class="chips" data-cats></div>
    </div>

    <div class="explorar-corpo">
      <div class="explorar-mapa"><div id="mapa-explorar"></div></div>
      <div class="explorar-lista">
        <div data-nomes></div>
        <div data-resultados aria-live="polite"></div>
      </div>
    </div>
  </section>`);
  container.append(el);

  /* ---------- mapa ---------- */
  const map = L.map(el.querySelector('#mapa-explorar'), { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.setView([estado.origem.lat, estado.origem.lng], 12); // o Leaflet exige uma visão inicial
  const camada = L.layerGroup().addTo(map);
  let circulo = null;
  let marcaOrigem = null;
  const marcas = new Map(); // osmId → marker

  const pinIcone = (r, sel = false) => L.divIcon({
    className: '',
    html: `<div class="pin ${sel ? 'pin-sel' : ''}" style="--cor:${corPin(r.tipo)}"><span>${(CATEGORIAS[r.categoria] || tipoInfo(r.tipo)).emoji}</span></div>`,
    iconSize: [38, 38], iconAnchor: [19, 38]
  });

  function desenharOrigem(ajustar = true) {
    const { lat, lng } = estado.origem;
    circulo?.remove();
    marcaOrigem?.remove();
    circulo = L.circle([lat, lng], { radius: estado.raio * 1000, color: '#14758a', weight: 2, fillOpacity: 0.06, dashArray: '6 6' }).addTo(map);
    marcaOrigem = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({ className: '', html: '<div class="origem-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
    }).addTo(map);
    marcaOrigem.on('dragend', () => { const p = marcaOrigem.getLatLng(); definirOrigem({ lat: p.lat, lng: p.lng, rotulo: 'Ponto escolhido no mapa' }); });
    if (ajustar) map.fitBounds(circulo.getBounds(), { padding: [10, 10] });
  }

  function desenharResultados() {
    camada.clearLayers();
    marcas.clear();
    for (const r of estado.resultados) {
      const m = L.marker([r.lat, r.lng], { icon: pinIcone(r) }).addTo(camada);
      m.on('click', () => destacar(r.osmId, true));
      marcas.set(r.osmId, m);
    }
  }

  map.on('click', (e) => definirOrigem({ lat: e.latlng.lat, lng: e.latlng.lng, rotulo: 'Ponto escolhido no mapa' }));

  /* ---------- controles ---------- */
  const dicaOrigem = el.querySelector('[data-origem]');
  function pintarControles() {
    dicaOrigem.innerHTML = `Buscando perto de <b>${esc(estado.origem.rotulo)}</b> · toque no mapa para mudar o ponto`;
    el.querySelectorAll('[data-raio]').forEach((b) => b.classList.toggle('on', Number(b.dataset.raio) === estado.raio));
    el.querySelector('[data-cats]').innerHTML = [
      `<button class="chip ${estado.cats.length === 0 ? 'on' : ''}" data-cat="*">Tudo</button>`,
      ...Object.entries(CATEGORIAS).map(([k, c]) => `<button class="chip ${estado.cats.length === 1 && estado.cats[0] === k ? 'on' : ''}" data-cat="${k}">${c.emoji} ${c.rotulo}</button>`)
    ].join('');
  }

  function definirOrigem(o, { buscar = true, ajustar = false } = {}) {
    estado.origem = o;
    desenharOrigem(ajustar);
    pintarControles();
    if (buscar) agendar();
  }

  el.addEventListener('click', async (e) => {
    const regiao = e.target.closest('[data-regiao]');
    if (regiao) {
      const k = regiao.dataset.regiao;
      definirOrigem({ ...CENTROS[k], rotulo: `${REGIOES[k]} (centro aproximado)` }, { ajustar: true });
      return;
    }
    if (e.target.closest('[data-acao="gps"]')) {
      toast('📡 Procurando você…');
      const p = await posicaoAtual();
      if (!p) return toast('Não consegui sua localização (GPS desligado ou sem permissão)');
      definirOrigem({ lat: p.lat, lng: p.lng, rotulo: 'sua localização' }, { ajustar: true });
      return;
    }
    const raio = e.target.closest('[data-raio]');
    if (raio) { estado.raio = Number(raio.dataset.raio); desenharOrigem(true); pintarControles(); agendar(); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      const v = cat.dataset.cat;
      estado.cats = v === '*' || (estado.cats.length === 1 && estado.cats[0] === v) ? [] : [v];
      pintarControles();
      agendar();
    }
  });

  el.querySelector('[data-form="busca"]').addEventListener('submit', (e) => {
    e.preventDefault();
    estado.texto = String(new FormData(e.target).get('q')).trim();
    buscarTudo();
  });

  /* ---------- busca ---------- */
  const agendar = debounce(() => buscarTudo(), 500);
  let ctrl = null;
  let ultimaConsulta = 0;

  async function buscarTudo() {
    ctrl?.abort();
    ctrl = new AbortController();
    const minha = ctrl;
    estado.status = 'carregando';
    estado.mostrando = POR_PAGINA;
    pintarLista();

    // limite de requisições: no mínimo 1,2 s entre consultas ao servidor gratuito
    const espera = ultimaConsulta + 1200 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    if (minha.signal.aborted) return;
    ultimaConsulta = Date.now();

    // 1) lugares por nome (Photon), só quando há texto
    estado.nomeAchados = [];
    const textoBusca = estado.texto;
    const porNome = textoBusca.length >= 3
      ? buscarLugares(textoBusca, { signal: minha.signal, limite: 5 }).catch(() => [])
      : Promise.resolve([]);

    // 2) busca rápida (Photon, ~1 s) e busca completa (Overpass, pode demorar ou estar ocupada), em paralelo
    estado.aviso = '';
    estado.completando = true;
    estado.resultados = [];
    const origem = estado.origem;
    const sinal = minha.signal;
    const rapida = buscaRapida(estado.cats, origem, estado.raio, textoBusca, { signal: sinal }).then((r) => ({ r }), (e) => ({ e }));
    const completa = consultarOverpass(montarConsulta(estado.cats, origem, estado.raio * 1000, textoBusca), { signal: sinal })
      .then((j) => ({ r: converterResposta(j, origem) }), (e) => ({ e }));

    const r1 = await rapida;
    if (sinal.aborted || r1.e?.name === 'AbortError') return;
    if (r1.r) {
      estado.resultados = r1.r;
      estado.status = r1.r.length ? 'ok' : 'carregando';
      estado.em = new Date().toISOString();
      desenharResultados();
      pintarLista();
    }

    const r2 = await completa;
    if (sinal.aborted || r2.e?.name === 'AbortError') return;
    estado.completando = false;
    if (r2.r) {
      estado.resultados = mesclarResultados(r2.r, r1.r || []);
      estado.status = estado.resultados.length ? 'ok' : 'vazio';
    } else if (r1.r) {
      estado.status = r1.r.length ? 'ok' : 'vazio';
      estado.aviso = r2.e?.tipo === 'offline' ? 'Sem internet.'
        : 'O servidor de detalhes completos está ocupado agora. Mostrando a busca rápida, sem telefone, horário ou site. Tente de novo em instantes para ver mais.';
    } else {
      estado.status = 'erro';
      const tipo = (r2.e || r1.e)?.tipo;
      estado.erro = tipo === 'offline' || !navigator.onLine ? 'Sem internet. A busca precisa de conexão.'
        : 'Não foi possível buscar agora (os serviços gratuitos de mapas estão instáveis). Tente de novo em instantes.';
    }
    estado.em = new Date().toISOString();
    if (estado.status !== 'erro') {
      guardarExplorar({ origem: estado.origem, raio: estado.raio, cats: estado.cats, texto: estado.texto, resultados: estado.resultados, em: estado.em });
    }
    estado.nomeAchados = await porNome;
    if (minha.signal.aborted) return;
    desenharResultados();
    pintarLista();
  }

  /* ---------- lista ---------- */
  const salvosOsm = () => new Map(listar('lugares').filter((l) => l.osmId).map((l) => [l.osmId, l]));

  function cartao(r, salvos) {
    const t = tipoInfo(r.tipo);
    const cat = CATEGORIAS[r.categoria];
    const salvo = salvos.get(r.osmId);
    const info = (rotulo, valor) => `<div class="linha"><span>${rotulo}</span><strong>${valor || '<em class="indisp">indisponível</em>'}</strong></div>`;
    return `<article class="res-card ${salvo ? 'salvo' : ''}" data-id="${esc(r.osmId)}" style="--cor:${t.cor}">
      <div class="res-topo">
        <span class="card-emoji">${cat?.emoji || t.emoji}</span>
        <div class="res-titulo">
          <b>${esc(r.nome)}</b>
          <small>${esc(cat?.rotulo || t.rotulo)}${r.distanciaKm != null ? ` · ${formatarKm(r.distanciaKm)}` : ''}${salvo ? ' · <span class="ok-salvo">✓ salvo</span>' : ''}</small>
        </div>
        <button class="icon-btn mini" data-acao="ver-mapa" aria-label="Ver no mapa">${ico('mapa')}</button>
      </div>
      <details class="res-detalhes">
        <summary>Detalhes e fonte</summary>
        <div class="info">
          ${info('Endereço', esc(r.endereco))}
          ${info('Horário', esc(r.horario))}
          ${info('Telefone', r.telefone ? `<a href="tel:${esc(String(r.telefone).replace(/[^\d+]/g, ''))}">${esc(r.telefone)}</a>` : '')}
          ${info('Site', /^https?:\/\//i.test(r.site || '') ? `<a href="${esc(r.site)}" target="_blank" rel="noopener noreferrer">abrir</a>` : '')}
          ${info('Preço', r.pago === true ? 'Pago (valor não informado)' : r.pago === false ? 'Gratuito (confirmar)' : '')}
          ${info('Acesso', esc(r.acessoInfo))}
          ${['camping', 'hospedagem'].includes(r.categoria) ? info('Estrutura', esc((r.estrutura || []).join(', '))) : ''}
          ${info('Avaliações', '')}
          <div class="linha"><span>Fonte</span><strong><a href="${esc(r.fonteUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></strong></div>
        </div>
        ${r.rapida ? '<p class="dica">Busca rápida: telefone, horário e site podem existir no mapa, mas não vieram nesta consulta.</p>' : ''}
        <p class="dica">Dados abertos e colaborativos: confirme preço, horário, reserva e acesso antes de ir. Este lugar pode não ser público ou liberado para camping.</p>
      </details>
      <div class="res-acoes">
        ${salvo
    ? `<a class="btn btn-sm btn-sec" href="#/lugar/${encodeURIComponent(salvo.id)}">Abrir ficha</a>`
    : '<button class="btn btn-sm" data-acao="salvar">Salvar</button>'}
        <button class="btn btn-sm btn-sec" data-acao="roteiro">+ Roteiro</button>
        ${salvo ? '' : '<button class="btn btn-sm btn-sec" data-acao="ideia">💡 Ideia</button>'}
        <a class="btn btn-sm btn-sec" href="${linkGoogleMaps(r)}" target="_blank" rel="noopener">🧭 Rota</a>
      </div>
    </article>`;
  }

  function pintarLista() {
    const caixa = el.querySelector('[data-resultados]');
    const nomes = el.querySelector('[data-nomes]');
    const salvos = salvosOsm();

    nomes.innerHTML = estado.nomeAchados.length ? `<div class="bloco-simples">
      <h3>Lugares com “${esc(estado.texto)}” no nome</h3>
      ${estado.nomeAchados.map((r, i) => `<div class="nome-achado" data-i="${i}">
        <span class="busca-emoji">${tipoInfo(r.tipo).emoji}</span>
        <span class="nome-achado-txt"><b>${esc(r.nome)}</b><small>${esc(r.detalhe || '')}</small></span>
        <button class="btn btn-sm btn-sec" data-acao="ao-redor">Explorar ao redor</button>
        <button class="btn btn-sm" data-acao="salvar-nome">Salvar</button></div>`).join('')}
    </div>` : '';

    if (estado.status === 'carregando' && !estado.resultados.length) {
      caixa.innerHTML = `<div class="carregando"><i></i><i></i><i></i></div><p class="dica centro">Buscando no OpenStreetMap…</p>`;
      return;
    }
    let topo = '';
    if (estado.completando) topo += '<p class="dica aviso-suave">⏳ Resultados rápidos. Buscando telefone, horário e site…</p>';
    if (estado.aviso) topo += `<div class="aviso">ℹ️ ${esc(estado.aviso)} <button class="btn btn-sm btn-sec" data-acao="tentar">Tentar de novo</button></div>`;
    if (estado.status === 'erro') topo += `<div class="aviso">⚠️ ${esc(estado.erro)} <button class="btn btn-sm btn-sec" data-acao="tentar">Tentar de novo</button></div>`;
    if (estado.status === 'inicio' && !estado.resultados.length) {
      caixa.innerHTML = vazio({ emoji: '🧭', titulo: 'Escolha um ponto e explore', texto: 'Use sua localização, uma região ou toque no mapa. Depois filtre por categoria e raio.', acao: { rotulo: 'Buscar por aqui', id: 'buscar' } });
      return;
    }
    if (!estado.resultados.length) {
      caixa.innerHTML = topo + (estado.status === 'vazio'
        ? vazio({ emoji: '🌫️', titulo: 'Nada encontrado nesse raio', texto: 'Aumente o raio, mude a categoria ou mova o ponto no mapa. O OpenStreetMap pode não ter tudo.' }) : '');
      return;
    }
    const visiveis = estado.resultados.slice(0, estado.mostrando);
    caixa.innerHTML = `${topo}
      <p class="dica">${estado.resultados.length} resultado${estado.resultados.length > 1 ? 's' : ''} · fonte OpenStreetMap${estado.em ? ` · ${tempoRelativo(estado.em)}` : ''}</p>
      <div class="res-lista">${visiveis.map((r) => cartao(r, salvos)).join('')}</div>
      ${estado.resultados.length > estado.mostrando ? '<button class="btn btn-sec btn-grande" data-acao="mais">Mostrar mais</button>' : ''}`;
  }

  function destacar(osmId, rolar) {
    el.querySelectorAll('.res-card.destaque').forEach((c) => c.classList.remove('destaque'));
    const r = estado.resultados.find((x) => x.osmId === osmId);
    if (!r) return;
    marcas.forEach((m, id) => m.setIcon(pinIcone(estado.resultados.find((x) => x.osmId === id), id === osmId)));
    if (rolar) {
      let card = el.querySelector(`.res-card[data-id="${CSS.escape(osmId)}"]`);
      if (!card) { estado.mostrando = estado.resultados.length; pintarLista(); card = el.querySelector(`.res-card[data-id="${CSS.escape(osmId)}"]`); }
      card?.classList.add('destaque');
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 15));
      el.querySelector(`.res-card[data-id="${CSS.escape(osmId)}"]`)?.classList.add('destaque');
    }
  }

  el.querySelector('.explorar-lista').addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao], [data-vazio]');
    if (!acao) return;
    const a = acao.dataset.acao || acao.dataset.vazio;
    if (a === 'tentar' || a === 'buscar') return buscarTudo();
    if (a === 'mais') { estado.mostrando += POR_PAGINA; return pintarLista(); }

    const nomeEl = acao.closest('.nome-achado');
    if (nomeEl) {
      const r = estado.nomeAchados[Number(nomeEl.dataset.i)];
      if (a === 'ao-redor') {
        definirOrigem({ lat: r.lat, lng: r.lng, rotulo: r.nome }, { ajustar: true });
        estado.texto = '';
        el.querySelector('[name=q]').value = '';
      } else if (a === 'salvar-nome') {
        await modalSalvarResultado(r);
      }
      return;
    }
    const card = acao.closest('.res-card');
    if (!card) return;
    const r = estado.resultados.find((x) => x.osmId === card.dataset.id);
    if (!r) return;
    if (a === 'ver-mapa') return destacar(r.osmId, false);
    if (a === 'salvar') { await modalSalvarResultado(r); pintarLista(); }
    if (a === 'ideia') {
      await salvarResultado(r, { status: 'ideia' });
      toast('💡 Salvo como ideia em Lugares');
    }
    if (a === 'roteiro') {
      const id = await salvarResultado(r, { status: 'planejado' });
      abrirAdicionarAoRoteiro({ lugarId: id, titulo: r.nome });
    }
  });

  // ao salvar/apagar lugares, atualiza os selos "salvo"
  const cancelar = assinar('lugares', () => { if (estado.status !== 'carregando') pintarLista(); });

  /* ---------- largada ---------- */
  desenharOrigem(true);
  pintarControles();
  desenharResultados();
  pintarLista();
  // o container ganha tamanho depois do primeiro desenho: recalcula e reenquadra o círculo
  let enquadrou = false;
  const observador = new ResizeObserver(() => {
    map.invalidateSize();
    if (!enquadrou && el.querySelector('#mapa-explorar').clientWidth > 0) { enquadrou = true; map.fitBounds(circulo.getBounds(), { padding: [10, 10] }); }
  });
  observador.observe(el.querySelector('#mapa-explorar'));

  return () => { ctrl?.abort(); cancelar(); observador.disconnect(); map.remove(); };
}
