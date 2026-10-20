import { describe, expect, it } from 'vitest';
import { analyzeBeam, calculateFlexuralRigidity } from '../src/index.js';
import type { BeamMaterial, BeamModel, BeamSection } from '../src/types.js';

/**
 * OptiSteel 2.0 — Batería TDD para Análisis Hiperestático
 * FASE INICIAL: CASO CANÓNICO H1 (Viga empotrada-apoyada con carga puntual central)
 *
 * Configuración física H1:
 * - Longitud: L = 4.0 m
 * - Apoyo A (x = 0.0 m): Empotramiento ('fixed')
 * - Apoyo B (x = 4.0 m): Apoyo simple / rodillo ('roller')
 * - Carga P = 16.0 kN aplicada en x = 2.0 m (L/2)
 * - Rigidez flexional: EI = 10000.0 kN*m^2 (E = 200 GPa, Iz = 5000 cm^4)
 *
 * Convención de signos de OptiSteel 2.0:
 * - x longitudinal: positivo hacia la derecha [m]
 * - v(x) flecha: positivo hacia abajo [m]
 * - theta(x) = v'(x): rotación derivada positiva en sentido horario visual [rad]
 * - Ry reacción: positiva hacia arriba [kN]
 * - Mr momento de reacción: positivo antihorario (+CCW) [kN*m]
 * - M(x) momento interno: positivo sagante (+sagging, tracción inferior) [kN*m]
 * - Curvatura: EI v''(x) = -M(x)
 */
