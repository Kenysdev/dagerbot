// src/data/repositories/mongoSettingsRepository.ts

import type { SettingsRepository } from "../types.js";
import type { AppSettings } from "../../core/types.js";

/**
 * MongoDB settings repository — to be implemented.
 *
 * Must implement Repository<AppSettings> using the MongoDB provider.
 * Follow the same pattern as settingsRepository.ts.
 *
 * Steps to implement:
 *   1. Import and use the MongoDB client from the mongo provider
 *   2. Implement findById() — find guild settings by guildId
 *   3. Implement save() — upsert guild settings by guildId
 *   4. Implement repairAll() — repair all guild configs on startup
 *   5. Update createSettingsManager() to use this repository
 *      when provider.name === "mongo"
 *
 * See settingsRepository.ts as reference implementation.
 */
export function createSettingsRepository(): SettingsRepository {
  throw new Error("MongoDB settings repository not yet implemented.");
}
