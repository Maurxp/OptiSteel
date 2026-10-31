import { describe, it, expect } from 'vitest';
import type { BeamModel, SteelProfile } from '../src/types.js';
import { STEEL_PROFILES } from '../src/catalog/steel-profiles.js';
import {
  selectOptimalSteelProfiles,
  evaluateProfile,
  buildCandidateLoads,
  validateSelectionCriteria,
  SteelDesignValidationError,
  STEEL_DESIGN_LIMITATIONS,
  isSelfWeightLoad,
  SELF_WEIGHT_LOAD_ID_PREFIX,
} from '../src/steel-design/index.js';
import { analyzeBeam, StructuralAnalysisError } from '../src/analyzer.js';

describe('OptiSteel 2.0 — Motor de Selección de Perfiles de Acero (Fase 2)', () => {
  // Modelo de referencia: Viga simplemente apoyada L = 6m con carga uniforme w = 15 kN/m
  const simpleBeamModel: BeamModel = {
    length: 6.0,
    supports: [
      { id: 'A', type: 'pin', x: 0 },
      { id: 'B', type: 'roller', x: 6.0 },
    ],
    loads: [
      {
        id: 'w1',
        type: 'distributed',
        xStart: 0,
        xEnd: 6.0,
        wStart: 15.0,
        wEnd: 15.0,
      },
    ],
  };

  // Modelo en voladizo L = 4m con carga puntual en extremo P = 25 kN
  const cantileverModel: BeamModel = {
    length: 4.0,
    supports: [{ id: 'Emp', type: 'fixed', x: 0 }],
    loads: [{ id: 'P1', type: 'point', x: 4.0, P: 25.0 }],
  };

  describe('1. Validación estricta de parámetros de entrada', () => {
    it('Rechaza esfuerzo admisible a flexión no positivo o no finito', () => {
      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: 0,
          deflectionLimitDenominator: 360,
        })
      ).toThrow(SteelDesignValidationError);

      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: -140,
          deflectionLimitDenominator: 360,
        })
      ).toThrow(SteelDesignValidationError);

      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: Number.NaN,
          deflectionLimitDenominator: 360,
        })
      ).toThrow(SteelDesignValidationError);

      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: Number.POSITIVE_INFINITY,
          deflectionLimitDenominator: 360,
        })
      ).toThrow(SteelDesignValidationError);
    });

    it('Rechaza denominador de flecha no positivo o no finito', () => {
      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 0,
        })
      ).toThrow(SteelDesignValidationError);

      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: -360,
        })
      ).toThrow(SteelDesignValidationError);
    });

    it('Rechaza módulo E o cortante admisible no positivos si se especifican', () => {
      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
          elasticModulusGPa: -200,
        })
      ).toThrow(SteelDesignValidationError);

      expect(() =>
        validateSelectionCriteria({
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
          allowableShearStressMPa: 0,
        })
      ).toThrow(SteelDesignValidationError);
    });

    it('Rechaza modelos de viga estructuralmente inválidos o inestables', () => {
      const unstableBeam: BeamModel = {
        length: 5.0,
        supports: [{ id: 'A', type: 'roller', x: 0 }], // Inestable (1 solo rodillo)
        loads: [],
      };

      expect(() =>
        selectOptimalSteelProfiles(unstableBeam, {
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
        })
      ).toThrow(StructuralAnalysisError);
    });
  });

  describe('2. Filtrado por familia de perfil', () => {
    it('Evalúa todos los 76 perfiles cuando profileTypeFilter es "ALL" u omitido', () => {
      const resultAll = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(resultAll.totalEvaluated).toBe(76);
      expect(resultAll.viableCandidates.length + resultAll.disqualifiedCandidates.length).toBe(76);
    });

    it('Filtra estrictamente por familia W (46 perfiles)', () => {
      const resultW = selectOptimalSteelProfiles(simpleBeamModel, {
        profileTypeFilter: 'W',
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(resultW.totalEvaluated).toBe(46);
      for (const c of [...resultW.viableCandidates, ...resultW.disqualifiedCandidates]) {
        expect(c.profile.type).toBe('W');
      }
    });

    it('Filtra estrictamente por familia S (16 perfiles)', () => {
      const resultS = selectOptimalSteelProfiles(simpleBeamModel, {
        profileTypeFilter: 'S',
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(resultS.totalEvaluated).toBe(16);
      for (const c of [...resultS.viableCandidates, ...resultS.disqualifiedCandidates]) {
        expect(c.profile.type).toBe('S');
      }
    });

    it('Filtra estrictamente por familia C (14 perfiles)', () => {
      const resultC = selectOptimalSteelProfiles(simpleBeamModel, {
        profileTypeFilter: 'C',
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(resultC.totalEvaluated).toBe(14);
      for (const c of [...resultC.viableCandidates, ...resultC.disqualifiedCandidates]) {
        expect(c.profile.type).toBe('C');
      }
    });
  });

  describe('3. Determinismo y desempate en el ordenamiento por menor masa', () => {
    it('Ordena los candidatos viables estrictamente por masaKgPerM ascendente', () => {
      const result = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
      });

      expect(result.viableCandidates.length).toBeGreaterThan(0);
      for (let i = 0; i < result.viableCandidates.length - 1; i++) {
        const current = result.viableCandidates[i]!.profile.massKgPerM;
        const next = result.viableCandidates[i + 1]!.profile.massKgPerM;
        expect(current).toBeLessThanOrEqual(next);
      }

      // El perfil óptimo debe ser el primero de la lista viable
      expect(result.optimalProfile).toEqual(result.viableCandidates[0]);
    });

    it('Aplica desempate alfabético determinista por designación ante masas idénticas', () => {
      const mockProfiles: SteelProfile[] = [
        {
          designation: 'PROFILE_B',
          type: 'W',
          massKgPerM: 50.0,
          depthMm: 300,
          webThicknessMm: 8.0,
          ixMillionMm4: 100.0,
          sxThousandMm3: 600.0,
        },
        {
          designation: 'PROFILE_A',
          type: 'W',
          massKgPerM: 50.0,
          depthMm: 300,
          webThicknessMm: 8.0,
          ixMillionMm4: 100.0,
          sxThousandMm3: 600.0,
        },
      ];

      const result = selectOptimalSteelProfiles(
        simpleBeamModel,
        {
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
        },
        mockProfiles
      );

      expect(result.viableCandidates.length).toBe(2);
      expect(result.viableCandidates[0]!.profile.designation).toBe('PROFILE_A');
      expect(result.viableCandidates[1]!.profile.designation).toBe('PROFILE_B');
      expect(result.optimalProfile?.profile.designation).toBe('PROFILE_A');
    });
  });

  describe('4. Integración del peso propio sobre la cinemática real de la viga', () => {
    it('Calcula el peso propio exacto sobre una viga simplemente apoyada', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!;
      expect(profile).toBeDefined();

      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
        gravityAcceleration: 9.81,
      });

      // w_pp = (52.3 * 9.81) / 1000 = 0.513063 kN/m
      expect(evalResult.selfWeightKNPerM).toBeCloseTo(0.5131, 3);

      // Carga total w_tot = 15.0 + 0.513063 = 15.513063 kN/m
      // Momento central exacto M = w * L^2 / 8 = 15.513063 * 36 / 8 = 69.8088 kN*m
      expect(evalResult.bending.maxMomentDemandKNm).toBeCloseTo(69.8088, 2);

      // Cortante de apoyo V = w * L / 2 = 15.513063 * 6 / 2 = 46.5392 kN
      expect(evalResult.shear.maxShearDemandKN).toBeCloseTo(46.5392, 2);
    });

    it('Calcula el peso propio exacto sobre un voladizo (no usa erróneamente w*L^2/8)', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W200x27')!;
      expect(profile).toBeDefined();

      const evalResult = evaluateProfile(profile, cantileverModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 300,
        gravityAcceleration: 9.81,
      });

      // w_pp = (26.6 * 9.81) / 1000 = 0.260946 kN/m
      // Momento en empotramiento x=0:
      // M_ext = P * L = 25 * 4 = 100 kN*m
      // M_pp = w_pp * L^2 / 2 = 0.260946 * 16 / 2 = 2.08757 kN*m
      // M_total = 102.0876 kN*m
      // Si usara la fórmula errónea del legacy w*L^2/8 daría 0.52 kN*m (4 veces menos)
      expect(evalResult.bending.maxMomentDemandKNm).toBeCloseTo(102.0876, 2);

      // Cortante en empotramiento:
      // V_total = P + w_pp * L = 25 + (0.260946 * 4) = 26.0438 kN
      expect(evalResult.shear.maxShearDemandKN).toBeCloseTo(26.0438, 2);
    });

    it('Permite omitir el peso propio si includeSelfWeight es false', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W200x27')!;
      const evalResultNoSW = evaluateProfile(profile, cantileverModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 300,
        includeSelfWeight: false,
      });

      expect(evalResultNoSW.selfWeightKNPerM).toBe(0);
      expect(evalResultNoSW.bending.maxMomentDemandKNm).toBeCloseTo(100.0, 3);
      expect(evalResultNoSW.shear.maxShearDemandKN).toBeCloseTo(25.0, 3);
    });

    it('Rechaza modelos que ya contengan cargas identificadas como peso propio por ID cuando includeSelfWeight está activo', () => {
      const beamWithSW: BeamModel = {
        ...simpleBeamModel,
        loads: [
          ...simpleBeamModel.loads,
          {
            id: 'self-weight-preexisting',
            type: 'distributed',
            xStart: 0,
            xEnd: 6.0,
            wStart: 0.5,
            wEnd: 0.5,
          },
        ],
      };

      expect(() =>
        selectOptimalSteelProfiles(beamWithSW, {
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        })
      ).toThrow(SteelDesignValidationError);

      const profile = STEEL_PROFILES[0]!;
      expect(() =>
        evaluateProfile(profile, beamWithSW, {
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        })
      ).toThrow(SteelDesignValidationError);
    });

    it('Rechaza modelos que ya contengan cargas identificadas como peso propio por etiqueta ambigua cuando includeSelfWeight está activo', () => {
      const beamWithSWLabel: BeamModel = {
        ...simpleBeamModel,
        loads: [
          ...simpleBeamModel.loads,
          {
            id: 'q_dead',
            type: 'distributed',
            xStart: 0,
            xEnd: 6.0,
            wStart: 0.8,
            wEnd: 0.8,
            label: 'Peso propio',
          },
        ],
      };

      expect(() =>
        selectOptimalSteelProfiles(beamWithSWLabel, {
          allowableBendingStressMPa: 140,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        })
      ).toThrow(SteelDesignValidationError);
    });

    it('Conserva intactas las cargas del modelo original cuando includeSelfWeight es false incluso si contienen cargas de peso propio', () => {
      const beamWithSW: BeamModel = {
        ...simpleBeamModel,
        loads: [
          ...simpleBeamModel.loads,
          {
            id: 'self-weight-manual',
            type: 'distributed',
            xStart: 0,
            xEnd: 6.0,
            wStart: 0.5,
            wEnd: 0.5,
          },
        ],
      };

      const result = selectOptimalSteelProfiles(beamWithSW, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
        includeSelfWeight: false,
      });

      expect(result.viableCandidates.length).toBeGreaterThan(0);
      for (const candidate of result.viableCandidates) {
        expect(candidate.selfWeightKNPerM).toBe(0);
      }
    });

    it('Garantiza que el modelo original baseModel no sufre mutaciones en sus cargas ni propiedades', () => {
      const originalLoadsCount = simpleBeamModel.loads.length;
      const originalFirstLoad = { ...simpleBeamModel.loads[0] };

      selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
        includeSelfWeight: true,
      });

      expect(simpleBeamModel.loads.length).toBe(originalLoadsCount);
      expect(simpleBeamModel.loads[0]).toEqual(originalFirstLoad);
    });
  });

  describe('5. Comprobaciones de flexión, deflexión y estados explícitos', () => {
    it('Evalúa flexión con coherencia dimensional estricta (sigma = M * 1000 / Sx)', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!; // Sx = 747 (10^3 mm^3)
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      const expectedStress = (evalResult.bending.maxMomentDemandKNm * 1000) / profile.sxThousandMm3;
      expect(evalResult.bending.actualStressMPa).toBeCloseTo(expectedStress, 2);
      expect(evalResult.bending.status).toBe('passed');
      expect(evalResult.bending.utilizationRatio).toBeLessThan(1.0);
    });

    it('Descalifica candidatos que no cumplen flexión con mensaje explícito', () => {
      const smallProfile = STEEL_PROFILES.find((p) => p.designation === 'W150x14')!; // Sx = 91.5
      const evalResult = evaluateProfile(smallProfile, simpleBeamModel, {
        allowableBendingStressMPa: 100, // Límite exigente
        deflectionLimitDenominator: 200,
      });

      expect(evalResult.bending.status).toBe('failed');
      expect(evalResult.isViable).toBe(false);
      expect(evalResult.failureReasons.some((r) => r.includes('flexión'))).toBe(true);
    });

    it('Descalifica candidatos que no cumplen deflexión elástica usando el solucionador real de Euler-Bernoulli', () => {
      // Viga de 8m con carga puntual alta: deflexión superará L/480
      const longBeam: BeamModel = {
        length: 8.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 8.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 4.0, P: 80.0 }],
      };

      const flexibleProfile = STEEL_PROFILES.find((p) => p.designation === 'W200x15')!;
      const evalResult = evaluateProfile(flexibleProfile, longBeam, {
        allowableBendingStressMPa: 300, // No falla por flexión
        deflectionLimitDenominator: 480, // Límite estricto L/480 = 8000/480 = 16.67 mm
      });

      expect(evalResult.deflection.status).toBe('failed');
      expect(evalResult.isViable).toBe(false);
      expect(evalResult.failureReasons.some((r) => r.includes('Deflexión'))).toBe(true);
      expect(evalResult.deflection.maxDeflectionDemandMm).toBeGreaterThan(evalResult.deflection.allowableDeflectionMm);
    });

    it('Informa cortante como "not_evaluated" si no se proporciona allowableShearStressMPa', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!;
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(evalResult.shear.status).toBe('not_evaluated');
      expect(evalResult.shear.actualShearStressMPa).toBeGreaterThan(0);
      expect(evalResult.shear.note).toContain('No evaluado formalmente');
    });

    it('Evalúa cortante como "passed" o "failed" si se proporciona allowableShearStressMPa', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!;
      const evalPass = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
        allowableShearStressMPa: 100, // Amplio
      });
      expect(evalPass.shear.status).toBe('passed');

      const evalFail = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
        allowableShearStressMPa: 1.0, // Muy bajo para forzar fallo
      });
      expect(evalFail.shear.status).toBe('failed');
      expect(evalFail.isViable).toBe(false);
      expect(evalFail.failureReasons.some((r) => r.includes('cortante'))).toBe(true);
    });

    it('Deriva dinámicamente allChecksEvaluated como false cuando cortante no está evaluado', () => {
      const profile = STEEL_PROFILES[0]!;
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(evalResult.shear.status).toBe('not_evaluated');
      expect(evalResult.allChecksEvaluated).toBe(false);
    });

    it('Expone las limitaciones técnicas y supuestos de ingeniería en el resultado global', () => {
      const result = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(result.limitations).toBe(STEEL_DESIGN_LIMITATIONS);
      expect(result.limitations.length).toBeGreaterThanOrEqual(3);
      expect(result.limitations.some((l) => l.includes('arriostramiento lateral'))).toBe(true);
    });

    it('Maneja de forma segura casos extremos donde ningún perfil cumple', () => {
      // Carga destructiva de 5000 kN en viga de 15m
      const extremeBeam: BeamModel = {
        length: 15.0,
        supports: [
          { id: 'A', type: 'pin', x: 0 },
          { id: 'B', type: 'roller', x: 15.0 },
        ],
        loads: [{ id: 'Extr', type: 'point', x: 7.5, P: 5000.0 }],
      };

      const result = selectOptimalSteelProfiles(extremeBeam, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 480,
      });

      expect(result.optimalProfile).toBeUndefined();
      expect(result.viableCandidates.length).toBe(0);
      expect(result.disqualifiedCandidates.length).toBe(76);
    });

    it('Asigna designScope "preliminary_elastic" y deriva dinámicamente allChecksEvaluated como false cuando cortante no está evaluado', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!;
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(evalResult.designScope).toBe('preliminary_elastic');
      // Shear is not_evaluated (allowableShearStressMPa omitted)
      expect(evalResult.shear.status).toBe('not_evaluated');
      expect(evalResult.allChecksEvaluated).toBe(false);
    });

    it('Distingue con claridad entre viabilidad preliminar y estado allChecksEvaluated según se suministre cortante admisible', () => {
      const resultWithShear = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        allowableShearStressMPa: 100, // shear evaluated and passed
      });

      expect(resultWithShear.optimalProfile).toBeDefined();
      const optWithShear = resultWithShear.optimalProfile!;
      // Passes evaluated checks (bending, deflection, shear)
      expect(optWithShear.isViable).toBe(true);
      expect(optWithShear.bending.status).toBe('passed');
      expect(optWithShear.deflection.status).toBe('passed');
      expect(optWithShear.shear.status).toBe('passed');
      expect(optWithShear.allChecksEvaluated).toBe(true);

      const resultWithoutShear = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
      });
      const optWithoutShear = resultWithoutShear.optimalProfile!;
      expect(optWithoutShear.isViable).toBe(true);
      expect(optWithoutShear.shear.status).toBe('not_evaluated');
      expect(optWithoutShear.allChecksEvaluated).toBe(false);
    });

    it('isSelfWeightLoad detecta de forma fiable identificadores y etiquetas de peso propio y no confunde cargas externas legítimas', () => {
      expect(
        isSelfWeightLoad({
          id: 'self-weight-W200x27',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 1,
          wEnd: 1,
        })
      ).toBe(true);
      expect(
        isSelfWeightLoad({
          id: 'self-weight',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 1,
          wEnd: 1,
        })
      ).toBe(true);
      expect(
        isSelfWeightLoad({
          id: 'SW_1',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 1,
          wEnd: 1,
          label: 'Peso propio',
        })
      ).toBe(true);
      expect(
        isSelfWeightLoad({
          id: 'SW_2',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 1,
          wEnd: 1,
          label: 'self-weight',
        })
      ).toBe(true);

      // Cargas externas legítimas NO deben ser marcadas como peso propio
      expect(
        isSelfWeightLoad({
          id: 'q_dead_tiles',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 2,
          wEnd: 2,
          label: 'Acabados de piso',
        })
      ).toBe(false);
      expect(
        isSelfWeightLoad({
          id: 'q_live',
          type: 'distributed',
          xStart: 0,
          xEnd: 6,
          wStart: 3,
          wEnd: 3,
          label: 'Carga viva de oficina',
        })
      ).toBe(false);
    });
  });

  describe('6. Garantía de inmutabilidad del catálogo fuente', () => {
    it('No modifica ningún perfil ni propiedad del catálogo original tras la ejecución', () => {
      const originalCount = STEEL_PROFILES.length;
      const firstProfile = { ...STEEL_PROFILES[0] };

      selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(STEEL_PROFILES.length).toBe(originalCount);
      expect(STEEL_PROFILES[0]).toEqual(firstProfile);
    });
  });

  describe('7. Regresiones P2.1: Interacción de peso propio con H4 y geometría física (BUG-01 y BUG-02)', () => {
    // Modelo H4 canónico de referencia: L = 12 m (2 vanos de 6 m), carga uniforme continua w = 10 kN/m
    const canonicalH4Model: BeamModel = {
      id: 'H4-canonical-selector',
      length: 12.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0.0, label: 'A' },
        { id: 'S2', type: 'roller', x: 6.0, label: 'B' },
        { id: 'S3', type: 'roller', x: 12.0, label: 'C' },
      ],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0.0,
          xEnd: 12.0,
          wStart: 10.0,
          wEnd: 10.0,
          label: 'Carga uniforme de servicio',
        },
      ],
      material: { name: 'Acero Estructural', E: 200.0 },
      section: { name: 'Sección tentativa', Iz: 5000.0 },
    };

    it('BUG-01 (1): Modelo H4 canónico con includeSelfWeight: true selecciona perfil óptimo sin ser rechazado por intensidades diferentes', () => {
      const result = selectOptimalSteelProfiles(canonicalH4Model, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        includeSelfWeight: true,
      });

      expect(result.optimalProfile).toBeDefined();
      expect(result.viableCandidates.length).toBeGreaterThan(0);

      const optimal = result.optimalProfile!;
      // El perfil óptimo debe tener peso propio calculado > 0
      expect(optimal.selfWeightKNPerM).toBeGreaterThan(0);
      expect(optimal.isViable).toBe(true);
      expect(optimal.bending.status).toBe('passed');
      expect(optimal.deflection.status).toBe('passed');

      // Verificación rigurosa de flexión para un perfil concreto (W310x28):
      // W310x28: mass = 28.4 kg/m => sw = 28.4 * 9.80665 / 1000 = 0.27850886 kN/m
      // Carga total combinada w_total = 10 + 0.27850886 = 10.27850886 kN/m
      // Momento máximo en apoyo central B (L_span = 6 m):
      // |M_B| = w_total * L_span^2 / 8 = 10.27850886 * 36 / 8 = 46.25329 kN*m
      const w310x28 = STEEL_PROFILES.find((p) => p.designation === 'W310x28')!;
      const evalW310x28 = evaluateProfile(w310x28, canonicalH4Model, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        includeSelfWeight: true,
      });

      expect(evalW310x28.selfWeightKNPerM).toBeCloseTo(0.2785, 4);
      expect(evalW310x28.bending.maxMomentDemandKNm).toBeCloseTo(46.2533, 3);
      // sigma = (46.2533 * 1000) / 351 = 131.78 MPa <= 150 MPa
      expect(evalW310x28.bending.actualStressMPa).toBeCloseTo(131.78, 1);
      expect(evalW310x28.bending.status).toBe('passed');
      expect(evalW310x28.isViable).toBe(true);
    });

    it('BUG-01 (2): Modelo H4 sin peso propio (includeSelfWeight: false) conserva exactamente el comportamiento anterior', () => {
      const resultNoSW = selectOptimalSteelProfiles(canonicalH4Model, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        includeSelfWeight: false,
      });

      expect(resultNoSW.optimalProfile).toBeDefined();
      const optimal = resultNoSW.optimalProfile!;
      expect(optimal.selfWeightKNPerM).toBe(0);

      // Verificación con W310x28 sin peso propio: w = 10 kN/m puro
      // |M_B| = 10 * 36 / 8 = 45.0 kN*m
      // sigma = (45.0 * 1000) / 351 = 128.21 MPa
      const w310x28 = STEEL_PROFILES.find((p) => p.designation === 'W310x28')!;
      const evalW310x28 = evaluateProfile(w310x28, canonicalH4Model, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        includeSelfWeight: false,
      });

      expect(evalW310x28.selfWeightKNPerM).toBe(0);
      expect(evalW310x28.bending.maxMomentDemandKNm).toBeCloseTo(45.0, 4);
      expect(evalW310x28.bending.actualStressMPa).toBeCloseTo(128.21, 1);
      expect(evalW310x28.isViable).toBe(true);
    });

    it('BUG-02 (3 & 4 & 5): Viga isostática con apoyos desplazados y voladizos físicos aplica peso propio en [0, L] y verifica equilibrio y esfuerzos exactos', () => {
      // Viga física de L = 10 m, apoyos en x = 2 m (A) y x = 8 m (B)
      // Voladizo izquierdo: [0, 2] (longitud 2 m)
      // Vano entre apoyos: [2, 8] (longitud 6 m)
      // Voladizo derecho: [8, 10] (longitud 2 m)
      // Carga puntual externa en el centro del vano: P = 40 kN en x = 5 m
      const overhangBeamModel: BeamModel = {
        id: 'isostatic-overhang-beam',
        length: 10.0,
        supports: [
          { id: 'A', type: 'pin', x: 2.0, label: 'Apoyo A' },
          { id: 'B', type: 'roller', x: 8.0, label: 'Apoyo B' },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 5.0, P: 40.0, label: 'Carga central' },
        ],
        material: { name: 'Acero Estructural', E: 200.0 },
        section: { name: 'Sección tentativa', Iz: 5000.0 },
      };

      const w310x28 = STEEL_PROFILES.find((p) => p.designation === 'W310x28')!;
      const gravity = 9.80665;
      const sw = (w310x28.massKgPerM * gravity) / 1000; // 0.27850886 kN/m

      // 1. Verificar dominio de aplicación en buildCandidateLoads:
      const candidateLoads = buildCandidateLoads(
        overhangBeamModel.loads,
        overhangBeamModel.length,
        sw,
        w310x28.designation
      );
      // Debe contener la carga puntual original y la carga de peso propio sobre [0, 10]
      expect(candidateLoads.length).toBe(2);
      const swLoad = candidateLoads.find((l) => l.type === 'distributed') as any;
      expect(swLoad).toBeDefined();
      expect(swLoad.xStart).toBe(0);
      expect(swLoad.xEnd).toBe(10.0);
      expect(swLoad.wStart).toBeCloseTo(sw, 6);
      expect(swLoad.wEnd).toBeCloseTo(sw, 6);

      // 2. Verificar análisis estructural directo (reacciones, equilibrio, momentos, flechas):
      const candidateModel: BeamModel = {
        ...overhangBeamModel,
        loads: candidateLoads,
        section: {
          name: w310x28.designation,
          Iz: w310x28.ixMillionMm4 * 100,
          Wz: w310x28.sxThousandMm3,
        },
      };

      const analysis = analyzeBeam(candidateModel);

      // Equilibrio estático global:
      expect(analysis.equilibrium.isBalanced).toBe(true);
      expect(analysis.equilibrium.sumFy).toBeCloseTo(0, 5);
      expect(analysis.equilibrium.sumM).toBeCloseTo(0, 5);

      // Reacciones teóricas exactas:
      // F_total = 40 + 10 * sw = 42.7850886 kN
      // Por simetría perfecta: R_A = R_B = 20 + 5 * sw = 21.3925443 kN
      const expectedReaction = 20.0 + 5.0 * sw;
      const rA = analysis.reactions.find((r) => r.supportId === 'A')!;
      const rB = analysis.reactions.find((r) => r.supportId === 'B')!;
      expect(rA.Ry).toBeCloseTo(expectedReaction, 4);
      expect(rB.Ry).toBeCloseTo(expectedReaction, 4);

      // Momento en apoyos x = 2 m y x = 8 m (originado exclusivamente por el peso del voladizo exterior de 2 m):
      // M(2) = - sw * 2^2 / 2 = -2 * sw = -0.557018 kN*m
      // Si se hubiera recortado erróneamente el peso propio a [2, 8], M(2) sería 0.
      const mAt2 = analysis.moment.criticalPoints.find(
        (p) => Math.abs(p.x - 2.0) < 1e-4
      );
      expect(mAt2).toBeDefined();
      expect(mAt2!.value).toBeCloseTo(-2.0 * sw, 4);

      // Momento en centro de vano x = 5 m:
      // M(5) = R_A * 3 - sw * 5^2 / 2 = (20 + 5*sw)*3 - 12.5*sw = 60 + 2.5*sw = 60.69627 kN*m
      // Demanda máxima de momento = 60.6963 kN*m
      const expectedMaxMoment = 60.0 + 2.5 * sw;
      const actualMaxMoment = Math.max(
        Math.abs(analysis.moment.maxPositive.value),
        Math.abs(analysis.moment.maxNegative.value)
      );
      expect(actualMaxMoment).toBeCloseTo(expectedMaxMoment, 4);

      // 3. Verificación de evaluación de perfil a través del selector:
      const evalProfile = evaluateProfile(w310x28, overhangBeamModel, {
        allowableBendingStressMPa: 180,
        deflectionLimitDenominator: 360,
        includeSelfWeight: true,
      });

      expect(evalProfile.bending.maxMomentDemandKNm).toBeCloseTo(expectedMaxMoment, 3);
      // sigma = 60.6963 * 1000 / 351 = 172.92 MPa <= 180 MPa
      expect(evalProfile.bending.actualStressMPa).toBeCloseTo(172.92, 1);
      expect(evalProfile.bending.status).toBe('passed');
      expect(evalProfile.deflection.status).toBe('passed');
      expect(evalProfile.isViable).toBe(true);
    });

    it('BUG-02 (6): Rechazo explícito controlado cuando el modelo con voladizos excede el alcance del solver hiperestático', () => {
      // 6a. Caso H4 con apoyos desplazados y voladizos físicos exteriores:
      // Viga L = 16 m, apoyos en x = 2, 8, 14 m (voladizos en [0, 2] y [14, 16])
      // Al activar includeSelfWeight, el peso propio se aplica sobre [0, 16] m.
      // Como H4 no soporta voladizos exteriores con carga, debe ser explícitamente rechazado.
      const h4OverhangModel: BeamModel = {
        id: 'H4-with-exterior-overhangs',
        length: 16.0,
        supports: [
          { id: 'S1', type: 'pin', x: 2.0 },
          { id: 'S2', type: 'roller', x: 8.0 },
          { id: 'S3', type: 'roller', x: 14.0 },
        ],
        loads: [
          { id: 'W1', type: 'distributed', xStart: 2.0, xEnd: 14.0, wStart: 10.0, wEnd: 10.0 },
        ],
        material: { name: 'Acero Estructural', E: 200.0 },
        section: { name: 'Sección tentativa', Iz: 5000.0 },
      };

      expect(() =>
        selectOptimalSteelProfiles(h4OverhangModel, {
          allowableBendingStressMPa: 150,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        })
      ).toThrow(StructuralAnalysisError);

      try {
        selectOptimalSteelProfiles(h4OverhangModel, {
          allowableBendingStressMPa: 150,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        });
      } catch (err) {
        expect((err as StructuralAnalysisError).errors.some((e) => e.includes('voladizo exterior'))).toBe(true);
      }

      // 6b. Caso H1 con apoyos desplazados y voladizos físicos exteriores:
      // Viga L = 6 m, empotramiento en x = 1 m, apoyo simple en x = 5 m (voladizos en [0, 1] y [5, 6])
      const h1OverhangModel: BeamModel = {
        id: 'H1-with-exterior-overhangs',
        length: 6.0,
        supports: [
          { id: 'S1', type: 'fixed', x: 1.0 },
          { id: 'S2', type: 'roller', x: 5.0 },
        ],
        loads: [{ id: 'P1', type: 'point', x: 3.0, P: 20.0 }],
        material: { name: 'Acero Estructural', E: 200.0 },
        section: { name: 'Sección tentativa', Iz: 5000.0 },
      };

      expect(() =>
        selectOptimalSteelProfiles(h1OverhangModel, {
          allowableBendingStressMPa: 150,
          deflectionLimitDenominator: 360,
          includeSelfWeight: true,
        })
      ).toThrow(StructuralAnalysisError);
    });

    it('7. Desempate determinista por designación alfabética ante perfiles de masa idéntica', () => {
      // Creamos dos perfiles artificiales con idéntica masa (50.0 kg/m) pero designaciones distintas
      const profileZ: SteelProfile = {
        designation: 'W_ZETA_50',
        type: 'W',
        massKgPerM: 50.0,
        depthMm: 300,
        webThicknessMm: 10,
        ixMillionMm4: 150,
        sxThousandMm3: 1000,
      };

      const profileA: SteelProfile = {
        designation: 'W_ALPHA_50',
        type: 'W',
        massKgPerM: 50.0,
        depthMm: 300,
        webThicknessMm: 10,
        ixMillionMm4: 150,
        sxThousandMm3: 1000,
      };

      // Ambos perfiles pasan holgadamente los criterios
      const result = selectOptimalSteelProfiles(
        simpleBeamModel,
        {
          allowableBendingStressMPa: 200,
          deflectionLimitDenominator: 360,
          includeSelfWeight: false,
        },
        [profileZ, profileA] // Pasados deliberadamente en orden inverso
      );

      expect(result.viableCandidates.length).toBe(2);
      expect(result.optimalProfile).toBeDefined();
      // 'W_ALPHA_50' debe anteceder a 'W_ZETA_50' por orden alfabético
      expect(result.optimalProfile!.profile.designation).toBe('W_ALPHA_50');
      expect(result.viableCandidates[0]!.profile.designation).toBe('W_ALPHA_50');
      expect(result.viableCandidates[1]!.profile.designation).toBe('W_ZETA_50');
    });
  });
});
