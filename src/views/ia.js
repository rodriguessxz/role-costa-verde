// ✨ Assistente IA: conversa com a IA que conhece o roteiro, os lugares, os contatos e o checklist da viagem.
// IA gratuita (Gemini). Telefones e e-mails nunca são enviados. A IA sugere; quem decide é a dupla.
import { assinar, listar, obter } from '../store.js';
import { getViagem } from '../viagem.js';
import { chaveGemini, modeloGemini } from '../integracoes.js';
import { perguntarIA, mensagemDoErro, usoDeHoje } from '../ia-cliente.js';
import { contextoViagem, instrucaoChat, markdownBasico } from '../lib/ia.js';
import { ico } from '../icons.js';
import { esc, html, toast, tipoInfo } from '../ui.js';

const KEY = 'role:ia-chat';
const MAX_MENSAGENS = 40;
const SUGESTOES = [
  'Resuma o roteiro e o que ainda falta decidir',
  'Quais campings ainda preciso contatar ou retornar?',
  'O que está faltando no checklist para a viagem?',
  'Sugira o que fazer nos dias com pouca coisa',
  'Se chover amanhã, o que a gente troca?'
];

function lerHistorico() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function guardarHistorico(h) {
  try { localStorage.setItem(KEY, JSON.stringify(h.slice(-MAX_MENSAGENS))); } catch { /* ok */ }
}

function dadosDaViagem() {
  return {
    viagem: getViagem(), lugares: listar('lugares'), dias: listar('dias'), atividades: listar('atividades'),
    notas: listar('notas'), listas: listar('listas'), itens: listar('itens'), interacoes: listar('interacoes')
  };
}

function bolha(m, i) {
  if (m.papel === 'user') return `<div class="ia-msg ia-eu"><div>${esc(m.texto).replace(/\n/g, '<br/>')}</div></div>`;
  if (m.erro) return `<div class="ia-msg ia-erro"><div>⚠️ ${esc(m.texto)} <button class="btn btn-sm btn-sec" data-acao="repetir">Tentar de novo</button></div></div>`;
  const fontes = (m.fontes || []).length
    ? `<div class="ia-fontes"><small>Fontes da web (confira):</small>${m.fontes.map((f) => `<a href="${esc(f.uri)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a>`).join('')}</div>` : '';
  return `<div class="ia-msg ia-bot"><div>${markdownBasico(m.texto)}${m.cortada ? '<p class="dica">A resposta foi cortada. Peça para continuar.</p>' : ''}${fontes}
    <button class="link-btn" data-acao="copiar" data-i="${i}">Copiar</button></div></div>`;
}

