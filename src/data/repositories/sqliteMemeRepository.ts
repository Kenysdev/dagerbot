import type { SqliteProvider } from "../providers/sqlite.js";
import type { MemeCount, MemeRepository } from "../types.js";

const TABLE = "meme_counts";

type RawRow = {
  guild_id: string;
  user_id: string;
  count: number;
  started_at: number;
  updated_at: number;
};

function rowToMemeCount(row: RawRow): MemeCount {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    count: row.count,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  };
}

export function createMemeRepository(provider: SqliteProvider): MemeRepository {
  const { db } = provider;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      started_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  // Mirrors the ranking ORDER BY, so the query needs no temporary B-tree.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_leaderboard
      ON ${TABLE} (guild_id, count DESC, user_id ASC)
  `);

  const incrementStmt = db.prepare<[string, string, number, number], RawRow>(`
    INSERT INTO ${TABLE} (guild_id, user_id, count, started_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET
      count      = count + 1,
      updated_at = excluded.updated_at
    RETURNING *
  `);

  const countStmt = db.prepare<[string, string], Pick<RawRow, "count">>(
    `SELECT count FROM ${TABLE} WHERE guild_id = ? AND user_id = ?`
  );

  // The user_id tiebreak keeps pagination stable: without it, users sharing a
  // count can repeat or vanish across pages.
  const topStmt = db.prepare<[string, number, number], RawRow>(`
    SELECT * FROM ${TABLE}
    WHERE guild_id = ?
    ORDER BY count DESC, user_id ASC
    LIMIT ? OFFSET ?
  `);

  const totalStmt = db.prepare<[string], { total: number }>(
    `SELECT COUNT(*) AS total FROM ${TABLE} WHERE guild_id = ?`
  );

  return {
    increment: async (guildId, userId) => {
      const now = Date.now();
      const row = incrementStmt.get(guildId, userId, now, now);
      if (!row) {
        // Unreachable: INSERT ... RETURNING always yields a row. Kept as an
        // invariant guard.
        throw new Error("Failed to increment meme count.");
      }
      return rowToMemeCount(row);
    },

    getCount: async (guildId, userId) => {
      const row = countStmt.get(guildId, userId);
      return row?.count ?? 0;
    },

    getTopCounts: async (guildId, limit, offset) => {
      const rows = topStmt.all(guildId, limit, offset);
      return rows.map(rowToMemeCount);
    },

    getTotalUsers: async (guildId) => {
      const row = totalStmt.get(guildId);
      return row?.total ?? 0;
    },
  };
}
