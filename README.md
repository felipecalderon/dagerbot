# MalO Bot

Bot de Discord + API HTTP con soporte para múltiples proveedores LLM (OpenAI, Anthropic, Google Gemini). Construido en TypeScript con Fastify.

El bot viene preconfigurado con la personalidad **MalO** — una Skull Vixen basada en SCP-1471-A — pero el system prompt es completamente reemplazable vía variable de entorno.

## Características

- Responde en Discord cuando es mencionado, con prefijo, o en DMs
- API HTTP en `POST /chat` para integraciones externas
- Historial de conversación por sesión con TTL configurable
- Rate limiting por IP y por sesión
- Soporte para OpenAI, Anthropic (con prompt caching) y Google Gemini
- Almacenamiento de sesiones en memoria o Redis
- Prompt del bot modular y fácilmente personalizable

## Requisitos

- Node.js 18+
- pnpm
- Una API key de al menos uno de los proveedores LLM

## Instalación

```bash
git clone https://github.com/tu-usuario/dagerbot
cd dagerbot
pnpm install
```

## Configuración

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

### Variables de entorno

```env
# ─── LLM Provider ────────────────────────────────────────────────────────────
# Proveedor a usar. Valores válidos: openai, anthropic, google (default: openai)
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5

# Google Gemini
GOOGLE_API_KEY=...
GOOGLE_MODEL=gemini-2.0-flash

# Override del system prompt (reemplaza la personalidad de MalO por completo)
# LLM_SYSTEM_PROMPT=Eres un asistente útil.

# ─── Bot ─────────────────────────────────────────────────────────────────────
BOT_TIMEZONE=America/Santiago

# ─── Discord ─────────────────────────────────────────────────────────────────
DISCORD_TOKEN=tu_token_de_discord
DISCORD_PREFIX=!

# ─── Servidor HTTP ───────────────────────────────────────────────────────────
PORT=3000
MAX_INPUT_CHARS=4096
HISTORY_LIMIT=10
SESSION_TTL_SECONDS=3600
RATE_LIMIT_IP_PER_MIN=60
RATE_LIMIT_SESSION_PER_MIN=100

# ─── Redis (opcional) ────────────────────────────────────────────────────────
# REDIS_URL=redis://localhost:6379
```

## Uso

```bash
# Desarrollo con hot reload
pnpm dev

# Compilar
pnpm build

# Producción
pnpm start
```

## API HTTP

### `POST /chat`

```json
{
  "sessionId": "usuario-123",
  "text": "Hola"
}
```

Responde con `text/plain`. El `sessionId` identifica la conversación — puedes usar cualquier string único por usuario o contexto.

### `GET /health`

Retorna `{"ok": true}`.

## Estructura del proyecto

```
src/
├── main.ts                     # Bootstrap y wiring de dependencias
├── app.ts                      # Construcción de la app Fastify
├── bot/
│   └── discordBot.ts           # Cliente Discord, filtrado de mensajes
├── config/
│   ├── env.ts                  # Carga y validación de variables de entorno
│   └── prompt/                 # Módulos del system prompt de MalO
│       ├── index.ts
│       ├── identity.ts
│       ├── voice.ts
│       ├── personality.ts
│       ├── mechanics.ts
│       ├── modes.ts
│       ├── limits.ts
│       └── examples.ts
├── core/
│   ├── types.ts                # Tipos compartidos (ChatMessage)
│   ├── sessionStore.ts         # Interfaz de almacenamiento de sesiones
│   ├── memorySessionStore.ts   # Implementación en memoria con TTL
│   ├── redisSessionStore.ts    # Implementación Redis con Lua atómico
│   └── rateLimit.ts            # Fixed-window rate limiter
├── http/
│   ├── routes/chatRoutes.ts
│   ├── controllers/chatController.ts
│   └── httpError.ts
├── providers/
│   ├── types.ts                # Interfaz LLMProvider
│   ├── index.ts                # Factory createProvider()
│   ├── openai.ts
│   ├── anthropic.ts            # Incluye prompt caching
│   └── google.ts
└── services/
    └── chatService.ts          # Lógica central: rate limit, historial, LLM
```

## Agregar un nuevo proveedor LLM

1. Crear `src/providers/miprovider.ts` implementando `LLMProvider`:

```typescript
import type { AppConfig } from "../config/env";
import type { LLMProvider, CompletionRequest } from "./types";

export function createMiProvider(config: AppConfig): LLMProvider {
  const apiKey = process.env.MI_API_KEY;
  if (!apiKey) throw new Error("MI_API_KEY is required when LLM_PROVIDER=miprovider");

  return {
    async complete({ system, history, userContent }: CompletionRequest): Promise<string> {
      // implementación
    },
  };
}
```

2. Agregar el case en `src/providers/index.ts`
3. Agregar `miModel` en `src/config/env.ts`
4. Documentar en `.env.example`

## Personalizar el bot

El system prompt está dividido en módulos en `src/config/prompt/`. Cada archivo exporta una constante de texto:

| Archivo | Contenido |
|---|---|
| `identity.ts` | Quién es MalO |
| `voice.ts` | Tono, idioma, formato de Discord |
| `personality.ts` | Mezcla de compañera / entidad liminal |
| `mechanics.ts` | Solo responde cuando es invocada |
| `modes.ts` | Modos de respuesta |
| `limits.ts` | Reglas duras |
| `examples.ts` | Ejemplos few-shot |

Para reemplazar la personalidad por completo sin tocar código, usa `LLM_SYSTEM_PROMPT=...` en el `.env`.

## Deploy en Railway

El proyecto incluye `railway.toml` configurado. Solo necesitas definir las variables de entorno en el dashboard de Railway y conectar el repositorio.

```toml
[build]
builder = "NIXPACKS"

[phases.install]
cmds = ["pnpm install --no-frozen-lockfile"]
```

El comando de inicio es `pnpm start` (corre `dist/main.js`).

## Dependencias principales

| Paquete | Uso |
|---|---|
| `fastify` | Servidor HTTP |
| `discord.js` | Cliente de Discord |
| `openai` | SDK de OpenAI |
| `@anthropic-ai/sdk` | SDK de Anthropic |
| `@google/generative-ai` | SDK de Google Gemini |
| `redis` | Cliente Redis para sesiones persistentes |
| `dotenv` | Carga de variables de entorno |

## Licencia

ISC
