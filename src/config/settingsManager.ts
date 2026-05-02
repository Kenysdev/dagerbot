import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { AppSettings, SettingsManager } from "../core/types.js";

/**
 * Dynamic settings manager — multi-server implementation.
 *
 * Stores each guild's config as a versioned JSON row in SQLite, keyed by guildId.
 * On startup, auto-repairs all guilds to ensure new feature fields are present.
 * Can be swapped for PostgreSQL by replacing only this file.
 *
 * Adding a new feature:
 *   1. Add its types to core/types.ts
 *   2. Add its defaults to defaultSettings() below
 *   3. Call getSettings(guildId) wherever needed
 *   See docs/extensibility-es.md for the full guide.
 */

const CURRENT_SETTINGS_VERSION = 1;

const DB_PATH = path.resolve(process.cwd(), "data/bot.db");

function ensureDataDir(): void {
  // SQLite fails silently if the directory doesn't exist — create it proactively
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Source of truth for default values.
// When adding a new feature, add its defaults here.
function defaultSettings(): AppSettings {
  return {
    meme: {
      channelId: "",
      autoReact: { enabled: false, random: false, emojis: ["🔥", "😂", "👍"] },
      mediaOnly: { enabled: false },
    },
  };
}

// Deep merge: fills missing fields with defaults without overwriting existing values.
// Handles arrays as complete user preferences — never merges array elements individually.
// This allows adding new features without writing migrations for existing guilds.
function mergeDefaults<T>(defaults: T, data: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(data) && data.length > 0 ? data : defaults) as T;
  }
  if (typeof defaults !== "object" || defaults === null) {
    return (data !== undefined && data !== null ? data : defaults) as T;
  }
  const result: Record<string, unknown> = {};
  for (const key in defaults) {
    result[key] = mergeDefaults(
      (defaults as Record<string, unknown>)[key],
      (data as Record<string, unknown> | null | undefined)?.[key]
    );
  }
  return result as T;
}

type GuildRow = { guild_id: string; settings: string };
type StoredRow = { version: number; data: AppSettings };

// Runs at startup: merges all stored guild configs with current defaults.
// Ensures existing guilds get new feature fields without manual migrations.
// On parse errors, logs and skips — never crashes the bot.
function repairAllGuilds(
  db: Database.Database,
  upsertStmt: Database.Statement<[string, string, number]>
): void {
  const rows = db
    .prepare<[], GuildRow>("SELECT guild_id, settings FROM guild_settings")
    .all();

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.settings) as StoredRow | AppSettings;
      // Support both old format (raw AppSettings) and new format ({ version, data })
      const rawData = "data" in parsed ? parsed.data : parsed;
      const repaired = mergeDefaults(defaultSettings(), rawData);
      upsertStmt.run(
        row.guild_id,
        JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: repaired }),
        Date.now()
      );
    } catch {
      console.error(
        `[settings] Could not repair guild ${row.guild_id} — skipping.`
      );
    }
  }
}

export function createSettingsManager(): SettingsManager {
  ensureDataDir();

  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id   TEXT PRIMARY KEY,
      settings   TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const selectStmt = db.prepare<[string], { settings: string }>(
    "SELECT settings FROM guild_settings WHERE guild_id = ?"
  );

  const upsertStmt = db.prepare<[string, string, number]>(`
    INSERT INTO guild_settings (guild_id, settings, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      settings   = excluded.settings,
      updated_at = excluded.updated_at
  `);

  // Repair outdated configs before the bot starts serving requests
  repairAllGuilds(db, upsertStmt);

  return {
    getSettings: async (guildId: string): Promise<Readonly<AppSettings>> => {
      const row = selectStmt.get(guildId);

      if (!row) {
        // Lazy init: first access creates the guild's config with defaults
        const defaults = defaultSettings();
        upsertStmt.run(
          guildId,
          JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: defaults }),
          Date.now()
        );
        return defaults;
      }

      const parsed = JSON.parse(row.settings) as StoredRow;
      return mergeDefaults(defaultSettings(), parsed.data);
    },

    saveSettings: async (guildId: string, updated: AppSettings): Promise<void> => {
      upsertStmt.run(
        guildId,
        JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: updated }),
        Date.now()
      );
    },
  };
}
