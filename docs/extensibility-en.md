# Extensibility Guide

This document covers the three core modules introduced to make the bot extensible.
It is intended for contributors who want to add new features.

---

## Core modules overview

```
New feature
  ├── reads config    →  Settings Manager   (src/config/settingsManager.ts)
  ├── adds a command  →  Command Manager    (src/bot/commands/commandManager.ts)
  └── handles events  →  Event Dispatcher   (src/bot/events/)
```

> [!IMPORTANT]
> The three core modules are never modified when adding a new feature.
> They are only **extended** — a new entry is added, nothing existing is changed.

---

## Core 1 — Settings Manager

Stores each guild's configuration as a versioned JSON row in SQLite, indexed by `guildId`.
One row per server — each row holds the complete configuration for that server,
plus a `version` number for future migration support.

**When adding a new feature, only two things change:**

1. Add the feature's defaults inside `defaultSettings()` in `settingsManager.ts`.
2. Add its types to `src/core/types.ts`.

Auto-merge handles the rest: on the next restart, every existing guild receives
the new fields automatically — no manual migration needed.

---

## Core 2 — Command Manager

Central registry for all slash commands. Handles Discord API registration and
interaction routing from a single place.

**Adding a new top-level command (e.g. `/poll`):**

1. Create `src/bot/commands/poll/index.ts` — export `createPollCommand(settingsManager)`.
2. Add one line in `src/bot/discordBot.ts`:

```typescript
commands.add(createPollCommand(settingsManager));
```

**Adding a subcommand to `/config`:**

Each feature defines one file that registers both the builder definition and the handler:

```typescript
// src/bot/commands/config/subcommands/yourFeature.ts
export function yourFeatureSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand(/* define options */);
  handlers.set("your-feature", handleYourFeature);
}
```

Then add one line in `src/bot/commands/config/index.ts`:

```typescript
yourFeatureSubcommand(builder, subcommands);
```

---

## Core 3 — Event Dispatcher

One file per Discord event type. Each file contains a single listener that delegates
to every feature that needs that event.

**Never register a new `client.on()` call outside these files.**

Current event files:

| File | Discord event | Used by |
|---|---|---|
| `src/bot/events/onMessageCreate.ts` | `MessageCreate` | Meme module |

**Adding a feature to an existing event:**

Open the existing file `src/bot/events/onMessageCreate.ts` and add directly inside it:

1. A private handler function at the top of the file
2. A call to that function inside the existing listener

```typescript
// src/bot/events/onMessageCreate.ts (existing file — add inside it)

// Step 1: add your private handler function near the top
async function handleYourFeature(
  message: Message,
  config: YourFeatureSettings
): Promise<void> {
  if (!config.enabled) return;
  // ...your logic here
}

// Step 2: call it inside the existing listener, after the current handlers
// (the listener already exists — just add the line below inside it)
await handleYourFeature(message, settings.yourFeature).catch((err) => {
  console.error("[yourFeature] Error:", err);
});
```

The Discord event (`Events.MessageCreate`) is already registered — you are extending
the existing listener, not creating a new one.

**Adding a feature that needs a new event:**

Create a new file for that event type. Example — greeting new members on join:

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

Register the new event file in `src/bot/discordBot.ts`:
add the import at the top of the file:

```typescript
import { registerGuildMemberAddEvent } from "./events/onGuildMemberAdd.js";
```

Then call it after registerMessageCreateEvent:

```typescript
registerGuildMemberAddEvent(client, settingsManager);
```

---

## Step-by-step: adding a new feature

### 1. Types — `src/core/types.ts`

```typescript
export type WelcomeSettings = {
  enabled: boolean;
  channelId: string;
  message: string;
};

export type AppSettings = {
  meme: MemeSettings;
  welcome: WelcomeSettings; // <- add here
};
```

### 2. Defaults — `src/config/settingsManager.ts`

```typescript
function defaultSettings(): AppSettings {
  return {
    meme: { /* ... */ },
    welcome: {
      enabled: false,
      channelId: "",
      message: "Welcome, {user}!",
    },
  };
}
```

### 3. Feature logic — `src/features/welcome.ts`

Pure functions only. No discord.js imports.

```typescript
export function buildWelcomeMessage(template: string, username: string): string {
  return template.replace("{user}", username);
}
```

### 4. Event — `src/bot/events/onGuildMemberAdd.ts`

Create the file as shown in the Core 3 section above.
Register it in `discordBot.ts` with one line.

### 5. Subcommand — `src/bot/commands/config/subcommands/welcome.ts`

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
  // read options → clone settings → modify → saveSettings → reply
}
```

>[!IMPORTANT]
>For the feature to appear in /config show, add its status in the show.ts handler following the same pattern used for meme.

### 6. Register — `src/bot/commands/config/index.ts`

```typescript
import { welcomeSubcommand } from "./subcommands/welcome.js";
welcomeSubcommand(builder, subcommands);
```

---

## Required Discord permissions

**Scopes:**
- `bot`
- `applications.commands`

| Permission | Required for |
|---|---|
| `Send Messages` | AI chat responses |
| `Add Reactions` | Meme module — auto-react |
| `Manage Messages` | Meme module — media-only mode |
| `applications.commands` | Slash command registration |

> [!WARNING]
> If a new feature requires additional permissions:
> - **Bot permissions** (`Send Messages`, `Add Reactions`, etc.) can be updated manually
>   from Server Settings → Roles → bot role.
> - **New scopes** (`applications.commands`, etc.) require re-inviting the bot
>   with an updated OAuth2 URL.
