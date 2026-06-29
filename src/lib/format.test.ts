import { describe, it, expect } from 'vitest';
import { formatPct } from './format';

describe('vitest setup', () => {
  it('runs and formatPct works', () => {
    expect(formatPct(0.5)).toBe('50%');
  });
});
