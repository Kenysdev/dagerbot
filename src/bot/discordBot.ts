import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import type { DataLayer } from "../data/index.js";
import type { ChatService } from "../services/chatService.js";
import type { SettingsManager } from "../core/types.js";
import { createCommandManager } from "./commands/commandManager.js";
import { registerEventDispatcher } from "./events/eventDispatcher.js";

export async function startDiscordBot(params: {
  chatService: ChatService;
  settingsManager: SettingsManager;
  dataLayer: DataLayer;
}): Promise<Client | null> {
  const { chatService, settingsManager, dataLayer } = params;

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.warn("DISCORD_TOKEN not set. Discord bot disabled.");
    return null;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const prefix = process.env.DISCORD_PREFIX || "!";

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Prevent unhandled Discord API errors from crashing the process
  client.on(Events.Error, (err) => {
    console.error("[client] Unhandled error:", err.message);
  });

  // --- Command setup ---
  const commands = createCommandManager({ settingsManager, dataLayer });

  client.on(Events.ClientReady, async () => {
    console.log(`Discord bot logged in as ${client.user?.tag ?? "unknown"}`);

    if (clientId) {
      try {
        await commands.registerToDiscord(clientId, token, guildId);
      } catch (err) {
        console.error("[commands] Failed to register slash commands.", err);
      }
    } else {
      console.warn(
        "[commands] DISCORD_CLIENT_ID not set — slash commands not registered."
      );
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await commands.route(interaction).catch((err) => {
      console.error("[commands] Error handling interaction:", err);
    });
  });

  // --- Event setup ---
  registerEventDispatcher(client, {
    settingsManager,
    dataLayer,
    chatService,
    prefix,
  });

  await client.login(token);
  return client;
}
