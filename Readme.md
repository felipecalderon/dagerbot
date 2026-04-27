# Dagerbot HTTP Backend

Backend en TypeScript con Fastify para chatbot de discord en el antro usando OpenAI y async/await.

## Endpoints

- `GET /health` → `{ ok: true }`
- `POST /chat` → `{ reply: string }`

### Body esperado

```json
{
  "sessionId": "uuid",
  "text": "hola",
  "conversationId": "opcional"
}
```

### Ejemplo de respuesta

```json
{ "reply": "..." }
```

## Discord bot

- Responde en DM a cualquier mensaje.
- En servidores responde si mencionas al bot o si usas prefijo (por defecto `!`).
- Usa el mismo backend/servicio interno que `/chat`.
- `/config show` — muestra el estado de todos los módulos.
- `/config meme` — configura el módulo de memes (canal, reacciones, modo solo-media).

Variables de entorno:

```
DISCORD_TOKEN=...
DISCORD_PREFIX=!
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...  # solo para desarrollo, omitir en producción
# Si no defines `DISCORD_GUILD_ID`, los comandos se registran globalmente.
```

## Permisos requeridos

Al invitar el bot, asegurarse de incluir los siguientes permisos y scopes:

**Scopes:**
- `bot`
- `applications.commands`

**Permisos del bot:**
- `Send Messages`
- `Add Reactions`
- `Manage Messages`

> [!WARNING]
> Si se agrega una característica nueva que requiera permisos adicionales:
> - **Permisos del bot** (`Send Messages`, `Add Reactions`, etc.) pueden actualizarse
>   manualmente desde Configuración del servidor → Roles → rol del bot.
> - **Scopes** nuevos (`applications.commands`, etc.) requieren re-invitar el bot
>   con un enlace OAuth2 actualizado.


## Variables de entorno

```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
# OPENAI_SYSTEM_PROMPT=Eres Dagerbot. Responde en espanol y se guapo mañosón.
PORT=3000
MAX_INPUT_CHARS=4096
HISTORY_LIMIT=10
SESSION_TTL_SECONDS=3600
RATE_LIMIT_IP_PER_MIN=60
RATE_LIMIT_SESSION_PER_MIN=100
# REDIS_URL=redis://localhost:6379
```

Si no defines `OPENAI_SYSTEM_PROMPT`, se usa `src/config/systemPrompt.ts` por defecto.

## Arquitectura

- `src/app.ts` registra rutas y dependencias.
- `src/http/` controladores y rutas HTTP.
- `src/services/` lógica de negocio (chat).
- `src/core/` utilidades y stores de sesión.
- `src/infra/` clientes externos (OpenAI).
- `src/bot/` cliente de Discord, comandos slash y eventos.
- `src/features/` lógica de características independiente de Discord.
- `src/config/settingsManager.ts` configuración dinámica por servidor (SQLite).
- `data/bot.db` base de datos SQLite generada automáticamente al arrancar.

## Extensibilidad

El bot tiene una arquitectura modular — agregar nuevas características sin tocar el núcleo.
Ver [docs/extensibility-es.md](docs/extensibility-es.md) para la guía completa.

## Notas

- Historial se guarda en memoria o Redis (TTL) según `REDIS_URL`.
- Rate limit por IP y por sesión.
- Entendiste la wea?
