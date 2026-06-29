import type { TNeedCategory } from '@/types';

// Estados de Venezuela — usados para clasificar campañas por región afectada.
export const VENEZUELA_REGIONS: readonly string[] = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'La Guaira',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Yaracuy',
  'Zulia',
] as const;

// Categorías de necesidad inmediata (PRD, Módulo 2).
export interface INeedCategoryMeta {
  value: TNeedCategory;
  label: string;
  emoji: string;
}

export const NEED_CATEGORIES: readonly INeedCategoryMeta[] = [
  { value: 'medical', label: 'Gastos Médicos', emoji: '🏥' },
  { value: 'funeral', label: 'Gastos Funerarios', emoji: '🕯️' },
  { value: 'recovery', label: 'Recuperación / Vivienda', emoji: '🏠' },
  { value: 'children', label: 'Enfoque Infantil', emoji: '🧒' },
  { value: 'other', label: 'Otros', emoji: '🤝' },
] as const;

export function categoryLabel(value: TNeedCategory): string {
  return NEED_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function categoryEmoji(value: TNeedCategory): string {
  return NEED_CATEGORIES.find((c) => c.value === value)?.emoji ?? '🤝';
}

// Botón de soporte por WhatsApp para guiar a las familias (PRD, sección 4).
// Configurable por entorno; usa formato internacional sin '+' ni espacios.
export const WHATSAPP_SUPPORT_NUMBER: string =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? '';
