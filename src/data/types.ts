// Core data layer contracts.
// DbProvider: infrastructure contract — any database must implement this.
// Repository<T>: data operations contract — typed per feature.

export type DbProvider = {
  name: "sqlite" | "mongo";
  initialize: () => Promise<void>;
};

export type SettingsRepository = {
  findById: (guildId: string) => Promise<string | null>;
  save: (guildId: string, raw: string) => Promise<void>;
  repairAll: (repairFn: (raw: string) => string) => void;
};
