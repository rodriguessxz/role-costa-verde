// 📞 Contatos: o funil dos campings (e outros locais) que estamos procurando e contatando.
import { assinarVarias, listar, atualizar } from '../store.js';
import { abrirRegistroContato, linksDeContato } from '../contatos.js';
import { ETAPAS, CANAIS, ETAPAS_ABERTAS, interacoesDoLugar, resumoContatos, situacaoRetorno, etapaDoLugar } from '../lib/contatos.js';
import { tempoRelativo, dataCurta } from '../lib/tempo.js';
import { ico } from '../icons.js';
import { esc, html, tipoInfo, REGIOES, vazio, toast } from '../ui.js';

const TIPOS_FUNIL = { camping: '⛺ Campings', hospedagem: '🏠 Hospedagem', restaurante: '🍽️ Comer', todos: 'Todos' };
let tipoFiltro = 'camping';
let etapaFiltro = '';
let mostrarForaDoFunil = false;

const casaTipo = (l) => tipoFiltro === 'todos' || l.tipo === tipoFiltro;

function cartao(l, interacoes) {
  const t = tipoInfo(l.tipo);
  const etapa = etapaDoLugar(l, interacoes);
  const r = resumoContatos(interacoes);
  const sit = r.retornoEm ? situacaoRetorno(r.retornoEm) : null;
  const zap = linksDeContato(l).find((c) => c.canal === 'whatsapp' || c.canal === 'telefone');
  return `<article class="contato-card" data-id="${esc(l.id)}" style="--cor:${t.cor}">
    <a class="contato-topo" href="#/lugar/${encodeURIComponent(l.id)}">
      <span class="card-emoji">${t.emoji}</span>
      <span class="contato-info">
        <b>${esc(l.nome)}</b>
        <small>${esc(REGIOES[l.regiao] || '')}${r.ultima ? `${l.regiao ? ' · ' : ''}${CANAIS[r.ultima.canal]?.emoji || ''} ${tempoRelativo(r.ultima.data)}` : ''}</small>
      </span>
      <span class="badge badge-status">${ETAPAS[etapa]?.emoji || ''} ${esc(ETAPAS[etapa]?.rotulo || 'Sem etapa')}</span>
    </a>
    ${r.valor ? `<p class="contato-valor"><b>${esc(r.valor.texto)}</b>${r.valor.datas ? ` · ${esc(r.valor.datas)}` : ''}</p>` : ''}
    ${r.ultima?.texto ? `<p class="contato-resumo">${esc(r.ultima.texto)}</p>` : ''}
    ${r.retornoEm ? `<p class="contato-retorno ${sit === 'atrasado' ? 'atrasado' : ''}">↪ Retornar ${sit === 'hoje' ? 'hoje' : esc(dataCurta(r.retornoEm))}${sit === 'atrasado' ? ' (atrasado)' : ''}${r.ultima?.proximoPasso ? ` · ${esc(r.ultima.proximoPasso)}` : ''}</p>` : ''}
    <div class="res-acoes">
      <button class="btn btn-sm" data-acao="registrar">${ico('contato')} Registrar</button>
      ${zap ? `<a class="btn btn-sm btn-sec" href="${esc(zap.href)}" ${zap.canal === 'whatsapp' ? 'target="_blank" rel="noopener noreferrer"' : ''} data-canal="${zap.canal}">${CANAIS[zap.canal].emoji} ${zap.rotulo}</a>` : ''}
    </div>
  </article>`;
}

