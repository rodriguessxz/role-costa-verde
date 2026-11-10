// Atualização do app (PWA) à prova de falha.
// Três proteções, porque um app instalado pode ficar "preso" numa versão antiga:
//  1. o service worker se atualiza sozinho (ao abrir, ao voltar pro app e a cada 30 min);
//  2. /version.json (sempre da rede) diz qual é a versão publicada; se for diferente da carregada, avisamos;
//  3. "Forçar atualização" apaga o cache do app (não apaga os dados da viagem) e recarrega.
import { registerSW } from 'virtual:pwa-register';

/** Compilação que está rodando agora: { em: ISO, sha }. */
export const BUILD_ATUAL = __APP_BUILD__;

const BASE = import.meta.env.BASE_URL;
let registro = null;
let atualizarSW = null;
const tinhaControlador = Boolean(navigator.serviceWorker?.controller);

/** Busca /version.json na rede e compara com a compilação carregada. Resolve 'atual' | 'nova' | 'erro'. */
export async function verificarVersaoPublicada() {
  try {
    const r = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return 'erro';
    const publicada = await r.json();
    if (import.meta.env.DEV) return 'atual';
    return publicada.em && publicada.em !== BUILD_ATUAL.em ? 'nova' : 'atual';
  } catch {
    return 'erro';
  }
}

/**
 * @param {{ aoOffline?: () => void, aoNovaVersao?: () => void }} ganchos
 */
export function iniciarAtualizacao({ aoOffline, aoNovaVersao } = {}) {
  atualizarSW = registerSW({
    immediate: true,
    onOfflineReady: aoOffline,
    onNeedRefresh: () => aoNovaVersao?.(),
    onRegisteredSW: (_url, r) => { registro = r || null; }
  });

  // um novo service worker assumiu o controle: o que está na tela já é antigo
  navigator.serviceWorker?.addEventListener('controllerchange', () => { if (tinhaControlador) aoNovaVersao?.(); });

  const checar = async () => {
    registro?.update().catch(() => {});
    if (await verificarVersaoPublicada() === 'nova') aoNovaVersao?.();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checar(); });
  setInterval(checar, 30 * 60 * 1000);
  setTimeout(checar, 4000);
}

/** Recarrega já com a versão nova (o service worker novo assume e a página reinicia). */
export function aplicarAtualizacao() {
  if (atualizarSW) atualizarSW(true).catch(() => {});
  setTimeout(() => location.reload(), 600);
}

/** Botão "Buscar atualização": resolve 'nova' (já pronta pra aplicar) | 'atual' | 'erro'. */
export async function buscarAtualizacao() {
  try { await registro?.update(); } catch { /* sem rede */ }
  return verificarVersaoPublicada();
}

/**
 * Último recurso: apaga os caches do app e o service worker e recarrega.
 * NÃO mexe nos dados da viagem (ficam no banco do Firebase e no armazenamento do aparelho).
 */
export async function forcarAtualizacao() {
  try {
    const registros = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(registros.map((r) => r.unregister()));
    const chaves = await caches?.keys?.() || [];
    await Promise.all(chaves.map((k) => caches.delete(k)));
  } catch (e) {
    console.warn('[atualizacao] não consegui limpar tudo', e);
  }
  location.reload();
}
