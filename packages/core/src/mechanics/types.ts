/**
 * OptiSteel 2.0 — Mechanics of Materials (Resistencia de Materiales) Types
 *
 * Mathematical and Structural Contracts:
 * - Bending normal stress: sigma = |M_max| * c / I = |M_max| / S  [MPa]
 * - Average shear stress: tau_prom = |V_max| / A  [MPa]
 * - Maximum shear stress: tau_max = V * Q / (I * b)  [MPa]
 *   - Solid rectangular section: tau_max = 1.5 * |V_max| / A
 *   - Solid circular section: tau_max = (4/3) * |V_max| / A
 *   - I/W shape: web shear distribution
 * - Differential equation of the elastic curve:
 *   EI * d^2v/dx^2 = -M(x)  (positive v downward)
 */

export type SectionGeometryType =
  | 'rectangular'
  | 'i_shape'
  | 'circular'
  | 'general';

export interface SectionGeometry {
  type?: SectionGeometryType | undefined;
  /** Width in mm (e.g. base of rectangle or flange width of I-shape) */
  widthMm?: number | undefined;
  /** Total height / depth in mm */
  heightMm?: number | undefined;
  /** Web thickness in mm (for I-shapes and channels) */
  webThicknessMm?: number | undefined;
  /** Flange thickness in mm (for I-shapes and channels) */
  flangeThicknessMm?: number | undefined;
  /** Flange width in mm (for I-shapes and channels) */
  flangeWidthMm?: number | undefined;
  /** Diameter in mm (for circular sections) */
  diameterMm?: number | undefined;
  /** Distance from neutral axis to extreme fiber in mm */
  cMm?: number | undefined;
  /** Cross-sectional area in cm^2 */
  areaCm2?: number | undefined;
}

export type FiberStressState = 'tension' | 'compression' | 'neutral';

export interface ExtremeFibersState {
  /** Stress state at the top extreme fiber (+y or upper edge) */
  top: FiberStressState;
  /** Stress state at the bottom extreme fiber (-y or lower edge) */
  bottom: FiberStressState;
  /** Explanation based on sign conventions */
  explanation: string;
}

export type CalculationStatus =
  | 'calculated'
  | 'insufficient_section_data'
  | 'average_only'
  | 'not_applicable';

export interface BendingPeakResult {
  momentKNm: number;
  locationM: number;
  actualStressMPa?: number | undefined;
  extremeFibers: ExtremeFibersState;
  utilizationRatio?: number | undefined;
  safetyFactor?: number | undefined;
}

export interface BendingStressResult {
  status: CalculationStatus;
  /** Maximum absolute bending moment demand in kN*m */
  maxMomentDemandKNm: number;
  /** Coordinate x along the beam where |M_max| occurs in meters */
  maxMomentLocationM: number;
  /** Classification of the critical moment: positive (sagging), negative (hogging), or zero */
  momentType: 'positive' | 'negative' | 'zero';
  /** Stress states (tension/compression) of the top and bottom fibers */
  extremeFibers: ExtremeFibersState;
  /** Moment of inertia about bending axis Iz in cm^4 */
  momentOfInertiaCm4: number;
  /** Elastic section modulus Wz in cm^3 (if available) */
  sectionModulusCm3?: number | undefined;
  /** Distance from neutral axis to outermost fiber c in mm (if available) */
  distanceToExtremeFiberMm?: number | undefined;
  /** Calculated maximum normal bending stress in MPa */
  actualStressMPa?: number | undefined;
  /** Allowable bending stress in MPa (if specified) */
  allowableStressMPa?: number | undefined;
  /** Utilization ratio sigma_actual / sigma_adm */
  utilizationRatio?: number | undefined;
  /** Safety factor sigma_adm / sigma_actual */
  safetyFactor?: number | undefined;
  /** Governing formula representation */
  formula: string;
  /** Detailed numerical substitution string */
  substitution: string;
  /** Methodological notes or data requirement explanations */
  notes: string[];
  /** Detailed result for maximum positive bending moment (if present) */
  positiveExtremum?: BendingPeakResult | undefined;
  /** Detailed result for maximum negative bending moment (if present) */
  negativeExtremum?: BendingPeakResult | undefined;
}

export type ShearDistributionType =
  | 'rectangular'
  | 'i_shape_web'
  | 'circular'
  | 'average_only'
  | 'not_available';

export type ShearCalculationMethod =
  | 'jourawski_neutral_axis'
  | 'rectangular_jourawski'
  | 'circular_jourawski'
  | 'web_average'
  | 'section_average'
  | 'not_available';

export interface ShearStressResult {
  status: CalculationStatus;
  /** Maximum absolute shear force demand in kN */
  maxShearDemandKN: number;
  /** Coordinate x along the beam where |V_max| occurs in meters */
  maxShearLocationM: number;
  /** Cross-sectional area in cm^2 (if available) */
  crossSectionAreaCm2?: number | undefined;
  /** Average shear stress tau_prom = |V| / A in MPa (if area is available) */
  averageShearStressMPa?: number | undefined;
  /** True maximum shear stress tau_max in MPa (when geometry permits calculation) */
  maxShearStressMPa?: number | undefined;
  /** Type of shear distribution model applied */
  shearDistributionType: ShearDistributionType;
  /** Exact calculation method executed by the engine */
  calculationMethod?: ShearCalculationMethod | undefined;
  /** Formula for average shear stress */
  averageFormula: string;
  /** Numerical substitution for average shear stress */
  averageSubstitution: string;
  /** Formula for maximum shear stress (if calculable) */
  maxFormula?: string | undefined;
  /** Numerical substitution for maximum shear stress (if calculable) */
  maxSubstitution?: string | undefined;
  /** Methodological notes, limitations, or data requirement explanations */
  notes: string[];
}

