# WABA Engine

WhatsApp Business API bot engine com FSM + NLU integrado. Respostas vêm do **banco de dados** (flow definition), não do NLU.

## Arquitetura

```
Usuário envia mensagem
       ↓
  NLU classifica intent (nome + score) — NÃO retorna resposta
       ↓
  Flow definition (banco) fornece answer para cada intent
       ↓
  FSM transiciona estados e retorna resposta do flow
       ↓
  PostgreSQL persiste sessões e logs
```

### Princípio central

| Componente | Responsabilidade |
|------------|-----------------|
| **NLU** | Classifica intent (ex: `"menu"` → `"Menu"`, score 0.95) |
| **Flow (banco)** | `definition.intents[].answer` é a fonte da resposta |
| **FSM** | Apenas transiciona; usa `input.answer` do flow |
| **`anything_else`** | Campo **obrigatório** — fallback quando intent não encontrada ou answer vazio |

### Fluxo em `conversation.ts`

```typescript
processMessage(from, text)
  ├─ classifyIntent(text)         → { intent, score }
  ├─ getAnswerFromFlow(intent)    → answer do banco (definition.intents)
  └─ fsm.processEvent(session, "MESSAGE", { intent, answer: flowAnswer })
       └─ AWAITING_INTENT: usa input.answer
```

### Estados do FSM

```
INIT → AWAITING_INTENT → CONFIRMED → END
```

- **INIT**: bootstrap, não retorna saudação. Transiciona para AWAITING_INTENT.
- **AWAITING_INTENT**: estado principal — usa `input.answer` do flow.
- **CONFIRMED**: confirmação opcional.
- **END**: fim da conversa.

## Stack

- **Frontend**: React 18 + TypeScript + Bootstrap 5
- **Backend**: Express + TypeScript
- **NLU**: node-nlp (português)
- **FSM**: fsm-iterator
- **Banco**: PostgreSQL
- **Build**: Webpack (server + client)

## Estrutura do projeto

```
waba-engine/
├── public/
│   └── js/app.js          # Client bundle (webpack)
├── src/
│   ├── client/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── pages/
│   │       ├── Chat.tsx       # Chat web UI
│   │       ├── Dashboard.tsx  # Dashboard
│   │       └── FlowEditor.tsx # Editor visual de flows
│   └── server/
│       ├── chatRoutes.ts      # Endpoints POST/GET/DELETE /api/chat
│       ├── conversation.ts     # processMessage() — FSM + NLU integration
│       ├── db/index.ts        # PostgreSQL (flows, sessions, logs)
│       ├── flowRoutes.ts      # CRUD flows + NLU train
│       ├── fsm.ts             # Definição da máquina de estados
│       ├── nlu.ts             # Init + train + classify
│       ├── webhookRoutes.ts   # Webhook WhatsApp
│       ├── whatsappClient.ts  # Cliente WhatsApp
│       └── server.ts          # Entry point Express
├── model.nlp                 # Modelo NLU treinado
├── webpack.config.js        # Build server + client
└── package.json
```

## Setup local

```bash
# 1. Clonar
git clone https://github.com/coder-mil/waba-engine.git
cd waba-engine

# 2. Instalar
npm install

# 3. Variáveis de ambiente
export DATABASE_URL=postgresql://chatbot:chatbot123@localhost/chatbot
export PORT=3000

# 4. Build
npm run build

# 5. Startar
npm start
# Server: http://localhost:3000
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `PORT` | Porta do servidor (padrão 3000) |
| `NODE_ENV` | `production` ou `development` |

## API Endpoints

### Chat (mesma lógica do webhook WhatsApp)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/chat` | Enviar mensagem |
| `GET` | `/api/chat/messages` | Listar mensagens |
| `DELETE` | `/api/chat/reset` | Resetar sessão |

