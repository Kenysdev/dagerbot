// Chat history store selection — the app entry point never names a concrete
// implementation, mirroring the provider pattern in src/data/index.ts.
//
// Implementations available in this folder:
//   - mongoSessionStore.ts   (active here — survives restarts)
//   - memorySessionStore.ts  (wired on the default branch — lost on restart)
//
// Both are ephemeral working context, not an archive: history is trimmed to
// HISTORY_LIMIT and a session expires after SESSION_TTL_SECONDS of inactivity
// (Mongo drops the document via a TTL index). No store keeps chat data permanently.
//
// To use a different store, switch to the corresponding provider branch.
// See docs/extensibility-en.md for the provider strategy.

import type { AppConfig } from "../config/env";
import type { SessionStore } from "./sessionStore";
import { createMongoSessionStore } from "./mongoSessionStore";

export function createSessionStore(config: AppConfig): SessionStore {
  return createMongoSessionStore({
    historyLimit: config.historyLimit,
    sessionTtlSeconds: config.sessionTtlSeconds,
  });
}
