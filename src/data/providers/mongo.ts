import type { DbProvider } from "../types.js";

/**
 * MongoDB provider.
 *
 * Implement this provider to use MongoDB as the database.
 * Required dependency: mongoose or mongodb (add to package.json)
 *
 * Must return an object that extends DbProvider and exposes
 * the MongoDB client/connection for repositories to use.
 *
 * See sqlite.ts as reference implementation.
 */
export function createMongoProvider(): DbProvider {
  throw new Error("MongoDB provider not yet implemented.");
}
