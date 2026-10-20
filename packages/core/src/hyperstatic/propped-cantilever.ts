import {
  FORCE_TOLERANCE,
  LENGTH_TOLERANCE,
  MOMENT_TOLERANCE,
} from '../constants.js';
import type {
  BeamAnalysisResult,
  BeamModel,
  CriticalPoint,
  DeflectionAnalysis,
  DeflectionPlaceholder,
  EquilibriumCheck,
  Reaction,
} from '../types.js';
import { calculateFlexuralRigidity, solveDeflections } from '../elasticity.js';
import { buildInternalForces } from '../internal-forces.js';

export interface ProppedCantileverReactionsResult {
  reactions: Reaction[];
  equilibrium: EquilibriumCheck;
}

/**
 * Calculates exact reactions for a propped cantilever beam (empotrada-apoyada)
 * subjected to transverse point loads, using the Method of Forces (Flexibility Method).
 *
 * Mechanical Formulation:
 * Primary structure: Cantilever beam clamped at the fixed support.
 * Redundant force: Vertical reaction R_roller at the simple support.
 * Compatibility condition: Vertical deflection at the simple support must be zero:
 *   v(x_roller) = delta_0 - R_roller * f_roller = 0
 *
 * For a point load P at distance a from the fixed support (a in [0, L]):
 *   delta_0 = P * a^2 * (3*L - a) / (6 * EI)
 *   f_roller = L^3 / (3 * EI)
 *
 * Therefore:
 *   R_roller = P * a^2 * (3*L - a) / (2 * L^3)
 *   R_fixed = P - R_roller
 *   M_fixed_react = P * a - R_roller * L  (+CCW)
 */
