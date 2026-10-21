// Helpers de UI compartilhados entre as views.

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
  apoio: { rotulo: 'Apoio', emoji: '🛒', cor: '#6c757d' }
};

export const STATUS = {
  'quero-ir': { rotulo: 'Quero ir', emoji: '✨' },
  fui: { rotulo: 'Fui!', emoji: '✅' },
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

const FILTRO_KEY = 'role:filtros';
const padrao = { tipos: Object.keys(TIPOS), status: ['quero-ir', 'fui'], busca: '' };

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

/** Barra de chips de filtro. onChange(f) é chamado a cada toque. */
export function barraFiltros(f, onChange) {
  const el = html(`<div class="filtros">
    <div class="chips" data-grupo="tipos">
      ${Object.entries(TIPOS).map(([k, v]) => `<button class="chip ${f.tipos.includes(k) ? 'on' : ''}" data-v="${k}">${v.emoji} ${v.rotulo}</button>`).join('')}
    </div>
    <div class="chips" data-grupo="status">
      ${Object.entries(STATUS).map(([k, v]) => `<button class="chip chip-sm ${f.status.includes(k) ? 'on' : ''}" data-v="${k}">${v.emoji} ${v.rotulo}</button>`).join('')}
    </div>
  </div>`);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const grupo = b.parentElement.dataset.grupo;
    const v = b.dataset.v;
    const set = new Set(f[grupo]);
    set.has(v) ? set.delete(v) : set.add(v);
    f[grupo] = [...set];
    b.classList.toggle('on');
    salvarFiltros(f);
    onChange(f);
  });
  return el;
}
