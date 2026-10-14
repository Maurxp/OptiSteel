import type { SteelProfile, SteelProfileType } from '../types.js';

/**
 * Execution status for an individual structural check.
 * - 'passed': The check was evaluated and the candidate meets the criterion.
 * - 'failed': The check was evaluated and the candidate does not meet the criterion.
 * - 'not_evaluated': The check was omitted or could not be evaluated due to insufficient data or criteria.
 */
export type StructuralCheckStatus = 'passed' | 'failed' | 'not_evaluated';

/**
 * Result of the elastic flexural normal stress check:
 * sigma = |M_max| / Sx <= sigma_adm
 */
export interface BendingCheckResult {
  readonly status: StructuralCheckStatus;
  /** Maximum design bending moment demand in kN*m */
  readonly maxMomentDemandKNm: number;
  /** Strong-axis elastic section modulus Sx in 10^3 mm^3 (cm^3) */
  readonly sxThousandMm3: number;
  /** Actual calculated elastic bending stress in MPa (N/mm^2) */
  readonly actualStressMPa: number;
  /** Allowable bending stress in MPa (N/mm^2) */
  readonly allowableStressMPa: number;
  /** Capacity utilization ratio (actualStress / allowableStress) */
  readonly utilizationRatio: number;
  /** Specific reason if the check failed */
  readonly failureReason?: string | undefined;
}

/**
 * Result of the deflection serviceability check:
 * |y_max| <= L / n
 */
export interface DeflectionCheckResult {
  readonly status: StructuralCheckStatus;
  /** Maximum absolute deflection demand in mm */
  readonly maxDeflectionDemandMm: number;
  /** Span length L in meters */
  readonly spanLengthM: number;
  /** Deflection denominator n for L/n (e.g. 360 for L/360) */
  readonly limitRatioDenominator: number;
  /** Allowable deflection limit in mm (L * 1000 / n) */
  readonly allowableDeflectionMm: number;
  /** Capacity utilization ratio (maxDeflection / allowableDeflection) */
  readonly utilizationRatio: number;
  /** Flexural rigidity EI used in the deflection calculation in kN*m^2 */
  readonly flexuralRigidityEIKNm2: number;
  /** Specific reason if the check failed or was not evaluated */
  readonly failureReason?: string | undefined;
}

/**
 * Result of the web shear stress evaluation:
 * tau_avg = |V_max| / (d * tw)
 */
export interface ShearCheckResult {
  readonly status: StructuralCheckStatus;
  /** Maximum design shear force demand in kN */
  readonly maxShearDemandKN: number;
  /** Web area Aw = d * tw in mm^2 */
  readonly webAreaMm2: number;
  /** Average web shear stress in MPa (N/mm^2) */
  readonly actualShearStressMPa: number;
  /** Allowable shear stress in MPa, if explicitly specified in criteria */
  readonly allowableShearStressMPa?: number | undefined;
  /** Capacity utilization ratio, if allowableShearStressMPa is specified */
  readonly utilizationRatio?: number | undefined;
  /** Technical note on calculation scope and limitations */
  readonly note: string;
  /** Specific reason if the check failed */
  readonly failureReason?: string | undefined;
}

/**
 * Result of the Lateral-Torsional Buckling (LTB) evaluation.
 * In Phase 2, this is explicitly marked as 'not_evaluated' because the catalog
 * does not contain flange dimensions (bf, tf), minor-axis radius (ry), or torsional constants (J, Cw).
 */
export interface LtbCheckResult {
  readonly status: 'not_evaluated';
  /** Technical explanation of why LTB cannot be evaluated with the catalog data */
  readonly reason: string;
}

/**
 * Calculation scope indicator for structural steel profile evaluation:
 * - 'preliminary_elastic': First-order linear elastic serviceability and allowable stress evaluation.
 *   Does NOT constitute a full building code verification (AISC 360-16 / NSR-10 Title F)
 *   as it does not verify lateral-torsional buckling (LTB), local web/flange buckling,
 *   or factored load combinations.
 */
export type SteelDesignScope = 'preliminary_elastic';

/**
 * Evaluation summary for a candidate steel cross-section against a beam configuration.
 */
