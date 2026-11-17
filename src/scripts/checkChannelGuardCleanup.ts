// Note: self-check for the channel-guard retention rules; runs via `pnpm test`.

import assert from "node:assert/strict";
import type { GuildTextBasedChannel } from "discord.js";
import { purgeStaleMessages } from "../bot/events/listeners/channelGuardCleanup.js";
import {
  BULK_DELETE_MAX_AGE_MS,
  bulkDeleteTargets,
  formatLastChannelClear,
} from "../features/channelGuard.js";

const NOW = Date.UTC(2026, 10, 17);
const DAY = 24 * 60 * 60 * 1000;

function message(
  id: string,
  ageDays: number,
  flags: { pinned?: boolean; bot?: boolean } = {}
) {
  return {
    id,
    createdTimestamp: NOW - ageDays * DAY,
    pinned: flags.pinned ?? false,
    author: { bot: flags.bot ?? false },
  };
}

const page = [
  message("panel", 30),
  message("pinned", 30, { pinned: true }),
  message("bot", 30, { bot: true }),
  message("ancient", 20),
  message("recent", 2),
];

const { bulk, single } = bulkDeleteTargets(page, "panel", NOW);

assert.deepEqual(
  bulk.map((m) => m.id),
  ["recent"],
  "messages inside the bulk window go through bulk delete"
);
assert.deepEqual(
  single.map((m) => m.id),
  ["ancient"],
  "messages past the bulk limit are deleted one by one"
);

assert.equal(BULK_DELETE_MAX_AGE_MS, 13 * DAY);

const stamp = `<t:${Math.floor(NOW / 1000)}:R>`;
assert.equal(formatLastChannelClear(0, 0), "Todavía no.");
assert.equal(formatLastChannelClear(undefined, undefined), "Todavía no.");
assert.equal(formatLastChannelClear(NOW, 1), `${stamp} (1 mensaje)`);
assert.equal(formatLastChannelClear(NOW, 7), `${stamp} (7 mensajes)`);

// Note: must walk past exempt messages and stop at the start of the channel.
const BASE_ID = 10_000_000_000_000_000n;

function fakeMessage(index: number, ageDays: number, flags: { pinned?: boolean } = {}) {
  return {
    id: String(BASE_ID + BigInt(index)),
    createdTimestamp: NOW - ageDays * DAY,
    pinned: flags.pinned ?? false,
    author: { bot: false },
    deleted: false,
    async delete() {
      this.deleted = true;
    },
  };
}

async function checkPaging(): Promise<void> {
  const panel = fakeMessage(0, 30);
  const all = [
    panel,
    fakeMessage(1, 30, { pinned: true }),
    ...Array.from({ length: 250 }, (_, i) => fakeMessage(i + 2, 2)),
  ];

  const fakeChannel = {
    messages: {
      fetch: async ({ before, limit }: { before: string; limit: number }) => {
        const page = all
          .filter((m) => !m.deleted && BigInt(m.id) < BigInt(before))
          .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
          .slice(0, limit);
        return {
          size: page.length,
          values: () => page.values(),
          last: () => page[page.length - 1],
        };
      },
    },
    bulkDelete: async (batch: typeof all) => {
      for (const message of batch) message.deleted = true;
      return { size: batch.length };
    },
  } as unknown as GuildTextBasedChannel;

  const removed = await purgeStaleMessages(fakeChannel, panel.id, NOW);

  assert.equal(removed, 250, "every stale chat message is deleted exactly once");
  assert.equal(panel.deleted, false, "the panel survives");
  assert.equal(all[1].deleted, false, "pinned messages survive");
}

checkPaging()
  .then(() => console.log("channel-guard cleanup checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
