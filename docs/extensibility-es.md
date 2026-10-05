# Guía de Extensibilidad

Este documento cubre los tres módulos base introducidos para hacer el bot extensible.
Está dirigido a colaboradores que deseen agregar nuevas características.

---

## Visión general

```
Nueva característica
  ├── lee configuración  →  Settings Manager   (src/config/settingsManager.ts)
  ├── agrega un comando  →  Command Manager    (src/bot/commands/commandManager.ts)
  ├── maneja eventos     →  Event Dispatcher   (src/bot/events/eventDispatcher.ts)
  └── persiste datos     →  Data Layer         (src/data/)
```

> [!IMPORTANT]
> Los cuatro módulos base **nunca se modifican** al agregar una característica nueva.
> Solo se **extienden** — se agrega una entrada nueva sin tocar el código existente.

---

## Módulo base 1 — Settings Manager

Almacena la configuración de cada servidor como una fila JSON versionada en MongoDB,
indexada por `guildId`. Una fila por servidor — cada fila contiene la configuración
completa de ese servidor, más un número de `version` para soporte de migraciones futuras.

**Al agregar una característica nueva, solo cambian dos cosas:**

1. Agregar los valores por defecto en `defaultSettings()` dentro de `settingsManager.ts`.
2. Definir sus tipos en `src/core/types.ts`.

El auto-merge se encarga del resto: en el próximo reinicio, todos los servidores existentes
reciben los nuevos campos automáticamente — sin migraciones manuales.

---

## Módulo base 2 — Command Manager

Registro central de todos los slash commands. Gestiona el registro en la API de Discord
y el enrutamiento de interacciones desde un único lugar.

**Agregar un comando raíz nuevo (ej: `/poll`):**

1. Crear `src/bot/commands/poll/index.ts` — exportar `createPollCommand(settingsManager)`.
2. Agregar el import y la entrada en el catálogo dentro de `src/bot/commands/commandManager.ts`:

```typescript
// al inicio de commandManager.ts
import { createPollCommand } from "./poll/index.js"; // <- agregar aquí

// --- Command catalog: add new commands here only ---
[
  createConfigCommand(deps.settingsManager),
  createRankCommand({ memeRepository: deps.dataLayer.memeRepository }),
  createPollCommand(deps.settingsManager), // <- agregar aquí
].forEach((cmd) => commands.set(cmd.name, cmd));
```

`discordBot.ts` nunca se modifica al agregar un comando nuevo.

**Agregar un subcomando a `/config`:**

Cada característica define un archivo que registra simultáneamente la definición
del builder y su handler:

```typescript
// src/bot/commands/config/subcommands/tuCaracteristica.ts
export function tuCaracteristicaSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand(/* definir opciones */);
  handlers.set("tu-caracteristica", handleTuCaracteristica);
}
```

Luego agregar una línea en `src/bot/commands/config/index.ts`:

```typescript
tuCaracteristicaSubcommand(builder, subcommands);
```

---

## Módulo base 3 — Event Dispatcher

Dos archivos concentran todos los eventos con lógica de negocio:

- `src/bot/events/eventDispatcher.ts` — registra todos los `client.on()` con lógica de negocio y delega a los listeners
- `src/bot/events/listeners/` — un archivo por feature, por evento

Los eventos de infraestructura (`ClientReady`, `Error`, `InteractionCreate`) permanecen en `discordBot.ts` — son setup puro del bot sin lógica de negocio y nunca van a crecer.

**Regla: nunca registrar un nuevo `client.on()` con lógica de negocio fuera de `eventDispatcher.ts`.**

Listeners actuales:

| Archivo | Evento | Feature |
|---|---|---|
| `src/bot/events/listeners/memeListener.ts` | `MessageCreate` | Módulo meme + reward |
| `src/bot/events/listeners/chatAiListener.ts` | `MessageCreate` | Chat con IA |

**Agregar una característica a un evento existente:**

1. Crear `src/bot/events/listeners/yourFeatureListener.ts`:

```typescript
import type { Message } from "discord.js";
import type { YourFeatureSettings } from "../../../core/types.js";

export async function handleYourFeature(
  message: Message,
  config: YourFeatureSettings
): Promise<void> {
  if (!config.enabled) return;
  // ...tu lógica aquí
}
```

2. Importarlo y llamarlo en `eventDispatcher.ts`:

```typescript
import { handleYourFeature } from "./listeners/yourFeatureListener.js";

// dentro del listener de MessageCreate:
await handleYourFeature(message, settings.yourFeature).catch((err) => {
  console.error("[yourFeature] Error:", err);
});
```

`discordBot.ts` nunca se modifica al agregar una feature a un evento existente.

**Agregar una característica que necesita un evento nuevo:**

Agregar un nuevo bloque `client.on()` dentro de `eventDispatcher.ts` y crear el listener correspondiente. Ejemplo — dar bienvenida a nuevos miembros:

```typescript
// src/bot/events/listeners/welcomeListener.ts
import type { GuildMember } from "discord.js";
import type { WelcomeSettings } from "../../../core/types.js";

export async function handleWelcome(
  member: GuildMember,
  config: WelcomeSettings
): Promise<void> {
  if (!config.enabled || !config.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel?.isTextBased()) return;
  await channel.send(config.message.replace("{user}", member.displayName));
}
```

