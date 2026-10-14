import { describe, expect, it } from 'vitest';
import { adaptFormToBeamModel } from '../src/adapters/beamAdapter.js';
import { validateBeamModel, analyzeBeam } from '@optisteel/core';
import type { BeamFormState } from '../src/types/ui.js';

describe('Fase 3.1: Validación Funcional de Casos Estructurales e Integración', () => {
  const baseMaterial = {
    materialName: 'Acero A36',
    E: 200.0, // GPa
    sectionName: 'W10x30',
    Iz: 7076.0, // cm^4 -> EI = 14152 kN*m^2
  };

  // -------------------------------------------------------------------------
  // Caso 1: Viga simplemente apoyada con carga uniforme
  // -------------------------------------------------------------------------
  it('1. Viga simplemente apoyada con carga uniforme: contrasta con solución cerrada clásica', () => {
    // L = 6 m, w = 12 kN/m
    // EI = 200 * 7076 * 1e-2 = 14152 kN*m^2
    const form: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        {
          id: 'W',
          type: 'distributed',
          xStart: 0,
          xEnd: 6.0,
          wStart: 12.0,
          wEnd: 12.0,
        },
      ],
    };

    const model = adaptFormToBeamModel(form);
    const val = validateBeamModel(model);
    expect(val.isValid).toBe(true);

    const res = analyzeBeam(model);

    // Reacciones teóricas: RA = RB = w*L/2 = 12 * 6 / 2 = 36 kN
    expect(res.reactions[0]?.Ry).toBeCloseTo(36.0, 5);
    expect(res.reactions[1]?.Ry).toBeCloseTo(36.0, 5);
    expect(res.equilibrium.isBalanced).toBe(true);

    // Cortante máximo: |V|max = 36 kN en x = 0 y x = 6 m
    expect(res.shear.maxAbsolute.value).toBeCloseTo(36.0, 5);

    // Momento máximo: Mmax = w*L^2/8 = 12 * 36 / 8 = 54 kN*m en x = 3 m
    expect(res.moment.maxPositive.value).toBeCloseTo(54.0, 5);
    expect(res.moment.maxPositive.x).toBeCloseTo(3.0, 5);

    // Deflexión máxima: y_max = 5*w*L^4 / (384*EI) = 5*12*1296 / (384*14152) = 77760 / 5434368 ~= 0.0143089 m
    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');
    expect(res.deflection.maxDownward.value).toBeCloseTo(0.0143089, 6);
    expect(res.deflection.maxDownward.x).toBeCloseTo(3.0, 4);

    // Pendientes en extremos: theta = dy/dx (con y positivo hacia abajo)
    // theta_A = +w*L^3/(24*EI) = +12*216/(24*14152) ~= +0.0076314 rad
    // theta_B = -w*L^3/(24*EI) ~= -0.0076314 rad
    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(0.0076314, 5);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(-0.0076314, 5);
  });

  // -------------------------------------------------------------------------
  // Caso 2: Viga simplemente apoyada con carga puntual central
  // -------------------------------------------------------------------------
  it('2. Viga simplemente apoyada con carga puntual central: P = 40 kN en centro', () => {
    // L = 8 m, P = 40 kN en x = 4 m
    const form: BeamFormState = {
      length: 8.0,
      materialName: 'Acero A36',
      E: 200.0,
      sectionName: 'W12x40',
      Iz: 12900.0, // EI = 25800 kN*m^2
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 8.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 4.0, P: 40.0 }],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Reacciones: RA = RB = P/2 = 20 kN
    expect(res.reactions[0]?.Ry).toBeCloseTo(20.0, 5);
    expect(res.reactions[1]?.Ry).toBeCloseTo(20.0, 5);

    // Momento máximo: Mmax = P*L/4 = 40 * 8 / 4 = 80 kN*m en x = 4 m
    expect(res.moment.maxPositive.value).toBeCloseTo(80.0, 5);
    expect(res.moment.maxPositive.x).toBeCloseTo(4.0, 5);

    // Deflexión máxima: y_max = P*L^3/(48*EI) = 40 * 512 / (48 * 25800) = 20480 / 1238400 ~= 0.0165375 m
    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');
    expect(res.deflection.maxDownward.value).toBeCloseTo(0.0165375, 6);
    expect(res.deflection.maxDownward.x).toBeCloseTo(4.0, 4);
  });

  // -------------------------------------------------------------------------
  // Caso 3: Carga puntual excéntrica
  // -------------------------------------------------------------------------
  it('3. Carga puntual excéntrica: contrasta posición y magnitud exacta del máximo', () => {
    // L = 6 m, a = 2 m, b = 4 m, P = 30 kN
    // EI = 14152 kN*m^2
    const form: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 2.0, P: 30.0 }],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Reacciones: RA = P*b/L = 30*4/6 = 20 kN, RB = P*a/L = 30*2/6 = 10 kN
    expect(res.reactions[0]?.Ry).toBeCloseTo(20.0, 5);
    expect(res.reactions[1]?.Ry).toBeCloseTo(10.0, 5);

    // Momento en la carga x = 2 m: M = P*a*b/L = 30*2*4/6 = 40 kN*m
    expect(res.moment.evaluate(2.0)).toBeCloseTo(40.0, 5);

    // Posición analítica de flecha máxima: dado que a=2 < b=4, el máximo ocurre en el tramo mayor [a, L].
    // Medido desde el apoyo derecho: x' = sqrt((L^2 - a^2)/3) = sqrt(32/3) ~= 3.265986 m
    // Medido desde el origen x=0: xm = L - sqrt((L^2 - a^2)/3) = 6 - sqrt(32/3) ~= 2.734014 m
    // Valor analítico: y_max = P*a*(L^2 - a^2)^1.5 / (9*sqrt(3)*EI*L) ~= 0.0082055 m
    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');
    const xExpected = 6 - Math.sqrt((36 - 4) / 3);
    const yExpected =
      (30 * 2 * Math.pow(36 - 4, 1.5)) / (9 * Math.sqrt(3) * 14152 * 6);

    expect(res.deflection.maxDownward.x).toBeCloseTo(xExpected, 4);
    expect(res.deflection.maxDownward.value).toBeCloseTo(yExpected, 6);

    // La deflexión máxima es estrictamente mayor que la deflexión bajo la carga (x=2)
    expect(res.deflection.maxDownward.value).toBeGreaterThan(
      res.deflection.evaluate(2.0)
    );
  });

  // -------------------------------------------------------------------------
  // Caso 4: Viga en voladizo con carga puntual en el extremo
  // -------------------------------------------------------------------------
  it('4. Viga en voladizo con carga puntual en el extremo: momento negativo y flecha en punta', () => {
    // L = 4 m, empotramiento en x = 0, P = 25 kN en x = 4 m
    // EI = 200 * 3450 * 1e-2 = 6900 kN*m^2
    const form: BeamFormState = {
      length: 4.0,
      materialName: 'Acero A36',
      E: 200.0,
      sectionName: 'W8x24',
      Iz: 3450.0,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [{ id: 'P', type: 'point', x: 4.0, P: 25.0 }],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Reacción vertical: Ry = 25 kN (↑)
    expect(res.reactions[0]?.Ry).toBeCloseTo(25.0, 5);
    // Momento de reacción: Mr = P*L = 25 * 4 = 100 kN*m (antihorario +CCW)
    expect(res.reactions[0]?.Mr).toBeCloseTo(100.0, 5);

    // Momento flector en el empotramiento: M(0) = -100 kN*m (hogging)
    expect(res.moment.evaluate(0)).toBeCloseTo(-100.0, 5);
    expect(res.moment.maxNegative.value).toBeCloseTo(-100.0, 5);
    expect(res.moment.maxNegative.x).toBeCloseTo(0, 5);

    // Deflexión máxima en la punta libre: y_max = P*L^3 / (3*EI) = 25 * 64 / (3 * 6900) ~= 0.0772947 m
    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');
    expect(res.deflection.maxDownward.x).toBeCloseTo(4.0, 5);
    expect(res.deflection.maxDownward.value).toBeCloseTo(0.0772947, 6);

    // Giro en punta: theta(L) = P*L^2 / (2*EI) = 25 * 16 / (2 * 6900) ~= 0.0289855 rad
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(0.0289855, 6);
  });

  // -------------------------------------------------------------------------
  // Caso 5: Cargas distribuidas lineales (Triangular)
  // -------------------------------------------------------------------------
  it('5. Cargas distribuidas lineales: viga simplemente apoyada con carga triangular creciente', () => {
    // L = 6 m, w(x) de 0 a 18 kN/m
    const form: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        {
          id: 'W_tri',
          type: 'distributed',
          xStart: 0,
          xEnd: 6.0,
          wStart: 0,
          wEnd: 18.0,
        },
      ],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Reacciones: W_total = 18*6/2 = 54 kN
    // RA = 54 / 3 = 18 kN, RB = 54 * 2 / 3 = 36 kN
    expect(res.reactions[0]?.Ry).toBeCloseTo(18.0, 5);
    expect(res.reactions[1]?.Ry).toBeCloseTo(36.0, 5);

    // Momento máximo en V(x) = 0: x = sqrt(12) ~= 3.4641 m
    // Mmax = 24*sqrt(3) ~= 41.5692 kN*m
    const xZeroShear = Math.sqrt(12);
    const mMaxExpected = 24 * Math.sqrt(3);

    expect(res.moment.maxPositive.x).toBeCloseTo(xZeroShear, 4);
    expect(res.moment.maxPositive.value).toBeCloseTo(mMaxExpected, 4);
  });

  // -------------------------------------------------------------------------
  // Caso 6: Momentos externos y cargas combinadas
  // -------------------------------------------------------------------------
  it('6. Momentos externos y cargas combinadas: superposición y equilibrio estático riguroso', () => {
    // L = 6 m, w = 10 kN/m en todo el vano, momento aplicado M = 30 kN*m en x = 3 m
    const form: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        {
          id: 'W',
          type: 'distributed',
          xStart: 0,
          xEnd: 6.0,
          wStart: 10.0,
          wEnd: 10.0,
        },
        { id: 'M1', type: 'moment', x: 3.0, M: 30.0 },
      ],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Carga w aporta: RA_w = 30 kN, RB_w = 30 kN
    // Momento antihorario M = +30 aporta par restaurador horario: RA_M = +5 kN, RB_M = -5 kN
    // Total: RA = 30 + 5 = 35 kN, RB = 30 - 5 = 25 kN
    expect(res.reactions[0]?.Ry).toBeCloseTo(35.0, 5);
    expect(res.reactions[1]?.Ry).toBeCloseTo(25.0, 5);
    expect(res.equilibrium.isBalanced).toBe(true);

    // En x = 3 m, el momento sufre una discontinuidad (salto) de -30 kN*m
    const disc = res.moment.discontinuities.find((d) => Math.abs(d.x - 3.0) < 1e-4);
    expect(disc).toBeDefined();
    expect(disc?.jump).toBeCloseTo(-30.0, 5);
    expect(Math.abs(disc?.jump ?? 0)).toBeCloseTo(30.0, 5);
  });

  // -------------------------------------------------------------------------
  // Caso 7: Equilibrio estático y signos de los diagramas
  // -------------------------------------------------------------------------
  it('7. Equilibrio estático y signos de los diagramas: relaciones diferenciales dV/dx = -w y dM/dx = V', () => {
    const form: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        { id: 'W', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
        { id: 'P', type: 'point', x: 2.0, P: 20.0 },
      ],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    // Verificación numérica de la derivada dM/dx = V(x) por diferencias finitas
    const delta = 1e-5;
    for (const testX of [0.5, 1.5, 3.5, 4.5, 5.5]) {
      const vVal = res.shear.evaluate(testX);
      const dMdx = (res.moment.evaluate(testX + delta) - res.moment.evaluate(testX - delta)) / (2 * delta);
      expect(dMdx).toBeCloseTo(vVal, 4);
    }

    // Salto de cortante en la carga puntual x = 2 m: Delta V = -P = -20 kN
    const vBefore = res.shear.evaluate(2.0, 'left');
    const vAfter = res.shear.evaluate(2.0, 'right');
    expect(vAfter - vBefore).toBeCloseTo(-20.0, 5);
  });

  // -------------------------------------------------------------------------
  // Caso 8: Posición y valor de la flecha máxima en viga con voladizo (H-F2-01)
  // -------------------------------------------------------------------------
  it('8. Posición y valor de la flecha máxima: detecta pico interior y no subestima con punta', () => {
    // Viga de 10 m con apoyos en 0 y 8 m, P1 = 50 kN en x = 2 m, P2 = 30 kN en x = 10 m
    const form: BeamFormState = {
      length: 10.0,
      ...baseMaterial,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 8.0 },
      ],
      loads: [
        { id: 'P1', type: 'point', x: 2.0, P: 50.0 },
        { id: 'P2', type: 'point', x: 10.0, P: 30.0 },
      ],
    };

    const model = adaptFormToBeamModel(form);
    const res = analyzeBeam(model);

    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');

    // La deflexión máxima hacia abajo está en el vano interior x ~ 2.6548 m
    expect(res.deflection.maxDownward.x).toBeCloseTo(2.6548, 3);
    expect(res.deflection.maxDownward.value * 1000).toBeCloseTo(11.376, 2);

    // La punta libre en x = 10 m tiene deflexión menor que el pico interior
    const yTip = res.deflection.evaluate(10.0);
    expect(yTip * 1000).toBeCloseTo(10.599, 2);
    expect(res.deflection.maxDownward.value).toBeGreaterThan(yTip);

    // Existe además un levantamiento hacia arriba en el apoyo interior x ~ 7.3452 m
    expect(res.deflection.maxUpward.x).toBeCloseTo(7.3452, 3);
    expect(res.deflection.maxUpward.value).toBeLessThan(0);
  });

  // -------------------------------------------------------------------------
  // Caso 9: Validación de entradas y apoyos incompatibles
  // -------------------------------------------------------------------------
  it('9. Validación de entradas y apoyos incompatibles: rechaza inestables e hiperestáticas', () => {
    // 9.1 Sin apoyos -> inestable
    const noSupportsForm: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [],
      loads: [{ id: 'P', type: 'point', x: 3.0, P: 10.0 }],
    };
    const val1 = validateBeamModel(adaptFormToBeamModel(noSupportsForm));
    expect(val1.isValid).toBe(false);
    expect(val1.classification).toBe('unstable');

    // 9.2 Un solo apoyo simple -> inestable
    const oneSimpleSupportForm: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [{ id: 'S1', type: 'roller', x: 3.0 }],
      loads: [{ id: 'P', type: 'point', x: 3.0, P: 10.0 }],
    };
    const val2 = validateBeamModel(adaptFormToBeamModel(oneSimpleSupportForm));
    expect(val2.isValid).toBe(false);
    expect(val2.classification).toBe('unstable');

    // 9.3 Tres apoyos simples -> hiperestático (no soportado en v2 isostática)
    const threeSupportsForm: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 3.0 },
        { id: 'S3', type: 'roller', x: 6.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 1.5, P: 10.0 }],
    };
    const val3 = validateBeamModel(adaptFormToBeamModel(threeSupportsForm));
    expect(val3.isValid).toBe(false);
    expect(val3.classification).toBe('hyperstatic');

    // 9.4 Apoyos coincidentes -> inválido
    const coincidentSupportsForm: BeamFormState = {
      length: 6.0,
      ...baseMaterial,
      supports: [
        { id: 'S1', type: 'pin', x: 2.0 },
        { id: 'S2', type: 'roller', x: 2.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 4.0, P: 10.0 }],
    };
    const val4 = validateBeamModel(adaptFormToBeamModel(coincidentSupportsForm));
    expect(val4.isValid).toBe(false);
    expect(val4.classification).toBe('invalid');

    // 9.5 Carga fuera de la viga -> inválido
    const loadOutsideForm: BeamFormState = {
      length: 5.0,
      ...baseMaterial,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 5.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 7.0, P: 10.0 }],
    };
    const val5 = validateBeamModel(adaptFormToBeamModel(loadOutsideForm));
    expect(val5.isValid).toBe(false);
    expect(val5.errors.some((e) => e.includes('fuera de la viga'))).toBe(true);
  });
});
