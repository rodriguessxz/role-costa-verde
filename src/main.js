// Bootstrap + roteamento por hash (#/mapa, #/lugar/:id, ...).
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';

import { firebaseAtivo, observarUsuario } from './firebase.js';
import { iniciarLocal, iniciarNuvem } from './store.js';
import { toast } from './ui.js';

import * as mapa from './views/mapa.js';
import * as lista from './views/lista.js';
import * as lugar from './views/lugar.js';
import * as novo from './views/novo.js';
import * as roleta from './views/roleta.js';
import * as gastos from './views/gastos.js';
import * as config from './views/config.js';

// rota → view. Cada view exporta render(container, params) e pode devolver uma função de limpeza.
const ROTAS = { mapa, lista, lugar, editar: lugar, novo, roleta, gastos, config };

const app = document.getElementById('app');
let limparAtual = null;

function rotear() {
  const [, nome = 'mapa', ...params] = (location.hash || '#/mapa').split('/');
  const view = ROTAS[nome] || mapa;

  if (typeof limparAtual === 'function') limparAtual();
  app.innerHTML = '';
  app.className = `view-${nome}`;
  limparAtual = view.render(app, { nome, params: params.map(decodeURIComponent) });

  // Marca a aba ativa
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('ativo', a.dataset.tab === nome));
  window.scrollTo(0, 0);
}

/** Pílula do topo: contagem regressiva até a trip e "dia N" durante ela. */
function atualizarPilula() {
  const pill = document.getElementById('trip-pill');
  const dia = 86400000;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(2026, 11, 23);
  const fim = new Date(2027, 0, 6);
  const faltam = Math.round((inicio - hoje) / dia);
  if (faltam > 1) pill.textContent = `faltam ${faltam} dias`;
  else if (faltam === 1) pill.textContent = 'é amanhã!';
  else if (hoje <= fim) pill.textContent = `dia ${Math.round((hoje - inicio) / dia) + 1} da trip`;
  else return;
  pill.hidden = false;
}

/** Badge de offline no topo */
function monitorarRede() {
  const badge = document.getElementById('net-badge');
  const atualizar = () => { badge.hidden = navigator.onLine; };
  window.addEventListener('online', () => { atualizar(); toast('🟢 De volta online — sincronizando'); });
  window.addEventListener('offline', atualizar);
  atualizar();
}

async function iniciar() {
  monitorarRede();
  atualizarPilula();
  window.addEventListener('store-erro', (e) => {
    const code = e.detail?.code || '';
    toast(code === 'permission-denied' ? '🔒 Sem permissão: confira se seu e-mail está liberado' : '⚠️ Erro ao salvar');
  });

  // Sem Firebase configurado → modo local direto.
  // Com Firebase → começa local e troca pra nuvem quando o login confirmar.
  await iniciarLocal();
  if (firebaseAtivo) {
    observarUsuario(async (user) => {
      window.__usuario = user;
      if (user) await iniciarNuvem();
      else await iniciarLocal();
      window.dispatchEvent(new CustomEvent('usuario-mudou', { detail: user }));
    });
  }

  window.addEventListener('hashchange', rotear);
  rotear();

  // Service worker (PWA): atualiza sozinho quando sair versão nova
  registerSW({ immediate: true, onOfflineReady: () => toast('📦 App pronto pra usar offline') });
}

iniciar();