export interface SteelCandidateEvaluation {
  /** The evaluated steel profile from the catalog */
  readonly profile: SteelProfile;
  /**
   * Explicit calculation scope indicator.
   * Always 'preliminary_elastic' for the current engine.
   */
  readonly designScope: SteelDesignScope;
  /**
   * True strictly if EVERY check defined in the candidate evaluation
   * (bending, deflection, shear, and ltb) has been evaluated (i.e. status is not 'not_evaluated').
   *
   * In Phase 2, because LTB cannot be evaluated analytically with the catalog's geometric data,
   * this is dynamically derived and will be false whenever any check is 'not_evaluated'.
   */
  readonly allChecksEvaluated: boolean;
  /** Self-weight distributed load intensity in kN/m */
  readonly selfWeightKNPerM: number;
  /**
   * Preliminary viability indicator:
   * True if the profile passed all EVALUATED mandatory checks (bending, deflection, and shear if evaluated).
   *
   * IMPORTANT ENGINEERING NOTICE:
   * `isViable: true` indicates ONLY that the candidate passed the evaluated preliminary elastic checks.
   * It does NOT certify full building code compliance (AISC 360, NSR-10, etc.) because mandatory
   * strength checks like Lateral-Torsional Buckling (LTB) remain 'not_evaluated'.
   * Always verify `allChecksEvaluated` and inspect `limitations`.
   */
  readonly isViable: boolean;
  /** List of failure messages explaining why the profile was disqualified, if any */
  readonly failureReasons: readonly string[];
  /** Bending stress check result */
  readonly bending: BendingCheckResult;
  /** Deflection serviceability check result */
  readonly deflection: DeflectionCheckResult;
  /** Web shear stress evaluation result */
  readonly shear: ShearCheckResult;
  /** Lateral-Torsional Buckling status (not evaluated in preliminary elastic scope) */
  readonly ltb: LtbCheckResult;
}

/**
 * Input criteria and options for selecting candidate steel profiles.
 */
export interface SteelSelectionCriteria {
  /** Filter candidate profiles by family ('W', 'S', 'C' or 'ALL'). Default: 'ALL' */
  readonly profileTypeFilter?: SteelProfileType | 'ALL' | undefined;
  /** Allowable flexural normal stress sigma_adm in MPa (strictly > 0). Required. */
  readonly allowableBendingStressMPa: number;
  /** Deflection serviceability denominator n for L/n (e.g. 360 for L/360, strictly > 0). Required. */
  readonly deflectionLimitDenominator: number;
  /** Young's modulus E in GPa for deflection analysis. Default: 200 GPa. */
  readonly elasticModulusGPa?: number | undefined;
  /**
   * Optional allowable shear stress tau_adm in MPa.
   * If omitted, shear stress is calculated for informational purposes and marked as 'not_evaluated'.
   */
  readonly allowableShearStressMPa?: number | undefined;
  /**
   * Whether to include the profile self-weight as an added distributed load across the beam.
   * Default: true.
   */
  readonly includeSelfWeight?: boolean | undefined;
  /**
   * Gravitational acceleration in m/s^2 for self-weight calculation.
   * Default: 9.80665 m/s^2.
   */
  readonly gravityAcceleration?: number | undefined;
}

/**
 * Complete outcome of the steel profile selection engine.
 */
export interface SteelSelectionResult {
  /**
   * The most economical (lightest mass) viable candidate within the preliminary elastic scope
   * that satisfies all evaluated checks.
   *
   * CAUTION:
   * This candidate is optimal solely within the 'preliminary_elastic' scope.
   * It does NOT imply full structural code certification if `optimalProfile.allChecksEvaluated` is false.
   */
  readonly optimalProfile?: SteelCandidateEvaluation | undefined;
  /** All preliminary viable candidates sorted by massKgPerM ascending, with deterministic tie-break by designation */
  readonly viableCandidates: readonly SteelCandidateEvaluation[];
  /** Candidates that were disqualified due to failing one or more evaluated checks */
  readonly disqualifiedCandidates: readonly SteelCandidateEvaluation[];
  /** Total count of profiles evaluated from the catalog */
  readonly totalEvaluated: number;
  /** The criteria used during evaluation */
  readonly criteria: SteelSelectionCriteria;
  /** Explicit technical limitations and engineering assumptions */
  readonly limitations: readonly string[];
}
