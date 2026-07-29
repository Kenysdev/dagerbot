import mongoose, { Schema } from "mongoose";
import type { DbProvider } from "../types.js";
import type { MemeCount, MemeRepository } from "../types.js";
import { createStructureGuard } from "../mongoStructure.js";

type MemeDocument = {
  guildId: string;
  userId: string;
  count: number;
  startedAt: number;
  updatedAt: number;
};

const COLLECTION = "meme_counts";

const memeSchema = new Schema<MemeDocument>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    startedAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
  },
  {
    collection: COLLECTION,
    versionKey: false,
  }
);

// Equivalent to PRIMARY KEY (guild_id, user_id) on the SQLite side.
memeSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Supports the ranking query: filter by guild, order by count, break ties by
// userId. Mirrors idx_meme_counts_leaderboard on the SQLite side.
memeSchema.index({ guildId: 1, count: -1, userId: 1 });

// Carries the NOT NULL and type guarantees to the server, so they hold even for
// writes that do not go through Mongoose. Mirrors STRICT on the SQLite side.
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["guildId", "userId", "count", "startedAt", "updatedAt"],
    properties: {
      guildId: { bsonType: "string" },
      userId: { bsonType: "string" },
      count: { bsonType: ["int", "long", "double"], minimum: 0 },
      startedAt: { bsonType: ["int", "long", "double"] },
      updatedAt: { bsonType: ["int", "long", "double"] },
    },
  },
};

const DUPLICATE_KEY = 11000;

const MemeModel =
  mongoose.models.GuildMemeCount ??
  mongoose.model<MemeDocument>("GuildMemeCount", memeSchema);

function rowToMemeCount(row: MemeDocument): MemeCount {
  return {
    guildId: row.guildId,
    userId: row.userId,
    count: row.count,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
  };
}

// Adding count to $setOnInsert would raise ConflictingUpdateOperators, and it is
// not needed: on an upsert, $inc starts from 0. The equality filter is what puts
// guildId and userId into the inserted document.
function incrementOnce(guildId: string, userId: string, now: number) {
  return MemeModel.findOneAndUpdate(
    { guildId, userId },
    {
      $setOnInsert: { startedAt: now },
      $inc: { count: 1 },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: "after" }
  ).lean() as Promise<MemeDocument | null>;
}

export function createMemeRepository(_provider: DbProvider): MemeRepository {
  const ready = createStructureGuard({
    connection: mongoose.connection,
    model: MemeModel,
    collection: COLLECTION,
    validator,
  });

  return {
    increment: async (guildId, userId) => {
      await ready();
      const now = Date.now();

      let row: MemeDocument | null;
      try {
        row = await incrementOnce(guildId, userId, now);
      } catch (error) {
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
        // Two concurrent upserts raced to insert the same pair and the unique
        // index rejected this one. The document exists now, so the retry lands
        // as a plain update.
        row = await incrementOnce(guildId, userId, now);
      }

      if (!row) {
        throw new Error("Failed to increment meme count.");
      }

      return rowToMemeCount(row);
    },

    getCount: async (guildId, userId) => {
      await ready();
      const row = (await MemeModel.findOne({ guildId, userId })
        .select({ count: 1, _id: 0 })
        .lean()) as Pick<MemeDocument, "count"> | null;
      return row?.count ?? 0;
    },

    getTopCounts: async (guildId, limit, offset) => {
      await ready();
      const rows = (await MemeModel.find({ guildId })
        .sort({ count: -1, userId: 1 })
        .skip(offset)
        .limit(limit)
        .lean()) as MemeDocument[];
      return rows.map(rowToMemeCount);
    },

    getTotalUsers: async (guildId) => {
      await ready();
      return MemeModel.countDocuments({ guildId });
    },
  };
}
