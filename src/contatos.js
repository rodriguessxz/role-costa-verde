// Contato com campings e outros locais: registrar conversas, linha do tempo e etapa do funil.
import { adicionar, atualizar, remover, listar } from './store.js';
import { salvarEdicao } from './edicao.js';
import { ico } from './icons.js';
import { esc, abrirModal, confirmar, toast, quemMexeu } from './ui.js';
import { tempoRelativo, dataCurta } from './lib/tempo.js';
import {
  ETAPAS, CANAIS, TIPOS_VALOR, interacoesDoLugar, resumoContatos, situacaoRetorno, textoValor, etapaDoLugar
} from './lib/contatos.js';

const ROTULOS = { texto: 'O que combinaram', valor: 'Valor', valorTipo: 'Tipo de valor', datas: 'Datas', pessoa: 'Pessoa', canal: 'Canal', retornoEm: 'Retornar em', proximoPasso: 'Próximo passo', data: 'Quando' };

/** "2026-11-10T14:30" no horário local (formato do <input type=datetime-local>). */
const agoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const handleInstagram = (s) => String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
const soDigitos = (s) => String(s || '').replace(/\D/g, '').replace(/^55/, '');

/** Links de contato disponíveis para o lugar (só os que existem). */
export function linksDeContato(l) {
  const fone = l.telefone || l.contato;
  const zap = soDigitos(l.contato || l.telefone);
  const insta = handleInstagram(l.instagram);
  return [
    zap.length >= 10 && { canal: 'whatsapp', rotulo: 'WhatsApp', href: `https://wa.me/55${zap}` },
    fone && { canal: 'telefone', rotulo: 'Ligar', href: `tel:${String(fone).replace(/[^\d+]/g, '')}` },
    l.email && { canal: 'email', rotulo: 'E-mail', href: `mailto:${l.email}` },
    insta && { canal: 'instagram', rotulo: 'Instagram', href: `https://instagram.com/${encodeURIComponent(insta)}`, externo: true },
    /^https?:\/\//i.test(l.site || '') && { canal: 'outro', rotulo: 'Site', href: l.site, externo: true }
  ].filter(Boolean);
}

/* ------------------------------ registro ------------------------------ */

/**
 * Janela para registrar (ou editar) uma conversa.
 * @param lugar o lugar contatado
 * @param opcoes { interacao?: conversa existente (edição), canal?: canal pré-selecionado }
 */
