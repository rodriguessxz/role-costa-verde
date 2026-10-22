// 📍 Ficha do lugar (#/lugar/:id) e edição (#/editar/:id).
import { assinarVarias, obter, atualizar, remover, adicionar, listar } from '../store.js';
import { salvarEdicao } from '../edicao.js';
import { abrirAdicionarAoRoteiro, alternarFavorito } from '../acoes.js';
import { linkGoogleMaps, linkWaze, posicaoAtual, temCoord } from '../lib/geo.js';
import { ico } from '../icons.js';
import {
  esc, html, toast, tipoInfo, TIPOS, STATUS, SUBTIPOS, REGIOES, DIFICULDADES, ACESSOS,
  formatarDuracao, precisaCompletar, quemMexeu, confirmar, vazio, opcoesSelect
} from '../ui.js';
import { tempoRelativo } from '../lib/tempo.js';

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

const PRIORIDADES = { 1: 'Baixo', 2: 'Médio', 3: 'Alto' };
const ROTULOS = {
  nome: 'Nome', tipo: 'Tipo', status: 'Status', descricao: 'Descrição', observacoes: 'Observações',
  endereco: 'Endereço', telefone: 'Telefone', site: 'Site', horario: 'Horário', preco: 'Preço', precoNoite: 'Preço por noite',
  lat: 'Latitude', lng: 'Longitude', tags: 'Tags', acesso: 'Acesso', estacionamento: 'Estacionamento', regras: 'Regras'
};

export function render(container, { nome, params }) {
  const id = params[0];
  const editando = nome === 'editar';
  // Re-renderiza quando o dado muda (ex.: o outro viajante editou do celular dele)
  const cancelar = assinarVarias(['lugares', 'atividades', 'dias', 'comentarios'], () => {
    const l = obter('lugares', id);
    // Não apaga o que a pessoa está digitando (formulário aberto ou observação em edição)
    if (l && editando && container.dataset.formAberto === id) return;
    const ativo = document.activeElement;
    if (!editando && ativo && container.contains(ativo) && ['TEXTAREA', 'INPUT'].includes(ativo.tagName)) return;
    container.innerHTML = '';
    if (!l) {
      container.append(html(`<section class="pagina">${vazio({ emoji: '🤔', titulo: 'Lugar não encontrado', texto: 'Ele pode ter sido apagado pela outra pessoa.', acao: { rotulo: 'Voltar para Lugares', href: '#/lugares' } })}</section>`));
      return;
    }
    container.append(editando ? formulario(l, container) : ficha(l));
  });
  return () => { cancelar(); delete container.dataset.formAberto; };
}

/* ------------------------------ FICHA ------------------------------ */

