import {
  FORCE_TOLERANCE,
  LENGTH_TOLERANCE,
  LOAD_INTENSITY_TOLERANCE,
  MOMENT_TOLERANCE,
  SPAN_EQUALITY_TOLERANCE,
} from '../constants.js';
import type {
  BeamAnalysisResult,
  BeamModel,
  DeflectionAnalysis,
  DeflectionPlaceholder,
  DistributedLoad,
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
  // Precondition 1: Exactly 3 simple supports
  if (!model.supports || model.supports.length !== 3) {
    throw new Error(
      `El solver de viga continua de dos vanos (Caso H4) requiere exactamente 3 apoyos simples. Recibidos: ${model.supports?.length ?? 0}.`
    );
  }

  const hasFixed = model.supports.some((s) => s.type === 'fixed');
  if (hasFixed) {
    throw new Error(
      'El solver de viga continua de dos vanos (Caso H4) requiere apoyos simples (pin o roller), sin empotramientos.'
    );
  }

  // Precondition 2: Non-destructive sorting & span equality
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  const s1 = supports[0]!;
  const s2 = supports[1]!;
  const s3 = supports[2]!;

  const L1 = s2.x - s1.x;
  const L2 = s3.x - s2.x;

  if (L1 <= 0 || L2 <= 0) {
    throw new Error(
      'Longitud de vano no positiva en viga continua de dos vanos (los apoyos deben tener posiciones distintas y crecientes).'
    );
  }

  if (Math.abs(L1 - L2) > SPAN_EQUALITY_TOLERANCE) {
    throw new Error(
      `El solver de viga continua (Caso H4) requiere dos vanos de igual longitud (|L1 - L2| <= ${SPAN_EQUALITY_TOLERANCE} m). Recibido: L1 = ${L1} m, L2 = ${L2} m.`
    );
  }

  // Precondition 3: Material and section properties
  if (!model.material || !model.section) {
    throw new Error(
      'El solver de viga continua (Caso H4) requiere propiedades de material (E en GPa) y sección (Iz en cm^4).'
    );
  }

  if (model.material.E <= 0 || model.section.Iz <= 0) {
    throw new Error(
      'Propiedades de material y sección no válidas (E e Iz deben ser estrictamente mayores que cero).'
    );
  }

  // Precondition 4: Loads validation
  if (!model.loads || model.loads.length === 0) {
    throw new Error(
      'El solver de viga continua (Caso H4) requiere al menos una carga distribuida continua en ambos vanos.'
    );
  }

  const hasPointLoad = model.loads.some((l) => l.type === 'point');
  if (hasPointLoad) {
    throw new Error(
      'El solver de viga continua de dos vanos no admite cargas puntuales (solo Caso H4: dos vanos iguales con carga uniforme continua).'
    );
  }

  const hasUnsupportedLoadType = model.loads.some(
    (l) => l.type !== 'distributed'
  );
  if (hasUnsupportedLoadType) {
    throw new Error(
      'El solver de viga continua de dos vanos no admite tipos de carga distintos a cargas distribuidas uniformes.'
    );
  }

  const minSupportX = s1.x;
  const maxSupportX = s3.x;

  const hasOverhangDistLoad = model.loads.some(
    (l) =>
      l.type === 'distributed' &&
      (Math.min(l.xStart, l.xEnd) < minSupportX - LENGTH_TOLERANCE ||
        Math.max(l.xStart, l.xEnd) > maxSupportX + LENGTH_TOLERANCE)
  );
  if (hasOverhangDistLoad) {
    throw new Error(
      'El solver de viga continua de dos vanos no admite cargas en voladizo exterior fuera del tramo entre apoyos.'
    );
  }

  const hasTrapezoidalLoad = model.loads.some(
    (l) =>
      l.type === 'distributed' &&
      Math.abs(l.wStart - l.wEnd) > LOAD_INTENSITY_TOLERANCE
  );
  if (hasTrapezoidalLoad) {
    throw new Error(
      'El solver de viga continua de dos vanos no admite cargas distribuidas trapezoidales o no uniformes (wStart != wEnd).'
    );
  }

  const firstDist = model.loads.find(
    (l): l is DistributedLoad => l.type === 'distributed'
  );
  const firstW = firstDist?.wStart ?? 0;
  const hasDifferingIntensities = model.loads.some(
    (l) =>
      l.type === 'distributed' &&
      Math.abs(l.wStart - firstW) > LOAD_INTENSITY_TOLERANCE
  );
  if (hasDifferingIntensities) {
    throw new Error(
      'El solver de viga continua de dos vanos requiere que todas las cargas distribuidas tengan la misma intensidad w.'
    );
  }

  const hasPartialOrDiscontinuousLoad = model.loads.some(
    (l) =>
      l.type === 'distributed' &&
      (Math.abs(l.xStart - minSupportX) > LENGTH_TOLERANCE ||
        Math.abs(l.xEnd - maxSupportX) > LENGTH_TOLERANCE)
  );
  if (hasPartialOrDiscontinuousLoad) {
    throw new Error(
      'El solver de viga continua (Caso H4) no admite cargas parciales o discontinuas: la carga debe cubrir continuamente desde el apoyo inicial hasta el apoyo final.'
    );
  }

  // Calculate loading terms on each span for Clapeyron equation:
  // Term1 = (6 * A1 * a1_bar) / L1
  // Term2 = (6 * A2 * b2_bar) / L2
  let term1 = 0;
  let term2 = 0;
  let totalDownwardForce = 0;

  for (const load of model.loads) {
    if (load.type === 'distributed') {
      const effStart = Math.max(s1.x, Math.min(s3.x, load.xStart));
      const effEnd = Math.max(s1.x, Math.min(s3.x, load.xEnd));
      const span = effEnd - effStart;
      const wAvg = 0.5 * (load.wStart + load.wEnd);
      totalDownwardForce += wAvg * span;

      // Span 1 contribution
      const aStart1 = Math.max(s1.x, Math.min(s2.x, effStart)) - s1.x;
      const aEnd1 = Math.max(s1.x, Math.min(s2.x, effEnd)) - s1.x;
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
      const aStart2 = Math.max(s2.x, Math.min(s3.x, effStart));
      const aEnd2 = Math.max(s2.x, Math.min(s3.x, effEnd));
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
      const effStart = Math.max(s1.x, Math.min(s3.x, load.xStart));
      const effEnd = Math.max(s1.x, Math.min(s3.x, load.xEnd));
      const span = effEnd - effStart;
      const totalW = 0.5 * (load.wStart + load.wEnd) * span;
      const centroid =
        Math.abs(load.wStart - load.wEnd) < 1e-9
          ? 0.5 * (effStart + effEnd)
          : effStart +
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