### Flows

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/flows` | Listar todos |
| `GET` | `/api/flows/:id` | Detalhar flow |
| `POST` | `/api/flows` | Criar flow |
| `PUT` | `/api/flows/:id` | Editar flow |
| `DELETE` | `/api/flows/:id` | Remover flow |
| `POST` | `/api/flows/:id/activate` | Ativar flow |
| `GET` | `/api/flows/active` | Flow ativo |

### NLU

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/nlu/train` | Re-treinar NLU com intents do flow ativo |
| `GET` | `/api/nlu/test?q=texto` | Testar classificação |

### Logs

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/logs` | Mensagens (paginação) |
| `GET` | `/api/logs/sessions` | Sessões ativas |

## Flow definition (estrutura do banco)

```json
{
  "intents": [
    { "name": "saudacao", "phrases": ["oi", "olá", "hey"], "answer": "Olá! Como posso ajudar?" },
    { "name": "Menu", "phrases": ["menu", "opções"], "answer": "📋 Menu:\n1. Info\n2. Suporte\n3. Sair" },
    { "name": "info", "phrases": ["info", "informações"], "answer": "Aqui estão as informações..." },
    { "name": "despedida", "phrases": ["tchau", "adeus"], "answer": "Até logo! 👋" }
  ],
  "anything_else": "Não entendi. Tente menu para ver as opções."
}
```

**Importante:** `anything_else` é obrigatório. Sem ele, intents com `answer` vazio retornam `undefined` e o bot responde "Não entendi" (fallback hardcoded do FSM).

## Deploy (Easypanel)

```bash
# 1. Build local (verifica se compila)
npm run build

# 2. Commit + push
git add . && git commit -m "update" && git push

# 3. Disparar webhook de deploy
curl -s "https://server.mauriciomilano.com/api/deploy/020c1ff12f0d997c78c7c8f7799a48235d39f6efe71b2045"

# 4. Aguardar ~20s

# 5. Treinar NLU (OBRIGATÓRIO após cada deploy)
curl -s -X POST "https://whatsapp.mauriciomilano.com/api/nlu/train"
```

## Smoke test

```bash
# Reset sessão
curl -s -X DELETE https://whatsapp.mauriciomilano.com/api/chat/reset

# Treinar NLU
curl -s -X POST https://whatsapp.mauriciomilano.com/api/nlu/train

# Testar intents — cada uma deve retornar resposta DIFERENTE
curl -s -X POST https://whatsapp.mauriciomilano.com/api/chat \
  -H "Content-Type: application/json" -d '{"text":"oi"}'   # saudacao
curl -s -X POST https://whatsapp.mauriciomilano.com/api/chat \
  -H "Content-Type: application/json" -d '{"text":"menu"}'  # menu
curl -s -X POST https://whatsapp.mauriciomilano.com/api/chat \
  -H "Content-Type: application/json" -d '{"text":"info"}'  # info
curl -s -X POST https://whatsapp.mauriciomilano.com/api/chat \
  -H "Content-Type: application/json" -d '{"text":"tchau"}' # despedida

# Unknown → anything_else
curl -s -X POST https://whatsapp.mauriciomilano.com/api/chat \
  -H "Content-Type: application/json" -d '{"text":"foo bar"}'
```

**Se todas retornam a mesma resposta** → NLU não foi treinado ou `answer` está vazio no banco.

## PITFALLs conhecidos

1. **`answer: ""` (string vazia no banco)** — é falsy em JS, mas espaços `" "` passam no `if`. Sempre use `trim() !== ''` na verificação.

2. **`anything_else` obrigatório** — se não existir, intents com `answer` vazio retornam `undefined` e o FSM usa fallback hardcoded.

3. **`POST /api/nlu/train` após deploy** — o NLU base só tem intents genéricas. Sem treinar, `classifyIntent('menu')` retorna `null`.

4. **`node-nlp` save()** — sempre grava em `process.cwd()`, que é read-only no container. Workaround: `chdir('/tmp')` antes de salvar.

5. **Double `next()` para INIT** — quando estado atual é INIT, faz `next()` duas vezes para o bootstrap funcionar corretamente.