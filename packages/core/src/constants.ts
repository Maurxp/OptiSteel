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
