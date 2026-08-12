import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { DbProvider } from "../types.js";

const DB_PATH = path.resolve(process.cwd(), "data/bot.db");

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export type SqliteProvider = DbProvider & {
  db: Database.Database;
};

export function createSqliteProvider(): SqliteProvider {
  ensureDataDir();

  const db = new Database(DB_PATH);
  // Only the journal mode: better-sqlite3 already defaults busy_timeout to 5000 ms.
  db.pragma("journal_mode = WAL");

  return {
    name: "sqlite",

    initialize: async () => {
      console.log("[sqlite] Initialized.");
    },

    db,
  };
}
