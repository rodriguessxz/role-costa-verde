// Config pública do app web do Firebase (não é segredo: a segurança vem das firestore.rules).
// Enquanto estiver vazia (apiKey ""), o app roda em MODO LOCAL: dados só neste aparelho.
// Para ligar a sincronização, cole aqui a config de
// Firebase Console → Configurações do projeto → Seus apps → App da Web.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

// Id da viagem (permite reaproveitar o app em outras trips)
export const TRIP_ID = 'costa-verde-2026';
