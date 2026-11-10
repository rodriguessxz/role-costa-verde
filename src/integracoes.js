// Chaves das integrações opcionais (IA gratuita e Google Places). Ficam em config/integracoes:
// no Firestore elas só são legíveis pelos 2 e-mails autorizados, e valem para os dois aparelhos.
// Nunca vão para o repositório nem para a IA.
import { obter, adicionar, atualizar } from './store.js';
import { MODELO_PADRAO } from './lib/gemini.js';

export const getIntegracoes = () => obter('config', 'integracoes') || {};
export const chaveGemini = () => String(getIntegracoes().geminiKey || '').trim();
export const modeloGemini = () => String(getIntegracoes().geminiModelo || MODELO_PADRAO);
export const chavePlaces = () => String(getIntegracoes().placesKey || '').trim();
export const guardarDadosGoogle = () => getIntegracoes().guardarDadosGoogle !== false;

export async function salvarIntegracoes(parcial) {
  if (obter('config', 'integracoes')) await atualizar('config', 'integracoes', parcial);
  else await adicionar('config', parcial, 'integracoes');
}

/** "AIza…x7Qk" para mostrar sem expor a chave inteira. */
export const mascarar = (chave) => (chave ? `${chave.slice(0, 4)}…${chave.slice(-4)}` : '');
