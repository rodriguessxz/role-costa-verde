// 🧭 Roteiro flexível: dias ou etapas, atividades, plano B e avisos de conflito.
// Nada de itinerário rígido: dá para ter só etapas sem data, e deixar atividades soltas no "banco".
import { assinarVarias, listar, adicionar, atualizar, remover, obter } from '../store.js';
import { abrirAdicionarAoRoteiro } from '../acoes.js';
import { rotaDeCarro } from '../lib/rotas.js';
import { ordenarDias, atividadesDoDia, mover, proximaOrdem, analisarDia, horaParaMin } from '../lib/roteiro.js';
import { formatarKm, temCoord, linkGoogleMaps } from '../lib/geo.js';
import { ico } from '../icons.js';
import { esc, html, toast, tipoInfo, vazio, abrirModal, confirmar, opcoesSelect, REGIOES, formatarDuracao, quemMexeu } from '../ui.js';

let reorganizando = false;

const nomeDoDia = (d) => d.titulo || 'Dia';
function dataDoDia(d) {
  if (!d.data) return '';
  const dt = new Date(`${d.data}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}

/* ------------------------------ modais ------------------------------ */

function modalDia(dia) {
  const dias = ordenarDias(listar('dias'));
  const { el, fechar } = abrirModal({
    titulo: dia ? 'Editar dia ou etapa' : 'Novo dia ou etapa',
    corpo: `<form class="form">
      <label>Nome<input class="input" name="titulo" required value="${esc(dia?.titulo || `Dia ${dias.length + 1}`)}" placeholder="Ex.: Dia 3 — Trindade"/></label>
      <div class="grid2">
        <label>Data (opcional)<input class="input" type="date" name="data" value="${esc(dia?.data || '')}"/></label>
        <label>Região (opcional)<select class="input" name="regiao">${opcoesSelect(REGIOES, dia?.regiao, '—')}</select></label>
      </div>
      <label>Anotação do dia (opcional)<textarea class="input" name="nota" rows="2" placeholder="Ex.: sair cedo por causa da maré">${esc(dia?.nota || '')}</textarea></label>
      <button class="btn btn-grande" type="submit">Salvar</button></form>`
  });
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dados = { titulo: String(fd.get('titulo')).trim(), data: fd.get('data') || '', regiao: fd.get('regiao') || '', nota: String(fd.get('nota')).trim() };
    if (dia) atualizar('dias', dia.id, dados);
    else adicionar('dias', { ...dados, ordem: (dias.at(-1)?.ordem || 0) + 1 });
    fechar();
    toast(dia ? 'Dia atualizado' : 'Dia criado');
  });
}

function modalAtividade(a) {
  const dias = ordenarDias(listar('dias'));
  const lugares = [...listar('lugares')].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  const { el, fechar } = abrirModal({
    titulo: 'Editar atividade',
    corpo: `<form class="form">
      <label>Nome<input class="input" name="titulo" required value="${esc(a.titulo)}"/></label>
      <label>Lugar vinculado<select class="input" name="lugarId"><option value="">Nenhum (atividade livre)</option>
        ${lugares.map((l) => `<option value="${esc(l.id)}" ${l.id === a.lugarId ? 'selected' : ''}>${tipoInfo(l.tipo).emoji} ${esc(l.nome)}</option>`).join('')}</select></label>
      <label>Dia ou etapa<select class="input" name="diaId"><option value="">Banco de atividades (sem dia)</option>
        ${dias.map((d) => `<option value="${esc(d.id)}" ${d.id === a.diaId ? 'selected' : ''}>${esc(nomeDoDia(d))}</option>`).join('')}</select></label>
      <div class="grid2">
        <label>Horário<input class="input" type="time" name="hora" value="${esc(a.horaInicio || '')}"/></label>
        <label>Duração (min)<input class="input" type="number" inputmode="numeric" min="0" step="5" name="duracao" value="${a.duracaoMin ?? ''}"/></label>
      </div>
      <label>Observações<textarea class="input" name="nota" rows="2">${esc(a.nota || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="confirmada" ${a.confirmada ? 'checked' : ''}/> Confirmada (reserva ou combinado fechado)</label>
      <label class="check"><input type="checkbox" name="alternativa" ${a.alternativa ? 'checked' : ''}/> É um plano B</label>
      <button class="btn btn-grande" type="submit">Salvar</button>
      <button class="btn btn-perigo" type="button" data-apagar>Remover do roteiro</button>
      <p class="dica">${quemMexeu(a)}</p></form>`
  });
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const diaId = fd.get('diaId') || '';
    const mudouDia = diaId !== (a.diaId || '');
    atualizar('atividades', a.id, {
      titulo: String(fd.get('titulo')).trim(),
      lugarId: fd.get('lugarId') || '',
      diaId,
      horaInicio: fd.get('hora') || '',
      duracaoMin: fd.get('duracao') ? Number(fd.get('duracao')) : null,
      nota: String(fd.get('nota')).trim(),
      confirmada: fd.has('confirmada'),
      alternativa: fd.has('alternativa'),
      ...(mudouDia ? { ordem: proximaOrdem(atividadesDoDia(listar('atividades'), diaId)) } : {})
    });
    fechar();
    toast('Atividade atualizada');
  });
  el.querySelector('[data-apagar]').addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Remover do roteiro?', texto: 'O lugar continua salvo na biblioteca.', rotuloOk: 'Remover', perigo: true })) {
      remover('atividades', a.id);
      fechar();
    }
  });
}

/* ------------------------------ tela ------------------------------ */

function linhaAtividade(a, info, anterior, lugar, dias, ehPrimeiro, ehUltimo) {
  const t = lugar ? tipoInfo(lugar.tipo) : null;
  const avisos = [...info.avisos];
  // Rota real (OSRM) calculada antes: usada só se for do trecho anterior atual
  const rota = anterior && a.rotaDe === anterior.id ? a.rotaCarro : null;
  const iniAtual = horaParaMin(a.horaInicio);
  const iniAnt = horaParaMin(anterior?.horaInicio);
  if (rota && iniAtual !== null && iniAnt !== null && anterior.duracaoMin && iniAtual - (iniAnt + anterior.duracaoMin) < rota.min && iniAtual >= iniAnt + anterior.duracaoMin) {
    avisos.push(`Deslocamento apertado (rota de carro ~${rota.min} min)`);
  }
  const trecho = info.trecho && !a.alternativa ? `<div class="trecho">
      <span>↓ ${formatarKm(info.trecho.km)} em linha reta · ~${info.trecho.minEst} min <em>(estimativa)</em></span>
      ${rota ? `<span class="trecho-rota">🚗 rota de carro: ${rota.km.toFixed(1)} km · ${formatarDuracao(rota.min)} <em>(OSRM, estimativa)</em></span>`
    : `<button class="link-btn" data-acao="rota" data-id="${esc(a.id)}">Calcular rota de carro</button>`}
    </div>` : '';
  return `${trecho}
  <div class="ativ ${a.feito ? 'feita' : ''} ${a.alternativa ? 'alt' : ''}" data-id="${esc(a.id)}">
    <button class="ativ-check ${a.feito ? 'on' : ''}" data-acao="feito" aria-label="Marcar como feita" aria-pressed="${!!a.feito}">${a.feito ? ico('check') : ''}</button>
    <div class="ativ-corpo" data-acao="editar">
      <div class="ativ-linha1">
        ${a.horaInicio ? `<span class="ativ-hora">${esc(a.horaInicio)}</span>` : ''}
        <b>${t ? `${t.emoji} ` : ''}${esc(a.titulo || lugar?.nome || 'Atividade')}</b>
      </div>
      <div class="ativ-chips">
        ${a.confirmada ? '<span class="badge badge-ok">Confirmada</span>' : ''}
        ${a.alternativa ? '<span class="badge badge-alerta">Plano B</span>' : ''}
        ${a.duracaoMin ? `<span class="badge">${formatarDuracao(a.duracaoMin)}</span>` : ''}
        ${lugar && !temCoord(lugar) ? '<span class="badge">sem coordenada</span>' : ''}
      </div>
      ${a.nota ? `<p class="ativ-nota">${esc(a.nota)}</p>` : ''}
      ${avisos.map((v) => `<p class="ativ-aviso">⚠️ ${esc(v)}</p>`).join('')}
    </div>
    ${reorganizando ? `<div class="ativ-mover">
      <button class="icon-btn mini" data-acao="subir" ${ehPrimeiro ? 'disabled' : ''} aria-label="Subir">▲</button>
      <button class="icon-btn mini" data-acao="descer" ${ehUltimo ? 'disabled' : ''} aria-label="Descer">▼</button>
      <select class="mover-dia" data-acao="mover-dia" aria-label="Mover para outro dia"><option value="">Mover…</option>
        ${dias.filter((d) => d.id !== (a.diaId || '')).map((d) => `<option value="${esc(d.id)}">→ ${esc(nomeDoDia(d))}</option>`).join('')}
        ${a.diaId ? '<option value="__banco__">→ Banco (sem dia)</option>' : ''}</select>
    </div>` : `<div class="ativ-lado">${lugar && temCoord(lugar) ? `<a class="icon-btn mini" href="${linkGoogleMaps(lugar)}" target="_blank" rel="noopener" aria-label="Abrir navegação">🧭</a>` : ''}</div>`}
  </div>`;
}

function cartaoDia(d, ativs, lugarDe, dias, indice) {
  const analise = analisarDia(ativs, lugarDe);
  const comCoord = ativs.some((a) => { const l = lugarDe(a); return l && temCoord(l); });
  const planejado = ativs.filter((a) => !a.alternativa);
  const naoAlt = planejado.filter((a) => !a.feito).length;
  return `<article class="dia" data-dia="${esc(d.id)}">
    <header class="dia-cab">
      <div>
        <h2>${esc(nomeDoDia(d))}</h2>
        <p>${[dataDoDia(d), d.regiao && REGIOES[d.regiao], `${ativs.length} atividade${ativs.length === 1 ? '' : 's'}${naoAlt && planejado.length ? ` · ${naoAlt} a fazer` : ''}`].filter(Boolean).map(esc).join(' · ')}</p>
      </div>
      <div class="dia-botoes">
        ${comCoord ? `<a class="btn btn-sm btn-sec" href="#/mapa/dia/${encodeURIComponent(d.id)}">${ico('mapa')} Mapa</a>` : ''}
        <button class="icon-btn mini" data-acao="menu-dia" aria-label="Opções do dia">${ico('mais_opcoes')}</button>
      </div>
    </header>
    ${d.nota ? `<p class="dia-nota">${esc(d.nota)}</p>` : ''}
    <div class="dia-lista">
      ${ativs.length
    ? ativs.map((a, i) => {
      const ant = [...ativs.slice(0, i)].reverse().find((x) => !x.alternativa);
      return linhaAtividade(a, analise[i], ant, lugarDe(a), dias, i === 0, i === ativs.length - 1);
    }).join('')
    : '<p class="dica vazio-dia">Nada aqui ainda. Adicione um lugar salvo ou uma atividade livre.</p>'}
    </div>
    <button class="btn btn-sm btn-sec dia-add" data-acao="add" data-indice="${indice}">+ Adicionar neste dia</button>
  </article>`;
}

export function render(container, { params = [] } = {}) {
  const el = html('<section class="pagina roteiro"></section>');
  container.append(el);

  const lugarDe = (a) => (a.lugarId ? obter('lugares', a.lugarId) : null);

  function desenhar() {
    const dias = ordenarDias(listar('dias'));
    const todas = listar('atividades');
    const banco = atividadesDoDia(todas, '');
    const semDias = !dias.length;

    el.innerHTML = `
      <div class="cabeca-lista">
        <div><h1>Roteiro</h1><p class="sub">Vá montando aos poucos. Tudo pode mudar.</p></div>
      </div>
      <div class="roteiro-barra">
        <button class="btn btn-sm" data-acao="novo-dia">+ Dia ou etapa</button>
        <button class="btn btn-sm btn-sec" data-acao="nova-ativ">+ Atividade</button>
        ${todas.length > 1 ? `<button class="btn btn-sm btn-sec ${reorganizando ? 'on' : ''}" data-acao="reorganizar">${reorganizando ? 'Concluir' : 'Reorganizar'}</button>` : ''}
      </div>
      ${semDias && !banco.length ? vazio({ emoji: '🧭', titulo: 'Seu roteiro está em branco', texto: 'Crie um dia ou uma etapa (não precisa ter data). Depois adicione lugares salvos, ou deixe as ideias soltas no banco de atividades.', acao: { rotulo: 'Criar o primeiro dia', id: 'novo-dia' } }) : ''}
      <div class="dias">${dias.map((d, i) => cartaoDia(d, atividadesDoDia(todas, d.id), lugarDe, dias, i)).join('')}</div>
      ${banco.length ? `<article class="dia dia-banco">
        <header class="dia-cab"><div><h2>Banco de atividades</h2><p>Ainda sem dia — ${banco.length} ${banco.length === 1 ? 'atividade' : 'atividades'}</p></div></header>
        <div class="dia-lista">${banco.map((a, i) => linhaAtividade(a, { trecho: null, avisos: [] }, null, lugarDe(a), dias, i === 0, i === banco.length - 1)).join('')}</div>
      </article>` : ''}
      ${!semDias || banco.length ? '<p class="dica rodape-dica">Toque numa atividade para editar, confirmar ou marcar como plano B. Distâncias são estimativas em linha reta; “Calcular rota” consulta uma rota de carro real.</p>' : ''}`;
  }

  /* ----- eventos (delegação, um ouvinte só) ----- */
  el.addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-acao], [data-vazio]');
    if (!alvo) return;
    const acao = alvo.dataset.acao || alvo.dataset.vazio;
    const dias = ordenarDias(listar('dias'));
    const diaEl = alvo.closest('[data-dia]');
    const dia = diaEl ? dias.find((d) => d.id === diaEl.dataset.dia) : null;
    const ativEl = alvo.closest('.ativ');
    const a = obter('atividades', ativEl?.dataset.id || alvo.dataset.id); // o botão de rota fica fora do .ativ, com data-id próprio

    if (acao === 'novo-dia') return modalDia(null);
    if (acao === 'nova-ativ') return abrirAdicionarAoRoteiro({});
    if (acao === 'reorganizar') { reorganizando = !reorganizando; return desenhar(); }
    if (acao === 'add') return abrirAdicionarAoRoteiro({ diaId: dia?.id });
    if (acao === 'menu-dia' && dia) return menuDia(dia, dias);
    if (!a) return;
    if (acao === 'feito') return atualizar('atividades', a.id, { feito: !a.feito });
    if (acao === 'editar') return modalAtividade(a);
    if (acao === 'subir' || acao === 'descer') {
      const lista = atividadesDoDia(listar('atividades'), a.diaId || '');
      mover(lista, a.id, acao === 'subir' ? -1 : 1).forEach((u) => atualizar('atividades', u.id, { ordem: u.ordem }));
      return;
    }
    if (acao === 'rota') {
      const lista = atividadesDoDia(listar('atividades'), a.diaId || '');
      const i = lista.findIndex((x) => x.id === a.id);
      const ant = [...lista.slice(0, i)].reverse().find((x) => !x.alternativa);
      const la = ant && lugarDe(ant);
      const lb = lugarDe(a);
      if (!la || !lb) return;
      alvo.disabled = true;
      alvo.textContent = 'Calculando…';
      try {
        const r = await rotaDeCarro(la, lb);
        await atualizar('atividades', a.id, { rotaCarro: { km: r.km, min: r.min, fonte: 'OSRM', em: new Date().toISOString() }, rotaDe: ant.id });
      } catch {
        toast(navigator.onLine ? 'Não achei uma rota de carro entre esses pontos' : 'Sem internet para calcular a rota');
        alvo.disabled = false;
        alvo.textContent = 'Calcular rota de carro';
      }
    }
  });

  el.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-acao="mover-dia"]');
    if (!sel || !sel.value) return;
    const a = obter('atividades', sel.closest('.ativ').dataset.id);
    const diaId = sel.value === '__banco__' ? '' : sel.value;
    atualizar('atividades', a.id, { diaId, ordem: proximaOrdem(atividadesDoDia(listar('atividades'), diaId)), rotaCarro: null, rotaDe: '' });
    toast('Atividade movida');
  });

  function menuDia(dia, dias) {
    const i = dias.findIndex((d) => d.id === dia.id);
    const { el: m, fechar } = abrirModal({
      titulo: nomeDoDia(dia),
      corpo: `<div class="lista-acoes">
        <button class="btn btn-sec" data-m="editar">✏️ Editar nome, data e região</button>
        <button class="btn btn-sec" data-m="subir" ${i === 0 ? 'disabled' : ''}>▲ Mover dia para cima</button>
        <button class="btn btn-sec" data-m="descer" ${i === dias.length - 1 ? 'disabled' : ''}>▼ Mover dia para baixo</button>
        <button class="btn btn-perigo" data-m="apagar">🗑️ Apagar dia</button></div>`
    });
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      fechar();
      if (b.dataset.m === 'editar') modalDia(dia);
      if (b.dataset.m === 'subir' || b.dataset.m === 'descer') {
        mover(dias, dia.id, b.dataset.m === 'subir' ? -1 : 1).forEach((u) => atualizar('dias', u.id, { ordem: u.ordem }));
      }
      if (b.dataset.m === 'apagar') {
        const ativs = atividadesDoDia(listar('atividades'), dia.id);
        const ok = await confirmar({
          titulo: `Apagar “${nomeDoDia(dia)}”?`,
          texto: ativs.length ? `As ${ativs.length} atividades deste dia vão para o banco de atividades (nada é perdido).` : 'O dia está vazio.',
          rotuloOk: 'Apagar dia', perigo: true
        });
        if (!ok) return;
        const banco = atividadesDoDia(listar('atividades'), '');
        let ordem = proximaOrdem(banco);
        for (const a of ativs) atualizar('atividades', a.id, { diaId: '', ordem: ordem++ });
        remover('dias', dia.id);
      }
    });
  }

  // #/roteiro/nova (atalho do Início) abre direto "adicionar atividade"
  if (params[0] === 'nova') { history.replaceState(null, '', '#/roteiro'); setTimeout(() => abrirAdicionarAoRoteiro({}), 50); }

  return assinarVarias(['dias', 'atividades', 'lugares'], desenhar);
}
