import 'server-only';
import { generateText } from 'ai';
import { getAiModel, hasGatewayAuth, parseJsonObject } from '@/lib/ai/client';
import { heuristicBeneficiaryType } from '@/lib/ingest/beneficiary-heuristic';
import type { TBeneficiaryType } from '@/types';

// Sugerencia de tipo de beneficiario para pre-rellenar el formulario. Usa la IA
// del gateway si está disponible; si no (o si falla), cae en la heurística. El
// autor siempre puede corregir la sugerencia antes de publicar.
export async function suggestBeneficiaryType(
  title: string | null | undefined,
  description: string | null | undefined,
): Promise<TBeneficiaryType> {
  const fallback = heuristicBeneficiaryType(title, description);
  if (!hasGatewayAuth()) return fallback;

  try {
    const { text } = await generateText({
      model: getAiModel(),
      prompt: `Clasifica quién es el beneficiario de esta campaña de ayuda por el terremoto en Venezuela.

Título: ${title ?? '(sin título)'}
Descripción: ${(description ?? '').slice(0, 2000)}

"family" = una persona, familia o grupo de familias concreto.
"organization" = una fundación, ONG, asociación, iglesia u otra entidad.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{ "beneficiary_type": "family" | "organization" }`,
    });

    const parsed = parseJsonObject(text) as { beneficiary_type?: unknown };
    const value = parsed?.beneficiary_type;
    if (value === 'family' || value === 'organization') return value;
    return fallback;
  } catch {
    return fallback;
  }
}
