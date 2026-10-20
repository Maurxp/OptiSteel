import {
  FORCE_TOLERANCE,
  LENGTH_TOLERANCE,
  MOMENT_TOLERANCE,
} from '../constants.js';
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

export interface FixedFixedReactionsResult {
  reactions: Reaction[];
  equilibrium: EquilibriumCheck;
}

/**
 * Calculates exact reactions and fixed-end reactive moments for a bi-clamped (biempotrada)
 * beam subjected to transverse point and distributed loads, using Euler-Bernoulli compatibility.
 *
 * Mechanical Formulation (Fixed-Fixed Beam):
 * Both ends x1 and x2 are clamped: v(x1) = 0, theta(x1) = 0, v(x2) = 0, theta(x2) = 0.
 *
 * For a downward point load P at distance a from left support A (b = L - a):
 *   MA_react = + P * a * b^2 / L^2  (+CCW)
 *   MB_react = - P * a^2 * b / L^2  (-CW)
 *   RA = P * b^2 * (3*a + b) / L^3
 *   RB = P * a^2 * (a + 3*b) / L^3
 *
 * For a uniform load w over [a1, a2] from left support A:
 *   MA_react = (w / L^2) * [ (L^2*(a2^2 - a1^2)/2) - (2*L*(a2^3 - a1^3)/3) + (a2^4 - a1^4)/4 ]
 *   MB_react = - (w / L^2) * [ (L*(a2^3 - a1^3)/3) - (a2^4 - a1^4)/4 ]
 *   RA = (w / L^3) * [ L^3*(a2 - a1) - L*(a2^3 - a1^3) + (a2^4 - a1^4)/2 ]
 *   RB = (w / L^3) * [ L*(a2^3 - a1^3) - (a2^4 - a1^4)/2 ]
 *
 * Canonical case H3 (full span [0, L] with uniform load w):
 *   RA = RB = w * L / 2
 *   MA_react = + w * L^2 / 12  (+CCW)
 *   MB_react = - w * L^2 / 12  (-CW)
 */
