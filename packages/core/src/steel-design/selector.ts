import type { BeamModel, DeflectionAnalysis, Load, SteelProfile } from '../types.js';
import { STEEL_PROFILES, getProfilesByType } from '../catalog/steel-profiles.js';
import { analyzeBeam, StructuralAnalysisError } from '../analyzer.js';
import { validateBeamModel } from '../validator.js';
import type {
  BendingCheckResult,
  DeflectionCheckResult,
  LtbCheckResult,
  ShearCheckResult,
  SteelCandidateEvaluation,
  SteelDesignScope,
  SteelSelectionCriteria,
  SteelSelectionResult,
} from './types.js';

export const STEEL_DESIGN_LIMITATIONS: readonly string[] = [
  'La verificación de flexión se basa en la teoría elástica de vigas (sigma = |M_max| / Sx) y asume que el patín comprimido cuenta con arriostramiento lateral continuo (Lb <= Lp).',
  'El catálogo canónico (Pytel & Singer Tabla B-2) no contiene dimensiones de patines (bf, tf), radios de giro menores (ry) ni constantes torsionales (J, Cw), por lo que el pandeo lateral-torsional (LTB) no puede ser evaluado analíticamente.',
  'La evaluación de cortante calcula el esfuerzo cortante medio en el alma (tau = |V_max| / (d * tw)). No constituye una verificación exhaustiva según AISC 360 Capítulo G, ya que no se evalúa el pandeo local del alma (h / tw frente a 2.24*sqrt(E/Fy)).',
  'Los límites de deflexión (L/n) corresponden a criterios de servicio elásticos. Las etiquetas normativas usuales (AISC DG-3, NSR-10, IBC) son orientativas y no certifican cumplimiento normativo pleno sin el concurso de combinaciones de carga separadas (cargas muertas D frente a cargas vivas L).',
] as const;

export const SELF_WEIGHT_LOAD_ID_PREFIX = 'self-weight';

/**
 * Detects whether a load appears to be an existing self-weight load.
 * Matches loads whose ID starts with 'self-weight' (case-insensitive) or contains 'self_weight' / 'peso_propio',
 * or whose label explicitly and unambiguously denotes self-weight / peso propio.
 */
export function isSelfWeightLoad(load: Load): boolean {
  const idLower = load.id?.toLowerCase().trim() ?? '';
  if (
    idLower.startsWith(SELF_WEIGHT_LOAD_ID_PREFIX) ||
    idLower.includes('self_weight') ||
    idLower.includes('peso_propio') ||
    idLower.includes('pesopropio')
  ) {
    return true;
  }
  const labelLower = load.label?.toLowerCase().trim() ?? '';
  if (
    labelLower === 'peso propio' ||
    labelLower.startsWith('peso propio (') ||
    labelLower === 'self-weight' ||
    labelLower.startsWith('self-weight (')
  ) {
    return true;
  }
  return false;
}

export class SteelDesignValidationError extends Error {
  public readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'SteelDesignValidationError';
    this.field = field;
  }
}

/**
 * Validates the input selection criteria ensuring strictly positive and finite numbers.
 */
export function validateSelectionCriteria(criteria: SteelSelectionCriteria): void {
  if (
    !Number.isFinite(criteria.allowableBendingStressMPa) ||
    criteria.allowableBendingStressMPa <= 0
  ) {
    throw new SteelDesignValidationError(
      `Esfuerzo admisible a flexión inválido (${criteria.allowableBendingStressMPa}). Debe ser un número estrictamente mayor que cero en MPa.`,
      'allowableBendingStressMPa'
    );
  }

  if (
    !Number.isFinite(criteria.deflectionLimitDenominator) ||
    criteria.deflectionLimitDenominator <= 0
  ) {
    throw new SteelDesignValidationError(
      `Denominador de límite de flecha inválido (${criteria.deflectionLimitDenominator}). Debe ser un número estrictamente mayor que cero (ej. 360 para L/360).`,
      'deflectionLimitDenominator'
    );
  }

  if (
    criteria.elasticModulusGPa !== undefined &&
    (!Number.isFinite(criteria.elasticModulusGPa) || criteria.elasticModulusGPa <= 0)
  ) {
    throw new SteelDesignValidationError(
      `Módulo de elasticidad inválido (${criteria.elasticModulusGPa}). Debe ser un número estrictamente mayor que cero en GPa.`,
      'elasticModulusGPa'
    );
  }

  if (
    criteria.allowableShearStressMPa !== undefined &&
    (!Number.isFinite(criteria.allowableShearStressMPa) ||
      criteria.allowableShearStressMPa <= 0)
  ) {
    throw new SteelDesignValidationError(
      `Esfuerzo admisible a cortante inválido (${criteria.allowableShearStressMPa}). Debe ser un número estrictamente mayor que cero en MPa.`,
      'allowableShearStressMPa'
    );
  }

  if (
    criteria.gravityAcceleration !== undefined &&
    (!Number.isFinite(criteria.gravityAcceleration) || criteria.gravityAcceleration <= 0)
  ) {
    throw new SteelDesignValidationError(
      `Aceleración de gravedad inválida (${criteria.gravityAcceleration}). Debe ser un número estrictamente mayor que cero en m/s^2.`,
      'gravityAcceleration'
    );
  }
}

