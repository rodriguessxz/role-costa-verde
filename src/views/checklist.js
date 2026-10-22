// ✅ Checklist: listas de camping, roupas, comida, trilha, carro, compras e preparativos.
// Pensado para uma mão só: linha inteira é o botão de marcar.
import { assinarVarias, listar, adicionar, atualizar, remover, obter } from '../store.js';
import { nomesDupla } from '../viagem.js';
import { ico } from '../icons.js';
import { esc, html, toast, vazio, abrirModal, confirmar } from '../ui.js';
import { proximaOrdem } from '../lib/roteiro.js';

let soPendentes = false;
const abertas = new Set(); // listas recolhidas pelo usuário ficam recolhidas

// Modelos para começar (a pessoa escolhe criar; depois edita à vontade).
const MODELOS = [
  { nome: 'Equipamentos de camping', emoji: '⛺', itens: ['Barraca', 'Saco de dormir', 'Isolante / colchonete', 'Lanterna / headlamp', 'Fogareiro e gás', 'Panelinha e talheres', 'Cadeira dobrável', 'Corda e estacas extras'] },
  { nome: 'Roupas e itens pessoais', emoji: '🎒', itens: ['Roupa de banho', 'Agasalho / corta-vento', 'Roupas de trilha', 'Chinelo e tênis', 'Toalha de secagem rápida', 'Protetor solar e repelente', 'Higiene pessoal', 'Remédios pessoais'] },
  { nome: 'Alimentação e água', emoji: '🍌', itens: ['Água para a trilha', 'Filtro / pastilha de água', 'Lanches de trilha', 'Café da manhã', 'Comida do jantar', 'Sacos para lixo'] },
  { nome: 'Equipamentos para trilha', emoji: '🥾', itens: ['Mochila de ataque', 'Bastões', 'Capa de chuva', 'Kit de primeiros socorros', 'Power bank', 'GPX no relógio'] },
  { nome: 'Itens para o carro', emoji: '🚗', itens: ['Documentos do carro', 'Estepe, macaco e chave de roda', 'Cabo de carregador', 'Dinheiro e cartões', 'Galão / combustível'] },
  { nome: 'Compras pendentes', emoji: '🛒', itens: [] },
  { nome: 'Preparativos antes de sair', emoji: '📋', itens: ['Reservar camping do Réveillon', 'Conferir tábua de marés', 'Avisar alguém do roteiro', 'Baixar mapas e GPX offline', 'Carregar tudo'] }
];

function textoEQtd(bruto) {
  const m = /^(\d+)\s*[x×]\s*(.+)$/i.exec(bruto.trim());
  return m ? { qtd: Number(m[1]), texto: m[2].trim() } : { qtd: null, texto: bruto.trim() };
}

function modalLista(lista) {
  const { el, fechar } = abrirModal({
    titulo: lista ? 'Editar lista' : 'Nova lista',
    corpo: `<form class="form">
      <div class="grid2"><label>Nome<input class="input" name="nome" required value="${esc(lista?.nome || '')}" placeholder="Ex.: Equipamentos de camping"/></label>
      <label>Ícone (emoji)<input class="input" name="emoji" maxlength="4" value="${esc(lista?.emoji || '📋')}"/></label></div>
      <button class="btn btn-grande" type="submit">Salvar</button>
      ${lista ? '<button class="btn btn-sec" type="button" data-zerar>Desmarcar todos os itens</button><button class="btn btn-perigo" type="button" data-apagar>Apagar lista</button>' : ''}
    </form>`
  });
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dados = { nome: String(fd.get('nome')).trim(), emoji: String(fd.get('emoji')).trim() || '📋' };
    if (lista) atualizar('listas', lista.id, dados);
    else adicionar('listas', { ...dados, ordem: proximaOrdem(listar('listas')) });
    fechar();
  });
  el.querySelector('[data-zerar]')?.addEventListener('click', () => {
    listar('itens').filter((i) => i.listaId === lista.id && i.feito).forEach((i) => atualizar('itens', i.id, { feito: false, feitoPor: '' }));
    fechar();
    toast('Itens desmarcados');
  });
  el.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    const n = listar('itens').filter((i) => i.listaId === lista.id).length;
    if (await confirmar({ titulo: `Apagar “${lista.nome}”?`, texto: n ? `Os ${n} itens da lista também serão apagados.` : '', rotuloOk: 'Apagar lista', perigo: true })) {
      listar('itens').filter((i) => i.listaId === lista.id).forEach((i) => remover('itens', i.id));
      remover('listas', lista.id);
      fechar();
    }
  });
}

