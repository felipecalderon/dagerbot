import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type MessageCreateOptions,
  type TextBasedChannel,
} from "discord.js";
import type { ChannelGuardRecord, ChannelGuardRepository } from "../../../data/types.js";
import { formatMostRecentCucumberEater } from "../../../features/channelGuard.js";

const THUMBNAIL_URL = "https://media.discordapp.net/attachments/399455020900417546/1568383332113195008/zd50j5b.png?ex=6aef9e4d&is=6aee4ccd&hm=edbe59ec44526025ec62e722b2e7f905609e38938e9e66cc69a4515df5d7c737&=&format=webp&quality=lossless";

const UNKNOWN_MESSAGE = 10008;

type PanelPayload = {
  flags: MessageFlags.IsComponentsV2;
  components: NonNullable<MessageCreateOptions["components"]>;
};

const panelSyncs = new Map<string, Promise<void>>();

export function buildCucumberPanelPayload(
  record: ChannelGuardRecord | null
): PanelPayload {
  const cucumberEater =
    record && record.lastCucumberEaterAt > 0
      ? { name: record.lastCucumberEaterName, caughtAt: record.lastCucumberEaterAt }
      : null;

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.Container,
        components: [
          {
            type: ComponentType.Section,
            components: [
              {
                type: ComponentType.TextDisplay,
                content: [
                  "## NO MANDES MENSAJE EN ESTE CANAL",
                  "",
                  "Este canal es para gente que quiera pepinos.",
                  "Todo aquel que envíe mensaje en este canal será baneado automaticamente y metido un pepino por el oscuro.",
                  "",
                  "**Último en recibir un pepinazo:**",
                  formatMostRecentCucumberEater(cucumberEater),
                ].join("\n"),
              },
            ],
            accessory: {
              type: ComponentType.Thumbnail,
              media: { url: THUMBNAIL_URL },
            },
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: "channel-guard-bans",
                label: `Pepinazos: ${record?.banCount ?? 0}`,
                emoji: { name: "🥒" },
                disabled: true,
              },
            ],
          },
        ],
      },
    ],
  };
}

async function syncPanelNow(
  channel: TextBasedChannel,
  guildId: string,
  repository: ChannelGuardRepository
): Promise<void> {
  if (!channel.isSendable()) return;

  const record = await repository.get(guildId);
  const payload = buildCucumberPanelPayload(record);

  if (record?.panelMessageId) {
    try {
      const existing = await channel.messages.fetch(record.panelMessageId);
      if (existing.flags.has(MessageFlags.IsComponentsV2)) {
        await existing.edit(payload);
        return;
      }
      // A classic embed cannot hold a button inside it, so replace it once.
      await existing.delete();
    } catch (error) {
      // Only a deleted panel gets replaced; other errors are real failures.
      if ((error as { code?: number }).code !== UNKNOWN_MESSAGE) throw error;
    }
  }

  const message = await channel.send(payload);
  await repository.savePanelMessageId(guildId, message.id);
}

export async function syncCucumberPanel(
  channel: TextBasedChannel,
  guildId: string,
  repository: ChannelGuardRepository
): Promise<void> {
  const previous = panelSyncs.get(guildId) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => syncPanelNow(channel, guildId, repository));

  panelSyncs.set(guildId, current);
  try {
    await current;
  } finally {
    if (panelSyncs.get(guildId) === current) {
      panelSyncs.delete(guildId);
    }
  }
}
