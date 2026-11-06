import { Schema, type Model } from "mongoose";
import type { ChannelGuardRecord, ChannelGuardRepository } from "../types.js";
import type { MongoProvider } from "../providers/mongo.js";
import { createStructureGuard } from "../mongoStructure.js";

const COLLECTION = "channel_guard_stats";

const channelGuardSchema = new Schema<ChannelGuardRecord>(
  {
    // unique already declares the index; adding index: true would duplicate it.
    guildId: { type: String, required: true, unique: true },
    panelMessageId: { type: String, required: true, default: "" },
    lastCucumberEaterName: { type: String, required: true, default: "" },
    lastCucumberEaterAt: { type: Number, required: true, default: 0 },
    banCount: { type: Number, required: true, default: 0 },
  },
  {
    collection: COLLECTION,
    versionKey: false,
  }
);

// Carries the NOT NULL and type guarantees to the server, so they hold even for
// writes that do not go through Mongoose.
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "guildId",
      "panelMessageId",
      "lastCucumberEaterName",
      "lastCucumberEaterAt",
      "banCount",
    ],
    properties: {
      guildId: { bsonType: "string" },
      panelMessageId: { bsonType: "string" },
      lastCucumberEaterName: { bsonType: "string" },
      lastCucumberEaterAt: { bsonType: ["int", "long", "double"], minimum: 0 },
      banCount: { bsonType: ["int", "long", "double"], minimum: 0 },
    },
  },
};

const MODEL_NAME = "GuildChannelGuard";
const DUPLICATE_KEY = 11000;

async function retryOnDuplicate<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
    return run();
  }
}

export function createChannelGuardRepository(
  provider: MongoProvider
): ChannelGuardRepository {
  const { connection } = provider;

  const ChannelGuardModel: Model<ChannelGuardRecord> =
    (connection.models[MODEL_NAME] as Model<ChannelGuardRecord> | undefined) ??
    connection.model<ChannelGuardRecord>(MODEL_NAME, channelGuardSchema);

  const ready = createStructureGuard({
    connection,
    model: ChannelGuardModel,
    collection: COLLECTION,
    validator,
  });

  return {
    get: async (guildId) => {
      await ready();
      return (await ChannelGuardModel.findOne({ guildId }).lean()) as
        | ChannelGuardRecord
        | null;
    },

    recordCatch: async (guildId, userName, at) => {
      await ready();
      // The equality filter puts guildId into the inserted document; $inc starts
      // from 0 on an upsert, so the remaining fields only need defaults.
      await retryOnDuplicate(() =>
        ChannelGuardModel.updateOne(
          { guildId },
          {
            $inc: { banCount: 1 },
            $set: {
              lastCucumberEaterName: userName,
              lastCucumberEaterAt: at,
            },
            $setOnInsert: { panelMessageId: "" },
          },
          { upsert: true }
        )
      );
    },

    savePanelMessageId: async (guildId, messageId) => {
      await ready();
      await retryOnDuplicate(() =>
        ChannelGuardModel.updateOne(
          { guildId },
          {
            $set: { panelMessageId: messageId },
            // The remaining required fields need values on first insert.
            $setOnInsert: {
              lastCucumberEaterName: "",
              lastCucumberEaterAt: 0,
              banCount: 0,
            },
          },
          { upsert: true }
        )
      );
    },
  };
}
