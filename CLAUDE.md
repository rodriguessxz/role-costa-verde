# Rolê Costa Verde — app da trip Ubatuba ⇄ Paraty

App mobile-first (PWA) para dois amigos planejarem **sem planejar** uma viagem de camping
entre Ubatuba (SP) e Paraty (RJ), de ~23/12/2026 a ~06/01/2027.

**Filosofia:** zero roteiro fixo. O app guarda os dados (campings, trilhas, cachoeiras,
links do Wikiloc, gastos) e responde rápido à pergunta "o que a gente faz agora?".

## Contexto de uso (importante para decisões técnicas)

- Uso quase 100% no **celular**, muitas vezes **sem sinal** (trilhas, Trindade, Mamanguá).
- **Dois usuários** que leem e editam os mesmos dados.
- Navegação na trilha **NÃO** é responsabilidade do app: fica com Wikiloc + GPX no Amazfit.
  O app é o "cérebro do planejamento", não o GPS.
- Logística simples é prioridade: evitar rolês que exigem muitos dias ou acesso complicado.
  Exceção planejada: **Pico do Pão de Açúcar do Mamanguá** como bate-volta via Paraty-Mirim (barco).

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Build | **Vite** + **JS puro (ES modules)** | Simples, rápido, sem framework pesado |
| UI | HTML + CSS próprio (mobile-first) | Controle total, leve |
| Mapa | **Leaflet** + tiles OpenStreetMap | Grátis, sem chave |
| Dados | **Firebase Firestore** com `persistentLocalCache` | Offline nativo + sync automático entre os 2 celulares |
| Auth | **Firebase Auth (Google)** + allowlist de 2 e-mails nas rules | Só nós dois editamos |
| PWA | `vite-plugin-pwa` (Workbox) | Instalar na tela inicial + cache do app shell |
| Clima | **Open-Meteo API** (sem chave) | Previsão para a roleta |
| Deploy | **GitHub Pages** via Actions | Grátis, publica a cada push |

> Se o Firebase virar overkill em algum momento, o fallback é `localStorage` + export/import JSON.
> Mas o padrão do projeto é Firestore.

## Estrutura de pastas

```
/
├── CLAUDE.md
├── index.html
├── vite.config.js
├── public/
│   ├── icons/                 # ícones do PWA
│   └── seed.json              # lista inicial de lugares (importada 1x pro Firestore)
├── src/
│   ├── main.js                # bootstrap, roteamento por hash (#/mapa, #/lugar/:id...)
│   ├── firebase-config.js     # config pública do Firebase + TRIP_ID (vazia = modo local)
│   ├── firebase.js            # init, auth, firestore com cache persistente
│   ├── ui.js                  # helpers de UI, dicionários (tipos, status, regiões), filtros
│   ├── store.js               # camada de dados (CRUD + listeners em tempo real)
│   ├── views/
│   │   ├── mapa.js            # mapa + filtros + "perto de mim"
│   │   ├── lista.js           # lista filtrável (alternativa ao mapa)
│   │   ├── lugar.js           # ficha do lugar (ver/editar)
│   │   ├── roleta.js          # 🎲 roleta do rolê
│   │   ├── gastos.js          # racha de gastos
│   │   ├── novo.js            # adicionar lugar rápido
│   │   ├── config.js          # login, nomes da dupla, seed, backup
│   │   └── diario.js          # (fase 3, ainda não existe)
│   ├── lib/
│   │   ├── geo.js             # distância (haversine), geolocalização
│   │   ├── clima.js           # Open-Meteo + cache local
│   │   ├── roleta.js          # lógica de sugestão (pura, testável)
│   │   ├── gastos.js          # cálculo do racha (puro)
│   │   └── logica.test.js     # testes (node --test)
│   └── styles/
│       └── main.css
└── firestore.rules
```

## Modelo de dados (Firestore)

Tudo dentro de `trips/{tripId}` para permitir reaproveitar o app em outras viagens.