/**
 * Evaluates an individual steel cross-section against a structural beam model and design criteria.
 *
 * Methodological Principles:
 * 1. Self-weight is added directly as a real distributed load over [0, L] on the beam model.
 * 2. Internal forces (M, V) and elastic deflections (y) are solved via the core structural engine `analyzeBeam`.
 * 3. Bending normal stress is computed dimensionally as:
 *      sigma = (|M_max| [kN*m] * 10^6 [N*mm/(kN*m)]) / (Sx [10^3 mm^3] * 10^3 [mm^3/(10^3 mm^3)])
 *            = (|M_max| * 10^3) / Sx  [MPa]
 * 4. Deflection is compared directly against span L / n using the exact Macaulay/Euler-Bernoulli integration.
 * 5. Web shear is computed as average web stress tau = |V_max| * 1000 / (d * tw) [MPa].
 * 6. LTB is explicitly marked as not evaluated due to catalog geometric data limitations.
 */
export function evaluateProfile(
  profile: SteelProfile,
  baseModel: BeamModel,
  criteria: SteelSelectionCriteria
): SteelCandidateEvaluation {
  const gravity = criteria.gravityAcceleration ?? 9.80665;
  const includeSelfWeight = criteria.includeSelfWeight !== false;

  // Prevent double-counting if the incoming model already contains a self-weight load
  if (includeSelfWeight) {
    const conflictingLoad = baseModel.loads.find(isSelfWeightLoad);
    if (conflictingLoad) {
      throw new SteelDesignValidationError(
        `Conflicto de peso propio preexistente detectado en la carga '${conflictingLoad.id}'` +
        `${conflictingLoad.label ? ` ("${conflictingLoad.label}")` : ''}. ` +
        `El modelo base ya contiene una carga de peso propio. ` +
        `Para evitar duplicaciones: 1) Proporcione un modelo base sin cargas de peso propio para que el selector lo calcule y añada automáticamente, o 2) Configure includeSelfWeight: false para conservar las cargas originales del modelo sin alteraciones.`,
        'includeSelfWeight'
      );
    }
  }

  const selfWeightKNPerM = includeSelfWeight ? (profile.massKgPerM * gravity) / 1000 : 0;

  // Build candidate model with candidate's inertia, modulus, and optional self-weight load
  const candidateLoads: Load[] = [...baseModel.loads];
  if (selfWeightKNPerM > 0) {
    candidateLoads.push({
      id: `self-weight-${profile.designation}`,
      type: 'distributed',
      xStart: 0,
      xEnd: baseModel.length,
      wStart: selfWeightKNPerM,
      wEnd: selfWeightKNPerM,
      label: `Peso propio (${profile.designation})`,
    });
  }

  const candidateModel: BeamModel = {
    ...baseModel,
    loads: candidateLoads,
    material: {
      name: 'Acero Estructural',
      E: criteria.elasticModulusGPa ?? 200,
    },
    section: {
      name: profile.designation,
      Iz: profile.ixMillionMm4 * 100, // 10^6 mm^4 = 100 cm^4
      Wz: profile.sxThousandMm3,     // 10^3 mm^3 = 1 cm^3
    },
  };

  // Run the core structural analyzer
  const analysis = analyzeBeam(candidateModel);

  // Maximum bending moment demand in kN*m
  const maxMomentKNm = Math.max(
    Math.abs(analysis.moment.maxPositive.value),
    Math.abs(analysis.moment.maxNegative.value)
  );

  // Maximum shear force demand in kN
  const maxShearKN = Math.max(
    Math.abs(analysis.shear.maxPositive.value),
    Math.abs(analysis.shear.maxNegative.value)
  );

  // Deflection analysis results from core
  const deflectionAnalysis = analysis.deflection as DeflectionAnalysis;
  const maxDeflectionMm = deflectionAnalysis.maxAbsolute.value * 1000;
  const flexuralRigidityEIKNm2 = deflectionAnalysis.EI;

  const failureReasons: string[] = [];

  // --- 1. Flexural Bending Stress Check ---
  // sigma = (|M_max| * 1000) / Sx in MPa
  const actualStressMPa = (maxMomentKNm * 1000) / profile.sxThousandMm3;
  const allowableStressMPa = criteria.allowableBendingStressMPa;
  const bendingUtilizationRatio = actualStressMPa / allowableStressMPa;
  const passesBending = actualStressMPa <= allowableStressMPa;

  let bendingFailureReason: string | undefined;
  if (!passesBending) {
    bendingFailureReason = `Esfuerzo real a flexión (${actualStressMPa.toFixed(1)} MPa) excede el admisible (${allowableStressMPa.toFixed(1)} MPa). Uso: ${(bendingUtilizationRatio * 100).toFixed(1)}%`;
    failureReasons.push(bendingFailureReason);
  }

  const bending: BendingCheckResult = {
    status: passesBending ? 'passed' : 'failed',
    maxMomentDemandKNm: Number(maxMomentKNm.toFixed(4)),
    sxThousandMm3: profile.sxThousandMm3,
    actualStressMPa: Number(actualStressMPa.toFixed(2)),
    allowableStressMPa,
    utilizationRatio: Number(bendingUtilizationRatio.toFixed(4)),
    ...(bendingFailureReason ? { failureReason: bendingFailureReason } : {}),
  };

  // --- 2. Deflection Serviceability Check ---
  const spanLengthM = baseModel.length;
  const limitRatioDenominator = criteria.deflectionLimitDenominator;
  const allowableDeflectionMm = (spanLengthM * 1000) / limitRatioDenominator;
  const deflectionUtilizationRatio = maxDeflectionMm / allowableDeflectionMm;
  const passesDeflection = maxDeflectionMm <= allowableDeflectionMm;

  let deflectionFailureReason: string | undefined;
  if (!passesDeflection) {
    deflectionFailureReason = `Deflexión elástica máxima (${maxDeflectionMm.toFixed(2)} mm) excede el límite L/${limitRatioDenominator} (${allowableDeflectionMm.toFixed(2)} mm). Uso: ${(deflectionUtilizationRatio * 100).toFixed(1)}%`;
    failureReasons.push(deflectionFailureReason);
  }

  const deflection: DeflectionCheckResult = {
    status: passesDeflection ? 'passed' : 'failed',
    maxDeflectionDemandMm: Number(maxDeflectionMm.toFixed(3)),
    spanLengthM,
    limitRatioDenominator,
    allowableDeflectionMm: Number(allowableDeflectionMm.toFixed(3)),
    utilizationRatio: Number(deflectionUtilizationRatio.toFixed(4)),
    flexuralRigidityEIKNm2: Number(flexuralRigidityEIKNm2.toFixed(1)),
    ...(deflectionFailureReason ? { failureReason: deflectionFailureReason } : {}),
  };

  // --- 3. Web Shear Stress Check ---
  const webAreaMm2 = profile.depthMm * profile.webThicknessMm;
  const actualShearStressMPa = webAreaMm2 > 0 ? (maxShearKN * 1000) / webAreaMm2 : 0;

  let shearStatus: 'passed' | 'failed' | 'not_evaluated' = 'not_evaluated';
  let shearUtilizationRatio: number | undefined;
  let shearFailureReason: string | undefined;

  if (criteria.allowableShearStressMPa !== undefined) {
    shearUtilizationRatio = actualShearStressMPa / criteria.allowableShearStressMPa;
    const passesShear = actualShearStressMPa <= criteria.allowableShearStressMPa;
    shearStatus = passesShear ? 'passed' : 'failed';
    if (!passesShear) {
      shearFailureReason = `Esfuerzo cortante medio en el alma (${actualShearStressMPa.toFixed(1)} MPa) excede el admisible (${criteria.allowableShearStressMPa.toFixed(1)} MPa).`;
      failureReasons.push(shearFailureReason);
    }
  }

  const shear: ShearCheckResult = {
    status: shearStatus,
    maxShearDemandKN: Number(maxShearKN.toFixed(4)),
    webAreaMm2,
    actualShearStressMPa: Number(actualShearStressMPa.toFixed(2)),
    ...(criteria.allowableShearStressMPa !== undefined
      ? {
          allowableShearStressMPa: criteria.allowableShearStressMPa,
          utilizationRatio: Number((shearUtilizationRatio ?? 0).toFixed(4)),
        }
      : {}),
    note:
      criteria.allowableShearStressMPa !== undefined
        ? 'Verificación simplificada de cortante medio en alma tau = |V_max| / (d * tw).'
        : 'Cálculo geométrico informativo de cortante medio en alma tau = |V_max| / (d * tw). No evaluado formalmente al no especificarse esfuerzo admisible a cortante.',
    ...(shearFailureReason ? { failureReason: shearFailureReason } : {}),
  };

  // --- 4. Lateral-Torsional Buckling Status ---
  const ltb: LtbCheckResult = {
    status: 'not_evaluated',
    reason:
      'El catálogo no contiene bf, tf, ry, J ni Cw. La comprobación a flexión asume patín comprimido continuamente arriostrado (Lb <= Lp).',
  };

  // --- Scope and Evaluation Completeness ---
  const designScope: SteelDesignScope = 'preliminary_elastic';
  const allChecksEvaluated =
    bending.status !== 'not_evaluated' &&
    deflection.status !== 'not_evaluated' &&
    shear.status !== 'not_evaluated' &&
    ltb.status !== 'not_evaluated';

  // Profile is viable within preliminary elastic scope if it passes bending, deflection, and shear (if evaluated)
  const isViable = passesBending && passesDeflection && shearStatus !== 'failed';

  return {
    profile,
    designScope,
    allChecksEvaluated,
    selfWeightKNPerM: Number(selfWeightKNPerM.toFixed(4)),
    isViable,
    failureReasons,
    bending,
    deflection,
    shear,
    ltb,
  };
}

