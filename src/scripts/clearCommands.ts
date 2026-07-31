/**
 * src/scripts/clearCommands.ts
 * Manually clears registered slash commands from Discord.
 *
 * Global and guild command sets are independent in Discord's API and are not
 * deduplicated by name, so a stale copy in one scope can keep showing up next
 * to an updated copy in another. This tool removes those leftovers on demand,
 * without touching the bot's startup registration.
 *
 * Requires DISCORD_TOKEN and DISCORD_CLIENT_ID in the environment (.env).
 *
 * Usage:
 *   npm run commands:clear -- --global
 *   npm run commands:clear -- --guild 123 456
 *   npm run commands:clear -- --guild 123,456
 *   npm run commands:clear -- --global --guild 123
 */

import "dotenv/config";
import { REST, Routes } from "discord.js";

function parseArgs(argv: string[]): { global: boolean; guildIds: string[] } {
  let global = false;
  const guildIds: string[] = [];
  let collectingGuilds = false;

  for (const arg of argv) {
    if (arg === "--global") {
      global = true;
      collectingGuilds = false;
    } else if (arg === "--guild") {
      collectingGuilds = true;
    } else if (arg.startsWith("--")) {
      collectingGuilds = false;
    } else if (collectingGuilds) {
      guildIds.push(...arg.split(",").filter(Boolean));
    }
  }

  return { global, guildIds };
}

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error(
      "[clear] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment."
    );
    process.exit(1);
  }

  const { global, guildIds } = parseArgs(process.argv.slice(2));

  if (!global && guildIds.length === 0) {
    console.log(
      [
        "[clear] Nothing to do. Specify a target:",
        "  --global            Clear all global commands (affects every server).",
        "  --guild <id> [...]  Clear commands from one or more guilds.",
      ].join("\n")
    );
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  if (global) {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("[clear] Cleared global commands.");
  }

  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    console.log(`[clear] Cleared commands for guild ${guildId}.`);
  }
}

main().catch((error) => {
  console.error("[clear] Failed to clear commands.", error);
  process.exit(1);
});
