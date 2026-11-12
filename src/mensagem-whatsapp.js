// Janela "Mensagem pro WhatsApp": texto pronto, descolado e EDITÁVEL; abre o WhatsApp já com a mensagem.
// Funciona offline e sem IA (a IA é só um extra opcional para "melhorar").
import { atualizar, adicionar, obter } from './store.js';
import { getViagem, nomesDupla, euSou } from './viagem.js';
import { abrirRegistroContato } from './contatos.js';
import { iaAtiva, perguntarIA, mensagemDoErro } from './ia-cliente.js';
import { INSTRUCAO_BASE } from './lib/ia.js';
import { montarMensagem, textoDatas, linkWhatsApp, VARIANTES } from './lib/mensagens.js';
import { abrirModal, esc, toast, REGIOES } from './ui.js';

const KEY_VARIANTE = 'role:msg-variante';

/** Palpite do nome da região para o texto ("Paraty", "Ubatuba Norte"...). */
const nomeRegiao = (l) => {
  const r = REGIOES[l.regiao];
  return r ? r.split(' / ')[0] : '';
};

export function abrirMensagemWhatsApp(lugar) {
  const v = getViagem();
  const meuNome = nomesDupla()[euSou()];
  let variante = 'descolada';
  try { const s = localStorage.getItem(KEY_VARIANTE); if (VARIANTES[s]) variante = s; } catch { /* ok */ }
  let editado = false;
  let ctrl = null;

  const numeroSalvo = lugar.contato || lugar.telefone || '';
  const { el, fechar } = abrirModal({
    titulo: '💬 Mensagem pro WhatsApp',
    corpo: `<p class="dica contato-lugar">${esc(lugar.nome)}</p>
    <form class="form" data-form="wa">
      <div class="chips" data-variantes>${Object.entries(VARIANTES).map(([k, x]) => `<button type="button" class="chip" data-variante="${k}">${x.rotulo}</button>`).join('')}</div>
      <div class="grid2">
        <label>Quantas pessoas<input class="input" type="number" name="pessoas" min="1" value="2" inputmode="numeric"/></label>
        <label>Datas<input class="input" name="datas" value="${esc(textoDatas(v.inicio, v.fim))}"/></label>
      </div>
      <label>Mensagem (pode editar)<textarea class="input wa-texto" name="texto" rows="11"></textarea></label>
      <p class="dica" data-refazer hidden>Você editou o texto. <button type="button" class="link-btn" data-acao="refazer">Refazer a partir do modelo</button></p>
      ${numeroSalvo ? '' : '<label>WhatsApp do local (com DDD)<input class="input" name="numero" type="tel" inputmode="tel" placeholder="(24) 99999-9999"/></label><p class="dica">Sem número salvo: no Google Maps, abra o lugar e copie o telefone.</p>'}
      <div class="acoes acoes-fixas">
        <a class="btn" data-abrir data-zap-pronto data-id="${esc(lugar.id)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>
        <button type="button" class="btn btn-sec" data-acao="copiar">Copiar</button>
      </div>
      ${iaAtiva() ? '<button type="button" class="btn btn-sec btn-grande" data-acao="ia">✨ Melhorar com IA</button>' : ''}
      <div class="lembrete-registro" data-lembrete hidden><span>Mandou a mensagem?</span>
        <button type="button" class="btn btn-sm" data-acao="registrar">Registrar contato</button></div>
    </form>`,
    onFechar: () => ctrl?.abort()
  });

  const form = el.querySelector('form');
  const texto = form.elements.texto;
  const abrir = el.querySelector('[data-abrir]');
  const avisoRefazer = el.querySelector('[data-refazer]');

  const gerar = () => {
    texto.value = montarMensagem({
      variante, camping: lugar.nome, regiao: nomeRegiao(lugar), datas: form.elements.datas.value.trim(),
      pessoas: Number(form.elements.pessoas.value) || 2, meuNome
    });
    editado = false;
    avisoRefazer.hidden = true;
    atualizarLink();
  };
  const numeroAtual = () => numeroSalvo || form.elements.numero?.value || '';
  function atualizarLink() {
    const href = linkWhatsApp(numeroAtual(), texto.value);
    if (href) { abrir.href = href; abrir.removeAttribute('aria-disabled'); abrir.classList.remove('desativado'); }
    else { abrir.removeAttribute('href'); abrir.setAttribute('aria-disabled', 'true'); abrir.classList.add('desativado'); }
  }
  const pintarVariantes = () => el.querySelectorAll('[data-variante]').forEach((b) => b.classList.toggle('on', b.dataset.variante === variante));

  el.querySelector('[data-variantes]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-variante]');
    if (!b) return;
    variante = b.dataset.variante;
    try { localStorage.setItem(KEY_VARIANTE, variante); } catch { /* ok */ }
    pintarVariantes();
    gerar();
  });
  form.elements.pessoas.addEventListener('input', () => { if (!editado) gerar(); });
  form.elements.datas.addEventListener('input', () => { if (!editado) gerar(); });
  texto.addEventListener('input', () => { editado = true; avisoRefazer.hidden = false; atualizarLink(); });
  form.elements.numero?.addEventListener('input', atualizarLink);

  abrir.addEventListener('click', (e) => {
    if (abrir.getAttribute('aria-disabled') === 'true') { e.preventDefault(); toast('Informe o WhatsApp do local (com DDD)'); form.elements.numero?.focus(); return; }
    // guarda o número digitado no cadastro do lugar, para a próxima vez
    const n = form.elements.numero?.value.trim();
    if (n && !numeroSalvo) atualizar('lugares', lugar.id, { contato: n });
  });

  form.addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'refazer') gerar();
    if (acao === 'copiar') { try { await navigator.clipboard.writeText(texto.value); toast('Mensagem copiada'); } catch { toast('Não consegui copiar'); } }
    if (acao === 'registrar') { fechar(); abrirRegistroContato(lugar, { canal: 'whatsapp' }); }
    if (acao === 'ia') {
      const botao = e.target.closest('button');
      botao.disabled = true;
      botao.textContent = '✨ Melhorando…';
      ctrl = new AbortController();
      try {
        const r = await perguntarIA({
          sistema: `${INSTRUCAO_BASE}\nReescreva a mensagem de WhatsApp abaixo de um jeito natural, humano e descontraído, mantendo TODAS as perguntas e as datas. Não invente fatos, não adicione telefone nem dados pessoais. Devolva só a mensagem pronta.`,
          mensagens: [{ papel: 'user', texto: texto.value }], signal: ctrl.signal
        });
        texto.value = r.texto;
        editado = true;
        avisoRefazer.hidden = false;
        atualizarLink();
      } catch (err) {
        if (err.name !== 'AbortError') toast(mensagemDoErro(err));
      } finally {
        botao.disabled = false;
        botao.textContent = '✨ Melhorar com IA';
      }
    }
  });

  pintarVariantes();
  gerar();
}

