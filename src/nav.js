// Módulos do app e navegação (barra de baixo no celular, barra lateral no desktop).
import { ico } from './icons.js';

/** Todos os módulos. `aba` diz em qual aba da barra de baixo ele "mora". */
export const MODULOS = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio', aba: 'inicio', desc: 'Visão geral da aventura' },
  { id: 'roteiro', rotulo: 'Roteiro', icone: 'roteiro', aba: 'roteiro', desc: 'Dias, etapas e atividades' },
  { id: 'explorar', rotulo: 'Explorar', icone: 'explorar', aba: 'explorar', desc: 'Achar lugares perto de um ponto' },
  { id: 'lugares', rotulo: 'Lugares', icone: 'lugares', aba: 'lugares', desc: 'Biblioteca de lugares salvos' },
  { id: 'mapa', rotulo: 'Mapa', icone: 'mapa', aba: 'mais', desc: 'Tudo que salvamos, no mapa' },
  { id: 'notas', rotulo: 'Anotações', icone: 'notas', aba: 'mais', desc: 'Dicas, logística e decisões' },
  { id: 'ideias', rotulo: 'Ideias', icone: 'ideias', aba: 'mais', desc: 'Rolês ainda não confirmados' },
  { id: 'checklist', rotulo: 'Checklist', icone: 'checklist', aba: 'mais', desc: 'Camping, trilha, carro e compras' },
  { id: 'gastos', rotulo: 'Gastos', icone: 'gastos', aba: 'mais', desc: 'Racha entre os dois' },
  { id: 'roleta', rotulo: 'Roleta', icone: 'dado', aba: 'mais', desc: 'Sem planejar, mas sem furada' },
  { id: 'config', rotulo: 'Configurações', icone: 'config', aba: 'mais', desc: 'Viagem, dupla e dados' }
];

/** Rotas que não são módulos → aba onde aparecem destacadas. */
const ABA_DE_ROTA = { lugar: 'lugares', editar: 'lugares', lista: 'lugares', novo: 'lugares', busca: 'mais', mais: 'mais' };

export const abaDaRota = (rota) => MODULOS.find((m) => m.id === rota)?.aba || ABA_DE_ROTA[rota] || 'inicio';

/** Barra lateral do desktop (todos os módulos). */
export function htmlLateral() {
  return `<a href="#/inicio" class="lateral-marca" aria-label="Rolê Costa Verde">
      <span class="brand-logo">${ico('onda')}</span>
      <span class="brand-nome">Rolê<small>Costa Verde</small></span>
    </a>
    <nav class="lateral-nav" aria-label="Módulos">
      ${MODULOS.map((m) => `<a href="#/${m.id}" data-rota="${m.id}">${ico(m.icone)}<span>${m.rotulo}</span></a>`).join('')}
    </nav>
    <div class="lateral-rodape"><span data-usuario></span></div>`;
}

/** Barra de baixo do celular: 4 áreas principais + "Mais". Explorar fica no centro. */
export function htmlAbas() {
  const aba = (id, rotulo, icone, extra = '') => `<a href="#/${id}" data-tab="${id}" ${extra}>${ico(icone)}<span>${rotulo}</span></a>`;
  return `${aba('inicio', 'Início', 'inicio')}
    ${aba('lugares', 'Lugares', 'lugares')}
    <a href="#/explorar" data-tab="explorar" class="tab-central"><span class="botao-central">${ico('explorar')}</span><span>Explorar</span></a>
    ${aba('roteiro', 'Roteiro', 'roteiro')}
    ${aba('mais', 'Mais', 'mais')}`;
}

/** Marca aba/lateral ativas. */
export function marcarAtivo(rota) {
  const aba = abaDaRota(rota);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('ativo', a.dataset.tab === aba));
  document.querySelectorAll('.lateral-nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota || (rota === 'lista' && a.dataset.rota === 'lugares')));
}
