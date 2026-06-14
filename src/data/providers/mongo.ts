import mongoose from "mongoose";
import type { DbProvider } from "../types.js";

const MONGO_URI =
  process.env.MONGODB_URI ?? process.env.MONGO_URL ?? process.env.DATABASE_URL ?? "";

export function createMongoProvider(): DbProvider {
  return {
    name: "mongo",

    initialize: async () => {
      if (!MONGO_URI) {
        throw new Error("MONGODB_URI is required.");
      }

      if (mongoose.connection.readyState === 1) {
        console.log("[mongo] Already connected.");
        return;
      }

      await mongoose.connect(MONGO_URI);
      console.log("[mongo] Connected.");
    },
  };
}
