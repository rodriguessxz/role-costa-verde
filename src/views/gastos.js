// 💸 Racha de gastos entre os dois.
import { assinar, adicionar, remover, listar, obter } from '../store.js';
import { calcularSaldo, brl } from '../lib/gastos.js';
import { esc, html, toast } from '../ui.js';

export const CATEGORIAS = {
  comida: '🍽️ Comida', camping: '⛺ Camping', mercado: '🛒 Mercado', transporte: '⛵ Transporte',
  combustivel: '⛽ Combustível', role: '🎟️ Rolê', outros: '📦 Outros'
};

/** Nomes das 2 pessoas (editáveis em Config). */
export function pessoas() {
  const c = obter('config', 'pessoas');
  return [c?.a || 'Eu', c?.b || 'Parça'];
}

export function render(container) {
  const el = html(`<section class="pagina">
    <h1>💸 Racha</h1>
    <div class="saldo"></div>
    <form class="form form-gasto">
      <div class="grid2">
        <label>Valor (R$)<input class="input" name="valor" type="number" inputmode="decimal" step="0.01" min="0" required placeholder="0,00"/></label>
        <label>Quem pagou<select class="input" name="pagoPor"></select></label>
      </div>
      <label>O quê<input class="input" name="descricao" required placeholder="Ex.: barco pro Mamanguá" autocomplete="off"/></label>
      <div class="grid2">
        <label>Categoria<select class="input" name="categoria">${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Divisão<select class="input" name="divisao"><option value="igual">Meio a meio</option><option value="so-quem-pagou">Só de quem pagou</option></select></label>
      </div>
      <button class="btn btn-grande" type="submit">➕ Lançar</button>
    </form>
    <div class="lista-gastos"></div>
  </section>`);
  container.append(el);

  const sel = el.querySelector('[name=pagoPor]');
  const desenhar = () => {
    const [a, b] = pessoas();
    const atual = sel.value;
    sel.innerHTML = `<option value="a">${esc(a)}</option><option value="b">${esc(b)}</option>`;
    if (atual) sel.value = atual;

    const gastos = [...listar('gastos')].sort((x, y) => String(y.data).localeCompare(String(x.data)));
    const s = calcularSaldo(gastos, ['a', 'b']);
    const nome = (k) => (k === 'a' ? a : b);
    el.querySelector('.saldo').innerHTML = `<div class="card-saldo">
      <div class="saldo-total"><small>Total da trip</small><strong>${brl(s.total)}</strong></div>
      <div class="saldo-quem">${s.resumo
        ? `<b>${esc(nome(s.resumo.devedor))}</b> deve <b class="destaque">${brl(s.resumo.valor)}</b> → <b>${esc(nome(s.resumo.credor))}</b>`
        : 'Tudo quite 🤝'}</div>
      <div class="saldo-pago"><span>${esc(a)} pagou ${brl(s.pago.a)}</span><span>${esc(b)} pagou ${brl(s.pago.b)}</span></div>
    </div>`;

    el.querySelector('.lista-gastos').innerHTML = gastos.length
      ? gastos.map((g) => `<div class="gasto">
          <span class="gasto-cat">${(CATEGORIAS[g.categoria] || '📦').split(' ')[0]}</span>
          <span class="gasto-corpo"><strong>${esc(g.descricao)}</strong>
            <small>${esc(nome(g.pagoPor))} · ${new Date(g.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${g.divisao === 'so-quem-pagou' ? ' · só dele' : ''}</small></span>
          <span class="gasto-valor">${brl(g.valor)}</span>
          <button class="icon-btn" data-apagar="${esc(g.id)}" aria-label="Apagar">✕</button>
        </div>`).join('')
      : '<p class="vazio">Nenhum gasto ainda. Aproveita enquanto dura 😎</p>';
  };

  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    adicionar('gastos', {
      valor: Number(fd.get('valor')),
      pagoPor: fd.get('pagoPor'),
      descricao: String(fd.get('descricao')).trim(),
      categoria: fd.get('categoria'),
      divisao: fd.get('divisao'),
      data: new Date().toISOString()
    });
    e.target.reset();
    sel.value = fd.get('pagoPor');
    toast('💸 Lançado');
  });

  el.querySelector('.lista-gastos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-apagar]');
    if (!b) return;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'apagar?'; return; }
    remover('gastos', b.dataset.apagar);
  });

  const c1 = assinar('gastos', desenhar);
  const c2 = assinar('config', desenhar);
  return () => { c1(); c2(); };
}
