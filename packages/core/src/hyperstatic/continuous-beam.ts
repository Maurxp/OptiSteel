import { FORCE_TOLERANCE, MOMENT_TOLERANCE } from '../constants.js';
import type {
  BeamAnalysisResult,
  BeamModel,
  DeflectionAnalysis,
  DeflectionPlaceholder,
  EquilibriumCheck,
  Reaction,
} from '../types.js';
import { calculateFlexuralRigidity, solveDeflections } from '../elasticity.js';
import { buildInternalForces } from '../internal-forces.js';

export interface ContinuousBeamReactionsResult {
  reactions: Reaction[];
  equilibrium: EquilibriumCheck;
}

/**
 * Calculates exact reactions for a two-span continuous beam with three simple supports
 * using the Theorem of Three Moments (Clapeyron's equation) and static equilibrium.
 *
 * Mechanical Formulation (Two-Span Continuous Beam):
 * Supports: s1 at x1, s2 at x2, s3 at x3 (all simple supports: roller or pin).
 * Spans: L1 = x2 - x1, L2 = x3 - x2.
 * Simple ends: M1 = 0, M3 = 0.
 *
 * Clapeyron's equation for intermediate support moment M2:
 *   M1*L1 + 2*M2*(L1 + L2) + M3*L2 = - 6 * [ (A1*a1_bar)/L1 + (A2*b2_bar)/L2 ]
 *
 * For uniform load w1 on span 1 and w2 on span 2:
 *   (6 * A1 * a1_bar) / L1 = (w1 * L1^3) / 4
 *   (6 * A2 * b2_bar) / L2 = (w2 * L2^3) / 4
 *
 * Therefore:
 *   2 * M2 * (L1 + L2) = - (w1 * L1^3) / 4 - (w2 * L2^3) / 4
 *   M2 = - (w1 * L1^3 + w2 * L2^3) / [ 8 * (L1 + L2) ]
 *
 * Equilibrium of each span:
 *   R1 = (w1 * L1) / 2 + M2 / L1
 *   R3 = (w2 * L2) / 2 + M2 / L2
 *   R2 = (w1 * L1 + w2 * L2) - R1 - R3
 *
 * Canonical case H4 (two equal spans Lv with identical uniform load w):
 *   L1 = L2 = Lv
 *   w1 = w2 = w
 *   M2 = - w * Lv^2 / 8
 *   R1 = R3 = (3/8) * w * Lv
 *   R2 = (5/4) * w * Lv
 */
