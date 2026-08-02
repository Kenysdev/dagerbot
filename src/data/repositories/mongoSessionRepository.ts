import mongoose, { Schema } from "mongoose";

import type { ChatMessage } from "../../core/types.js";
import type { DbProvider, SessionRepository } from "../types.js";

const COLLECTION = "chats";

type ChatSessionDocument = {
  sessionId: string;
  history: ChatMessage[];
  expiresAt: Date;
};

const chatSessionSchema = new Schema<ChatSessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
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

const MODEL_NAME = "ChatSession";

const ChatSessionModel =
  mongoose.models[MODEL_NAME] ??
  mongoose.model<ChatSessionDocument>(MODEL_NAME, chatSessionSchema);

function nextExpiresAt(sessionTtlSeconds: number) {
  return new Date(Date.now() + sessionTtlSeconds * 1000);
}

export function createSessionRepository(_provider: DbProvider): SessionRepository {
  return {
    getHistory: async (sessionId, { historyLimit, sessionTtlSeconds }) => {
      if (!historyLimit) return [];

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
