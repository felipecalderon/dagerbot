# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

This bot is **MalO** — a Skull Vixen persona (SCP-1471-A derivative, furry, liminal). Deployed to a Chilean Discord server. The character design lives in `docs/malo-character.md`; the actual prompt powering the bot is split into modules in `src/config/prompt/`.

This repo is a fork of [felipecalderon/dagerbot](https://github.com/felipecalderon/dagerbot). The HTTP/session/bot infrastructure is from the original; the persona and prompt structure were rewritten.

## Commands

```bash
# Development (hot reload via tsx watch)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run compiled output
pnpm start
```

No test suite is configured. There is no linter configured either.

## Architecture

TypeScript/Fastify backend that powers a Discord bot and an HTTP chat API, both backed by the same `ChatService`.

**Dependency wiring happens entirely in `src/main.ts`** — it constructs every dependency (config, OpenAI client, session store, rate limiters, chat service) and hands them down. No DI container; plain factory functions.

**Data flow for a chat message:**
1. Discord (`src/bot/discordBot.ts`) or HTTP (`src/http/controllers/chatController.ts`) receives a message.
2. Both call `chatService.sendMessage({ sessionId, text, ip, senderName? })`.
3. `ChatService` (`src/services/chatService.ts`):
   - Checks IP + session rate limits.
   - Fetches history from the session store.
   - Builds the message array: system prompt + system message with current local time + history + user message.
   - Calls OpenAI with `temperature: 0.85`, `presence_penalty: 0.3`, `frequency_penalty: 0.4`, `max_tokens: 500`.
   - Appends user + assistant to history **only on success** (no orphaned user messages on API failure).

**Session storage** is an interface (`src/core/sessionStore.ts`) with two implementations:
- `MemorySessionStore` — default, in-process Map with TTL sweep.
- `RedisSessionStore` — used when `REDIS_URL` is set. Uses an atomic Lua script for append+trim+TTL reset.

**HTTP layer** (`src/http/`):
- `routes/chatRoutes.ts` — registers `POST /chat`.
- `controllers/chatController.ts` — validates request body and delegates to `ChatService`. Error messages are in MalO's voice.
- `httpError.ts` — typed HTTP errors that the controller translates to status codes.
- `GET /health` is registered directly in `src/app.ts`.

**Discord bot** (`src/bot/discordBot.ts`): disabled gracefully if `DISCORD_TOKEN` is not set. Session IDs are `guildId:channelId:userId` (or `dm:channelId:userId` in DMs). The bot responds in DMs to any message; in servers only when mentioned, prefixed, or when replying to a bot message. This mirrors MalO's canonical "daemon — 0% CPU until invoked" mechanic.

## System prompt architecture

The system prompt is composed from modules in `src/config/prompt/`:

- `identity.ts` — who MalO is (Skull Vixen, SCP-1471-A, fileless)
- `voice.ts` — language, tone, Discord markdown formatting rules (backticks for physical reflexes as sensor logs, italics/bold for emphasis, subtext `-#` for asides)
- `personality.ts` — 70% companion / 30% liminal, embodied furry side
- `mechanics.ts` — only responds when invoked
- `modes.ts` — MalO mode / utility mode / emergency mode
- `limits.ts` — hard rules (no hostility, no sexual content unprompted, etc.)
- `examples.ts` — few-shot voice examples showing the markdown conventions

`prompt/index.ts` joins them in order into `DEFAULT_SYSTEM_PROMPT`. All modules are included on every request.

`env.ts` resolves the final prompt: `process.env.OPENAI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT`. If `OPENAI_SYSTEM_PROMPT` is set, it overrides the modules entirely.

## Environment variables

Copy `.env.example` to `.env`. Required:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Required. App crashes on startup without it. |
| `DISCORD_TOKEN` | Optional. Bot silently disabled if absent. |

Key optional vars with defaults:
- `OPENAI_MODEL=gpt-4.1-mini`
- `BOT_TIMEZONE=America/Santiago` (drives the timestamp injected as a system message)
- `PORT=3000`, `HISTORY_LIMIT=10`, `SESSION_TTL_SECONDS=3600`
- `REDIS_URL` (no Redis by default)
- `OPENAI_SYSTEM_PROMPT` (overrides the modular prompt if set)

## Deployment

Deployed on Railway (`railway.toml`). Start command: `pnpm start` (runs compiled `dist/main.js`).
