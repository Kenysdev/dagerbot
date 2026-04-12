import fastify from "fastify";
import { AppConfig } from "./config/env";
import { createChatController } from "./http/controllers/chatController";
import { registerChatRoutes } from "./http/routes/chatRoutes";
import { ChatService } from "./services/chatService";

export function buildApp(params: {
  config: AppConfig;
  chatService: ChatService;
}) {
  const { config, chatService } = params;

  const app = fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  const chatController = createChatController({ config, chatService });

  registerChatRoutes({ app, controller: chatController });

  return app;
}
