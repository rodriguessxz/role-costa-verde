// 🎲 Roleta do rolê: 3 toques (tempo, energia, clima) → sugestão.
import { listar } from '../store.js';
import { sugerir, girar, TEMPOS, ENERGIAS } from '../lib/roleta.js';
import { climaAgora, ROTULO_CLIMA } from '../lib/clima.js';
import { posicaoAtual, linkGoogleMaps, formatarKm, temCoord } from '../lib/geo.js';
import { esc, html, toast, tipoInfo, formatarDuracao, REGIOES } from '../ui.js';

// Mantém as escolhas entre visitas à aba
const estado = { tempo: 'meio', energia: 'normal', clima: 'sol', posicao: null, incluirFeitos: false };

const chips = (grupo, obj, atual) => Object.entries(obj)
  .map(([k, v]) => `<button class="chip ${k === atual ? 'on' : ''}" data-grupo="${grupo}" data-v="${k}">${esc(typeof v === 'string' ? v : v.rotulo)}</button>`)
  .join('');

export function render(container) {
  const el = html(`<section class="pagina roleta">
    <h1>🎲 Roleta do rolê</h1>
    <p class="sub">Sem planejar, mas sem furada.</p>

    <h3>Quanto tempo vocês têm?</h3>
    <div class="chips chips-grandes">${chips('tempo', TEMPOS, estado.tempo)}</div>

    <h3>Energia da galera</h3>
    <div class="chips chips-grandes">${chips('energia', ENERGIAS, estado.energia)}</div>

    <h3>Clima <small data-clima-info></small></h3>
    <div class="chips chips-grandes">${chips('clima', ROTULO_CLIMA, estado.clima)}</div>

    <label class="check"><input type="checkbox" data-feitos ${estado.incluirFeitos ? 'checked' : ''}/> Incluir lugares onde já fomos</label>

    <button class="btn btn-grande btn-girar">🎰 GIRAR</button>
    <div class="resultado" aria-live="polite"></div>
  </section>`);
  container.append(el);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('.chip[data-grupo]');
    if (!b) return;
    estado[b.dataset.grupo] = b.dataset.v;
    el.querySelectorAll(`.chip[data-grupo="${b.dataset.grupo}"]`).forEach((c) => c.classList.toggle('on', c === b));
  });
  el.querySelector('[data-feitos]').addEventListener('change', (e) => { estado.incluirFeitos = e.target.checked; });

  // Pega posição + clima em segundo plano para pré-selecionar
  (async () => {
    const info = el.querySelector('[data-clima-info]');
    estado.posicao = estado.posicao || await posicaoAtual({ timeout: 8000 });
    if (!estado.posicao) { info.textContent = '(sem GPS: escolhe aí)'; return; }
    const c = await climaAgora(estado.posicao);
    if (!c) { info.textContent = '(sem previsão offline)'; return; }
    estado.clima = c.tipo;
    info.textContent = `(agora: ${c.temp}°C${c.doCache ? ', última leitura' : ''})`;
    el.querySelectorAll('.chip[data-grupo="clima"]').forEach((ch) => ch.classList.toggle('on', ch.dataset.v === c.tipo));
  })();

  const resultado = el.querySelector('.resultado');
  const btn = el.querySelector('.btn-girar');

  btn.addEventListener('click', () => {
    const sugestoes = sugerir(listar('lugares'), estado);
    if (!sugestoes.length) {
      resultado.innerHTML = `<div class="card-resultado vazio">Nada encaixa nesse combo 😅<br/>Tenta mais tempo, mais energia ou… dia de rede no camping 🏕️</div>`;
      return;
    }
    // Animação: passa nomes rapidamente antes de parar
    btn.disabled = true;
    const nomes = sugestoes.slice(0, 8).map((s) => s.lugar.nome);
    let i = 0;
    const giro = setInterval(() => {
      resultado.innerHTML = `<div class="card-resultado girando">🎰 ${esc(nomes[i++ % nomes.length])}</div>`;
    }, 90);
    setTimeout(() => {
      clearInterval(giro);
      btn.disabled = false;
      mostrar(girar(sugestoes), sugestoes.length);
    }, 1400);
  });

  function mostrar(s, total) {
    const l = s.lugar;
    const t = tipoInfo(l.tipo);
    if (navigator.vibrate) navigator.vibrate(60);
    resultado.innerHTML = `<div class="card-resultado" style="--cor:${t.cor}">
      <div class="res-emoji">${t.emoji}</div>
      <h2>${esc(l.nome)}</h2>
      <p class="sub">${esc(REGIOES[l.regiao] || '')}${s.distanciaKm != null ? ` · ${formatarKm(s.distanciaKm)}` : ''} · ~${formatarDuracao(s.minutosTotal)} no total</p>
      ${s.motivos.length ? `<ul class="motivos">${s.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
      <div class="acoes">
        ${temCoord(l) ? `<a class="btn" href="${linkGoogleMaps(l)}" target="_blank" rel="noopener">Bora! 🚀</a>` : ''}
        <a class="btn btn-sec" href="#/lugar/${encodeURIComponent(l.id)}">Ver ficha</a>
      </div>
      <p class="dica">${total} opções encaixam. Não curtiu? Gira de novo.</p>
    </div>`;
    resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!temCoord(l)) toast('Esse lugar ainda está sem coordenada');
  }
}
