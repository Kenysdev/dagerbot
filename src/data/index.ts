import type { SettingsRepository, MemeRepository } from "./types.js";
import { createMongoProvider } from "./providers/mongo.js";
import { createSettingsRepository } from "./repositories/mongoSettingsRepository.js";
import { createMemeRepository } from "./repositories/mongoMemeRepository.js";

export type DataLayer = {
  settingsRepository: SettingsRepository;
  memeRepository: MemeRepository;
  // newRepository: NewRepository; <- next feature
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createMongoProvider();
  await provider.initialize();
  console.log("[db] Using provider: mongo");

  return {
    settingsRepository: createSettingsRepository(provider),
    memeRepository: createMemeRepository(provider),
    // newRepository: createNewRepository(provider), <- next feature
  };
}
