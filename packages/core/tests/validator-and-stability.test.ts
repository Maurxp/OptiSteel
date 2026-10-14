import { describe, expect, it } from 'vitest';
import { analyzeBeam, validateBeamModel } from '../src/index.js';
import type { BeamModel } from '../src/types.js';

describe('Validador, Estabilidad Estática y Casos Límite', () => {
  it('Rechaza longitudes no positivas o no finitas', () => {
    const invalidLengths = [0, -5, NaN, Infinity, -Infinity];
    for (const length of invalidLengths) {
      const model: BeamModel = {
        length,
        supports: [
          { id: 'S1', type: 'pin', x: 0 },
          { id: 'S2', type: 'roller', x: 5 },
        ],
        loads: [],
      };
      const val = validateBeamModel(model);
      expect(val.isValid).toBe(false);
      expect(val.errors.length).toBeGreaterThan(0);
      expect(() => analyzeBeam(model)).toThrow();
    }
  });

  it('Detecta mecanismo inestable con 0 apoyos', () => {
    const model: BeamModel = {
      length: 6,
      supports: [],
      loads: [{ id: 'P1', type: 'point', x: 3, P: 10 }],
    };
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(false);
    expect(val.classification).toBe('unstable');
    expect(() => analyzeBeam(model)).toThrow(/inestable/i);
  });

  it('Detecta mecanismo inestable con un solo apoyo simple (pin o roller)', () => {
    for (const type of ['pin', 'roller'] as const) {
      const model: BeamModel = {
        length: 6,
        supports: [{ id: 'S1', type, x: 0 }],
        loads: [{ id: 'P1', type: 'point', x: 3, P: 10 }],
      };
      const val = validateBeamModel(model);
      expect(val.isValid).toBe(false);
      expect(val.classification).toBe('unstable');
      expect(() => analyzeBeam(model)).toThrow(/mecanismo/i);
    }
  });

  it('Detecta apoyos coincidentes en la misma coordenada', () => {
    const model: BeamModel = {
      length: 6,
      supports: [
        { id: 'S1', type: 'pin', x: 2.0 },
        { id: 'S2', type: 'roller', x: 2.0 },
      ],
      loads: [{ id: 'P1', type: 'point', x: 3, P: 10 }],
    };
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('coincidentes'))).toBe(true);
    expect(() => analyzeBeam(model)).toThrow(/coincidentes/i);
  });

  it('Detecta configuración hiperestática (viga continua con 3 apoyos)', () => {
    const model: BeamModel = {
      length: 10,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 5 },
        { id: 'S3', type: 'roller', x: 10 },
      ],
      loads: [{ id: 'P1', type: 'point', x: 2.5, P: 10 }],
    };
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(false);
    expect(val.classification).toBe('hyperstatic');
    expect(() => analyzeBeam(model)).toThrow(/hiperestática/i);
  });

  it('Detecta configuración hiperestática (empotramiento + apoyo simple)', () => {
    const model: BeamModel = {
      length: 6,
      supports: [
        { id: 'S1', type: 'fixed', x: 0 },
        { id: 'S2', type: 'roller', x: 6 },
      ],
      loads: [{ id: 'P1', type: 'point', x: 3, P: 10 }],
    };
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(false);
    expect(val.classification).toBe('hyperstatic');
    expect(() => analyzeBeam(model)).toThrow(/hiperestática/i);
  });

  it('Rechaza cargas con coordenadas fuera de la viga', () => {
    const model: BeamModel = {
      length: 5,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [{ id: 'P1', type: 'point', x: 6.5, P: 10 }], // x = 6.5 > L = 5
    };
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('fuera de la viga'))).toBe(true);
    expect(() => analyzeBeam(model)).toThrow();
  });

  it('Rechaza cargas distribuidas con intensidades negativas o xEnd <= xStart', () => {
    const modelNeg: BeamModel = {
      length: 5,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0,
          xEnd: 3,
          wStart: -5,
          wEnd: 10,
        },
      ],
    };
    expect(validateBeamModel(modelNeg).isValid).toBe(false);

    const modelInverted: BeamModel = {
      length: 5,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 4,
          xEnd: 2,
          wStart: 5,
          wEnd: 5,
        },
      ],
    };
    expect(validateBeamModel(modelInverted).isValid).toBe(false);
  });
});
