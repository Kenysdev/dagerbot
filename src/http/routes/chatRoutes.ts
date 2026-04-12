import { FastifyInstance, RouteHandlerMethod } from "fastify";

export function registerChatRoutes(params: {
  app: FastifyInstance;
  controller: { handleChat: RouteHandlerMethod };
}) {
  const { app, controller } = params;

  app.get("/chat", controller.handleChat);
}
