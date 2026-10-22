// ⚙️ Configurações: viagem, dupla, conta/sessão, dados e o que funciona offline.
import { firebaseAtivo, sair } from '../firebase.js';
import {
  getModo, carregarSeed, importarLugares, exportarTudo, dadosLocais, adicionar, atualizar, obter, assinar, statusSync
} from '../store.js';
import { getViagem, nomesDupla, euSou, definirEuSou } from '../viagem.js';
import { confirmar, esc, html, toast } from '../ui.js';

export function render(container) {
  const desenhar = () => {
    container.innerHTML = '';
    const user = window.__usuario;
    const modo = getModo();
    const { a, b } = nomesDupla();
    const v = getViagem();
    const s = statusSync();
    const eu = euSou();
    const el = html(`<section class="pagina">
      <h1>Configurações</h1>

      <div class="card-config">
        <h3>🧳 A viagem</h3>
        <form class="form" data-form="viagem">
          <label>Nome da viagem<input class="input" name="nome" value="${esc(v.nome)}" required/></label>
          <label>Trajeto<input class="input" name="roteiro" value="${esc(v.roteiro)}" placeholder="Ubatuba ⇄ Paraty"/></label>
          <div class="grid2">
            <label>Início<input class="input" type="date" name="inicio" value="${esc(v.inicio)}"/></label>
            <label>Fim<input class="input" type="date" name="fim" value="${esc(v.fim)}"/></label>
          </div>
          <button class="btn btn-sec" type="submit">Salvar viagem</button>
        </form>
      </div>

      <div class="card-config">
        <h3>👥 A dupla</h3>
        <form class="form" data-form="pessoas">
          <div class="grid2">
            <label>Pessoa 1<input class="input" name="a" value="${esc(a)}"/></label>
            <label>Pessoa 2<input class="input" name="b" value="${esc(b)}"/></label>
          </div>
          <label>Quem usa este aparelho?<select class="input" name="eu">
            <option value="a" ${eu === 'a' ? 'selected' : ''}>${esc(a)}</option><option value="b" ${eu === 'b' ? 'selected' : ''}>${esc(b)}</option></select></label>
          <button class="btn btn-sec" type="submit">Salvar</button>
        </form>
        <p class="dica">Os nomes aparecem no racha de gastos e nas responsabilidades do checklist.</p>
      </div>

      <div class="card-config">
        <h3>🔐 Conta e acesso</h3>
        ${!firebaseAtivo
          ? `<p><b>Modo local</b>: os dados ficam só neste aparelho e não há login.</p>
             <p class="dica">Para ter login e sincronizar entre os dois, preencha <code>src/firebase-config.js</code> e publique de novo.</p>`
          : `<p>Logado como <b>${esc(user?.email || '—')}</b>. Modo: <b>${modo === 'nuvem' ? 'nuvem (sincronizando)' : 'local'}</b>.</p>
             <p class="dica">Sincronização: ${s.falhas ? '⚠️ houve falha ao salvar' : s.pendentes ? `${s.pendentes} alteração(ões) aguardando envio` : s.online ? 'tudo enviado' : 'offline — alterações ficam neste aparelho e sobem depois'}.</p>
             <button class="btn btn-sec" data-acao="sair">Sair e limpar dados deste aparelho</button>
             <p class="dica"><b>Quem pode entrar:</b> só os e-mails listados em <code>firestore.rules</code> (um para cada viajante).
             Para trocar alguém, edite a lista e rode <code>firebase deploy --only firestore:rules</code>. A regra vale no servidor: digitar uma URL não dá acesso.</p>`}
      </div>

      <div class="card-config">
        <h3>📦 Dados</h3>
        <button class="btn btn-sec" data-acao="seed">🌱 Importar lista inicial de lugares</button>
        <p class="dica">Só adiciona o que ainda não existe — pode tocar sem medo.</p>
        ${firebaseAtivo && user ? '<button class="btn btn-sec" data-acao="migrar">⬆️ Subir dados do modo local para a nuvem</button>' : ''}
        <button class="btn btn-sec" data-acao="backup">💾 Baixar backup (JSON)</button>
      </div>

      <div class="card-config">
        <h3>📶 O que funciona sem internet</h3>
        <p class="dica"><b>Funciona:</b> abrir o app depois da primeira visita; consultar lugares, roteiro, anotações, ideias e checklists já sincronizados; criar e editar tudo (fica pendente e sobe quando o sinal volta).</p>
        <p class="dica"><b>Precisa de internet:</b> Explorar, busca por nome, cálculo de rota, login e mapa (só os trechos já vistos ficam em cache).</p>
        <p class="dica">O chip no topo mostra se está sincronizado, enviando, offline ou com falha.</p>
      </div>

      <p class="dica rodape">Rolê Costa Verde · v${__APP_VERSION__}</p>
    </section>`);
    container.append(el);

    el.querySelector('[data-acao="sair"]')?.addEventListener('click', async () => {
      const pend = statusSync().pendentes;
      const ok = await confirmar({
        titulo: 'Sair deste aparelho?',
        texto: pend ? `Há ${pend} alteração(ões) que ainda não foram enviadas e elas serão perdidas. Conecte-se e aguarde o envio antes de sair.` : 'Os dados da viagem serão apagados deste aparelho (continuam salvos na nuvem).',
        rotuloOk: 'Sair', perigo: true
      });
      if (ok) sair();
    });

    el.querySelector('[data-form="viagem"]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const dados = { nome: String(fd.get('nome')).trim(), roteiro: String(fd.get('roteiro')).trim(), inicio: fd.get('inicio') || '', fim: fd.get('fim') || '' };
      if (obter('config', 'viagem')) atualizar('config', 'viagem', dados);
      else adicionar('config', dados, 'viagem');
      toast('🧳 Viagem salva');
    });

    el.querySelector('[data-form="pessoas"]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const dados = { a: String(fd.get('a')).trim() || 'Eu', b: String(fd.get('b')).trim() || 'Parça' };
      if (obter('config', 'pessoas')) atualizar('config', 'pessoas', dados);
      else adicionar('config', dados, 'pessoas');
      definirEuSou(fd.get('eu'));
      toast('👥 Salvo');
    });

    el.querySelector('[data-acao="seed"]').addEventListener('click', async () => {
      try {
        const n = await importarLugares(await carregarSeed());
        toast(n ? `🌱 ${n} lugares importados` : 'Tudo do seed já está aqui 👍');
      } catch { toast('Não consegui ler o seed (offline?)'); }
    });

    el.querySelector('[data-acao="migrar"]')?.addEventListener('click', async () => {
      const locais = dadosLocais();
      const n = await importarLugares(locais.lugares);
      for (const g of locais.gastos) if (!obter('gastos', g.id)) adicionar('gastos', g, g.id);
      toast(`⬆️ ${n} lugares e ${locais.gastos.length} gastos enviados`);
    });

    el.querySelector('[data-acao="backup"]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(exportarTudo(), null, 2)], { type: 'application/json' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob);
      a2.download = `role-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a2.click();
      URL.revokeObjectURL(a2.href);
    });
  };

  desenhar();
  const onUser = () => desenhar();
  window.addEventListener('usuario-mudou', onUser);
  const cancelar = assinar('config', () => {
    // Não redesenha se a pessoa está digitando
    if (!container.contains(document.activeElement) || document.activeElement === document.body) desenhar();
  });
  return () => { window.removeEventListener('usuario-mudou', onUser); cancelar(); };
}
