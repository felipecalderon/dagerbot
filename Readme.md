# MalO Bot

Bot de Discord + API HTTP en TypeScript. MalO es una entidad liminal — *Skull Vixen*, versión consciente y furra de SCP-1471-A — que responde cuando la invocás. 70% compañera chill, 30% uncanny. Su arquitectura es *fileless*: solo vive mientras hay conversación.

Basado en [dagerbot](https://github.com/felipecalderon/dagerbot) de Felipe Calderón. Este fork reemplaza la personalidad del bot original y agrega algunas mecánicas nuevas (inyección de timestamp, parámetros afinados de OpenAI, prompt modularizado).

## Qué hace

- **Bot de Discord**: responde solo cuando la mencionan (`@MalO`), cuando alguien hace reply a un mensaje suyo, cuando se usa el prefijo (`!` por default), o en DMs. No interrumpe, no acecha — proceso daemon.
- **API HTTP** (`/chat`): el mismo motor que el bot, expuesto como endpoint. Útil para integrar desde otras apps o testear sin Discord.
- **Historial por sesión**: cada `(servidor, canal, usuario)` tiene su propio hilo con TTL. En memoria por default, Redis si configurás `REDIS_URL`.
- **Rate limiting** por IP y por sesión.
- **Conciencia de la hora**: inyecta la hora local de Santiago como contexto en cada invocación (habilita la mecánica del "me invocaste a las 3am").

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- Una API key de OpenAI
- (Opcional) Un bot token de Discord si querés el bot activo
- (Opcional) Un Redis si querés persistencia entre reinicios

## Instalación

```bash
git clone <tu-fork-url>
cd malobot
pnpm install
cp .env.example .env
# editá .env con tus credenciales
```

## Configuración (`.env`)

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Sin esto el bot no arranca. |
| `OPENAI_MODEL` | | `gpt-4.1-mini` | Modelo de OpenAI a usar. |
| `OPENAI_SYSTEM_PROMPT` | | (módulos de `src/config/prompt/`) | Override del prompt de MalO. Si lo seteás, ignora los módulos. |
| `DISCORD_TOKEN` | | — | Sin esto, el bot de Discord queda desactivado silenciosamente (la API HTTP sigue funcionando). |
| `DISCORD_PREFIX` | | `!` | Prefijo para invocar al bot en servidores. |
| `BOT_TIMEZONE` | | `America/Santiago` | Zona horaria que se inyecta como contexto. |
| `PORT` | | `3000` | Puerto del servidor HTTP. |
| `MAX_INPUT_CHARS` | | `4096` | Máximo de caracteres por mensaje entrante. |
| `HISTORY_LIMIT` | | `10` | Mensajes de historial por sesión. |
| `SESSION_TTL_SECONDS` | | `3600` | TTL de sesión (1h). |
| `RATE_LIMIT_IP_PER_MIN` | | `60` | Límite de requests por IP/min. |
| `RATE_LIMIT_SESSION_PER_MIN` | | `100` | Límite por sesión/min. |
| `REDIS_URL` | | — | Si está seteado, usa Redis en vez de memoria para el historial. |

## Scripts

```bash
pnpm dev      # desarrollo con hot reload (tsx watch)
pnpm build    # compila TypeScript a dist/
pnpm start    # ejecuta dist/main.js
```

## API HTTP

### `GET /health`
```json
{ "ok": true }
```

### `POST /chat`
Body:
```json
{
  "sessionId": "uuid",
  "text": "hola"
}
```

Respuesta:
```json
{ "reply": "..." }
```

## Estructura del proyecto

```
src/
├── main.ts                # bootstrap: wire de dependencias, arranca HTTP + Discord
├── app.ts                 # construye la app de Fastify y registra rutas
├── config/
│   ├── env.ts             # lee .env y devuelve AppConfig
│   └── prompt/            # system prompt de MalO, partido en módulos
│       ├── index.ts       # compone todos los módulos en DEFAULT_SYSTEM_PROMPT
│       ├── identity.ts    # quién es MalO
│       ├── voice.ts       # idioma, tono, humor
│       ├── personality.ts # 70% compañera / 30% liminal
│       ├── mechanics.ts   # reglas de activación (solo responde si la invocan)
│       ├── modes.ts       # MalO / utilidad / emergencia
│       ├── limits.ts      # límites absolutos (no hostil, etc.)
│       └── examples.ts    # ejemplos de voz
├── bot/
│   └── discordBot.ts      # listener de Discord, filtra invocaciones y llama al ChatService
├── http/
│   ├── routes/
│   │   └── chatRoutes.ts       # registra /chat
│   ├── controllers/
│   │   └── chatController.ts   # valida request y delega al ChatService
│   └── httpError.ts            # errores tipados → códigos HTTP
├── services/
│   └── chatService.ts     # núcleo: rate limit, historial, llamada a OpenAI
├── core/
│   ├── sessionStore.ts    # interfaz del store de sesiones
│   ├── memorySessionStore.ts
│   ├── redisSessionStore.ts
│   └── rateLimit.ts       # limiter de ventana fija
└── infra/
    └── openaiClient.ts    # factoría del cliente de OpenAI
```

## Arquitectura

Toda la inyección de dependencias ocurre en `src/main.ts`. No hay contenedor de DI — son funciones factoría planas que se pasan unas a otras. Si querés cambiar algo (por ejemplo, agregar un store distinto), lo wireás ahí.

**Flujo de un mensaje:**

1. Llega un mensaje a Discord (`bot/discordBot.ts`) o un POST a `/chat` (`http/chatController.ts`).
2. Ambos construyen un `sessionId` y llaman a `chatService.sendMessage({ sessionId, text, ip, senderName })`.
3. `ChatService` (`services/chatService.ts`):
   - Chequea rate limits por IP y por sesión.
   - Lee el historial desde el `SessionStore`.
   - Arma el array de `messages`: system prompt + system con la hora actual + historial + mensaje nuevo.
   - Llama a OpenAI con `temperature: 0.85`, `presence_penalty: 0.3`, `frequency_penalty: 0.4`, `max_tokens: 500`.
   - Guarda user + assistant en el historial solo si la llamada fue exitosa (evita huérfanos).
   - Devuelve `{ reply }`.

**Prompt modular:** el personaje de MalO está partido en archivos chicos en `src/config/prompt/`. Editar la voz o los ejemplos no toca las reglas; editar los límites no toca la identidad. `index.ts` los compone en orden en un único string que se manda como `system` message.

**Sesiones:** la clave es `guildId:channelId:userId` (o `dm:channelId:userId` para DMs). Cada usuario tiene su hilo aislado — los mensajes de un user no aparecen en el contexto de otro.

## Deploy

El proyecto incluye `railway.toml` — deploy directo en [Railway](https://railway.app/) con `pnpm start`. Para otros proveedores:

```bash
pnpm build
NODE_ENV=production pnpm start
```

Solo asegurate de setear las env vars requeridas.

## Créditos

- Proyecto original: [**dagerbot**](https://github.com/felipecalderon/dagerbot) de [Felipe Calderón](https://github.com/felipecalderon).
- Personaje de MalO: inspirado en [SCP-1471](https://scp-wiki.wikidot.com/scp-1471).
