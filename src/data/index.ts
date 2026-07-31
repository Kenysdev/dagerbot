// Data layer provider selection — the app entry point never names a concrete
// provider; it only calls createDataLayer().
//
// Providers available in this folder:
//   - providers/mongo.ts  + repositories/mongo*   (active here)
//   - providers/sqlite.ts + repositories/sqlite*  (wired on the default branch)
//
// To use a different provider, switch to the corresponding provider branch.
// See docs/extensibility-en.md for the provider strategy.

import type { SettingsRepository, MemeRepository, SessionRepository } from "./types.js";
import { createMongoProvider } from "./providers/mongo.js";
import { createSettingsRepository } from "./repositories/mongoSettingsRepository.js";
import { createMemeRepository } from "./repositories/mongoMemeRepository.js";
import { createSessionRepository } from "./repositories/mongoSessionRepository.js";

export type DataLayer = {
  settingsRepository: SettingsRepository;
  memeRepository: MemeRepository;
  sessionRepository: SessionRepository;
  // newRepository: NewRepository; <- next feature
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createMongoProvider();
  await provider.initialize();
  console.log("[db] Using provider: mongo");

  return {
    settingsRepository: createSettingsRepository(provider),
    memeRepository: createMemeRepository(provider),
    sessionRepository: createSessionRepository(provider),
    // newRepository: createNewRepository(provider), <- next feature
  };
}
