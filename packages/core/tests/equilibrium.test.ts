import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../src/index.js';
import type { BeamModel } from '../src/types.js';

describe('Equilibrio Estático Riguroso y Cierre en Fronteras', () => {
  it('Viga con voladizos en ambos extremos, múltiples cargas y momento aplicado', () => {
    // Viga de 12 m
    // Apoyos en x = 2 m (voladizo izquierdo de 2 m) y x = 9 m (voladizo derecho de 3 m)
    const L = 12.0;

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 'S1', type: 'pin', x: 2.0 },
        { id: 'S2', type: 'roller', x: 9.0 },
      ],
      loads: [
        // Carga puntual en punta izquierda (x = 0)
        { id: 'P_tip_left', type: 'point', x: 0.0, P: 15.0 },
        // Carga distribuida uniforme en vano interior (x = 2 a 6)
        {
          id: 'W_mid',
          type: 'distributed',
          xStart: 2.0,
          xEnd: 6.0,
          wStart: 8.0,
          wEnd: 8.0,
        },
        // Momento concentrado en x = 4.5
        { id: 'M_mid', type: 'moment', x: 4.5, M: 20.0 },
        // Carga distribuida trapezoidal (x = 7 a 9)
        {
          id: 'W_trap',
          type: 'distributed',
          xStart: 7.0,
          xEnd: 9.0,
          wStart: 4.0,
          wEnd: 12.0,
        },
        // Carga puntual en punta derecha (x = 12)
        { id: 'P_tip_right', type: 'point', x: 12.0, P: 25.0 },
      ],
    };

    const res = analyzeBeam(model);

    // 1. Verificación de equilibrio estático global
    expect(res.equilibrium.isBalanced).toBe(true);
    expect(Math.abs(res.equilibrium.sumFy)).toBeLessThan(1e-7);
    expect(Math.abs(res.equilibrium.sumM)).toBeLessThan(1e-7);

    // 2. Comprobación de cierre en extremos de la viga
    // En x = 0 (punta libre): antes de la carga V=0, M=0.
    // Tras la carga puntual P=15, V(0+) = -15 kN. M(0+) = 0.
    expect(res.shear.evaluate(0.0, 'right')).toBeCloseTo(-15.0, 7);
    expect(res.moment.evaluate(0.0, 'right')).toBeCloseTo(0.0, 7);

    // En x = 12 (punta derecha): antes de la carga puntual P=25,
    // para equilibrio de la punta libre, el cortante debe ser +25 kN para que la carga lo cierre a 0!
    expect(res.shear.evaluate(12.0, 'left')).toBeCloseTo(25.0, 7);
    expect(res.moment.evaluate(12.0, 'left')).toBeCloseTo(0.0, 7);

    // 3. Comprobación de relación diferencial dM/dx = V(x) en puntos muestreados
    const deltaX = 1e-5;
    const testPoints = [1.0, 3.0, 5.0, 8.0, 10.5];

    for (const x of testPoints) {
      const v = res.shear.evaluate(x);
      const m1 = res.moment.evaluate(x - deltaX);
      const m2 = res.moment.evaluate(x + deltaX);
      const numericalDerivative = (m2 - m1) / (2 * deltaX);

      // La derivada numérica central de M(x) debe coincidir con V(x) dentro de 1e-4
      expect(numericalDerivative).toBeCloseTo(v, 3);
    }
  });

  it('Viga sin cargas aplicadas devuelve reacciones nulas y funciones cero', () => {
    const model: BeamModel = {
      length: 5.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 5.0 },
      ],
      loads: [],
    };

    const res = analyzeBeam(model);

    expect(res.equilibrium.isBalanced).toBe(true);
    for (const r of res.reactions) {
      expect(r.Ry).toBeCloseTo(0, 8);
    }
    expect(res.shear.maxAbsolute.value).toBeCloseTo(0, 8);
    expect(res.moment.maxAbsolute.value).toBeCloseTo(0, 8);
  });
});
