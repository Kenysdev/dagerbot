import mongoose, { Schema } from "mongoose";

import type { ChatMessage } from "../../core/types.js";
import type { SessionStore } from "../../core/sessionStore.js";

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
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "chats",
    versionKey: false,
  }
);

chatSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ChatSessionModel =
  mongoose.models.ChatSession ??
  mongoose.model<ChatSessionDocument>("ChatSession", chatSessionSchema);

function nextExpiresAt(sessionTtlSeconds: number) {
  return new Date(Date.now() + sessionTtlSeconds * 1000);
}

export function createMongoSessionStore(params: {
  historyLimit: number;
  sessionTtlSeconds: number;
}): SessionStore {
  const { historyLimit, sessionTtlSeconds } = params;

  // $push with $slice appends and trims on the server in a single operation, so
  // two messages arriving at once cannot overwrite each other. The equality
  // filter supplies sessionId to the document created by the upsert.
  async function append(sessionId: string, message: ChatMessage) {
    await ChatSessionModel.updateOne(
      { sessionId },
      {
        $push: { history: { $each: [message], $slice: -historyLimit } },
        $set: { expiresAt: nextExpiresAt(sessionTtlSeconds) },
      },
      { upsert: true }
    );
  }

  return {
    async getHistory(sessionId) {
      if (!historyLimit) return [];

      // Reading used to rewrite the whole history just to refresh the TTL, which
      // could revert an append that landed in between. This only touches
      // expiresAt, and reads in the same atomic operation.
      const row = await ChatSessionModel.findOneAndUpdate(
        { sessionId },
        { $set: { expiresAt: nextExpiresAt(sessionTtlSeconds) } },
        { returnDocument: "after", projection: { history: 1, _id: 0 } }
      ).lean<{ history?: ChatMessage[] }>();

      return Array.isArray(row?.history) ? row.history : [];
    },

    async appendUser(sessionId, text) {
      if (!historyLimit) return;
      await append(sessionId, { role: "user", content: text });
    },

    async appendAssistant(sessionId, text) {
      if (!historyLimit) return;
      await append(sessionId, { role: "assistant", content: text });
    },
  };
}
