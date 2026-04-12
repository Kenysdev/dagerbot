import OpenAI from "openai";
import { AppConfig } from "../config/env";
import { SessionStore } from "../core/sessionStore";
import { HttpError } from "../http/httpError";
import { DEFAULT_SYSTEM_PROMPT } from "../config/systemPrompt";

export type ChatService = {
  sendMessage(params: {
    sessionId: string;
    text: string;
    ip: string;
  }): Promise<{ reply: string }>;
};

export function createChatService(params: {
  config: AppConfig;
  openai: OpenAI;
  sessionStore: SessionStore;
  allowIp: (key: string) => boolean;
  allowSession: (key: string) => boolean;
}): ChatService {
  const { config, openai, sessionStore, allowIp, allowSession } = params;

  return {
    async sendMessage({ sessionId, text, ip }) {
      if (!allowIp(ip)) {
        throw new HttpError(429, "rate_limited", "IP rate limit exceeded.");
      }
      if (!allowSession(`session:${sessionId}`)) {
        throw new HttpError(
          429,
          "rate_limited",
          "Session rate limit exceeded.",
        );
      }

      const history = await sessionStore.getHistory(sessionId);
      await sessionStore.appendUser(sessionId, text);

      const messages = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      ].concat(history, [{ role: "user", content: text }]);

      const completion = await openai.chat.completions.create({
        model: config.openAiModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      });

      const reply = completion.choices[0]?.message?.content || "";
      if (!reply) {
        throw new HttpError(
          502,
          "empty_response",
          "OpenAI returned an empty response.",
        );
      }

      await sessionStore.appendAssistant(sessionId, reply);

      return { reply };
    },
  };
}