describe('OptiSteel 2.0 — Solver Hiperestático (TDD Caso H1)', () => {
  const material: BeamMaterial = { name: 'Acero Estructural', E: 200.0 }; // GPa
  const section: BeamSection = { name: 'Sección H1', Iz: 5000.0 }; // cm^4
  // EI = 200 GPa * 1e6 kN/m^2 * 5000 cm^4 * 1e-8 m^4 = 10000 kN*m^2
  const expectedEI = 10000.0;

  const h1Model: BeamModel = {
    id: 'H1-propped-cantilever-center-point-load',
    length: 4.0,
    supports: [
      { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento)' },
      { id: 'S2', type: 'roller', x: 4.0, label: 'B (Apoyo simple)' },
    ],
    loads: [
      { id: 'P1', type: 'point', x: 2.0, P: 16.0, label: 'P central' },
    ],
    material,
    section,
  };

  const h2Model: BeamModel = {
    id: 'H2-propped-cantilever-uniform-load',
    length: 6.0,
    supports: [
      { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento)' },
      { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo)' },
    ],
    loads: [
      {
        id: 'W1',
        type: 'distributed',
        xStart: 0.0,
        xEnd: 6.0,
        wStart: 10.0,
        wEnd: 10.0,
        label: 'w uniforme',
      },
    ],
    material,
    section,
  };

  const h3Model: BeamModel = {
    id: 'H3-fixed-fixed-uniform-load',
    length: 6.0,
    supports: [
      { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento izquierdo)' },
      { id: 'S2', type: 'fixed', x: 6.0, label: 'B (Empotramiento derecho)' },
    ],
    loads: [
      {
        id: 'W1',
        type: 'distributed',
        xStart: 0.0,
        xEnd: 6.0,
        wStart: 12.0,
        wEnd: 12.0,
        label: 'w uniforme',
      },
    ],
    material,
    section,
  };

  const h4Model: BeamModel = {
    id: 'H4-two-span-continuous-uniform-load',
    length: 8.0,
    supports: [
      { id: 'S1', type: 'pin', x: 0.0, label: 'A (Apoyo simple izquierdo)' },
      { id: 'S2', type: 'roller', x: 4.0, label: 'B (Apoyo central)' },
      { id: 'S3', type: 'roller', x: 8.0, label: 'C (Apoyo simple derecho)' },
    ],
    loads: [
      {
        id: 'W1',
        type: 'distributed',
        xStart: 0.0,
        xEnd: 8.0,
        wStart: 6.0,
        wEnd: 6.0,
        label: 'w uniforme en ambos vanos',
      },
    ],
    material,
    section,
  };

  it('Verificación previa: Rigidez flexional EI = 10000 kN*m^2 con unidades correctas', () => {
    const EI = calculateFlexuralRigidity(material, section);
    expect(EI).toBeCloseTo(expectedEI, 9);
  });

  // ===========================================================================
  // BLOQUE 1: PRUEBAS DE REFERENCIA ANALÍTICA INDEPENDIENTE (H1)
  // Valores derivados analíticamente mediante el Método de Fuerzas y Mohr
  // ===========================================================================
  describe('Bloque 1: Pruebas de Referencia Analítica Independiente', () => {
    it('T-H1-ANA-01: Reacciones estáticas exactas (RA = 11 kN, RB = 5 kN, MA = +12 kN*m antihorario)', () => {
      const result = analyzeBeam(h1Model);

      // Reacción vertical en A: RA = (11/16) * P = 11.0 kN
      const rA = result.reactions.find((r) => r.supportId === 'S1');
      expect(rA).toBeDefined();
      expect(rA?.Ry).toBeCloseTo(11.0, 6);

      // Momento de reacción en A: MA = +(3/16) * P * L = +12.0 kN*m (antihorario positivo)
      expect(rA?.Mr).toBeDefined();
      expect(rA?.Mr).toBeCloseTo(12.0, 6);

      // Reacción vertical en B: RB = (5/16) * P = 5.0 kN
      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rB).toBeDefined();
      expect(rB?.Ry).toBeCloseTo(5.0, 6);
      expect(rB?.Mr).toBeUndefined();
    });

    it('T-H1-ANA-02: Esfuerzos internos analíticos (M(0+) = -12 kN*m hogging, M(2) = +10 kN*m sagging, M(4) = 0)', () => {
      const result = analyzeBeam(h1Model);

      // Momento interno en 0+: M(0+) = -MA_react = -12.0 kN*m (tracción superior / hogging)
      const m0plus = result.moment.evaluate(0.0, 'right');
      expect(m0plus).toBeCloseTo(-12.0, 6);

      // Momento interno bajo la carga puntual x = 2.0 m: M(2) = +10.0 kN*m
      const mMid = result.moment.evaluate(2.0);
      expect(mMid).toBeCloseTo(10.0, 6);

      // Momento interno en el apoyo simple B: M(4) = 0.0 kN*m
      const mEnd = result.moment.evaluate(4.0, 'left');
      expect(mEnd).toBeCloseTo(0.0, 6);

      // Cortantes analíticos: V1 = +11.0 kN en [0, 2), V2 = -5.0 kN en (2, 4]
      expect(result.shear.evaluate(1.0)).toBeCloseTo(11.0, 6);
      expect(result.shear.evaluate(3.0)).toBeCloseTo(-5.0, 6);
    });

    it('T-H1-ANA-03: Punto de inflexión interior exacto en x = 3/11 L (x = 12/11 m ~ 1.090909 m)', () => {
      const result = analyzeBeam(h1Model);
      const expectedXInf = 12.0 / 11.0; // ~ 1.09090909 m

      // En el punto de inflexión, M(x) = 0
      expect(result.moment.evaluate(expectedXInf)).toBeCloseTo(0.0, 6);

      // El punto crítico debe estar registrado en los puntos críticos de momento
      const zeroCrossing = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - expectedXInf) < 1e-4
      );
      expect(zeroCrossing).toBeDefined();
    });

    it('T-H1-ANA-04: Flecha analítica bajo la carga central v(2 m) = 7PL^3 / (768 EI) = 0.933333 mm descendente', () => {
      const result = analyzeBeam(h1Model);
      if (!result.deflection.isImplemented) {
        throw new Error('El análisis de deflexiones debe estar implementado para H1');
      }

      // v(2) = 7 * 16 * 64 / (768 * 10000) = 7168 / 7680000 = 7/7500 m = 0.000933333333 m
      const expectedVmid = 7.0 / 7500.0; // m
      const vMid = result.deflection.evaluate(2.0);

      // Verificación en metros con tolerancia estricta
      expect(vMid).toBeCloseTo(expectedVmid, 8);
      // Verificación en milímetros (~ 0.933333 mm)
      expect(vMid * 1000.0).toBeCloseTo(0.933333, 5);

      // Pendiente analítica en x = 2 m: theta(2) = +0.000200 rad (2.00e-4 rad)
      const slopeMid = result.deflection.evaluateSlope(2.0);
      expect(slopeMid).toBeCloseTo(0.0002, 7);
    });

    it('T-H1-ANA-05: Posición y magnitud de flecha máxima (x_max = 4*(1 - 1/sqrt(5)) ~ 2.211146 m, v_max = PL^3 / (48*sqrt(5)*EI) ~ 0.954056 mm)', () => {
      const result = analyzeBeam(h1Model);
      if (!result.deflection.isImplemented) {
        throw new Error('El análisis de deflexiones debe estar implementado para H1');
      }

      // Posición exacta: x_max = 4 * (1 - 1/sqrt(5)) ~ 2.211145618 m
      const expectedXmax = 4.0 * (1.0 - 1.0 / Math.sqrt(5.0));
      // Flecha máxima analítica: v_max = 16 / (7500 * sqrt(5)) ~ 0.000954055670 m (0.954056 mm)
      const expectedVmax = 16.0 / (7500.0 * Math.sqrt(5.0));

      // Verificación de la posición reportada en maxDownward
      expect(result.deflection.maxDownward.x).toBeCloseTo(expectedXmax, 5);
      // Verificación de la magnitud reportada
      expect(result.deflection.maxDownward.value).toBeCloseTo(expectedVmax, 8);
      expect(result.deflection.maxDownward.value * 1000.0).toBeCloseTo(0.954056, 5);

      // Evaluación directa en evaluate(x_max)
      expect(result.deflection.evaluate(expectedXmax)).toBeCloseTo(expectedVmax, 8);
    });
  });

  // ===========================================================================
  // BLOQUE 2: COMPROBACIONES DE CONSISTENCIA INTERNA Y COMPATIBILIDAD CINEMÁTICA
  // ===========================================================================
  describe('Bloque 2: Comprobaciones de Consistencia Interna y Compatibilidad', () => {
    it('T-H1-CON-01: Equilibrio global de fuerzas verticales (sumFy = 0)', () => {
      const result = analyzeBeam(h1Model);

      // sum(Ry) - sum(P) = (11 + 5) - 16 = 0
      expect(result.equilibrium.sumFy).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.isBalanced).toBe(true);
    });

    it('T-H1-CON-02: Equilibrio global de momentos respecto a x = 0 (sumM = 0)', () => {
      const result = analyzeBeam(h1Model);

      // sum(Mr) + RB * 4 - P * 2 = 12 + 5*(4) - 16*(2) = 12 + 20 - 32 = 0
      expect(result.equilibrium.sumM).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.isBalanced).toBe(true);
    });

    it('T-H1-CON-03: Salto de cortante en la carga puntual Delta V(2 m) = -16 kN', () => {
      const result = analyzeBeam(h1Model);

      const vLeft = result.shear.evaluate(2.0, 'left');
      const vRight = result.shear.evaluate(2.0, 'right');
      const jump = vRight - vLeft;

      expect(vLeft).toBeCloseTo(11.0, 6);
      expect(vRight).toBeCloseTo(-5.0, 6);
      expect(jump).toBeCloseTo(-16.0, 6);
    });

    it('T-H1-CON-04: Salto de momento en el empotramiento M(0+) - M(0-) = -12 kN*m = -MA', () => {
      const result = analyzeBeam(h1Model);

      const mInside = result.moment.evaluate(0.0, 'right');
      // En x=0+, el momento interno debe ser rigurosamente opuesto al momento reactivo antihorario
      const rA = result.reactions.find((r) => r.supportId === 'S1');
      expect(mInside).toBeCloseTo(-(rA?.Mr ?? 0), 7);
    });

    it('T-H1-CON-05: Condiciones cinemáticas de frontera en apoyos (v(0) = 0, theta(0) = 0, v(4) = 0)', () => {
      const result = analyzeBeam(h1Model);
      if (!result.deflection.isImplemented) {
        throw new Error('El análisis de deflexiones debe estar implementado para H1');
      }

      // Empotramiento en x = 0: flecha nula y pendiente nula
      expect(result.deflection.evaluate(0.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluateSlope(0.0)).toBeCloseTo(0.0, 9);

      // Apoyo simple en x = 4: flecha nula
      expect(result.deflection.evaluate(4.0)).toBeCloseTo(0.0, 9);

      // Pendiente en x = 4 m no es nula (apoyo simple articulado)
      const slopeB = result.deflection.evaluateSlope(4.0);
      expect(Math.abs(slopeB)).toBeGreaterThan(1e-5);
    });

    it('T-H1-CON-06: Anulación de la pendiente elástica en el punto de flecha máxima theta(x_max) = 0', () => {
      const result = analyzeBeam(h1Model);
      if (!result.deflection.isImplemented) {
        throw new Error('El análisis de deflexiones debe estar implementado para H1');
      }

      const xMax = result.deflection.maxDownward.x;
      const slopeAtMax = result.deflection.evaluateSlope(xMax);
      expect(slopeAtMax).toBeCloseTo(0.0, 8);
    });

    it('T-H1-CON-07: Clasificación estática del resultado (isStaticDeterminate === false)', () => {
      const result = analyzeBeam(h1Model);
      // H1 es hiperestática de grado 1
      expect(result.isStaticDeterminate).toBe(false);
    });
  });

  // ===========================================================================
  // BLOQUE 3: CASO H2 (EMPOTRADA-APOYADA CON CARGA UNIFORME)
  // L = 6 m, w = 10 kN/m, EI = 10000 kN*m^2
  // ===========================================================================
  describe('Bloque 3: Caso H2 (Empotrada-apoyada con carga uniforme)', () => {
    it('T-H2-ANA-01: Reacciones estáticas exactas (RA = 5wL/8 = 37.5 kN, RB = 3wL/8 = 22.5 kN, MA = +wL^2/8 = +45 kN*m)', () => {
      const result = analyzeBeam(h2Model);

      const rA = result.reactions.find((r) => r.supportId === 'S1');
      expect(rA).toBeDefined();
      expect(rA?.Ry).toBeCloseTo(37.5, 6);
      expect(rA?.Mr).toBeCloseTo(45.0, 6);

      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rB).toBeDefined();
      expect(rB?.Ry).toBeCloseTo(22.5, 6);
      expect(rB?.Mr).toBeUndefined();

      expect(result.equilibrium.sumFy).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.sumM).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.isBalanced).toBe(true);
      expect(result.isStaticDeterminate).toBe(false);
    });

    it('T-H2-ANA-02: Esfuerzos internos analíticos (M(0+) = -45 kN*m, M_max = +25.3125 kN*m en x = 3.75 m, M(6) = 0)', () => {
      const result = analyzeBeam(h2Model);

      // Momento en empotramiento 0+: M(0+) = -45 kN*m
      expect(result.moment.evaluate(0.0, 'right')).toBeCloseTo(-45.0, 6);
      // Momento en apoyo simple: M(6) = 0
      expect(result.moment.evaluate(6.0, 'left')).toBeCloseTo(0.0, 6);

      // Cortante: V(0+) = +37.5 kN, V(6-) = -22.5 kN
      expect(result.shear.evaluate(0.0, 'right')).toBeCloseTo(37.5, 6);
      expect(result.shear.evaluate(6.0, 'left')).toBeCloseTo(-22.5, 6);

      // Cortante nulo en x = 5L/8 = 3.75 m
      expect(result.shear.evaluate(3.75)).toBeCloseTo(0.0, 6);

      // Momento máximo positivo en x = 3.75 m: M = 9wL^2/128 = 25.3125 kN*m
      expect(result.moment.evaluate(3.75)).toBeCloseTo(25.3125, 6);
    });

    it('T-H2-ANA-03: Punto de inflexión interior exacto en x = L/4 = 1.5 m (M(1.5) = 0)', () => {
      const result = analyzeBeam(h2Model);

      expect(result.moment.evaluate(1.5)).toBeCloseTo(0.0, 6);

      const inflectionPoint = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - 1.5) < 1e-4
      );
      expect(inflectionPoint).toBeDefined();
    });

    it('T-H2-ANA-04: Posición y magnitud de flecha máxima (x_max = (15-sqrt(33))/16 * L ~ 3.470789 m, v_max ~ 7.01925 mm)', () => {
      const result = analyzeBeam(h2Model);
      if (!result.deflection.isImplemented) {
        throw new Error('Deflexión debe estar implementada para H2');
      }

      // x_max = ((15 - sqrt(33)) / 16) * 6 = 3.4707890079 m
      const expectedXmax = ((15.0 - Math.sqrt(33.0)) / 16.0) * 6.0;
      // v_max = ((39 + 55*sqrt(33)) / 65536) * (w * L^4 / EI)
      const expectedVmax =
        ((39.0 + 55.0 * Math.sqrt(33.0)) / 65536.0) *
        ((10.0 * 6.0 ** 4) / expectedEI);

      expect(result.deflection.maxDownward.x).toBeCloseTo(expectedXmax, 4);
      expect(result.deflection.maxDownward.value).toBeCloseTo(expectedVmax, 6);
      expect(result.deflection.maxDownward.value * 1000.0).toBeCloseTo(7.01925, 4);

      // Pendiente nula en la flecha máxima
      expect(
        result.deflection.evaluateSlope(result.deflection.maxDownward.x)
      ).toBeCloseTo(0.0, 7);

      // Condiciones de contorno: v(0) = 0, theta(0) = 0, v(6) = 0
      expect(result.deflection.evaluate(0.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluateSlope(0.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluate(6.0)).toBeCloseTo(0.0, 9);
    });
  });

  // ===========================================================================
  // BLOQUE 4: CASO H3 (VIGA BIEMPOTRADA CON CARGA UNIFORME)
  // L = 6 m, w = 12 kN/m, EI = 10000 kN*m^2
  // ===========================================================================
  describe('Bloque 4: Caso H3 (Viga biempotrada con carga uniforme)', () => {
    it('T-H3-ANA-01: Reacciones estáticas exactas (RA = RB = wL/2 = 36 kN, MA = +36 kN*m, MB = -36 kN*m)', () => {
      const result = analyzeBeam(h3Model);

      const rA = result.reactions.find((r) => r.supportId === 'S1');
      expect(rA).toBeDefined();
      expect(rA?.Ry).toBeCloseTo(36.0, 6);
      expect(rA?.Mr).toBeCloseTo(36.0, 6); // +CCW

      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rB).toBeDefined();
      expect(rB?.Ry).toBeCloseTo(36.0, 6);
      expect(rB?.Mr).toBeCloseTo(-36.0, 6); // -CW

      expect(result.equilibrium.sumFy).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.sumM).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.isBalanced).toBe(true);
      expect(result.isStaticDeterminate).toBe(false);
    });

    it('T-H3-ANA-02: Esfuerzos internos analíticos (M(0+) = -36 kN*m, M(3) = +18 kN*m, M(6-) = -36 kN*m)', () => {
      const result = analyzeBeam(h3Model);

      // Momentos flectores en extremos: M(0+) = -36 kN*m, M(6-) = -36 kN*m
      expect(result.moment.evaluate(0.0, 'right')).toBeCloseTo(-36.0, 6);
      expect(result.moment.evaluate(6.0, 'left')).toBeCloseTo(-36.0, 6);

      // Momento central: M(L/2) = +wL^2/24 = +18.0 kN*m
      expect(result.moment.evaluate(3.0)).toBeCloseTo(18.0, 6);

      // Cortantes: V(0+) = +36.0 kN, V(3) = 0.0 kN, V(6-) = -36.0 kN
      expect(result.shear.evaluate(0.0, 'right')).toBeCloseTo(36.0, 6);
      expect(result.shear.evaluate(3.0)).toBeCloseTo(0.0, 6);
      expect(result.shear.evaluate(6.0, 'left')).toBeCloseTo(-36.0, 6);
    });

    it('T-H3-ANA-03: Puntos de inflexión interiores exactos en x = (1/2 +- sqrt(3)/6) * L (~ 1.2679 m y 4.7321 m)', () => {
      const result = analyzeBeam(h3Model);

      const xInf1 = (0.5 - Math.sqrt(3.0) / 6.0) * 6.0; // ~ 1.267949 m
      const xInf2 = (0.5 + Math.sqrt(3.0) / 6.0) * 6.0; // ~ 4.732051 m

      expect(result.moment.evaluate(xInf1)).toBeCloseTo(0.0, 6);
      expect(result.moment.evaluate(xInf2)).toBeCloseTo(0.0, 6);

      const cp1 = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - xInf1) < 1e-4
      );
      const cp2 = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - xInf2) < 1e-4
      );
      expect(cp1).toBeDefined();
      expect(cp2).toBeDefined();
    });

    it('T-H3-ANA-04: Flecha máxima en el centro (x_max = 3 m, v_max = wL^4 / (384 EI) = 4.05 mm) y condiciones cinemáticas', () => {
      const result = analyzeBeam(h3Model);
      if (!result.deflection.isImplemented) {
        throw new Error('Deflexión debe estar implementada para H3');
      }

      // v_max = 12 * 6^4 / (384 * 10000) = 0.00405 m = 4.05 mm
      const expectedVmax = (12.0 * 6.0 ** 4) / (384.0 * expectedEI); // 0.00405 m

      expect(result.deflection.maxDownward.x).toBeCloseTo(3.0, 5);
      expect(result.deflection.maxDownward.value).toBeCloseTo(expectedVmax, 7);
      expect(result.deflection.maxDownward.value * 1000.0).toBeCloseTo(4.05, 5);

      // Evaluación en x = 3 m
      expect(result.deflection.evaluate(3.0)).toBeCloseTo(expectedVmax, 7);
      expect(result.deflection.evaluateSlope(3.0)).toBeCloseTo(0.0, 8);

      // Condiciones de frontera en ambos empotramientos: v(0)=0, theta(0)=0, v(6)=0, theta(6)=0
      expect(result.deflection.evaluate(0.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluateSlope(0.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluate(6.0)).toBeCloseTo(0.0, 9);
      expect(result.deflection.evaluateSlope(6.0)).toBeCloseTo(0.0, 9);
    });
  });

  // ===========================================================================
  // BLOQUE 5: CASO H4 (VIGA CONTINUA DE DOS VANOS IGUALES)
  // L_total = 8 m, L_v = 4 m, w = 6 kN/m, EI = 10000 kN*m^2
  // ===========================================================================
  describe('Bloque 5: Caso H4 (Viga continua de dos vanos iguales)', () => {
    it('T-H4-ANA-01: Reacciones exactas por Clapeyron (RA = RC = 9 kN, RB = 30 kN)', () => {
      const result = analyzeBeam(h4Model);

      const rA = result.reactions.find((r) => r.supportId === 'S1');
      expect(rA).toBeDefined();
      expect(rA?.Ry).toBeCloseTo(9.0, 6);

      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rB).toBeDefined();
      expect(rB?.Ry).toBeCloseTo(30.0, 6);

      const rC = result.reactions.find((r) => r.supportId === 'S3');
      expect(rC).toBeDefined();
      expect(rC?.Ry).toBeCloseTo(9.0, 6);

      // Equilibrio vertical: 9 + 30 + 9 = 48 kN = 6 * 8 kN
      expect(result.equilibrium.sumFy).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.sumM).toBeCloseTo(0.0, 7);
      expect(result.equilibrium.isBalanced).toBe(true);
      expect(result.isStaticDeterminate).toBe(false);
    });

    it('T-H4-ANA-02: Esfuerzos internos analíticos (M(0)=0, M(4)=-12 kN*m, M(8)=0, M_max1 = +6.75 kN*m en x = 1.5 m)', () => {
      const result = analyzeBeam(h4Model);

      // Momento en extremos articulados
      expect(result.moment.evaluate(0.0)).toBeCloseTo(0.0, 6);
      expect(result.moment.evaluate(8.0)).toBeCloseTo(0.0, 6);

      // Momento sobre apoyo central x = 4 m: M_B = -12.0 kN*m
      expect(result.moment.evaluate(4.0)).toBeCloseTo(-12.0, 6);

      // Máximo momento positivo vano 1 (x = 1.5 m): +6.75 kN*m
      expect(result.moment.evaluate(1.5)).toBeCloseTo(6.75, 6);

      // Máximo momento positivo vano 2 (x = 6.5 m): +6.75 kN*m
      expect(result.moment.evaluate(6.5)).toBeCloseTo(6.75, 6);

      // Cortantes
      expect(result.shear.evaluate(0.0, 'right')).toBeCloseTo(9.0, 6);
      expect(result.shear.evaluate(4.0, 'left')).toBeCloseTo(-15.0, 6);
      expect(result.shear.evaluate(4.0, 'right')).toBeCloseTo(15.0, 6);
      expect(result.shear.evaluate(8.0, 'left')).toBeCloseTo(-9.0, 6);
    });

    it('T-H4-ANA-03: Puntos de inflexión en ambos vanos (x = 3.0 m en vano 1, x = 5.0 m en vano 2)', () => {
      const result = analyzeBeam(h4Model);

      expect(result.moment.evaluate(3.0)).toBeCloseTo(0.0, 6);
      expect(result.moment.evaluate(5.0)).toBeCloseTo(0.0, 6);

      const cp1 = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - 3.0) < 1e-4
      );
      const cp2 = result.moment.criticalPoints.find(
        (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - 5.0) < 1e-4
      );
      expect(cp1).toBeDefined();
      expect(cp2).toBeDefined();
    });

    it('T-H4-ANA-04: Flecha máxima en el primer vano (x_max = (1+sqrt(33))/4 ~ 1.686141 m, v_max ~ 0.831916 mm) y continuidad', () => {
      const result = analyzeBeam(h4Model);
      if (!result.deflection.isImplemented) {
        throw new Error('Deflexión debe estar implementada para H4');
      }

      // x_max = 4 * ((1 + sqrt(33)) / 16) = (1 + sqrt(33)) / 4 ~ 1.68614066 m
      const expectedXmax = (1.0 + Math.sqrt(33.0)) / 4.0;
      // v_max ~ 0.0008319166 m (0.831916 mm)
      const u = expectedXmax / 4.0;
      const expectedVmax =
        ((6.0 * 4.0 ** 4) / (48.0 * expectedEI)) *
        (2.0 * u ** 4 - 3.0 * u ** 3 + u);

      // Evaluación de la flecha en x_max
      const vAtMax = result.deflection.evaluate(expectedXmax);
      expect(vAtMax).toBeCloseTo(expectedVmax, 7);
      expect(vAtMax * 1000.0).toBeCloseTo(0.831916, 4);

      // Pendiente nula en el punto de flecha máxima
      expect(result.deflection.evaluateSlope(expectedXmax)).toBeCloseTo(0.0, 7);

      // Desplazamientos nulos en los 3 apoyos
      expect(result.deflection.evaluate(0.0)).toBeCloseTo(0.0, 8);
      expect(result.deflection.evaluate(4.0)).toBeCloseTo(0.0, 8);
      expect(result.deflection.evaluate(8.0)).toBeCloseTo(0.0, 8);

      // Continuidad de pendiente en apoyo central x = 4 m (theta = 0 por simetría)
      expect(result.deflection.evaluateSlope(4.0)).toBeCloseTo(0.0, 8);
    });
  });

  // ===========================================================================
  // BLOQUE 6: VARIACIONES PARAMÉTRICAS Y CONTROL DE ERRORES NO SOPORTADOS
  // ===========================================================================
  describe('Bloque 6: Variaciones Paramétricas y Control de Errores', () => {
    it('T-GEN-01: Variación paramétrica H2 (L = 8 m, w = 15 kN/m) confirma que no hay hardcodeo', () => {
      const paramModel: BeamModel = {
        id: 'H2-parametric',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0 },
          { id: 'S2', type: 'roller', x: 8.0 },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 8.0,
            wStart: 15.0,
            wEnd: 15.0,
          },
        ],
        material,
        section,
      };

      const result = analyzeBeam(paramModel);
      // RA = 5wL/8 = 5 * 15 * 8 / 8 = 75 kN
      // RB = 3wL/8 = 3 * 15 * 8 / 8 = 45 kN
      // MA = wL^2/8 = 15 * 64 / 8 = 120 kN*m
      const rA = result.reactions.find((r) => r.supportId === 'S1');
      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rA?.Ry).toBeCloseTo(75.0, 6);
      expect(rA?.Mr).toBeCloseTo(120.0, 6);
      expect(rB?.Ry).toBeCloseTo(45.0, 6);
      expect(result.equilibrium.isBalanced).toBe(true);
    });

    it('T-GEN-02: Variación paramétrica H3 (L = 10 m, w = 20 kN/m) confirma cálculo dinámico', () => {
      const paramModel: BeamModel = {
        id: 'H3-parametric',
        length: 10.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0 },
          { id: 'S2', type: 'fixed', x: 10.0 },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 10.0,
            wStart: 20.0,
            wEnd: 20.0,
          },
        ],
        material,
        section,
      };

      const result = analyzeBeam(paramModel);
      // RA = RB = wL/2 = 20 * 10 / 2 = 100 kN
      // MA = +wL^2/12 = 20 * 100 / 12 = 166.666667 kN*m
      // MB = -wL^2/12 = -166.666667 kN*m
      const rA = result.reactions.find((r) => r.supportId === 'S1');
      const rB = result.reactions.find((r) => r.supportId === 'S2');
      expect(rA?.Ry).toBeCloseTo(100.0, 6);
      expect(rA?.Mr).toBeCloseTo(166.666667, 5);
      expect(rB?.Ry).toBeCloseTo(100.0, 6);
      expect(rB?.Mr).toBeCloseTo(-166.666667, 5);
      expect(result.equilibrium.isBalanced).toBe(true);
    });

    it('T-GEN-03: Rechazo controlado de configuraciones hiperestáticas aún no soportadas (4 apoyos)', () => {
      const unsupportedModel: BeamModel = {
        id: 'unsupported-4-supports',
        length: 12.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0.0 },
          { id: 'S2', type: 'roller', x: 4.0 },
          { id: 'S3', type: 'roller', x: 8.0 },
          { id: 'S4', type: 'roller', x: 12.0 },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 12.0,
            wStart: 10.0,
            wEnd: 10.0,
          },
        ],
        material,
        section,
      };

      expect(() => analyzeBeam(unsupportedModel)).toThrow(/hiperestática/i);
    });

    it('T-GEN-04: Rechazo controlado cuando faltan propiedades elásticas en modelos hiperestáticos', () => {
      const noPropsModel: BeamModel = {
        id: 'H2-no-props',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0 },
          { id: 'S2', type: 'roller', x: 6.0 },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 10.0,
            wEnd: 10.0,
          },
        ],
      };

      expect(() => analyzeBeam(noPropsModel)).toThrow(/hiperestática/i);
    });
  });

  // ===========================================================================
  // BLOQUE 7: REPORTE DIDÁCTICO PASO A PASO (H1–H4)
  // ===========================================================================
  describe('Bloque 7: Reporte Didáctico Paso a Paso (H1–H4)', () => {
    it('T-DID-01: Genera reporte didáctico completo para H1 (Grado 1, voladizo primario, compatibilidad)', () => {
      const result = analyzeBeam(h1Model);
      expect(result.didacticReport).toBeDefined();
      const report = result.didacticReport!;
      expect(report.caseId).toBe('H1');
      expect(report.degreeOfIndeterminacy).toBe(1);
      expect(report.redundantReactions[0]).toContain('RB');
      expect(report.steps.length).toBeGreaterThanOrEqual(7);

      // Paso 1: Identificación
      expect(report.steps[0]?.title).toContain('Grado de Hiperestaticidad');
      expect(report.steps[0]?.result).toContain('RB');

      // Paso 5: Reacción RB
      const rStep = report.steps.find((s) => s.stepNumber === 5);
      expect(rStep?.result).toContain('5.000 kN');

      // Verificación de comprobaciones cinemáticas
      const checkStep = report.steps.find((s) => s.check !== undefined);
      expect(checkStep?.check?.isVerified).toBe(true);
    });

    it('T-DID-02: Genera reporte didáctico para H2 con deducción de flexibilidad y equilibrio', () => {
      const result = analyzeBeam(h2Model);
      expect(result.didacticReport).toBeDefined();
      const report = result.didacticReport!;
      expect(report.caseId).toBe('H2');
      expect(report.degreeOfIndeterminacy).toBe(1);
      expect(report.steps.some((s) => s.title.includes('Flexibilidad'))).toBe(true);
      expect(report.steps.some((s) => s.result.includes('22.500 kN'))).toBe(true);
      expect(report.conclusions.some((c) => c.includes('5wL/8'))).toBe(true);
    });

    it('T-DID-03: Genera reporte didáctico para H3 con momentos de empotramiento biempotrado (Grado 2)', () => {
      const result = analyzeBeam(h3Model);
      expect(result.didacticReport).toBeDefined();
      const report = result.didacticReport!;
      expect(report.caseId).toBe('H3');
      expect(report.degreeOfIndeterminacy).toBe(2);
      expect(report.redundantReactions.length).toBe(2);
      expect(report.steps.some((s) => s.title.includes('Empotramiento Perfecto'))).toBe(true);
      expect(report.steps.some((s) => s.result.includes('36.000 kN·m'))).toBe(true);
      expect(report.conclusions.some((c) => c.includes('wL²/12'))).toBe(true);
    });

    it('T-DID-04: Genera reporte didáctico para H4 con Ecuación de Clapeyron y continuidad en apoyo central', () => {
      const result = analyzeBeam(h4Model);
      expect(result.didacticReport).toBeDefined();
      const report = result.didacticReport!;
      expect(report.caseId).toBe('H4');
      expect(report.degreeOfIndeterminacy).toBe(1);
      expect(report.redundantReactions[0]).toContain('MB');
      expect(report.steps.some((s) => s.title.includes('Clapeyron'))).toBe(true);
      expect(report.steps.some((s) => s.result.includes('-12.000 kN·m'))).toBe(true);
      expect(report.steps.some((s) => s.title.includes('Continuidad'))).toBe(true);
    });
  });

  // ===========================================================================
  // BLOQUE 8: PRUEBAS DE AUDITORÍA FASE 4.1 (LÍMITES EXACTOS, SUPERPOSICIÓN, H3 PUNTUAL Y SIMETRÍA H4)
  // ===========================================================================
  describe('Bloque 8: Pruebas de Auditoría Fase 4.1 (Límites Exactos, Superposición, H3 Puntual y Simetría H4)', () => {
    it('T-AUD-01: H1 evalúa cortante lateral exacto en singularidades sin artefactos de signo', () => {
      const result = analyzeBeam(h1Model);
      const step7 = result.didacticReport?.steps.find((s) => s.stepNumber === 7);
      expect(step7).toBeDefined();

      // Debe contener límites exactos evaluados por la función por tramos:
      // V(2⁻) = +11.000 kN y V(2⁺) = -5.000 kN
      expect(step7?.substitution).toContain('V(2⁻) = +11.000 kN');
      expect(step7?.substitution).toContain('V(2⁺) = -5.000 kN');
      expect(step7?.substitution).toContain('salto ΔV = -16 kN');

      // No debe contener artefactos como '+-'
      expect(step7?.substitution).not.toContain('+-');
      expect(step7?.substitution).not.toContain('-+');

      // Prueba con dos cargas puntuales próximas
      const h1DualModel: BeamModel = {
        ...h1Model,
        id: 'H1-dual-close-loads',
        loads: [
          { id: 'P1', type: 'point', x: 1.5, P: 10.0 },
          { id: 'P2', type: 'point', x: 2.5, P: 12.0 },
        ],
      };
      const dualResult = analyzeBeam(h1DualModel);
      expect(dualResult.equilibrium.isBalanced).toBe(true);
      const dualStep7 = dualResult.didacticReport?.steps.find((s) => s.stepNumber === 7);
      expect(dualStep7?.substitution).toContain('V(1.5⁻)');
      expect(dualStep7?.substitution).toContain('V(1.5⁺)');
      expect(dualStep7?.substitution).toContain('V(2.5⁻)');
      expect(dualStep7?.substitution).toContain('V(2.5⁺)');
      expect(dualStep7?.substitution).not.toContain('+-');
    });

    it('T-AUD-02: H2 distingue carga uniforme completa, carga parcial y cargas combinadas', () => {
      // Caso canónico puro
      const pureResult = analyzeBeam(h2Model);
      expect(pureResult.didacticReport?.caseName).toContain('Carga Uniformemente Distribuida');
      expect(pureResult.didacticReport?.steps.some((s) => s.formulation?.includes('3/8'))).toBe(true);
      expect(pureResult.didacticReport?.steps.some((s) => s.formulation?.includes('5/8'))).toBe(true);

      // Caso carga parcial
      const partialModel: BeamModel = {
        ...h2Model,
        id: 'H2-partial-distributed',
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 3.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const partialResult = analyzeBeam(partialModel);
      expect(partialResult.equilibrium.isBalanced).toBe(true);
      expect(partialResult.didacticReport?.caseName).toContain('Cargas Distribuidas / Combinadas');
      expect(partialResult.didacticReport?.steps.some((s) => s.title.includes('Superposición'))).toBe(true);
      // No debe asegurar que RB = 3wL/8
      expect(partialResult.didacticReport?.conclusions.some((c) => c.includes('3wL/8'))).toBe(false);

      // Caso combinado: distribuida + puntual
      const combinedModel: BeamModel = {
        ...h2Model,
        id: 'H2-combined-loads',
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
          { id: 'P1', type: 'point', x: 3.0, P: 16.0 },
        ],
      };
      const combinedResult = analyzeBeam(combinedModel);
      expect(combinedResult.equilibrium.isBalanced).toBe(true);
      // Total force = 60 + 16 = 76 kN
      const sumRy = combinedResult.reactions.reduce((sum, r) => sum + r.Ry, 0);
      expect(sumRy).toBeCloseTo(76.0, 5);
      expect(combinedResult.didacticReport?.steps.some((s) => s.title.includes('Superposición'))).toBe(true);
      expect(combinedResult.didacticReport?.steps.some((s) => s.substitution?.includes('P = 16'))).toBe(true);
    });

    it('T-AUD-03: H3 genera reportes didácticos analíticos para carga puntual central y excéntrica', () => {
      // H3 con carga puntual central P=20 kN en x=3m (L=6m)
      const h3CentralModel: BeamModel = {
        ...h3Model,
        id: 'H3-point-center',
        loads: [{ id: 'P1', type: 'point', x: 3.0, P: 20.0 }],
      };
      const centralResult = analyzeBeam(h3CentralModel);
      expect(centralResult.equilibrium.isBalanced).toBe(true);
      const rA = centralResult.reactions.find((r) => r.supportId === 'S1');
      const rB = centralResult.reactions.find((r) => r.supportId === 'S2');
      // RA = RB = 10 kN
      expect(rA?.Ry).toBeCloseTo(10.0, 5);
      expect(rB?.Ry).toBeCloseTo(10.0, 5);
      // MA = +PL/8 = +15 kN*m, MB = -PL/8 = -15 kN*m
      expect(rA?.Mr).toBeCloseTo(15.0, 5);
      expect(rB?.Mr).toBeCloseTo(-15.0, 5);

      const centralReport = centralResult.didacticReport!;
      expect(centralReport.caseName).toContain('Carga Puntual Central');
      expect(centralReport.steps.some((s) => s.formulation?.includes('P·L / 8'))).toBe(true);
      expect(centralReport.steps.some((s) => s.result.includes('10.000 kN'))).toBe(true);
      expect(centralReport.steps.some((s) => s.result.includes('15.000 kN·m'))).toBe(true);
      // No debe contener valores en cero ficticios
      expect(centralReport.steps.some((s) => s.result === 'RA = 0.000 kN')).toBe(false);

      // H3 con carga puntual excéntrica P=16 kN en x=2m (a=2m, b=4m, L=6m)
      const h3EccentricModel: BeamModel = {
        ...h3Model,
        id: 'H3-point-eccentric',
        loads: [{ id: 'P1', type: 'point', x: 2.0, P: 16.0 }],
      };
      const eccResult = analyzeBeam(h3EccentricModel);
      expect(eccResult.equilibrium.isBalanced).toBe(true);
      const eccRA = eccResult.reactions.find((r) => r.supportId === 'S1')!;
      const eccRB = eccResult.reactions.find((r) => r.supportId === 'S2')!;
      // RA = 16 * 16 * 10 / 216 = 2560/216 ≈ 11.85185 kN
      expect(eccRA.Ry).toBeCloseTo(2560 / 216, 4);
      // RB = 16 * 4 * 14 / 216 = 896/216 ≈ 4.14815 kN
      expect(eccRB.Ry).toBeCloseTo(896 / 216, 4);
      // MA = +16 * 2 * 16 / 36 = +512/36 ≈ 14.222 kN*m
      expect(eccRA.Mr).toBeCloseTo(512 / 36, 4);
      // MB = -16 * 4 * 4 / 36 = -256/36 ≈ -7.111 kN*m
      expect(eccRB.Mr).toBeCloseTo(-256 / 36, 4);

      const eccReport = eccResult.didacticReport!;
      expect(eccReport.caseName).toContain('Excéntrica');
      expect(eccReport.steps.some((s) => s.formulation?.includes('P·a·b² / L²'))).toBe(true);
      expect(eccReport.steps.some((s) => s.result.includes('11.852 kN'))).toBe(true);
      expect(eccReport.steps.some((s) => s.result.includes('14.222 kN·m'))).toBe(true);
    });

    it('T-AUD-04: H4 comunica explícitamente los dos máximos simétricos de deflexión', () => {
      const result = analyzeBeam(h4Model);
      const report = result.didacticReport!;
      const step5 = report.steps.find((s) => s.stepNumber === 5);
      expect(step5).toBeDefined();

      // Debe explicar ambos vanos con sus abscisas teóricas
      // Vano 1: 4 * (1 + sqrt(33))/16 ≈ 1.6861 m
      // Vano 2: 8 - 1.6861 ≈ 6.3139 m
      expect(step5?.formulation).toContain('Vano 1: x_max1 = Lv · (1 + √33) / 16');
      expect(step5?.formulation).toContain('Vano 2: x_max2 = 2·Lv - x_max1');
      expect(step5?.substitution).toContain('1.6861 m');
      expect(step5?.substitution).toContain('6.3139 m');
      expect(step5?.result).toContain('Dos picos de flecha máxima simétricos');
      expect(step5?.result).toContain('x₁ = 1.686 m');
      expect(step5?.result).toContain('x₂ = 6.314 m');

      // En conclusiones
      const deflConclusion = report.conclusions.find((c) => c.includes('Flechas máximas simétricas'));
      expect(deflConclusion).toBeDefined();
      expect(deflConclusion).toContain('x₁ = 1.686 m (Vano 1) y x₂ = 6.314 m (Vano 2)');
    });
  });
});