```typescript
// src/bot/events/eventDispatcher.ts — agregar un nuevo bloque client.on()
import { handleWelcome } from "./listeners/welcomeListener.js";

client.on(Events.GuildMemberAdd, async (member) => {
  const settings = await settingsManager.getSettings(member.guild.id);
  await handleWelcome(member, settings.welcome).catch((err) => {
    console.error("[welcomeFeature] Error:", err);
  });
});
```

`discordBot.ts` nunca se modifica.

---

## Módulo base 4 — Capa de datos

Capa centralizada de persistencia de datos. Cualquier característica que necesite
almacenar datos utiliza esta capa en lugar de conectarse directamente a la base de datos.

**Archivos clave:**
- `src/data/types.ts` — contratos para proveedores y repositorios
- `src/data/index.ts` — ensambla e inyecta todos los repositorios
- `src/data/providers/` — un archivo por proveedor de base de datos
- `src/data/repositories/` — un archivo por característica, por proveedor

**Al agregar una característica que necesite persistir datos:**

1. Agregar su contrato de repositorio en `src/data/types.ts`:
```typescript
export type WelcomeRepository = {
  findByGuild: (guildId: string) => Promise<WelcomeRecord | null>;
  save: (guildId: string, data: WelcomeRecord) => Promise<void>;
};
```

2. Crear su implementación en `src/data/repositories/mongoWelcomeRepository.ts`
siguiendo el mismo patrón que `mongoSettingsRepository.ts`.

3. Agregarlo en `src/data/index.ts`:
```typescript
export type DataLayer = {
  settingsRepository: SettingsRepository;
  welcomeRepository: WelcomeRepository; // <- agregar aquí
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createMongoProvider();
  await provider.initialize();
  return {
    settingsRepository: createSettingsRepository(provider),
    welcomeRepository: createWelcomeRepository(provider), // <- agregar aquí
  };
}
```

**Estrategia de proveedores:**

Cada proveedor de base de datos tiene su propia rama. Las ramas de desarrollo
contienen los archivos de todos los proveedores, pero solo se compila e instala
el proveedor activo. La diferencia entre ramas se limita a cuatro archivos:

- `src/data/index.ts` — qué proveedor cablea la capa de datos, incluido el
  repositorio de sesiones de chat
- `tsconfig.json` — `exclude` de los archivos del proveedor inactivo
- `package.json` — el driver que se instala
- `pnpm-lock.yaml` — se regenera solo al instalar, pero está versionado y difiere

Los archivos del proveedor inactivo quedan excluidos del build, así que su driver
no hace falta en producción. Para tener soporte del editor al editarlos se instala
como `devDependency`, que se omite en producción (`pnpm prune --prod`). Excepción:
un driver con compilación nativa se omite por completo en las ramas que no lo usan,
para no arriesgar el build en hostings limitados.

El mantenedor decide cuál proveedor queda como default en `main`.

**Agregar un nuevo proveedor:**

1. Crear un archivo en `src/data/providers/` implementando el contrato `DbProvider`
   de `types.ts`, y las implementaciones de repositorio correspondientes en
   `src/data/repositories/`. Ver `mongoSettingsRepository` como referencia.
2. Opcional: crear su repositorio de sesiones en `src/data/repositories/`
   implementando el contrato `SessionRepository` de `types.ts`. Es opcional
   porque **cualquier proveedor puede seguir usando `memorySessionRepository`**,
   que no depende de ninguna base de datos y está disponible para todos. Se crea
   uno propio solo cuando se quiere que el contexto sobreviva a los reinicios,
   guardándolo en el mismo motor del proveedor. Ver `mongoSessionRepository.ts`
   como referencia. En cualquier caso el historial es efímero: se recorta a
   `historyLimit` y vence tras `sessionTtlSeconds`, ambos recibidos por llamada
   en el `SessionPolicy`.
3. Crear la rama del proveedor y ajustar los archivos listados arriba (el lockfile
   se regenera solo al ejecutar `pnpm install`).
4. Activar `rerere` antes del primer merge de mantenimiento:

```bash
git config rerere.enabled true
```

Los merges desde la rama principal hacia una rama de proveedor repiten siempre los
mismos conflictos (los cuatro archivos de configuración). Con `rerere`, Git memoriza
cómo se resolvió cada conflicto y re-aplica esa resolución automáticamente en los
merges siguientes. Es configuración local del clon: cada máquina lo activa una vez.

Toda decisión de almacenamiento —datos y chat— se toma en `src/data/index.ts`:
el punto de arranque nunca nombra una implementación concreta.

## Permisos de Discord requeridos

**Scopes:**
- `bot`
- `applications.commands`

| Permiso | Necesario para |
|---|---|
| `Send Messages` | Respuestas del chat con IA |
| `Add Reactions` | Módulo meme — auto-react |
| `Manage Messages` | Módulo meme — modo solo-media |
| `Manage Roles` | Meme reward — asignar un rol cuando se alcance la meta. |
| `applications.commands` | Registro de slash commands |

> [!WARNING]
> Si se agrega una característica nueva que requiera permisos adicionales:
> - **Permisos del bot** (`Send Messages`, `Add Reactions`, etc.) pueden actualizarse
>   manualmente desde Configuración del servidor → Roles → rol del bot.
> - **Scopes** nuevos (`applications.commands`, etc.) requieren re-invitar el bot
>   con un enlace OAuth2 actualizado.