const linha = (rotulo, valor) => (valor ? `<div class="linha"><span>${rotulo}</span><strong>${valor}</strong></div>` : '');
const indisponivel = '<em class="indisp">indisponível</em>';
const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texto)}</a>`;
const urlSegura = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

function ficha(l) {
  const t = tipoInfo(l.tipo);
  const st = l.status || 'quero-ir';
  const ehRole = ['trilha', 'cachoeira', 'praia'].includes(l.tipo);
  const ehTrilha = ['trilha', 'cachoeira'].includes(l.tipo);
  const ehPouso = ['camping', 'hospedagem'].includes(l.tipo);
  const check = l.checklist || {};
  const comentarios = listar('comentarios').filter((c) => c.lugarId === l.id)
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
  const dias = listar('dias');
  const noRoteiro = listar('atividades').filter((a) => a.lugarId === l.id);
  const zap = l.contato ? l.contato.replace(/\D/g, '').replace(/^55/, '') : '';
  const fone = l.telefone || l.contato;

  const el = html(`<section class="pagina ficha" style="--cor:${t.cor}">
    <a href="#/lugares" class="voltar">${ico('voltar')} Lugares</a>
    <div class="ficha-topo">
      <div class="ficha-topo-linha">
        <span class="ficha-emoji">${t.emoji}</span>
        <div class="ficha-topo-botoes">
          <button class="btn-vidro ${l.favorito ? 'on' : ''}" data-acao="favorito" aria-pressed="${!!l.favorito}" aria-label="Favoritar">${ico('estrela')}</button>
          <button class="btn-vidro" data-acao="compartilhar" aria-label="Compartilhar">${ico('compartilhar')}</button>
        </div>
      </div>
      <h1>${esc(l.nome)}</h1>
      <p class="sub">${esc(t.rotulo)}${l.subtipo && SUBTIPOS[l.subtipo] ? ` · ${esc(SUBTIPOS[l.subtipo].replace(/^\S+\s/, ''))}` : ''}${REGIOES[l.regiao] ? ` · ${esc(REGIOES[l.regiao])}` : ''}</p>
    </div>

    ${precisaCompletar(l) ? '<div class="aviso">✏️ Faltam dados aqui (coordenada ou detalhes). Toque em <b>Editar</b> para completar.</div>' : ''}
    ${(l.tags || []).includes('confirmar-dados') ? '<div class="aviso">ℹ️ Dados vindos de fonte aberta (OpenStreetMap). <b>Confirme preço, horário, reserva e acesso</b> antes de contar com eles.</div>' : ''}

    <div class="chips chips-status" role="group" aria-label="Status">
      ${Object.entries(STATUS).map(([k, v]) => `<button class="chip ${st === k ? 'on' : ''}" data-status="${k}">${v.emoji} ${v.rotulo}</button>`).join('')}
    </div>

    <div class="acoes">
      <button class="btn" data-acao="roteiro">${ico('roteiro')} Pôr no roteiro${noRoteiro.length ? ` (${noRoteiro.length})` : ''}</button>
      ${temCoord(l) ? `<a class="btn btn-sec" href="${linkGoogleMaps(l)}" target="_blank" rel="noopener">🧭 Google Maps</a>
      <a class="btn btn-sec" href="${linkWaze(l)}" target="_blank" rel="noopener">🚙 Waze</a>
      <a class="btn btn-sec" href="#/mapa/lugar/${encodeURIComponent(l.id)}">${ico('mapa')} No mapa</a>` : ''}
      ${urlSegura(l.wikilocUrl) ? `<a class="btn btn-wikiloc" href="${esc(l.wikilocUrl)}" target="_blank" rel="noopener">🥾 Wikiloc</a>` : ''}
      ${zap ? `<a class="btn btn-sec" href="https://wa.me/55${esc(zap)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      ${fone ? `<a class="btn btn-sec" href="tel:${esc(String(fone).replace(/[^\d+]/g, ''))}">📞 Ligar</a>` : ''}
    </div>

    ${l.descricao ? `<p class="descricao">${esc(l.descricao)}</p>` : ''}

    <div class="info">
      <div class="linha"><span>Interesse</span><span class="segmentado-mini" data-prioridade>${[1, 2, 3].map((n) => `<button class="${(l.prioridade || 0) === n ? 'on' : ''}" data-p="${n}">${PRIORIDADES[n]}</button>`).join('')}</span></div>
      ${ehTrilha ? linha('Dificuldade', esc(DIFICULDADES[l.dificuldade] || '')) : ''}
      ${ehTrilha ? linha('Duração', esc(formatarDuracao(l.duracaoMin))) : ''}
      ${ehTrilha ? linha('Distância', l.distanciaKm ? `${esc(l.distanciaKm)} km` : '') : ''}
      ${ehTrilha ? linha('Desnível', l.desnivelM ? `${esc(l.desnivelM)} m` : '') : ''}
      ${linha('Acesso', esc(ACESSOS[l.acesso] || ''))}
      ${linha('Info de acesso', esc(l.acessoInfo))}
      ${linha('Estacionamento', esc(l.estacionamento))}
      ${linha('Precisa guia', l.precisaGuia ? 'Sim' : '')}
      ${linha('Endereço', esc(l.endereco))}
      ${linha('Horário', l.horario ? esc(l.horario) : (['restaurante', 'apoio', 'hospedagem', 'camping'].includes(l.tipo) ? indisponivel : ''))}
      ${linha('Preço/noite', l.precoNoite ? `R$ ${esc(l.precoNoite)}` : '')}
      ${linha('Preço', esc(l.preco))}
      ${ehPouso ? linha('Estrutura', esc(l.estrutura) || indisponivel) : ''}
      ${linha('Regras', esc(l.regras))}
      ${linha('Telefone', l.telefone ? `<a href="tel:${esc(String(l.telefone).replace(/[^\d+]/g, ''))}">${esc(l.telefone)}</a>` : '')}
      ${linha('Contato', esc(l.contato))}
      ${linha('Site', urlSegura(l.site) ? link(l.site, l.site.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)) : '')}
      ${linha('Reserva', l.reservaNecessaria ? '📞 Precisa reservar' : '')}
      ${linha('Posição', temCoord(l) ? (l.coordAprox ? '📍 aproximada' : '📍 conferida') : '❓ sem coordenada')}
      ${linha('Fonte', l.fonte ? (urlSegura(l.fonteUrl) ? link(l.fonteUrl, l.fonte) : esc(l.fonte)) : '')}
      ${urlSegura(l.fotoUrl) ? linha('Foto', link(l.fotoUrl, 'abrir imagem')) : ''}
      ${l.status === 'fui' ? linha('Nota', `<span class="estrelas" data-nota>${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="${(l.nota || 0) >= n ? 'on' : ''}" aria-label="${n} estrelas">★</button>`).join('')}</span>`) : ''}
    </div>

    ${(l.tags || []).length ? `<div class="tags">${l.tags.map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}</div>` : ''}

    ${noRoteiro.length ? `<div class="bloco-simples"><h3>No roteiro</h3>${noRoteiro.map((a) => {
      const d = dias.find((x) => x.id === a.diaId);
      return `<a class="linha-ativ" href="#/roteiro"><span class="linha-hora">${esc(a.horaInicio || '—')}</span><span class="linha-corpo"><b>${esc(d?.titulo || 'Sem dia')}</b><small>${a.confirmada ? 'confirmada' : a.alternativa ? 'plano B' : 'prevista'}</small></span></a>`;
    }).join('')}</div>` : ''}

    <div class="bloco-simples">
      <h3>Minhas observações</h3>
      <textarea class="input" data-obs rows="3" placeholder="Anotações pessoais sobre este lugar (salvam ao sair do campo)">${esc(l.observacoes || '')}</textarea>
    </div>

    ${ehRole ? `<details class="checklist" ${l.tipo === 'trilha' ? 'open' : ''}>
      <summary>🎒 Checklist antes de sair <small>${Object.values(check).filter(Boolean).length}/${Object.keys(CHECKLIST).length}</small></summary>
      ${Object.entries(CHECKLIST).map(([k, v]) => `<label class="check"><input type="checkbox" data-check="${k}" ${check[k] ? 'checked' : ''}/> ${v}</label>`).join('')}
      <button class="btn btn-sm btn-sec" data-acao="zerar-check">Zerar checklist</button>
    </details>` : ''}

    <div class="bloco-simples">
      <h3>Comentários <small>${comentarios.length || ''}</small></h3>
      <div class="comentarios">${comentarios.length ? comentarios.map((c) => `<div class="comentario">
          <div><b>${esc(c.criadoPor || 'Alguém')}</b> <small>${tempoRelativo(c.criadoEm)}</small>
          <button class="icon-btn mini" data-del-com="${esc(c.id)}" aria-label="Apagar comentário">${ico('lixeira')}</button></div>
          <p>${esc(c.texto)}</p></div>`).join('') : '<p class="dica">Nenhum comentário ainda. Use para combinar detalhes com o outro viajante.</p>'}</div>
      <form class="comentar" data-form="comentar">
        <input class="input" name="texto" required placeholder="Escrever um comentário…" autocomplete="off"/>
        <button class="btn" type="submit" aria-label="Enviar">Enviar</button>
      </form>
    </div>

    <p class="dica quem-mexeu">${quemMexeu(l)}</p>

    <div class="acoes acoes-rodape">
      <a class="btn btn-sec" href="#/editar/${encodeURIComponent(l.id)}">✏️ Editar</a>
      <button class="btn btn-sec" data-acao="aqui">📍 Estou aqui (corrigir posição)</button>
    </div>
  </section>`);

  // Favorito / compartilhar
  el.querySelector('[data-acao="favorito"]').addEventListener('click', () => alternarFavorito(l));
  el.querySelector('[data-acao="compartilhar"]').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#/lugar/${encodeURIComponent(l.id)}`;
    const texto = `${l.nome}${temCoord(l) ? ` — ${linkGoogleMaps(l)}` : ''}`;
    if (navigator.share) { try { await navigator.share({ title: l.nome, text: texto, url }); } catch { /* cancelado */ } return; }
    try { await navigator.clipboard.writeText(`${texto}\n${url}`); toast('🔗 Link copiado'); } catch { toast('Não consegui copiar o link'); }
  });
  el.querySelector('[data-acao="roteiro"]').addEventListener('click', () => abrirAdicionarAoRoteiro({ lugarId: l.id, titulo: l.nome }));

  // Status e interesse
  el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    atualizar('lugares', l.id, { status: b.dataset.status });
    toast(`${STATUS[b.dataset.status].emoji} ${STATUS[b.dataset.status].rotulo}`);
  }));
  el.querySelectorAll('[data-prioridade] button').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.p);
    atualizar('lugares', l.id, { prioridade: l.prioridade === n ? 0 : n });
  }));

  // Nota
  el.querySelectorAll('[data-nota] button').forEach((b) => b.addEventListener('click', () => {
    atualizar('lugares', l.id, { nota: Number(b.dataset.n) });
  }));

  // Observações pessoais (salva ao sair do campo; protege contra edição simultânea)
  const obs = el.querySelector('[data-obs]');
  obs.addEventListener('blur', async () => {
    if (obs.value.trim() === (l.observacoes || '').trim()) return;
    const ok = await salvarEdicao('lugares', l.id, l, { observacoes: obs.value.trim() }, ROTULOS);
    if (ok) toast('📝 Observação salva');
  });

  // Checklist
  el.querySelectorAll('[data-check]').forEach((c) => c.addEventListener('change', () => {
    atualizar('lugares', l.id, { checklist: { ...(obter('lugares', l.id).checklist || {}), [c.dataset.check]: c.checked } });
  }));
  el.querySelector('[data-acao="zerar-check"]')?.addEventListener('click', () => atualizar('lugares', l.id, { checklist: {} }));

  // Comentários
  el.querySelector('[data-form="comentar"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = String(new FormData(e.target).get('texto')).trim();
    if (!texto) return;
    adicionar('comentarios', { lugarId: l.id, texto });
    e.target.reset();
  });
  el.querySelectorAll('[data-del-com]').forEach((b) => b.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Apagar comentário?', rotuloOk: 'Apagar', perigo: true })) remover('comentarios', b.dataset.delCom);
  }));

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