### `trips/{tripId}/lugares/{id}`
```js
{
  nome: "Pico do Pão de Açúcar (Mamanguá)",
  tipo: "trilha",              // camping | trilha | cachoeira | praia | apoio (mercado, posto, farmácia)
  regiao: "paraty",            // ubatuba-norte | ubatuba-centro | ubatuba-sul | trindade | paraty | paraty-mirim
  lat: -23.27, lng: -44.63,
  coordAprox: true,            // true = coordenada aproximada, conferir no Wikiloc/Maps
  descricao: "texto livre",
  // trilha/cachoeira
  wikilocUrl: "https://...",
  gpxNoRelogio: false,         // checklist: GPX já mandado pro Amazfit?
  distanciaKm: 3.0,
  duracaoMin: 120,
  dificuldade: "dificil",      // facil | moderada | dificil
  // logística
  acesso: "barco",             // carro | onibus | a-pe | barco
  precisaGuia: false,
  // camping
  precoNoite: 60,
  contato: "(24) 9....",
  reservaNecessaria: true,
  // controle
  status: "quero-ir",          // quero-ir | fui | descartado
  nota: 0,                     // 0-5 depois que foi
  tags: ["vista", "por-do-sol", "banho"],
  criadoPor: "uid", atualizadoEm: serverTimestamp()
}
```

### `trips/{tripId}/gastos/{id}`
```js
{ descricao: "Barco Paraty-Mirim", valor: 120, pagoPor: "uid", divisao: "igual", data, categoria: "transporte" }
```
Tela mostra o saldo: "Fulano deve R$ X pro Beltrano".

### `trips/{tripId}/diario/{id}` (fase 3)
```js
{ data, texto, fotoUrl, lat, lng, lugarId, autor }
```

## Funcionalidades por fase

### Fase 1 — MVP (meta: pronto até ~15/12)
1. **Login Google** + allowlist (2 e-mails em `firestore.rules`).
2. **Import do `seed.json`** pro Firestore (botão em tela de config, roda 1x).
3. **Mapa** com pins por tipo (ícone/cor por tipo), filtro por tipo e status.
4. **Lista** com busca e os mesmos filtros (no celular às vezes é melhor que mapa).
5. **Ficha do lugar**: ver/editar todos os campos, botão "abrir no Wikiloc",
   botão "abrir rota no Google Maps/Waze", toggle de status.
6. **Adicionar lugar** rápido: nome + tipo + "usar minha localização atual".
7. **Offline**: app shell em cache (PWA) + Firestore persistente. Testar em modo avião.

### Fase 2 — A parte divertida
8. **"Perto de mim"**: ordena por distância a partir do GPS do celular.
9. **🎲 Roleta do rolê** (ver regras abaixo).
10. **Racha de gastos** com saldo entre os dois.
11. **Checklist pré-trilha** (água, lanterna, repelente, protetor, GPX no relógio, avisou alguém).

### Fase 3 — Se sobrar tempo
12. **Diário** com foto + localização, timeline por dia.
13. **Tábua de marés** (JSON estático de Paraty/Ubatuba para dez/jan, preenchido manualmente
    a partir da tábua da Marinha) exibida na ficha de praias/costões.
14. Tela "Resumo da trip": km andados, trilhas feitas, gasto total.

## Regras da roleta do rolê (`src/lib/roleta.js`)

Entrada (3 toques na tela, nada de formulário chato):
- **Tempo disponível**: `1-2h` | `meio dia` | `dia todo`
- **Energia**: `🦥 de boa` | `🙂 normal` | `🔥 bora sofrer`
- **Clima**: automático via Open-Meteo pela localização (com override manual: sol / nublado / chuva)

