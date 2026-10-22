// Ícones de traço (24x24) usados na navegação e nos controles. Um conjunto só, pra manter coerência.
// Emojis ficam reservados pros TIPOS de lugar (praia, trilha...), que precisam ser reconhecidos de relance.
const P = {
  inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  roteiro: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8.2 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.800"/>',
  explorar: '<circle cx="12" cy="12" r="9"/><path d="m15.500 8.500-2 5-5 2 2-5z"/>',
  lugares: '<path d="M12 21s-6.500-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
  mais: '<circle cx="5.500" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="18.500" cy="12" r="1.300"/>',
  mapa: '<path d="M9 4 3 6.500v13L9 17l6 3 6-2.500v-13L15 7 9 4z"/><path d="M9 4v13M15 7v13"/>',
  notas: '<path d="M6 3.500h9l3.500 3.500v13.500h-12.500z"/><path d="M14.500 3.500V7.500h4"/><path d="M9 12h6M9 15.500h6"/>',
  ideias: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2V16.500h5v-.600c0-.800.400-1.500 1-2A6 6 0 0 0 12 3z"/>',
  checklist: '<rect x="4" y="3.500" width="16" height="17" rx="3"/><path d="m8.500 9 1.500 1.500L13 7.500M8.500 15.500 10 17l3-3M15 10h2M15 16h2"/>',
  gastos: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.500" cy="14.500" r="1.300"/><path d="m6 6 9-2.500"/>',
  dado: '<rect x="3.500" y="3.500" width="17" height="17" rx="4.500"/><circle cx="8.500" cy="8.500" r="1.200" fill="currentColor"/><circle cx="15.500" cy="8.500" r="1.200" fill="currentColor"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/><circle cx="8.500" cy="15.500" r="1.200" fill="currentColor"/><circle cx="15.500" cy="15.500" r="1.200" fill="currentColor"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v2.500M12 19v2.500M4.500 12H2M22 12h-2.500M5.700 5.700l1.800 1.800M16.500 16.500l1.800 1.800M5.700 18.300l1.800-1.800M16.500 7.500l1.800-1.800"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  mais_plus: '<path d="M12 5v14M5 12h14"/>',
  estrela: '<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800 6.800 19.600l1-5.800L3.500 9.700l5.900-.8z"/>',
  voltar: '<path d="m15 5-7 7 7 7"/>',
  sair: '<path d="M10 4.500H5.500v15H10M15 8l4 4-4 4M19 12H9.500"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  nuvem: '<path d="M7 18a4.500 4.500 0 0 1-.500-8.970A6 6 0 0 1 18 10.500a3.800 3.800 0 0 1-.500 7.500z"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  gps: '<circle cx="12" cy="12" r="3.500"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  lixeira: '<path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l.8 12.500h9.400L17.500 7M10 11v5M14 11v5"/>',
  mais_opcoes: '<circle cx="12" cy="5.500" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="12" cy="18.500" r="1.300"/>',
  compartilhar: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="m8.200 10.800 7.600-3.600M8.200 13.200l7.600 3.600"/>',
  onda: '<path d="M2 15c2.500 0 2.500-2.500 5-2.500S9.500 15 12 15s2.500-2.500 5-2.500S19.500 15 22 15"/><path d="M2 20c2.500 0 2.500-2.500 5-2.500S9.500 20 12 20s2.500-2.500 5-2.500S19.500 20 22 20"/><path d="M12 3 7 11h10z"/>'
};

/** Devolve o <svg> do ícone. `classe` opcional pra dimensionar via CSS. */
export function ico(nome, classe = '') {
  return `<svg class="ico ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || ''}</svg>`;
}
