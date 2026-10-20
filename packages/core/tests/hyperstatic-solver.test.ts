import { describe, expect, it } from 'vitest';
import {
  analyzeBeam,
  calculateContinuousBeamReactions,
  calculateFixedFixedReactions,
  calculateFlexuralRigidity,
  calculateProppedCantileverReactions,
  LENGTH_TOLERANCE,
  LOAD_INTENSITY_TOLERANCE,
  SPAN_EQUALITY_TOLERANCE,
  StructuralAnalysisError,
  validateBeamModel,
} from '../src/index.js';
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

    it('T-H3-DIDACTIC-ORDER-01: Invariancia del informe didáctico H3 ante permutación de apoyos ([S2, S1] vs [S1, S2])', () => {
      const normalResult = analyzeBeam(h3Model);
      const reversedH3Model: BeamModel = {
        ...h3Model,
        id: 'H3-reversed-supports',
        supports: [
          { id: 'S2', type: 'fixed', x: 6.0, label: 'B (Empotramiento derecho)' },
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento izquierdo)' },
        ],
      };
      const reversedResult = analyzeBeam(reversedH3Model);

      const repNormal = normalResult.didacticReport!;
      const repReversed = reversedResult.didacticReport!;

      expect(repNormal.caseId).toBe('H3');
      expect(repReversed.caseId).toBe('H3');

      // Paso 1: etiquetas físicas de apoyos A y B con coordenadas correctas
      const step1Normal = repNormal.steps.find((s) => s.stepNumber === 1);
      const step1Reversed = repReversed.steps.find((s) => s.stepNumber === 1);
      expect(step1Normal?.substitution).toContain('Apoyo A (x=0) aporta [RA, MA]');
      expect(step1Reversed?.substitution).toContain('Apoyo A (x=0) aporta [RA, MA]');
      expect(step1Normal?.substitution).toContain('Apoyo B (x=6m) aporta [RB, MB]');
      expect(step1Reversed?.substitution).toContain('Apoyo B (x=6m) aporta [RB, MB]');

      // Paso 3: momentos reactivos de empotramiento perfecto
      const step3Normal = repNormal.steps.find((s) => s.stepNumber === 3);
      const step3Reversed = repReversed.steps.find((s) => s.stepNumber === 3);
      expect(step3Normal?.result).toBe(step3Reversed?.result);
      expect(step3Reversed?.result).toContain('MA = 36.000 kN·m (+CCW)');
      expect(step3Reversed?.result).toContain('MB = -36.000 kN·m (-CW)');

      // Paso 4: reacciones verticales
      const step4Normal = repNormal.steps.find((s) => s.stepNumber === 4);
      const step4Reversed = repReversed.steps.find((s) => s.stepNumber === 4);
      expect(step4Normal?.result).toBe(step4Reversed?.result);
      expect(step4Reversed?.result).toContain('RA = 36.000 kN (↑)');
      expect(step4Reversed?.result).toContain('RB = 36.000 kN (↑)');

      // Conclusiones equivalentes
      expect(repReversed.conclusions).toEqual(repNormal.conclusions);
      expect(repReversed.compatibilityConditions).toEqual(repNormal.compatibilityConditions);
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

      // Paso 2: Estructura primaria con posición del empotramiento
      expect(report.primaryStructure).toContain('x = 0 m');
      const step2 = report.steps.find((s) => s.stepNumber === 2);
      expect(step2?.formulation).toContain('x = 0 m');
      expect(step2?.substitution).toContain('x = 0 m');

      // Paso 4: Deflexión primaria y flexibilidad
      const step4 = report.steps.find((s) => s.stepNumber === 4);
      expect(step4?.substitution).toContain('106.667 / EI');
      expect(step4?.result).toContain('106.667 / EI');
      expect(step4?.result).toContain('21.333 / EI');

      // Paso 5: Reacción RB con sustitución analítica real sin artificios circulares
      const rStep = report.steps.find((s) => s.stepNumber === 5);
      expect(rStep?.result).toContain('5.000 kN');

      // Verifica que la sustitución refleje la ecuación de compatibilidad real:
      // RB = (106.667 / EI) / (21.333 / EI) = 106.667 / 21.333
      expect(rStep?.substitution).toContain('106.667');
      expect(rStep?.substitution).toContain('21.333');
      expect(rStep?.substitution).toContain('106.667 / 21.333');

      // Verificación estricta: NO debe contener el artificio circular f_BB / f_BB ni usar RB como numerador
      expect(rStep?.substitution).not.toContain('f_BB) / f_BB');
      expect(rStep?.substitution).not.toContain('(5.0000 · f_BB)');
      expect(rStep?.substitution).not.toContain('(5.000 · f_BB)');

      // Verificación de comprobaciones cinemáticas
      const checkStep = report.steps.find((s) => s.check !== undefined);
      expect(checkStep?.check?.isVerified).toBe(true);
    });

    it('T-DID-01B: Reporte didáctico H1 con carga excéntrica y dimensiones variables actualiza sustitución de compatibilidad', () => {
      // Viga L = 6 m, empotrada en x = 0, rodillo en x = 6 m, P = 20 kN en x = 2 m (a = 2 m, b = 4 m)
      const eccentricH1Model: BeamModel = {
        ...h1Model,
        id: 'H1-eccentric-point-load',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo)' },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 2.0, P: 20.0, label: 'P = 20 kN' },
        ],
      };

      const result = analyzeBeam(eccentricH1Model);
      expect(result.didacticReport).toBeDefined();
      const report = result.didacticReport!;

      // Teórico:
      // a = 2 m, spanL = 6 m
      // delta_B0 = 20 * 2^2 * (3*6 - 2) / 6 = 20 * 4 * 16 / 6 = 1280 / 6 = 213.333 / EI
      // f_BB = 6^3 / 3 = 72.000 / EI
      // RB = 213.333 / 72.000 = 80 / 27 ≈ 2.96296 kN
      const step4 = report.steps.find((s) => s.stepNumber === 4);
      expect(step4?.substitution).toContain('213.333 / EI');
      expect(step4?.result).toContain('72.000 / EI');

      const step5 = report.steps.find((s) => s.stepNumber === 5);
      expect(step5?.substitution).toContain('213.333');
      expect(step5?.substitution).toContain('72.000');
      expect(step5?.substitution).toContain('213.333 / 72.000');
      expect(step5?.result).toContain('2.963 kN');
      expect(step5?.substitution).not.toContain('f_BB) / f_BB');
    });

    it('T-DID-01C: Reporte didáctico H1 con múltiples cargas puntuales acumula deflexiones primarias en compatibilidad', () => {
      // Viga L = 4 m, empotrada en x = 0, rodillo en x = 4 m
      // P1 = 10 kN en x = 1 m, P2 = 16 kN en x = 2 m
      const multiLoadH1Model: BeamModel = {
        ...h1Model,
        id: 'H1-multi-point-load',
        length: 4.0,
        loads: [
          { id: 'P1', type: 'point', x: 1.0, P: 10.0, label: 'P1' },
          { id: 'P2', type: 'point', x: 2.0, P: 16.0, label: 'P2' },
        ],
      };

      const result = analyzeBeam(multiLoadH1Model);
      const report = result.didacticReport!;

      // delta_1 = 10 * 1^2 * (12 - 1) / 6 = 110 / 6 ≈ 18.333 / EI
      // delta_2 = 16 * 2^2 * (12 - 2) / 6 = 640 / 6 ≈ 106.667 / EI
      // delta_total = 18.333 + 106.667 = 125.000 / EI
      // f_BB = 64 / 3 ≈ 21.333 / EI
      // RB = 125.000 / 21.333 ≈ 5.859 kN
      const step4 = report.steps.find((s) => s.stepNumber === 4);
      expect(step4?.substitution).toContain('18.333 / EI');
      expect(step4?.substitution).toContain('106.667 / EI');
      expect(step4?.substitution).toContain('125.000 / EI');

      const step5 = report.steps.find((s) => s.stepNumber === 5);
      expect(step5?.substitution).toContain('125.000');
      expect(step5?.substitution).toContain('21.333');
      expect(step5?.substitution).toContain('125.000 / 21.333');
      expect(step5?.result).toContain('5.859 kN');
      expect(step5?.substitution).not.toContain('f_BB) / f_BB');
    });

    it('T-DID-01D: Reporte didáctico H1 con empotramiento trasladado describe la posición real del apoyo', () => {
      // Viga con empotramiento en x = 1 m y rodillo en x = 5 m (L = 4 m entre apoyos)
      const offsetH1Model: BeamModel = {
        ...h1Model,
        id: 'H1-offset-support',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 1.0, label: 'Empotramiento x=1' },
          { id: 'S2', type: 'roller', x: 5.0, label: 'Rodillo x=5' },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 3.0, P: 16.0, label: 'P en x=3' },
        ],
      };

      const result = analyzeBeam(offsetH1Model);
      const report = result.didacticReport!;

      // Estructura primaria debe indicar empotrada en x = 1 m
      expect(report.primaryStructure).toContain('x = 1 m');
      const step2 = report.steps.find((s) => s.stepNumber === 2);
      expect(step2?.formulation).toContain('x = 1 m');
      expect(step2?.substitution).toContain('x = 1 m');

      // Brazo a = 3 - 1 = 2 m respecto a sFixed (x=1)
      const step4 = report.steps.find((s) => s.stepNumber === 4);
      expect(step4?.substitution).toContain('a=2 m');
      expect(step4?.substitution).toContain('106.667 / EI');

      const step5 = report.steps.find((s) => s.stepNumber === 5);
      expect(step5?.substitution).toContain('106.667 / 21.333');
      expect(step5?.result).toContain('5.000 kN');
    });

    it('T-DID-01E: Reporte didáctico H1 refleja correctamente signo y dirección de RB (positiva/ascendente, negativa/descendente y nula)', () => {
      // 1. Reacción positiva (carga descendente P = 16 kN)
      const posResult = analyzeBeam(h1Model);
      const posStep5 = posResult.didacticReport?.steps.find((s) => s.stepNumber === 5);
      expect(posStep5?.result).toBe('RB = 5.000 kN (positiva, ascendente ↑)');

      // 2. Reacción negativa (carga ascendente P = -16 kN)
      const negModel: BeamModel = {
        ...h1Model,
        id: 'H1-negative-load',
        loads: [{ id: 'P1', type: 'point', x: 2.0, P: -16.0 }],
      };
      const negResult = analyzeBeam(negModel);
      expect(negResult.equilibrium.isBalanced).toBe(true);
      const negStep5 = negResult.didacticReport?.steps.find((s) => s.stepNumber === 5);
      expect(negStep5?.result).toBe('RB = -5.000 kN (negativa, descendente ↓)');

      // 3. Reacción nula (cargas autoequilibradas P1 = +16 kN, P2 = -16 kN en x = 2 m)
      const zeroModel: BeamModel = {
        ...h1Model,
        id: 'H1-zero-load',
        loads: [
          { id: 'P1', type: 'point', x: 2.0, P: 16.0 },
          { id: 'P2', type: 'point', x: 2.0, P: -16.0 },
        ],
      };
      const zeroResult = analyzeBeam(zeroModel);
      expect(zeroResult.equilibrium.isBalanced).toBe(true);
      const zeroStep5 = zeroResult.didacticReport?.steps.find((s) => s.stepNumber === 5);
      expect(zeroStep5?.result).toBe('RB = 0.000 kN (reacción nula)');
      expect(zeroStep5?.result).not.toContain('ascendente');
      expect(zeroStep5?.result).not.toContain('descendente');
      expect(zeroStep5?.result).not.toContain('↑');
      expect(zeroStep5?.result).not.toContain('↓');

      // 4. Reacción pequeña no nula (x = 0.001 m, RB ≈ 0.0000015 kN):
      // No debe mostrar "0.000 kN" mientras afirma "(positiva, ascendente ↑)",
      // ni debe etiquetarse falsamente como "(reacción nula)".
      const tinyModel: BeamModel = {
        ...h1Model,
        id: 'H1-tiny-reaction',
        loads: [{ id: 'P1', type: 'point', x: 0.001, P: 16.0 }],
      };
      const tinyResult = analyzeBeam(tinyModel);
      const tinyStep5 = tinyResult.didacticReport?.steps.find((s) => s.stepNumber === 5);
      expect(tinyStep5?.result).toBe('RB = 0.0000015 kN (positiva, ascendente ↑)');
      expect(tinyStep5?.result).not.toContain('reacción nula');
      expect(tinyStep5?.result).not.toBe('RB = 0.000 kN (positiva, ascendente ↑)');
    });

    it('T-H1-REJ-01: Rechazo explícito de cargas puntuales en voladizo exterior fuera del tramo entre apoyos en H1', () => {
      // Caso 1: Viga L = 6 m, empotramiento en x = 0 m, rodillo en x = 4 m, carga puntual en voladizo exterior en x = 5 m
      const overhangRightModel: BeamModel = {
        ...h1Model,
        id: 'H1-overhang-right',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 4.0, label: 'B (Rodillo x=4)' },
        ],
        loads: [{ id: 'P1', type: 'point', x: 5.0, P: 16.0, label: 'P en x=5' }],
      };

      const valRight = validateBeamModel(overhangRightModel);
      expect(valRight.isValid).toBe(false);
      expect(valRight.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(overhangRightModel)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(overhangRightModel)).toThrow(
        /voladizo exterior/i
      );

      // Caso 2: Viga L = 7 m, rodillo en x = 2 m, empotramiento en x = 6 m, carga puntual en voladizo exterior en x = 1 m
      const overhangLeftModel: BeamModel = {
        ...h1Model,
        id: 'H1-overhang-left',
        length: 7.0,
        supports: [
          { id: 'S1', type: 'roller', x: 2.0, label: 'B (Rodillo x=2)' },
          { id: 'S2', type: 'fixed', x: 6.0, label: 'A (Empotramiento x=6)' },
        ],
        loads: [{ id: 'P1', type: 'point', x: 1.0, P: 16.0, label: 'P en x=1' }],
      };

      const valLeft = validateBeamModel(overhangLeftModel);
      expect(valLeft.isValid).toBe(false);
      expect(valLeft.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(overhangLeftModel)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(overhangLeftModel)).toThrow(
        /voladizo exterior/i
      );

      // Caso 3: Cargas en las posiciones límite válidas de los apoyos (x = 0 m y x = 4 m) son aceptadas
      const boundaryModel: BeamModel = {
        ...h1Model,
        id: 'H1-boundary-valid',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 4.0, label: 'B (Rodillo x=4)' },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 0.0, P: 10.0 },
          { id: 'P2', type: 'point', x: 4.0, P: 10.0 },
        ],
      };
      const valBoundary = validateBeamModel(boundaryModel);
      expect(valBoundary.isValid).toBe(true);
      const resBoundary = analyzeBeam(boundaryModel);
      expect(resBoundary.equilibrium.isBalanced).toBe(true);
    });

    it('T-H1-BOUND-01: Validez numérica y didáctica de carga puntual exactamente sobre empotramiento y sobre rodillo', () => {
      // 1. Carga puntual exactamente sobre el empotramiento (x = 0, P = 16 kN)
      const loadAtFixedModel: BeamModel = {
        ...h1Model,
        id: 'H1-load-at-fixed',
        loads: [{ id: 'P1', type: 'point', x: 0.0, P: 16.0 }],
      };
      const resFixed = analyzeBeam(loadAtFixedModel);
      expect(resFixed.equilibrium.isBalanced).toBe(true);
      const rFixedAtFixed = resFixed.reactions.find((r) => r.supportId === 'S1')!;
      const rRollerAtFixed = resFixed.reactions.find((r) => r.supportId === 'S2')!;
      // Toda la carga baja directo al empotramiento
      expect(rFixedAtFixed.Ry).toBeCloseTo(16.0, 6);
      expect(rFixedAtFixed.Mr).toBeCloseTo(0.0, 6);
      expect(rRollerAtFixed.Ry).toBeCloseTo(0.0, 6);

      const repFixed = resFixed.didacticReport!;
      const step4Fixed = repFixed.steps.find((s) => s.stepNumber === 4);
      expect(step4Fixed?.result).toContain('0.000 / EI');
      const step5Fixed = repFixed.steps.find((s) => s.stepNumber === 5);
      expect(step5Fixed?.result).toBe('RB = 0.000 kN (reacción nula)');
      const step6Fixed = repFixed.steps.find((s) => s.stepNumber === 6);
      expect(step6Fixed?.result).toContain('RA = 16.000 kN (↑)');
      expect(step6Fixed?.result).toContain('MA = 0.000 kN·m');

      // 2. Carga puntual exactamente sobre el rodillo (x = 4, P = 16 kN)
      const loadAtRollerModel: BeamModel = {
        ...h1Model,
        id: 'H1-load-at-roller',
        loads: [{ id: 'P1', type: 'point', x: 4.0, P: 16.0 }],
      };
      const resRoller = analyzeBeam(loadAtRollerModel);
      expect(resRoller.equilibrium.isBalanced).toBe(true);
      const rFixedAtRoller = resRoller.reactions.find((r) => r.supportId === 'S1')!;
      const rRollerAtRoller = resRoller.reactions.find((r) => r.supportId === 'S2')!;
      // Toda la carga baja directo al rodillo
      expect(rFixedAtRoller.Ry).toBeCloseTo(0.0, 6);
      expect(rFixedAtRoller.Mr).toBeCloseTo(0.0, 6);
      expect(rRollerAtRoller.Ry).toBeCloseTo(16.0, 6);

      const repRoller = resRoller.didacticReport!;
      const step4Roller = repRoller.steps.find((s) => s.stepNumber === 4);
      expect(step4Roller?.result).toContain('341.333 / EI');
      const step5Roller = repRoller.steps.find((s) => s.stepNumber === 5);
      expect(step5Roller?.result).toBe('RB = 16.000 kN (positiva, ascendente ↑)');
      const step6Roller = repRoller.steps.find((s) => s.stepNumber === 6);
      expect(step6Roller?.result).toContain('RA = 0.000 kN (↑)');
      expect(step6Roller?.result).toContain('MA = 0.000 kN·m');
    });

    it('T-H1-TOL-01: Coherencia de tolerancia LENGTH_TOLERANCE entre validador y solver en límites de vano', () => {
      // 1. Carga dentro de LENGTH_TOLERANCE (x = 4 + 1e-12 m <= 4 + 1e-9 m)
      const modelNearUnder: BeamModel = {
        ...h1Model,
        id: 'H1-near-under-tol',
        length: 5.0,
        loads: [{ id: 'P1', type: 'point', x: 4.0 + 1e-12, P: 16.0 }],
      };
      const valUnder = validateBeamModel(modelNearUnder);
      expect(valUnder.isValid).toBe(true);
      const resUnder = analyzeBeam(modelNearUnder);
      expect(resUnder.equilibrium.isBalanced).toBe(true);
      const calcUnder = calculateProppedCantileverReactions(modelNearUnder);
      expect(calcUnder.equilibrium.isBalanced).toBe(true);

      // 2. Carga fuera de LENGTH_TOLERANCE (x = 4 + 1e-8 m > 4 + 1e-9 m)
      const modelNearOver: BeamModel = {
        ...h1Model,
        id: 'H1-near-over-tol',
        length: 5.0,
        loads: [{ id: 'P1', type: 'point', x: 4.0 + 1e-8, P: 16.0 }],
      };
      const valOver = validateBeamModel(modelNearOver);
      expect(valOver.isValid).toBe(false);
      expect(valOver.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(modelNearOver)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(modelNearOver)).toThrow(/voladizo exterior/i);

      // 3. Cargas ligeramente dentro del vano
      const modelInside1: BeamModel = {
        ...h1Model,
        id: 'H1-inside-near-fixed',
        loads: [{ id: 'P1', type: 'point', x: 0.001, P: 16.0 }],
      };
      const resInside1 = analyzeBeam(modelInside1);
      expect(resInside1.equilibrium.isBalanced).toBe(true);
      expect(resInside1.reactions.find((r) => r.supportId === 'S2')?.Ry).toBeCloseTo(0.0000015, 6);

      const modelInside2: BeamModel = {
        ...h1Model,
        id: 'H1-inside-near-roller',
        loads: [{ id: 'P1', type: 'point', x: 3.999, P: 16.0 }],
      };
      const resInside2 = analyzeBeam(modelInside2);
      expect(resInside2.equilibrium.isBalanced).toBe(true);
      expect(resInside2.reactions.find((r) => r.supportId === 'S2')?.Ry).toBeCloseTo(15.994, 3);
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
    });
  });

  // ===========================================================================
  // BLOQUE 9: CORRECCIÓN CONTROLADA H2 (SIMETRÍA, CARGAS DISTRIBUIDAS Y REPORTE DIDÁCTICO)
  // ===========================================================================
  describe('Bloque 9: Corrección Controlada H2 (Simetría, Cargas Distribuidas y Reporte Didáctico)', () => {
    // -------------------------------------------------------------------------
    // 1. Pruebas obligatorias de simetría física y matemática (L = 6 m)
    // -------------------------------------------------------------------------

    it('T-H2-SYM-01: Simetría obligatoria — Carga triangular creciente (0->10) vs reflejada decreciente (10->0)', () => {
      // Caso Directo: Empotramiento en x=0, Rodillo en x=6, Carga triangular creciente w: 0 -> 10 kN/m
      // Derivación analítica:
      // W = 0.5 * 10 * 6 = 30 kN, centroide en x = 4.0 m
      // delta_B0 = (1/6EI) \int_0^6 (10/6 a) a^2 (18 - a) da = 1188 / EI
      // f_BB = 6^3 / (3EI) = 72 / EI
      // RB = 1188 / 72 = 16.5 kN (↑)
      // RA = 30 - 16.5 = 13.5 kN (↑)
      // MA = 30 * 4 - 16.5 * 6 = 120 - 99 = +21.0 kN·m (+CCW)
      const directModel: BeamModel = {
        ...h2Model,
        id: 'H2-sym-triangular-direct',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 0.0,
            wEnd: 10.0,
            label: 'w triangular creciente',
          },
        ],
      };
      const directRes = analyzeBeam(directModel);
      expect(directRes.equilibrium.isBalanced).toBe(true);

      const rFixedDirect = directRes.reactions.find((r) => r.supportId === 'S1')!;
      const rRollerDirect = directRes.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerDirect.Ry).toBeCloseTo(16.5, 4);
      expect(rFixedDirect.Ry).toBeCloseTo(13.5, 4);
      expect(rFixedDirect.Mr).toBeCloseTo(21.0, 4);

      // Caso Reflejado: Rodillo en x=0, Empotramiento en x=6, Carga triangular decreciente w: 10 -> 0 kN/m
      // Por simetría física exacta:
      // R_roller(x=0) = R_roller_direct = 16.5 kN (↑)
      // R_fixed(x=6) = R_fixed_direct = 13.5 kN (↑)
      // M_fixed(x=6) = -M_fixed_direct = -21.0 kN·m (-CW)
      const reflectedModel: BeamModel = {
        ...h2Model,
        id: 'H2-sym-triangular-reflected',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'roller', x: 0.0, label: 'B (Rodillo x=0)' },
          { id: 'S2', type: 'fixed', x: 6.0, label: 'A (Empotramiento x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 10.0,
            wEnd: 0.0,
            label: 'w triangular decreciente',
          },
        ],
      };
      const reflRes = analyzeBeam(reflectedModel);
      expect(reflRes.equilibrium.isBalanced).toBe(true);

      const rRollerRefl = reflRes.reactions.find((r) => r.supportId === 'S1')!;
      const rFixedRefl = reflRes.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerRefl.Ry).toBeCloseTo(16.5, 4);
      expect(rFixedRefl.Ry).toBeCloseTo(13.5, 4);
      expect(rFixedRefl.Mr).toBeCloseTo(-21.0, 4);

      // Comprobación cruzada de simetría física exacta
      expect(rRollerRefl.Ry).toBeCloseTo(rRollerDirect.Ry, 6);
      expect(rFixedRefl.Ry).toBeCloseTo(rFixedDirect.Ry, 6);
      expect(rFixedRefl.Mr!).toBeCloseTo(-rFixedDirect.Mr!, 6);
    });

    it('T-H2-SYM-02: Simetría para carga triangular decreciente en apoyo izquierdo vs creciente en apoyo derecho', () => {
      // Caso Directo 2: Empotramiento en x=0, Rodillo en x=6, Carga triangular decreciente w: 10 -> 0 kN/m
      // Derivación analítica:
      // a es distancia desde empotramiento x=0: w(a) = 10 - 10/6 a
      // \int_0^6 (10 - 10/6 a) a^2 (18 - a) da = 2592
      // delta_B0_num = 2592 / 6 = 432 / EI
      // f_BB_num = 6^3 / 3 = 72 / EI
      // RB = 432 / 72 = 6.0 kN (↑)
      // RA = 30 - 6.0 = 24.0 kN (↑)
      // Centroide en x = 2.0 m: M_cargas = 30 * 2 = 60 kN·m
      // MA = 60 - 6.0 * 6 = 60 - 36 = +24.0 kN·m (+CCW)
      const directModel2: BeamModel = {
        ...h2Model,
        id: 'H2-sym-triangular-decrec-left',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 10.0,
            wEnd: 0.0,
            label: 'w triangular decreciente',
          },
        ],
      };
      const directRes2 = analyzeBeam(directModel2);
      expect(directRes2.equilibrium.isBalanced).toBe(true);

      const rFixedDirect2 = directRes2.reactions.find((r) => r.supportId === 'S1')!;
      const rRollerDirect2 = directRes2.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerDirect2.Ry).toBeCloseTo(6.0, 4);
      expect(rFixedDirect2.Ry).toBeCloseTo(24.0, 4);
      expect(rFixedDirect2.Mr).toBeCloseTo(24.0, 4);

      // Caso Reflejado 2: Rodillo en x=0, Empotramiento en x=6, Carga triangular creciente w: 0 -> 10 kN/m
      // Por simetría física:
      // R_roller(x=0) = 6.0 kN (↑)
      // R_fixed(x=6) = 24.0 kN (↑)
      // M_fixed(x=6) = -24.0 kN·m (-CW)
      const reflectedModel2: BeamModel = {
        ...h2Model,
        id: 'H2-sym-triangular-crec-right',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'roller', x: 0.0, label: 'B (Rodillo x=0)' },
          { id: 'S2', type: 'fixed', x: 6.0, label: 'A (Empotramiento x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 0.0,
            wEnd: 10.0,
            label: 'w triangular creciente',
          },
        ],
      };
      const reflRes2 = analyzeBeam(reflectedModel2);
      expect(reflRes2.equilibrium.isBalanced).toBe(true);

      const rRollerRefl2 = reflRes2.reactions.find((r) => r.supportId === 'S1')!;
      const rFixedRefl2 = reflRes2.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerRefl2.Ry).toBeCloseTo(6.0, 4);
      expect(rFixedRefl2.Ry).toBeCloseTo(24.0, 4);
      expect(rFixedRefl2.Mr).toBeCloseTo(-24.0, 4);

      expect(rRollerRefl2.Ry).toBeCloseTo(rRollerDirect2.Ry, 6);
      expect(rFixedRefl2.Ry).toBeCloseTo(rFixedDirect2.Ry, 6);
      expect(rFixedRefl2.Mr!).toBeCloseTo(-rFixedDirect2.Mr!, 6);
    });

    it('T-H2-SYM-03: Simetría para carga trapezoidal creciente (4->10) y decreciente (10->4)', () => {
      // Caso Directo: Empotramiento en x=0, Rodillo en x=6, w: 4 -> 10 kN/m
      // Superposición analítica:
      // Uniforme 4 kN/m: R_roller = 3/8*4*6 = 9.0 kN, R_fixed = 15.0 kN, M_fixed = +18.0 kN·m
      // Triangular 0->6 kN/m: R_roller = (16.5/30)*18 = 9.9 kN, R_fixed = 8.1 kN, M_fixed = +12.6 kN·m
      // Total: R_roller = 18.9 kN (↑), R_fixed = 23.1 kN (↑), M_fixed = +30.6 kN·m (+CCW)
      const trapDirectModel: BeamModel = {
        ...h2Model,
        id: 'H2-sym-trapezoidal-direct',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 4.0,
            wEnd: 10.0,
            label: 'w trapezoidal 4->10',
          },
        ],
      };
      const trapDirectRes = analyzeBeam(trapDirectModel);
      expect(trapDirectRes.equilibrium.isBalanced).toBe(true);

      const rFixedTrap = trapDirectRes.reactions.find((r) => r.supportId === 'S1')!;
      const rRollerTrap = trapDirectRes.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerTrap.Ry).toBeCloseTo(18.9, 4);
      expect(rFixedTrap.Ry).toBeCloseTo(23.1, 4);
      expect(rFixedTrap.Mr).toBeCloseTo(30.6, 4);

      // Caso Reflejado: Rodillo en x=0, Empotramiento en x=6, w: 10 -> 4 kN/m
      // Por simetría física:
      // R_roller(x=0) = 18.9 kN (↑)
      // R_fixed(x=6) = 23.1 kN (↑)
      // M_fixed(x=6) = -30.6 kN·m (-CW)
      const trapReflModel: BeamModel = {
        ...h2Model,
        id: 'H2-sym-trapezoidal-reflected',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'roller', x: 0.0, label: 'B (Rodillo x=0)' },
          { id: 'S2', type: 'fixed', x: 6.0, label: 'A (Empotramiento x=6)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0.0,
            xEnd: 6.0,
            wStart: 10.0,
            wEnd: 4.0,
            label: 'w trapezoidal 10->4',
          },
        ],
      };
      const trapReflRes = analyzeBeam(trapReflModel);
      expect(trapReflRes.equilibrium.isBalanced).toBe(true);

      const rRollerTrapRefl = trapReflRes.reactions.find((r) => r.supportId === 'S1')!;
      const rFixedTrapRefl = trapReflRes.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRollerTrapRefl.Ry).toBeCloseTo(18.9, 4);
      expect(rFixedTrapRefl.Ry).toBeCloseTo(23.1, 4);
      expect(rFixedTrapRefl.Mr).toBeCloseTo(-30.6, 4);

      expect(rRollerTrapRefl.Ry).toBeCloseTo(rRollerTrap.Ry, 6);
      expect(rFixedTrapRefl.Ry).toBeCloseTo(rFixedTrap.Ry, 6);
      expect(rFixedTrapRefl.Mr!).toBeCloseTo(-rFixedTrap.Mr!, 6);
    });

    it('T-H2-SYM-04: Carga uniforme de control con empotramiento a la izquierda y a la derecha', () => {
      // 1. Empotramiento a la izquierda (x=0 fixed, x=6 roller)
      const unifLeftModel: BeamModel = {
        ...h2Model,
        id: 'H2-control-uniform-left',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A (Empotramiento x=0)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Rodillo x=6)' },
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
      const resLeft = analyzeBeam(unifLeftModel);
      expect(resLeft.equilibrium.isBalanced).toBe(true);
      const rLeftFixed = resLeft.reactions.find((r) => r.supportId === 'S1')!;
      const rLeftRoller = resLeft.reactions.find((r) => r.supportId === 'S2')!;
      expect(rLeftRoller.Ry).toBeCloseTo(22.5, 4); // 3wL/8
      expect(rLeftFixed.Ry).toBeCloseTo(37.5, 4);  // 5wL/8
      expect(rLeftFixed.Mr).toBeCloseTo(45.0, 4);  // +wL^2/8 (+CCW)

      // 2. Empotramiento a la derecha (x=0 roller, x=6 fixed)
      const unifRightModel: BeamModel = {
        ...h2Model,
        id: 'H2-control-uniform-right',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'roller', x: 0.0, label: 'B (Rodillo x=0)' },
          { id: 'S2', type: 'fixed', x: 6.0, label: 'A (Empotramiento x=6)' },
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
      const resRight = analyzeBeam(unifRightModel);
      expect(resRight.equilibrium.isBalanced).toBe(true);
      const rRightRoller = resRight.reactions.find((r) => r.supportId === 'S1')!;
      const rRightFixed = resRight.reactions.find((r) => r.supportId === 'S2')!;
      expect(rRightRoller.Ry).toBeCloseTo(22.5, 4); // 3wL/8
      expect(rRightFixed.Ry).toBeCloseTo(37.5, 4);  // 5wL/8
      expect(rRightFixed.Mr).toBeCloseTo(-45.0, 4); // -wL^2/8 (-CW)

      expect(rRightRoller.Ry).toBeCloseTo(rLeftRoller.Ry, 6);
      expect(rRightFixed.Ry).toBeCloseTo(rLeftFixed.Ry, 6);
      expect(rRightFixed.Mr!).toBeCloseTo(-rLeftFixed.Mr!, 6);
    });

    // -------------------------------------------------------------------------
    // 2. Rechazo explícito de cargas distribuidas que exceden el tramo soportado
    // -------------------------------------------------------------------------

    it('T-H2-REJ-01: Rechazo explícito de cargas distribuidas en voladizo exterior fuera del tramo soportado', () => {
      // Caso 1: Carga distribuida que excede el extremo derecho del vano soportado
      // Viga L = 8 m, apoyos en x = 0 m (fixed) y x = 5 m (roller). Carga de 0 a 7 m.
      const modelExceedRight: BeamModel = {
        ...h2Model,
        id: 'H2-rej-exceed-right',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 5.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 7.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valRight = validateBeamModel(modelExceedRight);
      expect(valRight.isValid).toBe(false);
      expect(valRight.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(modelExceedRight)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(modelExceedRight)).toThrow(
        /voladizo exterior/i
      );

      // Caso 2: Carga distribuida que excede el extremo izquierdo del vano soportado
      // Viga L = 8 m, apoyos en x = 2 m (roller) y x = 8 m (fixed). Carga de 1 a 6 m.
      const modelExceedLeft: BeamModel = {
        ...h2Model,
        id: 'H2-rej-exceed-left',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'roller', x: 2.0, label: 'B' },
          { id: 'S2', type: 'fixed', x: 8.0, label: 'A' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 1.0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valLeft = validateBeamModel(modelExceedLeft);
      expect(valLeft.isValid).toBe(false);
      expect(valLeft.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(modelExceedLeft)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(modelExceedLeft)).toThrow(
        /voladizo exterior/i
      );

      // Caso 3: Carga distribuida totalmente exterior al tramo soportado
      // Viga L = 8 m, apoyos en x = 0 m y x = 4 m. Carga de 5 a 7 m.
      const modelTotallyOutside: BeamModel = {
        ...h2Model,
        id: 'H2-rej-totally-outside',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 4.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 5.0, xEnd: 7.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valOutside = validateBeamModel(modelTotallyOutside);
      expect(valOutside.isValid).toBe(false);
      expect(valOutside.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(modelTotallyOutside)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(modelTotallyOutside)).toThrow(
        /voladizo exterior/i
      );

      // Caso 4: Carga distribuida que cubre un tramo exterior y parte del interior
      // Viga L = 8 m, apoyos en x = 2 m y x = 7 m. Carga de 1 a 4 m.
      const modelCoverExteriorInterior: BeamModel = {
        ...h2Model,
        id: 'H2-rej-ext-int',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 2.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 7.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 1.0, xEnd: 4.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valExtInt = validateBeamModel(modelCoverExteriorInterior);
      expect(valExtInt.isValid).toBe(false);
      expect(valExtInt.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      expect(() => analyzeBeam(modelCoverExteriorInterior)).toThrow(StructuralAnalysisError);
      expect(() => calculateProppedCantileverReactions(modelCoverExteriorInterior)).toThrow(
        /voladizo exterior/i
      );

      // Caso 5: Carga distribuida exactamente en los límites de los apoyos (válida)
      // Viga L = 8 m, apoyos en x = 2 m y x = 6 m. Carga exactamente de 2 a 6 m.
      const modelExactLimits: BeamModel = {
        ...h2Model,
        id: 'H2-val-exact-limits',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 2.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 2.0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valExact = validateBeamModel(modelExactLimits);
      expect(valExact.isValid).toBe(true);
      const resExact = analyzeBeam(modelExactLimits);
      expect(resExact.equilibrium.isBalanced).toBe(true);

      // Caso 6: Carga distribuida parcial y contenida estrictamente dentro del vano (válida)
      // Viga L = 8 m, apoyos en x = 1 m y x = 7 m. Carga parcial de 2 a 5 m.
      const modelPartialInside: BeamModel = {
        ...h2Model,
        id: 'H2-val-partial-inside',
        length: 8.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 1.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 7.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 2.0, xEnd: 5.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const valPartial = validateBeamModel(modelPartialInside);
      expect(valPartial.isValid).toBe(true);
      const resPartial = analyzeBeam(modelPartialInside);
      expect(resPartial.equilibrium.isBalanced).toBe(true);
    });

    // -------------------------------------------------------------------------
    // 3. Verificación de no circularidad y exactitud didáctica en H2
    // -------------------------------------------------------------------------

    it('T-H2-DID-01: Reporte didáctico H2 sin tautología circular y con deducción analítica de deflexión primaria', () => {
      // Viga L = 6 m, empotramiento en x=0, rodillo en x=6, carga parcial w = 10 kN/m en [0, 3] m
      // Solución analítica de referencia:
      // a \in [0, 3], w(a) = 10
      // \int_0^3 10 a^2 (18 - a) da = 1417.5
      // delta_B0_num = 1417.5 / 6 = 236.250 kN·m³
      // f_BB_num = 6^3 / 3 = 72.000 m/kN
      // RB = 236.250 / 72.000 = 3.28125 kN
      const partialModel: BeamModel = {
        ...h2Model,
        id: 'H2-didactic-partial-noncircular',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 0.0, label: 'A' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 3.0, wStart: 10.0, wEnd: 10.0 },
        ],
      };
      const res = analyzeBeam(partialModel);
      expect(res.equilibrium.isBalanced).toBe(true);

      const report = res.didacticReport!;
      expect(report).toBeDefined();

      const step3 = report.steps.find((s) => s.stepNumber === 3);
      expect(step3).toBeDefined();

      // 1. No debe contener sustitución circular tautológica tipo RB * f_BB
      expect(step3?.substitution).not.toContain('· f_BB) / EI');
      expect(step3?.substitution).not.toContain('3.2813 · f_BB');

      // 2. Debe mostrar límites de integración explícitos del tramo [0.000, 3.000]
      expect(step3?.substitution).toContain('0.000');
      expect(step3?.substitution).toContain('3.000');

      // 3. Debe mostrar el valor de deflexión primaria calculado independientemente de las cargas
      expect(step3?.substitution).toContain('236.250 / EI');
      expect(step3?.substitution).toContain('72.000 / EI');
      expect(step3?.substitution).toContain('RB = δ_B0 / f_BB');
      expect(step3?.result).toContain('3.281 kN');

      // 4. Caso combinado: carga distribuida + puntual
      const combModel: BeamModel = {
        ...h2Model,
        id: 'H2-didactic-combined-noncircular',
        length: 6.0,
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
          { id: 'P1', type: 'point', x: 3.0, P: 16.0 },
        ],
      };
      const combRes = analyzeBeam(combModel);
      const combStep3 = combRes.didacticReport?.steps.find((s) => s.stepNumber === 3);
      expect(combStep3).toBeDefined();
      expect(combStep3?.substitution).not.toContain('· f_BB) / EI');
      // Debe contener la contribución de la puntual P=16 y de la distribuida w=10
      expect(combStep3?.substitution).toContain('Carga puntual P = 16 kN');
      expect(combStep3?.substitution).toContain('Carga distribuida [0, 6] m');
      expect(combStep3?.substitution).toContain('δ_B0 = Σ δ_i =');
    });

    // -------------------------------------------------------------------------
    // 4. Caso con geometría trasladada respecto al origen (origen arbitrario x != 0)
    // -------------------------------------------------------------------------

    it('T-H2-TRANS-01: Viga con apoyos trasladados respecto al origen (x != 0)', () => {
      // Viga de longitud total 10 m
      // Apoyo empotrado en x = 2.0 m, apoyo simple en x = 8.0 m (vano L = 6.0 m)
      // Carga distribuida uniforme de 10 kN/m entre x = 2.0 m y x = 8.0 m
      // Reacciones teóricas exactas:
      // R_roller(x=8) = 3wL/8 = 3 * 10 * 6 / 8 = 22.5 kN (↑)
      // R_fixed(x=2) = 5wL/8 = 5 * 10 * 6 / 8 = 37.5 kN (↑)
      // M_fixed(x=2) = +wL^2/8 = +10 * 36 / 8 = +45.0 kN·m (+CCW)
      const shiftedModel: BeamModel = {
        ...h2Model,
        id: 'H2-shifted-origin',
        length: 10.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 2.0, label: 'A (Empotramiento x=2)' },
          { id: 'S2', type: 'roller', x: 8.0, label: 'B (Rodillo x=8)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 2.0,
            xEnd: 8.0,
            wStart: 10.0,
            wEnd: 10.0,
            label: 'w en vano soportado',
          },
        ],
      };

      const val = validateBeamModel(shiftedModel);
      expect(val.isValid).toBe(true);

      const res = analyzeBeam(shiftedModel);
      expect(res.equilibrium.isBalanced).toBe(true);

      const rFixed = res.reactions.find((r) => r.supportId === 'S1')!;
      const rRoller = res.reactions.find((r) => r.supportId === 'S2')!;

      expect(rRoller.Ry).toBeCloseTo(22.5, 4);
      expect(rFixed.Ry).toBeCloseTo(37.5, 4);
      expect(rFixed.Mr).toBeCloseTo(45.0, 4);

      // Comprobación didáctica de que las coordenadas reflejan x=2 y x=8
      const rep = res.didacticReport!;
      expect(rep.primaryStructure).toContain('x = 2 m');
      expect(rep.compatibilityConditions[0]).toContain('x = 8 m');
    });

    // =========================================================================
    // BLOQUE 10: VALIDACIÓN Y CONTROL DE LÍMITES PARA CASO H3 (VIGA BIEMPOTRADA)
    // =========================================================================
    describe('Bloque 10: Validación y Control de Límites para Caso H3 (Viga Biempotrada)', () => {
      // 1. Rechazo explícito de cargas en voladizo exterior fuera del tramo entre empotramientos
      it('T-H3-REJ-01: Rechazo explícito de cargas fuera del tramo entre empotramientos en H3', () => {
        // Viga L = 8 m, empotramientos en x = 2 m y x = 6 m (vano soportado [2, 6])
        const baseH3: BeamModel = {
          ...h3Model,
          id: 'H3-base-rej',
          length: 8.0,
          supports: [
            { id: 'S1', type: 'fixed', x: 2.0, label: 'A (Empotramiento x=2)' },
            { id: 'S2', type: 'fixed', x: 6.0, label: 'B (Empotramiento x=6)' },
          ],
          loads: [],
        };

        // Caso 1: Carga puntual exterior a la derecha (x = 7 m)
        const modelPtRight: BeamModel = {
          ...baseH3,
          id: 'H3-rej-pt-right',
          loads: [{ id: 'P1', type: 'point', x: 7.0, P: 20.0 }],
        };
        const valPtRight = validateBeamModel(modelPtRight);
        expect(valPtRight.isValid).toBe(false);
        expect(valPtRight.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelPtRight)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelPtRight)).toThrow(/voladizo exterior/i);

        // Caso 2: Carga puntual exterior a la izquierda (x = 1 m)
        const modelPtLeft: BeamModel = {
          ...baseH3,
          id: 'H3-rej-pt-left',
          loads: [{ id: 'P1', type: 'point', x: 1.0, P: 20.0 }],
        };
        const valPtLeft = validateBeamModel(modelPtLeft);
        expect(valPtLeft.isValid).toBe(false);
        expect(valPtLeft.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelPtLeft)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelPtLeft)).toThrow(/voladizo exterior/i);

        // Caso 3: Carga distribuida cuyo inicio queda fuera a la izquierda (xStart = 1, xEnd = 4)
        const modelDistLeft: BeamModel = {
          ...baseH3,
          id: 'H3-rej-dist-left',
          loads: [{ id: 'W1', type: 'distributed', xStart: 1.0, xEnd: 4.0, wStart: 10.0, wEnd: 10.0 }],
        };
        const valDistLeft = validateBeamModel(modelDistLeft);
        expect(valDistLeft.isValid).toBe(false);
        expect(valDistLeft.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelDistLeft)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelDistLeft)).toThrow(/voladizo exterior/i);

        // Caso 4: Carga distribuida cuyo final queda fuera a la derecha (xStart = 4, xEnd = 7)
        const modelDistRight: BeamModel = {
          ...baseH3,
          id: 'H3-rej-dist-right',
          loads: [{ id: 'W1', type: 'distributed', xStart: 4.0, xEnd: 7.0, wStart: 10.0, wEnd: 10.0 }],
        };
        const valDistRight = validateBeamModel(modelDistRight);
        expect(valDistRight.isValid).toBe(false);
        expect(valDistRight.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelDistRight)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelDistRight)).toThrow(/voladizo exterior/i);

        // Caso 5: Carga distribuida que excede ambos extremos (xStart = 1, xEnd = 7)
        const modelDistBoth: BeamModel = {
          ...baseH3,
          id: 'H3-rej-dist-both',
          loads: [{ id: 'W1', type: 'distributed', xStart: 1.0, xEnd: 7.0, wStart: 10.0, wEnd: 10.0 }],
        };
        const valDistBoth = validateBeamModel(modelDistBoth);
        expect(valDistBoth.isValid).toBe(false);
        expect(valDistBoth.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelDistBoth)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelDistBoth)).toThrow(/voladizo exterior/i);

        // Caso 6: Carga distribuida totalmente en el voladizo exterior (xStart = 6.5, xEnd = 8.0)
        const modelDistTotExt: BeamModel = {
          ...baseH3,
          id: 'H3-rej-dist-tot-ext',
          loads: [{ id: 'W1', type: 'distributed', xStart: 6.5, xEnd: 8.0, wStart: 10.0, wEnd: 10.0 }],
        };
        const valDistTotExt = validateBeamModel(modelDistTotExt);
        expect(valDistTotExt.isValid).toBe(false);
        expect(valDistTotExt.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
        expect(() => analyzeBeam(modelDistTotExt)).toThrow(StructuralAnalysisError);
        expect(() => calculateFixedFixedReactions(modelDistTotExt)).toThrow(/voladizo exterior/i);
      });

      // 2. Cargas situadas exactamente en los extremos permitidos y tolerancia geométrica
      it('T-H3-BOUND-01: Validez numérica y didáctica de cargas en los límites de los empotramientos', () => {
        // Viga L = 6 m, empotramientos en x = 0 y x = 6
        // Carga puntual en x = 0: se absorbe íntegramente por S1 sin generar flexión en el vano
        const modelAtS1: BeamModel = {
          ...h3Model,
          id: 'H3-pt-at-S1',
          loads: [{ id: 'P1', type: 'point', x: 0.0, P: 20.0 }],
        };
        const resS1 = analyzeBeam(modelAtS1);
        expect(resS1.equilibrium.isBalanced).toBe(true);
        const rS1_A = resS1.reactions.find((r) => r.supportId === 'S1')!;
        const rS1_B = resS1.reactions.find((r) => r.supportId === 'S2')!;
        expect(rS1_A.Ry).toBeCloseTo(20.0, 5);
        expect(rS1_A.Mr).toBeCloseTo(0.0, 5);
        expect(rS1_B.Ry).toBeCloseTo(0.0, 5);
        expect(rS1_B.Mr).toBeCloseTo(0.0, 5);

        // Carga puntual en x = 6: se absorbe íntegramente por S2 sin generar flexión en el vano
        const modelAtS2: BeamModel = {
          ...h3Model,
          id: 'H3-pt-at-S2',
          loads: [{ id: 'P1', type: 'point', x: 6.0, P: 20.0 }],
        };
        const resS2 = analyzeBeam(modelAtS2);
        expect(resS2.equilibrium.isBalanced).toBe(true);
        const rS2_A = resS2.reactions.find((r) => r.supportId === 'S1')!;
        const rS2_B = resS2.reactions.find((r) => r.supportId === 'S2')!;
        expect(rS2_A.Ry).toBeCloseTo(0.0, 5);
        expect(rS2_A.Mr).toBeCloseTo(0.0, 5);
        expect(rS2_B.Ry).toBeCloseTo(20.0, 5);
        expect(rS2_B.Mr).toBeCloseTo(0.0, 5);

        // Coherencia con LENGTH_TOLERANCE (1e-4 m):
        // Viga con longitud L = 8.0 m y apoyos en x = 0 y x = 6 m
        // Carga dentro de tolerancia (x = 6.0 + 0.5 * LENGTH_TOLERANCE) debe ser admitida
        const modelWithinTol: BeamModel = {
          ...h3Model,
          id: 'H3-pt-within-tol',
          length: 8.0,
          loads: [{ id: 'P1', type: 'point', x: 6.0 + 0.5 * LENGTH_TOLERANCE, P: 20.0 }],
        };
        const valWithin = validateBeamModel(modelWithinTol);
        expect(valWithin.isValid).toBe(true);
        const resWithin = analyzeBeam(modelWithinTol);
        expect(resWithin.equilibrium.isBalanced).toBe(true);

        // Carga fuera de tolerancia (x = 6.0 + 2.0 * LENGTH_TOLERANCE) debe ser rechazada
        const modelOutsideTol: BeamModel = {
          ...h3Model,
          id: 'H3-pt-outside-tol',
          length: 8.0,
          loads: [{ id: 'P1', type: 'point', x: 6.0 + 2.0 * LENGTH_TOLERANCE, P: 20.0 }],
        };
        const valOutside = validateBeamModel(modelOutsideTol);
        expect(valOutside.isValid).toBe(false);
        expect(valOutside.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      });

      // 3. Apoyos trasladados respecto al origen con carga contenida estrictamente en el vano
      it('T-H3-TRANS-01: Viga biempotrada con apoyos trasladados respecto al origen (x != 0)', () => {
        // Viga L_total = 10 m, empotramientos en x = 2 m y x = 8 m (vano L = 6 m)
        // Carga distribuida uniforme w = 12 kN/m en [2, 8] m
        const shiftedH3: BeamModel = {
          ...h3Model,
          id: 'H3-shifted-origin',
          length: 10.0,
          supports: [
            { id: 'S1', type: 'fixed', x: 2.0, label: 'A (Empotramiento x=2)' },
            { id: 'S2', type: 'fixed', x: 8.0, label: 'B (Empotramiento x=8)' },
          ],
          loads: [
            { id: 'W1', type: 'distributed', xStart: 2.0, xEnd: 8.0, wStart: 12.0, wEnd: 12.0 },
          ],
        };

        const valShifted = validateBeamModel(shiftedH3);
        expect(valShifted.isValid).toBe(true);

        const resShifted = analyzeBeam(shiftedH3);
        expect(resShifted.equilibrium.isBalanced).toBe(true);

        const rA = resShifted.reactions.find((r) => r.supportId === 'S1')!;
        const rB = resShifted.reactions.find((r) => r.supportId === 'S2')!;

        // Teórico para L = 6 m, w = 12 kN/m:
        // RA = RB = wL/2 = 36 kN
        // MA = +wL^2/12 = +36 kN*m, MB = -wL^2/12 = -36 kN*m
        expect(rA.Ry).toBeCloseTo(36.0, 5);
        expect(rB.Ry).toBeCloseTo(36.0, 5);
        expect(rA.Mr).toBeCloseTo(36.0, 5);
        expect(rB.Mr).toBeCloseTo(-36.0, 5);

        // Condiciones cinemáticas de frontera en x = 2 y x = 8
        if (!resShifted.deflection.isImplemented) {
          throw new Error('El análisis de deflexiones debe estar implementado para H3');
        }
        expect(resShifted.deflection.evaluate(2.0)).toBeCloseTo(0.0, 8);
        expect(resShifted.deflection.evaluateSlope(2.0)).toBeCloseTo(0.0, 8);
        expect(resShifted.deflection.evaluate(8.0)).toBeCloseTo(0.0, 8);
        expect(resShifted.deflection.evaluateSlope(8.0)).toBeCloseTo(0.0, 8);
      });
    });

    // =========================================================================
    // BLOQUE 11: CORRECCIÓN CONTROLADA H4 (GEOMETRÍA, TRASLACIÓN, ORDEN Y ROBUSTEZ)
    // =========================================================================
    describe('Bloque 11: Corrección Controlada H4 (Geometría, Traslación, Orden y Robustez)', () => {
      // Modelo canónico independiente de referencia para H4:
      // L_total = 12 m, apoyos en x = 0, 6, 12 m (Lv = 6 m)
      // Carga distribuida uniforme w = 10 kN/m en [0, 12] m, EI = 10000 kN*m^2
      const canonicalH4: BeamModel = {
        id: 'H4-canonical-audit-case',
        length: 12.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0.0, label: 'A (Pin x=0)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Roller x=6)' },
          { id: 'S3', type: 'roller', x: 12.0, label: 'C (Roller x=12)' },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 12.0, wStart: 10.0, wEnd: 10.0 },
        ],
        material,
        section,
      };

      // 1. Caso canónico validado contra oráculo analítico independiente
      it('T-H4-VAL-01: Caso canónico validado contra oráculo analítico independiente (Lv = 6 m, w = 10 kN/m)', () => {
        const val = validateBeamModel(canonicalH4);
        expect(val.isValid).toBe(true);

        const res = analyzeBeam(canonicalH4);
        expect(res.equilibrium.isBalanced).toBe(true);
        expect(res.equilibrium.sumFy).toBeCloseTo(0.0, 7);
        expect(res.equilibrium.sumM).toBeCloseTo(0.0, 7);

        // Reacciones teóricas exactas:
        // RA = RC = 3wLv/8 = 22.5 kN
        // RB = 5wLv/4 = 75.0 kN
        const rA = res.reactions.find((r) => r.supportId === 'S1')!;
        const rB = res.reactions.find((r) => r.supportId === 'S2')!;
        const rC = res.reactions.find((r) => r.supportId === 'S3')!;
        expect(rA.Ry).toBeCloseTo(22.5, 6);
        expect(rB.Ry).toBeCloseTo(75.0, 6);
        expect(rC.Ry).toBeCloseTo(22.5, 6);

        // Momentos teóricos:
        // MB = -wLv^2/8 = -45.0 kN*m
        // MA = MC = 0
        // M_max1 = +9wLv^2/128 = +25.3125 kN*m en x = 2.25 m
        // M_max2 = +25.3125 kN*m en x = 9.75 m
        expect(res.moment.evaluate(0.0)).toBeCloseTo(0.0, 6);
        expect(res.moment.evaluate(12.0)).toBeCloseTo(0.0, 6);
        expect(res.moment.evaluate(6.0, 'left')).toBeCloseTo(-45.0, 6);
        expect(res.moment.evaluate(6.0, 'right')).toBeCloseTo(-45.0, 6);
        expect(res.moment.evaluate(2.25)).toBeCloseTo(25.3125, 6);
        expect(res.moment.evaluate(9.75)).toBeCloseTo(25.3125, 6);

        // Puntos de inflexión en x = 4.5 m y x = 7.5 m
        expect(res.moment.evaluate(4.5)).toBeCloseTo(0.0, 6);
        expect(res.moment.evaluate(7.5)).toBeCloseTo(0.0, 6);

        // Cortantes analíticos:
        // V(0+) = +22.5 kN, V(6-) = -37.5 kN, V(6+) = +37.5 kN, V(12-) = -22.5 kN
        expect(res.shear.evaluate(0.0, 'right')).toBeCloseTo(22.5, 6);
        expect(res.shear.evaluate(6.0, 'left')).toBeCloseTo(-37.5, 6);
        expect(res.shear.evaluate(6.0, 'right')).toBeCloseTo(37.5, 6);
        expect(res.shear.evaluate(12.0, 'left')).toBeCloseTo(-22.5, 6);

        // Deflexión teórica:
        // v_max = ((39 + 55*sqrt(33))/65536) * (w*Lv^4/EI) ≈ 0.00701929 m = 7.0193 mm
        // x_max1 = 6 * (1 + sqrt(33))/16 ≈ 2.529211 m
        if (!res.deflection.isImplemented) {
          throw new Error('La deflexión debe estar implementada para H4');
        }
        const expectedVmax =
          ((10.0 * 6.0 ** 4) / (48.0 * expectedEI)) *
          (2.0 * ((1 + Math.sqrt(33)) / 16) ** 4 -
            3.0 * ((1 + Math.sqrt(33)) / 16) ** 3 +
            (1 + Math.sqrt(33)) / 16);
        expect(res.deflection.maxDownward.value).toBeCloseTo(expectedVmax, 7);
        expect(res.deflection.maxDownward.value * 1000.0).toBeCloseTo(7.0193, 3);
        expect(res.deflection.maxDownward.x).toBeCloseTo(2.529211, 4);

        // Condiciones cinemáticas de frontera en apoyos: v(0)=0, v(6)=0, v(12)=0, theta(6)=0
        expect(res.deflection.evaluate(0.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluate(6.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluate(12.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluateSlope(6.0)).toBeCloseTo(0.0, 8);
      });

      // 2. Viga continua trasladada respecto al origen
      it('T-H4-TRANS-01: Viga continua H4 trasladada respecto al origen (apoyos en x = 2, 8, 14 m)', () => {
        // L_total = 16 m, apoyos en x = 2, 8, 14 m (Lv = 6 m)
        // Carga w = 10 kN/m en [2, 14] m
        const shiftedH4: BeamModel = {
          id: 'H4-shifted-origin',
          length: 16.0,
          supports: [
            { id: 'S1', type: 'pin', x: 2.0, label: 'A (Pin x=2)' },
            { id: 'S2', type: 'roller', x: 8.0, label: 'B (Roller x=8)' },
            { id: 'S3', type: 'roller', x: 14.0, label: 'C (Roller x=14)' },
          ],
          loads: [
            { id: 'W1', type: 'distributed', xStart: 2.0, xEnd: 14.0, wStart: 10.0, wEnd: 10.0 },
          ],
          material,
          section,
        };

        const val = validateBeamModel(shiftedH4);
        expect(val.isValid).toBe(true);

        const res = analyzeBeam(shiftedH4);
        expect(res.equilibrium.isBalanced).toBe(true);

        // Reacciones invariantes ante traslación:
        const rA = res.reactions.find((r) => r.supportId === 'S1')!;
        const rB = res.reactions.find((r) => r.supportId === 'S2')!;
        const rC = res.reactions.find((r) => r.supportId === 'S3')!;
        expect(rA.Ry).toBeCloseTo(22.5, 5);
        expect(rB.Ry).toBeCloseTo(75.0, 5);
        expect(rC.Ry).toBeCloseTo(22.5, 5);

        // Momentos en apoyos trasladados:
        expect(res.moment.evaluate(2.0)).toBeCloseTo(0.0, 5);
        expect(res.moment.evaluate(8.0)).toBeCloseTo(-45.0, 5);
        expect(res.moment.evaluate(14.0)).toBeCloseTo(0.0, 5);

        // Momentos máximos trasladados: x0_1 = 2 + 2.25 = 4.25 m, x0_2 = 8 + 3.75 = 11.75 m
        expect(res.moment.evaluate(4.25)).toBeCloseTo(25.3125, 5);
        expect(res.moment.evaluate(11.75)).toBeCloseTo(25.3125, 5);

        // Condiciones cinemáticas de frontera en apoyos: v(2)=0, v(8)=0, v(14)=0, theta(8)=0
        if (!res.deflection.isImplemented) {
          throw new Error('La deflexión debe estar implementada para H4');
        }
        expect(res.deflection.evaluate(2.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluate(8.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluate(14.0)).toBeCloseTo(0.0, 8);
        expect(res.deflection.evaluateSlope(8.0)).toBeCloseTo(0.0, 8);

        // Flecha máxima trasladada: x_max1 = 2 + 2.5292 = 4.5292 m
        expect(res.deflection.maxDownward.x).toBeCloseTo(4.529211, 4);
        expect(res.deflection.maxDownward.value * 1000.0).toBeCloseTo(7.0193, 3);

        // Reporte didáctico comunica coordenadas reales trasladadas:
        const report = res.didacticReport!;
        expect(report.caseId).toBe('H4');

        // Paso 1: muestra x=2m, x=8m, x=14m
        const step1 = report.steps.find((s) => s.stepNumber === 1);
        expect(step1?.substitution).toContain('x=2m');
        expect(step1?.substitution).toContain('x=8m');
        expect(step1?.substitution).toContain('x=14m');

        // Paso 2: extremos en x=2m y x=14m
        const step2 = report.steps.find((s) => s.stepNumber === 2);
        expect(step2?.substitution).toContain('x=2m');
        expect(step2?.substitution).toContain('x=14m');

        // Paso 4: momento central en x=8 m y abscisa en 4.250 m
        const step4 = report.steps.find((s) => s.stepNumber === 4);
        expect(step4?.substitution).toContain('4.250 m');
        expect(step4?.result).toContain('en x = 8 m');

        // Paso 5: evaluación cinemática en x=8 m con verificación exitosa
        const step5 = report.steps.find((s) => s.stepNumber === 5);
        expect(step5?.substitution).toContain('θ(8m)');
        expect(step5?.check?.isVerified).toBe(true);

        // Condiciones de compatibilidad con coordenadas reales
        expect(report.compatibilityConditions).toContain(
          'Desplazamiento nulo en los tres apoyos: v(2)=0, v(8)=0, v(14)=0'
        );
      });

      // 3. Invariancia ante el orden de entrada de los apoyos e inmutabilidad del modelo
      it('T-H4-ORDER-01: Invariancia ante permutación de apoyos e inmutabilidad del modelo original', () => {
        // 3a. Inmutabilidad de model.supports y model.loads bajo validateBeamModel
        const unorderedModel1: BeamModel = {
          ...canonicalH4,
          id: 'H4-unordered-supports-1',
          supports: [
            { id: 'S2', type: 'roller', x: 6.0, label: 'B (x=6)' },
            { id: 'S1', type: 'pin', x: 0.0, label: 'A (x=0)' },
            { id: 'S3', type: 'roller', x: 12.0, label: 'C (x=12)' },
          ],
        };
        const snapshotBeforeVal = JSON.parse(JSON.stringify(unorderedModel1));
        const val1 = validateBeamModel(unorderedModel1);
        expect(val1.isValid).toBe(true);
        expect(unorderedModel1.supports.map((s) => s.id)).toEqual(['S2', 'S1', 'S3']);
        expect(unorderedModel1).toEqual(snapshotBeforeVal);

        // 3b. Inmutabilidad de model.supports y model.loads bajo analyzeBeam
        const snapshotBeforeAna = JSON.parse(JSON.stringify(unorderedModel1));
        const res1 = analyzeBeam(unorderedModel1);
        expect(res1.equilibrium.isBalanced).toBe(true);
        expect(unorderedModel1.supports.map((s) => s.id)).toEqual(['S2', 'S1', 'S3']);
        expect(unorderedModel1).toEqual(snapshotBeforeAna);

        // 3c. Segunda permutación: orden descendente [S3, S2, S1]
        const unorderedModel2: BeamModel = {
          ...canonicalH4,
          id: 'H4-unordered-supports-2',
          supports: [
            { id: 'S3', type: 'roller', x: 12.0, label: 'C (x=12)' },
            { id: 'S2', type: 'roller', x: 6.0, label: 'B (x=6)' },
            { id: 'S1', type: 'pin', x: 0.0, label: 'A (x=0)' },
          ],
        };
        const snapshotBeforeVal2 = JSON.parse(JSON.stringify(unorderedModel2));
        const val2 = validateBeamModel(unorderedModel2);
        expect(val2.isValid).toBe(true);
        expect(unorderedModel2.supports.map((s) => s.id)).toEqual(['S3', 'S2', 'S1']);
        expect(unorderedModel2).toEqual(snapshotBeforeVal2);

        const snapshotBeforeAna2 = JSON.parse(JSON.stringify(unorderedModel2));
        const res2 = analyzeBeam(unorderedModel2);
        expect(res2.equilibrium.isBalanced).toBe(true);
        expect(unorderedModel2.supports.map((s) => s.id)).toEqual(['S3', 'S2', 'S1']);
        expect(unorderedModel2).toEqual(snapshotBeforeAna2);

        // 3d. Reacciones equivalentes por supportId:
        const rA1 = res1.reactions.find((r) => r.supportId === 'S1')!;
        const rB1 = res1.reactions.find((r) => r.supportId === 'S2')!;
        const rC1 = res1.reactions.find((r) => r.supportId === 'S3')!;
        expect(rA1.Ry).toBeCloseTo(22.5, 6);
        expect(rB1.Ry).toBeCloseTo(75.0, 6);
        expect(rC1.Ry).toBeCloseTo(22.5, 6);

        const rA2 = res2.reactions.find((r) => r.supportId === 'S1')!;
        const rB2 = res2.reactions.find((r) => r.supportId === 'S2')!;
        const rC2 = res2.reactions.find((r) => r.supportId === 'S3')!;
        expect(rA2.Ry).toBeCloseTo(22.5, 6);
        expect(rB2.Ry).toBeCloseTo(75.0, 6);
        expect(rC2.Ry).toBeCloseTo(22.5, 6);

        // 3e. Diagramas de esfuerzos internos idénticos:
        expect(res1.moment.evaluate(0.0)).toBeCloseTo(0.0, 6);
        expect(res2.moment.evaluate(0.0)).toBeCloseTo(0.0, 6);
        expect(res1.moment.evaluate(6.0, 'left')).toBeCloseTo(-45.0, 6);
        expect(res2.moment.evaluate(6.0, 'left')).toBeCloseTo(-45.0, 6);
        expect(res1.moment.evaluate(12.0)).toBeCloseTo(0.0, 6);
        expect(res2.moment.evaluate(12.0)).toBeCloseTo(0.0, 6);
        expect(res1.moment.evaluate(2.25)).toBeCloseTo(25.3125, 6);
        expect(res2.moment.evaluate(2.25)).toBeCloseTo(25.3125, 6);
        expect(res1.moment.evaluate(9.75)).toBeCloseTo(25.3125, 6);
        expect(res2.moment.evaluate(9.75)).toBeCloseTo(25.3125, 6);

        expect(res1.shear.evaluate(0.0, 'right')).toBeCloseTo(22.5, 6);
        expect(res2.shear.evaluate(0.0, 'right')).toBeCloseTo(22.5, 6);
        expect(res1.shear.evaluate(6.0, 'left')).toBeCloseTo(-37.5, 6);
        expect(res2.shear.evaluate(6.0, 'left')).toBeCloseTo(-37.5, 6);
        expect(res1.shear.evaluate(6.0, 'right')).toBeCloseTo(37.5, 6);
        expect(res2.shear.evaluate(6.0, 'right')).toBeCloseTo(37.5, 6);
        expect(res1.shear.evaluate(12.0, 'left')).toBeCloseTo(-22.5, 6);
        expect(res2.shear.evaluate(12.0, 'left')).toBeCloseTo(-22.5, 6);

        // 3f. Deflexión y pendiente idénticas:
        if (!res1.deflection.isImplemented || !res2.deflection.isImplemented) {
          throw new Error('La deflexión debe estar implementada para H4');
        }
        expect(res1.deflection.maxDownward.value).toBeCloseTo(res2.deflection.maxDownward.value, 8);
        expect(res1.deflection.maxDownward.x).toBeCloseTo(res2.deflection.maxDownward.x, 8);
        expect(res1.deflection.evaluate(0.0)).toBeCloseTo(0.0, 8);
        expect(res2.deflection.evaluate(0.0)).toBeCloseTo(0.0, 8);
        expect(res1.deflection.evaluate(6.0)).toBeCloseTo(0.0, 8);
        expect(res2.deflection.evaluate(6.0)).toBeCloseTo(0.0, 8);
        expect(res1.deflection.evaluate(12.0)).toBeCloseTo(0.0, 8);
        expect(res2.deflection.evaluate(12.0)).toBeCloseTo(0.0, 8);
        expect(res1.deflection.evaluateSlope(6.0)).toBeCloseTo(0.0, 8);
        expect(res2.deflection.evaluateSlope(6.0)).toBeCloseTo(0.0, 8);

        // 3g. Informe didáctico preserva las coordenadas espaciales invariantes:
        const rep1 = res1.didacticReport!;
        const rep2 = res2.didacticReport!;
        expect(rep1.steps[0]?.substitution).toContain('R1 en x=0m, R2 en x=6m, R3 en x=12m');
        expect(rep2.steps[0]?.substitution).toContain('R1 en x=0m, R2 en x=6m, R3 en x=12m');
        expect(rep1.steps[3]?.substitution).toContain('2.250 m');
        expect(rep2.steps[3]?.substitution).toContain('2.250 m');
        expect(rep1.steps[4]?.substitution).toContain('θ(6m)');
        expect(rep2.steps[4]?.substitution).toContain('θ(6m)');
        expect(rep1.compatibilityConditions).toEqual(rep2.compatibilityConditions);
      });

      // 4. Coherencia y límites de tolerancias de vanos y cargas (SPAN_EQUALITY_TOLERANCE y LOAD_INTENSITY_TOLERANCE)
      it('T-H4-TOL-01: Coherencia de tolerancias en vanos y cargas justo dentro y fuera de los límites', () => {
        // 4a. Viga con vanos casi iguales dentro de SPAN_EQUALITY_TOLERANCE (+0.5 * SPAN_EQUALITY_TOLERANCE)
        const withinSpanTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-within-span-tol',
          length: 12.0 + 0.5 * SPAN_EQUALITY_TOLERANCE,
          supports: [
            { id: 'S1', type: 'pin', x: 0.0 },
            { id: 'S2', type: 'roller', x: 6.0 },
            { id: 'S3', type: 'roller', x: 12.0 + 0.5 * SPAN_EQUALITY_TOLERANCE },
          ],
          loads: [
            {
              id: 'W1',
              type: 'distributed',
              xStart: 0.0,
              xEnd: 12.0 + 0.5 * SPAN_EQUALITY_TOLERANCE,
              wStart: 10.0,
              wEnd: 10.0,
            },
          ],
        };
        const valWithinSpan = validateBeamModel(withinSpanTolModel);
        expect(valWithinSpan.isValid).toBe(true);
        expect(() => calculateContinuousBeamReactions(withinSpanTolModel)).not.toThrow();

        // 4b. Viga con vanos desiguales fuera de SPAN_EQUALITY_TOLERANCE (+2.0 * SPAN_EQUALITY_TOLERANCE)
        const outsideSpanTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-outside-span-tol',
          length: 12.0 + 2.0 * SPAN_EQUALITY_TOLERANCE,
          supports: [
            { id: 'S1', type: 'pin', x: 0.0 },
            { id: 'S2', type: 'roller', x: 6.0 },
            { id: 'S3', type: 'roller', x: 12.0 + 2.0 * SPAN_EQUALITY_TOLERANCE },
          ],
          loads: [
            {
              id: 'W1',
              type: 'distributed',
              xStart: 0.0,
              xEnd: 12.0 + 2.0 * SPAN_EQUALITY_TOLERANCE,
              wStart: 10.0,
              wEnd: 10.0,
            },
          ],
        };
        const valOutsideSpan = validateBeamModel(outsideSpanTolModel);
        expect(valOutsideSpan.isValid).toBe(false);
        expect(valOutsideSpan.errors.some((e) => e.includes('vanos desiguales'))).toBe(true);
        expect(() => calculateContinuousBeamReactions(outsideSpanTolModel)).toThrow(
          /dos vanos de igual longitud/i
        );

        // 4c. Carga uniforme con ligera variación dentro de LOAD_INTENSITY_TOLERANCE (+0.5 * LOAD_INTENSITY_TOLERANCE)
        const withinLoadTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-within-load-tol',
          loads: [
            {
              id: 'W1',
              type: 'distributed',
              xStart: 0.0,
              xEnd: 12.0,
              wStart: 10.0,
              wEnd: 10.0 + 0.5 * LOAD_INTENSITY_TOLERANCE,
            },
          ],
        };
        const valWithinLoad = validateBeamModel(withinLoadTolModel);
        expect(valWithinLoad.isValid).toBe(true);
        expect(() => calculateContinuousBeamReactions(withinLoadTolModel)).not.toThrow();

        // 4d. Carga trapezoidal con variación fuera de LOAD_INTENSITY_TOLERANCE (+2.0 * LOAD_INTENSITY_TOLERANCE)
        const outsideLoadTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-outside-load-tol',
          loads: [
            {
              id: 'W1',
              type: 'distributed',
              xStart: 0.0,
              xEnd: 12.0,
              wStart: 10.0,
              wEnd: 10.0 + 2.0 * LOAD_INTENSITY_TOLERANCE,
            },
          ],
        };
        const valOutsideLoad = validateBeamModel(outsideLoadTolModel);
        expect(valOutsideLoad.isValid).toBe(false);
        expect(() => calculateContinuousBeamReactions(outsideLoadTolModel)).toThrow(
          /trapezoidales o no uniformes/i
        );
      });

      // 5. Rechazo controlado de cargas en voladizo exterior
      it('T-H4-OVERHANG-01: Rechazo controlado de cargas distribuidas que se prolongan en voladizos exteriores', () => {
        // 5a. Carga prolongada por la derecha: viga L = 14 m, apoyos en 0, 6, 12 m, carga en [0, 14] m
        const rightOverhangModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-right-overhang',
          length: 14.0,
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 14.0, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        const valRight = validateBeamModel(rightOverhangModel);
        expect(valRight.isValid).toBe(false);
        expect(valRight.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);

        // 5b. Carga prolongada por la izquierda: viga L = 16 m, apoyos en 2, 8, 14 m, carga en [0, 14] m
        const leftOverhangModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-left-overhang',
          length: 16.0,
          supports: [
            { id: 'S1', type: 'pin', x: 2.0 },
            { id: 'S2', type: 'roller', x: 8.0 },
            { id: 'S3', type: 'roller', x: 14.0 },
          ],
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 14.0, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        const valLeft = validateBeamModel(leftOverhangModel);
        expect(valLeft.isValid).toBe(false);
        expect(valLeft.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);

        // 5c. Tolerancia límite: viga L = 14 m, apoyos en 0, 6, 12 m
        // Carga dentro de LENGTH_TOLERANCE (xEnd = 12 + 0.5 * LENGTH_TOLERANCE)
        const withinTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-within-tol',
          length: 14.0,
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 12.0 + 0.5 * LENGTH_TOLERANCE, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        const valWithin = validateBeamModel(withinTolModel);
        expect(valWithin.isValid).toBe(true);

        const resWithin = analyzeBeam(withinTolModel);
        expect(resWithin.equilibrium.isBalanced).toBe(true);
        expect(resWithin.equilibrium.sumFy).toBeCloseTo(0.0, 7);
        expect(resWithin.equilibrium.sumM).toBeCloseTo(0.0, 7);

        // Incluso con alta intensidad de carga w = 50 kN/m, el clamping a los apoyos evita desbalance numérico
        const withinTolHighW: BeamModel = {
          ...canonicalH4,
          id: 'H4-within-tol-high-w',
          length: 14.0,
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 12.0 + 0.5 * LENGTH_TOLERANCE, wStart: 50.0, wEnd: 50.0 },
          ],
        };
        const valHighW = validateBeamModel(withinTolHighW);
        expect(valHighW.isValid).toBe(true);
        const resHighW = analyzeBeam(withinTolHighW);
        expect(resHighW.equilibrium.isBalanced).toBe(true);
        expect(resHighW.equilibrium.sumFy).toBeCloseTo(0.0, 7);
        expect(resHighW.equilibrium.sumM).toBeCloseTo(0.0, 7);

        // 5d. Tolerancia límite: viga L = 14 m, apoyos en 0, 6, 12 m
        // Carga fuera de LENGTH_TOLERANCE (xEnd = 12 + 2.0 * LENGTH_TOLERANCE)
        const outsideTolModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-outside-tol',
          length: 14.0,
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 12.0 + 2.0 * LENGTH_TOLERANCE, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        const valOutside = validateBeamModel(outsideTolModel);
        expect(valOutside.isValid).toBe(false);
        expect(valOutside.errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      });

      // 6. Validación completa en la entrada directa de calculateContinuousBeamReactions
      it('T-H4-REJECT-01: calculateContinuousBeamReactions valida y rechaza directamente precondiciones no satisfechas', () => {
        // 6a. Rechazo de carga puntual
        const pointLoadModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-point-load',
          loads: [{ id: 'P1', type: 'point', x: 3.0, P: 20.0 }],
        };
        expect(() => calculateContinuousBeamReactions(pointLoadModel)).toThrow(
          /no admite cargas puntuales/i
        );

        // 6b. Rechazo de carga en voladizo exterior
        const overhangDirectModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-overhang',
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 14.0, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        expect(() => calculateContinuousBeamReactions(overhangDirectModel)).toThrow(
          /no admite cargas en voladizo exterior/i
        );

        // 6c. Rechazo de carga parcial (solo sobre un vano [0, 6] en lugar de [0, 12])
        const partialDirectModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-partial',
          loads: [
            { id: 'W1', type: 'distributed', xStart: 0.0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
          ],
        };
        expect(() => calculateContinuousBeamReactions(partialDirectModel)).toThrow(
          /no admite cargas parciales o discontinuas/i
        );

        // 6d. Rechazo cuando faltan propiedades de material o sección
        const missingMatModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-missing-mat',
          material: undefined,
        };
        expect(() => calculateContinuousBeamReactions(missingMatModel)).toThrow(
          /requiere propiedades de material/i
        );

        const missingSecModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-missing-sec',
          section: undefined,
        };
        expect(() => calculateContinuousBeamReactions(missingSecModel)).toThrow(
          /requiere propiedades de material/i
        );

        // 6e. Rechazo cuando el número de apoyos no es 3
        const twoSupportsModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-2-supports',
          supports: [
            { id: 'S1', type: 'pin', x: 0.0 },
            { id: 'S2', type: 'roller', x: 12.0 },
          ],
        };
        expect(() => calculateContinuousBeamReactions(twoSupportsModel)).toThrow(
          /requiere exactamente 3 apoyos simples/i
        );

        // 6f. Rechazo de empotramientos en viga continua H4
        const fixedSupportModel: BeamModel = {
          ...canonicalH4,
          id: 'H4-direct-fixed-support',
          supports: [
            { id: 'S1', type: 'fixed', x: 0.0 },
            { id: 'S2', type: 'roller', x: 6.0 },
            { id: 'S3', type: 'roller', x: 12.0 },
          ],
        };
        expect(() => calculateContinuousBeamReactions(fixedSupportModel)).toThrow(
          /requiere apoyos simples/i
        );
      });
    });
  });
});
