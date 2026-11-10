// 📥 Importar do Google Maps: transforma um link/texto compartilhado do Google em lugar salvo.
// Funciona com o botão Compartilhar do Google Maps (Android, app instalado) ou colando o link.
import { listar, adicionar } from '../store.js';
import { interpretarCompartilhado, tipoPeloNome, coordenadasDe } from '../lib/gmaps.js';
import { buscarLugares } from '../lib/geocode.js';
import { posicaoAtual, regiaoMaisProxima } from '../lib/geo.js';
import { esc, html, toast, TIPOS, opcoesSelect, REGIOES, debounce } from '../ui.js';

const KEY_COMPARTILHADO = 'role:compartilhado';

/** Dados que o Android entregou pelo "Compartilhar" (guardados pelo main.js antes do login). */
function lerCompartilhado() {
  try {
    const bruto = sessionStorage.getItem(KEY_COMPARTILHADO);
    sessionStorage.removeItem(KEY_COMPARTILHADO);
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

export function render(container) {
  let lido = null; // resultado de interpretarCompartilhado
  let posicao = null; // { lat, lng, origem: 'link'|'busca'|'gps'|'manual' }

  const el = html(`<section class="pagina importar">
    <h1>Importar do Google Maps</h1>
    <p class="sub">Cole o link (ou o texto) que o Google Maps copiou ao compartilhar um lugar.</p>
    <form class="form" data-form="colar">
      <textarea class="input" name="texto" rows="4" placeholder="https://maps.app.goo.gl/…  ou  Camping Sununga, R. Hamilton Prado, 361" required></textarea>
      <button class="btn" type="submit">Ler o lugar</button>
    </form>
    <div data-passo2></div>
  </section>`);
  container.append(el);
  const passo2 = el.querySelector('[data-passo2]');

  function mostrarPasso2() {
    const tipo = tipoPeloNome(lido.nome);
    const regiaoPalpite = posicao ? regiaoMaisProxima(posicao) : '';
    passo2.innerHTML = `<form class="form importar-form" data-form="salvar">
      <h3>Confira e salve</h3>
      <label>Nome<input class="input" name="nome" required value="${esc(lido.nome)}"/></label>
      <div class="grid2">
        <label>Tipo<select class="input" name="tipo">${opcoesSelect(TIPOS, tipo)}</select></label>
        <label>Região<select class="input" name="regiao">${opcoesSelect(REGIOES, regiaoPalpite, '—')}</select></label>
      </div>
      <label>Endereço<input class="input" name="endereco" value="${esc(lido.endereco)}"/></label>
      <label>Link do Google Maps<input class="input" name="fonteUrl" type="url" value="${esc(lido.url)}" placeholder="opcional"/></label>

      <div class="importar-pos" data-pos></div>

      <label class="check"><input type="checkbox" name="funil" ${['camping', 'hospedagem', 'restaurante'].includes(tipo) ? 'checked' : ''}/> Colocar no funil de contatos (“a contatar”)</label>
      <button class="btn btn-grande" type="submit">Salvar lugar</button>
    </form>`;
    pintarPosicao();
    if (!posicao) procurarPeloNome(lido.nome);
  }

  function pintarPosicao() {
    const caixa = passo2.querySelector('[data-pos]');
    if (!caixa) return;
    const rotulo = { link: 'posição exata do link do Google', busca: 'palpite pelo nome (OpenStreetMap), confira', gps: 'sua localização', manual: 'coordenadas digitadas' };
    caixa.innerHTML = `${posicao
      ? `<p class="pos-ok">📍 ${posicao.lat.toFixed(5)}, ${posicao.lng.toFixed(5)} <small>${rotulo[posicao.origem]}</small></p>`
      : '<p class="pos-falta">Ainda sem posição. Escolha abaixo para o lugar aparecer no mapa.</p>'}
      <div data-achados></div>
      <div class="acoes">
        <button type="button" class="btn btn-sm btn-sec" data-acao="gps">📍 Estou aqui</button>
      </div>
      <label>Ou cole as coordenadas (no Google: toque e segure no lugar e copie)
        <input class="input" name="coords" placeholder="-23.4971, -45.1729" inputmode="decimal"/></label>`;
  }

  async function procurarPeloNome(nome) {
    const caixa = passo2.querySelector('[data-achados]');
    if (!caixa || !nome) return;
    caixa.innerHTML = '<p class="dica">Procurando a posição pelo nome…</p>';
    try {
      const achados = await buscarLugares(nome, { limite: 4 });
      caixa.innerHTML = achados.length
        ? `<p class="dica">Achei no OpenStreetMap. Toque para usar a posição:</p>${achados.map((r, i) => `<button type="button" class="busca-item" data-achado="${i}">
            <span class="busca-emoji">📍</span><span><b>${esc(r.nome)}</b><small>${esc(r.detalhe || '')}</small></span></button>`).join('')}`
        : '<p class="dica">Não achei esse nome no OpenStreetMap. Use “Estou aqui” ou cole as coordenadas.</p>';
      caixa._achados = achados;
    } catch {
      caixa.innerHTML = '<p class="dica">Sem internet para procurar a posição agora. Use “Estou aqui” ou cole as coordenadas.</p>';
    }
  }

  function ler(bruto) {
    lido = interpretarCompartilhado({ text: bruto });
    if (!lido.nome && !lido.url) return toast('Não entendi esse texto. Cole o link ou o nome do lugar.');
    posicao = Number.isFinite(lido.lat) ? { lat: lido.lat, lng: lido.lng, origem: 'link' } : null;
    if (lido.url && !lido.ehGoogle) toast('Atenção: esse link não parece ser do Google Maps');
    mostrarPasso2();
  }

  el.querySelector('[data-form="colar"]').addEventListener('submit', (e) => {
    e.preventDefault();
    ler(String(new FormData(e.target).get('texto')));
  });

  passo2.addEventListener('click', async (e) => {
    const achado = e.target.closest('[data-achado]');
    if (achado) {
      const r = passo2.querySelector('[data-achados]')._achados[Number(achado.dataset.achado)];
      posicao = { lat: r.lat, lng: r.lng, origem: 'busca' };
      const form = passo2.querySelector('form');
      if (r.tipo && form.elements.tipo.value === tipoPeloNome(lido.nome)) form.elements.tipo.value = r.tipo;
      form.elements.regiao.value = regiaoMaisProxima(posicao);
      return pintarPosicao();
    }
    if (e.target.closest('[data-acao="gps"]')) {
      toast('📡 Procurando você…');
      const p = await posicaoAtual();
      if (!p) return toast('Não consegui sua localização');
      posicao = { lat: p.lat, lng: p.lng, origem: 'gps' };
      passo2.querySelector('form').elements.regiao.value = regiaoMaisProxima(posicao);
      pintarPosicao();
    }
  });

  passo2.addEventListener('input', debounce((e) => {
    if (e.target.name !== 'coords') return;
    const c = coordenadasDe(e.target.value);
    if (!c) return;
    posicao = { ...c, origem: 'manual' };
    const foco = e.target.value;
    pintarPosicao();
    passo2.querySelector('[name=coords]').value = foco;
  }, 500));

  passo2.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const txt = (k) => String(fd.get(k) ?? '').trim();
    const url = txt('fonteUrl');
    const ja = url && listar('lugares').find((l) => l.fonteUrl === url);
    if (ja) { toast('Esse lugar já estava salvo'); location.hash = `#/lugar/${encodeURIComponent(ja.id)}`; return; }
    const dados = {
      nome: txt('nome'),
      tipo: fd.get('tipo'),
      regiao: fd.get('regiao') || '',
      endereco: txt('endereco'),
      lat: posicao ? posicao.lat : null,
      lng: posicao ? posicao.lng : null,
      // só é "conferida" quando veio do link do Google, do GPS ou de coordenadas digitadas
      coordAprox: !posicao || posicao.origem === 'busca',
      status: 'avaliar',
      fonte: 'Google Maps (importado)',
      fonteUrl: url,
      tags: posicao ? ['confirmar-dados'] : ['confirmar-dados', 'completar']
    };
    if (fd.has('funil')) dados.etapaContato = 'a-contatar';
    const id = await adicionar('lugares', dados);
    toast(fd.has('funil') ? '📞 Salvo em Contatos (a contatar)' : '📍 Lugar salvo');
    location.hash = `#/lugar/${encodeURIComponent(id)}`;
  });

  // Chegou pelo "Compartilhar" do Android: já lê sozinho
  const compartilhado = lerCompartilhado();
  if (compartilhado) {
    const bruto = [compartilhado.title, compartilhado.text, compartilhado.url].filter(Boolean).join('\n');
    el.querySelector('[name=texto]').value = bruto;
    lido = interpretarCompartilhado(compartilhado);
    posicao = Number.isFinite(lido.lat) ? { lat: lido.lat, lng: lido.lng, origem: 'link' } : null;
    mostrarPasso2();
  }
}
