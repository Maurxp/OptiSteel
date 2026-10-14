import { LENGTH_TOLERANCE } from './constants.js';
import type {
  BeamMaterial,
  BeamModel,
  BeamSection,
  CriticalPoint,
  DeflectionAnalysis,
  DeflectionSegment,
  MomentSegment,
  SlopeSegment,
  ValueExtremum,
} from './types.js';

export class ElasticityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElasticityError';
  }
}

/**
 * Calculates flexural rigidity EI in kN*m^2 from material and section:
 * - E: Young's modulus in GPa (1 GPa = 1e6 kN/m^2)
 * - Iz: Moment of inertia in cm^4 (1 cm^4 = 1e-8 m^4)
 * - EI = E * 1e6 * Iz * 1e-8 = E * Iz * 1e-2 [kN*m^2]
 */
export function calculateFlexuralRigidity(
  material?: BeamMaterial,
  section?: BeamSection
): number {
  if (!material || !section) {
    throw new ElasticityError(
      'Se requieren propiedades de material (E en GPa) y sección (Iz en cm^4) para calcular deformaciones.'
    );
  }

  if (!Number.isFinite(material.E) || material.E <= 0) {
    throw new ElasticityError(
      `Módulo de elasticidad E inválido (${material.E}). Debe ser un número estrictamente positivo en GPa.`
    );
  }

  if (!Number.isFinite(section.Iz) || section.Iz <= 0) {
    throw new ElasticityError(
      `Momento de inercia Iz inválido (${section.Iz}). Debe ser un número estrictamente positivo en cm^4.`
    );
  }

  return material.E * section.Iz * 1e-2; // kN*m^2
}

/**
 * Solves for all real roots of a cubic equation:
 *   A*x^3 + B*x^2 + C*x + D = 0
 * using Cardano's analytical formulas.
 */
export function solveCubicRoots(
  A: number,
  B: number,
  C: number,
  D: number
): number[] {
  const roots: number[] = [];
  const eps = 1e-13;

  if (Math.abs(A) < eps) {
    // Quadratic: B*x^2 + C*x + D = 0
    if (Math.abs(B) < eps) {
      // Linear: C*x + D = 0
      if (Math.abs(C) > eps) {
        roots.push(-D / C);
      }
      return roots;
    }
    const discr = C * C - 4 * B * D;
    if (discr >= 0) {
      const sqrtD = Math.sqrt(Math.max(0, discr));
      roots.push((-C + sqrtD) / (2 * B));
      roots.push((-C - sqrtD) / (2 * B));
    }
    return roots;
  }

  // Depressed cubic: t^3 + p*t + q = 0, with x = t - a/3
  const a = B / A;
  const b = C / A;
  const c = D / A;

  const a3 = a / 3;
  const p = b - a * a3;
  const q = c - b * a3 + 2 * a3 ** 3;

  const p3 = p / 3;
  const q2 = q / 2;
  const discr = q2 * q2 + p3 ** 3;

  if (discr < -eps) {
    // 3 distinct real roots (casus irreducibilis)
    const r = Math.sqrt(-(p3 ** 3));
    const phi = Math.acos(Math.max(-1, Math.min(1, -q2 / r)));
    const s = 2 * Math.cbrt(r);
    roots.push(s * Math.cos(phi / 3) - a3);
    roots.push(s * Math.cos((phi + 2 * Math.PI) / 3) - a3);
    roots.push(s * Math.cos((phi + 4 * Math.PI) / 3) - a3);
  } else if (discr > eps) {
    // 1 real root
    const sqrtD = Math.sqrt(discr);
    const u = Math.cbrt(-q2 + sqrtD);
    const v = Math.cbrt(-q2 - sqrtD);
    roots.push(u + v - a3);
  } else {
    // Real root with multiplicity
    const u = Math.cbrt(-q2);
    roots.push(2 * u - a3);
    roots.push(-u - a3);
  }

  return roots;
}