function modalItem(item) {
  const { a, b } = nomesDupla();
  const { el, fechar } = abrirModal({
    titulo: 'Editar item',
    corpo: `<form class="form">
      <label>Item<input class="input" name="texto" required value="${esc(item.texto)}"/></label>
      <div class="grid2">
        <label>Quantidade<input class="input" type="number" inputmode="numeric" min="1" name="qtd" value="${item.qtd ?? ''}"/></label>
        <label>Responsável<select class="input" name="responsavel">
          <option value="">Ninguém definido</option><option value="a" ${item.responsavel === 'a' ? 'selected' : ''}>${esc(a)}</option>
          <option value="b" ${item.responsavel === 'b' ? 'selected' : ''}>${esc(b)}</option><option value="ambos" ${item.responsavel === 'ambos' ? 'selected' : ''}>Os dois</option></select></label>
      </div>
      <label>Observação<input class="input" name="obs" value="${esc(item.obs || '')}" placeholder="Ex.: emprestar do Zé"/></label>
      <button class="btn btn-grande" type="submit">Salvar</button>
      <button class="btn btn-perigo" type="button" data-apagar>Remover item</button>
    </form>`
  });
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    atualizar('itens', item.id, {
      texto: String(fd.get('texto')).trim(),
      qtd: fd.get('qtd') ? Number(fd.get('qtd')) : null,
      responsavel: fd.get('responsavel') || '',
      obs: String(fd.get('obs')).trim()
    });
    fechar();
  });
  el.querySelector('[data-apagar]').addEventListener('click', () => { remover('itens', item.id); fechar(); toast('Item removido'); });
}