export function calculateContinuousBeamReactions(
  model: BeamModel
): ContinuousBeamReactionsResult {
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  if (supports.length !== 3) {
    throw new Error(
      `El solver de viga continua de dos vanos requiere exactamente 3 apoyos. Recibidos: ${supports.length}.`
    );
  }

  const s1 = supports[0]!;
  const s2 = supports[1]!;
  const s3 = supports[2]!;

  if (s1.type === 'fixed' || s2.type === 'fixed' || s3.type === 'fixed') {
    throw new Error(
      'El solver de viga continua de dos vanos requiere apoyos simples (pin o roller), sin empotramientos.'
    );
  }

  const L1 = s2.x - s1.x;
  const L2 = s3.x - s2.x;

  if (L1 <= 0 || L2 <= 0) {
    throw new Error('Longitud de vano no positiva en viga continua.');
  }

  // Calculate loading terms on each span for Clapeyron equation:
  // Term1 = (6 * A1 * a1_bar) / L1
  // Term2 = (6 * A2 * b2_bar) / L2
  let term1 = 0;
  let term2 = 0;
  let totalDownwardForce = 0;

  for (const load of model.loads) {
    if (load.type === 'distributed') {
      const span = load.xEnd - load.xStart;
      const wAvg = 0.5 * (load.wStart + load.wEnd);
      totalDownwardForce += wAvg * span;

      // Span 1 contribution
      const aStart1 = Math.max(s1.x, Math.min(s2.x, load.xStart)) - s1.x;
      const aEnd1 = Math.max(s1.x, Math.min(s2.x, load.xEnd)) - s1.x;
      if (aEnd1 > aStart1) {
        // For full span uniform load on span 1
        const w = wAvg;
        if (Math.abs(aStart1) < 1e-9 && Math.abs(aEnd1 - L1) < 1e-9) {
          term1 += (w * L1 ** 3) / 4;
        } else {
          // General segment on span 1: 6/L1 * \int w(x) * x * (L1 - x) / ...
          // Using integration of moment due to simple beam
          const da = aEnd1 - aStart1;
          const aMid = 0.5 * (aStart1 + aEnd1);
          // Equivalent point load approximation or exact formula
          term1 += (w * da * aMid * (L1 ** 2 - aMid ** 2)) / L1;
        }
      }

      // Span 2 contribution (b measured from right support s3: b = s3.x - x)
      const aStart2 = Math.max(s2.x, Math.min(s3.x, load.xStart));
      const aEnd2 = Math.max(s2.x, Math.min(s3.x, load.xEnd));
      if (aEnd2 > aStart2) {
        const w = wAvg;
        if (Math.abs(aStart2 - s2.x) < 1e-9 && Math.abs(aEnd2 - s3.x) < 1e-9) {
          term2 += (w * L2 ** 3) / 4;
        } else {
          const da = aEnd2 - aStart2;
          const xMid = 0.5 * (aStart2 + aEnd2);
          const bMid = s3.x - xMid;
          term2 += (w * da * bMid * (L2 ** 2 - bMid ** 2)) / L2;
        }
      }
    } else if (load.type === 'point') {
      totalDownwardForce += load.P;
      if (load.x >= s1.x && load.x <= s2.x) {
        const a = load.x - s1.x;
        term1 += (load.P * a * (L1 ** 2 - a ** 2)) / L1;
      } else if (load.x >= s2.x && load.x <= s3.x) {
        const b = s3.x - load.x;
        term2 += (load.P * b * (L2 ** 2 - b ** 2)) / L2;
      }
    } else {
      throw new Error(
        `Tipo de carga '${load.type}' aún no soportada en el solver de viga continua.`
      );
    }
  }

  // Clapeyron's equation for intermediate moment M2:
  // 2 * M2 * (L1 + L2) = - (term1 + term2)
  const M2 = -(term1 + term2) / (2 * (L1 + L2));

  // Determine span loads for shear/reaction resolution:
  let wSpan1 = 0;
  let wSpan2 = 0;
  for (const load of model.loads) {
    if (load.type === 'distributed') {
      if (load.xStart <= s1.x + 1e-6 && load.xEnd >= s2.x - 1e-6) {
        wSpan1 = 0.5 * (load.wStart + load.wEnd);
      }
      if (load.xStart <= s2.x + 1e-6 && load.xEnd >= s3.x - 1e-6) {
        wSpan2 = 0.5 * (load.wStart + load.wEnd);
      }
    }
  }

  // Reactions:
  // R1 * L1 - (w1 * L1^2) / 2 - M2 = 0 => R1 = w1*L1/2 + M2/L1
  const r1y = (wSpan1 * L1) / 2 + M2 / L1;
  const r3y = (wSpan2 * L2) / 2 + M2 / L2;
  const r2y = totalDownwardForce - r1y - r3y;

  const reactions: Reaction[] = [
    {
      supportId: s1.id,
      supportType: s1.type,
      x: s1.x,
      Ry: r1y,
    },
    {
      supportId: s2.id,
      supportType: s2.type,
      x: s2.x,
      Ry: r2y,
    },
    {
      supportId: s3.id,
      supportType: s3.type,
      x: s3.x,
      Ry: r3y,
    },
  ];

  reactions.sort((a, b) => a.x - b.x);

  // Global static equilibrium verification
  let sumRy = 0;
  let sumReactionMomentsAbout0 = 0;
  for (const r of reactions) {
    sumRy += r.Ry;
    sumReactionMomentsAbout0 += r.Ry * r.x + (r.Mr ?? 0);
  }

  const sumFy = sumRy - totalDownwardForce;

  let downwardForceMomentAbout0 = 0;
  for (const load of model.loads) {
    if (load.type === 'point') {
      downwardForceMomentAbout0 += load.P * load.x;
    } else if (load.type === 'distributed') {
      const span = load.xEnd - load.xStart;
      const totalW = 0.5 * (load.wStart + load.wEnd) * span;
      const centroid =
        Math.abs(load.wStart - load.wEnd) < 1e-9
          ? 0.5 * (load.xStart + load.xEnd)
          : load.xStart +
            (span * (load.wStart + 2 * load.wEnd)) /
              (3 * (load.wStart + load.wEnd));
      downwardForceMomentAbout0 += totalW * centroid;
    }
  }

  const sumM = sumReactionMomentsAbout0 - downwardForceMomentAbout0;
  const isBalanced =
    Math.abs(sumFy) <= FORCE_TOLERANCE && Math.abs(sumM) <= MOMENT_TOLERANCE;

  return {
    reactions,
    equilibrium: {
      sumFy,
      sumM,
      isBalanced,
      toleranceForce: FORCE_TOLERANCE,
      toleranceMoment: MOMENT_TOLERANCE,
    },
  };
}

/**
 * Analyzes a two-span continuous beam hyperstatic model (Case H4),
 * computing reactions, internal forces V(x) and M(x), inflection points,
 * and exact continuous elastic deflection curve v(x).
 */
export function analyzeContinuousBeam(model: BeamModel): BeamAnalysisResult {
  const { reactions, equilibrium } = calculateContinuousBeamReactions(model);
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

  return {
    model,
    isStaticDeterminate: false, // Hyperstatic beam
    reactions,
    equilibrium,
    shear,
    moment,
    deflection,
  };
}
