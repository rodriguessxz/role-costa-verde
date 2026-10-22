// Helpers de UI compartilhados entre as views.
import { buscarLugares } from './lib/geocode.js';
import { tempoRelativo } from './lib/tempo.js';

/** Escapa HTML (todo texto vindo de dados passa por aqui). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/** Cria elemento a partir de string HTML. */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

let toastTimer;
/** Mensagem rápida no rodapé. */
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- Dicionários de exibição ---------- */

export const TIPOS = {
  camping: { rotulo: 'Camping', emoji: '⛺', cor: '#e07a5f' },
  trilha: { rotulo: 'Trilha', emoji: '🥾', cor: '#2d6a4f' },
  cachoeira: { rotulo: 'Cachoeira', emoji: '💦', cor: '#1d7fa8' },
  praia: { rotulo: 'Praia', emoji: '🏖️', cor: '#d4a017' },
  restaurante: { rotulo: 'Comer', emoji: '🍽️', cor: '#8e5ea2' },
  hospedagem: { rotulo: 'Hospedagem', emoji: '🏠', cor: '#3d5a80' },
  apoio: { rotulo: 'Apoio', emoji: '🛒', cor: '#6c757d' }
};

/** Subtipos de "apoio" (mercado, posto, estacionamento...). */
export const SUBTIPOS = { mercado: '🛒 Mercado', posto: '⛽ Posto', estacionamento: '🅿️ Estacionamento', servico: '💊 Serviço', outro: '📦 Outro' };

// Os valores 'quero-ir' e 'fui' já existiam nos dados: seguem valendo (fui = visitado).
export const STATUS = {
  ideia: { rotulo: 'Ideia', emoji: '💡' },
  avaliar: { rotulo: 'Avaliar', emoji: '🔍' },
  'quero-ir': { rotulo: 'Quero ir', emoji: '✨' },
  planejado: { rotulo: 'Planejado', emoji: '📌' },
  confirmado: { rotulo: 'Confirmado', emoji: '✅' },
  fui: { rotulo: 'Visitado', emoji: '🏁' },
  descartado: { rotulo: 'Descartado', emoji: '🚫' }
};

export const REGIOES = {
  'ubatuba-sul': 'Ubatuba Sul',
  'ubatuba-centro': 'Ubatuba Centro',
  'ubatuba-norte': 'Ubatuba Norte',
  trindade: 'Trindade',
  paraty: 'Paraty',
  'paraty-mirim': 'Paraty-Mirim / Mamanguá'
};

export const DIFICULDADES = { facil: 'Fácil', moderada: 'Moderada', dificil: 'Difícil' };
export const ACESSOS = { carro: '🚗 Carro', onibus: '🚌 Ônibus', 'a-pe': '🚶 A pé', barco: '⛵ Barco' };

export const tipoInfo = (t) => TIPOS[t] || TIPOS.apoio;

/** Lugar precisa de dados? (sem coordenada ou com tag completar) */
export const precisaCompletar = (l) =>
  !Number.isFinite(l.lat) || !Number.isFinite(l.lng) || (l.tags || []).includes('completar');

