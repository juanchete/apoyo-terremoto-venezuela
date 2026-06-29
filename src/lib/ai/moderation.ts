import 'server-only';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { TAiStatus } from '@/types';

const MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/owl-alpha';

export interface IModerationInput {
  title: string;
  description: string;
  donationUrl: string | null;
  existingTitles: string[];
}

export interface IModerationResult {
  status: TAiStatus;
  notes: string | null;
}

const analysisSchema = z.object({
  isRelevant: z.boolean(),
  isLikelyDuplicate: z.boolean(),
  hasAnomalies: z.boolean(),
  reasoning: z.string(),
});

function hasGatewayAuth(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function getModel() {
  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return openrouter(MODEL);
}

// Extrae el primer objeto JSON del texto (tolera ```json ``` y prosa alrededor).
function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Sin JSON en la respuesta.');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function analyzeCampaign(
  input: IModerationInput,
): Promise<IModerationResult> {
  if (!hasGatewayAuth()) {
    return { status: 'pending', notes: null };
  }

  const existing =
    input.existingTitles.length > 0
      ? input.existingTitles.map((t) => `- ${t}`).join('\n')
      : '(no hay campañas previas)';

  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: `Eres el filtro inicial de una plataforma que centraliza campañas de GoFundMe para los afectados por el terremoto en Venezuela.

Analiza esta campaña:
Título: ${input.title}
Descripción: ${input.description}
Enlace: ${input.donationUrl ?? '(sin enlace)'}

Campañas ya publicadas (para detectar duplicados exactos o casi idénticos):
${existing}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{
  "isRelevant": boolean,        // ¿es coherente con el terremoto en Venezuela?
  "isLikelyDuplicate": boolean, // ¿es casi idéntica a alguna de la lista?
  "hasAnomalies": boolean,      // ¿hay señales de estafa o incoherencia?
  "reasoning": "string"         // explicación breve en español (1-2 frases)
}`,
    });

    const parsed = analysisSchema.safeParse(parseJson(text));
    if (!parsed.success) {
      return { status: 'error', notes: 'Respuesta de IA no interpretable.' };
    }

    const { isRelevant, isLikelyDuplicate, hasAnomalies, reasoning } = parsed.data;
    const problem = !isRelevant || isLikelyDuplicate || hasAnomalies;

    return {
      status: problem ? 'flagged' : 'relevant',
      notes: reasoning,
    };
  } catch {
    return { status: 'error', notes: 'El análisis de IA no se pudo completar.' };
  }
}
