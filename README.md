# Rolê Costa Verde 🌊⛺

App (PWA) da trip de fim de ano entre Ubatuba e Paraty, ~23/12/2026 a ~06/01/2027.
Camping, trilha, cachoeira e zero roteiro fixo.

**Telas:** 🗺️ Mapa · 📋 Lista · 🎲 Roleta do rolê · 💸 Racha · ➕ Novo lugar · ⚙️ Config

## Rodar no PC

```bash
npm install
npm run dev      # abre em http://localhost:5173 (e na rede, pra testar no celular)
npm test         # testes da roleta, racha e geo
```

## Publicar

Todo push na `main` publica sozinho no GitHub Pages (Settings → Pages → Source: **GitHub Actions**).

## Sincronizar entre os dois celulares (Firebase)

1. Colar a config do app web em `src/firebase-config.js`.
2. Firestore → Regras: colar `firestore.rules` (com o e-mail do parça) e publicar.
3. Authentication → Google ativado + domínio `<usuario>.github.io` autorizado.
4. No app: ⚙️ Config → Entrar com Google → “Importar lista inicial”.

Sem Firebase o app funciona igual, só que cada celular com seus próprios dados.

## Instalar no celular

Abre o link no Chrome (Android) ou Safari (iPhone) → menu → **Adicionar à tela inicial**.
Depois de abrir uma vez com internet, funciona sem sinal.

## Pendências

- [ ] Renomear e completar as 2 trilhas do Wikiloc (aparecem com ✏️ na lista)
- [ ] Conferir coordenadas aproximadas (botão “Estou aqui” na ficha)
- [ ] Preço e contato dos campings
- [ ] **Reservar camping do Réveillon (30/12 a 01/01)**
- [ ] E-mail do parça no `firestore.rules`

Detalhes técnicos e decisões: veja `CLAUDE.md`.