/** Duração legível */
export function formatarDuracao(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

/* ---------- Filtros compartilhados (mapa + lista) ---------- */

const FILTRO_KEY = 'role:filtros2'; // v2: ganhou tipos e status novos
const padrao = { tipos: Object.keys(TIPOS), status: Object.keys(STATUS).filter((k) => k !== 'descartado'), busca: '' };

export function lerFiltros() {
  try { return { ...padrao, ...JSON.parse(localStorage.getItem(FILTRO_KEY) || '{}') }; }
  catch { return { ...padrao }; }
}

export function salvarFiltros(f) {
  try { localStorage.setItem(FILTRO_KEY, JSON.stringify(f)); } catch { /* ok */ }
}

export function aplicarFiltros(lugares, f) {
  const q = f.busca.trim().toLowerCase();
  return lugares.filter((l) =>
    f.tipos.includes(l.tipo) &&
    f.status.includes(l.status || 'quero-ir') &&
    (!q || `${l.nome} ${l.descricao || ''} ${(l.tags || []).join(' ')} ${REGIOES[l.regiao] || ''}`.toLowerCase().includes(q))
  );
}

/** Seleção "solo": só o chip tocado fica ligado; tocar no mesmo de novo volta pro padrão. */
const TODOS_TIPOS = Object.keys(TIPOS);
const STATUS_ATIVOS = Object.keys(STATUS).filter((k) => k !== 'descartado');
const mesmo = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Barra de chips de filtro. onChange(f) é chamado a cada toque. */
export function barraFiltros(f, onChange) {
  const chip = (grupo, v, rotulo, on, extra = '') =>
    `<button class="chip ${extra} ${on ? 'on' : ''}" data-grupo="${grupo}" data-v="${v}">${rotulo}</button>`;
  const desenhar = () => {
    el.innerHTML = `<div class="chips">
      ${chip('tipos', '*', 'Todos', mesmo(f.tipos, TODOS_TIPOS))}
      ${Object.entries(TIPOS).map(([k, v]) => chip('tipos', k, `${v.emoji} ${v.rotulo}`, mesmo(f.tipos, [k]))).join('')}
    </div>
    <div class="chips">
      ${chip('status', '*', 'Ativos', mesmo(f.status, STATUS_ATIVOS), 'chip-sm')}
      ${Object.entries(STATUS).map(([k, v]) => chip('status', k, `${v.emoji} ${v.rotulo}`, mesmo(f.status, [k]), 'chip-sm')).join('')}
    </div>`;
  };
  const el = html('<div class="filtros"></div>');
  desenhar();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const { grupo, v } = b.dataset;
    const padrao = grupo === 'tipos' ? TODOS_TIPOS : STATUS_ATIVOS;
    f[grupo] = v === '*' || mesmo(f[grupo], [v]) ? [...padrao] : [v];
    desenhar();
    salvarFiltros(f);
    onChange(f);
  });
  return el;
}

/**
 * Campo de busca de lugares na internet (como no Google Maps).
 * Mostra sugestões enquanto digita; onEscolher(resultado) roda ao tocar numa.
 */
export function campoBusca({ placeholder = 'Buscar lugar no mapa…', onEscolher }) {
  const el = html(`<div class="busca-geo">
    <input type="search" class="input" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="search" />
    <div class="busca-resultados" hidden></div>
  </div>`);
  const input = el.querySelector('input');
  const caixa = el.querySelector('.busca-resultados');
  let timer; let ctrl; let achados = [];

  const fechar = () => { caixa.hidden = true; };
  const msg = (t) => { caixa.innerHTML = `<p class="busca-msg">${esc(t)}</p>`; caixa.hidden = false; };

  async function buscar(q) {
    ctrl?.abort();
    ctrl = new AbortController();
    msg('Buscando…');
    try {
      achados = await buscarLugares(q, { signal: ctrl.signal });
    } catch (e) {
      if (e.name === 'AbortError') return;
      return msg(navigator.onLine ? 'Não deu pra buscar agora. Tenta de novo.' : 'Sem sinal: a busca precisa de internet.');
    }
    if (!achados.length) return msg('Nada encontrado. Tenta outro nome.');
    caixa.innerHTML = achados.map((r, i) => `<button type="button" class="busca-item" data-i="${i}">
      <span class="busca-emoji">${tipoInfo(r.tipo).emoji}</span>
      <span><b>${esc(r.nome)}</b><small>${esc(r.detalhe)}</small></span></button>`).join('');
    caixa.hidden = false;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { ctrl?.abort(); return fechar(); }
    timer = setTimeout(() => buscar(q), 350);
  });
  caixa.addEventListener('click', (e) => {
    const b = e.target.closest('.busca-item');
    if (!b) return;
    fechar();
    input.value = achados[Number(b.dataset.i)].nome;
    onEscolher(achados[Number(b.dataset.i)]);
  });
  return el;
}

/* ---------- Componentes reutilizáveis ---------- */

