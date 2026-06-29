'use server';

import { extractFromGoFundMe } from '@/lib/ingest/gofundme';
import type { IExtractedCampaign } from '@/types';

export interface IExtractResult {
  data?: IExtractedCampaign;
  error?: string;
}

// Llamada desde el formulario al pegar un enlace de GoFundMe.
export async function extractCampaign(url: string): Promise<IExtractResult> {
  const trimmed = url.trim();
  if (!trimmed) return { error: 'Pega un enlace primero.' };
  if (!/gofundme\.com/i.test(trimmed))
    return { error: 'Por ahora solo se puede autocompletar desde enlaces de GoFundMe.' };

  const data = await extractFromGoFundMe(trimmed);

  const gotSomething =
    data.title || data.description || data.image_url || data.goal_amount;
  if (!gotSomething)
    return {
      error:
        'No se pudo leer la página (GoFundMe pudo bloquearla). Completa los datos a mano.',
    };

  return { data };
}
