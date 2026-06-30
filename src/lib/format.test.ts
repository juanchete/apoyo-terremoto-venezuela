import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatPct, formatCampaignAge } from './format';

describe('formatPct', () => {
  it('formatea fracción a porcentaje', () => {
    expect(formatPct(0.5)).toBe('50%');
  });
});

describe('formatCampaignAge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number): string =>
    new Date(Date.now() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('null o fecha inválida → null', () => {
    expect(formatCampaignAge(null)).toBeNull();
    expect(formatCampaignAge('no-date')).toBeNull();
  });

  it('momentos / minutos / horas', () => {
    expect(formatCampaignAge(ago(10_000))).toBe('hace un momento');
    expect(formatCampaignAge(ago(5 * MIN))).toBe('hace 5 min');
    expect(formatCampaignAge(ago(3 * HOUR))).toBe('hace 3 h');
  });

  it('días / semanas / meses / años', () => {
    expect(formatCampaignAge(ago(2 * DAY))).toBe('hace 2 días');
    expect(formatCampaignAge(ago(14 * DAY))).toBe('hace 2 semanas');
    expect(formatCampaignAge(ago(60 * DAY))).toBe('hace 2 meses');
    expect(formatCampaignAge(ago(400 * DAY))).toBe('hace 1 año');
  });

  it('singulares', () => {
    expect(formatCampaignAge(ago(1 * DAY))).toBe('hace 1 día');
    expect(formatCampaignAge(ago(7 * DAY))).toBe('hace 1 semana');
  });
});
