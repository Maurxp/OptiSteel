import { describe, it, expect } from 'vitest';
import type { BeamModel, SteelProfile } from '../src/types.js';
import { STEEL_PROFILES } from '../src/catalog/steel-profiles.js';
import {
  selectOptimalSteelProfiles,
  evaluateProfile,
  validateSelectionCriteria,
  SteelDesignValidationError,
  STEEL_DESIGN_LIMITATIONS,
  isSelfWeightLoad,
  SELF_WEIGHT_LOAD_ID_PREFIX,
} from '../src/steel-design/index.js';
import { StructuralAnalysisError } from '../src/analyzer.js';

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

    it('Declara siempre LTB como "not_evaluated" con justificación técnica explícita', () => {
      const profile = STEEL_PROFILES[0]!;
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(evalResult.ltb.status).toBe('not_evaluated');
      expect(evalResult.ltb.reason).toContain('El catálogo no contiene bf, tf, ry, J ni Cw');
    });

    it('Expone las limitaciones técnicas y supuestos de ingeniería en el resultado global', () => {
      const result = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(result.limitations).toBe(STEEL_DESIGN_LIMITATIONS);
      expect(result.limitations.length).toBeGreaterThanOrEqual(4);
      expect(result.limitations.some((l) => l.includes('pandeo lateral-torsional'))).toBe(true);
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

    it('Asigna designScope "preliminary_elastic" y deriva dinámicamente allChecksEvaluated como false cuando LTB o cortante no están evaluados', () => {
      const profile = STEEL_PROFILES.find((p) => p.designation === 'W310x52')!;
      const evalResult = evaluateProfile(profile, simpleBeamModel, {
        allowableBendingStressMPa: 140,
        deflectionLimitDenominator: 360,
      });

      expect(evalResult.designScope).toBe('preliminary_elastic');
      // LTB is not_evaluated, and shear is not_evaluated (allowableShearStressMPa omitted)
      expect(evalResult.ltb.status).toBe('not_evaluated');
      expect(evalResult.shear.status).toBe('not_evaluated');
      expect(evalResult.allChecksEvaluated).toBe(false);
    });

    it('Distingue con claridad entre viabilidad preliminar (isViable: true) y verificación integral (allChecksEvaluated: false)', () => {
      const result = selectOptimalSteelProfiles(simpleBeamModel, {
        allowableBendingStressMPa: 150,
        deflectionLimitDenominator: 360,
        allowableShearStressMPa: 100, // shear evaluated and passed
      });

      expect(result.optimalProfile).toBeDefined();
      const opt = result.optimalProfile!;
      // Passes evaluated checks (bending, deflection, shear)
      expect(opt.isViable).toBe(true);
      expect(opt.bending.status).toBe('passed');
      expect(opt.deflection.status).toBe('passed');
      expect(opt.shear.status).toBe('passed');
      // But LTB is still not_evaluated due to catalog geometric limitations
      expect(opt.ltb.status).toBe('not_evaluated');
      expect(opt.allChecksEvaluated).toBe(false);
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
});
