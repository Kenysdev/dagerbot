import mongoose, { Schema } from "mongoose";
import type { DbProvider } from "../types.js";
import type { MemeCount, MemeRepository } from "../types.js";

type MemeDocument = {
  guildId: string;
  userId: string;
  count: number;
  startedAt: number;
  updatedAt: number;
};

const memeSchema = new Schema<MemeDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 0 },
    startedAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
  },
  {
    collection: "meme_counts",
    versionKey: false,
  }
);

memeSchema.index({ guildId: 1, userId: 1 }, { unique: true });

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

export function createMemeRepository(_provider: DbProvider): MemeRepository {
  return {
    increment: async (guildId, userId) => {
      const now = Date.now();
      const row = (await MemeModel.findOneAndUpdate(
        { guildId, userId },
        {
          $setOnInsert: {
            guildId,
            userId,
            count: 0,
            startedAt: now,
          },
          $inc: { count: 1 },
          $set: { updatedAt: now },
        },
        { upsert: true, new: true }
      ).lean()) as MemeDocument | null;

      if (!row) {
        throw new Error("Failed to increment meme count.");
      }

      return rowToMemeCount(row);
    },

    getCount: async (guildId, userId) => {
      const row = (await MemeModel.findOne({ guildId, userId })
        .select({ count: 1, _id: 0 })
        .lean()) as Pick<MemeDocument, "count"> | null;
      return row?.count ?? 0;
    },

    getTopCounts: async (guildId, limit, offset) => {
      const rows = (await MemeModel.find({ guildId })
        .sort({ count: -1, userId: 1 })
        .skip(offset)
        .limit(limit)
        .lean()) as MemeDocument[];
      return rows.map(rowToMemeCount);
    },

    getTotalUsers: async (guildId) => {
      return MemeModel.countDocuments({ guildId });
    },
  };
}
