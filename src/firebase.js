// Inicialização do Firebase (só acontece se a config estiver preenchida).
// Firestore com cache persistente em IndexedDB: funciona offline e sincroniza
// sozinho quando o sinal volta.
import { firebaseConfig } from './firebase-config.js';

export const firebaseAtivo = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let _db = null;
let _auth = null;
let _fs = null; // módulo firestore (import dinâmico pra não pesar no modo local)
let _authMod = null;

/** Carrega e inicializa o Firebase sob demanda. */
export async function iniciarFirebase() {
  if (!firebaseAtivo) return null;
  if (_db) return { db: _db, auth: _auth, fs: _fs, authMod: _authMod };

  const { initializeApp } = await import('firebase/app');
  _fs = await import('firebase/firestore');
  _authMod = await import('firebase/auth');

  const app = initializeApp(firebaseConfig);
  _db = _fs.initializeFirestore(app, {
    localCache: _fs.persistentLocalCache({
      tabManager: _fs.persistentMultipleTabManager()
    })
  });
  _auth = _authMod.getAuth(app);
  _auth.languageCode = 'pt';
  return { db: _db, auth: _auth, fs: _fs, authMod: _authMod };
}

/** Login com Google: popup no desktop, redirect como fallback (PWA no celular). */
export async function entrarComGoogle() {
  const { auth, authMod } = await iniciarFirebase();
  const provider = new authMod.GoogleAuthProvider();
  try {
    await authMod.signInWithPopup(auth, provider);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment',
         'auth/cancelled-popup-request'].includes(e.code)) {
      await authMod.signInWithRedirect(auth, provider);
    } else {
      throw e;
    }
  }
}

/**
 * Encerra a sessão e apaga o cache offline deste aparelho (os dados da viagem não
 * ficam guardados no celular de quem saiu). Recarrega o app no fim.
 */
export async function sair() {
  const { db, auth, fs, authMod } = await iniciarFirebase();
  await authMod.signOut(auth);
  try {
    await fs.terminate(db);
    await fs.clearIndexedDbPersistence(db);
  } catch (e) {
    console.warn('[firebase] não consegui limpar o cache local', e);
  }
  location.reload();
}

/** Observa o usuário logado. cb(user|null) */
export async function observarUsuario(cb) {
  if (!firebaseAtivo) { cb(null); return () => {}; }
  const { auth, authMod } = await iniciarFirebase();
  return authMod.onAuthStateChanged(auth, cb);
}
