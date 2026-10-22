// Bootstrap + login obrigatório + roteamento por hash (#/inicio, #/lugar/:id, ...).
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';

import { firebaseAtivo, observarUsuario } from './firebase.js';
import { iniciarLocal, iniciarNuvem, desligar, statusSync, assinar } from './store.js';
import { toast, esc } from './ui.js';
import { ico } from './icons.js';
import { htmlLateral, htmlAbas, marcarAtivo } from './nav.js';
import { mostrarLogin, esconderLogin } from './views/login.js';
import { getViagem } from './viagem.js';
import { diasAte } from './lib/tempo.js';

// rota → view (carregada sob demanda: o app abre mais rápido no celular).
// Cada view exporta render(container, params) e pode devolver uma função de limpeza.
const ROTAS = {
  inicio: () => import('./views/inicio.js'),
  roteiro: () => import('./views/roteiro.js'),
  explorar: () => import('./views/explorar.js'),
  mapa: () => import('./views/mapa.js'),
  lugares: () => import('./views/lugares.js'),
  lista: () => import('./views/lugares.js'),
  lugar: () => import('./views/lugar.js'),
  editar: () => import('./views/lugar.js'),
  novo: () => import('./views/novo.js'),
  notas: () => import('./views/notas.js'),
  ideias: () => import('./views/ideias.js'),
  checklist: () => import('./views/checklist.js'),
  busca: () => import('./views/busca.js'),
  mais: () => import('./views/mais.js'),
  roleta: () => import('./views/roleta.js'),
  gastos: () => import('./views/gastos.js'),
  config: () => import('./views/config.js')
};

const app = document.getElementById('app');
const shell = document.getElementById('shell');
const loginRoot = document.getElementById('login-root');
let limparAtual = null;
let seqRota = 0;
let shellMontado = false;

async function rotear() {
  if (!shellMontado) return;
  const [, nome = 'inicio', ...params] = (location.hash || '#/inicio').split('/');
  const rota = ROTAS[nome] ? nome : 'inicio';
  const minha = ++seqRota;
  const view = await ROTAS[rota]();
  if (minha !== seqRota) return; // o usuário já navegou pra outra tela enquanto carregava

  if (typeof limparAtual === 'function') limparAtual();
  app.innerHTML = '';
  app.className = `view-${rota}`;
  limparAtual = view.render(app, { nome: rota, params: params.map(decodeURIComponent) });
  marcarAtivo(rota);
  window.scrollTo(0, 0);
}

/* ---------- Topo: pílula da trip, rede e estado de sincronização ---------- */

function atualizarPilula() {
  const pill = document.getElementById('trip-pill');
  const v = getViagem();
  const faltam = diasAte(v.inicio);
  const fimEm = diasAte(v.fim);
  if (faltam === null) { pill.hidden = true; return; }
  if (faltam > 1) pill.textContent = `faltam ${faltam} dias`;
  else if (faltam === 1) pill.textContent = 'é amanhã!';
  else if (fimEm !== null && fimEm >= 0) pill.textContent = `dia ${-faltam + 1} da trip`;
  else { pill.hidden = true; return; }
  pill.hidden = false;
}

/** Chip: sincronizado / enviando / offline / falha. Toque pra ver detalhes. */
function atualizarSync() {
  const chip = document.getElementById('sync-chip');
  const s = statusSync();
  let estado = 'ok';
  let rotulo = 'Sincronizado';
  if (s.modo === 'local') { estado = 'local'; rotulo = 'Só neste aparelho'; }
  else if (s.falhas) { estado = 'erro'; rotulo = 'Falha ao salvar'; }
  else if (!s.online) { estado = 'off'; rotulo = s.pendentes ? `${s.pendentes} pendente${s.pendentes > 1 ? 's' : ''}` : 'Offline'; }
  else if (s.pendentes) { estado = 'enviando'; rotulo = 'Enviando…'; }
  chip.dataset.estado = estado;
  chip.innerHTML = `<i></i><span>${esc(rotulo)}</span>`;
  chip.dataset.detalhe = {
    ok: 'Tudo salvo e sincronizado com a outra pessoa.',
    enviando: 'Suas alterações estão subindo.',
    off: 'Sem internet: o que você mudar fica salvo neste aparelho e sobe quando o sinal voltar.',
    erro: 'Algumas alterações não foram aceitas pelo servidor. Confira a conta e tente de novo.',
    local: 'Modo local: nada é enviado para a nuvem.'
  }[estado];
}

function monitorarRede() {
  const badge = document.getElementById('net-badge');
  const atualizar = () => { badge.hidden = navigator.onLine; atualizarSync(); };
  window.addEventListener('online', () => { atualizar(); toast('🟢 De volta online — sincronizando'); });
  window.addEventListener('offline', atualizar);
  window.addEventListener('sync-mudou', atualizarSync);
  document.getElementById('sync-chip').addEventListener('click', (e) => toast(e.currentTarget.dataset.detalhe || '', 4200));
  atualizar();
}

/* ---------- Montagem do app (depois do login) ---------- */

function montarShell() {
  if (shellMontado) return;
  shellMontado = true;
  document.querySelector('.brand').innerHTML =
    `<span class="brand-logo">${ico('onda')}</span><span class="brand-nome">Rolê<small>Costa Verde</small></span>`;
  document.getElementById('btn-busca').innerHTML = ico('busca');
  document.getElementById('lateral').innerHTML = htmlLateral();
  document.getElementById('tabbar').innerHTML = htmlAbas();
  monitorarRede();
  assinar('config', atualizarPilula);
  window.addEventListener('hashchange', rotear);
}

function mostrarApp() {
  esconderLogin(loginRoot);
  shell.hidden = false;
  montarShell();
  const u = window.__usuario;
  const rotuloUsuario = document.querySelector('[data-usuario]');
  if (rotuloUsuario) rotuloUsuario.textContent = u?.displayName || u?.email || 'Neste aparelho';
  rotear();
}

function mostrarSaida(estado) {
  shell.hidden = true;
  mostrarLogin(loginRoot, estado);
}

async function iniciar() {
  window.addEventListener('store-erro', (e) => {
    const code = e.detail?.code || '';
    toast(code === 'permission-denied' ? '🔒 Sem permissão: confira se seu e-mail está liberado' : '⚠️ Erro ao salvar');
  });

  // Sem Firebase configurado → modo local (só neste aparelho).
  // `?local` só funciona no servidor de desenvolvimento (import.meta.env.DEV): no build publicado não existe.
  const localDeDev = import.meta.env.DEV && new URLSearchParams(location.search).has('local');
  if (!firebaseAtivo || localDeDev) {
    await iniciarLocal();
    return mostrarApp();
  }

  // Com Firebase: NADA aparece antes do login. A autorização real vem das regras do Firestore.
  mostrarLogin(loginRoot, 'carregando');
  let negado = false;
  window.addEventListener('acesso-negado', () => {
    negado = true;
    desligar();
    mostrarSaida({ negado: true, email: window.__usuario?.email });
  });
  observarUsuario(async (user) => {
    window.__usuario = user;
    window.dispatchEvent(new CustomEvent('usuario-mudou', { detail: user }));
    if (!user) { negado = false; desligar(); return mostrarSaida('entrar'); }
    negado = false;
    await iniciarNuvem();
    if (!negado) mostrarApp();
  });
}

iniciar();

// Service worker (PWA): atualiza sozinho quando sair versão nova
registerSW({ immediate: true, onOfflineReady: () => toast('📦 App pronto pra usar offline') });
