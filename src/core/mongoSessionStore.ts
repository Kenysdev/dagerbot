import mongoose, { Schema } from "mongoose";

import type { ChatMessage } from "./types.js";
import type { SessionStore } from "./sessionStore.js";

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

function trim(history: ChatMessage[], historyLimit: number) {
  if (history.length <= historyLimit) return;
  history.splice(0, history.length - historyLimit);
}

function nextExpiresAt(sessionTtlSeconds: number) {
  return new Date(Date.now() + sessionTtlSeconds * 1000);
}

export function createMongoSessionStore(params: {
  historyLimit: number;
  sessionTtlSeconds: number;
}): SessionStore {
  const { historyLimit, sessionTtlSeconds } = params;

  async function load(sessionId: string): Promise<ChatMessage[]> {
    const row = await ChatSessionModel.findOne({ sessionId })
      .select({ history: 1, _id: 0 })
      .lean<{ history?: ChatMessage[] }>();
    return Array.isArray(row?.history) ? row.history : [];
  }

  async function save(sessionId: string, history: ChatMessage[]) {
    await ChatSessionModel.updateOne(
      { sessionId },
      {
        $set: {
          sessionId,
          history,
          expiresAt: nextExpiresAt(sessionTtlSeconds),
        },
      },
      { upsert: true }
    );
  }

  return {
    async getHistory(sessionId) {
      if (!historyLimit) return [];
      const history = await load(sessionId);
      await save(sessionId, history);
      return history.slice();
    },

    async appendUser(sessionId, text) {
      if (!historyLimit) return;
      const history = await load(sessionId);
      history.push({ role: "user", content: text });
      trim(history, historyLimit);
      await save(sessionId, history);
    },

    async appendAssistant(sessionId, text) {
      if (!historyLimit) return;
      const history = await load(sessionId);
      history.push({ role: "assistant", content: text });
      trim(history, historyLimit);
      await save(sessionId, history);
    },
  };
}
