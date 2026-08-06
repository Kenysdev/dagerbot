import "dotenv/config";
import { DEFAULT_SYSTEM_PROMPT } from "./systemPrompt";

export type AppConfig = {
  port: number | null;
  maxInputChars: number;
  historyLimit: number;
  sessionTtlSeconds: number;
  rateLimitUserPerMin: number;
  rateLimitSessionPerMin: number;
  openAiModel: string;
  openAiSystemPrompt: string;
};

function readNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// No fallback on purpose: null means "open no socket at all". Platforms that
// require a bound port define PORT themselves, so the same build is correct on a
// VPS and on a PaaS without a flag, and the default is the closed one. A value
// that is present but unusable is an operator mistake, not a request to opt out.
function readOptionalPort(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: readOptionalPort("PORT"),
    maxInputChars: readNumber("MAX_INPUT_CHARS", 4096),
    historyLimit: readNumber("HISTORY_LIMIT", 10),
    sessionTtlSeconds: readNumber("SESSION_TTL_SECONDS", 3600),
    rateLimitUserPerMin: readNumber("RATE_LIMIT_USER_PER_MIN", 10),
    rateLimitSessionPerMin: readNumber("RATE_LIMIT_SESSION_PER_MIN", 100),
    openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    openAiSystemPrompt: process.env.OPENAI_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT,
  };
}

export const VALID_CONFIG_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "BanMembers",
  "KickMembers",
  "ModerateMembers",
  "ManageChannels",
] as const;

export type ConfigPermission = (typeof VALID_CONFIG_PERMISSIONS)[number];
