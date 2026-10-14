import {
  FORCE_TOLERANCE,
  MOMENT_TOLERANCE,
  LENGTH_TOLERANCE,
} from './constants.js';
import type {
  BeamModel,
  EquilibriumCheck,
  Reaction,
} from './types.js';

export interface ReactionCalculationResult {
  reactions: Reaction[];
  equilibrium: EquilibriumCheck;
}

/**
 * Computes exact equivalent force and moment about a reference coordinate xRef
 * for any distributed load (uniform, trapezoidal, or triangular).
 */
export function integrateDistributedLoad(
  xStart: number,
  xEnd: number,
  wStart: number,
  wEnd: number,
  xRef: number = 0
): { force: number; momentAboutRef: number } {
  const span = xEnd - xStart;
  if (span <= 0) {
    return { force: 0, momentAboutRef: 0 };
  }

  // w(xi) = wStart + slope * xi, where xi in [0, span]
  // Total force F = (wStart + wEnd) / 2 * span
  const force = 0.5 * (wStart + wEnd) * span;

  // Centroid relative to xStart:
  // centroid_xi = (span / 3) * (wStart + 2*wEnd) / (wStart + wEnd) (if wStart+wEnd > 0)
  let centroidX: number;
  const wSum = wStart + wEnd;
  if (wSum > 1e-15) {
    const centroidOffset = (span / 3) * ((wStart + 2 * wEnd) / wSum);
    centroidX = xStart + centroidOffset;
  } else {
    centroidX = xStart + 0.5 * span;
  }

  // Moment of downward load about xRef (lever arm is x - xRef)
  // Downward force causes a clockwise moment about xRef if x > xRef
  const momentAboutRef = force * (centroidX - xRef);

  return { force, momentAboutRef };
}

/**
 * Calculates reactions for isostatic beams and checks static equilibrium
 */
export function calculateReactions(model: BeamModel): ReactionCalculationResult {
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  const reactions: Reaction[] = [];

  // Calculate total external force and moment contributions from all loads
  let totalExternalForce = 0; // downward sum in kN
  let totalExternalMomentAbout0 = 0; // sum of (P*x + int w*x dx - M_applied)

  for (const load of model.loads) {
    switch (load.type) {
      case 'point': {
        totalExternalForce += load.P;
        totalExternalMomentAbout0 += load.P * load.x;
        break;
      }
      case 'distributed': {
        const { force, momentAboutRef } = integrateDistributedLoad(
          load.xStart,
          load.xEnd,
          load.wStart,
          load.wEnd,
          0
        );
        totalExternalForce += force;
        totalExternalMomentAbout0 += momentAboutRef;
        break;
      }
      case 'moment': {
        // Counter-clockwise applied moment reduces clockwise load moment
        totalExternalMomentAbout0 -= load.M;
        break;
      }
    }
  }

  // Case 1: Cantilever (single fixed support)
  if (supports.length === 1 && supports[0]?.type === 'fixed') {
    const s0 = supports[0];
    const xs = s0.x;

    // Sum of moments of loads about xs:
    let loadMomentAboutXs = 0;
    for (const load of model.loads) {
      switch (load.type) {
        case 'point':
          loadMomentAboutXs += load.P * (load.x - xs);
          break;
        case 'distributed': {
          const { momentAboutRef } = integrateDistributedLoad(
            load.xStart,
            load.xEnd,
            load.wStart,
            load.wEnd,
            xs
          );
          loadMomentAboutXs += momentAboutRef;
          break;
        }
        case 'moment':
          loadMomentAboutXs -= load.M;
          break;
      }
    }

    const Ry = totalExternalForce;
    // Reaction moment balances the net clockwise moment of external loads about xs
    const Mr = loadMomentAboutXs;

    reactions.push({
      supportId: s0.id,
      supportType: 'fixed',
      x: xs,
      Ry,
      Mr,
    });
  }
  // Case 2: Two simple supports (pin/roller or roller/roller)
  else if (supports.length === 2) {
    const s1 = supports[0];
    const s2 = supports[1];
    if (!s1 || !s2) {
      throw new Error('Configuración de apoyos incompleta.');
    }

    const x1 = s1.x;
    const x2 = s2.x;
    const span = x2 - x1;

    if (Math.abs(span) < LENGTH_TOLERANCE) {
      throw new Error(
        'Los apoyos no pueden estar en la misma posición (sistema geométricamente inestable).'
      );
    }

    // Moments about x1:
    // Ry2 * (x2 - x1) - loadMomentAboutX1 = 0
    let loadMomentAboutX1 = 0;
    for (const load of model.loads) {
      switch (load.type) {
        case 'point':
          loadMomentAboutX1 += load.P * (load.x - x1);
          break;
        case 'distributed': {
          const { momentAboutRef } = integrateDistributedLoad(
            load.xStart,
            load.xEnd,
            load.wStart,
            load.wEnd,
            x1
          );
          loadMomentAboutX1 += momentAboutRef;
          break;
        }
        case 'moment':
          loadMomentAboutX1 -= load.M;
          break;
      }
    }

    const Ry2 = loadMomentAboutX1 / span;
    const Ry1 = totalExternalForce - Ry2;

    reactions.push({
      supportId: s1.id,
      supportType: s1.type,
      x: x1,
      Ry: Ry1,
    });
    reactions.push({
      supportId: s2.id,
      supportType: s2.type,
      x: x2,
      Ry: Ry2,
    });
  } else {
    throw new Error(
      `El solucionador isostático requiere exactamente 1 empotramiento o 2 apoyos simples. Recibidos: ${supports.length}.`
    );
  }

  // 3. Rigorous static equilibrium check
  let sumRy = 0;
  let sumReactionMomentsAbout0 = 0;

  for (const r of reactions) {
    sumRy += r.Ry;
    sumReactionMomentsAbout0 += r.Ry * r.x + (r.Mr ?? 0);
  }

  // Vertical equilibrium: sum(Ry) - sum(P_down)
  const sumFy = sumRy - totalExternalForce;

  // Moment equilibrium about x=0:
  // Upward reaction Ry at x produces CCW moment (+Ry*x)
  // Reaction moment Mr is CCW (+Mr)
  // Applied external moment M is CCW (+M)
  // Downward load P at x produces CW moment (-P*x)
  // Net equilibrium sum:
  let appliedMomentsSum = 0;
  for (const load of model.loads) {
    if (load.type === 'moment') {
      appliedMomentsSum += load.M;
    }
  }

  // Downward force moment about 0:
  let downwardForceMomentAbout0 = 0;
  for (const load of model.loads) {
    if (load.type === 'point') {
      downwardForceMomentAbout0 += load.P * load.x;
    } else if (load.type === 'distributed') {
      const { momentAboutRef } = integrateDistributedLoad(
        load.xStart,
        load.xEnd,
        load.wStart,
        load.wEnd,
        0
      );
      downwardForceMomentAbout0 += momentAboutRef;
    }
  }

  const sumM =
    sumReactionMomentsAbout0 + appliedMomentsSum - downwardForceMomentAbout0;

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