/**
 * Finds all real roots of the slope polynomial theta(xi) on [0, h]:
 *   theta(xi) = t0 + t1*xi + t2*xi^2 + t3*xi^3 + t4*xi^4
 *
 * Algorithm:
 * 1. Computes the derivative theta'(xi) = t1 + 2*t2*xi + 3*t3*xi^2 + 4*t4*xi^3.
 * 2. Solves theta'(xi) = 0 analytically via solveCubicRoots() to find all stationary points of theta.
 * 3. These critical points partition [0, h] into sub-intervals where theta(xi) is strictly monotonic.
 * 4. Checks for multiple/tangential roots at each critical point (where theta = 0 and theta' = 0).
 * 5. On each monotonic sub-interval [r_j, r_{j+1}], if theta changes sign, finds the unique root
 *    via bisection/Brent down to 1e-11 m tolerance.
 */
export function findSlopeRootsOnSegment(
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  t4: number,
  h: number
): number[] {
  const evalTheta = (xi: number): number =>
    t0 + t1 * xi + t2 * xi * xi + t3 * xi ** 3 + t4 * xi ** 4;

  const foundRoots: number[] = [];

  // Derivative coefficients of theta':
  // theta'(xi) = 4*t4*xi^3 + 3*t3*xi^2 + 2*t2*xi + t1
  const critCandidates = solveCubicRoots(4 * t4, 3 * t3, 2 * t2, t1);

  // Filter real critical points strictly inside (0, h)
  const interiorCrits = critCandidates
    .filter((xi) => Number.isFinite(xi) && xi > 1e-9 && xi < h - 1e-9)
    .sort((a, b) => a - b);

  // Deduplicate critical points
  const critPoints: number[] = [0];
  for (const c of interiorCrits) {
    if (Math.abs(c - critPoints[critPoints.length - 1]!) > 1e-8) {
      critPoints.push(c);
    }
  }
  if (Math.abs(h - critPoints[critPoints.length - 1]!) > 1e-8) {
    critPoints.push(h);
  } else {
    critPoints[critPoints.length - 1] = h;
  }

  // 1. Check for exact / tangential roots at the critical points and endpoints
  for (const c of critPoints) {
    if (Math.abs(evalTheta(c)) <= 1e-10) {
      if (!foundRoots.some((r) => Math.abs(r - c) < 1e-7)) {
        foundRoots.push(c);
      }
    }
  }

  // 2. On each strictly monotonic sub-interval [critPoints[j], critPoints[j+1]],
  // if theta changes sign, find the unique interior root
  for (let j = 0; j < critPoints.length - 1; j++) {
    const xA = critPoints[j]!;
    const xB = critPoints[j + 1]!;
    const valA = evalTheta(xA);
    const valB = evalTheta(xB);

    if (valA * valB < 0) {
      let a = xA;
      let b = xB;
      for (let iter = 0; iter < 60; iter++) {
        const mid = 0.5 * (a + b);
        if (Math.abs(b - a) < 1e-11) break;
        const valMid = evalTheta(mid);
        if (valA * valMid <= 0) {
          b = mid;
        } else {
          a = mid;
        }
      }
      const root = 0.5 * (a + b);
      if (!foundRoots.some((r) => Math.abs(r - root) < 1e-7)) {
        foundRoots.push(root);
      }
    }
  }

  return foundRoots.sort((a, b) => a - b);
}

/**
 * Solves the Euler-Bernoulli beam differential equation for deflections and slopes:
 *   EI * d^2y/dx^2 = -M(x)  (where y(x) is positive downward)
 *
 * Exact piecewise analytical double integration across all beam segments.
 */
