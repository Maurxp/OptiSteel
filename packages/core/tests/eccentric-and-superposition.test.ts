import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../src/index.js';
import type { BeamModel } from '../src/types.js';

describe('Cargas Excéntricas, Superposición y Cargas Triangulares', () => {
  // --------------------------------------------------------------------------
  // Carga puntual excéntrica en viga simplemente apoyada
  // P en x = a, con b = L - a
  // RA = P * b / L, RB = P * a / L
  // M_max = P * a * b / L en x = a
  // --------------------------------------------------------------------------
  it('Carga puntual excéntrica (a != b)', () => {
    const L = 10.0;
    const a = 3.0;
    const b = L - a; // 7.0
    const P = 50.0; // kN

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: L },
      ],
      loads: [{ id: 'P1', type: 'point', x: a, P }],
    };

    const res = analyzeBeam(model);

    const rA = res.reactions.find((r) => r.supportId === 'S1')!;
    const rB = res.reactions.find((r) => r.supportId === 'S2')!;

    const theoreticalRA = (P * b) / L; // 50 * 7 / 10 = 35 kN
    const theoreticalRB = (P * a) / L; // 50 * 3 / 10 = 15 kN
    const theoreticalMmax = (P * a * b) / L; // 50 * 3 * 7 / 10 = 105 kN*m

    expect(rA.Ry).toBeCloseTo(theoreticalRA, 8);
    expect(rB.Ry).toBeCloseTo(theoreticalRB, 8);
    expect(res.equilibrium.isBalanced).toBe(true);

    // Cortante a la izquierda y derecha de la carga
    expect(res.shear.evaluate(a, 'left')).toBeCloseTo(theoreticalRA, 8);
    expect(res.shear.evaluate(a, 'right')).toBeCloseTo(-theoreticalRB, 8);

    // Momento máximo en x = a
    expect(res.moment.evaluate(a)).toBeCloseTo(theoreticalMmax, 8);
    expect(res.moment.maxPositive.value).toBeCloseTo(theoreticalMmax, 8);
    expect(res.moment.maxPositive.x).toBeCloseTo(a, 8);
  });

  // --------------------------------------------------------------------------
  // Principio de Superposición Lineal
  // Estado 1: Viga con carga distribuida uniforme w
  // Estado 2: Misma viga con carga puntual P
  // Estado 3: Viga con ambas cargas simultáneas (w + P)
  // Se debe verificar: R3 = R1 + R2, V3(x) = V1(x) + V2(x), M3(x) = M1(x) + M2(x)
  // --------------------------------------------------------------------------
  it('Principio de Superposición (carga uniforme + carga puntual)', () => {
    const L = 8.0;
    const w = 10.0; // kN/m
    const P = 30.0; // kN en x = 4.0 m

    const modelW: BeamModel = {
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

    const modelP: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: L },
      ],
      loads: [{ id: 'P1', type: 'point', x: 4.0, P }],
    };

    const modelCombined: BeamModel = {
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
        { id: 'P1', type: 'point', x: 4.0, P },
      ],
    };

    const resW = analyzeBeam(modelW);
    const resP = analyzeBeam(modelP);
    const resCombined = analyzeBeam(modelCombined);

    // Superposición de reacciones
    const rAW = resW.reactions.find((r) => r.supportId === 'S1')!.Ry;
    const rAP = resP.reactions.find((r) => r.supportId === 'S1')!.Ry;
    const rAComb = resCombined.reactions.find((r) => r.supportId === 'S1')!.Ry;
    expect(rAComb).toBeCloseTo(rAW + rAP, 8);

    const rBW = resW.reactions.find((r) => r.supportId === 'S2')!.Ry;
    const rBP = resP.reactions.find((r) => r.supportId === 'S2')!.Ry;
    const rBComb = resCombined.reactions.find((r) => r.supportId === 'S2')!.Ry;
    expect(rBComb).toBeCloseTo(rBW + rBP, 8);

    // Superposición de cortantes y momentos en múltiples secciones
    const testPoints = [0.5, 2.0, 3.99, 4.01, 6.0, 7.5];
    for (const x of testPoints) {
      const vW = resW.shear.evaluate(x);
      const vP = resP.shear.evaluate(x);
      const vComb = resCombined.shear.evaluate(x);
      expect(vComb).toBeCloseTo(vW + vP, 7);

      const mW = resW.moment.evaluate(x);
      const mP = resP.moment.evaluate(x);
      const mComb = resCombined.moment.evaluate(x);
      expect(mComb).toBeCloseTo(mW + mP, 7);
    }
  });

  // --------------------------------------------------------------------------
  // Carga distribuida triangular en voladizo (wStart = 0, wEnd = w0)
  // Empotrado en x = 0, L = 6, w0 = 18 kN/m
  // Carga total W = (w0 * L) / 2 = 54 kN
  // Brazo del centroide desde x = 0: xBar = (2/3) * L = 4 m
  // Reacción RA = W = 54 kN
  // Momento de empotramiento MA = W * (2/3 * L) = (w0 * L^2) / 3 = 216 kN*m
  // --------------------------------------------------------------------------
  it('Voladizo con carga triangular (wStart = 0, wEnd = w0)', () => {
    const L = 6.0;
    const w0 = 18.0;

    const model: BeamModel = {
      length: L,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [
        {
          id: 'WT',
          type: 'distributed',
          xStart: 0,
          xEnd: L,
          wStart: 0,
          wEnd: w0,
        },
      ],
    };

    const res = analyzeBeam(model);

    const rA = res.reactions[0]!;
    const theoreticalW = (w0 * L) / 2; // 54 kN
    const theoreticalMA = (w0 * L * L) / 3; // 18 * 36 / 3 = 216 kN*m

    expect(rA.Ry).toBeCloseTo(theoreticalW, 8);
    expect(rA.Mr).toBeCloseTo(theoreticalMA, 8);
    expect(res.equilibrium.isBalanced).toBe(true);

    // Cortante en x = 0 y x = L
    expect(res.shear.evaluate(0, 'right')).toBeCloseTo(theoreticalW, 8);
    expect(res.shear.evaluate(L, 'left')).toBeCloseTo(0, 8);

    // Momento en x = 0 y x = L
    expect(res.moment.evaluate(0, 'right')).toBeCloseTo(-theoreticalMA, 8);
    expect(res.moment.evaluate(L, 'left')).toBeCloseTo(0, 8);
    expect(res.moment.maxNegative.value).toBeCloseTo(-theoreticalMA, 8);
    expect(res.moment.maxAbsolute.value).toBeCloseTo(theoreticalMA, 8);
  });

  // --------------------------------------------------------------------------
  // Viga simplemente apoyada con momento concentrado M0 en el centro
  // Apoyos en 0 y L, momento CCW M0 en x = L/2
  // Reacciones: Ry2 * L - M0 = 0 => RB = M0 / L (hacia abajo!), RA = -M0 / L
  // O con CCW positivo:
  // Ry2 * L + M0 = 0 => RB = -M0 / L (hacia abajo), RA = +M0 / L (hacia arriba)
  // --------------------------------------------------------------------------
  it('Viga simplemente apoyada con momento concentrado aplicado M0', () => {
    const L = 6.0;
    const M0 = 30.0; // kN*m (CCW)

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: L },
      ],
      loads: [{ id: 'M1', type: 'moment', x: L / 2, M: M0 }],
    };

    const res = analyzeBeam(model);

    const rA = res.reactions.find((r) => r.supportId === 'S1')!;
    const rB = res.reactions.find((r) => r.supportId === 'S2')!;

    // Equilibrio: Ry2 * 6 - (-30) ?
    // Con M0 aplicado CCW (+M0 = +30):
    // Suma de momentos en x1=0:
    // Ry2 * L + M0 = 0 => Ry2 = -M0 / L = -5 kN (hacia abajo)
    // Ry1 = -Ry2 = +5 kN (hacia arriba)
    expect(rB.Ry).toBeCloseTo(-M0 / L, 8);
    expect(rA.Ry).toBeCloseTo(M0 / L, 8);
    expect(res.equilibrium.isBalanced).toBe(true);

    // Cortante constante V(x) = +5 kN a lo largo de toda la viga
    expect(res.shear.evaluate(1.0)).toBeCloseTo(M0 / L, 8);
    expect(res.shear.evaluate(5.0)).toBeCloseTo(M0 / L, 8);

    // Salto de momento en x = L/2:
    // A la izquierda de L/2 (x=3): M(3-) = RA * 3 = 5 * 3 = +15 kN*m
    // Salto por momento aplicado CCW (+M0 = +30): M(3+) = M(3-) - 30 ?
    // Verifiquemos discontinuidad:
    expect(res.moment.discontinuities).toHaveLength(1);
    const disc = res.moment.discontinuities[0]!;
    expect(disc.x).toBeCloseTo(L / 2, 8);
    expect(Math.abs(disc.jump)).toBeCloseTo(M0, 8);
  });
});
