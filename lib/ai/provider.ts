import { createOpenAI } from "@ai-sdk/openai";

export const DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_MODEL = "deepseek-v4-flash";

export function getApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
}

export function hasAiConfig(): boolean {
  return Boolean(getApiKey());
}

export function getAiApiConfig() {
  return {
    apiKey: getApiKey(),
    baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL
  };
}

export function getLanguageModel() {
  const config = getAiApiConfig();
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });

  return openai(config.model);
}