export function render(container) {
  const el = html('<section class="pagina checklist-pg"></section>');
  container.append(el);

  function desenhar() {
    const listas = [...listar('listas')].sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0));
    const itens = listar('itens');
    const { a, b } = nomesDupla();
    const nomeResp = (r) => (r === 'a' ? a : r === 'b' ? b : r === 'ambos' ? 'Os dois' : '');
    const feitos = itens.filter((i) => i.feito).length;

    el.innerHTML = `
      <div class="cabeca-lista"><div><h1>Checklist</h1>${itens.length ? `<p class="sub">${feitos} de ${itens.length} itens prontos</p>` : ''}</div>
        <button class="btn btn-sm" data-acao="nova-lista">+ Lista</button></div>
      ${itens.length ? `<i class="barra barra-grande"><u style="width:${Math.round((feitos / itens.length) * 100)}%"></u></i>
      <div class="chips"><button class="chip chip-sm ${soPendentes ? 'on' : ''}" data-acao="pendentes">Só o que falta</button></div>` : ''}
      ${!listas.length ? vazio({ emoji: '🎒', titulo: 'Nenhuma lista ainda', texto: 'Comece com as listas sugeridas (camping, roupas, comida, trilha, carro, compras e preparativos) e edite do seu jeito. Ou crie uma do zero.', acao: { rotulo: 'Criar listas sugeridas', id: 'modelos' } }) : ''}
      ${listas.map((l) => {
    const seus = itens.filter((i) => i.listaId === l.id).sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0));
    const prontos = seus.filter((i) => i.feito).length;
    const visiveis = soPendentes ? seus.filter((i) => !i.feito) : seus;
    return `<details class="lista-check" data-lista="${esc(l.id)}" ${abertas.has(`-${l.id}`) ? '' : 'open'}>
          <summary><span class="lc-emoji">${esc(l.emoji || '📋')}</span><span class="lc-nome">${esc(l.nome)}</span>
            <span class="lc-conta ${seus.length && prontos === seus.length ? 'completa' : ''}">${prontos}/${seus.length}</span>
            <button class="icon-btn mini" data-acao="menu-lista" aria-label="Opções da lista">${ico('mais_opcoes')}</button></summary>
          <div class="itens">
            ${visiveis.map((i) => `<div class="item ${i.feito ? 'feito' : ''} ${i._pendente ? 'pendente' : ''}" data-id="${esc(i.id)}">
              <button class="item-marca" data-acao="marcar" aria-pressed="${!!i.feito}"><span class="caixa">${i.feito ? ico('check') : ''}</span>
                <span class="item-txt">${i.qtd ? `<b>${i.qtd}×</b> ` : ''}${esc(i.texto)}${i.obs ? `<small>${esc(i.obs)}</small>` : ''}</span></button>
              ${i.responsavel ? `<span class="item-resp" title="${esc(nomeResp(i.responsavel))}">${esc(nomeResp(i.responsavel).slice(0, 2))}</span>` : ''}
              <button class="icon-btn mini" data-acao="editar-item" aria-label="Editar item">${ico('mais_opcoes')}</button>
            </div>`).join('') || `<p class="dica">${seus.length ? 'Tudo pronto aqui. 🎉' : 'Lista vazia. Adicione o primeiro item abaixo.'}</p>`}
            <form class="item-novo" data-form="item"><input class="input" name="texto" placeholder="Adicionar item… (ex.: 2x lanterna)" autocomplete="off" enterkeyhint="done"/></form>
          </div>
        </details>`;
  }).join('')}`;
  }

  el.addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-acao], [data-vazio]');
    if (!alvo) return;
    const acao = alvo.dataset.acao || alvo.dataset.vazio;
    const listaEl = alvo.closest('[data-lista]');
    const lista = listaEl ? obter('listas', listaEl.dataset.lista) : null;
    if (acao === 'menu-lista') { e.preventDefault(); return modalLista(lista); }
    if (acao === 'nova-lista') return modalLista(null);
    if (acao === 'pendentes') { soPendentes = !soPendentes; return desenhar(); }
    if (acao === 'modelos') {
      let ordem = proximaOrdem(listar('listas'));
      for (const m of MODELOS) {
        const id = await adicionar('listas', { nome: m.nome, emoji: m.emoji, ordem: ordem++ });
        m.itens.forEach((t, k) => adicionar('itens', { listaId: id, texto: t, feito: false, ordem: k + 1 }));
      }
      return toast('🎒 Listas criadas. Edite como quiser!');
    }
    const itemEl = alvo.closest('.item');
    const item = itemEl ? obter('itens', itemEl.dataset.id) : null;
    if (!item) return;
    if (acao === 'marcar') {
      if (navigator.vibrate) navigator.vibrate(15);
      return atualizar('itens', item.id, { feito: !item.feito, feitoPor: item.feito ? '' : (window.__usuario?.displayName || '') });
    }
    if (acao === 'editar-item') modalItem(item);
  });

  // Lembra listas recolhidas
  el.addEventListener('toggle', (e) => {
    const d = e.target.closest?.('[data-lista]');
    if (!d) return;
    if (d.open) abertas.delete(`-${d.dataset.lista}`); else abertas.add(`-${d.dataset.lista}`);
  }, true);

  el.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="item"]');
    if (!form) return;
    e.preventDefault();
    const bruto = String(new FormData(form).get('texto'));
    if (!bruto.trim()) return;
    const listaId = form.closest('[data-lista]').dataset.lista;
    const { qtd, texto } = textoEQtd(bruto);
    adicionar('itens', { listaId, texto, qtd, feito: false, responsavel: '', obs: '', ordem: proximaOrdem(listar('itens').filter((i) => i.listaId === listaId)) });
    form.reset();
    // mantém o foco para adicionar vários itens seguidos
    requestAnimationFrame(() => el.querySelector(`[data-lista="${CSS.escape(listaId)}"] .item-novo input`)?.focus());
  });

  return assinarVarias(['listas', 'itens', 'config'], () => {
    // não redesenha enquanto a pessoa digita um item novo
    const ativo = document.activeElement;
    if (ativo?.closest?.('.item-novo') && ativo.value) return;
    desenhar();
  });
}