/** Estado vazio com orientação. `acao` = { rotulo, href } ou { rotulo, id } (botão). */
export function vazio({ emoji = '🌿', titulo, texto = '', acao }) {
  const botao = acao
    ? (acao.href
      ? `<a class="btn btn-sm" href="${esc(acao.href)}">${esc(acao.rotulo)}</a>`
      : `<button class="btn btn-sm" data-vazio="${esc(acao.id || '')}">${esc(acao.rotulo)}</button>`)
    : '';
  return `<div class="estado-vazio"><div class="estado-vazio-emoji">${emoji}</div><h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ''}${botao}</div>`;
}

/** "criado por X · atualizado há 2 h por Y" — transparência de quem mexeu. */
export function quemMexeu(d) {
  const partes = [];
  if (d.criadoPor) partes.push(`criado por ${esc(d.criadoPor)}`);
  if (d.atualizadoEm && d.atualizadoEm !== d.criadoEm) {
    partes.push(`atualizado ${tempoRelativo(d.atualizadoEm)}${d.atualizadoPor ? ` por ${esc(d.atualizadoPor)}` : ''}`);
  } else if (d.criadoEm) partes.push(tempoRelativo(d.criadoEm));
  return partes.join(' · ');
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/**
 * Folha de baixo (bottom sheet) que vira janela centralizada no desktop.
 * `corpo` é uma string HTML. Devolve { el, fechar }. Esc, toque fora ou ✕ fecham.
 */
export function abrirModal({ titulo, corpo, onFechar }) {
  const raiz = document.getElementById('modal-root');
  const el = html(`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal-fundo"></div>
    <div class="modal-folha">
      <div class="modal-cab"><h2>${esc(titulo)}</h2><button class="icon-btn" data-fechar aria-label="Fechar">✕</button></div>
      <div class="modal-corpo">${corpo}</div>
    </div>
  </div>`);
  const fechar = () => {
    document.removeEventListener('keydown', teclas);
    el.remove();
    document.body.classList.toggle('sem-scroll', raiz.children.length > 0);
    onFechar?.();
  };
  const teclas = (e) => { if (e.key === 'Escape') fechar(); };
  el.querySelector('.modal-fundo').addEventListener('click', fechar);
  el.querySelector('[data-fechar]').addEventListener('click', fechar);
  document.addEventListener('keydown', teclas);
  raiz.append(el);
  document.body.classList.add('sem-scroll');
  el.querySelector('input:not([type=hidden]), textarea, select')?.focus({ preventScroll: true });
  return { el, fechar };
}

/** Confirmação em modal (window.confirm trava em PWA). Resolve true/false. */
export function confirmar({ titulo, texto = '', rotuloOk = 'Confirmar', perigo = false }) {
  return new Promise((resolve) => {
    let resposta = false;
    const { el, fechar } = abrirModal({
      titulo,
      corpo: `${texto ? `<p>${esc(texto)}</p>` : ''}<div class="acoes">
        <button class="btn btn-sec" data-nao>Cancelar</button>
        <button class="btn ${perigo ? 'btn-perigo-cheio' : ''}" data-sim>${esc(rotuloOk)}</button></div>`,
      onFechar: () => resolve(resposta)
    });
    el.querySelector('[data-nao]').addEventListener('click', fechar);
    el.querySelector('[data-sim]').addEventListener('click', () => { resposta = true; fechar(); });
  });
}

/** <option>s a partir de um objeto {chave: rotulo | {rotulo}}. */
export const opcoesSelect = (obj, atual, vazioRotulo) =>
  (vazioRotulo !== undefined ? `<option value="">${esc(vazioRotulo)}</option>` : '') +
  Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}" ${k === atual ? 'selected' : ''}>${esc(typeof v === 'string' ? v : `${v.emoji || ''} ${v.rotulo}`.trim())}</option>`).join('');

/** Curtidas guardadas como mapa { uid: true|false } (assim dois "curtir" ao mesmo tempo não se sobrescrevem). */
export const contarCurtidas = (c) => (Array.isArray(c) ? c.length : Object.values(c || {}).filter(Boolean).length);
