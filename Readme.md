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
- `/config meme` — configura el módulo de memes (canal, reacciones, modo solo-media, random-react).
- `/config meme-reward` — configura la recompensa por acumulación de memes (rol, meta, mensaje).
- `/rank meme` — muestra el top de usuarios con más memes publicados, navegable por páginas.

Variables de entorno:

```
DISCORD_TOKEN=...
DISCORD_PREFIX=!
DISCORD_CLIENT_ID=... # Required for slash command registration
CONFIG_PERMISSION=... # Permission required to use /config commands
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
- `Manage Roles`

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
MONGODB_URI=mongodb://localhost:27017/dagerbot
```

Si no defines `OPENAI_SYSTEM_PROMPT`, se usa `src/config/systemPrompt.ts` por defecto.

## Migración de chats

Los historiales ahora viven en Mongo, en la colección `chats`, con un documento por sesión.

Comando:

```bash
pnpm migrate:chats
```

Opciones:

- `--dry-run` para simular sin escribir en Mongo.
- `--delete-source` para borrar la clave de origen después de migrarla, solo si todavía tienes datos viejos por mover.

Ejemplo:

```bash
pnpm migrate:chats -- --dry-run
```

## Limpiar slash commands

Los comandos globales y los de un guild son sets independientes en Discord y no se deduplican por nombre, así que una copia obsoleta en un scope puede quedar visible junto a la versión actualizada de otro. Este script los elimina bajo demanda, sin tocar el registro del arranque.

Requiere `DISCORD_TOKEN` y `DISCORD_CLIENT_ID` en el entorno.

```bash
pnpm commands:clear -- --global          # limpia el scope global (afecta a TODOS los servidores)
pnpm commands:clear -- --guild 123 456   # limpia uno o varios guilds
pnpm commands:clear -- --guild 123,456   # también acepta lista separada por comas
```

Puedes combinar `--global` y `--guild`. Sin argumentos, imprime la ayuda y no hace nada.

> [!NOTE]
> Tras limpiar, si el cliente de Discord sigue mostrando los comandos viejos, refresca con `Ctrl/Cmd+R` — es caché del cliente. Los comandos de guild se actualizan al instante; los globales pueden tardar un poco en reflejarse en todos los clientes.

## Arquitectura

- `src/app.ts` registra rutas y dependencias.
- `src/http/` controladores y rutas HTTP.
- `src/services/` lógica de negocio (chat).
- `src/core/` utilidades compartidas (rate limit, tipos).
- `src/infra/` clientes externos (OpenAI).
- `src/bot/` cliente de Discord, comandos slash y eventos.
- `src/features/` lógica de características independiente de Discord.
- `src/config/settingsManager.ts` configuración dinámica por servidor.
- `src/data/` capa de datos — proveedores, repositorios y contratos.
- MongoDB almacena la configuración y los contadores persistentes.

## Extensibilidad

El bot tiene una arquitectura modular — agregar nuevas características sin tocar el núcleo.
Ver [docs/extensibility-es.md](docs/extensibility-es.md) para la guía completa.

## Notas

- Historial de chat en Mongo, colección `chats`: guarda los últimos `HISTORY_LIMIT`
  mensajes por sesión. Cada documento caduca tras `SESSION_TTL_SECONDS` de inactividad
  mediante un índice TTL, así que sobrevive a un reinicio pero no se conserva
  indefinidamente.
- Rate limit por IP y por sesión.
- Entendiste la wea?
