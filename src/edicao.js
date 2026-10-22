// Salvar edição sem sobrescrever em silêncio o que a outra pessoa mudou (usa lib/conflito.js).
import { obter, atualizar } from './store.js';
import { camposAlterados, conflitos } from './lib/conflito.js';
import { abrirModal, esc, toast } from './ui.js';

const mostrar = (v) => {
  if (v === null || v === undefined || v === '') return '(vazio)';
  const t = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
};

/** Mostra "o seu valor × o dele" por campo e devolve { campo: 'meu' | 'dele' } (ou null se cancelar). */
function resolverConflitos(campos, atual, minhas, rotulos) {
  return new Promise((resolve) => {
    let resposta = null;
    const corpo = `<p class="dica">${esc(atual.atualizadoPor || 'Outra pessoa')} mudou ${campos.length === 1 ? 'este campo' : 'estes campos'} enquanto você editava. Escolha qual versão fica:</p>
      <form class="form">
        ${campos.map((c) => `<fieldset class="conflito">
          <legend>${esc(rotulos[c] || c)}</legend>
          <label class="check"><input type="radio" name="${esc(c)}" value="meu" checked/> <span><b>Sua versão:</b> ${esc(mostrar(minhas[c]))}</span></label>
          <label class="check"><input type="radio" name="${esc(c)}" value="dele"/> <span><b>Versão de ${esc(atual.atualizadoPor || 'outra pessoa')}:</b> ${esc(mostrar(atual[c]))}</span></label>
        </fieldset>`).join('')}
        <div class="acoes"><button type="button" class="btn btn-sec" data-cancelar>Cancelar</button><button class="btn" type="submit">Salvar escolhas</button></div>
      </form>`;
    const { el, fechar } = abrirModal({ titulo: 'Alguém mexeu nisto também', corpo, onFechar: () => resolve(resposta) });
    el.querySelector('[data-cancelar]').addEventListener('click', fechar);
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      resposta = Object.fromEntries(campos.map((c) => [c, fd.get(c)]));
      fechar();
    });
  });
}

/**
 * Grava só o que a pessoa mudou. Se houver conflito, pergunta. Devolve true se salvou (ou nada mudou).
 * @param base  cópia do registro como estava quando a edição abriu
 * @param novo  valores do formulário
 */
export async function salvarEdicao(colecao, id, base, novo, rotulos = {}) {
  const minhas = camposAlterados(base, novo);
  if (!Object.keys(minhas).length) return true;
  const atual = obter(colecao, id);
  if (!atual) { toast('Este registro foi apagado enquanto você editava'); return false; }
  const conf = conflitos(base, atual, minhas);
  if (conf.length) {
    const escolha = await resolverConflitos(conf, atual, minhas, rotulos);
    if (!escolha) return false;
    for (const c of conf) if (escolha[c] === 'dele') delete minhas[c];
  }
  if (Object.keys(minhas).length) await atualizar(colecao, id, minhas);
  return true;
}