export function solveDeflections(
  model: BeamModel,
  momentSegments: MomentSegment[],
  EI: number
): DeflectionAnalysis {
  if (momentSegments.length === 0) {
    throw new ElasticityError('No hay tramos de momento flector disponibles para la integración.');
  }

  if (!Number.isFinite(EI) || EI <= 0) {
    throw new ElasticityError(`Rigidez a flexión EI inválida (${EI} kN*m^2). Debe ser > 0.`);
  }

  const L = model.length;

  // 1. Forward particular integration starting from theta_part(0) = 0 and y_part(0) = 0
  // On segment k of length h:
  //   M(xi) = d0 + d1*xi + d2*xi^2 + d3*xi^3
  //   Curvature kappa(xi) = -M(xi)/EI = -(d0 + d1*xi + d2*xi^2 + d3*xi^3)/EI
  interface ParticularSegment {
    xStart: number;
    xEnd: number;
    thetaStartPart: number;
    yStartPart: number;
    m0: number;
    m1: number;
    m2: number;
    m3: number;
  }

  const partSegments: ParticularSegment[] = [];
  let currThetaPart = 0;
  let currYPart = 0;

  for (const seg of momentSegments) {
    const h = seg.xEnd - seg.xStart;
    const m0 = seg.d0 / EI;
    const m1 = seg.d1 / EI;
    const m2 = seg.d2 / EI;
    const m3 = seg.d3 / EI;

    partSegments.push({
      xStart: seg.xStart,
      xEnd: seg.xEnd,
      thetaStartPart: currThetaPart,
      yStartPart: currYPart,
      m0,
      m1,
      m2,
      m3,
    });

    // Advance particular theta and y across this segment to xEnd
    const deltaTheta = -(m0 * h + 0.5 * m1 * h * h + (1 / 3) * m2 * h ** 3 + 0.25 * m3 * h ** 4);
    const deltaY =
      currThetaPart * h -
      (0.5 * m0 * h * h +
        (1 / 6) * m1 * h ** 3 +
        (1 / 12) * m2 * h ** 4 +
        (1 / 20) * m3 * h ** 5);

    currThetaPart += deltaTheta;
    currYPart += deltaY;
  }

  // Evaluator for particular solution at any x in [0, L]
  const evaluateParticular = (
    x: number
  ): { thetaPart: number; yPart: number } => {
    const clampedX = Math.max(0, Math.min(L, x));
    for (const p of partSegments) {
      if (
        clampedX >= p.xStart - LENGTH_TOLERANCE &&
        clampedX <= p.xEnd + LENGTH_TOLERANCE
      ) {
        const xi = clampedX - p.xStart;
        const thetaP =
          p.thetaStartPart -
          (p.m0 * xi +
            0.5 * p.m1 * xi * xi +
            (1 / 3) * p.m2 * xi ** 3 +
            0.25 * p.m3 * xi ** 4);
        const yP =
          p.yStartPart +
          p.thetaStartPart * xi -
          (0.5 * p.m0 * xi * xi +
            (1 / 6) * p.m1 * xi ** 3 +
            (1 / 12) * p.m2 * xi ** 4 +
            (1 / 20) * p.m3 * xi ** 5);
        return { thetaPart: thetaP, yPart: yP };
      }
    }
    const last = partSegments[partSegments.length - 1]!;
    const h = last.xEnd - last.xStart;
    const thetaP =
      last.thetaStartPart -
      (last.m0 * h +
        0.5 * last.m1 * h * h +
        (1 / 3) * last.m2 * h ** 3 +
        0.25 * last.m3 * h ** 4);
    const yP =
      last.yStartPart +
      last.thetaStartPart * h -
      (0.5 * last.m0 * h * h +
        (1 / 6) * last.m1 * h ** 3 +
        (1 / 12) * last.m2 * h ** 4 +
        (1 / 20) * last.m3 * h ** 5);
    return { thetaPart: thetaP, yPart: yP };
  };

  // 2. Solve global boundary constants C1 = theta(0) and C2 = y(0):
  // General total solution:
  //   theta(x) = C1 + thetaPart(x)
  //   y(x) = C2 + C1*x + yPart(x)
  let C1 = 0; // theta(0) in rad
  let C2 = 0; // y(0) in m

  const supports = [...model.supports].sort((a, b) => a.x - b.x);

  // Case 1: Cantilever (single fixed support)
  if (supports.length === 1 && supports[0]?.type === 'fixed') {
    const xs = supports[0].x;
    const { thetaPart: thP, yPart: yP } = evaluateParticular(xs);
    // Boundary conditions at xs: theta(xs) = 0 and y(xs) = 0
    // C1 + thP = 0 => C1 = -thP
    // C2 + C1*xs + yP = 0 => C2 = -C1*xs - yP
    C1 = -thP;
    C2 = -C1 * xs - yP;
  }
  // Case 2: Two simple supports (pin/roller) at x1 < x2
  else if (supports.length === 2) {
    const s1 = supports[0]!;
    const s2 = supports[1]!;
    const x1 = s1.x;
    const x2 = s2.x;
    const span = x2 - x1;

    if (Math.abs(span) < LENGTH_TOLERANCE) {
      throw new ElasticityError('Apoyos coincidentes en el solucionador de deflexiones.');
    }

    const { yPart: yP1 } = evaluateParticular(x1);
    const { yPart: yP2 } = evaluateParticular(x2);

    // Boundary conditions: y(x1) = 0, y(x2) = 0
    // C2 + C1*x1 + yP1 = 0
    // C2 + C1*x2 + yP2 = 0
    // Subtracting: C1*(x2 - x1) + (yP2 - yP1) = 0 => C1 = -(yP2 - yP1) / (x2 - x1)
    C1 = -(yP2 - yP1) / span;
    C2 = -C1 * x1 - yP1;
  } else {
    throw new ElasticityError(
      `El solucionador de deflexiones isostático requiere 1 empotramiento o 2 apoyos simples. Recibidos: ${supports.length}.`
    );
  }

  // 3. Build exact analytical polynomial segments for slope and deflection
  const deflectionSegments: DeflectionSegment[] = [];
  const slopeSegments: SlopeSegment[] = [];

  for (let k = 0; k < partSegments.length; k++) {
    const p = partSegments[k]!;
    const h = p.xEnd - p.xStart;

    // Slope theta_k(xi) = t0 + t1*xi + t2*xi^2 + t3*xi^3 + t4*xi^4
    const t0 = C1 + p.thetaStartPart;
    const t1 = -p.m0;
    const t2 = -0.5 * p.m1;
    const t3 = -(1 / 3) * p.m2;
    const t4 = -0.25 * p.m3;

    const thetaStart = t0;
    const thetaEnd = t0 + t1 * h + t2 * h * h + t3 * h ** 3 + t4 * h ** 4;

    slopeSegments.push({
      xStart: p.xStart,
      xEnd: p.xEnd,
      t0,
      t1,
      t2,
      t3,
      t4,
      thetaStart,
      thetaEnd,
    });

    // Deflection y_k(xi) = y0 + y1*xi + y2*xi^2 + y3*xi^3 + y4*xi^4 + y5*xi^5
    const y0 = C2 + C1 * p.xStart + p.yStartPart;
    const y1 = t0;
    const y2 = -0.5 * p.m0;
    const y3 = -(1 / 6) * p.m1;
    const y4 = -(1 / 12) * p.m2;
    const y5 = -(1 / 20) * p.m3;

    const yStart = y0;
    const yEnd =
      y0 + y1 * h + y2 * h * h + y3 * h ** 3 + y4 * h ** 4 + y5 * h ** 5;

    deflectionSegments.push({
      xStart: p.xStart,
      xEnd: p.xEnd,
      y0,
      y1,
      y2,
      y3,
      y4,
      y5,
      yStart,
      yEnd,
    });
  }

  // 4. Evaluators
  const evaluateSlope = (x: number): number => {
    const clampedX = Math.max(0, Math.min(L, x));
    for (const seg of slopeSegments) {
      if (
        clampedX >= seg.xStart - LENGTH_TOLERANCE &&
        clampedX <= seg.xEnd + LENGTH_TOLERANCE
      ) {
        const xi = clampedX - seg.xStart;
        return (
          seg.t0 +
          seg.t1 * xi +
          seg.t2 * xi * xi +
          seg.t3 * xi ** 3 +
          seg.t4 * xi ** 4
        );
      }
    }
    const last = slopeSegments[slopeSegments.length - 1]!;
    const xi = last.xEnd - last.xStart;
    return (
      last.t0 +
      last.t1 * xi +
      last.t2 * xi * xi +
      last.t3 * xi ** 3 +
      last.t4 * xi ** 4
    );
  };

  const evaluateDeflection = (x: number): number => {
    const clampedX = Math.max(0, Math.min(L, x));
    for (const seg of deflectionSegments) {
      if (
        clampedX >= seg.xStart - LENGTH_TOLERANCE &&
        clampedX <= seg.xEnd + LENGTH_TOLERANCE
      ) {
        const xi = clampedX - seg.xStart;
        return (
          seg.y0 +
          seg.y1 * xi +
          seg.y2 * xi * xi +
          seg.y3 * xi ** 3 +
          seg.y4 * xi ** 4 +
          seg.y5 * xi ** 5
        );
      }
    }
    const last = deflectionSegments[deflectionSegments.length - 1]!;
    const xi = last.xEnd - last.xStart;
    return (
      last.y0 +
      last.y1 * xi +
      last.y2 * xi * xi +
      last.y3 * xi ** 3 +
      last.y4 * xi ** 4 +
      last.y5 * xi ** 5
    );
  };

  // 5. Critical Points and Analytical Root Finding for Max Deflection (where theta = 0)
  const criticalPoints: CriticalPoint[] = [];

  for (let k = 0; k < deflectionSegments.length; k++) {
    const dSeg = deflectionSegments[k]!;
    const sSeg = slopeSegments[k]!;

    // Boundary points
    criticalPoints.push({
      x: dSeg.xStart,
      value: dSeg.yStart,
      type: 'boundary',
      description: `Deflexión en x=${dSeg.xStart.toFixed(4)} m`,
    });
    criticalPoints.push({
      x: dSeg.xEnd,
      value: dSeg.yEnd,
      type: 'boundary',
      description: `Deflexión en x=${dSeg.xEnd.toFixed(4)} m`,
    });

    // Isolate all real roots of slope polynomial theta(xi) = 0 on [0, h]
    const h = sSeg.xEnd - sSeg.xStart;
    const rootsOnSeg = findSlopeRootsOnSegment(
      sSeg.t0,
      sSeg.t1,
      sSeg.t2,
      sSeg.t3,
      sSeg.t4,
      h
    );

    for (const xiRoot of rootsOnSeg) {
      if (xiRoot > LENGTH_TOLERANCE && xiRoot < h - LENGTH_TOLERANCE) {
        const xRoot = sSeg.xStart + xiRoot;
        const yVal = evaluateDeflection(xRoot);
        criticalPoints.push({
          x: xRoot,
          value: yVal,
          type: 'local_max',
          description: `Punto estacionario de deflexión máxima (theta=0) en x=${xRoot.toFixed(4)} m`,
        });
      }
    }
  }

  // Also record support points explicitly
  for (const s of supports) {
    criticalPoints.push({
      x: s.x,
      value: evaluateDeflection(s.x),
      type: 'boundary',
      description: `Deflexión en apoyo ${s.id} (x=${s.x} m)`,
    });
  }

  // Compute extrema
  let maxDownward: ValueExtremum = { x: 0, value: 0 };
  let maxUpward: ValueExtremum = { x: 0, value: 0 };
  let maxAbsolute: ValueExtremum = { x: 0, value: 0 };

  for (const pt of criticalPoints) {
    if (pt.value > maxDownward.value) {
      maxDownward = { x: pt.x, value: pt.value };
    }
    if (pt.value < maxUpward.value) {
      maxUpward = { x: pt.x, value: pt.value };
    }
    if (Math.abs(pt.value) > maxAbsolute.value) {
      maxAbsolute = { x: pt.x, value: Math.abs(pt.value) };
    }
  }

  return {
    isImplemented: true,
    segments: deflectionSegments,
    criticalPoints,
    maxDownward,
    maxUpward,
    maxAbsolute,
    endSlopes: {
      thetaLeft: evaluateSlope(0),
      thetaRight: evaluateSlope(L),
    },
    evaluate: evaluateDeflection,
    evaluateSlope,
    EI,
  };
}
