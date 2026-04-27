# Guía de Extensibilidad

Este documento cubre los tres módulos base introducidos para hacer el bot extensible.
Está dirigido a colaboradores que deseen agregar nuevas características.

---

## Visión general

```
Nueva característica
  ├── lee configuración  →  Settings Manager   (src/config/settingsManager.ts)
  ├── agrega un comando  →  Command Manager    (src/bot/commands/commandManager.ts)
  └── maneja eventos     →  Event Dispatcher   (src/bot/events/)
```

> [!IMPORTANT]
> Los tres módulos base **nunca se modifican** al agregar una característica nueva.
> Solo se **extienden** — se agrega una entrada nueva sin tocar el código existente.

---

## Módulo base 1 — Settings Manager

Almacena la configuración de cada servidor como una fila JSON versionada en SQLite,
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
2. Agregar una línea en `src/bot/discordBot.ts`:

```typescript
commands.add(createPollCommand(settingsManager));
```

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

Un archivo por tipo de evento de Discord. Cada archivo contiene un único listener
que delega a cada característica que necesita ese evento.

**Nunca registrar un nuevo `client.on()` fuera de estos archivos.**

Archivos de eventos actuales:

| Archivo | Evento de Discord | Usado por |
|---|---|---|
| `src/bot/events/onMessageCreate.ts` | `MessageCreate` | Módulo meme |

**Agregar una característica a un evento existente:**

Abrir el archivo existente `src/bot/events/onMessageCreate.ts` y agregar directamente dentro de él:

1. Una función handler privada en la parte superior del archivo
2. Una llamada a esa función dentro del listener existente

```typescript
// src/bot/events/onMessageCreate.ts (archivo existente — agregar dentro de él)

// Paso 1: agregar la función handler privada cerca de la parte superior
async function handleYourFeature(
  message: Message,
  config: YourFeatureSettings
): Promise<void> {
  if (!config.enabled) return;
  // ...tu lógica aquí
}

// Paso 2: llamarla dentro del listener existente, después de los handlers actuales
// (el listener ya existe — solo agregar la línea abajo dentro de él)
await handleYourFeature(message, settings.yourFeature).catch((err) => {
  console.error("[yourFeature] Error:", err);
});
```

El evento de Discord (`Events.MessageCreate`) ya está registrado — se está extendiendo
el listener existente, no creando uno nuevo.

**Agregar una característica que necesita un evento nuevo:**

Crear un archivo nuevo para ese tipo de evento. Ejemplo — dar bienvenida a nuevos miembros:

```typescript
// src/bot/events/onGuildMemberAdd.ts
import { Events, type Client, type GuildMember } from "discord.js";
import type { SettingsManager } from "../../core/types.js";

async function handleWelcomeFeature(
  member: GuildMember,
  config: WelcomeSettings
): Promise<void> {
  if (!config.enabled || !config.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel?.isTextBased()) return;
  await channel.send(config.message.replace("{user}", member.displayName));
}

export function registerGuildMemberAddEvent(
  client: Client,
  settingsManager: SettingsManager
): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    const settings = await settingsManager.getSettings(member.guild.id);
    await handleWelcomeFeature(member, settings.welcome).catch((err) => {
      console.error("[welcomeFeature] Error:", err);
    });
  });
}
```
Registra el nuevo archivo de evento en src/bot/discordBot.ts.

Agrega la importación en la parte superior del archivo:

```typescript
import { registerGuildMemberAddEvent } from "./events/onGuildMemberAdd.js";
```
Luego llámalo después de registerMessageCreateEvent:
```typescript
registerGuildMemberAddEvent(client, settingsManager);
```

---

## Paso a paso: agregar una nueva característica

### 1. Tipos en `src/core/types.ts`

```typescript
export type WelcomeSettings = {
  enabled: boolean;
  channelId: string;
  message: string;
};

export type AppSettings = {
  meme: MemeSettings;
  welcome: WelcomeSettings; // <- agregar aquí
};
```

### 2. Valores por defecto en `src/config/settingsManager.ts`

```typescript
function defaultSettings(): AppSettings {
  return {
    meme: { /* ... */ },
    welcome: {
      enabled: false,
      channelId: "",
      message: "¡Bienvenido, {user}!",
    },
  };
}
```

### 3. Lógica pura en `src/features/welcome.ts`

Solo funciones puras. Cero imports de discord.js.

```typescript
export function buildWelcomeMessage(plantilla: string, nombreUsuario: string): string {
  return plantilla.replace("{user}", nombreUsuario);
}
```

### 4. Evento en `src/bot/events/onGuildMemberAdd.ts`

Crear el archivo como se muestra en la sección del Módulo base 3.
Registrarlo en `discordBot.ts` con una línea.

### 5. Subcomando en `src/bot/commands/config/subcommands/welcome.ts`

```typescript
export function welcomeSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub.setName("welcome").setDescription("View or update welcome settings")
  );
  handlers.set("welcome", handleWelcome);
}

async function handleWelcome(
  interaction: ChatInputCommandInteraction,
  settingsManager: SettingsManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command only works in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // leer opciones → clonar settings → modificar → saveSettings → responder
}
```

> [!IMPORTANT]
> Para que la característica aparezca en /config show, agregar su estado en el handler de show.ts siguiendo el patrón de meme.

### 6. Registrar en `src/bot/commands/config/index.ts`

```typescript
import { welcomeSubcommand } from "./subcommands/welcome.js";
welcomeSubcommand(builder, subcommands);
```

---

## Permisos de Discord requeridos

**Scopes:**
- `bot`
- `applications.commands`

| Permiso | Necesario para |
|---|---|
| `Send Messages` | Respuestas del chat con IA |
| `Add Reactions` | Módulo meme — auto-react |
| `Manage Messages` | Módulo meme — modo solo-media |
| `applications.commands` | Registro de slash commands |

> [!WARNING]
> Si se agrega una característica nueva que requiera permisos adicionales:
> - **Permisos del bot** (`Send Messages`, `Add Reactions`, etc.) pueden actualizarse
>   manualmente desde Configuración del servidor → Roles → rol del bot.
> - **Scopes** nuevos (`applications.commands`, etc.) requieren re-invitar el bot
>   con un enlace OAuth2 actualizado.
