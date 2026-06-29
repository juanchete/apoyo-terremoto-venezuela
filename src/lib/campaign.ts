// ¿La campaña proviene de un enlace de GoFundMe?
export function isGoFundMe(donationUrl: string | null): boolean {
  return Boolean(donationUrl) && /gofundme\.com/i.test(donationUrl as string);
}
