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

// Fecha absoluta legible, p. ej. "12 jun 2026" — para registros de auditoría
// (cuándo se verificó una campaña) donde el tiempo relativo pierde precisión.
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// "hace 5 min", "hace 2 h", "hace 3 días" — para mostrar qué tan fresco es un
// dato. Entrada: timestamp ISO (o null).
export function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'hace un momento';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}