export function render(container, { params = [] } = {}) {
  const lugarFoco = params[0] === 'lugar' ? obter('lugares', params[1]) : null;
  const el = html('<section class="pagina ia"></section>');
  container.append(el);
  let historico = lerHistorico();
  let ctrl = null;
  let pensando = false;
  let web = false;

  function desenharSemChave() {
    el.innerHTML = `<div class="cabeca-lista"><div><h1>Assistente IA</h1><p class="sub">Pergunte sobre a viagem e peça sugestões.</p></div></div>
      <div class="ia-ativar">
        <div class="ia-ativar-icone">${ico('ia')}</div>
        <h3>Ative o assistente (grátis)</h3>
        <p>Ele usa a IA gratuita do Google (Gemini). Não precisa de cartão: só uma chave que você gera em 1 minuto.</p>
        <ol>
          <li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> e entre com sua conta Google.</li>
          <li>Toque em <b>Criar chave de API</b> e copie.</li>
          <li>Cole em <b>Configurações → Integrações</b>.</li>
        </ol>
        <a class="btn btn-grande" href="#/config">Ir para Configurações</a>
        <p class="dica">Privacidade: no plano gratuito o Google pode usar o que você enviar para melhorar os produtos dele. O app nunca envia telefone, e-mail nem Instagram de ninguém. Evite escrever dados sensíveis nas perguntas.</p>
      </div>`;
  }

  function desenhar() {
    if (!chaveGemini()) return desenharSemChave();
    const preencher = lugarFoco && !historico.length ? `Sobre ${lugarFoco.nome}: ` : '';
    const rascunho = el.querySelector('[name=pergunta]')?.value ?? preencher;
    el.innerHTML = `<div class="cabeca-lista"><div><h1>Assistente IA</h1>
        <p class="sub">${lugarFoco ? `Conversando sobre ${esc(tipoInfo(lugarFoco.tipo).emoji)} ${esc(lugarFoco.nome)}` : 'Conhece seu roteiro, lugares, contatos e checklist.'}</p></div>
        ${historico.length ? '<button class="btn btn-sm btn-sec" data-acao="limpar">Limpar</button>' : ''}</div>
      <div class="ia-atalhos">
        <a class="btn btn-sm" href="#/roteiro/ia">${ico('roteiro')} Ajustar o roteiro com IA</a>
      </div>
      <div class="ia-chat" data-chat aria-live="polite">
        ${historico.length ? historico.map(bolha).join('') : `<div class="ia-vazio"><p>Pergunte qualquer coisa sobre a viagem. Por exemplo:</p>
          <div class="chips chips-quebra">${SUGESTOES.map((s) => `<button class="chip" data-sugestao="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`}
        ${pensando ? '<div class="ia-msg ia-bot"><div class="ia-pensando"><i></i><i></i><i></i></div></div>' : ''}
      </div>
      <form class="ia-form" data-form="enviar">
        <textarea class="input" name="pergunta" rows="2" placeholder="Escreva sua pergunta…" enterkeyhint="send">${esc(rascunho)}</textarea>
        <button class="btn" type="submit" ${pensando ? 'disabled' : ''}>Enviar</button>
      </form>
      <label class="check ia-web"><input type="checkbox" data-web ${web ? 'checked' : ''}/> Pesquisar na internet (Google) para responder</label>
      <p class="dica">${web ? 'Com a pesquisa ligada a IA mostra as fontes. Confira antes de decidir: preço e horário mudam.' : 'Sem pesquisa na web: a IA só usa os dados da viagem e o que ela já sabe.'}
        Modelo: ${esc(modeloGemini())} · ${usoDeHoje()} pergunta${usoDeHoje() === 1 ? '' : 's'} hoje neste aparelho.</p>`;
    const chat = el.querySelector('[data-chat]');
    chat.scrollTop = chat.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function enviar(texto, { repetir = false } = {}) {
    if (pensando) return;
    if (!repetir) historico.push({ papel: 'user', texto, em: Date.now() });
    else historico = historico.filter((m) => !m.erro);
    guardarHistorico(historico);
    pensando = true;
    ctrl = new AbortController();
    desenhar();
    try {
      const contexto = contextoViagem(dadosDaViagem());
      const extra = lugarFoco ? `A conversa é sobre o lugar "${lugarFoco.nome}" (lugar:${lugarFoco.id}).` : '';
      const mensagens = historico.filter((m) => !m.erro).slice(-14).map((m) => ({ papel: m.papel === 'user' ? 'user' : 'model', texto: m.texto }));
      const r = await perguntarIA({ sistema: instrucaoChat(contexto, extra), mensagens, web, signal: ctrl.signal });
      historico.push({ papel: 'model', texto: r.texto, fontes: r.fontes, cortada: r.cortada, em: Date.now() });
    } catch (e) {
      if (e.name === 'AbortError') return;
      historico.push({ papel: 'model', erro: true, texto: mensagemDoErro(e), em: Date.now() });
    } finally {
      pensando = false;
      guardarHistorico(historico);
      if (el.isConnected) desenhar();
    }
  }

  el.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-form="enviar"]')) return;
    e.preventDefault();
    const campo = e.target.elements.pergunta;
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    enviar(texto);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.name === 'pergunta') e.target.form.requestSubmit();
  });
  el.addEventListener('change', (e) => { if (e.target.matches('[data-web]')) { web = e.target.checked; desenhar(); } });
  el.addEventListener('click', async (e) => {
    const sug = e.target.closest('[data-sugestao]');
    if (sug) return enviar(sug.dataset.sugestao);
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'limpar') { historico = []; guardarHistorico(historico); return desenhar(); }
    if (acao === 'repetir') {
      const ultima = [...historico].reverse().find((m) => m.papel === 'user');
      if (ultima) enviar(ultima.texto, { repetir: true });
    }
    if (acao === 'copiar') {
      const m = historico[Number(e.target.closest('[data-i]').dataset.i)];
      try { await navigator.clipboard.writeText(m.texto); toast('Resposta copiada'); } catch { toast('Não consegui copiar'); }
    }
  });

  desenhar();
  const cancelarConfig = assinar('config', () => {
    // a chave foi (des)configurada em outra tela/aparelho: redesenha só se não estiver digitando
    if (!el.contains(document.activeElement) || document.activeElement === document.body) desenhar();
  });
  return () => { ctrl?.abort(); cancelarConfig(); };
}
