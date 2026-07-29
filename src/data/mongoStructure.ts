import type { Connection, Model } from "mongoose";

const NAMESPACE_EXISTS = 48;
const UNAUTHORIZED = 13;

type StructureParams<T> = {
  connection: Connection;
  model: Model<T>;
  collection: string;
  validator: Record<string, unknown>;
};

/**
 * Returns a guard that materialises the collection with its validator and builds
 * the model's indexes, running at most once. Every operation awaits it, so no
 * write reaches a collection whose constraints are not in place yet.
 */
export function createStructureGuard<T>(params: StructureParams<T>): () => Promise<void> {
  const { connection, model, collection, validator } = params;

  const options = {
    validator,
    validationLevel: "strict",
    validationAction: "error",
  };

  async function ensure(): Promise<void> {
    // connection.db is undefined until the handshake completes.
    const db = (await connection.asPromise()).db!;

    try {
      await db.createCollection(collection, options);
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== NAMESPACE_EXISTS) throw error;

      // The collection already exists, so createCollection never applied the
      // validator to it. collMod attaches it to collections created earlier, but
      // that action belongs to dbAdmin and a readWrite user cannot run it. The
      // validator is defence in depth — the indexes below are what protect
      // integrity — so losing it must not take the bot down.
      try {
        await db.command({ collMod: collection, ...options });
      } catch (modError) {
        if ((modError as { code?: number }).code !== UNAUTHORIZED) throw modError;
        console.warn(
          `[mongo] No permission to attach the validator to ${collection}; ` +
            `continuing without it. Grant dbAdmin to enable server-side validation.`
        );
      }
    }

    // Mongoose only declares indexes and builds them in the background without
    // blocking. syncIndexes() waits for the server to finish, so the unique
    // constraint is active before the first write instead of some moments after
    // it, and it also drops indexes the schema no longer declares — which init()
    // would leave behind on a database created by an earlier version.
    await model.syncIndexes();
  }

  let pending: Promise<void> | null = null;

  return () => {
    pending ??= ensure().catch((error) => {
      pending = null; // let the next operation try again
      throw error;
    });
    return pending;
  };
}
