// 🔎 Explorar com o mapa do Google (modo de busca embutido, sem chave e sem custo).
// O Google mostra os pins, notas, fotos e telefones dele; o app não consegue ler o que você toca ali dentro.
// Para guardar um lugar, use "Importar do Google Maps" (compartilhar ou colar o link).
import { consultaGoogle, urlEmbutida, urlAbrirNoGoogle } from '../lib/gmaps.js';
import { esc, html, debounce, toast, tipoInfo } from '../ui.js';
import { chavePlaces } from '../integracoes.js';
import { buscarPlaces, lerUso, restantes, LIMITE_MENSAL, MENSAGENS_PLACES } from '../lib/places.js';
import { CENTROS_REGIAO, linkGoogleMaps } from '../lib/geo.js';
import { modalSalvarResultado, salvarParaContatar, salvarResultado, abrirAdicionarAoRoteiro } from '../acoes.js';

const TERMOS = {
  camping: 'camping', praia: 'praia', cachoeira: 'cachoeira', trilha: 'trilha', restaurante: 'restaurante',
  mercado: 'mercado', posto: 'posto de gasolina', pousada: 'pousada', estacionamento: 'estacionamento', farmacia: 'farmácia'
};
const ROTULOS = {
  camping: '⛺ Campings', praia: '🏖️ Praias', cachoeira: '💦 Cachoeiras', trilha: '🥾 Trilhas', restaurante: '🍽️ Comer',
  mercado: '🛒 Mercados', posto: '⛽ Postos', pousada: '🏠 Pousadas', estacionamento: '🅿️ Estacionar', farmacia: '💊 Farmácias'
};
const LOCAIS = ['Ubatuba', 'Picinguaba', 'Maranduba', 'Lagoinha Ubatuba', 'Trindade Paraty', 'Paraty', 'Paraty-Mirim'];

