import type { DbProvider } from "./types.js";
import { createSqliteProvider } from "./providers/sqlite.js";

// To use a different provider, switch to the corresponding branch.
// See README for available branches and deployment instructions.
export async function createDbProvider(): Promise<DbProvider> {
  const provider = createSqliteProvider();
  await provider.initialize();
  console.log("[db] Using provider: sqlite");
  return provider;
}
