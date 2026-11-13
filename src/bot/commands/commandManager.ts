import {
  MessageFlags,
  REST,
  Routes,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand, SettingsManager } from "../../core/types.js";
import type { DataLayer } from "../../data/index.js";
import { createConfigCommand } from "./config/index.js";
import { createRankCommand } from "./rank/index.js";
// Import additional command creators here

export type CommandManager = {
  route: (interaction: ChatInputCommandInteraction) => Promise<void>;
  registerToDiscord: (
    clientId: string,
    token: string,
    guildId?: string
  ) => Promise<void>;
};

export function createCommandManager(deps: {
  settingsManager: SettingsManager;
  dataLayer: DataLayer;
}): CommandManager {
  const commands = new Map<string, BotCommand>();

  [
    createConfigCommand(deps.settingsManager, deps.dataLayer.channelGuardRepository),
    createRankCommand({ memeRepository: deps.dataLayer.memeRepository }),
    // Add new commands here

  ].forEach((cmd) => commands.set(cmd.name, cmd));

  return {
    route: async (interaction) => {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.handle(interaction);
      } catch (err) {
        console.error(`[commands] /${interaction.commandName} failed:`, err);

        // Fixed text: a dependency's message should not reach Discord. And past
        // Discord's three seconds even answering fails, which must not throw.
        const notice = {
          content: "⚠️ That command could not be completed. Try again in a moment.",
          flags: MessageFlags.Ephemeral,
        } as const;
        await (interaction.replied || interaction.deferred
          ? interaction.followUp(notice)
          : interaction.reply(notice)
        ).catch(() => null);
      }
    },

    registerToDiscord: async (clientId, token, guildId) => {
      const rest = new REST().setToken(token);
      const body = [...commands.values()].map((c) => c.builder.toJSON());

      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body }
        );
        console.log("[commands] Registered to guild.");
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body });
        console.log("[commands] Registered globally.");
      }
    },
  };
}
