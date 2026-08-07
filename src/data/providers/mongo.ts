import mongoose, { type Connection } from "mongoose";
import type { DbProvider } from "../types.js";

const MONGO_URI =
  process.env.MONGODB_URI ?? process.env.MONGO_URL ?? process.env.DATABASE_URL ?? "";

// Bounded on purpose. The driver defaults to 100 sockets per connection, and a
// deploy that briefly overlaps with the previous instance doubles that — enough
// to matter on a small cluster.
const MAX_POOL_SIZE = 10;

export type MongoProvider = DbProvider & {
  connection: Connection;
};

export function createMongoProvider(): MongoProvider {
  if (!MONGO_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  // A connection of its own rather than the global mongoose singleton, so the
  // repositories receive it explicitly and the dependency shows up in their
  // signature instead of being picked out of module state.
  const connection = mongoose.createConnection(MONGO_URI, { maxPoolSize: MAX_POOL_SIZE });

  return {
    name: "mongo",
    connection,

    initialize: async () => {
      await connection.asPromise();
      console.log("[mongo] Connected.");
    },
  };
}
