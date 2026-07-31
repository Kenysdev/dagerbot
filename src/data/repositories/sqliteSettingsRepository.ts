import type { SqliteProvider } from "../providers/sqlite.js";
import type { SettingsRepository } from "../types.js";

const TABLE = "guild_settings";


type Db = SqliteProvider["db"];

// STRICT only. Rows hold a settings JSON blob that grows with every feature,
// and WITHOUT ROWID is meant for tables with short rows.
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    guild_id   TEXT    PRIMARY KEY,
    settings   TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT
`;

// Transitional, introduced in 2.1.0: tables created before it are not STRICT, and
// STRICT cannot be added with ALTER TABLE, so the table is rebuilt by moving the
// old one aside and copying the rows back in.
//
// Retiring it is a pure deletion: remove this function and its call in
// ensureStructure. Nothing else changes.
function migrateLegacyTable(db: Db): void {
  const existing = (db.pragma(`table_list('${TABLE}')`) as Array<{ strict?: number }>)[0];
  if (!existing || existing.strict === 1) return;

  db.transaction(() => {
    db.exec(`ALTER TABLE ${TABLE} RENAME TO ${TABLE}__legacy`);
    db.exec(CREATE_TABLE);
    db.exec(`
      INSERT INTO ${TABLE} (guild_id, settings, updated_at)
      SELECT guild_id, settings, updated_at FROM ${TABLE}__legacy
    `);
    db.exec(`DROP TABLE ${TABLE}__legacy`);
  })();
  console.log(`[sqlite] Rebuilt ${TABLE} as a STRICT table.`);
}

function ensureStructure(db: Db): void {
  migrateLegacyTable(db);
  db.exec(CREATE_TABLE);
}

export function createSettingsRepository(
  provider: SqliteProvider
): SettingsRepository {
  const { db } = provider;

  ensureStructure(db);

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

    repairAll: async (repairFn) => {
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