/* ------------------- WhatsApp pronto em 1 toque (cartões) ------------------- */

/** Número do local (WhatsApp ou telefone salvo), ou ''. */
export const numeroDoLugar = (l) => String(l.contato || l.telefone || '').trim();

/** Mensagem padrão (estilo salvo) para um lugar. */
export function mensagemPadrao(lugar, variante) {
  const v = getViagem();
  let estilo = variante || 'descolada';
  try { const s = localStorage.getItem(KEY_VARIANTE); if (!variante && VARIANTES[s]) estilo = s; } catch { /* ok */ }
  return montarMensagem({
    variante: estilo, camping: lugar.nome, regiao: nomeRegiao(lugar), datas: textoDatas(v.inicio, v.fim), pessoas: 2, meuNome: nomesDupla()[euSou()]
  });
}

/** Link do WhatsApp JÁ com a mensagem pronta. Null se o lugar não tem número. */
export const linkMensagemPronta = (lugar) => linkWhatsApp(numeroDoLugar(lugar), mensagemPadrao(lugar));

/**
 * HTML do bloco de WhatsApp de um cartão: com número = botão que abre o WhatsApp já com a mensagem;
 * sem número = campo para colar o número (e o botão aparece em seguida).
 */
export function htmlWhatsApp(lugar) {
  const href = linkMensagemPronta(lugar);
  if (href) {
    return `<div class="zap-linha">
      <a class="btn btn-whats btn-grande" data-zap-pronto data-id="${esc(lugar.id)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">💬 Chamar no WhatsApp (mensagem pronta)</a>
      <button class="btn btn-sec" data-acao="zap" aria-label="Editar a mensagem" title="Editar a mensagem">✏️</button></div>`;
  }
  return `<form class="zap-numero" data-form="numero" data-id="${esc(lugar.id)}">
      <label>WhatsApp do local (com DDD)<input class="input" name="numero" type="tel" inputmode="tel" placeholder="(24) 99999-9999" required/></label>
      <button class="btn btn-whats" type="submit">Salvar e liberar a mensagem</button></form>
    <p class="dica">Sem telefone nos dados abertos. Abra no Google Maps, copie o telefone e cole aqui.</p>`;
}

