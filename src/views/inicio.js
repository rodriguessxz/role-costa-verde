// 🏠 Início: central de controle da aventura. Tudo aqui vem dos dados reais da viagem.
import { assinarVarias, listar, adicionar } from '../store.js';
import { getViagem } from '../viagem.js';
import { ico } from '../icons.js';
import { esc, html, toast, tipoInfo, STATUS, TIPOS, vazio, abrirModal, contarCurtidas } from '../ui.js';
import { diasAte, dataCurta, tempoRelativo } from '../lib/tempo.js';
import { ordenarDias, atividadesDoDia } from '../lib/roteiro.js';

const PENDENTES = ['ideia', 'avaliar', 'quero-ir', 'planejado'];

function periodo(v) {
  if (!v.inicio) return 'Datas ainda não definidas';
  const n = diasAte(v.inicio);
  const fim = v.fim ? ` → ${dataCurta(v.fim)}` : '';
  const quando = n > 1 ? `faltam ${n} dias` : n === 1 ? 'começa amanhã' : n === 0 ? 'começa hoje' : '';
  return `${dataCurta(v.inicio)}${fim}${quando ? ` · ${quando}` : ''}`;
}

/** Próximas atividades ainda não feitas, na ordem do roteiro. */
function proximas(dias, atividades, lugares) {
  const lugar = (a) => lugares.find((l) => l.id === a.lugarId);
  const saida = [];
  for (const d of ordenarDias(dias)) {
    for (const a of atividadesDoDia(atividades, d.id)) {
      if (a.feito || a.alternativa) continue;
      saida.push({ a, dia: d, lugar: lugar(a) });
    }
  }
  return saida.slice(0, 4);
}

const cartaoLugar = (l) => {
  const t = tipoInfo(l.tipo);
  return `<a class="mini-card" href="#/lugar/${encodeURIComponent(l.id)}" style="--cor:${t.cor}">
    <span class="mini-emoji">${t.emoji}</span>
    <b>${esc(l.nome)}</b>
    <small>${STATUS[l.status || 'quero-ir']?.emoji || ''} ${esc(STATUS[l.status || 'quero-ir']?.rotulo || '')}</small>
  </a>`;
};

