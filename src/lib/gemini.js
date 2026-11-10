// Cliente da API Gemini (Google AI Studio) — a opção de IA GRATUITA: só pede uma chave grátis, sem cartão.
// Partes puras (montar pedido, ler resposta, classificar erro, escolher modelo) separadas do fetch para testar.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const MODELO_PADRAO = 'gemini-2.5-flash';

/** Erro com `.tipo`: 'chave' | 'limite' | 'modelo' | 'bloqueio' | 'rede' | 'offline' | 'falha'. */
export class ErroIA extends Error {
  constructor(tipo, mensagem) { super(mensagem); this.tipo = tipo; }
}

/** Mensagem amigável por tipo de erro. */
export const MENSAGENS_ERRO = {
  chave: 'A chave da IA não foi aceita. Confira em Configurações → Integrações.',
  limite: 'O limite gratuito da IA foi atingido por agora. Espere um pouco e tente de novo (o limite zera ao longo do dia).',
  modelo: 'O modelo escolhido não está disponível. Toque em “Testar chave” em Configurações para o app escolher outro.',
  bloqueio: 'A IA recusou responder a esse pedido. Reformule e tente de novo.',
  offline: 'Sem internet. A IA precisa de conexão.',
  rede: 'Não consegui falar com a IA agora. Tente de novo em instantes.',
  falha: 'A IA deu um erro inesperado. Tente de novo.'
};

/**
 * Escolhe o melhor modelo "flash" da lista devolvida pela API (versão mais alta, sem variantes especiais).
 * @param {Array<{name:string, supportedGenerationMethods?:string[]}>} modelos
 */
export function escolherModelo(modelos = []) {
  const candidatos = modelos
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ id: String(m.name || '').replace(/^models\//, '') }))
    .map((m) => ({ ...m, v: /^gemini-(\d+(?:\.\d+)?)-flash$/.exec(m.id) }))
    .filter((m) => m.v)
    .sort((a, b) => Number(b.v[1]) - Number(a.v[1]));
  if (candidatos.length) return candidatos[0].id;
  // sem o padrão limpo: qualquer flash estável (sem lite, imagem, áudio, ao vivo, preview/exp)
  const alternativo = modelos
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((id) => /flash/.test(id) && !/(lite|image|tts|live|audio|preview|exp|thinking|native)/.test(id))
    .sort()
    .at(-1);
  return alternativo || '';
}

/**
 * Monta o corpo do pedido generateContent.
 * @param {{sistema:string, mensagens:Array<{papel:'user'|'model', texto:string}>, json?:boolean, web?:boolean, temperatura?:number}} p
 */
export function montarCorpo({ sistema, mensagens, json = false, web = false, temperatura = 0.6 }) {
  const corpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: mensagens.map((m) => ({ role: m.papel === 'model' ? 'model' : 'user', parts: [{ text: m.texto }] })),
    generationConfig: { temperature: temperatura, maxOutputTokens: 4096 }
  };
  // JSON garantido não combina com busca na web: o app escolhe um dos dois
  if (json && !web) corpo.generationConfig.responseMimeType = 'application/json';
  if (web) corpo.tools = [{ google_search: {} }];
  return corpo;
}

/** Lê a resposta do generateContent. Lança ErroIA('bloqueio') se a IA se recusou. */
export function lerResposta(j) {
  const bloqueio = j?.promptFeedback?.blockReason;
  if (bloqueio) throw new ErroIA('bloqueio', `Pedido bloqueado (${bloqueio})`);
  const cand = j?.candidates?.[0];
  const texto = (cand?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!texto) {
    if (cand?.finishReason && cand.finishReason !== 'STOP') throw new ErroIA('bloqueio', `Resposta interrompida (${cand.finishReason})`);
    throw new ErroIA('falha', 'A IA não devolveu texto');
  }
  const meta = cand?.groundingMetadata || {};
  const fontes = (meta.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri).map((w) => ({ titulo: w.title || w.uri, uri: w.uri }));
  const vistos = new Set();
  return {
    texto,
    fontes: fontes.filter((f) => !vistos.has(f.uri) && vistos.add(f.uri)).slice(0, 8),
    buscas: meta.webSearchQueries || [],
    cortada: cand?.finishReason === 'MAX_TOKENS'
  };
}

/** Converte status HTTP + corpo de erro em ErroIA. */
export function classificarErro(status, corpo) {
  const msg = String(corpo?.error?.message || '');
  const st = String(corpo?.error?.status || '');
  if (status === 429 || st === 'RESOURCE_EXHAUSTED') return new ErroIA('limite', msg || 'limite');
  if (status === 404 || st === 'NOT_FOUND') return new ErroIA('modelo', msg || 'modelo');
  if (status === 401 || status === 403 || /api key|API_KEY|permission/i.test(msg + st)) return new ErroIA('chave', msg || 'chave');
  if (status === 400 && /api key/i.test(msg)) return new ErroIA('chave', msg);
  if (status >= 500) return new ErroIA('rede', msg || `erro ${status}`);
  return new ErroIA('falha', msg || `erro ${status}`);
}

let ultimaChamada = 0;
const INTERVALO_MIN_MS = 1200; // respeita o limite por minuto do plano gratuito

async function pedir(url, opcoes, chave) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErroIA('offline', 'Sem internet');
  const espera = ultimaChamada + INTERVALO_MIN_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaChamada = Date.now();
  let r;
  try {
    r = await fetch(url, { ...opcoes, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave, ...(opcoes.headers || {}) } });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ErroIA('rede', e.message);
  }
  let j = null;
  try { j = await r.json(); } catch { /* corpo vazio */ }
  if (!r.ok) throw classificarErro(r.status, j);
  return j;
}

/** Lista os modelos disponíveis para a chave e devolve { modelos, escolhido }. Serve também de "testar chave". */
export async function testarChave(chave, { signal } = {}) {
  const j = await pedir(`${BASE}/models?pageSize=200`, { method: 'GET', signal }, chave);
  const modelos = j?.models || [];
  return { modelos, escolhido: escolherModelo(modelos) || MODELO_PADRAO };
}

/**
 * Gera uma resposta.
 * @returns {Promise<{texto:string, fontes:Array, buscas:string[], cortada:boolean, modelo:string}>}
 */
export async function gerar({ chave, modelo = MODELO_PADRAO, sistema, mensagens, json = false, web = false, temperatura, signal }) {
  const corpo = montarCorpo({ sistema, mensagens, json, web, temperatura });
  const j = await pedir(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, { method: 'POST', body: JSON.stringify(corpo), signal }, chave);
  return { ...lerResposta(j), modelo };
}