/** Trata o envio do formulário de número dos cartões. Devolve true se salvou. */
export async function salvarNumeroDoCartao(form) {
  const n = String(new FormData(form).get('numero')).trim();
  if (!linkWhatsApp(n, 'x')) { toast('Número inválido. Use DDD + número.'); return false; }
  await atualizar('lugares', form.dataset.id, { contato: n });
  return true;
}

const KEY_PENDENTE = 'role:wa-pendente';

function marcarPendente(id) {
  try { sessionStorage.setItem(KEY_PENDENTE, JSON.stringify({ id, em: Date.now() })); } catch { /* ok */ }
}

const agoraLocalISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const maisDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Ao voltar do WhatsApp, pergunta se a mensagem foi enviada e, se sim, registra tudo sozinho. */
function perguntarSeEnviou() {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(KEY_PENDENTE) || 'null'); } catch { /* ok */ }
  if (!p || Date.now() - p.em < 3000) return;
  try { sessionStorage.removeItem(KEY_PENDENTE); } catch { /* ok */ }
  const lugar = obter('lugares', p.id);
  if (!lugar) return;
  const { el, fechar } = abrirModal({
    titulo: 'Você mandou a mensagem?',
    corpo: `<p>Para <b>${esc(lugar.nome)}</b>. Se sim, o app registra o contato e marca como “Aguardando resposta”, com lembrete para daqui a 2 dias.</p>
      <div class="acoes"><button class="btn btn-sec" data-nao>Ainda não</button><button class="btn" data-sim>Sim, registrar</button></div>`
  });
  el.querySelector('[data-nao]').addEventListener('click', fechar);
  el.querySelector('[data-sim]').addEventListener('click', async () => {
    await adicionar('interacoes', {
      lugarId: lugar.id, canal: 'whatsapp', data: agoraLocalISO(), pessoa: '',
      texto: 'Mensagem inicial enviada (apresentação, datas e pedido de vaga e valores).', valor: null, valorTipo: '', datas: '',
      retornoEm: maisDias(2), proximoPasso: 'Ver se responderam'
    });
    await atualizar('lugares', lugar.id, { etapaContato: 'aguardando' });
    fechar();
    toast('📞 Contato registrado: aguardando resposta');
  });
}

/** Liga o monitor: toque em qualquer botão "WhatsApp pronto" + volta ao app = pergunta se enviou. */
export function iniciarLembreteWhatsApp() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-zap-pronto]');
    if (a) marcarPendente(a.dataset.id);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') perguntarSeEnviou(); });
  window.addEventListener('focus', perguntarSeEnviou);
}
