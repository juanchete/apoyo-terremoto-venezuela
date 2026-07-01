'use server';

import { extractFromGoFundMe, resolveGoFundMeUrl } from '@/lib/ingest/gofundme';
import { suggestBeneficiaryType } from '@/lib/ingest/beneficiary';
import { findActiveCampaignByLink, type ICampaignRef } from '@/lib/data/campaigns';
import { isGoFundMe } from '@/lib/campaign';
import type { IExtractedCampaign } from '@/types';

export interface IExtractResult {
  data?: IExtractedCampaign;
  error?: string;
  // Aviso temprano: ya hay una campaña activa con este enlace.
  duplicate?: ICampaignRef;
}

// Llamada desde el formulario al pegar un enlace de GoFundMe.
export async function extractCampaign(url: string): Promise<IExtractResult> {
  const trimmed = url.trim();
  if (!trimmed) return { error: 'Pega un enlace primero.' };
  if (!isGoFundMe(trimmed))
    return { error: 'Por ahora solo se puede autocompletar desde enlaces de GoFundMe.' };

  // Resuelve enlaces cortos (gofund.me/…) a su URL canónica antes de comparar.
  const canonical = await resolveGoFundMeUrl(trimmed);

  // Si ya está publicada, avisa de una vez (no bloquea el autocompletado).
  const duplicate =
    (await findActiveCampaignByLink(canonical)) ?? undefined;

  const data = await extractFromGoFundMe(canonical);

  const gotSomething =
    data.title || data.description || data.image_url || data.goal_amount;
  if (!gotSomething)
    return {
      error:
        'No se pudo leer la página (GoFundMe pudo bloquearla). Completa los datos a mano.',
      duplicate,
    };

  // Sugerencia de tipo de beneficiario (IA con respaldo heurístico) para
  // pre-seleccionar el radio del formulario. El autor puede corregirla.
  data.beneficiary_type = await suggestBeneficiaryType(
    data.title,
    data.description,
  );

  return { data, duplicate };
}
