import { describe, it, expect } from 'vitest';
import { heuristicBeneficiaryType } from './beneficiary-heuristic';

describe('heuristicBeneficiaryType', () => {
  it('detecta organización por el título', () => {
    expect(
      heuristicBeneficiaryType('Fundación Manos Amigas', 'Ayudamos a afectados'),
    ).toBe('organization');
  });

  it('detecta organización por la descripción', () => {
    expect(
      heuristicBeneficiaryType(
        'Ayuda para el terremoto',
        'Somos una ONG que reparte alimentos en Mérida.',
      ),
    ).toBe('organization');
  });

  it('reconoce variantes acentuadas y otras entidades', () => {
    expect(heuristicBeneficiaryType('Asociación de vecinos', '')).toBe(
      'organization',
    );
    expect(heuristicBeneficiaryType('Iglesia San José', '')).toBe(
      'organization',
    );
  });

  it('por defecto sugiere family cuando no hay señales de organización', () => {
    expect(
      heuristicBeneficiaryType(
        'Ayuda para la familia Pérez',
        'Perdimos nuestra casa en el terremoto y necesitamos apoyo.',
      ),
    ).toBe('family');
  });

  it('no confunde palabras que contienen los términos (evita falsos positivos)', () => {
    // "organizado" contiene "organiza" pero no debe activar \borganizaci[oó]n\b
    expect(
      heuristicBeneficiaryType('Todo quedó organizado', 'una familia unida'),
    ).toBe('family');
  });

  it('tolera título/descripción vacíos o nulos', () => {
    expect(heuristicBeneficiaryType(null, undefined)).toBe('family');
    expect(heuristicBeneficiaryType('', '')).toBe('family');
  });
});
