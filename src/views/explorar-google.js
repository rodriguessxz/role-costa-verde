// 🔎 Explorar com o mapa do Google (modo de busca embutido, sem chave e sem custo).
// O Google mostra os pins, notas, fotos e telefones dele; o app não consegue ler o que você toca ali dentro.
// Para guardar um lugar, use "Importar do Google Maps" (compartilhar ou colar o link).
import { consultaGoogle, urlEmbutida, urlAbrirNoGoogle } from '../lib/gmaps.js';
import { esc, html, debounce } from '../ui.js';

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

    <div class="google-moldura"><iframe title="Mapa do Google com os resultados da busca" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
      <p class="google-offline" hidden>Sem internet: o mapa do Google precisa de conexão.</p></div>

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
  const offline = el.querySelector('.google-offline');
  const abrir = el.querySelector('[data-abrir]');
  const campo = el.querySelector('[name=q]');

  function pintar() {
    el.querySelectorAll('[data-termo]').forEach((b) => b.classList.toggle('on', estado.termo === b.dataset.termo && estado.consulta === consultaGoogle(TERMOS[estado.termo], estado.local)));
    el.querySelectorAll('[data-local]').forEach((b) => b.classList.toggle('on', estado.local === b.dataset.local && estado.consulta === consultaGoogle(TERMOS[estado.termo], estado.local)));
    campo.value = estado.consulta;
    abrir.href = urlAbrirNoGoogle(estado.consulta);
  }
  const carregar = debounce(() => {
    offline.hidden = navigator.onLine;
    if (!navigator.onLine) return;
    iframe.src = urlEmbutida(estado.consulta);
  }, 250);
  function buscar(consulta) {
    estado.consulta = consulta.trim() || consultaGoogle(TERMOS[estado.termo], estado.local);
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch { /* ok */ }
    pintar();
    carregar();
  }

  el.addEventListener('click', (e) => {
    const termo = e.target.closest('[data-termo]');
    if (termo) { estado.termo = termo.dataset.termo; return buscar(consultaGoogle(TERMOS[estado.termo], estado.local)); }
    const local = e.target.closest('[data-local]');
    if (local) { estado.local = local.dataset.local; buscar(consultaGoogle(TERMOS[estado.termo], estado.local)); }
  });
  el.querySelector('[data-form="google"]').addEventListener('submit', (e) => {
    e.preventDefault();
    buscar(String(new FormData(e.target).get('q')));
  });

  pintar();
  buscar(estado.consulta);
}
