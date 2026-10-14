/**
 * OptiSteel 2.0 Core - Type Definitions
 *
 * Mathematical and Structural Contracts:
 * - Longitudinal axis x: meters (m), with x in [0, L]
 * - Vertical forces: kilonewtons (kN)
 *   - External point loads P: positive downwards (+y downwards)
 *   - Support vertical reactions Ry: positive upwards (+y upwards)
 * - Moments: kilonewton-meters (kN*m)
 *   - External applied moments M: positive counter-clockwise (+CCW)
 *   - Support reaction moments Mr: positive counter-clockwise (+CCW)
 *   - Bending moment M(x): positive for sagging (tension on bottom fibers, compression on top)
 * - Distributed loads w: kN/m, positive downwards
 * - Shear force V(x): kN, positive when left cut face shears upward
 *
 * Differential relations:
 * - dV/dx = -w(x)
 * - dM/dx = V(x)
 */

export type SupportType = 'pin' | 'roller' | 'fixed';

export interface Support {
  id: string;
  type: SupportType;
  /** Longitudinal position along the beam in meters (0 <= x <= L) */
  x: number;
  label?: string;
}

export interface PointLoad {
  id: string;
  type: 'point';
  /** Longitudinal position along the beam in meters (0 <= x <= L) */
  x: number;
  /** Force magnitude in kN (positive downwards) */
  P: number;
  label?: string;
}

export interface DistributedLoad {
  id: string;
  type: 'distributed';
  /** Start position in meters (0 <= xStart < xEnd <= L) */
  xStart: number;
  /** End position in meters (xStart < xEnd <= L) */
  xEnd: number;
  /** Load intensity at start in kN/m (positive downwards) */
  wStart: number;
  /** Load intensity at end in kN/m (positive downwards) */
  wEnd: number;
  label?: string;
}

export interface MomentLoad {
  id: string;
  type: 'moment';
  /** Longitudinal position along the beam in meters (0 <= x <= L) */
  x: number;
  /** Moment magnitude in kN*m (positive counter-clockwise) */
  M: number;
  label?: string;
}

export type Load = PointLoad | DistributedLoad | MomentLoad;

/** Material properties contract (prepared for Phase 2 elasticity) */
export interface BeamMaterial {
  name?: string;
  /** Young's modulus E in GPa (e.g., 200 GPa for structural steel) */
  E: number;
}

/** Cross-section geometric properties contract (prepared for Phase 2 deflection) */
export interface BeamSection {
  name?: string;
  /** Moment of inertia about bending axis in cm^4 */
  Iz: number;
  /** Elastic section modulus in cm^3 */
  Wz?: number;
}

/**
 * Structural steel cross-section family type:
 * - 'W': Wide-flange shapes (vigas de patín ancho / alas paralelas)
 * - 'S': American Standard I-beams (vigas estándar I con patines inclinados)
 * - 'C': American Standard channels (canales estándar en U)
 */
export type SteelProfileType = 'W' | 'S' | 'C';

/**
 * Canonical structural steel cross-section profile.
 * Source: Pytel & Singer, "Resistencia de Materiales", 4th Edition, Appendix B (Table B-2).
 *
 * SCALE FACTORS NOTE:
 * - `ixMillionMm4`: Stored in 10^6 mm^4 (millions of mm^4). Equivalent to 100 cm^4 or 10^-6 m^4.
 *   Multiply by 1e6 to obtain mm^4. Multiply by 100 to obtain cm^4.
 * - `sxThousandMm3`: Stored in 10^3 mm^3 (thousands of mm^3). Equivalent to 1 cm^3 or 10^-6 m^3.
 *   Multiply by 1e3 to obtain mm^3. Multiply by 1 to obtain cm^3.
 */
export interface SteelProfile {
  readonly designation: string;
  readonly type: SteelProfileType;
  /** Linear mass in kg/m */
  readonly massKgPerM: number;
  /** Total section depth in mm */
  readonly depthMm: number;
  /** Web thickness in mm */
  readonly webThicknessMm: number;
  /** Moment of inertia about strong axis in 10^6 mm^4 (millions of mm^4) */
  readonly ixMillionMm4: number;
  /** Elastic section modulus about strong axis in 10^3 mm^3 (thousands of mm^3) */
  readonly sxThousandMm3: number;
}

export interface BeamModel {
  id?: string;
  /** Total length of the beam in meters (strictly > 0) */
  length: number;
  supports: Support[];
  loads: Load[];
  material?: BeamMaterial;
  section?: BeamSection;
}

