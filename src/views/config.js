// ⚙️ Config: login, nomes da dupla, importar seed, migrar dados locais, backup.
import { firebaseAtivo, entrarComGoogle, sair } from '../firebase.js';
import {
  getModo, carregarSeed, importarLugares, exportarTudo, dadosLocais, adicionar, atualizar, obter, assinar
} from '../store.js';
import { pessoas } from './gastos.js';
import { esc, html, toast } from '../ui.js';

export function render(container) {
  const desenhar = () => {
    container.innerHTML = '';
    const user = window.__usuario;
    const modo = getModo();
    const [a, b] = pessoas();
    const el = html(`<section class="pagina">
      <h1>⚙️ Config</h1>

      <div class="card-config">
        <h3>☁️ Sincronização</h3>
        ${!firebaseAtivo
          ? `<p><b>Modo local</b>: os dados ficam só neste celular.</p>
             <p class="dica">Pra sincronizar entre os dois, preencha <code>src/firebase-config.js</code> com a config do Firebase e publique de novo.</p>`
          : user
            ? `<p>✅ Logado como <b>${esc(user.email)}</b>. Modo: <b>${modo === 'nuvem' ? 'nuvem (sincronizando)' : 'local'}</b>.</p>
               <button class="btn btn-sec" data-acao="sair">Sair</button>`
            : `<p>Entra com o Google pra sincronizar com o parça. Sem login, fica em modo local.</p>
               <button class="btn" data-acao="entrar">🔐 Entrar com Google</button>`}
      </div>

      <div class="card-config">
        <h3>👥 A dupla</h3>
        <form class="form" data-form="pessoas">
          <div class="grid2">
            <label>Pessoa 1<input class="input" name="a" value="${esc(a)}"/></label>
            <label>Pessoa 2<input class="input" name="b" value="${esc(b)}"/></label>
          </div>
          <button class="btn btn-sec" type="submit">Salvar nomes</button>
        </form>
      </div>

      <div class="card-config">
        <h3>📦 Dados</h3>
        <button class="btn btn-sec" data-acao="seed">🌱 Importar lista inicial (seed)</button>
        <p class="dica">Só adiciona o que ainda não existe — pode tocar sem medo.</p>
        ${firebaseAtivo && user ? `<button class="btn btn-sec" data-acao="migrar">⬆️ Subir dados do modo local pra nuvem</button>` : ''}
        <button class="btn btn-sec" data-acao="backup">💾 Baixar backup (JSON)</button>
      </div>

      <p class="dica rodape">Rolê Costa Verde · v${__APP_VERSION__}</p>
    </section>`);
    container.append(el);

    el.querySelector('[data-acao="entrar"]')?.addEventListener('click', async () => {
      try { await entrarComGoogle(); } catch (e) { toast(`Não rolou o login: ${e.code || e.message}`); }
    });
    el.querySelector('[data-acao="sair"]')?.addEventListener('click', () => sair());

    el.querySelector('[data-form="pessoas"]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const dados = { a: String(fd.get('a')).trim() || 'Eu', b: String(fd.get('b')).trim() || 'Parça' };
      if (obter('config', 'pessoas')) atualizar('config', 'pessoas', dados);
      else adicionar('config', dados, 'pessoas');
      toast('👥 Nomes salvos');
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
