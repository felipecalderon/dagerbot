import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { MemeRepository } from "../../../../data/types.js";
import { formatRankPage } from "../../../../features/meme.js";
import { createCooldown } from "../../../../core/rateLimit.js";

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT_MS = 5 * 60 * 1000;

const allowRankMeme = createCooldown(5);

type SubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  memeRepository: MemeRepository
) => Promise<void>;

const buildEmbed = (description: string) =>
  new EmbedBuilder()
    .setTitle("🏆 Meme Ranking")
    .setDescription(description)
    .setColor(0x5865f2);

const buildRow = (page: number, totalPages: number) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("rank_prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId("rank_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages)
  );

const fetchPage = async (
  memeRepository: MemeRepository,
  guildId: string,
  page: number
) => {
  const offset = (page - 1) * PAGE_SIZE;
  const counts = await memeRepository.getTopCounts(guildId, PAGE_SIZE, offset);
  return counts.map((entry, i) => ({
    position: offset + i + 1,
    userId: entry.userId,
    count: entry.count,
  }));
};

const handler: SubcommandHandler = async (interaction, memeRepository) => {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (!allowRankMeme(`${guildId}:${userId}`)) {
    await interaction.reply({
      content: "⏳ Wait 5 seconds before checking the ranking again.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const totalUsers = await memeRepository.getTotalUsers(guildId);

  if (totalUsers === 0) {
    await interaction.reply({
      embeds: [buildEmbed("No memes registered in this server yet. Be the first!")],
    });
    return;
  }

  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);
  let page = 1;

  const entries = await fetchPage(memeRepository, guildId, page);

  const response = await interaction.reply({
    embeds: [buildEmbed(formatRankPage(entries, page, totalPages))],
    components: totalPages > 1 ? [buildRow(page, totalPages)] : [],
  });

  if (totalPages <= 1) return;

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECTOR_TIMEOUT_MS,
  });

  // A collector callback is an async listener like any other: a rejection here
  // has nowhere to go and takes the process down. Turning a page must not.
  collector.on("collect", async (btn) => {
    try {
      await btn.deferUpdate();

      const newPage = btn.customId === "rank_next" ? page + 1 : page - 1;

      if (newPage < 1 || newPage > totalPages) return;

      // Advanced only once the page is in hand, so a failed read leaves the
      // counter agreeing with the message still on screen.
      const pageEntries = await fetchPage(memeRepository, guildId, newPage);
      page = newPage;

      await btn.editReply({
        embeds: [buildEmbed(formatRankPage(pageEntries, page, totalPages))],
        components: [buildRow(page, totalPages)],
      });
    } catch (err) {
      console.error(`[rank] guild=${guildId}: could not turn the page:`, err);
    }
  });

  collector.on("end", async () => {
    await interaction.editReply({ components: [] }).catch(() => null);
  });
};

export function rankMemeSubcommand(
  builder: SlashCommandBuilder,
  subcommands: Map<string, SubcommandHandler>
): void {
  builder.addSubcommand((sub) =>
    sub.setName("meme").setDescription("Top meme posters in this server")
  );
  subcommands.set("meme", handler);
}

