// Ponte entre as telas e a IA gratuita (Gemini): usa a chave das Configurações, troca de modelo sozinha
// se o escolhido sumir e conta o uso do dia (só informativo; o limite de verdade é o do plano gratuito).
import { gerar, testarChave, ErroIA, MENSAGENS_ERRO } from './lib/gemini.js';
import { chaveGemini, modeloGemini, salvarIntegracoes } from './integracoes.js';

export const iaAtiva = () => Boolean(chaveGemini());

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function usoDeHoje() {
  try {
    const r = JSON.parse(localStorage.getItem('role:ia-uso') || '{}');
    return r.dia === hojeISO() ? r.n : 0;
  } catch { return 0; }
}

function registrarUso() {
  try { localStorage.setItem('role:ia-uso', JSON.stringify({ dia: hojeISO(), n: usoDeHoje() + 1 })); } catch { /* ok */ }
}

/**
 * @param {{sistema:string, mensagens:Array<{papel:string,texto:string}>, json?:boolean, web?:boolean, signal?:AbortSignal}} p
 * @returns {Promise<{texto:string, fontes:Array, buscas:string[], cortada:boolean, modelo:string}>}
 */
export async function perguntarIA({ sistema, mensagens, json = false, web = false, signal }) {
  const chave = chaveGemini();
  if (!chave) throw new ErroIA('chave', 'Sem chave');
  let modelo = modeloGemini();
  try {
    const r = await gerar({ chave, modelo, sistema, mensagens, json, web, signal });
    registrarUso();
    return r;
  } catch (e) {
    if (e.tipo !== 'modelo') throw e;
    // o modelo guardado deixou de existir: escolhe outro da lista da própria API e tenta uma vez mais
    const { escolhido } = await testarChave(chave, { signal });
    if (!escolhido || escolhido === modelo) throw e;
    await salvarIntegracoes({ geminiModelo: escolhido });
    modelo = escolhido;
    const r = await gerar({ chave, modelo, sistema, mensagens, json, web, signal });
    registrarUso();
    return r;
  }
}

export const mensagemDoErro = (e) => MENSAGENS_ERRO[e?.tipo] || MENSAGENS_ERRO.falha;
