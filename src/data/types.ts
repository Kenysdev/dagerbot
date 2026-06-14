// Core data layer contracts.
// DbProvider: infrastructure contract — any database must implement this.
// Repository<T>: data operations contract — typed per feature.

export type DbProvider = {
  name: "mongo";
  initialize: () => Promise<void>;
};

export type SettingsRepository = {
  findById: (guildId: string) => Promise<string | null>;
  save: (guildId: string, raw: string) => Promise<void>;
  repairAll: (repairFn: (raw: string) => string) => Promise<void>;
};

export type MemeCount = {
  guildId: string;
  userId: string;
  count: number;
  startedAt: number;
  updatedAt: number;
};

export type MemeRepository = {
  increment: (guildId: string, userId: string) => Promise<MemeCount>;
  getCount: (guildId: string, userId: string) => Promise<number>;
  getTopCounts: (guildId: string, limit: number, offset: number) => Promise<MemeCount[]>;
  getTotalUsers: (guildId: string) => Promise<number>;
};