export interface ElasticCurveSegment {
  /** 1-based segment index */
  segmentIndex: number;
  /** Start coordinate in meters */
  xStart: number;
  /** End coordinate in meters */
  xEnd: number;
  /** Segment length in meters */
  spanM: number;
  /** Piecewise moment equation on this segment: M(xi) or M(x) in kN*m */
  momentEquation: string;
  /** Piecewise slope equation: EI*theta(xi) in kN*m^2 */
  slopeEquation: string;
  /** Piecewise deflection equation: EI*v(xi) in kN*m^3 or v(xi) in mm */
  deflectionEquation: string;
  /** Local coordinate explanation (e.g. "xi = x - xStart") */
  localCoordinateNote: string;
}

export interface BoundaryConditionRecord {
  description: string;
  locationM: number;
  conditionType: 'deflection_zero' | 'slope_zero' | 'moment_zero' | 'shear_zero';
  mathematicalForm: string;
}

export interface ElasticCurveResult {
  status: 'exact_analytical' | 'numerical' | 'insufficient_elastic_data';
  /** Governing differential equation */
  differentialEquation: string;
  /** First integral equation for slope */
  slopeIntegralEquation: string;
  /** Second integral equation for deflection */
  deflectionIntegralEquation: string;
  /** Flexural rigidity EI in kN*m^2 */
  flexuralRigidityEI?: number | undefined;
  /** Boundary conditions enforced by the support configuration */
  boundaryConditions: BoundaryConditionRecord[];
  /** Global integration constants resolved from boundary conditions */
  integrationConstants?: {
    C1: number; // theta(0) in rad
    C2: number; // v(0) in m
    descriptionC1: string;
    descriptionC2: string;
  } | undefined;
  /** Piecewise polynomial equations for each beam segment */
  segments: ElasticCurveSegment[];
  notes: string[];
}

export type DeflectionSpanType = 'supported_span' | 'cantilever';

export interface DeflectionSpanEvaluation {
  spanIndex: number;
  spanType: DeflectionSpanType;
  xStart: number;
  xEnd: number;
  spanLengthM: number;
  referenceLengthM: number;
  description: string;
  maxDeflectionMm: number;
  maxDeflectionLocationM: number;
  limitDenominator: number;
  allowableDeflectionMm: number;
  utilizationRatio: number;
  passesService: boolean;
  formula: string;
}

export interface DeflectionExtremumResult {
  status: 'calculated' | 'insufficient_elastic_data';
  /** Maximum absolute deflection magnitude |v| in mm */
  maxAbsoluteDeflectionMm?: number | undefined;
  /** Location x of maximum absolute deflection in meters */
  maxAbsoluteLocationM?: number | undefined;
  /** Maximum downward deflection (v > 0) in mm */
  maxDownwardDeflectionMm?: number | undefined;
  /** Location x of maximum downward deflection in meters */
  maxDownwardLocationM?: number | undefined;
  /** Maximum upward deflection / uplift (v < 0) in mm */
  maxUpwardDeflectionMm?: number | undefined;
  /** Location x of maximum upward deflection in meters */
  maxUpwardLocationM?: number | undefined;
  /** Evaluated deflection service limit denominator (e.g. 360 for L/360) */
  serviceLimitDenominator?: number | undefined;
  /** Reference length used to compute the governing allowable limit in meters */
  referenceLengthM?: number | undefined;
  /** Description of the governing reference span or overhang */
  referenceSpanDescription?: string | undefined;
  /** Detailed formula and substitution of the governing deflection criterion */
  referenceCriterionFormula?: string | undefined;
  /** Allowable deflection in mm: (L_ref * 1000) / n */
  allowableDeflectionMm?: number | undefined;
  /** Deflection utilization ratio: |v_max| / v_adm */
  deflectionUtilizationRatio?: number | undefined;
  /** Serviceability check status */
  serviceCheckStatus?: 'passed' | 'failed' | 'not_evaluated' | undefined;
  /** Individual evaluations for each span or overhang in multi-span / cantilever configurations */
  spanEvaluations?: DeflectionSpanEvaluation[] | undefined;
  /** Significant critical points of the elastic curve */
  criticalPointsSummary: {
    x: number;
    deflectionMm: number;
    description: string;
  }[];
  notes: string[];
}

export interface MaterialsMechanicsResult {
  /** Bending normal stress analysis */
  bending: BendingStressResult;
  /** Shear stress analysis */
  shear: ShearStressResult;
  /** Piecewise elastic curve equations and boundary conditions */
  elasticCurve: ElasticCurveResult;
  /** Maximum deflections and serviceability evaluation */
  deflection: DeflectionExtremumResult;
  /** Executive summary metrics */
  summary: {
    maxMomentDemandKNm: number;
    maxShearDemandKN: number;
    maxBendingStressMPa?: number | undefined;
    maxShearStressMPa?: number | undefined;
    averageShearStressMPa?: number | undefined;
    maxDeflectionMm?: number | undefined;
  };
  /** Global methodological notes */
  limitations: readonly string[];
}

export interface MaterialsMechanicsOptions {
  /** Override allowable bending stress in MPa */
  allowableBendingStressMPa?: number | undefined;
  /** Override allowable shear stress in MPa */
  allowableShearStressMPa?: number | undefined;
  /** Service deflection limit denominator (default 360 for L/360) */
  deflectionLimitDenominator?: number | undefined;
}
