// 🧭 Explorar: dois jeitos de achar lugares.
//  - Google Maps: o mapa do próprio Google (mais completo, com notas e fotos), embutido sem chave.
//  - Dados abertos: OpenStreetMap, que o app entende e salva direto (pin → funil de contatos).
import { html } from '../ui.js';
import * as google from './explorar-google.js';
import * as osm from './explorar-osm.js';

const KEY = 'role:explorar-modo';
let modo = 'google';
try { modo = localStorage.getItem(KEY) === 'osm' ? 'osm' : 'google'; } catch { /* ok */ }

export function render(container) {
  const el = html(`<section class="pagina explorar-wrap">
    <div class="cabeca-lista"><div><h1>Explorar</h1>
      <p class="sub">Ache campings, praias, trilhas e serviços e salve o que interessar.</p></div></div>
    <div class="segmentado-modo" role="tablist" aria-label="Fonte da busca">
      <button role="tab" data-modo="google">Google Maps</button>
      <button role="tab" data-modo="osm">Dados abertos <small>(salva direto)</small></button>
    </div>
    <div data-painel></div>
  </section>`);
  container.append(el);
  const painel = el.querySelector('[data-painel]');
  let limpar = null;

  function mostrar() {
    limpar?.();
    painel.innerHTML = '';
    el.querySelectorAll('[data-modo]').forEach((b) => {
      const ativo = b.dataset.modo === modo;
      b.classList.toggle('on', ativo);
      b.setAttribute('aria-selected', ativo);
    });
    limpar = (modo === 'google' ? google : osm).render(painel) || null;
  }

  el.querySelector('.segmentado-modo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b || b.dataset.modo === modo) return;
    modo = b.dataset.modo;
    try { localStorage.setItem(KEY, modo); } catch { /* ok */ }
    mostrar();
  });

  mostrar();
  return () => limpar?.();
}
