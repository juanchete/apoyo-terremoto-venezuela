import type { TBeneficiaryType } from '@/types';

// ---------------------------------------------------------------------------
// Heurística PURA para sugerir el tipo de beneficiario. Sin red ni
// `server-only`: testeable en Node. El wrapper con IA vive en beneficiary.ts.
// ---------------------------------------------------------------------------

// Palabras que delatan que detrás hay una organización y no una familia.
// Cubre español (y algún término en inglés que aparece en GoFundMe).
export const ORG_PATTERNS: readonly RegExp[] = [
  /\bfundaci[oó]n\b/i,
  /\bfoundation\b/i,
  /\basociaci[oó]n\b/i,
  /\bong\b/i,
  /\borganizaci[oó]n\b/i,
  /\bnonprofit\b/i,
  /\bsin[\s-]*fines[\s-]*de[\s-]*lucro\b/i,
  /\bcooperativa\b/i,
  /\binstituci[oó]n\b/i,
  /\bcolectivo\b/i,
  /\bparroquia\b/i,
  /\biglesia\b/i,
  /\bcomedor\b/i,
  /\brefugio\b/i,
  /\bA\.\s?C\.\b/,
];

// Si aparece algún término de organización en el título o la descripción,
// sugiere 'organization'; si no, 'family'.
export function heuristicBeneficiaryType(
  title: string | null | undefined,
  description: string | null | undefined,
): TBeneficiaryType {
  const text = `${title ?? ''} ${description ?? ''}`;
  return ORG_PATTERNS.some((re) => re.test(text)) ? 'organization' : 'family';
}