const KEY = 'role:google-consulta';
const estado = { termo: 'camping', local: 'Ubatuba', consulta: 'camping em Ubatuba' };
try { Object.assign(estado, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ok */ }

export function render(painel) {
  const el = html(`<div class="explorar-google">
    <form class="explorar-busca" data-form="google">
      <input type="search" class="input" name="q" value="${esc(estado.consulta)}" placeholder="Ex.: camping em Ubatuba" autocomplete="off" enterkeyhint="search"/>
      <button class="btn" type="submit">Buscar</button>
    </form>
    <div class="chips" data-termos>${Object.entries(ROTULOS).map(([k, r]) => `<button class="chip" data-termo="${k}">${r}</button>`).join('')}</div>
    <div class="chips" data-locais>${LOCAIS.map((l) => `<button class="chip chip-sm" data-local="${esc(l)}">${esc(l.replace(/ (Ubatuba|Paraty)$/, ''))}</button>`).join('')}</div>

    <div class="google-moldura"><iframe title="Mapa do Google com os resultados da busca" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
      <div class="google-estado" data-estado hidden></div></div>
    <p class="google-rodape">Mapa do Google · <a data-abrir2 href="#" target="_blank" rel="noopener noreferrer">abrir em tela cheia ↗</a></p>

    <div class="google-detalhes" data-detalhes></div>

    <div class="google-ajuda">
      <h3>Achou um lugar? Guarde no app</h3>
      <ol>
        <li>Toque no pin no mapa e depois em <b>Abrir no Maps</b>.</li>
        <li>No Google Maps, toque em <b>Compartilhar</b>. No Android com o app instalado, escolha <b>Rolê Costa Verde</b>; nos demais casos, copie o link.</li>
        <li>Cole o link em <b>Importar do Google Maps</b>. O app guarda o nome, o endereço, o link e a posição, e já põe no funil de contatos.</li>
      </ol>
      <div class="acoes">
        <a class="btn" href="#/importar">Importar do Google Maps</a>
        <a class="btn btn-sec" data-abrir href="#" target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a>
      </div>
      <p class="dica">O mapa acima é do próprio Google, incorporado sem chave. Avaliações, fotos e telefones aparecem no cartão do Google, mas não ficam salvos aqui automaticamente.</p>
    </div>
  </div>`);
  painel.append(el);

  const iframe = el.querySelector('iframe');
  const estadoEl = el.querySelector('[data-estado]');
  const abrir2 = el.querySelector('[data-abrir2]');
  let demora = null;
  const abrir = el.querySelector('[data-abrir]');
  const campo = el.querySelector('[name=q]');

  function pintar() {
    el.querySelectorAll('[data-termo]').forEach((b) => b.classList.toggle('on', estado.termo === b.dataset.termo && estado.consulta === consultaGoogle(TERMOS[estado.termo], estado.local)));
    el.querySelectorAll('[data-local]').forEach((b) => b.classList.toggle('on', estado.local === b.dataset.local && estado.consulta === consultaGoogle(TERMOS[estado.termo], estado.local)));
    campo.value = estado.consulta;
    abrir.href = urlAbrirNoGoogle(estado.consulta);
    abrir2.href = abrir.href;
  }
  /** Mensagem sobre o mapa: carregando, demorando, sem internet ou nada (null esconde). */
  function mostrarEstado(tipo) {
    if (!tipo) { estadoEl.hidden = true; return; }
    const texto = {
      carregando: ['Carregando o mapa do Google…', ''],
      demora: ['O mapa está demorando', '<button class="btn btn-sm" data-recarregar>Recarregar o mapa</button> <a class="btn btn-sm btn-sec" data-abrir3 target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a>'],
      offline: ['Sem internet', 'O mapa do Google precisa de conexão. Quando o sinal voltar, toque em recarregar. <button class="btn btn-sm" data-recarregar>Recarregar</button>']
    }[tipo];
    estadoEl.className = 'google-estado' + (tipo === 'carregando' ? '' : ' google-estado-aviso');
    estadoEl.innerHTML = `<b>${texto[0]}</b>${texto[1] ? `<div class="google-estado-acoes">${texto[1]}</div>` : ''}`;
    const l3 = estadoEl.querySelector('[data-abrir3]');
    if (l3) l3.href = abrir.href;
    estadoEl.hidden = false;
  }

  const carregar = debounce(() => {
    clearTimeout(demora);
    if (!navigator.onLine) { iframe.removeAttribute('src'); return mostrarEstado('offline'); }
    mostrarEstado('carregando');
    iframe.src = urlEmbutida(estado.consulta);
    // o navegador avisa quando o conteúdo carregou (load); se não avisar em 20 s, oferecemos alternativas
    demora = setTimeout(() => mostrarEstado('demora'), 20000);
  }, 250);
  iframe.addEventListener('load', () => { if (iframe.getAttribute('src')) { clearTimeout(demora); mostrarEstado(null); } });
  window.addEventListener('online', carregar);
  function buscar(consulta) {
    estado.consulta = consulta.trim() || consultaGoogle(TERMOS[estado.termo], estado.local);
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch { /* ok */ }
    pintar();
    carregar();
    achados = [];
    pintarDetalhes();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-recarregar]')) return carregar();
    const termo = e.target.closest('[data-termo]');
    if (termo) { estado.termo = termo.dataset.termo; return buscar(consultaGoogle(TERMOS[estado.termo], estado.local)); }
    const local = e.target.closest('[data-local]');
    if (local) { estado.local = local.dataset.local; buscar(consultaGoogle(TERMOS[estado.termo], estado.local)); }
  });
  el.querySelector('[data-form="google"]').addEventListener('submit', (e) => {
    e.preventDefault();
    buscar(String(new FormData(e.target).get('q')));
  });

  /* ---- resultados detalhados do Google Places (só com chave configurada) ---- */
  const caixaDet = el.querySelector('[data-detalhes]');
  let achados = [];
  const centroDoLocal = () => {
    const mapa = { Ubatuba: 'ubatuba-centro', Picinguaba: 'ubatuba-norte', Maranduba: 'ubatuba-sul', 'Lagoinha Ubatuba': 'ubatuba-sul', 'Trindade Paraty': 'trindade', Paraty: 'paraty', 'Paraty-Mirim': 'paraty-mirim' };
    const c = CENTROS_REGIAO[mapa[estado.local]];
    return c ? { lat: c.lat, lng: c.lng } : undefined;
  };
  function pintarDetalhes(msg = '') {
    if (!chavePlaces()) { caixaDet.innerHTML = ''; return; }
    const sobra = restantes(lerUso());
    caixaDet.innerHTML = `<div class="google-ajuda">
      <h3>Resultados com detalhes (Google)</h3>
      <p class="dica">Nota, avaliações, telefone, site e horário vindos do Google. Cada busca conta na sua cota gratuita: restam <b>${sobra}</b> de ${LIMITE_MENSAL} neste mês, neste aparelho.</p>
      <button class="btn" data-acao="buscar-detalhes" ${sobra ? '' : 'disabled'}>Buscar “${esc(estado.consulta)}” com detalhes</button>
      ${msg ? `<div class="aviso">${esc(msg)}</div>` : ''}
      <div class="res-lista" data-lista>${achados.map(cartaoGoogle).join('')}</div>
      ${achados.length ? '<p class="dica">Dados do Google Maps. Confira preço, reserva e acesso antes de ir.</p>' : ''}
    </div>`;
  }
  const cartaoGoogle = (r, i) => `<article class="res-card" data-i="${i}" style="--cor:${tipoInfo(r.tipo).cor}">
      <div class="res-topo"><span class="card-emoji">${tipoInfo(r.tipo).emoji}</span>
        <div class="res-titulo"><b>${esc(r.nome)}</b><small>${r.nota ? `★ ${String(r.nota).replace('.', ',')}${r.avaliacoes ? ` (${r.avaliacoes.toLocaleString('pt-BR')})` : ''} · ` : ''}${esc(r.tipoRotulo || tipoInfo(r.tipo).rotulo)}${r.abertoAgora === true ? ' · aberto agora' : r.abertoAgora === false ? ' · fechado agora' : ''}${r.situacao ? ' · ' + esc(r.situacao) : ''}</small></div></div>
      <div class="info">
        <div class="linha"><span>Endereço</span><strong>${esc(r.endereco || 'indisponível')}</strong></div>
        <div class="linha"><span>Telefone</span><strong>${r.telefone ? `<a href="tel:${esc(r.telefone.replace(/[^\d+]/g, ''))}">${esc(r.telefone)}</a>` : '<em class="indisp">indisponível</em>'}</strong></div>
        <div class="linha"><span>Site</span><strong>${/^https?:\/\//i.test(r.site || '') ? `<a href="${esc(r.site)}" target="_blank" rel="noopener noreferrer">abrir</a>` : '<em class="indisp">indisponível</em>'}</strong></div>
      </div>
      <div class="res-acoes">
        <button class="btn btn-sm" data-acao="contatar">📞 Contatar</button>
        <button class="btn btn-sm btn-sec" data-acao="salvar">Salvar</button>
        <button class="btn btn-sm btn-sec" data-acao="roteiro">+ Roteiro</button>
        <a class="btn btn-sm btn-sec" href="${esc(r.googleMapsUri || linkGoogleMaps(r))}" target="_blank" rel="noopener noreferrer">Google ↗</a>
      </div></article>`;

  caixaDet.addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!acao) return;
    if (acao === 'buscar-detalhes') {
      const botao = e.target.closest('button');
      botao.disabled = true;
      botao.textContent = 'Buscando…';
      try {
        achados = await buscarPlaces({ chave: chavePlaces(), consulta: estado.consulta, centro: centroDoLocal(), raioM: 25000 });
        pintarDetalhes(achados.length ? '' : 'O Google não achou nada para essa busca.');
      } catch (err) {
        if (err.name !== 'AbortError') pintarDetalhes(MENSAGENS_PLACES[err.tipo] || MENSAGENS_PLACES.falha);
      }
      return;
    }
    const r = achados[Number(e.target.closest('[data-i]')?.dataset.i)];
    if (!r) return;
    if (acao === 'contatar') { const id = await salvarParaContatar(r); toast('📞 Salvo em Contatos (a contatar)'); location.hash = `#/lugar/${encodeURIComponent(id)}`; }
    if (acao === 'salvar') await modalSalvarResultado(r);
    if (acao === 'roteiro') { const id = await salvarResultado(r, { status: 'planejado' }); abrirAdicionarAoRoteiro({ lugarId: id, titulo: r.nome }); }
  });
  pintarDetalhes();

  pintar();
  buscar(estado.consulta);

  return () => { clearTimeout(demora); window.removeEventListener('online', carregar); };
}
