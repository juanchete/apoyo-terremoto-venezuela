// ¿La campaña proviene de un enlace de GoFundMe? Acepta tanto el dominio
// completo (gofundme.com/f/…) como los enlaces cortos (gofund.me/…).
export function isGoFundMe(donationUrl: string | null): boolean {
  return (
    Boolean(donationUrl) &&
    /gofundme\.com|gofund\.me/i.test(donationUrl as string)
  );
}

// ¿Es un enlace corto de GoFundMe (gofund.me/…)? Necesita resolverse para
// obtener la URL canónica /f/<slug>.
export function isGoFundMeShortLink(donationUrl: string | null): boolean {
  return Boolean(donationUrl) && /gofund\.me/i.test(donationUrl as string);
}

// Porcentaje recolectado (0–1), igual que la vista campaigns_with_stats:
// null si no hay meta, y tope en 1.
export function collectionPct(
  raised: number,
  goal: number | null,
): number | null {
  if (!goal || goal <= 0) return null;
  return Math.min(raised / goal, 1);
}

// Clave canónica de un enlace de GoFundMe, para detectar la misma campaña
// aunque cambien el dominio (www), los parámetros (?utm=…) o la barra final.
// Para enlaces /f/<slug> usa el slug; para otros (gofund.me/…), host + ruta.
export function gofundmeKey(donationUrl: string | null): string | null {
  if (!isGoFundMe(donationUrl)) return null;
  const raw = donationUrl as string;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const slug = url.pathname.match(/\/f\/([^/?#]+)/i);
  if (slug) return slug[1].toLowerCase();
  const host = url.hostname.replace(/^www\./i, '');
  const path = url.pathname.replace(/\/+$/, '');
  return `${host}${path}`.toLowerCase();
}
