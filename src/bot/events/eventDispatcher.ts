import { Events, type Client } from "discord.js";
import type { SettingsManager } from "../../core/types.js";
import type { DataLayer } from "../../data/index.js";
import type { ChatService } from "../../features/chat.js";
import { handleMeme, handleMemeReward } from "./listeners/memeListener.js";
import { handleChatAi } from "./listeners/chatAiListener.js";
import { handleChannelGuard } from "./listeners/channelGuardListener.js";

export function registerEventDispatcher(
  client: Client,
  deps: {
    settingsManager: SettingsManager;
    dataLayer: DataLayer;
    chatService: ChatService | null;
    prefix: string;
  }
): void {
  const { settingsManager, dataLayer, chatService, prefix } = deps;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.guildId) {
      // Without a catch here the rejection is unhandled — this listener is
      // async and its promise goes nowhere — and the process dies on the first
      // message after the database drops. Guild features go quiet; chat, which
      // does not need the database, keeps working.
      const settings = await settingsManager
        .getSettings(message.guildId)
        .catch((err) => {
          console.error(
            `[settings] guild=${message.guildId}: unavailable, guild features skipped:`,
            err
          );
          return null;
        });

      if (settings) {
        await handleChannelGuard(message, settings.channelGuard).catch((err) => {
          console.error("[channelGuardFeature] Error:", err);
        });

        await handleMeme(message, settings.meme).catch((err) => {
          console.error("[memeFeature] Error:", err);
        });

        await handleMemeReward(message, settings.memeReward, settings.meme, dataLayer.memeRepository).catch((err) => {
          console.error("[memeRewardFeature] Error:", err);
        });
      }
    }

    if (chatService) {
      await handleChatAi(message, client, chatService, prefix).catch((err) => {
        console.error("[chatAiFeature] Error:", err);
      });
    }

    // next event handler
    // await handle<NameFeature>(message, deps).catch((err) => {
    //   console.error("[<name>Feature] Error:", err);
    // });
  });

  // --- Other events
  // client.on(Events.MessageUpdate, async (message) => { ... });
}
