// To use a different provider, switch to the corresponding branch.
// See README for available branches and deployment instructions.

import type { SettingsRepository, MemeRepository } from "./types.js";
import { createSqliteProvider } from "./providers/sqlite.js";
import { createSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { createMemeRepository } from "./repositories/sqliteMemeRepository.js";

export type DataLayer = {
  settingsRepository: SettingsRepository;
  memeRepository: MemeRepository;
  // newRepository: NewRepository; <- next feature
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createSqliteProvider();
  await provider.initialize();
  console.log("[db] Using provider: sqlite");

  return {
    settingsRepository: createSettingsRepository(provider),
    memeRepository: createMemeRepository(provider),
    // newRepository: createNewRepository(provider), <- next feature
  };
}
