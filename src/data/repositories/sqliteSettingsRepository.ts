import type { SqliteProvider } from "../providers/sqlite.js";
import type { SettingsRepository } from "../types.js";

const TABLE = "guild_settings";


export function createSettingsRepository(
  provider: SqliteProvider
): SettingsRepository {
  const { db } = provider;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      guild_id   TEXT PRIMARY KEY,
      settings   TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const selectStmt = db.prepare<[string], { settings: string }>(
    `SELECT settings FROM ${TABLE} WHERE guild_id = ?`
  );

  const upsertStmt = db.prepare<[string, string, number]>(`
    INSERT INTO ${TABLE} (guild_id, settings, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      settings   = excluded.settings,
      updated_at = excluded.updated_at
  `);

  return {
    findById: async (guildId) => {
      const row = selectStmt.get(guildId);
      return row?.settings ?? null;
    },

    save: async (guildId, raw) => {
      upsertStmt.run(guildId, raw, Date.now());
    },

    repairAll: (repairFn) => {
      const rows = db
        .prepare<[], { guild_id: string; settings: string }>(
          `SELECT guild_id, settings FROM ${TABLE}`
        )
        .all();

      for (const row of rows) {
        try {
          const repaired = repairFn(row.settings);
          upsertStmt.run(row.guild_id, repaired, Date.now());
        } catch {
          console.error(`[settings] Could not repair guild ${row.guild_id} — skipping.`);
        }
      }
    },
  };
}
