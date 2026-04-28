export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// --- Bot command type (used by commandManager) ---

import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export type BotCommand = {
  name: string;
  builder: SlashCommandBuilder;
  handle: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

// --- Settings types ---

export type AutoReactConfig = {
  enabled: boolean;
  emojis: string[];
};

export type MediaOnlyConfig = {
  enabled: boolean;
};

export type MemeSettings = {
  channelId: string;
  autoReact: AutoReactConfig;
  mediaOnly: MediaOnlyConfig;
};

// AppSettings grows here — one block per feature
export type AppSettings = {
  meme: MemeSettings;
  // <NameFeature>: <NameFeature>Settings; <- next feature
};

// Async — receives guildId (multi-server)
export type SettingsManager = {
  getSettings: (guildId: string) => Promise<Readonly<AppSettings>>;
  saveSettings: (guildId: string, updated: AppSettings) => Promise<void>;
};
