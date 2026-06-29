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

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
