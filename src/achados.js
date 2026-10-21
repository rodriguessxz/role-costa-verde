// Salva um resultado da busca (geocoder) como lugar novo na lista.
import { adicionar } from './store.js';

export function salvarAchado(r) {
  return adicionar('lugares', {
    nome: r.nome,
    tipo: r.tipo,
    descricao: r.detalhe || '',
    lat: r.lat,
    lng: r.lng,
    coordAprox: false,
    status: 'quero-ir',
    tags: ['completar'],
    criadoPor: window.__usuario?.displayName || 'local'
  });
}