export function calculateProppedCantileverReactions(
  model: BeamModel
): ProppedCantileverReactionsResult {
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  if (supports.length !== 2) {
    throw new Error(
      `El solver de viga empotrada-apoyada requiere exactamente 2 apoyos. Recibidos: ${supports.length}.`
    );
  }

  const sFixed = supports.find((s) => s.type === 'fixed');
  const sSimple = supports.find((s) => s.type === 'roller' || s.type === 'pin');

  if (!sFixed || !sSimple) {
    throw new Error(
      'El solver de viga empotrada-apoyada requiere un apoyo empotrado y un apoyo simple.'
    );
  }

  const L = Math.abs(sSimple.x - sFixed.x);
  if (L <= 0) {
    throw new Error('Distancia nula entre apoyos en viga empotrada-apoyada.');
  }

  // Determine orientation: is fixed support at the left or right?
  const isFixedAtLeft = sFixed.x < sSimple.x;

  let totalDownwardForce = 0;
  let redundantR = 0; // Upward reaction at simple support
  let loadMomentAboutFixed = 0;

  for (const load of model.loads) {
    if (load.type === 'point') {
      totalDownwardForce += load.P;
      // Distance 'a' from the fixed support to the load
      const a = isFixedAtLeft ? load.x - sFixed.x : sFixed.x - load.x;

      if (a < -LENGTH_TOLERANCE || a > L + LENGTH_TOLERANCE) {
        throw new Error(
          `Carga puntual en x=${load.x} m fuera del tramo entre apoyos [${Math.min(sFixed.x, sSimple.x)}, ${Math.max(sFixed.x, sSimple.x)}]. El solver H1 no admite cargas en voladizo exterior.`
        );
      }

      // Clamp 'a' al tramo [0, L] para absorber ruido numérico de punto flotante dentro de LENGTH_TOLERANCE
      const aClamped = Math.max(0, Math.min(L, a));

      // R_simple contribution = P * a^2 * (3*L - a) / (2 * L^3)
      const rContrib = (load.P * aClamped * aClamped * (3 * L - aClamped)) / (2 * L * L * L);
      redundantR += rContrib;
      loadMomentAboutFixed += load.P * aClamped;
    } else if (load.type === 'distributed') {
      const loadMinX = Math.min(load.xStart, load.xEnd);
      const loadMaxX = Math.max(load.xStart, load.xEnd);
      const minSuppX = Math.min(sFixed.x, sSimple.x);
      const maxSuppX = Math.max(sFixed.x, sSimple.x);

      if (
        loadMinX < minSuppX - LENGTH_TOLERANCE ||
        loadMaxX > maxSuppX + LENGTH_TOLERANCE
      ) {
        throw new Error(
          `Carga distribuida [${load.xStart}, ${load.xEnd}] m fuera del tramo entre apoyos [${minSuppX}, ${maxSuppX}]. El solver H2 no admite cargas en voladizo exterior.`
        );
      }

      // Map distributed load interval to local distance 'a' from fixed support
      let a1: number;
      let a2: number;
      let w1: number;
      let w2: number;

      if (isFixedAtLeft) {
        a1 = Math.max(0, Math.min(L, load.xStart - sFixed.x));
        a2 = Math.max(0, Math.min(L, load.xEnd - sFixed.x));
        const span = load.xEnd - load.xStart;
        const slope = span > 0 ? (load.wEnd - load.wStart) / span : 0;
        w1 = load.wStart + slope * (a1 + sFixed.x - load.xStart);
        w2 = load.wStart + slope * (a2 + sFixed.x - load.xStart);
      } else {
        a1 = Math.max(0, Math.min(L, sFixed.x - load.xEnd));
        a2 = Math.max(0, Math.min(L, sFixed.x - load.xStart));
        const span = load.xEnd - load.xStart;
        const slope = span > 0 ? (load.wEnd - load.wStart) / span : 0;
        // x = sFixed.x - a
        w1 = load.wStart + slope * (sFixed.x - a1 - load.xStart);
        w2 = load.wStart + slope * (sFixed.x - a2 - load.xStart);
      }

      if (a2 > a1) {
        const da = a2 - a1;
        const force = 0.5 * (w1 + w2) * da;
        totalDownwardForce += force;

        // Centroid distance from fixed support
        const centroidA =
          Math.abs(w1 - w2) < 1e-9
            ? 0.5 * (a1 + a2)
            : a1 + (da * (w1 + 2 * w2)) / (3 * (w1 + w2));
        loadMomentAboutFixed += force * centroidA;

        // Flexibility contribution: \int_{a1}^{a2} w(a) * a^2 * (3L - a) da / (2 * L^3)
        // With w(a) = c0 + c1 * a
        const slopeA = (w2 - w1) / da;
        const c0 = w1 - slopeA * a1;
        const c1 = slopeA;

        // \int (c0 + c1*a) * (3L*a^2 - a^3) da = \int [3L*c0*a^2 + (3L*c1 - c0)*a^3 - c1*a^4] da
        const term2 = 3 * L * c0;
        const term3 = 3 * L * c1 - c0;
        const term4 = -c1;

        const evalInt = (a: number): number =>
          (term2 / 3) * a ** 3 + (term3 / 4) * a ** 4 + (term4 / 5) * a ** 5;

        const integralVal = evalInt(a2) - evalInt(a1);
        const rContrib = integralVal / (2 * L ** 3);
        redundantR += rContrib;
      }
    } else {
      throw new Error(
        `Tipo de carga '${load.type}' aún no soportada en el solver de viga empotrada-apoyada.`
      );
    }
  }

  // Equilibrium equations for the fixed support
  const rSimpleY = redundantR;
  const rFixedY = totalDownwardForce - rSimpleY;

  // Moment equilibrium about fixed support:
  // Downward loads create moment 'loadMomentAboutFixed'
  // Upward simple support reaction at distance L creates restoring moment rSimpleY * L
  // M_react balances the net clockwise moment:
  let mFixedReact: number;
  if (isFixedAtLeft) {
    // CCW reaction moment: M_react + rSimpleY * L - loadMoment = 0 => M_react = loadMoment - rSimpleY * L
    mFixedReact = loadMomentAboutFixed - rSimpleY * L;
  } else {
    // Fixed at right: CW reaction moment
    mFixedReact = -(loadMomentAboutFixed - rSimpleY * L);
  }

  const reactions: Reaction[] = [];
  reactions.push({
    supportId: sFixed.id,
    supportType: 'fixed',
    x: sFixed.x,
    Ry: rFixedY,
    Mr: mFixedReact,
  });

  reactions.push({
    supportId: sSimple.id,
    supportType: sSimple.type,
    x: sSimple.x,
    Ry: rSimpleY,
  });

  // Sort reactions by x coordinate
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
 * Analyzes a propped cantilever hyperstatic beam model (Case H1),
 * computing reactions via flexibility compatibility, internal forces V(x) and M(x),
 * inflection points, and exact elastic deflection curve v(x).
 */
export function analyzeProppedCantileverBeam(
  model: BeamModel
): BeamAnalysisResult {
  const { reactions, equilibrium } =
    calculateProppedCantileverReactions(model);

  const { shear, moment } = buildInternalForces(model, reactions);

  // Enrich moment.criticalPoints with interior zero-crossings (puntos de inflexión donde M=0)
  for (const seg of moment.segments) {
    // For linear segments (M(xi) = d0 + d1*xi)
    if (Math.abs(seg.d2) < 1e-12 && Math.abs(seg.d3) < 1e-12) {
      if (Math.abs(seg.d1) > 1e-9) {
        const xiZero = -seg.d0 / seg.d1;
        const h = seg.xEnd - seg.xStart;
        if (xiZero > 1e-7 && xiZero < h - 1e-7) {
          const xInflection = seg.xStart + xiZero;
          const alreadyExists = moment.criticalPoints.some(
            (cp) => cp.type === 'zero_crossing' && Math.abs(cp.x - xInflection) < 1e-4
          );
          if (!alreadyExists) {
            const cp: CriticalPoint = {
              x: xInflection,
              value: 0,
              type: 'zero_crossing',
              description: `Punto de inflexión interior (M=0) en x=${xInflection.toFixed(4)} m`,
            };
            moment.criticalPoints.push(cp);
          }
        }
      }
    }
  }

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
