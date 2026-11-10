// ✨ Ajustar o roteiro com IA: a IA PROPÕE, o app VALIDA contra os dados reais, mostra a PRÉVIA do que mudaria
// (com avisos de conflito) e só grava se a pessoa aprovar. Dá para DESFAZER depois.
import { listar, adicionar, atualizar, remover } from './store.js';
import { getViagem } from './viagem.js';
import { iaAtiva, perguntarIA, mensagemDoErro } from './ia-cliente.js';
import { promptAjusteRoteiro, extrairJson, validarPlano, simularPlano, planoDeGravacao, avisosDoPlano } from './lib/ia.js';
import { analisarDia } from './lib/roteiro.js';
import { abrirModal, confirmar, esc, toast, tipoInfo } from './ui.js';

const CHAVE_DESFAZER = 'role:ia-desfazer';

const ATALHOS = [
  'Agrupe as atividades por proximidade para andar menos de carro',
  'Distribua melhor: nenhum dia muito cheio nem vazio',
  'Encaixe os lugares sem dia nos dias que fazem mais sentido',
  'Monte um dia tranquilo de praia e descanso',
  'Vai chover em um dos dias: troque o que molha e deixe plano B'
];

const estadoAtual = () => ({
  dias: listar('dias'), atividades: listar('atividades'), lugares: listar('lugares')
});

/* ------------------------------ desfazer ------------------------------ */

export function ajusteParaDesfazer() {
  try { return JSON.parse(localStorage.getItem(CHAVE_DESFAZER) || 'null'); } catch { return null; }
}
const guardarDesfazer = (d) => { try { localStorage.setItem(CHAVE_DESFAZER, JSON.stringify(d)); } catch { /* ok */ } };
const limparDesfazer = () => { try { localStorage.removeItem(CHAVE_DESFAZER); } catch { /* ok */ } };

/** Reverte o último ajuste: devolve os campos alterados e apaga o que a IA criou. */
export async function desfazerUltimoAjuste() {
  const d = ajusteParaDesfazer();
  if (!d) return false;
  const ok = await confirmar({
    titulo: 'Desfazer o último ajuste da IA?',
    texto: `Volta ${d.atualizacoes.length} atividade(s) ao que eram e apaga ${d.diasCriados.length} dia(s) e ${d.atividadesCriadas.length} atividade(s) que a IA criou.`,
    rotuloOk: 'Desfazer', perigo: true
  });
  if (!ok) return false;
  for (const a of d.atividadesCriadas) await remover('atividades', a);
  for (const u of d.atualizacoes) await atualizar('atividades', u.id, { ...u.antes, rotaCarro: null, rotaDe: '' });
  for (const dia of d.diasCriados) await remover('dias', dia);
  limparDesfazer();
  toast('↶ Ajuste desfeito');
  return true;
}

/* ------------------------------ gravação ------------------------------ */

async function aplicar(g) {
  const refDia = {};
  const desfazer = { diasCriados: [], atividadesCriadas: [], atualizacoes: g.atualizar.map((u) => ({ id: u.id, antes: u.antes })) };
  const resolver = (v) => (typeof v === 'string' && v.startsWith('ref:') ? refDia[v] : v);

  for (const d of g.criarDias) {
    refDia[d.ref] = await adicionar('dias', { titulo: d.titulo, data: d.data, regiao: d.regiao, nota: '', ordem: d.ordem });
    desfazer.diasCriados.push(refDia[d.ref]);
  }
  for (const u of g.atualizar) {
    const campos = { ...u.campos };
    if ('diaId' in campos) campos.diaId = resolver(campos.diaId);
    if ('diaId' in campos || 'ordem' in campos) { campos.rotaCarro = null; campos.rotaDe = ''; } // rota calculada deixa de valer
    await atualizar('atividades', u.id, campos);
  }
  for (const a of g.criarAtividades) {
    const id = await adicionar('atividades', {
      diaId: resolver(a.diaId), lugarId: a.lugarId, titulo: a.titulo, horaInicio: a.horaInicio, duracaoMin: a.duracaoMin,
      alternativa: a.alternativa, confirmada: false, feito: false, ordem: a.ordem, nota: 'Sugerido pela IA'
    });
    desfazer.atividadesCriadas.push(id);
  }
  guardarDesfazer(desfazer);
}

/* ------------------------------ prévia ------------------------------ */

function htmlRoteiroDepois(sim) {
  const linha = (a) => {
    const t = a.tipoLugar ? tipoInfo(a.tipoLugar).emoji : '';
    const marca = a.nova ? '<span class="badge badge-ok">novo</span>' : a._antes && a.diaId !== a._antes.diaId ? '<span class="badge badge-alerta">movido</span>' : '';
    return `<li class="${a.alternativa ? 'alt' : ''}"><span class="ia-hora">${esc(a.horaInicio || '—')}</span> ${t} ${esc(a.titulo)} ${a.alternativa ? '<span class="badge">plano B</span>' : ''} ${marca}</li>`;
  };
  const bloco = (titulo, lista, novo) => `<div class="ia-dia ${novo ? 'novo' : ''}"><b>${esc(titulo)}${novo ? ' <span class="badge badge-ok">novo dia</span>' : ''}</b>
    ${lista.length ? `<ul>${lista.map(linha).join('')}</ul>` : '<p class="dica">vazio</p>'}</div>`;
  return sim.dias.map((d) => bloco(d.titulo, d.atividades, d.nova)).join('') + (sim.banco.length ? bloco('Banco de atividades', sim.banco, false) : '');
}

