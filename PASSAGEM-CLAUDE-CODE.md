# Passagem para o Claude Code — setup final

Este projeto foi construído numa sessão do Claude (nuvem). O código está pronto e testado
(`npm test` → 10/10). Falta só a parte que precisa da máquina do Arthur: Git, GitHub e Firebase.
Leia o `CLAUDE.md` antes de começar.

## Checklist (faça em ordem)

### 1. Recriar o workflow de deploy
A pasta `.github/` não pôde ser gravada remotamente. Crie `.github/workflows/deploy.yml`
com exatamente este conteúdo:

```yaml
# Publica o app no GitHub Pages a cada push na main.
name: Deploy no GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          # Publica em https://<usuario>.github.io/<repo>/
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 2. Dependências e testes
```bash
npm install
npm test        # deve dar 10 pass
npm run build   # deve terminar sem erro
```

### 3. Git + GitHub
- A pasta está no **OneDrive**: sugerir ao Arthur mover para fora (ex.: `C:\dev\role-costa-verde`)
  antes do `npm install`, ou pausar a sincronização. `node_modules` está no `.gitignore`.
- `git init -b main`, commit inicial.
- Criar repositório **pessoal** (não na org AbraselMG) chamado `role-costa-verde`:
  `gh repo create role-costa-verde --public --source . --push`
  (público é necessário para GitHub Pages no plano gratuito; não há segredos no código).
- Ativar Pages com origem GitHub Actions:
  `gh api -X POST repos/{owner}/role-costa-verde/pages -f build_type=workflow`
- Acompanhar o deploy: `gh run watch`. URL final: `https://<usuario>.github.io/role-costa-verde/`.

### 4. Firebase (CLI: `npm i -g firebase-tools` → `firebase login`)
1. Criar projeto (ex.: `role-costa-verde`), sem Analytics.
2. Firestore: criar banco em modo produção, região `southamerica-east1` (São Paulo).
3. Authentication: ativar provedor **Google**; em Settings → Authorized domains,
   adicionar `<usuario>.github.io`.
4. Registrar um **App da Web** e colar a config em `src/firebase-config.js`.
5. Em `firestore.rules`, trocar `EMAIL_DO_PARCA@gmail.com` pelo e-mail do amigo e publicar:
   `firebase deploy --only firestore:rules` (criar `firebase.json` mínimo apontando para `firestore.rules`).
6. Commit + push → o Pages publica a versão com sincronização.

Passos 1–3 e 5 podem exigir o console web (console.firebase.google.com) se a CLI não cobrir.

### 5. Validar
- Abrir a URL do Pages no celular → ⚙️ Config → Entrar com Google → "Importar lista inicial".
- Conferir que o badge de modo mostra "nuvem (sincronizando)".
- Modo avião: app abre, edita, e sincroniza ao voltar o sinal.
- Instalar na tela inicial (Adicionar à tela inicial).

## Pendências de conteúdo (não bloqueiam)
- 2 trilhas do Wikiloc sem nome/coordenada (tag `completar`):
  `https://loc.wiki/t/264769739` e `https://loc.wiki/t/280238144`.
- Coordenadas do seed são aproximadas (`coordAprox: true`).
- Reservar camping do Réveillon (30/12–01/01).
