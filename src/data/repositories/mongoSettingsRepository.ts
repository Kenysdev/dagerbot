import mongoose, { Schema } from "mongoose";
import type { DbProvider } from "../types.js";
import type { SettingsRepository } from "../types.js";

type SettingsDocument = {
  guildId: string;
  settings: string;
  updatedAt: number;
};

const settingsSchema = new Schema<SettingsDocument>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    settings: { type: String, required: true },
    updatedAt: { type: Number, required: true },
  },
  {
    collection: "guild_settings",
    versionKey: false,
  }
);

const SettingsModel =
  mongoose.models.GuildSettings ??
  mongoose.model<SettingsDocument>("GuildSettings", settingsSchema);

export function createSettingsRepository(_provider: DbProvider): SettingsRepository {
  return {
    findById: async (guildId) => {
      const row = (await SettingsModel.findOne({ guildId })
        .select({ settings: 1, _id: 0 })
        .lean()) as Pick<SettingsDocument, "settings"> | null;
      return row?.settings ?? null;
    },

    save: async (guildId, raw) => {
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