/**
 * Evaluates candidate steel profiles from the catalog and ranks viable candidates
 * by ascending linear mass (kg/m), applying a deterministic tie-break by designation.
 *
 * @param baseModel Valid isostatic beam model.
 * @param criteria Selection parameters (allowable stress, deflection denominator, etc.).
 * @param customCatalog Optional custom profile array (defaults to canonical STEEL_PROFILES).
 * @returns Complete selection result with optimal profile and ranked lists.
 */
export function selectOptimalSteelProfiles(
  baseModel: BeamModel,
  criteria: SteelSelectionCriteria,
  customCatalog: readonly SteelProfile[] = STEEL_PROFILES
): SteelSelectionResult {
  // 1. Validate inputs
  const validation = validateBeamModel(baseModel);
  if (!validation.isValid) {
    throw new StructuralAnalysisError(
      `Modelo de viga inválido para selección de acero (${validation.classification}):\n- ${validation.errors.join('\n- ')}`,
      validation.errors
    );
  }

  validateSelectionCriteria(criteria);

  // Prevent double-counting self-weight early before pool iteration
  if (criteria.includeSelfWeight !== false) {
    const conflictingLoad = baseModel.loads.find(isSelfWeightLoad);
    if (conflictingLoad) {
      throw new SteelDesignValidationError(
        `Conflicto de peso propio preexistente detectado en la carga '${conflictingLoad.id}'` +
        `${conflictingLoad.label ? ` ("${conflictingLoad.label}")` : ''}. ` +
        `El modelo base ya contiene una carga de peso propio. ` +
        `Para evitar duplicaciones: 1) Proporcione un modelo base sin cargas de peso propio para que el selector lo calcule y añada automáticamente, o 2) Configure includeSelfWeight: false para conservar las cargas originales del modelo sin alteraciones.`,
        'includeSelfWeight'
      );
    }
  }

  // 2. Filter catalog by family
  const filter = criteria.profileTypeFilter ?? 'ALL';
  const pool =
    filter === 'ALL'
      ? customCatalog
      : customCatalog === STEEL_PROFILES
        ? getProfilesByType(filter)
        : customCatalog.filter((p) => p.type === filter);

  // 3. Evaluate each profile
  const evaluations: SteelCandidateEvaluation[] = pool.map((profile) =>
    evaluateProfile(profile, baseModel, criteria)
  );

  // 4. Separate viable and disqualified candidates
  const viableCandidates = evaluations.filter((e) => e.isViable);
  const disqualifiedCandidates = evaluations.filter((e) => !e.isViable);

  // 5. Deterministic sorting of viable candidates:
  // Primary key: massKgPerM ascending (lightest / most economical)
  // Tie-breaker: designation ascending (alphabetical order)
  viableCandidates.sort((a, b) => {
    if (Math.abs(a.profile.massKgPerM - b.profile.massKgPerM) > 1e-6) {
      return a.profile.massKgPerM - b.profile.massKgPerM;
    }
    return a.profile.designation.localeCompare(b.profile.designation);
  });

  const optimalProfile = viableCandidates.length > 0 ? viableCandidates[0] : undefined;

  return {
    optimalProfile,
    viableCandidates,
    disqualifiedCandidates,
    totalEvaluated: pool.length,
    criteria,
    limitations: STEEL_DESIGN_LIMITATIONS,
  };
}
