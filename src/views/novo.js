// ➕ Adicionar lugar rápido: nome + tipo + (opcional) minha localização ou link do Wikiloc.
import { adicionar } from '../store.js';
import { posicaoAtual } from '../lib/geo.js';
import { html, toast, TIPOS } from '../ui.js';

export function render(container) {
  let pos = null;
  const el = html(`<section class="pagina">
    <h1>➕ Novo lugar</h1>
    <p class="sub">Rapidinho: o resto dá pra completar depois.</p>
    <form class="form">
      <label>Nome<input class="input" name="nome" required placeholder="Ex.: Cachoeira escondida do Seu Zé" autocomplete="off"/></label>
      <div class="tipo-grid">
        ${Object.entries(TIPOS).map(([k, v], i) => `<label class="tipo-op" style="--cor:${v.cor}">
          <input type="radio" name="tipo" value="${k}" ${i === 1 ? 'checked' : ''}/><span>${v.emoji}<br/>${v.rotulo}</span></label>`).join('')}
      </div>
      <label>Link do Wikiloc (opcional)<input class="input" name="wikilocUrl" type="url" inputmode="url" placeholder="https://loc.wiki/t/..."/></label>
      <button type="button" class="btn btn-sec" data-acao="gps">📍 Usar minha localização atual</button>
      <p class="dica" data-pos>Sem localização: vai aparecer só na lista até você completar.</p>
      <label>Anotação (opcional)<textarea class="input" name="descricao" rows="3" placeholder="Quem indicou, preço, horário do barco…"></textarea></label>
      <button class="btn btn-grande" type="submit">Salvar ✨</button>
    </form>
  </section>`);
  container.append(el);

  el.querySelector('[data-acao="gps"]').addEventListener('click', async () => {
    el.querySelector('[data-pos]').textContent = '📡 Procurando…';
    pos = await posicaoAtual();
    el.querySelector('[data-pos]').textContent = pos
      ? `✅ Localização pega (±${Math.round(pos.precisao)} m)`
      : '😕 Não consegui o GPS. Salva assim mesmo e corrige depois.';
  });

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = await adicionar('lugares', {
      nome: String(fd.get('nome')).trim(),
      tipo: fd.get('tipo'),
      wikilocUrl: String(fd.get('wikilocUrl') || '').trim(),
      descricao: String(fd.get('descricao') || '').trim(),
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      coordAprox: !pos,
      status: 'quero-ir',
      tags: pos ? [] : ['completar'],
      criadoPor: window.__usuario?.displayName || 'local'
    });
    toast('✨ Lugar adicionado!');
    location.hash = `#/lugar/${encodeURIComponent(id)}`;
  });
}
