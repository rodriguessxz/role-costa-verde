// Config pública do app web do Firebase (não é segredo: a segurança vem das firestore.rules).
// Enquanto estiver vazia (apiKey ""), o app roda em MODO LOCAL: dados só neste aparelho.
// Para ligar a sincronização, cole aqui a config de
// Firebase Console → Configurações do projeto → Seus apps → App da Web.
export const firebaseConfig = {
  apiKey: 'AIzaSyA7jyOv_n-tICjo2_bgtolGp-oENXEoXbc',
  authDomain: 'role-costa-verde.firebaseapp.com',
  projectId: 'role-costa-verde',
  storageBucket: 'role-costa-verde.firebasestorage.app',
  messagingSenderId: '863717000942',
  appId: '1:863717000942:web:7b7aaaafcc5714e567d5ff'
};

// Id da viagem (permite reaproveitar o app em outras trips)
export const TRIP_ID = 'costa-verde-2026';