export function abrirRegistroContato(lugar, { interacao, canal } = {}) {
  const base = interacao ? { ...interacao } : null;
  const etapaAtual = etapaDoLugar(lugar, interacoesDoLugar(listar('interacoes'), lugar.id));
  const etapaPadrao = interacao ? etapaAtual : (['', 'a-contatar'].includes(etapaAtual) ? 'contatado' : etapaAtual);
  const canalAtual = interacao?.canal || canal || 'whatsapp';

  const { el, fechar } = abrirModal({
    titulo: interacao ? 'Editar contato' : 'Registrar contato',
    corpo: `<p class="dica contato-lugar">${esc(lugar.nome)}</p>
    <form class="form">
      <div class="canais" role="radiogroup" aria-label="Canal">
        ${Object.entries(CANAIS).map(([k, c]) => `<label class="canal-op"><input type="radio" name="canal" value="${k}" ${canalAtual === k ? 'checked' : ''}/><span>${c.emoji}<br/>${c.rotulo}</span></label>`).join('')}
      </div>
      <div class="grid2">
        <label>Quando<input class="input" type="datetime-local" name="data" value="${esc(interacao?.data || agoraLocal())}" required/></label>
        <label>Falei com<input class="input" name="pessoa" value="${esc(interacao?.pessoa || '')}" placeholder="Nome de quem atendeu"/></label>
      </div>
      <label>O que ele disse / combinamos<textarea class="input" name="texto" rows="4" placeholder="Ex.: tem vaga na semana do Réveillon, pacote fechado, aceita pix, banheiro e chuveiro quente…">${esc(interacao?.texto || '')}</textarea></label>
      <div class="grid2">
        <label>Valor informado (R$)<input class="input" type="number" inputmode="decimal" step="0.01" min="0" name="valor" value="${interacao?.valor ?? ''}"/></label>
        <label>O valor é<select class="input" name="valorTipo">${Object.entries(TIPOS_VALOR).map(([k, v]) => `<option value="${k}" ${(interacao?.valorTipo || 'noite') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <label>Datas / condições do valor<input class="input" name="datas" value="${esc(interacao?.datas || '')}" placeholder="Ex.: 30/12 a 02/01, mínimo 3 noites"/></label>
      <label>Como ficou o contato?<select class="input" name="etapa">${Object.entries(ETAPAS).map(([k, e]) => `<option value="${k}" ${etapaPadrao === k ? 'selected' : ''}>${e.emoji} ${e.rotulo}</option>`).join('')}</select></label>
      <div class="grid2">
        <label>Retornar em<input class="input" type="date" name="retornoEm" value="${esc(interacao?.retornoEm || '')}"/></label>
        <label>Próximo passo<input class="input" name="proximoPasso" value="${esc(interacao?.proximoPasso || '')}" placeholder="Ex.: mandar comprovante"/></label>
      </div>
      <label class="check" data-atualiza-preco hidden><input type="checkbox" name="atualizaPreco" checked/> Usar este valor como preço por noite do lugar</label>
      <button class="btn btn-grande" type="submit">${interacao ? 'Salvar alterações' : 'Registrar'}</button>
      ${interacao ? '<button class="btn btn-perigo" type="button" data-apagar>Apagar este registro</button>' : ''}
      ${interacao ? `<p class="dica">${quemMexeu(interacao)}</p>` : ''}
    </form>`
  });

  const form = el.querySelector('form');
  const caixaPreco = el.querySelector('[data-atualiza-preco]');
  const mostrarPreco = () => {
    caixaPreco.hidden = !(form.elements.valor.value && form.elements.valorTipo.value === 'noite');
  };
  form.elements.valor.addEventListener('input', mostrarPreco);
  form.elements.valorTipo.addEventListener('change', mostrarPreco);
  mostrarPreco();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) ?? '').trim();
    const valor = fd.get('valor') === '' ? null : Number(fd.get('valor'));
    const dados = {
      lugarId: lugar.id,
      canal: fd.get('canal') || 'outro',
      data: txt('data'),
      pessoa: txt('pessoa'),
      texto: txt('texto'),
      valor,
      valorTipo: valor === null ? '' : txt('valorTipo'),
      datas: txt('datas'),
      retornoEm: txt('retornoEm'),
      proximoPasso: txt('proximoPasso')
    };
    if (interacao) {
      if (!(await salvarEdicao('interacoes', interacao.id, base, dados, ROTULOS))) return;
    } else {
      await adicionar('interacoes', dados);
    }
    const mudancasLugar = { etapaContato: fd.get('etapa') };
    if (!caixaPreco.hidden && fd.has('atualizaPreco') && valor !== null) mudancasLugar.precoNoite = valor;
    await atualizar('lugares', lugar.id, mudancasLugar);
    fechar();
    toast(interacao ? 'Contato atualizado' : '📞 Contato registrado');
  });

  el.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Apagar este registro?', texto: 'Não dá para desfazer.', rotuloOk: 'Apagar', perigo: true })) {
      await remover('interacoes', interacao.id);
      fechar();
      toast('Registro apagado');
    }
  });
}

/* ------------------------- bloco na ficha do lugar ------------------------- */

const formatarData = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');
};

/** O bloco aparece sempre para camping/hospedagem/comer; para os outros, só depois de haver contato. */
export function mostraBlocoContato(lugar, interacoes) {
  return ['camping', 'hospedagem', 'restaurante'].includes(lugar.tipo) || !!lugar.etapaContato || interacoes.length > 0;
}

export function htmlBlocoContato(lugar, interacoes) {
  const etapa = etapaDoLugar(lugar, interacoes);
  const r = resumoContatos(interacoes);
  const sit = r.retornoEm ? situacaoRetorno(r.retornoEm) : null;
  const links = linksDeContato(lugar);
  return `<section class="bloco-simples bloco-contato" data-bloco-contato>
    <h3>${ico('contato')} Contato com o local</h3>
    <div class="chips chips-etapa" role="group" aria-label="Etapa do contato">
      ${Object.entries(ETAPAS).map(([k, e]) => `<button class="chip chip-sm ${etapa === k ? 'on' : ''}" data-etapa="${k}">${e.emoji} ${e.rotulo}</button>`).join('')}
    </div>
    ${r.valor || r.retornoEm ? `<div class="resumo-contato">
      ${r.valor ? `<div><span>Último valor informado</span><b>${esc(r.valor.texto)}</b><small>${esc(r.valor.datas || '')}${r.valor.datas ? ' · ' : ''}${esc(tempoRelativo(r.valor.data))}</small></div>` : ''}
      ${r.retornoEm ? `<div class="${sit === 'atrasado' ? 'alerta' : ''}"><span>Retornar até</span><b>${esc(dataCurta(r.retornoEm))}</b><small>${sit === 'atrasado' ? 'atrasado' : sit === 'hoje' ? 'é hoje' : esc(r.ultima?.proximoPasso || '')}</small></div>` : ''}
    </div>` : ''}
    ${links.length ? `<div class="acoes acoes-contato">${links.map((c) => `<a class="btn btn-sm btn-sec" data-canal="${c.canal}" href="${esc(c.href)}" ${c.externo || c.canal === 'whatsapp' ? 'target="_blank" rel="noopener noreferrer"' : ''}>${CANAIS[c.canal].emoji} ${c.rotulo}</a>`).join('')}</div>
      <div class="lembrete-registro" data-lembrete hidden></div>` : '<p class="dica">Sem telefone, WhatsApp ou e-mail salvos. Use Editar para cadastrar e ter os atalhos aqui.</p>'}
    <button class="btn btn-grande" data-acao="registrar-contato">＋ Registrar contato</button>
    ${interacoes.length ? `<ol class="linha-tempo">${interacoes.map((i) => `<li data-interacao="${esc(i.id)}" tabindex="0" role="button">
        <span class="lt-ponto">${CANAIS[i.canal]?.emoji || '📝'}</span>
        <div class="lt-corpo">
          <div class="lt-topo"><b>${esc(CANAIS[i.canal]?.rotulo || 'Contato')}${i.pessoa ? ` · ${esc(i.pessoa)}` : ''}</b><small>${esc(formatarData(i.data))}</small></div>
          ${i.texto ? `<p>${esc(i.texto)}</p>` : ''}
          ${textoValor(i) || i.datas ? `<p class="lt-valor">${esc([textoValor(i), i.datas].filter(Boolean).join(' · '))}</p>` : ''}
          ${i.proximoPasso || i.retornoEm ? `<small>↪ ${esc([i.proximoPasso, i.retornoEm && `retornar ${dataCurta(i.retornoEm)}`].filter(Boolean).join(' · '))}</small>` : ''}
          <small class="lt-quem">${esc(i.criadoPor || '')}</small>
        </div></li>`).join('')}</ol>` : '<p class="dica">Nenhum contato registrado ainda. Anote cada conversa para não perder valores e combinados.</p>'}
  </section>`;
}

/** Liga os botões do bloco acima. `raiz` = elemento da ficha. */
export function ligarBlocoContato(raiz, lugar, interacoes) {
  const bloco = raiz.querySelector('[data-bloco-contato]');
  if (!bloco) return;
  bloco.addEventListener('click', (e) => {
    const etapa = e.target.closest('[data-etapa]');
    if (etapa) return atualizar('lugares', lugar.id, { etapaContato: etapa.dataset.etapa });
    if (e.target.closest('[data-acao="registrar-contato"]')) return abrirRegistroContato(lugar);
    const item = e.target.closest('[data-interacao]');
    if (item) return abrirRegistroContato(lugar, { interacao: interacoes.find((i) => i.id === item.dataset.interacao) });
    const canal = e.target.closest('[data-canal]');
    if (canal) {
      // depois de abrir WhatsApp/ligação, lembra de registrar o que foi dito
      const aviso = bloco.querySelector('[data-lembrete]');
      setTimeout(() => {
        aviso.hidden = false;
        aviso.innerHTML = `<span>Conversou por ${esc(CANAIS[canal.dataset.canal].rotulo)}?</span>
          <button class="btn btn-sm" data-registrar-canal="${canal.dataset.canal}">Registrar agora</button>
          <button class="btn btn-sm btn-sec" data-dispensar>Depois</button>`;
      }, 600);
      return;
    }
    const reg = e.target.closest('[data-registrar-canal]');
    if (reg) return abrirRegistroContato(lugar, { canal: reg.dataset.registrarCanal });
    if (e.target.closest('[data-dispensar]')) bloco.querySelector('[data-lembrete]').hidden = true;
  });
  bloco.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-interacao]')) e.target.click();
  });
}