/** Atributo que mostra a seção só para certos tipos (atualizado quando o tipo muda). */
const so = (...tipos) => `data-so="${tipos.join(' ')}"`;

function formulario(l, container) {
  container.dataset.formAberto = l.id;
  const el = html(`<section class="pagina">
    <a href="#/lugar/${encodeURIComponent(l.id)}" class="voltar">${ico('voltar')} Cancelar</a>
    <h1>Editar lugar</h1>
    <form class="form">
      <label>Nome<input class="input" name="nome" required value="${esc(l.nome)}"/></label>
      <div class="grid2">
        <label>Tipo<select class="input" name="tipo">${opcoesSelect(TIPOS, l.tipo)}</select></label>
        <label>Região<select class="input" name="regiao">${opcoesSelect(REGIOES, l.regiao, '—')}</select></label>
      </div>
      <label ${so('apoio')}>Que tipo de apoio?<select class="input" name="subtipo">${opcoesSelect(SUBTIPOS, l.subtipo, '—')}</select></label>
      <div class="grid2">
        <label>Status<select class="input" name="status">${opcoesSelect(STATUS, l.status || 'quero-ir')}</select></label>
        <label>Interesse<select class="input" name="prioridade"><option value="0">—</option>${Object.entries(PRIORIDADES).map(([k, v]) => `<option value="${k}" ${Number(l.prioridade) === Number(k) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <label>Descrição / dicas<textarea class="input" name="descricao" rows="3">${esc(l.descricao)}</textarea></label>
      <label>Endereço<input class="input" name="endereco" value="${esc(l.endereco)}"/></label>

      <div ${so('trilha', 'cachoeira')} class="grupo-form">
        <label>Link do Wikiloc<input class="input" name="wikilocUrl" type="url" inputmode="url" placeholder="https://loc.wiki/t/..." value="${esc(l.wikilocUrl)}"/></label>
        <div class="grid2">
          <label>Dificuldade<select class="input" name="dificuldade">${opcoesSelect(DIFICULDADES, l.dificuldade, '—')}</select></label>
          <label>Duração (min)<input class="input" name="duracaoMin" type="number" inputmode="numeric" min="0" value="${l.duracaoMin ?? ''}"/></label>
        </div>
        <div class="grid2">
          <label>Distância (km)<input class="input" name="distanciaKm" type="number" inputmode="decimal" step="0.1" min="0" value="${l.distanciaKm ?? ''}"/></label>
          <label>Desnível (m)<input class="input" name="desnivelM" type="number" inputmode="numeric" min="0" value="${l.desnivelM ?? ''}"/></label>
        </div>
        <label class="check"><input type="checkbox" name="precisaGuia" ${l.precisaGuia ? 'checked' : ''}/> Precisa guia</label>
        <label class="check"><input type="checkbox" name="gpxNoRelogio" ${l.gpxNoRelogio ? 'checked' : ''}/> GPX já está no Amazfit</label>
      </div>

      <div ${so('camping', 'hospedagem')} class="grupo-form">
        <div class="grid2">
          <label>Preço/noite (R$)<input class="input" name="precoNoite" type="number" inputmode="decimal" value="${l.precoNoite ?? ''}"/></label>
          <label>Contato (tel/Whats)<input class="input" name="contato" type="tel" value="${esc(l.contato)}"/></label>
        </div>
        <label>Estrutura (banheiro, chuveiro, energia…)<input class="input" name="estrutura" value="${esc(l.estrutura)}"/></label>
        <label>Regras (silêncio, fogueira, pet…)<textarea class="input" name="regras" rows="2">${esc(l.regras)}</textarea></label>
        <label class="check"><input type="checkbox" name="reservaNecessaria" ${l.reservaNecessaria ? 'checked' : ''}/> Precisa reservar</label>
      </div>

      <div class="grid2">
        <label>Acesso<select class="input" name="acesso">${opcoesSelect(ACESSOS, l.acesso, '—')}</select></label>
        <label>Estacionamento<input class="input" name="estacionamento" value="${esc(l.estacionamento)}" placeholder="Tem? Pago?"/></label>
      </div>
      <label>Informações de acesso<textarea class="input" name="acessoInfo" rows="2" placeholder="Estrada de terra, barco, horário do último retorno…">${esc(l.acessoInfo)}</textarea></label>
      <div class="grid2">
        <label>Preço / entrada<input class="input" name="preco" value="${esc(l.preco)}" placeholder="Ex.: grátis, R$ 20"/></label>
        <label>Horário<input class="input" name="horario" value="${esc(l.horario)}" placeholder="Ex.: 8h–18h"/></label>
      </div>
      <div class="grid2">
        <label>Telefone<input class="input" name="telefone" type="tel" value="${esc(l.telefone)}"/></label>
        <label>Site<input class="input" name="site" type="url" inputmode="url" value="${esc(l.site)}"/></label>
      </div>
      <div class="grid2">
        <label>Latitude<input class="input" name="lat" type="number" inputmode="decimal" step="any" value="${l.lat ?? ''}"/></label>
        <label>Longitude<input class="input" name="lng" type="number" inputmode="decimal" step="any" value="${l.lng ?? ''}"/></label>
      </div>
      <p class="dica">Dica: no Google Maps, segure o dedo no lugar e copie as coordenadas. Ou use “Estou aqui” na ficha quando chegar.</p>
      <div class="grid2">
        <label>Link da fonte<input class="input" name="fonteUrl" type="url" inputmode="url" value="${esc(l.fonteUrl)}"/></label>
        <label>Link de uma foto<input class="input" name="fotoUrl" type="url" inputmode="url" value="${esc(l.fotoUrl)}"/></label>
      </div>
      <label>Tags (separadas por vírgula)<input class="input" name="tags" value="${esc((l.tags || []).join(', '))}"/></label>
      <label class="check"><input type="checkbox" name="coordAprox" ${l.coordAprox ? 'checked' : ''}/> Posição aproximada</label>
      <button class="btn btn-grande" type="submit">💾 Salvar</button>
      <button class="btn btn-perigo" type="button" data-acao="apagar">🗑️ Apagar lugar</button>
    </form>
  </section>`);

  const form = el.querySelector('form');
  const mostrarPorTipo = () => {
    const tipo = form.elements.tipo.value;
    el.querySelectorAll('[data-so]').forEach((s) => { s.hidden = !s.dataset.so.split(' ').includes(tipo); });
  };
  form.elements.tipo.addEventListener('change', mostrarPorTipo);
  mostrarPorTipo();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) ?? '').trim();
    const num = (k) => { const v = fd.get(k); return v === '' || v === null ? null : Number(v); };
    const tags = txt('tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
    const lat = num('lat');
    const lng = num('lng');
    const tipo = fd.get('tipo');
    const dados = {
      nome: txt('nome'),
      tipo,
      subtipo: tipo === 'apoio' ? (fd.get('subtipo') || '') : '',
      regiao: fd.get('regiao') || '',
      status: fd.get('status'),
      prioridade: Number(fd.get('prioridade')) || 0,
      descricao: txt('descricao'),
      endereco: txt('endereco'),
      wikilocUrl: txt('wikilocUrl'),
      dificuldade: fd.get('dificuldade') || null,
      acesso: fd.get('acesso') || null,
      duracaoMin: num('duracaoMin'),
      distanciaKm: num('distanciaKm'),
      desnivelM: num('desnivelM'),
      lat, lng,
      precoNoite: num('precoNoite'),
      contato: txt('contato'),
      estrutura: txt('estrutura'),
      regras: txt('regras'),
      estacionamento: txt('estacionamento'),
      acessoInfo: txt('acessoInfo'),
      preco: txt('preco'),
      horario: txt('horario'),
      telefone: txt('telefone'),
      site: txt('site'),
      fonteUrl: txt('fonteUrl'),
      fotoUrl: txt('fotoUrl'),
      tags: Number.isFinite(lat) && Number.isFinite(lng) && !l.nome.includes('(renomear)') ? tags.filter((t) => t !== 'completar') : tags,
      reservaNecessaria: fd.has('reservaNecessaria'),
      precisaGuia: fd.has('precisaGuia'),
      gpxNoRelogio: fd.has('gpxNoRelogio'),
      coordAprox: fd.has('coordAprox')
    };
    // Só os campos do tipo visível entram na comparação (o resto fica como está)
    const base = { ...l, subtipo: l.subtipo || '' };
    const ok = await salvarEdicao('lugares', l.id, base, dados, ROTULOS);
    if (!ok) return;
    delete container.dataset.formAberto;
    toast('💾 Salvo!');
    location.hash = `#/lugar/${encodeURIComponent(l.id)}`;
  });

  el.querySelector('[data-acao="apagar"]').addEventListener('click', async () => {
    const usos = listar('atividades').filter((a) => a.lugarId === l.id).length;
    const ok = await confirmar({
      titulo: `Apagar “${l.nome}”?`,
      texto: usos ? `Ele está em ${usos} atividade(s) do roteiro; elas continuam com o nome, só perdem o vínculo. Não dá para desfazer.` : 'Não dá para desfazer.',
      rotuloOk: 'Apagar lugar',
      perigo: true
    });
    if (!ok) return;
    listar('comentarios').filter((c) => c.lugarId === l.id).forEach((c) => remover('comentarios', c.id));
    await remover('lugares', l.id);
    delete container.dataset.formAberto;
    toast('🗑️ Apagado');
    location.hash = '#/lugares';
  });

  return el;
}
