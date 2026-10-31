import { describe, expect, it } from 'vitest';
import {
  analyzeBeam,
  computeMaterialsMechanics,
  PYTEL_SINGER_CASES,
  type BeamModel,
  type BeamSection,
} from '../src/index.js';

describe('OptiSteel 2.0 — Módulo de Resistencia de Materiales (FASE 8)', () => {
  // --------------------------------------------------------------------------
  // 8.1. Viga simplemente apoyada con carga puntual central
  // --------------------------------------------------------------------------
  describe('8.1. Viga simplemente apoyada con carga puntual central', () => {
    // L = 6 m, P = 20 kN, E = 200 GPa, b = 0.10 m (100 mm), h = 0.20 m (200 mm)
    // I = b * h^3 / 12 = 0.10 * 0.20^3 / 12 = 6.666667e-5 m^4 = 6666.667 cm^4
    // A = b * h = 0.02 m^2 = 200 cm^2 = 20000 mm^2
    // S = b * h^2 / 6 = 100 * 40000 / 6 = 666666.7 mm^3 = 666.667 cm^3
    const bMm = 100;
    const hMm = 200;
    const izCm4 = (bMm * hMm ** 3) / (12 * 10000); // 6666.6667 cm^4
    const wzCm3 = (bMm * hMm ** 2) / 6000; // 666.6667 cm^3
    const areaCm2 = (bMm * hMm) / 100; // 200 cm^2

    const section: BeamSection = {
      name: 'Rectangular 100x200',
      type: 'rectangular',
      widthMm: bMm,
      heightMm: hMm,
      Iz: izCm4,
      Wz: wzCm3,
      areaCm2,
      allowableBendingStressMPa: 100,
      allowableShearStressMPa: 10,
    };

    const model: BeamModel = {
      id: 'simple-point-center',
      length: 6.0,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [{ id: 'P1', type: 'point', x: 3.0, P: 20.0 }],
      material: { name: 'Acero Estructural', E: 200.0 }, // GPa
      section,
    };

    it('Verifica reacciones estáticas R_A = R_B = P/2 = 10 kN y cortante máximo V_max = 10 kN', () => {
      const analysis = analyzeBeam(model);
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;

      expect(rA.Ry).toBeCloseTo(10.0, 5);
      expect(rB.Ry).toBeCloseTo(10.0, 5);
      expect(analysis.shear.maxAbsolute.value).toBeCloseTo(10.0, 5);
    });

    it('Verifica momento máximo M_max = P*L/4 = 30 kN·m en x = 3.0 m', () => {
      const analysis = analyzeBeam(model);
      expect(analysis.moment.maxPositive.value).toBeCloseTo(30.0, 5);
      expect(analysis.moment.maxPositive.x).toBeCloseTo(3.0, 4);
      expect(analysis.moment.maxAbsolute.value).toBeCloseTo(30.0, 5);
    });

    it('Verifica esfuerzo normal máximo por flexión sigma_max = M_max * (h/2) / I = 45.0 MPa', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      expect(mechanics.bending.status).toBe('calculated');
      // sigma = 30 kN*m * 10^3 / 666.6667 cm^3 = 45.0 MPa
      expect(mechanics.bending.actualStressMPa).toBeCloseTo(45.0, 2);
      expect(mechanics.bending.momentType).toBe('positive');
      // Momento positivo: tracción inferior, compresión superior
      expect(mechanics.bending.extremeFibers.bottom).toBe('tension');
      expect(mechanics.bending.extremeFibers.top).toBe('compression');
      expect(mechanics.bending.utilizationRatio).toBeCloseTo(0.45, 3);
      expect(mechanics.bending.safetyFactor).toBeCloseTo(100 / 45, 2);
    });

    it('Verifica cortante promedio tau_prom = 0.50 MPa y cortante rectangular tau_max = 1.5 * V/A = 0.75 MPa', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      expect(mechanics.shear.status).toBe('calculated');
      expect(mechanics.shear.shearDistributionType).toBe('rectangular');
      // tau_prom = 10000 N / 20000 mm^2 = 0.50 MPa
      expect(mechanics.shear.averageShearStressMPa).toBeCloseTo(0.50, 3);
      // tau_max = 1.5 * 0.50 = 0.75 MPa
      expect(mechanics.shear.maxShearStressMPa).toBeCloseTo(0.75, 3);
    });

    it('Verifica flecha máxima v_max = P*L^3 / (48*EI) y continuidad en x = 3.0 m', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      // EI = 200 GPa * 1e6 * 6666.6667 cm^4 * 1e-8 = 13333.333 kN*m^2
      // v_max = (20 * 6^3) / (48 * 13333.333) = 4320 / 640000 = 0.00675 m = 6.75 mm
      const expectedDeltaM = (20.0 * 6.0 ** 3) / (48.0 * 13333.3333);
      const expectedDeltaMm = expectedDeltaM * 1000; // 6.75 mm

      expect(mechanics.deflection.maxAbsoluteDeflectionMm).toBeCloseTo(expectedDeltaMm, 2);
      expect(mechanics.deflection.maxAbsoluteLocationM).toBeCloseTo(3.0, 3);

      // Verificación de continuidad de ecuaciones en el punto central x = 3.0 m
      const eqResult = mechanics.elasticCurve;
      expect(eqResult.segments.length).toBe(2);
      expect(eqResult.boundaryConditions.length).toBe(2);
      expect(eqResult.integrationConstants).toBeDefined();

      // En x = 3 m, v_1(3) = v_2(0) = 6.75 mm
      const vAt3 = (analysis.deflection as any).evaluate(3.0) * 1000;
      expect(vAt3).toBeCloseTo(6.75, 2);
    });

    it('Verifica solución con inercia fija I = 8e-5 m^4 (8000 cm^4): v_max = 5.625 mm y sigma_max = 37.5 MPa', () => {
      const model8000: BeamModel = {
        ...model,
        section: {
          name: 'I = 8000 cm^4',
          Iz: 8000.0,
          cMm: 100.0,
          areaCm2: 200.0,
          widthMm: 100.0,
          heightMm: 200.0,
          type: 'rectangular',
        },
      };

      const analysis = analyzeBeam(model8000);
      const mechanics = analysis.mechanics!;

      // EI = 200 * 8000 * 1e-2 = 16000 kN*m^2
      // v_max = (20 * 6^3) / (48 * 16000) = 4320 / 768000 = 0.005625 m = 5.625 mm
      expect(mechanics.deflection.maxAbsoluteDeflectionMm).toBeCloseTo(5.625, 3);
      // Wz = 8000 * 10 / 100 = 800 cm^3
      // sigma = 30 * 10^3 / 800 = 37.5 MPa
      expect(mechanics.bending.actualStressMPa).toBeCloseTo(37.5, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 8.2. Viga simplemente apoyada con carga uniforme continua
  // --------------------------------------------------------------------------
  describe('8.2. Viga simplemente apoyada con carga uniforme continua', () => {
    // L = 6 m, w = 10 kN/m, E = 200 GPa, I = 8000 cm^4 (8e-5 m^4), b = 100 mm, h = 200 mm
    const section: BeamSection = {
      name: 'Rectangular 100x200',
      type: 'rectangular',
      widthMm: 100,
      heightMm: 200,
      Iz: 8000.0,
      Wz: 800.0,
      areaCm2: 200.0,
    };

    const model: BeamModel = {
      id: 'simple-uniform',
      length: 6.0,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        { id: 'w1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
      ],
      material: { name: 'Acero Estructural', E: 200.0 },
      section,
    };

    it('Verifica R_A = R_B = w*L/2 = 30 kN y V_max = 30 kN', () => {
      const analysis = analyzeBeam(model);
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;

      expect(rA.Ry).toBeCloseTo(30.0, 5);
      expect(rB.Ry).toBeCloseTo(30.0, 5);
      expect(analysis.shear.maxAbsolute.value).toBeCloseTo(30.0, 5);
    });

    it('Verifica M_max = w*L^2 / 8 = 45 kN·m en x = 3.0 m', () => {
      const analysis = analyzeBeam(model);
      expect(analysis.moment.maxPositive.value).toBeCloseTo(45.0, 5);
      expect(analysis.moment.maxPositive.x).toBeCloseTo(3.0, 4);
    });

    it('Verifica sigma_max = 56.25 MPa y cortante rectangular tau_max = 1.5 * 30/200 * 10 = 2.25 MPa', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      // sigma = 45 * 10^3 / 800 = 56.25 MPa
      expect(mechanics.bending.actualStressMPa).toBeCloseTo(56.25, 2);
      expect(mechanics.bending.extremeFibers.bottom).toBe('tension');
      expect(mechanics.bending.extremeFibers.top).toBe('compression');

      // tau_prom = 30000 / 20000 = 1.50 MPa, tau_max = 1.5 * 1.50 = 2.25 MPa
      expect(mechanics.shear.averageShearStressMPa).toBeCloseTo(1.50, 3);
      expect(mechanics.shear.maxShearStressMPa).toBeCloseTo(2.25, 3);
    });

    it('Verifica v_max = 5*w*L^4 / (384*EI) = 10.547 mm en x = 3.0 m', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      // EI = 200 * 8000 * 1e-2 = 16000 kN*m^2
      // v_max = 5 * 10 * 6^4 / (384 * 16000) = 64800 / 6144000 = 0.010546875 m = 10.547 mm
      const expectedDeltaM = (5.0 * 10.0 * 6.0 ** 4) / (384.0 * 16000.0);
      const expectedDeltaMm = expectedDeltaM * 1000;

      expect(mechanics.deflection.maxAbsoluteDeflectionMm).toBeCloseTo(expectedDeltaMm, 3);
      expect(mechanics.deflection.maxAbsoluteLocationM).toBeCloseTo(3.0, 3);

      // Verificación de condiciones de contorno v(0) = 0 y v(L) = 0
      const def = analysis.deflection as any;
      expect(def.evaluate(0)).toBeCloseTo(0, 7);
      expect(def.evaluate(6.0)).toBeCloseTo(0, 7);
    });
  });

  // --------------------------------------------------------------------------
  // 8.3. Viga en voladizo con carga puntual en el extremo
  // --------------------------------------------------------------------------
  describe('8.3. Viga en voladizo con carga puntual en el extremo', () => {
    // L = 4 m, P = 25 kN en x = 4 m, empotrada en x = 0
    const section: BeamSection = {
      name: 'Sección Voladizo',
      Iz: 5000.0, // cm^4
      Wz: 500.0, // cm^3
      areaCm2: 150.0,
    };

    const model: BeamModel = {
      id: 'cantilever-point',
      length: 4.0,
      supports: [{ id: 'Emp', type: 'fixed', x: 0 }],
      loads: [{ id: 'P1', type: 'point', x: 4.0, P: 25.0 }],
      material: { name: 'Acero Estructural', E: 200.0 },
      section,
    };

    it('Verifica R_A = 25 kN, M_A = -100 kN·m, V_max = 25 kN y M_max = -100 kN·m', () => {
      const analysis = analyzeBeam(model);
      const rA = analysis.reactions[0]!;

      expect(rA.Ry).toBeCloseTo(25.0, 5);
      expect(rA.Mr).toBeCloseTo(100.0, 5); // CCW reaction moment
      expect(analysis.shear.maxAbsolute.value).toBeCloseTo(25.0, 5);
      expect(analysis.moment.maxNegative.value).toBeCloseTo(-100.0, 5);
      expect(analysis.moment.maxAbsolute.value).toBeCloseTo(100.0, 5);
      expect(analysis.moment.maxAbsolute.x).toBeCloseTo(0.0, 4);
    });

    it('Verifica flexión con momento negativo: tracción en fibra superior y compresión en fibra inferior', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      expect(mechanics.bending.momentType).toBe('negative');
      expect(mechanics.bending.extremeFibers.top).toBe('tension');
      expect(mechanics.bending.extremeFibers.bottom).toBe('compression');
      // sigma = 100 * 10^3 / 500 = 200 MPa
      expect(mechanics.bending.actualStressMPa).toBeCloseTo(200.0, 2);
    });

    it('Verifica flecha máxima en extremo libre v_max = P*L^3 / (3*EI) y giro nulo en empotramiento', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      // EI = 200 * 5000 * 1e-2 = 10000 kN*m^2
      // v_max = (25 * 4^3) / (3 * 10000) = 1600 / 30000 = 0.053333 m = 53.333 mm
      const expectedDeltaM = (25.0 * 4.0 ** 3) / (3.0 * 10000.0);
      const expectedDeltaMm = expectedDeltaM * 1000;

      expect(mechanics.deflection.maxAbsoluteDeflectionMm).toBeCloseTo(expectedDeltaMm, 3);
      expect(mechanics.deflection.maxAbsoluteLocationM).toBeCloseTo(4.0, 3);

      const def = analysis.deflection as any;
      expect(def.evaluateSlope(0)).toBeCloseTo(0, 7); // theta(0) = 0
      expect(def.evaluate(0)).toBeCloseTo(0, 7); // v(0) = 0
    });
  });

  // --------------------------------------------------------------------------
  // 8.4. Viga en voladizo con carga distribuida uniforme
  // --------------------------------------------------------------------------
  describe('8.4. Viga en voladizo con carga uniforme', () => {
    // L = 4 m, w = 10 kN/m en todo el vano, empotrada en x = 0
    const section: BeamSection = {
      name: 'Sección Voladizo Uniforme',
      Iz: 5000.0,
      Wz: 500.0,
      areaCm2: 150.0,
    };

    const model: BeamModel = {
      id: 'cantilever-uniform',
      length: 4.0,
      supports: [{ id: 'Emp', type: 'fixed', x: 0 }],
      loads: [{ id: 'w1', type: 'distributed', xStart: 0, xEnd: 4.0, wStart: 10.0, wEnd: 10.0 }],
      material: { name: 'Acero Estructural', E: 200.0 },
      section,
    };

    it('Verifica R_A = w*L = 40 kN, M_max = -w*L^2 / 2 = -80 kN·m', () => {
      const analysis = analyzeBeam(model);
      const rA = analysis.reactions[0]!;

      expect(rA.Ry).toBeCloseTo(40.0, 5);
      expect(analysis.shear.maxAbsolute.value).toBeCloseTo(40.0, 5);
      expect(analysis.moment.maxNegative.value).toBeCloseTo(-80.0, 5);
      expect(analysis.moment.maxAbsolute.value).toBeCloseTo(80.0, 5);
    });

    it('Verifica flecha en extremo libre v_max = w*L^4 / (8*EI) = 32.0 mm', () => {
      const analysis = analyzeBeam(model);
      const mechanics = analysis.mechanics!;

      // EI = 10000 kN*m^2
      // v_max = (10 * 4^4) / (8 * 10000) = 2560 / 80000 = 0.032 m = 32.0 mm
      expect(mechanics.deflection.maxAbsoluteDeflectionMm).toBeCloseTo(32.0, 3);
      expect(mechanics.deflection.maxAbsoluteLocationM).toBeCloseTo(4.0, 3);
    });
  });

  // --------------------------------------------------------------------------
  // 8.5. Compatibilidad con solvers hiperestáticos H1–H4
  // --------------------------------------------------------------------------
  describe('8.5. Casos hiperestáticos H1–H4', () => {
    const material = { name: 'Acero Estructural', E: 200.0 };
    const section: BeamSection = { name: 'Sección H', Iz: 5000.0, Wz: 500.0 };

    it('H1 (Empotrada-apoyada con puntual central L=4, P=16): conserva reacciones exactas y genera esfuerzos', () => {
      const h1Model: BeamModel = {
        id: 'H1-test',
        length: 4.0,
        supports: [
          { id: 'A', type: 'fixed', x: 0 },
          { id: 'B', type: 'roller', x: 4.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 2.0, P: 16.0 }],
        material,
        section,
      };

      const analysis = analyzeBeam(h1Model);
      // R_B = (5/16)*16 = 5 kN, R_A = 11 kN, M_A = -(3/16)*16*4 = -12 kN*m
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;
      expect(rA.Ry).toBeCloseTo(11.0, 4);
      expect(rB.Ry).toBeCloseTo(5.0, 4);

      const mechanics = analysis.mechanics!;
      expect(mechanics.bending.status).toBe('calculated');
      // M_max = 12 kN*m en x = 0 (hogging)
      expect(mechanics.bending.maxMomentDemandKNm).toBeCloseTo(12.0, 3);
      expect(mechanics.bending.actualStressMPa).toBeCloseTo((12.0 * 1000) / 500, 2);
      expect(mechanics.elasticCurve.status).toBe('exact_analytical');
      expect(mechanics.elasticCurve.boundaryConditions.length).toBe(3);
    });

    it('H2 (Empotrada-apoyada con uniforme L=6, w=10): conserva R_B = 22.5 kN, R_A = 37.5 kN, M_A = -45 kN·m', () => {
      const h2Model: BeamModel = {
        id: 'H2-test',
        length: 6.0,
        supports: [
          { id: 'A', type: 'fixed', x: 0 },
          { id: 'B', type: 'roller', x: 6.0 },
        ],
        loads: [{ id: 'w1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 }],
        material,
        section,
      };

      const analysis = analyzeBeam(h2Model);
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;
      expect(rA.Ry).toBeCloseTo(37.5, 4);
      expect(rB.Ry).toBeCloseTo(22.5, 4);
      expect(analysis.moment.maxNegative.value).toBeCloseTo(-45.0, 4);

      const mechanics = analysis.mechanics!;
      expect(mechanics.bending.maxMomentDemandKNm).toBeCloseTo(45.0, 3);
      expect(mechanics.bending.actualStressMPa).toBeCloseTo((45.0 * 1000) / 500, 2);
    });

    it('H3 (Biempotrada con uniforme L=6, w=12): conserva R_A = R_B = 36 kN, M_ext = -36 kN·m, M_mid = +18 kN·m', () => {
      const h3Model: BeamModel = {
        id: 'H3-test',
        length: 6.0,
        supports: [
          { id: 'A', type: 'fixed', x: 0 },
          { id: 'B', type: 'fixed', x: 6.0 },
        ],
        loads: [{ id: 'w1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 12.0, wEnd: 12.0 }],
        material,
        section,
      };

      const analysis = analyzeBeam(h3Model);
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;
      expect(rA.Ry).toBeCloseTo(36.0, 4);
      expect(rB.Ry).toBeCloseTo(36.0, 4);
      expect(analysis.moment.maxNegative.value).toBeCloseTo(-36.0, 4);

      const mechanics = analysis.mechanics!;
      expect(mechanics.bending.maxMomentDemandKNm).toBeCloseTo(36.0, 3);
      expect(mechanics.bending.actualStressMPa).toBeCloseTo((36.0 * 1000) / 500, 2);
    });

    it('H4 (Viga continua 2 vanos Lv=4, w=6): conserva R_1 = R_3 = 9 kN, R_2 = 30 kN, M_B = -12 kN·m', () => {
      const h4Model: BeamModel = {
        id: 'H4-test',
        length: 8.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 4.0 },
          { id: 'C', type: 'roller', x: 8.0 },
        ],
        loads: [{ id: 'w1', type: 'distributed', xStart: 0, xEnd: 8.0, wStart: 6.0, wEnd: 6.0 }],
        material,
        section,
      };

      const analysis = analyzeBeam(h4Model);
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;
      const rC = analysis.reactions.find((r) => r.supportId === 'C')!;
      expect(rA.Ry).toBeCloseTo(9.0, 4);
      expect(rB.Ry).toBeCloseTo(30.0, 4);
      expect(rC.Ry).toBeCloseTo(9.0, 4);

      const mechanics = analysis.mechanics!;
      expect(mechanics.bending.maxMomentDemandKNm).toBeCloseTo(12.0, 3);
      expect(mechanics.bending.actualStressMPa).toBeCloseTo((12.0 * 1000) / 500, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 8.6. Pruebas de robustez y modelos geométricos de sección
  // --------------------------------------------------------------------------
  describe('8.6. Pruebas de modelos de sección y robustez', () => {
    it('Sección sin dimensiones ni Wz reporta estado insufficient_section_data sin fallar ni arrojar NaN', () => {
      const incompleteModel: BeamModel = {
        length: 5.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 5.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 2.5, P: 10.0 }],
        material: { E: 200.0 },
        section: { Iz: 4000.0 }, // Solo Iz, sin Wz ni c ni b ni h ni A
      };

      const analysis = analyzeBeam(incompleteModel);
      const mechanics = analysis.mechanics!;

      expect(mechanics.bending.status).toBe('insufficient_section_data');
      expect(mechanics.bending.actualStressMPa).toBeUndefined();
      expect(mechanics.bending.notes.length).toBeGreaterThan(0);

      expect(mechanics.shear.status).toBe('insufficient_section_data');
      expect(mechanics.shear.averageShearStressMPa).toBeUndefined();
      expect(mechanics.shear.maxShearStressMPa).toBeUndefined();
    });

    it('Sección general con solo área A calcula cortante promedio pero NO asigna V/A como cortante máximo', () => {
      const areaOnlyModel: BeamModel = {
        length: 5.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 5.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 2.5, P: 20.0 }],
        material: { E: 200.0 },
        section: {
          Iz: 4000.0,
          areaCm2: 100.0, // 10000 mm^2
        },
      };

      const analysis = analyzeBeam(areaOnlyModel);
      const mechanics = analysis.mechanics!;

      // V_max = 10 kN. tau_prom = 10000 N / 10000 mm^2 = 1.0 MPa
      expect(mechanics.shear.status).toBe('average_only');
      expect(mechanics.shear.averageShearStressMPa).toBeCloseTo(1.0, 3);
      // El cortante máximo DEBE ser undefined y no inventarse como 1.0
      expect(mechanics.shear.maxShearStressMPa).toBeUndefined();
      expect(mechanics.shear.shearDistributionType).toBe('average_only');
    });

    it('Perfil I/W con dimensiones de alma y alas calcula cortante en el eje neutro', () => {
      const iBeamModel: BeamModel = {
        length: 6.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 6.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 3.0, P: 50.0 }],
        material: { E: 200.0 },
        section: {
          name: 'Perfil I 300x150',
          type: 'i_shape',
          heightMm: 300,
          flangeWidthMm: 150,
          flangeThicknessMm: 12,
          webThicknessMm: 8,
          Iz: 8000.0, // cm^4
          Wz: 533.33, // cm^3
        },
      };

      const analysis = analyzeBeam(iBeamModel);
      const mechanics = analysis.mechanics!;

      expect(mechanics.shear.status).toBe('calculated');
      expect(mechanics.shear.shearDistributionType).toBe('i_shape_web');
      expect(mechanics.shear.maxShearStressMPa).toBeDefined();
      expect(mechanics.shear.maxShearStressMPa!).toBeGreaterThan(0);
    });

    it('Cambiar la inercia Iz altera la deflexión pero preserva exactamente las reacciones y equilibrio isostático', () => {
      const baseBeam: BeamModel = {
        length: 6.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 6.0 },
        ],
        loads: [{ id: 'w1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 15.0, wEnd: 15.0 }],
        material: { E: 200.0 },
        section: { Iz: 4000.0 },
      };

      const stiffBeam: BeamModel = {
        ...baseBeam,
        section: { Iz: 8000.0 }, // Doble inercia
      };

      const res1 = analyzeBeam(baseBeam);
      const res2 = analyzeBeam(stiffBeam);

      // Reacciones idénticas
      expect(res1.reactions[0]!.Ry).toBeCloseTo(res2.reactions[0]!.Ry, 8);
      expect(res1.reactions[1]!.Ry).toBeCloseTo(res2.reactions[1]!.Ry, 8);

      // Flecha del haz rígido debe ser exactamente la mitad
      const v1 = (res1.deflection as any).maxAbsolute.value;
      const v2 = (res2.deflection as any).maxAbsolute.value;
      expect(v1 / v2).toBeCloseTo(2.0, 5);
    });
  });

  // --------------------------------------------------------------------------
  // 8.7. Convergencia de Configuración Manual y Caso Pytel-Singer
  // --------------------------------------------------------------------------
  describe('8.7. Integración y convergencia Manual vs Pytel-Singer', () => {
    it('Caso 8 Pytel-Singer (Simplemente apoyada con carga uniforme L=6, w=12) coincide exactamente con entrada manual', () => {
      // 1. Modelo creado desde catálogo Pytel-Singer (Caso 8: simplemente apoyada con carga uniforme completa)
      const pytelDef = PYTEL_SINGER_CASES[8]!;
      const pytelModelRaw = pytelDef.createModel({ L: 6.0, w: 12.0 });

      const sectionProps: BeamSection = {
        name: 'W10x30',
        Iz: 7076.0,
        Wz: 434.0,
        heightMm: 267.0,
        webThicknessMm: 7.6,
        areaCm2: 57.0,
      };

      const pytelModel: BeamModel = {
        ...pytelModelRaw,
        material: { name: 'Acero A36', E: 200.0 },
        section: sectionProps,
      };

      // 2. Modelo equivalente configurado manualmente
      const manualModel: BeamModel = {
        length: 6.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0 },
          { id: 'S2', type: 'roller', x: 6.0 },
        ],
        loads: [{ id: 'W1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 12.0, wEnd: 12.0 }],
        material: { name: 'Acero A36', E: 200.0 },
        section: sectionProps,
      };

      const resPytel = analyzeBeam(pytelModel);
      const resManual = analyzeBeam(manualModel);

      // Comparación de reacciones
      expect(resPytel.reactions[0]!.Ry).toBeCloseTo(resManual.reactions[0]!.Ry, 6);
      expect(resPytel.reactions[1]!.Ry).toBeCloseTo(resManual.reactions[1]!.Ry, 6);

      // Comparación de momento máximo
      expect(resPytel.moment.maxAbsolute.value).toBeCloseTo(resManual.moment.maxAbsolute.value, 6);

      // Comparación de deflexión máxima
      const defPytel = resPytel.mechanics!.deflection.maxAbsoluteDeflectionMm!;
      const defManual = resManual.mechanics!.deflection.maxAbsoluteDeflectionMm!;
      expect(defPytel).toBeCloseTo(defManual, 4);

      // Comparación de esfuerzo normal por flexión
      const sigmaPytel = resPytel.mechanics!.bending.actualStressMPa!;
      const sigmaManual = resManual.mechanics!.bending.actualStressMPa!;
      expect(sigmaPytel).toBeCloseTo(sigmaManual, 4);

      // Comparación con solución analítica teórica de Pytel-Singer
      const theoretical = pytelDef.evaluateTheoretical(
        { L: 6.0, w: 12.0 },
        200.0 * 7076.0 * 1e-2
      );
      expect(resPytel.moment.maxPositive.value).toBeCloseTo(theoretical.maxMoment, 4);
      expect(defPytel / 1000).toBeCloseTo(theoretical.maxDeflection, 4);
    });
  });

  // --------------------------------------------------------------------------
  // 8.8. Auditoría P2.2: Evaluación de Estado Límite de Servicio (ELS) por Vanos (BUG-MEC-01)
  // --------------------------------------------------------------------------
  describe('8.8. Auditoría P2.2: Evaluación ELS por Vanos y Voladizos (BUG-MEC-01)', () => {
    const defaultSection: BeamSection = {
      name: 'W10x30',
      type: 'i_shape',
      Iz: 7076.0,
      Wz: 539.0,
      heightMm: 267.0,
      webThicknessMm: 7.6,
      flangeWidthMm: 147.0,
      flangeThicknessMm: 11.2,
      areaCm2: 57.0,
    };

    it('1. Viga simplemente apoyada de un vano: conserva longitud de vano L_span = L_total', () => {
      const model: BeamModel = {
        length: 6.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 6.0 },
        ],
        loads: [{ id: 'W1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 12.0, wEnd: 12.0 }],
        material: { name: 'Acero A36', E: 200.0 },
        section: defaultSection,
      };

      const analysis = analyzeBeam(model);
      const defResult = analysis.mechanics!.deflection;

      expect(defResult.status).toBe('calculated');
      // Un solo vano entre apoyos de 6 m
      expect(defResult.referenceLengthM).toBeCloseTo(6.0, 3);
      expect(defResult.referenceSpanDescription).toContain('Vano 1');
      // Limite: 6000 / 360 = 16.667 mm
      expect(defResult.allowableDeflectionMm).toBeCloseTo(16.667, 2);
      expect(defResult.spanEvaluations).toBeDefined();
      expect(defResult.spanEvaluations!.length).toBe(1);
      expect(defResult.spanEvaluations![0]!.spanType).toBe('supported_span');
    });

    it('2. Viga continua simétrica H4: evalúa cada vano con L_span = L/2 (NO con L_total)', () => {
      // Dos vanos de 5 m, longitud total 10 m
      const modelH4: BeamModel = {
        length: 10.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 5.0 },
          { id: 'C', type: 'roller', x: 10.0 },
        ],
        loads: [{ id: 'W1', type: 'distributed', xStart: 0, xEnd: 10.0, wStart: 15.0, wEnd: 15.0 }],
        material: { name: 'Acero A36', E: 200.0 },
        section: defaultSection,
      };

      const analysis = analyzeBeam(modelH4);
      const defResult = analysis.mechanics!.deflection;

      expect(defResult.status).toBe('calculated');
      // Se identifican exactamente 2 vanos interiores
      expect(defResult.spanEvaluations).toBeDefined();
      expect(defResult.spanEvaluations!.length).toBe(2);

      const span1 = defResult.spanEvaluations![0]!;
      const span2 = defResult.spanEvaluations![1]!;

      // Ambos vanos deben tener longitud de referencia 5.0 m, NO 10.0 m
      expect(span1.spanLengthM).toBeCloseTo(5.0, 3);
      expect(span1.referenceLengthM).toBeCloseTo(5.0, 3);
      expect(span2.spanLengthM).toBeCloseTo(5.0, 3);
      expect(span2.referenceLengthM).toBeCloseTo(5.0, 3);

      // Flecha admisible por vano: 5000 / 360 = 13.889 mm (NUNCA 27.78 mm)
      expect(span1.allowableDeflectionMm).toBeCloseTo(13.889, 2);
      expect(span2.allowableDeflectionMm).toBeCloseTo(13.889, 2);
      expect(defResult.allowableDeflectionMm).toBeCloseTo(13.889, 2);

      // La referencia gobernante debe ser 5.0 m
      expect(defResult.referenceLengthM).toBeCloseTo(5.0, 3);
      expect(defResult.referenceSpanDescription).toContain('5 m');

      // Ambas flechas simétricas son ~3.59 mm en vano 1 y vano 2
      expect(span1.maxDeflectionMm).toBeGreaterThan(3.0);
      expect(span1.maxDeflectionMm).toBeLessThan(4.5);
      expect(span2.maxDeflectionMm).toBeCloseTo(span1.maxDeflectionMm, 2);

      // Ambas deben estar dentro del límite admisible (13.89 mm)
      expect(span1.passesService).toBe(true);
      expect(span2.passesService).toBe(true);
      expect(defResult.serviceCheckStatus).toBe('passed');
    });

    it('3. Máximos de deflexión en diferentes vanos en H4: asocia ubicaciones correspondientes', () => {
      const modelH4: BeamModel = {
        length: 10.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 5.0 },
          { id: 'C', type: 'roller', x: 10.0 },
        ],
        loads: [{ id: 'W1', type: 'distributed', xStart: 0, xEnd: 10.0, wStart: 15.0, wEnd: 15.0 }],
        material: { name: 'Acero A36', E: 200.0 },
        section: defaultSection,
      };

      const analysis = analyzeBeam(modelH4);
      const span1 = analysis.mechanics!.deflection.spanEvaluations![0]!;
      const span2 = analysis.mechanics!.deflection.spanEvaluations![1]!;

      // En el vano 1, el máximo ocurre a x ≈ 0.4215 * 5 ≈ 2.11 m
      expect(span1.maxDeflectionLocationM).toBeGreaterThan(1.8);
      expect(span1.maxDeflectionLocationM).toBeLessThan(2.4);

      // En el vano 2, el máximo ocurre a x ≈ 5 + 0.5785 * 5 ≈ 7.89 m
      expect(span2.maxDeflectionLocationM).toBeGreaterThan(7.6);
      expect(span2.maxDeflectionLocationM).toBeLessThan(8.2);
    });

    it('4. Viga con voladizo: aplica criterio normativo de voladizo (2·a/n) y vano entre apoyos', () => {
      // Viga de 8 m: apoyos en x = 0 (pin) y x = 6 m (roller), voladizo de 2 m (x = 6 a 8 m)
      const modelOverhang: BeamModel = {
        length: 8.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0 },
          { id: 'S2', type: 'roller', x: 6.0 },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 10.0, wEnd: 10.0 },
          { id: 'P_tip', type: 'point', x: 8.0, P: 15.0 },
        ],
        material: { name: 'Acero A36', E: 200.0 },
        section: defaultSection,
      };

      const analysis = analyzeBeam(modelOverhang);
      const defResult = analysis.mechanics!.deflection;

      expect(defResult.spanEvaluations).toBeDefined();
      expect(defResult.spanEvaluations!.length).toBe(2);

      const supportedSpan = defResult.spanEvaluations!.find((s) => s.spanType === 'supported_span')!;
      const cantileverSpan = defResult.spanEvaluations!.find((s) => s.spanType === 'cantilever')!;

      expect(supportedSpan).toBeDefined();
      expect(supportedSpan.spanLengthM).toBeCloseTo(6.0, 3);
      // Vano entre apoyos: 6000 / 360 = 16.667 mm
      expect(supportedSpan.allowableDeflectionMm).toBeCloseTo(16.667, 2);

      expect(cantileverSpan).toBeDefined();
      expect(cantileverSpan.spanLengthM).toBeCloseTo(2.0, 3);
      // Voladizo con criterio 2·a/n: (2 * 2000) / 360 = 4000 / 360 = 11.111 mm
      expect(cantileverSpan.allowableDeflectionMm).toBeCloseTo(11.111, 2);
      expect(cantileverSpan.formula).toContain('2·a/n');
    });

    it('5. Ausencia de criterio de referencia definido: usa denominador por defecto 360 y reporta fórmula', () => {
      const simpleModel: BeamModel = {
        length: 5.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 5.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 2.5, P: 25.0 }],
        material: { name: 'Acero', E: 200.0 },
        section: { ...defaultSection, deflectionLimitDenominator: undefined },
      };

      const analysis = analyzeBeam(simpleModel);
      const defResult = analysis.mechanics!.deflection;

      expect(defResult.serviceLimitDenominator).toBe(360);
      expect(defResult.allowableDeflectionMm).toBeCloseTo((5000 / 360), 2);
      expect(defResult.referenceCriterionFormula).toContain('360');
    });
  });

  // --------------------------------------------------------------------------
  // 8.9. Auditoría P2.2: Extremos duales de flexión positiva y negativa (BUG-MEC-05)
  // --------------------------------------------------------------------------
  describe('8.9. Auditoría P2.2: Extremos duales de flexión positiva y negativa (BUG-MEC-05)', () => {
    it('Identifica y evalúa simultáneamente el momento positivo en vano y el momento negativo en empotramiento', () => {
      // Viga biempotrada H3 de 8 m con carga uniforme w = 15 kN/m
      // M_empotramiento = -w*L^2/12 = -80.0 kN*m en x = 0 y x = 8 m
      // M_centro = +w*L^2/24 = +40.0 kN*m en x = 4.0 m
      const modelH3: BeamModel = {
        length: 8.0,
        supports: [
          { id: 'A', type: 'fixed', x: 0 },
          { id: 'B', type: 'fixed', x: 8.0 },
        ],
        loads: [{ id: 'W1', type: 'distributed', xStart: 0, xEnd: 8.0, wStart: 15.0, wEnd: 15.0 }],
        material: { name: 'Acero A36', E: 200.0 },
        section: {
          name: 'W10x30',
          type: 'i_shape',
          Iz: 7076.0,
          Wz: 539.0,
          heightMm: 267.0,
          webThicknessMm: 7.6,
          flangeWidthMm: 147.0,
          flangeThicknessMm: 11.2,
          areaCm2: 57.0,
          allowableBendingStressMPa: 150.0,
        },
      };

      const analysis = analyzeBeam(modelH3);
      const bending = analysis.mechanics!.bending;

      expect(bending.status).toBe('calculated');
      // Máximo absoluto global sigue siendo 80.0 kN*m
      expect(bending.maxMomentDemandKNm).toBeCloseTo(80.0, 2);
      expect(bending.actualStressMPa).toBeCloseTo((80.0 * 1000) / 539.0, 2);

      // Extremo positivo
      expect(bending.positiveExtremum).toBeDefined();
      expect(bending.positiveExtremum!.momentKNm).toBeCloseTo(40.0, 2);
      expect(bending.positiveExtremum!.locationM).toBeCloseTo(4.0, 2);
      expect(bending.positiveExtremum!.actualStressMPa).toBeCloseTo((40.0 * 1000) / 539.0, 2);
      expect(bending.positiveExtremum!.extremeFibers.top).toBe('compression');
      expect(bending.positiveExtremum!.extremeFibers.bottom).toBe('tension');

      // Extremo negativo
      expect(bending.negativeExtremum).toBeDefined();
      expect(bending.negativeExtremum!.momentKNm).toBeCloseTo(-80.0, 2);
      expect(bending.negativeExtremum!.actualStressMPa).toBeCloseTo((80.0 * 1000) / 539.0, 2);
      expect(bending.negativeExtremum!.extremeFibers.top).toBe('tension');
      expect(bending.negativeExtremum!.extremeFibers.bottom).toBe('compression');
    });
  });
});
