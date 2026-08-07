import { Schema, type Model } from "mongoose";
import type { SettingsRepository } from "../types.js";
import type { MongoProvider } from "../providers/mongo.js";
import { createStructureGuard } from "../mongoStructure.js";

const COLLECTION = "guild_settings";

type SettingsDocument = {
  guildId: string;
  settings: string;
  updatedAt: number;
};

const settingsSchema = new Schema<SettingsDocument>(
  {
    // unique already declares the index; adding index: true would duplicate it.
    guildId: { type: String, required: true, unique: true },
    settings: { type: String, required: true },
    updatedAt: { type: Number, required: true },
  },
  {
    collection: COLLECTION,
    versionKey: false,
  }
);

// Carries the NOT NULL and type guarantees to the server, so they hold even for
// writes that do not go through Mongoose. Mirrors STRICT on the SQLite side.
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["guildId", "settings", "updatedAt"],
    properties: {
      guildId: { bsonType: "string" },
      settings: { bsonType: "string" },
      updatedAt: { bsonType: ["int", "long", "double"] },
    },
  },
};

const MODEL_NAME = "GuildSettings";

export function createSettingsRepository(provider: MongoProvider): SettingsRepository {
  const { connection } = provider;

  const SettingsModel: Model<SettingsDocument> =
    (connection.models[MODEL_NAME] as Model<SettingsDocument> | undefined) ??
    connection.model<SettingsDocument>(MODEL_NAME, settingsSchema);

  const ready = createStructureGuard({
    connection,
    model: SettingsModel,
    collection: COLLECTION,
    validator,
  });

  return {
    findById: async (guildId) => {
      await ready();
      const row = (await SettingsModel.findOne({ guildId })
        .select({ settings: 1, _id: 0 })
        .lean()) as Pick<SettingsDocument, "settings"> | null;
      return row?.settings ?? null;
    },

    save: async (guildId, raw) => {
      await ready();
      const now = Date.now();
      await SettingsModel.updateOne(
        { guildId },
        {
          $set: { settings: raw, updatedAt: now },
          $setOnInsert: { guildId },
        },
        { upsert: true }
      );
    },

    repairAll: async (repairFn) => {
      await ready();
      const rows = (await SettingsModel.find()
        .select({ guildId: 1, settings: 1, _id: 0 })
        .lean()) as Array<Pick<SettingsDocument, "guildId" | "settings">>;

      for (const row of rows) {
        try {
          const repaired = repairFn(row.settings);
          await SettingsModel.updateOne(
            { guildId: row.guildId },
            {
              $set: { settings: repaired, updatedAt: Date.now() },
              $setOnInsert: { guildId: row.guildId },
            },
            { upsert: true }
          );
        } catch {
          console.error(`[settings] Could not repair guild ${row.guildId} - skipping.`);
        }
      }
    },
  };
}
