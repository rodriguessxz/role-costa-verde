// 🔐 Tela de entrada: nada da viagem aparece antes do login.
// O acesso de verdade é decidido pelas regras do Firestore (lista de e-mails); esta tela só conduz o login.
import { entrarComGoogle, sair } from '../firebase.js';
import { ico } from '../icons.js';
import { esc, html } from '../ui.js';

const MENSAGENS = {
  'auth/popup-closed-by-user': 'Você fechou a janela de login antes de terminar.',
  'auth/network-request-failed': 'Sem internet. Conecte e tente de novo.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).'
};

/**
 * @param root elemento #login-root
 * @param estado 'carregando' | 'entrar' | { negado: true, email }
 */
export function mostrarLogin(root, estado = 'entrar') {
  const negado = typeof estado === 'object' && estado.negado;
  root.hidden = false;
  root.innerHTML = '';
  const el = html(`<section class="login">
    <div class="login-arte" aria-hidden="true">
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
        <path class="serra serra-1" d="M0 150 L60 90 L110 130 L170 60 L240 140 L300 85 L400 150 V220 H0Z"/>
        <path class="serra serra-2" d="M0 175 L70 125 L130 160 L200 105 L270 165 L340 120 L400 170 V220 H0Z"/>
        <path class="mar mar-1" d="M0 190 Q50 178 100 190 T200 190 T300 190 T400 190 V220 H0Z"/>
        <path class="mar mar-2" d="M0 204 Q50 192 100 204 T200 204 T300 204 T400 204 V220 H0Z"/>
        <circle class="sol" cx="318" cy="52" r="20"/>
      </svg>
    </div>
    <div class="login-cartao">
      <span class="brand-logo brand-logo-grande">${ico('onda')}</span>
      <p class="login-etiqueta">Acesso privado</p>
      <h1>Rolê Costa Verde</h1>
      <p class="login-sub">Ubatuba ⇄ Paraty · camping, trilha e mar. O diário de planejamento dos dois viajantes.</p>
      ${estado === 'carregando'
        ? '<p class="login-msg">Verificando sua sessão…</p>'
        : negado
          ? `<div class="aviso">🔒 <b>${esc(estado.email || 'Esta conta')}</b> não está na lista de viajantes autorizados.
              Entre com a conta Google combinada para a viagem.</div>
             <button class="btn btn-grande" data-acao="trocar">Entrar com outra conta</button>`
          : `<button class="btn btn-grande btn-google" data-acao="entrar">Entrar com Google</button>
             <p class="login-msg" data-erro hidden></p>`}
      <p class="login-rodape">Só os dois e-mails autorizados leem ou editam os dados.</p>
    </div>
  </section>`);
  root.append(el);

  el.querySelector('[data-acao="entrar"]')?.addEventListener('click', async (e) => {
    const botao = e.currentTarget;
    const erro = el.querySelector('[data-erro]');
    botao.disabled = true;
    erro.hidden = true;
    try {
      await entrarComGoogle();
    } catch (err) {
      botao.disabled = false;
      erro.textContent = MENSAGENS[err.code] || `Não foi possível entrar (${err.code || err.message}).`;
      erro.hidden = false;
    }
  });
  el.querySelector('[data-acao="trocar"]')?.addEventListener('click', () => sair());
}

export function esconderLogin(root) {
  root.hidden = true;
  root.innerHTML = '';
}
