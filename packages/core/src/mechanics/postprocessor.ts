import type { BeamAnalysisResult } from '../types.js';
import type {
  MaterialsMechanicsOptions,
  MaterialsMechanicsResult,
} from './types.js';
import { calculateBendingStress } from './bending.js';
import { calculateShearStress } from './shear.js';
import { buildElasticCurveResult } from './elastic-curve.js';
import { calculateDeflectionExtremum } from './deflection.js';

export const MECHANICS_LIMITATIONS: readonly string[] = [
  'La teoría clásica de vigas de Euler-Bernoulli asume que las secciones planas permanecen planas y ortogonales al eje neutro deformado, despreciando la distorsión por cortante (válido para vigas esbeltas con relación L / h >= 10).',
  'El esfuerzo normal por flexión (sigma = |M| · c / I = |M| / S) asume régimen elástico lineal y soporte lateral suficiente para evitar el pandeo lateral-torsional.',
  'El esfuerzo cortante máximo se calcula mediante la fórmula de Jourawski (tau = V·Q / (I·b)) cuando la geometría se encuentra disponible (ej. sección rectangular maciza: tau_max = 1.5 · V / A; perfiles W/I: cortante en alma). Si no se dispone de dimensiones detalladas, se reporta exclusivamente el cortante promedio V / A sin asumir factores arbitrarios.',
  'Los límites de deflexión (L/n) corresponden a estados límite de servicio elásticos. No constituyen una verificación de diseño definitiva sin la concurrencia de combinaciones de carga separadas (muerta D y viva L) según normativas vigentes.',
] as const;

/**
 * Unified Mechanics of Materials (Resistencia de Materiales) Postprocessing Service.
 *
 * Processes any completed beam analysis result (isostatic, propped cantilever,
 * fixed-fixed, two-span continuous, or Pytel-Singer reference case) to compute:
 * 1. Maximum bending normal stress and extreme fiber states (tension/compression).
 * 2. Shear stresses (distinguishing average shear V/A from true maximum shear V*Q/(I*b)).
 * 3. Exact piecewise elastic curve equations and boundary conditions.
 * 4. Maximum deflections and serviceability checks.
 */
export function computeMaterialsMechanics(
  analysis: BeamAnalysisResult,
  options?: MaterialsMechanicsOptions
): MaterialsMechanicsResult {
  const { model, moment, shear, deflection } = analysis;

  const bending = calculateBendingStress(moment, model.section, options);
  const shearResult = calculateShearStress(shear, model.section, options);
  const elasticCurve = buildElasticCurveResult(model, moment, deflection);
  const deflectionResult = calculateDeflectionExtremum(
    deflection,
    model,
    options
  );

  return {
    bending,
    shear: shearResult,
    elasticCurve,
    deflection: deflectionResult,
    summary: {
      maxMomentDemandKNm: bending.maxMomentDemandKNm,
      maxShearDemandKN: shearResult.maxShearDemandKN,
      maxBendingStressMPa: bending.actualStressMPa,
      maxShearStressMPa: shearResult.maxShearStressMPa,
      averageShearStressMPa: shearResult.averageShearStressMPa,
      maxDeflectionMm: deflectionResult.maxAbsoluteDeflectionMm,
    },
    limitations: MECHANICS_LIMITATIONS,
  };
}

