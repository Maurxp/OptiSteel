import type {
  BeamAnalysisResult,
  BeamModel,
  DeflectionAnalysis,
  DeflectionPlaceholder,
} from './types.js';
import { validateBeamModel } from './validator.js';
import { calculateReactions } from './reactions.js';
import { buildInternalForces } from './internal-forces.js';
import {
  calculateFlexuralRigidity,
  solveDeflections,
} from './elasticity.js';
import {
  analyzeContinuousBeam,
  analyzeFixedFixedBeam,
  analyzeProppedCantileverBeam,
  generateHyperstaticDidacticReport,
} from './hyperstatic/index.js';
import { computeMaterialsMechanics } from './mechanics/index.js';

export class StructuralAnalysisError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'StructuralAnalysisError';
    this.errors = errors;
  }
}

/**
 * Analyzes an isostatic beam model:
 * 1. Validates inputs and determinacy/stability.
 * 2. Solves for reactions via static equilibrium.
 * 3. Builds piecewise continuous functions for shear V(x) and bending moment M(x).
 * 4. Finds exact critical points, extrema, and discontinuities.
 * 5. Verifies global static equilibrium of forces and moments.
 * 6. If material and section are provided, computes exact slopes and deflections.
 */
export function analyzeBeam(model: BeamModel): BeamAnalysisResult {
  const validation = validateBeamModel(model);
  if (!validation.isValid) {
    throw new StructuralAnalysisError(
      `Modelo estructural inválido (${validation.classification}):\n- ${validation.errors.join('\n- ')}`,
      validation.errors
    );
  }

  if (validation.classification === 'hyperstatic') {
    const fixedCount = model.supports.filter((s) => s.type === 'fixed').length;
    let hyperResult: BeamAnalysisResult;
    if (model.supports.length === 2) {
      if (fixedCount === 1) {
        hyperResult = analyzeProppedCantileverBeam(model);
      } else if (fixedCount === 2) {
        hyperResult = analyzeFixedFixedBeam(model);
      } else {
        throw new StructuralAnalysisError(
          'Configuración hiperestática no soportada por el motor de análisis.',
          ['Configuración hiperestática no soportada por el motor de análisis.']
        );
      }
    } else if (model.supports.length === 3) {
      hyperResult = analyzeContinuousBeam(model);
    } else {
      throw new StructuralAnalysisError(
        'Configuración hiperestática no soportada por el motor de análisis.',
        ['Configuración hiperestática no soportada por el motor de análisis.']
      );
    }
    hyperResult.didacticReport = generateHyperstaticDidacticReport(hyperResult);
    hyperResult.mechanics = computeMaterialsMechanics(hyperResult);
    return hyperResult;
  }

  const { reactions, equilibrium } = calculateReactions(model);
  const { shear, moment } = buildInternalForces(model, reactions);

  let deflection: DeflectionPlaceholder | DeflectionAnalysis;

  if (model.material && model.section) {
    const EI = calculateFlexuralRigidity(model.material, model.section);
    deflection = solveDeflections(model, moment.segments, EI);
  } else {
    deflection = {
      isImplemented: false,
      note: 'Para calcular pendientes y deflexiones elásticas, proporcione propiedades de material (E en GPa) y sección (Iz en cm^4).',
    };
  }

  const result: BeamAnalysisResult = {
    model,
    isStaticDeterminate: true,
    reactions,
    equilibrium,
    shear,
    moment,
    deflection,
  };

  result.mechanics = computeMaterialsMechanics(result);
  return result;
}
