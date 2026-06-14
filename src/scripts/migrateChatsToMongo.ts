import "dotenv/config";

import mongoose, { Schema } from "mongoose";
import { createClient } from "redis";

import type { ChatMessage } from "../core/types.js";

type RedisSessionPayload = {
  history?: unknown;
};

type ChatDocument = {
  _id: string;
  sessionId: string;
  history: ChatMessage[];
  source: "redis";
  migratedAt: Date;
  redisKey: string;
  expiresAt?: Date;
};

const CHAT_COLLECTION = "chats";
const REDIS_KEY_PREFIX = "session:";

const chatSchema = new Schema<ChatDocument>(
  {
    _id: { type: String, required: true },
    sessionId: { type: String, required: true, index: true, unique: true },
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
    source: { type: String, required: true, default: "redis" },
    migratedAt: { type: Date, required: true },
    redisKey: { type: String, required: true },
    expiresAt: { type: Date, required: false },
  },
  {
    collection: CHAT_COLLECTION,
    versionKey: false,
  }
);

const ChatModel =
  mongoose.models.ChatMigration ??
  mongoose.model<ChatDocument>("ChatMigration", chatSchema);

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  const history: ChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (
      (role === "user" || role === "assistant" || role === "system") &&
      typeof content === "string"
    ) {
      history.push({ role, content });
    }
  }
  return history;
}

async function loadSession(
  redis: ReturnType<typeof createClient>,
  key: string
): Promise<{ history: ChatMessage[]; ttlSeconds: number | null }> {
  const raw = await redis.get(key);
  if (!raw) return { history: [], ttlSeconds: null };

  try {
    const parsed = JSON.parse(raw) as RedisSessionPayload;
    return {
      history: parseHistory(parsed.history),
      ttlSeconds: await redis.ttl(key),
    };
  } catch {
    return { history: [], ttlSeconds: await redis.ttl(key) };
  }
}

function computeExpiresAt(ttlSeconds: number | null): Date | undefined {
  if (ttlSeconds === null || ttlSeconds < 0) return undefined;
  return new Date(Date.now() + ttlSeconds * 1000);
}

async function main() {
  const redisUrl = readEnv("REDIS_URL");
  const mongoUri = readEnv("MONGODB_URI");

  const dryRun = process.argv.includes("--dry-run");
  const deleteSource = process.argv.includes("--delete-source");

  const redis = createClient({ url: redisUrl });
  redis.on("error", (err) => {
    console.error("[redis] error:", err);
  });

  await redis.connect();
  await mongoose.connect(mongoUri);

  let scanned = 0;
  let migrated = 0;
  let skippedMalformed = 0;

  try {
    for await (const batch of redis.scanIterator({
      MATCH: `${REDIS_KEY_PREFIX}*`,
      COUNT: 100,
    })) {
      const keys = Array.isArray(batch) ? batch : [batch];

      for (const key of keys) {
        scanned += 1;

        if (typeof key !== "string" || !key.startsWith(REDIS_KEY_PREFIX)) {
          skippedMalformed += 1;
          continue;
        }

        const sessionId = key.slice(REDIS_KEY_PREFIX.length);
        if (!sessionId) {
          skippedMalformed += 1;
          continue;
        }

        const { history, ttlSeconds } = await loadSession(redis, key);

        const doc: ChatDocument = {
          _id: sessionId,
          sessionId,
          history,
          source: "redis",
          migratedAt: new Date(),
          redisKey: key,
          expiresAt: computeExpiresAt(ttlSeconds),
        };

        if (!dryRun) {
          await ChatModel.replaceOne(
            { _id: sessionId },
            doc,
            { upsert: true }
          );
        }

        migrated += 1;

        if (deleteSource && !dryRun) {
          await redis.del(key);
        }
      }
    }
  } finally {
    await redis.quit().catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        deleteSource,
        scanned,
        migrated,
        skippedMalformed,
        collection: CHAT_COLLECTION,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[migrate-chats] failed:", err);
  process.exit(1);
});