function desenhar(el) {
  const v = getViagem();
  const lugares = listar('lugares');
  const dias = listar('dias');
  const atividades = listar('atividades');
  const notas = [...listar('notas')].sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
  const ideias = listar('ideias');
  const itens = listar('itens');
  const nome = (window.__usuario?.displayName || '').split(' ')[0];

  const favoritos = lugares.filter((l) => l.favorito && l.status !== 'descartado');
  const querer = lugares.filter((l) => PENDENTES.includes(l.status || 'quero-ir'))
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || Number(!!b.favorito) - Number(!!a.favorito));
  const confirmados = lugares.filter((l) => ['planejado', 'confirmado'].includes(l.status)).length;
  const feitosCheck = itens.filter((i) => i.feito).length;
  const reservasPendentes = lugares.filter((l) => l.tipo === 'camping' && l.reservaNecessaria && !['confirmado', 'fui', 'descartado'].includes(l.status)).length;
  const ideiasPendentes = ideias.filter((i) => ['nova', 'avaliando'].includes(i.status || 'nova'));
  const prox = proximas(dias, atividades, lugares);
  const porTipo = Object.entries(TIPOS)
    .map(([k, t]) => ({ k, t, n: lugares.filter((l) => l.tipo === k && l.status !== 'descartado').length }))
    .filter((x) => x.n);

  el.innerHTML = `
    <section class="hero-viagem">
      <div class="hero-viagem-arte" aria-hidden="true">${ico('onda')}</div>
      <p class="hero-etiqueta">${nome ? `Oi, ${esc(nome)} · ` : ''}painel da aventura</p>
      <h1>${esc(v.nome)}</h1>
      <p class="hero-rota"><span>${esc(v.roteiro || 'Ubatuba ⇄ Paraty')}</span></p>
      <p class="hero-periodo">${ico('relogio')} ${esc(periodo(v))}</p>
    </section>

    <section class="atalhos" aria-label="Atalhos">
      <a class="atalho" href="#/novo"><span>${ico('lugares')}</span>Lugar</a>
      <a class="atalho" href="#/roteiro/nova"><span>${ico('roteiro')}</span>Atividade</a>
      <button class="atalho" data-acao="ideia"><span>${ico('ideias')}</span>Ideia</button>
      <a class="atalho" href="#/mapa"><span>${ico('mapa')}</span>Mapa</a>
    </section>

    <section class="bloco">
      <div class="bloco-cab"><h2>Roteiro</h2><a href="#/roteiro">Abrir</a></div>
      ${prox.length
        ? `<div class="lista-simples">${prox.map(({ a, dia, lugar }) => {
          const t = lugar ? tipoInfo(lugar.tipo) : null;
          return `<a class="linha-ativ" href="#/roteiro">
            <span class="linha-hora">${esc(a.horaInicio || '—')}</span>
            <span class="linha-corpo"><b>${t ? `${t.emoji} ` : ''}${esc(a.titulo || lugar?.nome || 'Atividade')}</b>
            <small>${esc(dia.titulo || 'Dia')}${dia.data ? ` · ${dataCurta(dia.data)}` : ''}${a.confirmada ? ' · confirmada' : ''}</small></span></a>`;
        }).join('')}</div>`
        : vazio({ emoji: '🧭', titulo: 'Roteiro ainda em branco', texto: 'Sem pressa: crie um dia ou uma etapa e vá encaixando lugares conforme decidirem.', acao: { rotulo: 'Começar o roteiro', href: '#/roteiro' } })}
    </section>

    <section class="bloco">
      <div class="bloco-cab"><h2>Organização</h2></div>
      <div class="indicadores">
        <a class="indicador" href="#/lugares"><b>${lugares.length}</b><span>lugares salvos</span><small>${confirmados} planejados ou confirmados</small></a>
        <a class="indicador" href="#/roteiro"><b>${atividades.length}</b><span>atividades</span><small>em ${dias.length} ${dias.length === 1 ? 'dia' : 'dias'}</small></a>
        <a class="indicador" href="#/checklist"><b>${itens.length ? `${feitosCheck}/${itens.length}` : '—'}</b><span>itens prontos</span>
          <i class="barra"><u style="width:${itens.length ? Math.round((feitosCheck / itens.length) * 100) : 0}%"></u></i></a>
        <a class="indicador ${reservasPendentes ? 'alerta' : ''}" href="#/lugares/tipo/camping"><b>${reservasPendentes}</b><span>reservas de camping</span><small>${reservasPendentes ? 'a confirmar' : 'nada pendente'}</small></a>
      </div>
    </section>

    <section class="bloco">
      <div class="bloco-cab"><h2>Queremos conhecer</h2><a href="#/lugares">Ver todos</a></div>
      ${querer.length
        ? `<div class="carrossel">${querer.slice(0, 8).map(cartaoLugar).join('')}</div>`
        : vazio({ emoji: '📍', titulo: 'Nenhum lugar na lista ainda', texto: 'Explore a região ou adicione um lugar para começar a biblioteca da viagem.', acao: { rotulo: 'Explorar lugares', href: '#/explorar' } })}
    </section>

    ${favoritos.length ? `<section class="bloco">
      <div class="bloco-cab"><h2>Favoritos</h2></div>
      <div class="carrossel">${favoritos.slice(0, 8).map(cartaoLugar).join('')}</div>
    </section>` : ''}

    ${porTipo.length ? `<section class="bloco">
      <div class="bloco-cab"><h2>Salvos por tipo</h2></div>
      <div class="chips chips-quebra">${porTipo.map(({ k, t, n }) => `<a class="chip" href="#/lugares/tipo/${k}">${t.emoji} ${t.rotulo} <b>${n}</b></a>`).join('')}</div>
    </section>` : ''}

    <div class="duas-colunas">
      <section class="bloco">
        <div class="bloco-cab"><h2>Ideias em aberto</h2><a href="#/ideias">Ver</a></div>
        ${ideiasPendentes.length
          ? `<div class="lista-simples">${ideiasPendentes.slice(0, 3).map((i) => `<a class="linha-ativ" href="#/ideias"><span class="linha-hora">💡</span>
              <span class="linha-corpo"><b>${esc(i.titulo)}</b><small>${esc(i.criadoPor || '')}${contarCurtidas(i.curtidas) ? ` · 👍 ${contarCurtidas(i.curtidas)}` : ''}</small></span></a>`).join('')}</div>`
          : vazio({ emoji: '💡', titulo: 'Sem ideias pendentes', texto: 'Anote aqui qualquer rolê que passar pela cabeça. Depois vocês decidem.', acao: { rotulo: 'Registrar ideia', id: 'ideia' } })}
      </section>
      <section class="bloco">
        <div class="bloco-cab"><h2>Anotações recentes</h2><a href="#/notas">Ver</a></div>
        ${notas.length
          ? `<div class="lista-simples">${notas.slice(0, 3).map((n) => `<a class="linha-ativ" href="#/notas"><span class="linha-hora">${ico('notas')}</span>
              <span class="linha-corpo"><b>${esc(n.titulo || String(n.texto || '').slice(0, 40) || 'Sem título')}</b><small>${tempoRelativo(n.atualizadoEm)}${n.atualizadoPor ? ` · ${esc(n.atualizadoPor)}` : ''}</small></span></a>`).join('')}</div>`
          : vazio({ emoji: '📝', titulo: 'Nenhuma anotação', texto: 'Dicas de acesso, horários de barco, telefones: tudo num lugar só.', acao: { rotulo: 'Abrir anotações', href: '#/notas' } })}
      </section>
    </div>

    <a class="faixa-roleta" href="#/roleta"><span>${ico('dado')}</span><div><b>Sem plano pra agora?</b><small>Gire a roleta e deixe o rolê escolher.</small></div></a>`;

  el.querySelectorAll('[data-acao="ideia"], [data-vazio="ideia"]').forEach((b) => b.addEventListener('click', ideiaRapida));
}

/** Registrar uma ideia em 2 campos. */
function ideiaRapida() {
  const { el, fechar } = abrirModal({
    titulo: 'Nova ideia',
    corpo: `<form class="form">
      <label>O que você teve em mente?<input class="input" name="titulo" required placeholder="Ex.: nascer do sol na Praia do Sono" autocomplete="off"/></label>
      <label>Detalhes (opcional)<textarea class="input" name="descricao" rows="3" placeholder="Quem indicou, como chegar, por que vale a pena…"></textarea></label>
      <button class="btn btn-grande" type="submit">Salvar ideia</button></form>`
  });
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    adicionar('ideias', { titulo: String(fd.get('titulo')).trim(), descricao: String(fd.get('descricao')).trim(), status: 'nova', curtidas: {}, tags: [] });
    fechar();
    toast('💡 Ideia registrada');
  });
}

export function render(container) {
  const el = html('<section class="pagina inicio"></section>');
  container.append(el);
  return assinarVarias(['lugares', 'dias', 'atividades', 'notas', 'ideias', 'itens', 'config'], () => desenhar(el));
}
