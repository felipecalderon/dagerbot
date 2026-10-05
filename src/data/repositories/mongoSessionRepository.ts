import { Schema, type Model } from "mongoose";
import type { SessionRepository } from "../types.js";
import type { ChatMessage } from "../../core/types.js";
import type { MongoProvider } from "../providers/mongo.js";
import { createStructureGuard } from "../mongoStructure.js";

const COLLECTION = "chats";

type ChatSessionDocument = {
  sessionId: string;
  history: ChatMessage[];
  expiresAt: Date;
};

const chatSessionSchema = new Schema<ChatSessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true },
    history: {
      type: [
        {
          role: { type: String, required: true },
          content: { type: String, required: true },
        },
      ],
      required: true,
      default: [],
    },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: COLLECTION,
    versionKey: false,
  }
);

// MongoDB drops the document on its own once expiresAt is in the past.
// Equivalent to the SESSION_TTL_SECONDS bookkeeping the memory store does by hand.
chatSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Carries the NOT NULL and type guarantees to the server, so they hold even for
// writes that do not go through Mongoose.
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["sessionId", "history", "expiresAt"],
    properties: {
      sessionId: { bsonType: "string" },
      history: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["role", "content"],
          properties: {
            role: { bsonType: "string" },
            content: { bsonType: "string" },
          },
        },
      },
      expiresAt: { bsonType: "date" },
    },
  },
};

const MODEL_NAME = "ChatSession";

function nextExpiresAt(sessionTtlSeconds: number) {
  return new Date(Date.now() + sessionTtlSeconds * 1000);
}

export function createSessionRepository(provider: MongoProvider): SessionRepository {
  const { connection } = provider;

  const ChatSessionModel: Model<ChatSessionDocument> =
    (connection.models[MODEL_NAME] as Model<ChatSessionDocument> | undefined) ??
    connection.model<ChatSessionDocument>(MODEL_NAME, chatSessionSchema);

  const ready = createStructureGuard({
    connection,
    model: ChatSessionModel,
    collection: COLLECTION,
    validator,
  });

  // The guard runs after the historyLimit check on purpose: a limit of 0 turns
  // chat storage off, and a disabled subsystem should not leave an empty
  // collection behind. The other repositories call ready() first because they
  // have no disabled state.
  return {
    getHistory: async (sessionId, { historyLimit, sessionTtlSeconds }) => {
      if (!historyLimit) return [];
      await ready();

      // Refreshing expiresAt used to rewrite the whole history, which could
      // revert an append landing in between. This only touches expiresAt, and
      // reads in the same atomic operation.
      const row = await ChatSessionModel.findOneAndUpdate(
        { sessionId },
        { $set: { expiresAt: nextExpiresAt(sessionTtlSeconds) } },
        { returnDocument: "after", projection: { history: 1, _id: 0 } }
      ).lean<{ history?: ChatMessage[] }>();

      return Array.isArray(row?.history) ? row.history : [];
    },

    append: async (sessionId, message, { historyLimit, sessionTtlSeconds }) => {
      if (!historyLimit) return;
      await ready();

      // $push with $slice appends and trims on the server in one operation, so
      // two messages arriving at once cannot overwrite each other.
      await ChatSessionModel.updateOne(
        { sessionId },
        {
          $push: { history: { $each: [message], $slice: -historyLimit } },
          $set: { expiresAt: nextExpiresAt(sessionTtlSeconds) },
        },
        { upsert: true }
      );
    },
  };
}
