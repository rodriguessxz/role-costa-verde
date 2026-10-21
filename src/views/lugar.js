// 📍 Ficha do lugar (#/lugar/:id) e edição (#/editar/:id).
import { assinar, obter, atualizar, remover } from '../store.js';
import { linkGoogleMaps, linkWaze, posicaoAtual, temCoord } from '../lib/geo.js';
import {
  esc, html, toast, tipoInfo, TIPOS, STATUS, REGIOES, DIFICULDADES, ACESSOS,
  formatarDuracao, precisaCompletar
} from '../ui.js';

// Checklist pré-trilha (fica salvo dentro do próprio lugar)
const CHECKLIST = {
  agua: '💧 Água (mín. 1,5 L cada)',
  lanche: '🍌 Lanche',
  lanterna: '🔦 Lanterna / headlamp',
  repelente: '🦟 Repelente',
  protetor: '🧴 Protetor solar',
  gpx: '⌚ GPX no Amazfit',
  bateria: '🔋 Celular carregado + power bank',
  avisou: '📲 Avisou alguém do rolê',
  mare: '🌊 Conferiu maré / barco de volta'
};

export function render(container, { nome, params }) {
  const id = params[0];
  const editando = nome === 'editar';
  // Re-renderiza quando o dado muda (ex.: o amigo editou do outro celular)
  const cancelar = assinar('lugares', () => {
    const l = obter('lugares', id);
    // Não redesenha o formulário enquanto a pessoa digita
    if (l && editando && container.dataset.formAberto === id) return;
    container.innerHTML = '';
    if (!l) {
      container.append(html('<section class="pagina"><p class="vazio">Lugar não encontrado 🤔</p><a class="btn" href="#/lista">Voltar pra lista</a></section>'));
      return;
    }
    container.append(editando ? formulario(l, container) : ficha(l));
  });
  return () => { cancelar(); delete container.dataset.formAberto; };
}

/* ------------------------------ FICHA ------------------------------ */

function linha(rotulo, valor) {
  return valor ? `<div class="linha"><span>${rotulo}</span><strong>${valor}</strong></div>` : '';
}

