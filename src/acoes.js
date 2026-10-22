// Ações compartilhadas entre telas: salvar resultado de busca como lugar e adicionar ao roteiro.
import { adicionar, atualizar, listar } from './store.js';
import { abrirModal, esc, toast, opcoesSelect, STATUS, tipoInfo } from './ui.js';
import { ordenarDias, atividadesDoDia, proximaOrdem } from './lib/roteiro.js';

/**
 * Cria um lugar a partir de um resultado do Explorar (Overpass) ou da busca por nome (Photon).
 * Não duplica: se o osmId já foi salvo, devolve o lugar existente.
 */
export async function salvarResultado(r, { status = 'ideia', observacoes = '' } = {}) {
  if (r.osmId) {
    const existente = listar('lugares').find((l) => l.osmId === r.osmId);
    if (existente) return existente.id;
  }
  const dados = {
    nome: r.nome,
    tipo: r.tipo,
    subtipo: r.subtipo,
    lat: r.lat,
    lng: r.lng,
    coordAprox: false,
    status,
    observacoes,
    endereco: r.endereco || (r.detalhe ? String(r.detalhe) : undefined),
    telefone: r.telefone,
    site: r.site,
    horario: r.horario,
    acessoInfo: r.acessoInfo,
    estrutura: r.estrutura?.length ? r.estrutura.join(', ') : undefined,
    osmId: r.osmId,
    fonte: r.osmId ? 'OpenStreetMap' : 'Busca por nome (OpenStreetMap)',
    fonteUrl: r.fonteUrl,
    // Preço, reserva e acesso quase nunca vêm da fonte: marcamos para confirmar, sem inventar nada.
    tags: ['confirmar-dados']
  };
  if (r.pago === true) dados.preco = 'Pago (valor não informado na fonte)';
  if (r.pago === false) dados.preco = 'Gratuito segundo a fonte (confirmar)';
  return adicionar('lugares', dados);
}

/** Janela "Salvar lugar": escolhe status, anota algo e (opcional) já coloca no roteiro. */
export function modalSalvarResultado(r) {
  return new Promise((resolve) => {
    const t = tipoInfo(r.tipo);
    let id = null;
    const { el, fechar } = abrirModal({
      titulo: 'Salvar nos lugares',
      corpo: `<div class="folha-topo" style="--cor:${t.cor}"><span class="card-emoji">${t.emoji}</span>
          <div><div class="folha-nome">${esc(r.nome)}</div><div class="folha-meta">${esc(r.endereco || r.detalhe || 'Sem endereço na fonte')}</div></div></div>
        <form class="form" style="margin-top:14px">
          <label>Como está esse lugar para vocês?<select class="input" name="status">${opcoesSelect(STATUS, 'ideia')}</select></label>
          <label>Observação pessoal (opcional)<textarea class="input" name="obs" rows="2" placeholder="Quem indicou, o que chamou atenção…"></textarea></label>
          <label class="check"><input type="checkbox" name="roteiro"/> Já adicionar ao roteiro</label>
          <button class="btn btn-grande" type="submit">Salvar</button>
        </form>`,
      onFechar: () => resolve(id)
    });
    el.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      id = await salvarResultado(r, { status: fd.get('status'), observacoes: String(fd.get('obs')).trim() });
      const noRoteiro = fd.has('roteiro');
      fechar();
      toast('📍 Salvo em Lugares');
      if (noRoteiro) abrirAdicionarAoRoteiro({ lugarId: id, titulo: r.nome });
    });
  });
}

/** Janela para escolher o dia/etapa do roteiro e criar a atividade. */
export function abrirAdicionarAoRoteiro({ lugarId = '', titulo = '', diaId: diaInicial } = {}) {
  const dias = ordenarDias(listar('dias'));
  const opcoes = [
    ...dias.map((d) => `<option value="${esc(d.id)}" ${d.id === diaInicial ? 'selected' : ''}>${esc(d.titulo || 'Dia')}${d.data ? ` (${esc(d.data)})` : ''}</option>`),
    '<option value="">Sem dia por enquanto (banco de atividades)</option>',
    '<option value="__novo__">＋ Criar uma etapa nova</option>'
  ].join('');
  const { el, fechar } = abrirModal({
    titulo: 'Adicionar ao roteiro',
    corpo: `<form class="form">
      <label>O quê<input class="input" name="titulo" required value="${esc(titulo)}" placeholder="Nome da atividade"/></label>
      <label>Em qual dia ou etapa?<select class="input" name="dia">${opcoes}</select></label>
      <div class="grid2">
        <label>Horário (opcional)<input class="input" type="time" name="hora"/></label>
        <label>Duração em min (opcional)<input class="input" type="number" inputmode="numeric" min="0" step="5" name="duracao"/></label>
      </div>
      <label class="check"><input type="checkbox" name="alternativa"/> É um plano B</label>
      <button class="btn btn-grande" type="submit">Adicionar</button></form>`
  });
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let diaId = String(fd.get('dia'));
    if (diaId === '__novo__') {
      diaId = await adicionar('dias', { titulo: `Etapa ${dias.length + 1}`, ordem: proximaOrdem(dias) });
    }
    const doDia = atividadesDoDia(listar('atividades'), diaId);
    await adicionar('atividades', {
      diaId,
      lugarId,
      titulo: String(fd.get('titulo')).trim(),
      horaInicio: fd.get('hora') || '',
      duracaoMin: fd.get('duracao') ? Number(fd.get('duracao')) : null,
      alternativa: fd.has('alternativa'),
      confirmada: false,
      feito: false,
      ordem: proximaOrdem(doDia)
    });
    fechar();
    toast('📌 Adicionado ao roteiro');
  });
}

/** Alterna favorito. */
export const alternarFavorito = (l) => atualizar('lugares', l.id, { favorito: !l.favorito });
