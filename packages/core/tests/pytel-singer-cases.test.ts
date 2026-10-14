import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../src/index.js';
import type { BeamModel } from '../src/types.js';

describe('Pytel-Singer Tabla 6-2 - Casos Canónicos Fundamentales', () => {
  // --------------------------------------------------------------------------
  // CASO 1: Voladizo con carga puntual P en el extremo libre
  // Empotrado en x = 0, libre en x = L, carga P en x = L (hacia abajo)
  // Fórmulas teóricas:
  //   RA = P
  //   MA = P * L
  //   V(x) = P  para x en [0, L)
  //   M(x) = -P * (L - x)
  //   |M|_max = P * L en x = 0 (momento negativo / hogging)
  // --------------------------------------------------------------------------
  it('Caso 1: Voladizo con carga puntual en el extremo libre (Pytel-Singer Caso 1)', () => {
    const L = 4.0; // metros
    const P = 25.0; // kN

    const model: BeamModel = {
      length: L,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [{ id: 'P1', type: 'point', x: L, P }],
    };

    const res = analyzeBeam(model);

    // 1. Reacciones y equilibrio
    expect(res.isStaticDeterminate).toBe(true);
    expect(res.reactions).toHaveLength(1);
    const rA = res.reactions[0]!;
    expect(rA.Ry).toBeCloseTo(P, 8);
    expect(rA.Mr).toBeCloseTo(P * L, 8); // 25 * 4 = 100 kN*m
    expect(res.equilibrium.isBalanced).toBe(true);
    expect(Math.abs(res.equilibrium.sumFy)).toBeLessThan(1e-7);
    expect(Math.abs(res.equilibrium.sumM)).toBeLessThan(1e-7);

    // 2. Funciones de cortante V(x)
    expect(res.shear.evaluate(0, 'right')).toBeCloseTo(P, 8);
    expect(res.shear.evaluate(L / 2)).toBeCloseTo(P, 8);
    expect(res.shear.evaluate(L, 'left')).toBeCloseTo(P, 8);
    expect(res.shear.maxAbsolute.value).toBeCloseTo(P, 8);

    // 3. Funciones de momento M(x)
    // En x = 0, M(0) = -P*L = -100 kN*m
    expect(res.moment.evaluate(0, 'right')).toBeCloseTo(-P * L, 8);
    // En x = L/2, M(L/2) = -P*(L/2) = -50 kN*m
    expect(res.moment.evaluate(L / 2)).toBeCloseTo(-P * (L / 2), 8);
    // En x = L, M(L) = 0
    expect(res.moment.evaluate(L, 'left')).toBeCloseTo(0, 8);

    // 4. Máximos analíticos
    expect(res.moment.maxAbsolute.value).toBeCloseTo(P * L, 8);
    expect(res.moment.maxAbsolute.x).toBeCloseTo(0, 8);
    expect(res.moment.maxNegative.value).toBeCloseTo(-P * L, 8);
    expect(res.moment.maxNegative.x).toBeCloseTo(0, 8);
  });

  // --------------------------------------------------------------------------
  // CASO 3: Voladizo con carga uniformemente distribuida w
  // Empotrado en x = 0, libre en x = L, carga w en [0, L]
  // Fórmulas teóricas:
  //   RA = w * L
  //   MA = (w * L^2) / 2
  //   V(x) = w * (L - x)
  //   V(0) = w * L, V(L) = 0
  //   M(x) = - (w * (L - x)^2) / 2
  //   |M|_max = (w * L^2) / 2 en x = 0
  // --------------------------------------------------------------------------
  it('Caso 3: Voladizo con carga uniformemente distribuida (Pytel-Singer Caso 3)', () => {
    const L = 5.0; // metros
    const w = 12.0; // kN/m

    const model: BeamModel = {
      length: L,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0,
          xEnd: L,
          wStart: w,
          wEnd: w,
        },
      ],
    };

    const res = analyzeBeam(model);

    // 1. Reacciones y equilibrio
    const rA = res.reactions[0]!;
    expect(rA.Ry).toBeCloseTo(w * L, 8); // 12 * 5 = 60 kN
    expect(rA.Mr).toBeCloseTo((w * L * L) / 2, 8); // 12 * 25 / 2 = 150 kN*m
    expect(res.equilibrium.isBalanced).toBe(true);

    // 2. Cortante V(x)
    expect(res.shear.evaluate(0, 'right')).toBeCloseTo(w * L, 8);
    expect(res.shear.evaluate(L / 2)).toBeCloseTo((w * L) / 2, 8);
    expect(res.shear.evaluate(L, 'left')).toBeCloseTo(0, 8);
    expect(res.shear.maxAbsolute.value).toBeCloseTo(w * L, 8);

    // 3. Momento M(x)
    expect(res.moment.evaluate(0, 'right')).toBeCloseTo(-(w * L * L) / 2, 8);
    expect(res.moment.evaluate(L / 2)).toBeCloseTo(-(w * (L / 2) ** 2) / 2, 8);
    expect(res.moment.evaluate(L, 'left')).toBeCloseTo(0, 8);

    // 4. Máximos analíticos
    expect(res.moment.maxAbsolute.value).toBeCloseTo((w * L * L) / 2, 8);
    expect(res.moment.maxAbsolute.x).toBeCloseTo(0, 8);
    expect(res.moment.maxNegative.value).toBeCloseTo(-(w * L * L) / 2, 8);
    expect(res.moment.maxNegative.x).toBeCloseTo(0, 8);
  });

  // --------------------------------------------------------------------------
  // CASO 6: Viga simplemente apoyada con carga puntual central P
  // Apoyos en x = 0 y x = L, carga P en x = L/2
  // Fórmulas teóricas:
  //   RA = RB = P / 2
  //   V(x) = +P/2 para x < L/2, -P/2 para x > L/2
  //   Salto en x = L/2: Delta V = -P
  //   M_max = (P * L) / 4 en x = L/2
  //   M(0) = 0, M(L) = 0
  // --------------------------------------------------------------------------
  it('Caso 6: Viga simplemente apoyada con carga puntual central (Pytel-Singer Caso 6)', () => {
    const L = 6.0; // metros
    const P = 40.0; // kN

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: L },
      ],
      loads: [{ id: 'P1', type: 'point', x: L / 2, P }],
    };

    const res = analyzeBeam(model);

    // 1. Reacciones simétricas
    const rA = res.reactions.find((r) => r.supportId === 'S1')!;
    const rB = res.reactions.find((r) => r.supportId === 'S2')!;
    expect(rA.Ry).toBeCloseTo(P / 2, 8); // 20 kN
    expect(rB.Ry).toBeCloseTo(P / 2, 8); // 20 kN
    expect(res.equilibrium.isBalanced).toBe(true);

    // 2. Discontinuidad del cortante en el centro
    expect(res.shear.evaluate(L / 2, 'left')).toBeCloseTo(P / 2, 8);
    expect(res.shear.evaluate(L / 2, 'right')).toBeCloseTo(-P / 2, 8);
    expect(res.shear.discontinuities).toHaveLength(1);
    const disc = res.shear.discontinuities[0]!;
    expect(disc.x).toBeCloseTo(L / 2, 8);
    expect(disc.jump).toBeCloseTo(-P, 8);

    // 3. Momento máximo central
    const theoreticalMmax = (P * L) / 4; // 40 * 6 / 4 = 60 kN*m
    expect(res.moment.evaluate(0)).toBeCloseTo(0, 8);
    expect(res.moment.evaluate(L)).toBeCloseTo(0, 8);
    expect(res.moment.evaluate(L / 2)).toBeCloseTo(theoreticalMmax, 8);

    expect(res.moment.maxPositive.value).toBeCloseTo(theoreticalMmax, 8);
    expect(res.moment.maxPositive.x).toBeCloseTo(L / 2, 8);
    expect(res.moment.maxAbsolute.value).toBeCloseTo(theoreticalMmax, 8);
  });

  // --------------------------------------------------------------------------
  // CASO 8: Viga simplemente apoyada con carga uniforme w
  // Apoyos en x = 0 y x = L, carga w en [0, L]
  // Fórmulas teóricas:
  //   RA = RB = (w * L) / 2
  //   V(x) = (w * L)/2 - w * x
  //   V(L/2) = 0
  //   M_max = (w * L^2) / 8 en x = L/2
  // --------------------------------------------------------------------------
  it('Caso 8: Viga simplemente apoyada con carga uniforme w (Pytel-Singer Caso 8)', () => {
    const L = 8.0; // metros
    const w = 15.0; // kN/m

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: L },
      ],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0,
          xEnd: L,
          wStart: w,
          wEnd: w,
        },
      ],
    };

    const res = analyzeBeam(model);

    // 1. Reacciones
    const rA = res.reactions.find((r) => r.supportId === 'S1')!;
    const rB = res.reactions.find((r) => r.supportId === 'S2')!;
    const theoreticalR = (w * L) / 2; // 15 * 8 / 2 = 60 kN
    expect(rA.Ry).toBeCloseTo(theoreticalR, 8);
    expect(rB.Ry).toBeCloseTo(theoreticalR, 8);
    expect(res.equilibrium.isBalanced).toBe(true);

    // 2. Cortante lineal
    expect(res.shear.evaluate(0, 'right')).toBeCloseTo(theoreticalR, 8);
    expect(res.shear.evaluate(L / 2)).toBeCloseTo(0, 8);
    expect(res.shear.evaluate(L, 'left')).toBeCloseTo(-theoreticalR, 8);
    expect(res.shear.maxAbsolute.value).toBeCloseTo(theoreticalR, 8);

    // 3. Momento parabólico y extremo analítico exacto en L/2
    const theoreticalMmax = (w * L * L) / 8; // 15 * 64 / 8 = 120 kN*m
    expect(res.moment.evaluate(0)).toBeCloseTo(0, 8);
    expect(res.moment.evaluate(L)).toBeCloseTo(0, 8);
    expect(res.moment.evaluate(L / 2)).toBeCloseTo(theoreticalMmax, 8);

    expect(res.moment.maxPositive.value).toBeCloseTo(theoreticalMmax, 8);
    expect(res.moment.maxPositive.x).toBeCloseTo(L / 2, 8);
    expect(res.moment.maxAbsolute.value).toBeCloseTo(theoreticalMmax, 8);
    expect(res.moment.maxAbsolute.x).toBeCloseTo(L / 2, 8);
  });
});