export function render(container) {
  const el = html(`<section class="pagina contatos-pg">
    <div class="cabeca-lista"><div><h1>Contatos</h1><p class="sub">O funil de quem vocês estão procurando e contatando.</p></div>
      <a class="btn btn-sm" href="#/explorar">+ Achar locais</a></div>
    <div class="chips" data-tipos></div>
    <div class="chips" data-etapas></div>
    <div data-corpo></div>
  </section>`);
  container.append(el);
  const corpo = el.querySelector('[data-corpo]');

  function desenhar() {
    const lugares = listar('lugares').filter(casaTipo);
    const todasInter = listar('interacoes');
    const porLugar = new Map(lugares.map((l) => [l.id, interacoesDoLugar(todasInter, l.id)]));
    const noFunil = lugares.filter((l) => l.etapaContato || porLugar.get(l.id).length);
    const fora = lugares.filter((l) => !noFunil.includes(l) && l.status !== 'descartado' && ['camping', 'hospedagem', 'restaurante'].includes(l.tipo));
    const etapaDe = (l) => etapaDoLugar(l, porLugar.get(l.id));
    const contagem = (k) => noFunil.filter((l) => etapaDe(l) === k).length;

    el.querySelector('[data-tipos]').innerHTML = Object.entries(TIPOS_FUNIL)
      .map(([k, r]) => `<button class="chip chip-sm ${tipoFiltro === k ? 'on' : ''}" data-tipo="${k}">${r}</button>`).join('');
    el.querySelector('[data-etapas]').innerHTML = [
      `<button class="chip chip-sm ${etapaFiltro ? '' : 'on'}" data-etapa="">Todas ${noFunil.length}</button>`,
      ...Object.entries(ETAPAS).map(([k, e]) => `<button class="chip chip-sm ${etapaFiltro === k ? 'on' : ''}" data-etapa="${k}">${e.emoji} ${e.rotulo} ${contagem(k)}</button>`)
    ].join('');

    // retornos combinados (atrasados e dos próximos 7 dias), só quando ainda faz sentido agir
    const retornos = noFunil
      .map((l) => ({ l, r: resumoContatos(porLugar.get(l.id)) }))
      .filter(({ l, r }) => r.retornoEm && ETAPAS_ABERTAS.includes(etapaDe(l)))
      .sort((a, b) => a.r.retornoEm.localeCompare(b.r.retornoEm));
    const urgentes = retornos.filter(({ r }) => ['atrasado', 'hoje'].includes(situacaoRetorno(r.retornoEm)));

    const visiveis = noFunil.filter((l) => !etapaFiltro || etapaDe(l) === etapaFiltro);
    const grupos = Object.keys(ETAPAS).map((k) => ({ k, itens: visiveis.filter((l) => etapaDe(l) === k) })).filter((g) => g.itens.length);
    const semEtapa = visiveis.filter((l) => !ETAPAS[etapaDe(l)]);
    if (semEtapa.length) grupos.push({ k: '', itens: semEtapa });

    let saida = '';
    if (urgentes.length && !etapaFiltro) {
      saida += `<section class="bloco-simples retornos"><h3>⏰ Retornar agora <small>${urgentes.length}</small></h3>
        <div class="lista-simples">${urgentes.map(({ l, r }) => `<a class="linha-ativ" href="#/lugar/${encodeURIComponent(l.id)}"><span class="linha-hora">${esc(dataCurta(r.retornoEm))}</span>
          <span class="linha-corpo"><b>${esc(l.nome)}</b><small>${situacaoRetorno(r.retornoEm) === 'atrasado' ? 'atrasado' : 'hoje'}${r.ultima?.proximoPasso ? ` · ${esc(r.ultima.proximoPasso)}` : ''}</small></span></a>`).join('')}</div></section>`;
    }
    if (!noFunil.length) {
      saida += vazio({
        emoji: '📞', titulo: 'Nenhum contato em andamento',
        texto: 'Ache campings no Explorar e toque em “Contatar”, ou coloque abaixo os que já estão salvos. Cada conversa fica registrada com valores, datas e retorno.',
        acao: { rotulo: 'Explorar campings', href: '#/explorar' }
      });
    } else {
      saida += grupos.map((g) => `<section class="bloco-simples"><h3>${ETAPAS[g.k]?.emoji || ''} ${esc(ETAPAS[g.k]?.rotulo || 'Sem etapa')} <small>${g.itens.length}</small></h3>
        <div class="lista">${g.itens.map((l) => cartao(l, porLugar.get(l.id))).join('')}</div></section>`).join('');
      if (!visiveis.length) saida += vazio({ emoji: '🔎', titulo: 'Ninguém nessa etapa' });
    }
    if (fora.length) {
      saida += `<section class="bloco-simples"><button class="btn btn-sec btn-grande" data-acao="fora">${mostrarForaDoFunil ? 'Esconder' : 'Mostrar'} salvos fora do funil (${fora.length})</button>
        ${mostrarForaDoFunil ? `<div class="lista-simples" style="margin-top:10px">${fora.map((l) => `<div class="linha-ativ"><span class="linha-hora">${tipoInfo(l.tipo).emoji}</span>
          <span class="linha-corpo"><b>${esc(l.nome)}</b><small>${esc(REGIOES[l.regiao] || '')}</small></span>
          <button class="btn btn-sm" data-acao="entrar" data-id="${esc(l.id)}">Pôr no funil</button></div>`).join('')}</div>` : ''}</section>`;
    }
    corpo.innerHTML = saida;
  }

  el.addEventListener('click', (e) => {
    const tipo = e.target.closest('[data-tipo]');
    if (tipo) { tipoFiltro = tipo.dataset.tipo; return desenhar(); }
    const etapa = e.target.closest('[data-etapa]');
    if (etapa) { etapaFiltro = etapa.dataset.etapa; return desenhar(); }
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'fora') { mostrarForaDoFunil = !mostrarForaDoFunil; return desenhar(); }
    if (acao === 'entrar') {
      atualizar('lugares', e.target.closest('[data-id]').dataset.id, { etapaContato: 'a-contatar' });
      return toast('📌 No funil, etapa “A contatar”');
    }
    if (acao === 'registrar') {
      const l = listar('lugares').find((x) => x.id === e.target.closest('.contato-card').dataset.id);
      if (l) abrirRegistroContato(l);
    }
  });

  return assinarVarias(['lugares', 'interacoes'], desenhar);
}
