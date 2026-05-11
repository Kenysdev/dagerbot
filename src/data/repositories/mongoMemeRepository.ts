import type { MemeRepository } from "../types.js";

/**
 * MongoDB meme repository — to be implemented.
 *
 * Must implement MemeRepository from data/types.ts.
 * Follow the same pattern as sqliteMemeRepository.ts.
 *
 * Collection: meme_counts
 * Document shape: { guild_id, user_id, count, started_at, updated_at }
 * 
 * Implement the following methods:
 * - increment(guildId: string, userId: string): Promise<MemeCount>
 * - getCount(guildId: string, userId: string): Promise<number>
 * - getTopCounts(guildId: string, limit: number, offset: number): Promise<MemeCount[]>
 * - getTotalUsers(guildId: string): Promise<number>
 */

export function createMemeRepository(): MemeRepository {
  throw new Error("MongoDB meme repository not yet implemented.");
}
