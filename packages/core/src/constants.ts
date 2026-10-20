/**
 * Numerical tolerances and default constants for OptiSteel 2.0 Core
 */

/** Geometric position tolerance in meters (1 nanometer) */
export const LENGTH_TOLERANCE = 1e-9;

/** Equilibrium force balance tolerance in kN */
export const FORCE_TOLERANCE = 1e-7;

/** Equilibrium moment balance tolerance in kN*m */
export const MOMENT_TOLERANCE = 1e-7;

/** Zero crossing tolerance for shear root-finding in kN */
export const ZERO_SHEAR_TOLERANCE = 1e-9;

/**
 * Tolerance for span length equality in two-span continuous beams in meters (1 mm).
 * Structural spans in civil/mechanical engineering are defined in meters with typical
 * millimeter tolerance in physical placement and numerical input precision.
 */
export const SPAN_EQUALITY_TOLERANCE = 1e-3;

/**
 * Tolerance for distributed load intensity uniformity in kN/m.
 */
export const LOAD_INTENSITY_TOLERANCE = 1e-6;
