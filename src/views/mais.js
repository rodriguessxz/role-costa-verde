// ⋯ Mais: os módulos que não cabem na barra de baixo (no celular).
import { MODULOS } from '../nav.js';
import { ico } from '../icons.js';
import { html } from '../ui.js';
import { listar } from '../store.js';

export function render(container) {
  const fora = MODULOS.filter((m) => m.aba === 'mais');
  const paraTriar = listar('lugares').filter((l) => l.etapaContato === 'triagem').length;
  container.append(html(`<section class="pagina">
    <h1>Mais</h1>
    <p class="sub">Tudo o que a viagem tem, além do básico.</p>
    <div class="grade-modulos">
      ${fora.map((m) => `<a class="modulo" href="#/${m.id}"><span class="modulo-ico">${ico(m.icone)}</span><b>${m.rotulo}${m.id === 'contatos' && paraTriar ? ` <span class="selo selo-linha">${paraTriar} para triar</span>` : ''}</b><small>${m.desc}</small></a>`).join('')}
    </div>
  </section>`));
}