function ficha(l) {
  const t = tipoInfo(l.tipo);
  const st = l.status || 'quero-ir';
  const ehRole = ['trilha', 'cachoeira', 'praia'].includes(l.tipo);
  const check = l.checklist || {};

  const el = html(`<section class="pagina ficha" style="--cor:${t.cor}">
    <a href="#/lista" class="voltar">← Lista</a>
    <div class="ficha-topo">
      <span class="ficha-emoji">${t.emoji}</span>
      <div>
        <h1>${esc(l.nome)}</h1>
        <p class="sub">${t.rotulo}${REGIOES[l.regiao] ? ` · ${esc(REGIOES[l.regiao])}` : ''}</p>
      </div>
    </div>

    ${precisaCompletar(l) ? '<div class="aviso">✏️ Faltam dados aqui (coordenada ou detalhes). Toca em <b>Editar</b> pra completar.</div>' : ''}

    <div class="segmentado" role="group" aria-label="Status">
      ${Object.entries(STATUS).map(([k, v]) => `<button data-status="${k}" class="${st === k ? 'on' : ''}">${v.emoji} ${v.rotulo}</button>`).join('')}
    </div>

    <div class="acoes">
      ${temCoord(l) ? `<a class="btn" href="${linkGoogleMaps(l)}" target="_blank" rel="noopener">🧭 Google Maps</a>
      <a class="btn btn-sec" href="${linkWaze(l)}" target="_blank" rel="noopener">🚙 Waze</a>` : ''}
      ${l.wikilocUrl ? `<a class="btn btn-wikiloc" href="${esc(l.wikilocUrl)}" target="_blank" rel="noopener">🥾 Abrir no Wikiloc</a>` : ''}
      ${l.contato ? `<a class="btn btn-sec" href="https://wa.me/55${esc(l.contato.replace(/\D/g, '').replace(/^55/, ''))}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
    </div>

    ${l.descricao ? `<p class="descricao">${esc(l.descricao)}</p>` : ''}

    <div class="info">
      ${linha('Dificuldade', esc(DIFICULDADES[l.dificuldade] || ''))}
      ${linha('Duração', esc(formatarDuracao(l.duracaoMin)))}
      ${linha('Distância', l.distanciaKm ? `${esc(l.distanciaKm)} km` : '')}
      ${linha('Acesso', esc(ACESSOS[l.acesso] || ''))}
      ${linha('Precisa guia', l.precisaGuia ? 'Sim' : '')}
      ${linha('Preço/noite', l.precoNoite ? `R$ ${esc(l.precoNoite)}` : '')}
      ${linha('Contato', esc(l.contato))}
      ${linha('Reserva', l.reservaNecessaria ? '📞 Precisa reservar' : '')}
      ${linha('Posição', temCoord(l) ? (l.coordAprox ? '📍 aproximada' : '📍 conferida') : '❓ sem coordenada')}
      ${l.status === 'fui' ? linha('Nota', `<span class="estrelas" data-nota>${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="${(l.nota || 0) >= n ? 'on' : ''}">★</button>`).join('')}</span>`) : ''}
    </div>

    ${(l.tags || []).length ? `<div class="tags">${l.tags.map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}</div>` : ''}

    ${ehRole ? `<details class="checklist" ${l.tipo === 'trilha' ? 'open' : ''}>
      <summary>🎒 Checklist antes de sair <small>${Object.values(check).filter(Boolean).length}/${Object.keys(CHECKLIST).length}</small></summary>
      ${Object.entries(CHECKLIST).map(([k, v]) => `<label class="check"><input type="checkbox" data-check="${k}" ${check[k] ? 'checked' : ''}/> ${v}</label>`).join('')}
      <button class="btn btn-sm btn-sec" data-acao="zerar-check">Zerar checklist</button>
    </details>` : ''}

    <div class="acoes acoes-rodape">
      <a class="btn btn-sec" href="#/editar/${encodeURIComponent(l.id)}">✏️ Editar</a>
      <button class="btn btn-sec" data-acao="aqui">📍 Estou aqui (corrigir posição)</button>
    </div>
  </section>`);

  // Status
  el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    atualizar('lugares', l.id, { status: b.dataset.status });
    toast(`${STATUS[b.dataset.status].emoji} Marcado como "${STATUS[b.dataset.status].rotulo}"`);
  }));

  // Nota
  el.querySelectorAll('[data-nota] button').forEach((b) => b.addEventListener('click', () => {
    atualizar('lugares', l.id, { nota: Number(b.dataset.n) });
  }));

  // Checklist
  el.querySelectorAll('[data-check]').forEach((c) => c.addEventListener('change', () => {
    atualizar('lugares', l.id, { checklist: { ...(l.checklist || {}), [c.dataset.check]: c.checked } });
  }));
  el.querySelector('[data-acao="zerar-check"]')?.addEventListener('click', () => atualizar('lugares', l.id, { checklist: {} }));

  // Corrigir posição com o GPS
  el.querySelector('[data-acao="aqui"]').addEventListener('click', async () => {
    toast('📡 Pegando sua localização…');
    const p = await posicaoAtual();
    if (!p) return toast('Sem GPS agora 😕');
    if (p.precisao > 150) toast(`Precisão baixa (±${Math.round(p.precisao)} m), mas salvei`);
    else toast('📍 Posição corrigida!');
    const tags = (l.tags || []).filter((x) => x !== 'completar');
    atualizar('lugares', l.id, { lat: p.lat, lng: p.lng, coordAprox: false, tags });
  });

  return el;
}

/* ---------------------------- FORMULÁRIO ---------------------------- */

