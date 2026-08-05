// Data layer provider selection — the app entry point never names a concrete
// provider; it only calls createDataLayer(). The imports below are the single
// place where that choice is made, so swapping providers touches this file and
// nothing else.
//
// See docs/extensibility-en.md for the provider strategy.

import type { SettingsRepository, MemeRepository, SessionRepository } from "./types.js";
import { createSqliteProvider } from "./providers/sqlite.js";
import { createSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { createMemeRepository } from "./repositories/sqliteMemeRepository.js";
import { createMemorySessionRepository } from "./repositories/memorySessionRepository.js";

export type DataLayer = {
  settingsRepository: SettingsRepository;
  memeRepository: MemeRepository;
  sessionRepository: SessionRepository;
  // newRepository: NewRepository; <- next feature
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createSqliteProvider();
  await provider.initialize();
  console.log("[db] Using provider: sqlite");

  return {
    settingsRepository: createSettingsRepository(provider),
    memeRepository: createMemeRepository(provider),
    sessionRepository: createMemorySessionRepository(),
    // newRepository: createNewRepository(provider), <- next feature
  };
}
