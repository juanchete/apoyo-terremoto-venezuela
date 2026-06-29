import 'server-only';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

const MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/owl-alpha';

// Hay credenciales para llamar al gateway de IA (OpenRouter).
export function hasGatewayAuth(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

// Cliente compartido del modelo: filtro de moderación y extracción de montos.
export function getAiModel(): LanguageModel {
  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return openrouter(MODEL);
}

// Extrae el primer objeto JSON de un texto (tolera ```json ``` y prosa alrededor).
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Sin JSON en la respuesta.');
  return JSON.parse(candidate.slice(start, end + 1));
}