/* ------------------------------ janela ------------------------------ */

export function abrirAjusteIA() {
  if (!iaAtiva()) {
    toast('Ative a IA gratuita em Configurações → Integrações');
    location.hash = '#/ia';
    return;
  }
  const estado = estadoAtual();
  if (!estado.dias.length && !estado.atividades.length && !estado.lugares.length) {
    toast('Salve alguns lugares ou crie dias antes de pedir ajuda à IA');
    return;
  }
  let instrucao = '';
  let ctrl = null;
  const { el, fechar } = abrirModal({ titulo: '✨ Ajustar roteiro com IA', corpo: '<div data-corpo></div>', onFechar: () => ctrl?.abort() });
  const corpo = el.querySelector('[data-corpo]');

  function telaPedido(aviso = '') {
    corpo.innerHTML = `<p class="dica">Diga o que você quer. A IA propõe mudanças e você vê a <b>prévia</b> antes de aprovar. Atividades confirmadas ou feitas nunca são alteradas.</p>
      ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ''}
      <form class="form" data-form="pedido">
        <textarea class="input" name="instrucao" rows="4" required placeholder="Ex.: o dia 28 vai chover, troque a trilha por algo coberto e ponha a trilha no dia 29">${esc(instrucao)}</textarea>
        <div class="chips chips-quebra">${ATALHOS.map((a) => `<button type="button" class="chip chip-sm" data-atalho="${esc(a)}">${esc(a)}</button>`).join('')}</div>
        <button class="btn btn-grande" type="submit">Pedir proposta</button>
        <p class="dica">A IA só vê nomes, tipos, regiões, horários e distâncias em linha reta. Telefones e e-mails não são enviados.</p>
      </form>`;
    corpo.querySelectorAll('[data-atalho]').forEach((b) => b.addEventListener('click', () => { corpo.querySelector('textarea').value = b.dataset.atalho; }));
    corpo.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      instrucao = String(new FormData(e.target).get('instrucao')).trim();
      pedir();
    });
  }

  async function pedir() {
    corpo.innerHTML = '<div class="ia-aguarde"><div class="ia-pensando"><i></i><i></i><i></i></div><p>A IA está montando uma proposta…</p></div>';
    ctrl = new AbortController();
    const dados = { viagem: getViagem(), ...estadoAtual(), notas: listar('notas'), listas: listar('listas'), itens: listar('itens'), interacoes: listar('interacoes') };
    try {
      const { sistema, usuario } = promptAjusteRoteiro(dados, instrucao);
      const r = await perguntarIA({ sistema, mensagens: [{ papel: 'user', texto: usuario }], json: true, signal: ctrl.signal });
      const plano = extrairJson(r.texto);
      const val = validarPlano(plano, estadoAtual());
      if (!val.ok) return telaPedido(val.erro + ' Tente reformular o pedido.');
      telaPrevia(val);
    } catch (e) {
      if (e.name === 'AbortError') return;
      telaPedido(mensagemDoErro(e));
    }
  }

  function telaPrevia(val) {
    const estado2 = estadoAtual();
    const sim = simularPlano(estado2, val.operacoes);
    const g = planoDeGravacao(sim);
    const avisosHorario = avisosDoPlano(sim, estado2.lugares, analisarDia);
    const nada = !val.operacoes.length;
    corpo.innerHTML = `
      ${val.resumo ? `<p class="ia-resumo">${esc(val.resumo)}</p>` : ''}
      ${nada ? '<div class="aviso">A IA não propôs mudanças para esse pedido.</div>' : `
      <h3>O que muda <small>${sim.mudancas.length}</small></h3>
      <ol class="ia-mudancas">${sim.mudancas.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>
      <h3>Como o roteiro ficaria</h3>${htmlRoteiroDepois(sim)}`}
      ${avisosHorario.length ? `<div class="aviso"><b>Atenção no resultado:</b><ul>${avisosHorario.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${val.avisos.length ? `<div class="aviso"><b>A IA pede para confirmar:</b><ul>${val.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${val.rejeitadas.length ? `<details class="ia-rejeitadas"><summary>${val.rejeitadas.length} sugestão(ões) descartada(s) por segurança</summary><ul>${val.rejeitadas.map((r) => `<li>${esc(r.motivo)}</li>`).join('')}</ul></details>` : ''}
      <div class="acoes">
        ${nada ? '' : '<button class="btn" data-acao="aplicar">Aplicar mudanças</button>'}
        <button class="btn btn-sec" data-acao="outra">${nada ? 'Reformular o pedido' : 'Pedir outra proposta'}</button>
      </div>
      <p class="dica">Distâncias são em linha reta; a IA não sabe estrada, maré, barco nem chuva de verdade. Confira antes de fechar.</p>`;
    corpo.querySelector('[data-acao="outra"]').addEventListener('click', () => telaPedido());
    corpo.querySelector('[data-acao="aplicar"]')?.addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        await aplicar(g);
        fechar();
        toast('✨ Roteiro ajustado. Dá para desfazer na tela do Roteiro.', 4500);
      } catch {
        toast('Não consegui aplicar tudo. Confira o roteiro.');
        ev.currentTarget.disabled = false;
      }
    });
  }

  telaPedido();
}
