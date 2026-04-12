import OpenAI from "openai";

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}