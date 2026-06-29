export function formatMoney(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('es-VE')}`;
  }
}

// Número agrupado sin símbolo de moneda (para paneles donde la moneda se
// indica una sola vez).
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
