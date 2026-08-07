// Data layer provider selection — the app entry point never names a concrete
// provider; it only calls createDataLayer(). The imports below are the single
// place where that choice is made, so swapping providers touches this file and
// nothing else.
//
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
