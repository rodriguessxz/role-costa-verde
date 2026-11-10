// Janela "Mensagem pro WhatsApp": texto pronto, descolado e EDITÁVEL; abre o WhatsApp já com a mensagem.
// Funciona offline e sem IA (a IA é só um extra opcional para "melhorar").
import { atualizar, listar } from './store.js';
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
  let enviou = false;
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
        <a class="btn" data-abrir target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>
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
    enviou = true;
    setTimeout(() => { el.querySelector('[data-lembrete]').hidden = false; }, 500);
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
  void enviou; void listar;

  pintarVariantes();
  gerar();
}