Lógica:
1. Filtra `status !== "descartado"` e `status !== "fui"` (opção de incluir "fui").
2. Tempo: `duracaoMin` + deslocamento estimado (distância em linha reta × 1.6 ÷ 40 km/h) tem que caber.
3. Energia: `de boa` → só `facil`; `normal` → `facil|moderada`; `bora sofrer` → tudo, priorizando `dificil`.
4. Chuva: exclui trilhas `dificil`, costões e qualquer coisa com `acesso: "barco"`.
   Cachoeira com chuva forte também sai (cabeça d'água).
5. Pontua por proximidade + tag aleatória e sorteia entre os 3 melhores (com animação de roleta 🎰).
6. Mostra card com: nome, por que foi sugerido, botões "Bora!" (abre rota) e "Gira de novo".

Manter essa lógica como **função pura** (recebe lugares + contexto, devolve sugestões) para testar fácil.

## Diretrizes de UI

- **Mobile-first de verdade**: alvo 360–430px de largura, botões grandes (mín. 44px), navegação por
  **tab bar inferior** (Mapa · Lista · 🎲 · Gastos · +).
- Tema **claro e escuro** (respeitar `prefers-color-scheme`); escuro é útil à noite no camping.
- Visual descontraído: paleta mar/mata (azul petróleo, verde mata, areia, coral para destaques).
- Feedback de estado de rede discreto: badge "offline — salvando local" quando sem sinal.
- Textos em **português brasileiro**, tom leve.

## Convenções de código

- JS moderno (ES2022), ES modules, sem TypeScript por enquanto.
- Código **comentado em português**, funções pequenas.
- Nada de segredo hardcoded além da config pública do Firebase (que é pública por natureza);
  a segurança vem das `firestore.rules`.
- Commits pequenos por funcionalidade.

## Pontos de atenção

- **Réveillon**: campings de Trindade, Paraty e Ubatuba lotam e alguns vendem pacote fechado
  30/12–01/01. O status `reservaNecessaria` existe por isso.
- Coordenadas do `seed.json` marcadas com `coordAprox: true` são aproximadas — conferir e corrigir
  pelo app (botão "corrigir posição = minha localização" quando estiver no lugar).
- Lugares com `lat/lng: null` (ex.: links do Wikiloc ainda não detalhados, tag `completar`) **não vão pro mapa**,
  aparecem só na Lista com um badge "completar dados". O app não pode quebrar com coordenada nula.
- Estrada de Paraty-Mirim é de terra e pode fechar com chuva; nesse caso, barco sai do cais de Paraty.
- Pão de Açúcar do Mamanguá: subida curta e íngreme (~1h), evitar com chuva.

## Estado atual (out/2026)

Fase 1 e boa parte da Fase 2 já implementadas: mapa, lista, ficha/edição, novo lugar,
roleta, racha de gastos, checklist pré-trilha (dentro da ficha), config, PWA offline.

### Como os dados funcionam
- `src/store.js` tem **uma interface só** (`assinar`, `adicionar`, `atualizar`, `remover`,
  `importarLugares`) com dois backends:
  - **modo local** (localStorage): usado enquanto `src/firebase-config.js` estiver vazio ou sem login.
    Na 1ª abertura popula com `public/seed.json`.
  - **modo nuvem** (Firestore em `trips/{TRIP_ID}/{lugares|gastos|config}`): liga sozinho após login Google.
- As views NUNCA falam com o Firebase direto, só com o store.
- Gastos usam `pagoPor: 'a' | 'b'`; os nomes da dupla ficam em `config/pessoas` (`{a, b}`).
- Checklist pré-trilha é salvo no próprio lugar (`lugar.checklist = { agua: true, ... }`).

### Rodar / testar / publicar
- `npm install` → `npm run dev` (abre com `--host`, dá pra testar no celular na mesma rede).
- `npm test` roda os testes das funções puras (`src/lib/*.test.js`). Toda lógica nova em `src/lib` ganha teste.
- Deploy: push na `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages
  em `https://<usuario>.github.io/<repo>/`. O `BASE_PATH` é injetado pelo workflow.
- Firebase: colar a config em `src/firebase-config.js`; regras em `firestore.rules`
  (publicar pelo console do Firebase → Firestore → Regras). O domínio do GitHub Pages precisa
  estar em Authentication → Settings → Authorized domains.

### Próximos passos sugeridos
- Completar as 2 trilhas do Wikiloc (tag `completar`) e conferir coordenadas aproximadas.
- Fase 3: diário com fotos, tábua de marés, resumo da trip.
- Sem `window.confirm/alert` (travam em PWA): confirmação é por "toque duas vezes".
