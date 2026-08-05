import { loadConfig } from "./config/env";
import { createFixedWindowLimiter } from "./core/rateLimit";
import { createOpenAIClient } from "./infra/openaiClient";
import { createChatService, type ChatService } from "./services/chatService";
import { startHealthServer } from "./http/healthServer";
import { startDiscordBot } from "./bot/discordBot";
import { createDataLayer } from "./data/index.js";
import { createSettingsManager } from "./config/settingsManager.js";

async function main() {
  const config = loadConfig();

  const dataLayer = await createDataLayer();
  const settingsManager = await createSettingsManager(dataLayer.settingsRepository);

  const apiKey = process.env.OPENAI_API_KEY;
  let chatService: ChatService | null = null;
  if (apiKey) {
    chatService = createChatService({
      config,
      openai: createOpenAIClient(apiKey),
      sessionRepository: dataLayer.sessionRepository,
      allowUser: createFixedWindowLimiter(config.rateLimitUserPerMin),
      allowSession: createFixedWindowLimiter(config.rateLimitSessionPerMin),
    });
  } else {
    console.warn("OPENAI_API_KEY not set. Chat disabled; every other feature works.");
  }

  if (config.port !== null) {
    startHealthServer(config.port);
  }

  await startDiscordBot({ chatService, settingsManager, dataLayer });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
