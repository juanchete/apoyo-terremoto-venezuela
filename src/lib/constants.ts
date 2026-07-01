import type {
  TBeneficiaryType,
  TCampaignTag,
  TNeedCategory,
  TUserRole,
} from '@/types';

// Roles del sistema. Jerarquía: user < operator < super_admin.
export interface IRoleMeta {
  value: TUserRole;
  label: string;
  description: string;
}

export const USER_ROLES: readonly IRoleMeta[] = [
  { value: 'user', label: 'Usuario', description: 'Publica, vota y reporta.' },
  {
    value: 'operator',
    label: 'Operador',
    description: 'Modera campañas: verifica, baja/restaura, resuelve reportes.',
  },
  {
    value: 'super_admin',
    label: 'Super admin',
    description: 'Todo lo de operador + administra el equipo y los roles.',
  },
] as const;

export function roleLabel(value: TUserRole): string {
  return USER_ROLES.find((r) => r.value === value)?.label ?? value;
}

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

// Tres grandes categorías de necesidad. Una sola por campaña (eje principal).
export const NEED_CATEGORIES: readonly INeedCategoryMeta[] = [
  { value: 'medical', label: 'Gastos médicos', emoji: '🏥' },
  { value: 'funeral', label: 'Gastos funerarios', emoji: '🕯️' },
  { value: 'economic_loss', label: 'Pérdidas económicas', emoji: '🏚️' },
] as const;

export function categoryLabel(value: TNeedCategory): string {
  return NEED_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function categoryEmoji(value: TNeedCategory): string {
  return NEED_CATEGORIES.find((c) => c.value === value)?.emoji ?? '🤝';
}

// Etiquetas transversales (eje múltiple). Subclasifican la campaña dentro de
// cualquier categoría: p. ej. un servicio funerario puede ser de un niño o de
// un abuelo. Lista curada para mantener consistencia y facilitar el filtrado;
// para sumar una etiqueta nueva basta con agregarla aquí (y a TCampaignTag).
export interface ICampaignTagMeta {
  value: TCampaignTag;
  label: string;
  emoji: string;
}

export const CAMPAIGN_TAGS: readonly ICampaignTagMeta[] = [
  { value: 'ninos', label: 'Niños', emoji: '🧒' },
  { value: 'madre', label: 'Madre', emoji: '🤱' },
  { value: 'abuelo', label: 'Adulto mayor', emoji: '👴' },
  { value: 'mascota', label: 'Mascotas', emoji: '🐾' },
  { value: 'protesis', label: 'Prótesis', emoji: '🦿' },
  { value: 'diabetes', label: 'Diabetes', emoji: '💉' },
  { value: 'embarazo', label: 'Embarazo', emoji: '🤰' },
  { value: 'discapacidad', label: 'Discapacidad', emoji: '♿' },
  { value: 'cancer', label: 'Cáncer', emoji: '🎗️' },
] as const;

const TAG_VALUES: readonly TCampaignTag[] = CAMPAIGN_TAGS.map((t) => t.value);

export function isCampaignTag(value: string): value is TCampaignTag {
  return (TAG_VALUES as readonly string[]).includes(value);
}

export function tagLabel(value: TCampaignTag): string {
  return CAMPAIGN_TAGS.find((t) => t.value === value)?.label ?? value;
}

export function tagEmoji(value: TCampaignTag): string {
  return CAMPAIGN_TAGS.find((t) => t.value === value)?.emoji ?? '🏷️';
}

// Tipo de beneficiario (eje independiente). Familia por defecto; el autor lo
// elige al publicar y la IA lo sugiere.
export interface IBeneficiaryTypeMeta {
  value: TBeneficiaryType;
  label: string;
  emoji: string;
}

export const BENEFICIARY_TYPES: readonly IBeneficiaryTypeMeta[] = [
  { value: 'family', label: 'Familia', emoji: '👪' },
  { value: 'organization', label: 'Organización', emoji: '🏢' },
] as const;

export function beneficiaryTypeLabel(value: TBeneficiaryType): string {
  return BENEFICIARY_TYPES.find((b) => b.value === value)?.label ?? value;
}

export function beneficiaryTypeEmoji(value: TBeneficiaryType): string {
  return BENEFICIARY_TYPES.find((b) => b.value === value)?.emoji ?? '🤝';
}

export function isBeneficiaryType(value: string): value is TBeneficiaryType {
  return value === 'family' || value === 'organization';
}

// Rangos de "lo que falta" (brecha = meta − recaudado) en USD para el filtro
// del feed. min inclusive, max exclusivo; max null = sin tope superior.
export interface IGapBucket {
  value: string;
  label: string;
  min: number;
  max: number | null;
}

export const GAP_BUCKETS: readonly IGapBucket[] = [
  { value: 'lt1k', label: 'Falta menos de $1.000', min: 0, max: 1000 },
  { value: '1k5k', label: 'Falta $1.000 – $5.000', min: 1000, max: 5000 },
  { value: '5k20k', label: 'Falta $5.000 – $20.000', min: 5000, max: 20000 },
  { value: 'gt20k', label: 'Falta más de $20.000', min: 20000, max: null },
] as const;

export function gapBucket(value: string): IGapBucket | undefined {
  return GAP_BUCKETS.find((b) => b.value === value);
}

// Vigencia de un claim de revisión: pasado este tiempo se considera libre y
// otro voluntario puede tomar la campaña. Se evalúa al leer (sin cron).
export const CLAIM_TTL_MIN = 30;

// Botón de soporte por WhatsApp para guiar a las familias (PRD, sección 4).
// Configurable por entorno; usa formato internacional sin '+' ni espacios.
export const WHATSAPP_SUPPORT_NUMBER: string =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? '';