const opcoes = (obj, atual, vazio = true) =>
  (vazio ? '<option value="">—</option>' : '') +
  Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.rotulo)}</option>`).join('');

function formulario(l, container) {
  container.dataset.formAberto = l.id;
  const el = html(`<section class="pagina">
    <a href="#/lugar/${encodeURIComponent(l.id)}" class="voltar">← Cancelar</a>
    <h1>✏️ Editar</h1>
    <form class="form">
      <label>Nome<input class="input" name="nome" required value="${esc(l.nome)}"/></label>
      <div class="grid2">
        <label>Tipo<select class="input" name="tipo">${opcoes(TIPOS, l.tipo, false)}</select></label>
        <label>Região<select class="input" name="regiao">${opcoes(REGIOES, l.regiao)}</select></label>
      </div>
      <label>Link do Wikiloc<input class="input" name="wikilocUrl" type="url" inputmode="url" placeholder="https://loc.wiki/t/..." value="${esc(l.wikilocUrl)}"/></label>
      <label>Descrição / dicas<textarea class="input" name="descricao" rows="4">${esc(l.descricao)}</textarea></label>
      <div class="grid2">
        <label>Dificuldade<select class="input" name="dificuldade">${opcoes(DIFICULDADES, l.dificuldade)}</select></label>
        <label>Acesso<select class="input" name="acesso">${opcoes(ACESSOS, l.acesso)}</select></label>
      </div>
      <div class="grid2">
        <label>Duração (min)<input class="input" name="duracaoMin" type="number" inputmode="numeric" min="0" value="${l.duracaoMin ?? ''}"/></label>
        <label>Distância (km)<input class="input" name="distanciaKm" type="number" inputmode="decimal" step="0.1" min="0" value="${l.distanciaKm ?? ''}"/></label>
      </div>
      <div class="grid2">
        <label>Latitude<input class="input" name="lat" type="number" inputmode="decimal" step="any" value="${l.lat ?? ''}"/></label>
        <label>Longitude<input class="input" name="lng" type="number" inputmode="decimal" step="any" value="${l.lng ?? ''}"/></label>
      </div>
      <p class="dica">Dica: no Google Maps, segura o dedo no lugar e copia as coordenadas. Ou usa “Estou aqui” na ficha quando chegar.</p>
      <div class="grid2">
        <label>Preço/noite (R$)<input class="input" name="precoNoite" type="number" inputmode="decimal" value="${l.precoNoite ?? ''}"/></label>
        <label>Contato (tel/Whats)<input class="input" name="contato" type="tel" value="${esc(l.contato)}"/></label>
      </div>
      <label>Tags (separadas por vírgula)<input class="input" name="tags" value="${esc((l.tags || []).join(', '))}"/></label>
      <div class="checks">
        <label class="check"><input type="checkbox" name="reservaNecessaria" ${l.reservaNecessaria ? 'checked' : ''}/> Precisa reservar</label>
        <label class="check"><input type="checkbox" name="precisaGuia" ${l.precisaGuia ? 'checked' : ''}/> Precisa guia</label>
        <label class="check"><input type="checkbox" name="gpxNoRelogio" ${l.gpxNoRelogio ? 'checked' : ''}/> GPX já está no Amazfit</label>
        <label class="check"><input type="checkbox" name="coordAprox" ${l.coordAprox ? 'checked' : ''}/> Posição aproximada</label>
      </div>
      <button class="btn btn-grande" type="submit">💾 Salvar</button>
      <button class="btn btn-perigo" type="button" data-acao="apagar">🗑️ Apagar lugar</button>
    </form>
  </section>`);

  const form = el.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const num = (k) => { const v = fd.get(k); return v === '' || v === null ? null : Number(v); };
    const tags = String(fd.get('tags') || '').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
    const lat = num('lat');
    const lng = num('lng');
    const dados = {
      nome: String(fd.get('nome')).trim(),
      tipo: fd.get('tipo'),
      regiao: fd.get('regiao') || '',
      wikilocUrl: String(fd.get('wikilocUrl') || '').trim(),
      descricao: String(fd.get('descricao') || '').trim(),
      dificuldade: fd.get('dificuldade') || null,
      acesso: fd.get('acesso') || null,
      duracaoMin: num('duracaoMin'),
      distanciaKm: num('distanciaKm'),
      lat, lng,
      precoNoite: num('precoNoite'),
      contato: String(fd.get('contato') || '').trim(),
      tags: Number.isFinite(lat) && Number.isFinite(lng) && !l.nome.includes('(renomear)') ? tags.filter((t) => t !== 'completar') : tags,
      reservaNecessaria: fd.has('reservaNecessaria'),
      precisaGuia: fd.has('precisaGuia'),
      gpxNoRelogio: fd.has('gpxNoRelogio'),
      coordAprox: fd.has('coordAprox')
    };
    atualizar('lugares', l.id, dados);
    delete container.dataset.formAberto;
    toast('💾 Salvo!');
    location.hash = `#/lugar/${encodeURIComponent(l.id)}`;
  });

  el.querySelector('[data-acao="apagar"]').addEventListener('click', () => {
    // Confirmação em 2 toques (sem window.confirm, que trava em PWA)
    const b = el.querySelector('[data-acao="apagar"]');
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de novo pra apagar mesmo'; return; }
    remover('lugares', l.id);
    delete container.dataset.formAberto;
    toast('🗑️ Apagado');
    location.hash = '#/lista';
  });

  return el;
}