export function calculateFixedFixedReactions(
  model: BeamModel
): FixedFixedReactionsResult {
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  if (supports.length !== 2) {
    throw new Error(
      `El solver de viga biempotrada requiere exactamente 2 apoyos. Recibidos: ${supports.length}.`
    );
  }

  const sA = supports[0]!;
  const sB = supports[1]!;

  if (sA.type !== 'fixed' || sB.type !== 'fixed') {
    throw new Error(
      'El solver de viga biempotrada requiere que ambos apoyos sean empotramientos (fixed).'
    );
  }

  const L = sB.x - sA.x;
  if (L <= 0) {
    throw new Error('Distancia nula o negativa entre apoyos en viga biempotrada.');
  }

  let totalDownwardForce = 0;
  let rAy = 0;
  let rBy = 0;
  let mAReact = 0;
  let mBReact = 0;

  for (const load of model.loads) {
    if (load.type === 'point') {
      const a = load.x - sA.x;

      if (a < -LENGTH_TOLERANCE || a > L + LENGTH_TOLERANCE) {
        throw new Error(
          `Carga puntual en x=${load.x} m fuera del tramo entre empotramientos [${sA.x}, ${sB.x}]. El solver H3 no admite cargas en voladizo exterior.`
        );
      }

      // Clamp 'a' al tramo [0, L] para absorber ruido numérico de punto flotante dentro de LENGTH_TOLERANCE
      const aClamped = Math.max(0, Math.min(L, a));
      const b = L - aClamped;
      const P = load.P;
      totalDownwardForce += P;

      rAy += (P * b * b * (3 * aClamped + b)) / (L * L * L);
      rBy += (P * aClamped * aClamped * (aClamped + 3 * b)) / (L * L * L);
      mAReact += (P * aClamped * b * b) / (L * L);
      mBReact -= (P * aClamped * aClamped * b) / (L * L);
    } else if (load.type === 'distributed') {
      const loadMinX = Math.min(load.xStart, load.xEnd);
      const loadMaxX = Math.max(load.xStart, load.xEnd);

      if (
        loadMinX < sA.x - LENGTH_TOLERANCE ||
        loadMaxX > sB.x + LENGTH_TOLERANCE
      ) {
        throw new Error(
          `Carga distribuida [${load.xStart}, ${load.xEnd}] m fuera del tramo entre empotramientos [${sA.x}, ${sB.x}]. El solver H3 no admite cargas en voladizo exterior.`
        );
      }

      const a1 = Math.max(0, Math.min(L, load.xStart - sA.x));
      const a2 = Math.max(0, Math.min(L, load.xEnd - sA.x));

      if (a2 > a1) {
        const da = a2 - a1;
        const span = load.xEnd - load.xStart;
        const slope = span > 0 ? (load.wEnd - load.wStart) / span : 0;
        const w1 = load.wStart + slope * (a1 + sA.x - load.xStart);
        const w2 = load.wStart + slope * (a2 + sA.x - load.xStart);
        const force = 0.5 * (w1 + w2) * da;
        totalDownwardForce += force;

        // If load is uniform (w1 === w2)
        if (Math.abs(w1 - w2) < 1e-9) {
          const w = w1;
          const a1sq = a1 * a1;
          const a2sq = a2 * a2;
          const a1cb = a1sq * a1;
          const a2cb = a2sq * a2;
          const a1q = a1sq * a1sq;
          const a2q = a2sq * a2sq;

          const intMA =
            (L * L * (a2sq - a1sq)) / 2 -
            (2 * L * (a2cb - a1cb)) / 3 +
            (a2q - a1q) / 4;
          const intMB = (L * (a2cb - a1cb)) / 3 - (a2q - a1q) / 4;
          const intRA =
            L * L * L * (a2 - a1) - L * (a2cb - a1cb) + (a2q - a1q) / 2;
          const intRB = L * (a2cb - a1cb) - (a2q - a1q) / 2;

          mAReact += (w / (L * L)) * intMA;
          mBReact -= (w / (L * L)) * intMB;
          rAy += (w / (L * L * L)) * intRA;
          rBy += (w / (L * L * L)) * intRB;
        } else {
          // General linear load w(a) = c0 + c1 * a
          const slopeA = (w2 - w1) / da;
          const c0 = w1 - slopeA * a1;
          const c1 = slopeA;

          // MA integrand: (c0 + c1*a) * (a*L^2 - 2*L*a^2 + a^3)
          // = c0*L^2*a + (c1*L^2 - 2*L*c0)*a^2 + (c0 - 2*L*c1)*a^3 + c1*a^4
          const evalIntMA = (a: number): number =>
            (c0 * L * L * a * a) / 2 +
            ((c1 * L * L - 2 * L * c0) * a ** 3) / 3 +
            ((c0 - 2 * L * c1) * a ** 4) / 4 +
            (c1 * a ** 5) / 5;

          // MB integrand: (c0 + c1*a) * (L*a^2 - a^3) = c0*L*a^2 + (c1*L - c0)*a^3 - c1*a^4
          const evalIntMB = (a: number): number =>
            (c0 * L * a ** 3) / 3 +
            ((c1 * L - c0) * a ** 4) / 4 -
            (c1 * a ** 5) / 5;

          // RB integrand: (c0 + c1*a) * (3*L*a^2 - 2*a^3) = 3*L*c0*a^2 + (3*L*c1 - 2*c0)*a^3 - 2*c1*a^4
          const evalIntRB = (a: number): number =>
            c0 * L * a ** 3 +
            ((3 * L * c1 - 2 * c0) * a ** 4) / 4 -
            (2 * c1 * a ** 5) / 5;

          const intMA = evalIntMA(a2) - evalIntMA(a1);
          const intMB = evalIntMB(a2) - evalIntMB(a1);
          const intRB = evalIntRB(a2) - evalIntRB(a1);

          mAReact += intMA / (L * L);
          mBReact -= intMB / (L * L);
          const rbPart = intRB / (L * L * L);
          rBy += rbPart;
          rAy += force - rbPart;
        }
      }
    } else {
      throw new Error(
        `Tipo de carga '${load.type}' aún no soportada en el solver de viga biempotrada.`
      );
    }
  }

  const reactions: Reaction[] = [
    {
      supportId: sA.id,
      supportType: 'fixed',
      x: sA.x,
      Ry: rAy,
      Mr: mAReact,
    },
    {
      supportId: sB.id,
      supportType: 'fixed',
      x: sB.x,
      Ry: rBy,
      Mr: mBReact,
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
 * Analyzes a fixed-fixed hyperstatic beam model (Case H3),
 * computing reactions and reactive moments, internal forces V(x) and M(x),
 * inflection points, and exact elastic deflection curve v(x).
 */
export function analyzeFixedFixedBeam(model: BeamModel): BeamAnalysisResult {
  const { reactions, equilibrium } = calculateFixedFixedReactions(model);
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
