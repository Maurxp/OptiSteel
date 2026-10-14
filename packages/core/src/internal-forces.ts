import {
  FORCE_TOLERANCE,
  LENGTH_TOLERANCE,
  MOMENT_TOLERANCE,
} from './constants.js';
import type {
  BeamModel,
  CriticalPoint,
  Discontinuity,
  FunctionAnalysis,
  MomentSegment,
  Reaction,
  ShearSegment,
  ValueExtremum,
} from './types.js';

interface TransitionNode {
  x: number;
  reactions: Reaction[];
  pointForces: number; // sum of downward P at this node
  momentLoads: number; // sum of CCW applied M at this node
}

export function buildInternalForces(
  model: BeamModel,
  reactions: Reaction[]
): {
  shear: FunctionAnalysis<ShearSegment>;
  moment: FunctionAnalysis<MomentSegment>;
} {
  const L = model.length;

  // 1. Collect all distinct transition points x
  const xSet = new Set<number>();
  xSet.add(0);
  xSet.add(L);

  for (const r of reactions) {
    xSet.add(roundCoordinate(r.x));
  }

  for (const load of model.loads) {
    switch (load.type) {
      case 'point':
        xSet.add(roundCoordinate(load.x));
        break;
      case 'moment':
        xSet.add(roundCoordinate(load.x));
        break;
      case 'distributed':
        xSet.add(roundCoordinate(load.xStart));
        xSet.add(roundCoordinate(load.xEnd));
        break;
    }
  }

  const sortedX = Array.from(xSet).sort((a, b) => a - b);

  // Group reactions and loads by transition node
  const nodes: TransitionNode[] = sortedX.map((x) => ({
    x,
    reactions: reactions.filter(
      (r) => Math.abs(r.x - x) < LENGTH_TOLERANCE
    ),
    pointForces: model.loads
      .filter((l) => l.type === 'point' && Math.abs(l.x - x) < LENGTH_TOLERANCE)
      .reduce((sum, l) => sum + (l.type === 'point' ? l.P : 0), 0),
    momentLoads: model.loads
      .filter((l) => l.type === 'moment' && Math.abs(l.x - x) < LENGTH_TOLERANCE)
      .reduce((sum, l) => sum + (l.type === 'moment' ? l.M : 0), 0),
  }));

  const shearSegments: ShearSegment[] = [];
  const momentSegments: MomentSegment[] = [];
  const shearDiscontinuities: Discontinuity[] = [];
  const momentDiscontinuities: Discontinuity[] = [];

  // Initial values before x = 0
  let currentV = 0;
  let currentM = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    // Apply concentrated reactions and loads at this node to compute the (+) side limit
    const vBefore = currentV;
    const mBefore = currentM;

    let deltaV = -node.pointForces;
    // An applied counter-clockwise external moment causes a negative jump of -M in sagging moment
    let deltaM = -node.momentLoads;

    for (const r of node.reactions) {
      deltaV += r.Ry;
      if (r.Mr !== undefined) {
        // CCW reaction moment reduces sagging bending moment
        deltaM -= r.Mr;
      }
    }

    const vAfter = vBefore + deltaV;
    const mAfter = mBefore + deltaM;

    // Discontinuities are recorded for interior points (0 < x < L)
    if (
      Math.abs(deltaV) > FORCE_TOLERANCE &&
      i > 0 &&
      i < nodes.length - 1
    ) {
      shearDiscontinuities.push({
        x: node.x,
        valueBefore: vBefore,
        valueAfter: vAfter,
        jump: deltaV,
      });
    }

    if (
      Math.abs(deltaM) > MOMENT_TOLERANCE &&
      i > 0 &&
      i < nodes.length - 1
    ) {
      momentDiscontinuities.push({
        x: node.x,
        valueBefore: mBefore,
        valueAfter: mAfter,
        jump: deltaM,
      });
    }

    currentV = vAfter;
    currentM = mAfter;

    // If there is a next node, build the continuous segment between node[i] and node[i+1]
    if (i < nodes.length - 1) {
      const nextNode = nodes[i + 1];
      if (!nextNode) continue;

      const xStart = node.x;
      const xEnd = nextNode.x;
      const h = xEnd - xStart;

      // Find active distributed loads on this interval (xStart, xEnd)
      const xMid = 0.5 * (xStart + xEnd);
      let wStartTotal = 0;
      let wEndTotal = 0;

      for (const load of model.loads) {
        if (
          load.type === 'distributed' &&
          load.xStart <= xMid &&
          load.xEnd >= xMid
        ) {
          const span = load.xEnd - load.xStart;
          const slope = (load.wEnd - load.wStart) / span;
          const wAtStart = load.wStart + slope * (xStart - load.xStart);
          const wAtEnd = load.wStart + slope * (xEnd - load.xStart);
          wStartTotal += wAtStart;
          wEndTotal += wAtEnd;
        }
      }

      const s = (wEndTotal - wStartTotal) / h;

      // Polynomials on xi in [0, h]:
      // V(xi) = c0 + c1*xi + c2*xi^2
      const c0 = currentV;
      const c1 = -wStartTotal;
      const c2 = -0.5 * s;

      const vEndLeft = c0 + c1 * h + c2 * h * h;

      // M(xi) = d0 + d1*xi + d2*xi^2 + d3*xi^3
      const d0 = currentM;
      const d1 = c0;
      const d2 = 0.5 * c1;
      const d3 = (1 / 3) * c2;

      const mEndLeft = d0 + d1 * h + d2 * h * h + d3 * h * h * h;

      shearSegments.push({
        xStart,
        xEnd,
        c0,
        c1,
        c2,
        vStartRight: c0,
        vEndLeft,
      });

      momentSegments.push({
        xStart,
        xEnd,
        d0,
        d1,
        d2,
        d3,
        mStartRight: d0,
        mEndLeft,
      });

      // Update current values to the left limit of the next node
      currentV = vEndLeft;
      currentM = mEndLeft;
    }
  }

  // 2. Evaluator functions
  const evaluateShear = (x: number, side: 'left' | 'right' = 'right'): number => {
    const clampedX = Math.max(0, Math.min(L, x));
    if (shearSegments.length === 0) return 0;

    for (let i = 0; i < shearSegments.length; i++) {
      const seg = shearSegments[i];
      if (!seg) continue;

      if (side === 'left') {
        if (
          clampedX > seg.xStart + LENGTH_TOLERANCE &&
          clampedX <= seg.xEnd + LENGTH_TOLERANCE
        ) {
          const xi = clampedX - seg.xStart;
          return seg.c0 + seg.c1 * xi + seg.c2 * xi * xi;
        }
        if (i === 0 && clampedX <= seg.xStart + LENGTH_TOLERANCE) {
          return seg.c0;
        }
      } else {
        // side === 'right' (default)
        if (
          clampedX >= seg.xStart - LENGTH_TOLERANCE &&
          clampedX < seg.xEnd - LENGTH_TOLERANCE
        ) {
          const xi = clampedX - seg.xStart;
          return seg.c0 + seg.c1 * xi + seg.c2 * xi * xi;
        }
        if (
          i === shearSegments.length - 1 &&
          clampedX >= seg.xEnd - LENGTH_TOLERANCE
        ) {
          const xi = seg.xEnd - seg.xStart;
          return seg.c0 + seg.c1 * xi + seg.c2 * xi * xi;
        }
      }
    }

    const lastSeg = shearSegments[shearSegments.length - 1];
    if (!lastSeg) return 0;
    const xi = lastSeg.xEnd - lastSeg.xStart;
    return lastSeg.c0 + lastSeg.c1 * xi + lastSeg.c2 * xi * xi;
  };

  const evaluateMoment = (
    x: number,
    side: 'left' | 'right' = 'right'
  ): number => {
    const clampedX = Math.max(0, Math.min(L, x));
    if (momentSegments.length === 0) return 0;

    for (let i = 0; i < momentSegments.length; i++) {
      const seg = momentSegments[i];
      if (!seg) continue;

      if (side === 'left') {
        if (
          clampedX > seg.xStart + LENGTH_TOLERANCE &&
          clampedX <= seg.xEnd + LENGTH_TOLERANCE
        ) {
          const xi = clampedX - seg.xStart;
          return (
            seg.d0 + seg.d1 * xi + seg.d2 * xi * xi + seg.d3 * xi * xi * xi
          );
        }
        if (i === 0 && clampedX <= seg.xStart + LENGTH_TOLERANCE) {
          return seg.d0;
        }
      } else {
        // side === 'right'
        if (
          clampedX >= seg.xStart - LENGTH_TOLERANCE &&
          clampedX < seg.xEnd - LENGTH_TOLERANCE
        ) {
          const xi = clampedX - seg.xStart;
          return (
            seg.d0 + seg.d1 * xi + seg.d2 * xi * xi + seg.d3 * xi * xi * xi
          );
        }
        if (
          i === momentSegments.length - 1 &&
          clampedX >= seg.xEnd - LENGTH_TOLERANCE
        ) {
          const xi = seg.xEnd - seg.xStart;
          return (
            seg.d0 + seg.d1 * xi + seg.d2 * xi * xi + seg.d3 * xi * xi * xi
          );
        }
      }
    }

    const lastSeg = momentSegments[momentSegments.length - 1];
    if (!lastSeg) return 0;
    const xi = lastSeg.xEnd - lastSeg.xStart;
    return (
      lastSeg.d0 +
      lastSeg.d1 * xi +
      lastSeg.d2 * xi * xi +
      lastSeg.d3 * xi * xi * xi
    );
  };

  // 3. Exact Critical Points Analysis for Shear V(x)
  const shearPoints: CriticalPoint[] = [];

  for (const seg of shearSegments) {
    shearPoints.push({
      x: seg.xStart,
      value: seg.vStartRight,
      type: 'boundary',
      description: `Cortante inicial en x=${seg.xStart} m`,
    });
    shearPoints.push({
      x: seg.xEnd,
      value: seg.vEndLeft,
      type: 'boundary',
      description: `Cortante final en x=${seg.xEnd} m`,
    });

    // Check if shear crosses zero inside this segment
    // c2*xi^2 + c1*xi + c0 = 0
    if (Math.abs(seg.c2) < 1e-12) {
      if (Math.abs(seg.c1) > 1e-12) {
        const xiZero = -seg.c0 / seg.c1;
        const h = seg.xEnd - seg.xStart;
        if (xiZero > LENGTH_TOLERANCE && xiZero < h - LENGTH_TOLERANCE) {
          shearPoints.push({
            x: seg.xStart + xiZero,
            value: 0,
            type: 'zero_crossing',
            description: `Cruce por cero del cortante en x=${(seg.xStart + xiZero).toFixed(4)} m`,
          });
        }
      }
    } else {
      const discr = seg.c1 * seg.c1 - 4 * seg.c2 * seg.c0;
      if (discr >= 0) {
        const sqrtD = Math.sqrt(discr);
        const xi1 = (-seg.c1 + sqrtD) / (2 * seg.c2);
        const xi2 = (-seg.c1 - sqrtD) / (2 * seg.c2);
        const h = seg.xEnd - seg.xStart;
        for (const xi of [xi1, xi2]) {
          if (xi > LENGTH_TOLERANCE && xi < h - LENGTH_TOLERANCE) {
            shearPoints.push({
              x: seg.xStart + xi,
              value: 0,
              type: 'zero_crossing',
              description: `Cruce por cero del cortante en x=${(seg.xStart + xi).toFixed(4)} m`,
            });
          }
        }
      }
    }
  }

  for (const disc of shearDiscontinuities) {
    shearPoints.push({
      x: disc.x,
      value: disc.valueBefore,
      type: 'discontinuity',
      description: `Límite por la izquierda en x=${disc.x} m`,
    });
    shearPoints.push({
      x: disc.x,
      value: disc.valueAfter,
      type: 'discontinuity',
      description: `Límite por la derecha en x=${disc.x} m`,
    });
  }

  const shearExtrema = computeExtrema(shearPoints);

  // 4. Exact Critical Points Analysis for Moment M(x)
  const momentPoints: CriticalPoint[] = [];

  for (let i = 0; i < momentSegments.length; i++) {
    const mSeg = momentSegments[i];
    const vSeg = shearSegments[i];
    if (!mSeg || !vSeg) continue;

    momentPoints.push({
      x: mSeg.xStart,
      value: mSeg.mStartRight,
      type: 'boundary',
      description: `Momento inicial en x=${mSeg.xStart} m`,
    });
    momentPoints.push({
      x: mSeg.xEnd,
      value: mSeg.mEndLeft,
      type: 'boundary',
      description: `Momento final en x=${mSeg.xEnd} m`,
    });

    // Stationary points of M(x) where dM/dx = V(xi) = 0
    const h = mSeg.xEnd - mSeg.xStart;

    if (Math.abs(vSeg.c2) < 1e-12) {
      if (Math.abs(vSeg.c1) > 1e-12) {
        const xiRoot = -vSeg.c0 / vSeg.c1;
        if (xiRoot > LENGTH_TOLERANCE && xiRoot < h - LENGTH_TOLERANCE) {
          const xRoot = mSeg.xStart + xiRoot;
          const mVal =
            mSeg.d0 +
            mSeg.d1 * xiRoot +
            mSeg.d2 * xiRoot * xiRoot +
            mSeg.d3 * xiRoot * xiRoot * xiRoot;
          momentPoints.push({
            x: xRoot,
            value: mVal,
            type: vSeg.c1 < 0 ? 'local_max' : 'local_min',
            description: `Extremo interior del momento flector (V=0) en x=${xRoot.toFixed(4)} m`,
          });
        }
      }
    } else {
      const discr = vSeg.c1 * vSeg.c1 - 4 * vSeg.c2 * vSeg.c0;
      if (discr >= 0) {
        const sqrtD = Math.sqrt(discr);
        const xi1 = (-vSeg.c1 + sqrtD) / (2 * vSeg.c2);
        const xi2 = (-vSeg.c1 - sqrtD) / (2 * vSeg.c2);
        for (const xi of [xi1, xi2]) {
          if (xi > LENGTH_TOLERANCE && xi < h - LENGTH_TOLERANCE) {
            const xRoot = mSeg.xStart + xi;
            const mVal =
              mSeg.d0 +
              mSeg.d1 * xi +
              mSeg.d2 * xi * xi +
              mSeg.d3 * xi * xi * xi;
            momentPoints.push({
              x: xRoot,
              value: mVal,
              type: 'local_max',
              description: `Extremo interior del momento flector (V=0) en x=${xRoot.toFixed(4)} m`,
            });
          }
        }
      }
    }
  }

  for (const disc of momentDiscontinuities) {
    momentPoints.push({
      x: disc.x,
      value: disc.valueBefore,
      type: 'discontinuity',
      description: `Límite por la izquierda en salto de momento en x=${disc.x} m`,
    });
    momentPoints.push({
      x: disc.x,
      value: disc.valueAfter,
      type: 'discontinuity',
      description: `Límite por la derecha en salto de momento en x=${disc.x} m`,
    });
  }

  const momentExtrema = computeExtrema(momentPoints);

  return {
    shear: {
      segments: shearSegments,
      criticalPoints: shearPoints,
      maxPositive: shearExtrema.maxPositive,
      maxNegative: shearExtrema.maxNegative,
      maxAbsolute: shearExtrema.maxAbsolute,
      discontinuities: shearDiscontinuities,
      evaluate: evaluateShear,
    },
    moment: {
      segments: momentSegments,
      criticalPoints: momentPoints,
      maxPositive: momentExtrema.maxPositive,
      maxNegative: momentExtrema.maxNegative,
      maxAbsolute: momentExtrema.maxAbsolute,
      discontinuities: momentDiscontinuities,
      evaluate: evaluateMoment,
    },
  };
}

function computeExtrema(points: CriticalPoint[]): {
  maxPositive: ValueExtremum;
  maxNegative: ValueExtremum;
  maxAbsolute: ValueExtremum;
} {
  let maxPos: ValueExtremum = { x: 0, value: 0 };
  let maxNeg: ValueExtremum = { x: 0, value: 0 };
  let maxAbs: ValueExtremum = { x: 0, value: 0 };

  for (const pt of points) {
    if (pt.value > maxPos.value) {
      maxPos = { x: pt.x, value: pt.value };
    }
    if (pt.value < maxNeg.value) {
      maxNeg = { x: pt.x, value: pt.value };
    }
    if (Math.abs(pt.value) > maxAbs.value) {
      maxAbs = { x: pt.x, value: Math.abs(pt.value) };
    }
  }

  return {
    maxPositive: maxPos,
    maxNegative: maxNeg,
    maxAbsolute: maxAbs,
  };
}

function roundCoordinate(val: number): number {
  return Math.round(val * 1e9) / 1e9;
}