export interface Reaction {
  supportId: string;
  supportType: SupportType;
  /** Position of support in meters */
  x: number;
  /** Vertical reaction force in kN (positive upwards) */
  Ry: number;
  /** Restraint reaction moment in kN*m (positive counter-clockwise, for fixed supports) */
  Mr?: number;
}

export interface EquilibriumCheck {
  /** Sum of vertical forces: sum(Ry) - sum(P_down) in kN */
  sumFy: number;
  /** Sum of moments about x=0 in kN*m */
  sumM: number;
  /** True if |sumFy| <= toleranceForce and |sumM| <= toleranceMoment */
  isBalanced: boolean;
  toleranceForce: number;
  toleranceMoment: number;
}

export interface Discontinuity {
  x: number;
  valueBefore: number;
  valueAfter: number;
  jump: number;
}

export interface CriticalPoint {
  x: number;
  value: number;
  type:
    | 'global_max'
    | 'global_min'
    | 'local_max'
    | 'local_min'
    | 'discontinuity'
    | 'boundary'
    | 'zero_crossing';
  description?: string;
}

/**
 * Shear force piecewise polynomial on [xStart, xEnd]:
 * V(xi) = c0 + c1*xi + c2*xi^2, where xi = x - xStart
 */
export interface ShearSegment {
  xStart: number;
  xEnd: number;
  c0: number;
  c1: number;
  c2: number;
  vStartRight: number;
  vEndLeft: number;
}

/**
 * Bending moment piecewise polynomial on [xStart, xEnd]:
 * M(xi) = d0 + d1*xi + d2*xi^2 + d3*xi^3, where xi = x - xStart
 */
export interface MomentSegment {
  xStart: number;
  xEnd: number;
  d0: number;
  d1: number;
  d2: number;
  d3: number;
  mStartRight: number;
  mEndLeft: number;
}

export interface ValueExtremum {
  x: number;
  value: number;
}

export interface FunctionAnalysis<TSegment> {
  segments: TSegment[];
  criticalPoints: CriticalPoint[];
  maxPositive: ValueExtremum;
  maxNegative: ValueExtremum;
  maxAbsolute: ValueExtremum;
  discontinuities: Discontinuity[];
  /** Evaluates function at x. In discontinuous points, 'left' or 'right' limit can be chosen. */
  evaluate: (x: number, side?: 'left' | 'right') => number;
}

export interface SlopeSegment {
  xStart: number;
  xEnd: number;
  /** Coefficients of theta(xi) = t0 + t1*xi + t2*xi^2 + t3*xi^3 + t4*xi^4 on [0, h] in rad */
  t0: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  thetaStart: number;
  thetaEnd: number;
}

export interface DeflectionSegment {
  xStart: number;
  xEnd: number;
  /** Coefficients of y(xi) = y0 + y1*xi + y2*xi^2 + y3*xi^3 + y4*xi^4 + y5*xi^5 on [0, h] in meters */
  y0: number;
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
  yStart: number;
  yEnd: number;
}

export interface DeflectionAnalysis {
  isImplemented: true;
  segments: DeflectionSegment[];
  criticalPoints: CriticalPoint[];
  /** Maximum downward displacement (positive y) in meters */
  maxDownward: ValueExtremum;
  /** Maximum upward displacement (negative y) in meters */
  maxUpward: ValueExtremum;
  /** Maximum absolute deflection magnitude |y| in meters */
  maxAbsolute: ValueExtremum;
  endSlopes: {
    /** Slope theta at x = 0 in radians */
    thetaLeft: number;
    /** Slope theta at x = L in radians */
    thetaRight: number;
  };
  /** Evaluates deflection y(x) in meters (positive downward) */
  evaluate: (x: number) => number;
  /** Evaluates slope theta(x) = dy/dx in radians */
  evaluateSlope: (x: number) => number;
  /** Flexural rigidity in kN*m^2 */
  EI: number;
}

export interface DeflectionPlaceholder {
  isImplemented: false;
  note: string;
}

export interface BeamAnalysisResult {
  model: BeamModel;
  isStaticDeterminate: boolean;
  reactions: Reaction[];
  equilibrium: EquilibriumCheck;
  shear: FunctionAnalysis<ShearSegment>;
  moment: FunctionAnalysis<MomentSegment>;
  deflection: DeflectionPlaceholder | DeflectionAnalysis;
}

export type DeterminacyClassification =
  | 'isostatic'
  | 'unstable'
  | 'hyperstatic'
  | 'invalid';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  classification: DeterminacyClassification;
}
