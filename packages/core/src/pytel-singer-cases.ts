import type { BeamModel } from './types.js';

export type VerificationStatus =
  | 'transcribed_from_primary'
  | 'independently_derived_and_verified'
  | 'pedagogical_approximation';

export interface PytelSingerCaseDefinition {
  caseNumber: number;
  page: number;
  title: string;
  supportType: 'cantilever' | 'simply_supported';
  loadType: 'point' | 'distributed_uniform' | 'distributed_triangular' | 'moment';
  description: string;
  parameters: string[];
  formulas: {
    reactions: string;
    maxShear: string;
    maxMoment: string;
    maxMomentLocation: string;
    endSlopeLeft: string;
    endSlopeRight: string;
    elasticCurve: string;
    maxDeflection: string;
    maxDeflectionLocation: string;
    centerDeflection?: string;
  };
  verificationStatus: VerificationStatus;
  notes?: string;
  createModel: (params: Record<string, number>) => BeamModel;
  evaluateTheoretical: (
    params: Record<string, number>,
    EI: number
  ) => {
    RA: number;
    RB?: number;
    MA?: number;
    maxMoment: number;
    maxMomentLocation: number;
    thetaLeft: number;
    thetaRight: number;
    maxDeflection: number;
    maxDeflectionLocation: number;
    evaluateDeflection: (x: number) => number;
    isApproximate?: boolean;
    exactMaxDeflection?: number;
  };
}

/**
 * Complete Reference Library of the 12 Canonical Beam Cases
 * Source: Pytel & Singer, "Resistencia de Materiales", 4th Ed., Tabla 6-2 (pp. 218-219)
 */
export const PYTEL_SINGER_CASES: Record<number, PytelSingerCaseDefinition> = {
  // --------------------------------------------------------------------------
  // CASO 1: Voladizo con carga puntual P en el extremo libre
  // --------------------------------------------------------------------------
  1: {
    caseNumber: 1,
    page: 218,
    title: 'Voladizo con carga puntual en el extremo libre',
    supportType: 'cantilever',
    loadType: 'point',
    description: 'Viga en voladizo empotrada en x=0 con una fuerza puntual P dirigida hacia abajo en x=L.',
    parameters: ['L', 'P'],
    formulas: {
      reactions: 'RA = P, MA = P*L (antihorario)',
      maxShear: 'V_max = P (en x in [0, L))',
      maxMoment: 'M_max = -P*L (hogging en x=0)',
      maxMomentLocation: 'x = 0',
      endSlopeLeft: 'theta(0) = 0',
      endSlopeRight: 'theta(L) = P*L^2 / (2*EI)',
      elasticCurve: 'y(x) = (P*x^2 / (6*EI)) * (3*L - x)',
      maxDeflection: 'delta_max = P*L^3 / (3*EI)',
      maxDeflectionLocation: 'x = L',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [{ id: 'S_fixed', type: 'fixed', x: 0 }],
      loads: [{ id: 'P_tip', type: 'point', x: p.L!, P: p.P! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const P = p.P!;
      return {
        RA: P,
        MA: P * L,
        maxMoment: -P * L,
        maxMomentLocation: 0,
        thetaLeft: 0,
        thetaRight: (P * L * L) / (2 * EI),
        maxDeflection: (P * L ** 3) / (3 * EI),
        maxDeflectionLocation: L,
        evaluateDeflection: (x) => ((P * x * x) / (6 * EI)) * (3 * L - x),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 2: Voladizo con carga puntual P en posición intermedia x=a
  // --------------------------------------------------------------------------
  2: {
    caseNumber: 2,
    page: 218,
    title: 'Voladizo con carga puntual intermedia',
    supportType: 'cantilever',
    loadType: 'point',
    description: 'Viga en voladizo empotrada en x=0 con una fuerza P a distancia a del empotramiento.',
    parameters: ['L', 'a', 'P'],
    formulas: {
      reactions: 'RA = P, MA = P*a',
      maxShear: 'V_max = P (en [0, a))',
      maxMoment: 'M_max = -P*a',
      maxMomentLocation: 'x = 0',
      endSlopeLeft: 'theta(0) = 0',
      endSlopeRight: 'theta(L) = P*a^2 / (2*EI)',
      elasticCurve: '0<=x<=a: y(x)=(P*x^2/(6*EI))*(3*a - x); a<=x<=L: y(x)=(P*a^2/(6*EI))*(3*x - a)',
      maxDeflection: 'delta_max = (P*a^2 / (6*EI)) * (3*L - a)',
      maxDeflectionLocation: 'x = L',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [{ id: 'S_fixed', type: 'fixed', x: 0 }],
      loads: [{ id: 'P_a', type: 'point', x: p.a!, P: p.P! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const a = p.a!;
      const P = p.P!;
      return {
        RA: P,
        MA: P * a,
        maxMoment: -P * a,
        maxMomentLocation: 0,
        thetaLeft: 0,
        thetaRight: (P * a * a) / (2 * EI),
        maxDeflection: ((P * a * a) / (6 * EI)) * (3 * L - a),
        maxDeflectionLocation: L,
        evaluateDeflection: (x) => {
          if (x <= a) {
            return ((P * x * x) / (6 * EI)) * (3 * a - x);
          }
          return ((P * a * a) / (6 * EI)) * (3 * x - a);
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 3: Voladizo con carga uniforme w en todo el vano
  // --------------------------------------------------------------------------
  3: {
    caseNumber: 3,
    page: 218,
    title: 'Voladizo con carga uniformemente distribuida',
    supportType: 'cantilever',
    loadType: 'distributed_uniform',
    description: 'Viga en voladizo empotrada en x=0 con carga uniforme w en [0, L].',
    parameters: ['L', 'w'],
    formulas: {
      reactions: 'RA = w*L, MA = w*L^2 / 2',
      maxShear: 'V_max = w*L (en x=0)',
      maxMoment: 'M_max = -w*L^2 / 2',
      maxMomentLocation: 'x = 0',
      endSlopeLeft: 'theta(0) = 0',
      endSlopeRight: 'theta(L) = w*L^3 / (6*EI)',
      elasticCurve: 'y(x) = (w*x^2 / (24*EI)) * (6*L^2 - 4*L*x + x^2)',
      maxDeflection: 'delta_max = w*L^4 / (8*EI)',
      maxDeflectionLocation: 'x = L',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [{ id: 'S_fixed', type: 'fixed', x: 0 }],
      loads: [{ id: 'W_full', type: 'distributed', xStart: 0, xEnd: p.L!, wStart: p.w!, wEnd: p.w! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const w = p.w!;
      return {
        RA: w * L,
        MA: (w * L * L) / 2,
        maxMoment: -(w * L * L) / 2,
        maxMomentLocation: 0,
        thetaLeft: 0,
        thetaRight: (w * L ** 3) / (6 * EI),
        maxDeflection: (w * L ** 4) / (8 * EI),
        maxDeflectionLocation: L,
        evaluateDeflection: (x) => ((w * x * x) / (24 * EI)) * (6 * L * L - 4 * L * x + x * x),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 4: Voladizo con carga triangular (0 en empotramiento, w en extremo)
  // --------------------------------------------------------------------------
  4: {
    caseNumber: 4,
    page: 218,
    title: 'Voladizo con carga triangular creciente',
    supportType: 'cantilever',
    loadType: 'distributed_triangular',
    description: 'Viga en voladizo con carga lineal de 0 en x=0 a w en x=L.',
    parameters: ['L', 'w'],
    formulas: {
      reactions: 'RA = w*L / 2, MA = w*L^2 / 6',
      maxShear: 'V_max = w*L / 2 (en x=0)',
      maxMoment: 'M_max = -w*L^2 / 6',
      maxMomentLocation: 'x = 0',
      endSlopeLeft: 'theta(0) = 0',
      endSlopeRight: 'theta(L) = w*L^3 / (24*EI)',
      elasticCurve: 'y(x) = (w*x^2 / (120*EI*L)) * (10*L^3 - 10*L^2*x + 5*L*x^2 - x^3)',
      maxDeflection: 'delta_max = w*L^4 / (30*EI)',
      maxDeflectionLocation: 'x = L',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [{ id: 'S_fixed', type: 'fixed', x: 0 }],
      // En la Tabla 6-2 Caso 4, la carga triangular es máxima en el empotramiento y cero en el extremo libre
      loads: [{ id: 'W_tri', type: 'distributed', xStart: 0, xEnd: p.L!, wStart: p.w!, wEnd: 0 }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const w = p.w!;
      return {
        RA: (w * L) / 2,
        MA: (w * L * L) / 6,
        maxMoment: -(w * L * L) / 6,
        maxMomentLocation: 0,
        thetaLeft: 0,
        thetaRight: (w * L ** 3) / (24 * EI),
        maxDeflection: (w * L ** 4) / (30 * EI),
        maxDeflectionLocation: L,
        evaluateDeflection: (x) =>
          ((w * x * x) / (120 * EI * L)) * (10 * L ** 3 - 10 * L * L * x + 5 * L * x * x - x ** 3),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 5: Voladizo con momento concentrado M en el extremo libre
  // --------------------------------------------------------------------------
  5: {
    caseNumber: 5,
    page: 218,
    title: 'Voladizo con momento concentrado en el extremo libre',
    supportType: 'cantilever',
    loadType: 'moment',
    description: 'Viga en voladizo con momento horario M en x=L (curvatura cóncava hacia abajo / hogging).',
    parameters: ['L', 'M'],
    formulas: {
      reactions: 'RA = 0, MA = M (antihorario)',
      maxShear: 'V_max = 0',
      maxMoment: 'M_max = -M',
      maxMomentLocation: 'Todo x in [0, L]',
      endSlopeLeft: 'theta(0) = 0',
      endSlopeRight: 'theta(L) = M*L / EI',
      elasticCurve: 'y(x) = M*x^2 / (2*EI)',
      maxDeflection: 'delta_max = M*L^2 / (2*EI)',
      maxDeflectionLocation: 'x = L',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [{ id: 'S_fixed', type: 'fixed', x: 0 }],
      // Momento horario M_ext = -M en x=L
      loads: [{ id: 'M_tip', type: 'moment', x: p.L!, M: -p.M! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const M = p.M!;
      return {
        RA: 0,
        MA: M,
        maxMoment: -M,
        maxMomentLocation: 0,
        thetaLeft: 0,
        thetaRight: (M * L) / EI,
        maxDeflection: (M * L * L) / (2 * EI),
        maxDeflectionLocation: L,
        evaluateDeflection: (x) => (M * x * x) / (2 * EI),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 6: Viga simplemente apoyada con carga puntual central
  // --------------------------------------------------------------------------
  6: {
    caseNumber: 6,
    page: 218,
    title: 'Viga simplemente apoyada con carga puntual central',
    supportType: 'simply_supported',
    loadType: 'point',
    description: 'Viga con apoyos simples en x=0 y x=L con fuerza puntual P en x=L/2.',
    parameters: ['L', 'P'],
    formulas: {
      reactions: 'RA = RB = P / 2',
      maxShear: 'V_max = P / 2',
      maxMoment: 'M_max = P*L / 4',
      maxMomentLocation: 'x = L/2',
      endSlopeLeft: 'theta_L = P*L^2 / (16*EI)',
      endSlopeRight: 'theta_R = -P*L^2 / (16*EI)',
      elasticCurve: '0<=x<=L/2: y(x) = (P*x / (12*EI)) * (3*L^2/4 - x^2)',
      maxDeflection: 'delta_max = P*L^3 / (48*EI)',
      maxDeflectionLocation: 'x = L/2',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      loads: [{ id: 'P_mid', type: 'point', x: p.L! / 2, P: p.P! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const P = p.P!;
      return {
        RA: P / 2,
        RB: P / 2,
        maxMoment: (P * L) / 4,
        maxMomentLocation: L / 2,
        thetaLeft: (P * L * L) / (16 * EI),
        thetaRight: -(P * L * L) / (16 * EI),
        maxDeflection: (P * L ** 3) / (48 * EI),
        maxDeflectionLocation: L / 2,
        evaluateDeflection: (x) => {
          const xEval = x <= L / 2 ? x : L - x;
          return ((P * xEval) / (12 * EI)) * (0.75 * L * L - xEval * xEval);
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 7: Viga simplemente apoyada con carga puntual excéntrica
  // --------------------------------------------------------------------------
  7: {
    caseNumber: 7,
    page: 219,
    title: 'Viga simplemente apoyada con carga puntual excéntrica',
    supportType: 'simply_supported',
    loadType: 'point',
    description: 'Viga con apoyos simples en x=0 y x=L con fuerza puntual P en x=a (b = L - a).',
    parameters: ['L', 'a', 'P'],
    formulas: {
      reactions: 'RA = P*b / L, RB = P*a / L',
      maxShear: 'V_max = max(RA, RB)',
      maxMoment: 'M_max = P*a*b / L',
      maxMomentLocation: 'x = a',
      endSlopeLeft: 'theta_L = P*b*(L^2 - b^2) / (6*EI*L)',
      endSlopeRight: 'theta_R = -P*a*(L^2 - a^2) / (6*EI*L)',
      elasticCurve: '0<=x<=a: y(x) = (P*b*x / (6*EI*L))*(L^2 - x^2 - b^2)',
      maxDeflection: 'a>=b: delta_max = P*b*(L^2 - b^2)^(3/2) / (9*sqrt(3)*EI*L)',
      maxDeflectionLocation: 'a>=b: x = sqrt((L^2 - b^2)/3)',
      centerDeflection: 'delta_mid = (P*b / (48*EI)) * (3*L^2 - 4*b^2) cuando a > b',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      loads: [{ id: 'P_ecc', type: 'point', x: p.a!, P: p.P! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const a = p.a!;
      const b = L - a;
      const P = p.P!;

      const thetaLeft = (P * b * (L * L - b * b)) / (6 * EI * L);
      const thetaRight = -(P * a * (L * L - a * a)) / (6 * EI * L);

      let maxDeflection: number;
      let maxDeflectionLocation: number;

      if (a >= b) {
        maxDeflectionLocation = Math.sqrt((L * L - b * b) / 3);
        maxDeflection =
          (P * b * Math.pow(L * L - b * b, 1.5)) / (9 * Math.sqrt(3) * EI * L);
      } else {
        maxDeflectionLocation = L - Math.sqrt((L * L - a * a) / 3);
        maxDeflection =
          (P * a * Math.pow(L * L - a * a, 1.5)) / (9 * Math.sqrt(3) * EI * L);
      }

      return {
        RA: (P * b) / L,
        RB: (P * a) / L,
        maxMoment: (P * a * b) / L,
        maxMomentLocation: a,
        thetaLeft,
        thetaRight,
        maxDeflection,
        maxDeflectionLocation,
        evaluateDeflection: (x) => {
          if (x <= a) {
            return ((P * b * x) / (6 * EI * L)) * (L * L - x * x - b * b);
          }
          return (
            ((P * b) / (6 * EI * L)) *
            ((L / b) * Math.pow(x - a, 3) + (L * L - b * b) * x - x ** 3)
          );
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 8: Viga simplemente apoyada con carga uniforme en todo el vano
  // --------------------------------------------------------------------------
  8: {
    caseNumber: 8,
    page: 219,
    title: 'Viga simplemente apoyada con carga uniforme completa',
    supportType: 'simply_supported',
    loadType: 'distributed_uniform',
    description: 'Viga con apoyos en 0 y L con carga uniforme w en [0, L].',
    parameters: ['L', 'w'],
    formulas: {
      reactions: 'RA = RB = w*L / 2',
      maxShear: 'V_max = w*L / 2',
      maxMoment: 'M_max = w*L^2 / 8',
      maxMomentLocation: 'x = L/2',
      endSlopeLeft: 'theta_L = w*L^3 / (24*EI)',
      endSlopeRight: 'theta_R = -w*L^3 / (24*EI)',
      elasticCurve: 'y(x) = (w*x / (24*EI)) * (L^3 - 2*L*x^2 + x^3)',
      maxDeflection: 'delta_max = 5*w*L^4 / (384*EI)',
      maxDeflectionLocation: 'x = L/2',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      loads: [{ id: 'W_full', type: 'distributed', xStart: 0, xEnd: p.L!, wStart: p.w!, wEnd: p.w! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const w = p.w!;
      return {
        RA: (w * L) / 2,
        RB: (w * L) / 2,
        maxMoment: (w * L * L) / 8,
        maxMomentLocation: L / 2,
        thetaLeft: (w * L ** 3) / (24 * EI),
        thetaRight: -(w * L ** 3) / (24 * EI),
        maxDeflection: (5 * w * L ** 4) / (384 * EI),
        maxDeflectionLocation: L / 2,
        evaluateDeflection: (x) => ((w * x) / (24 * EI)) * (L ** 3 - 2 * L * x * x + x ** 3),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 9: Viga simplemente apoyada con carga triangular en todo el vano
  // --------------------------------------------------------------------------
  9: {
    caseNumber: 9,
    page: 219,
    title: 'Viga simplemente apoyada con carga triangular completa',
    supportType: 'simply_supported',
    loadType: 'distributed_triangular',
    description: 'Viga con apoyos en 0 y L con carga lineal de 0 en x=0 a w en x=L.',
    parameters: ['L', 'w'],
    formulas: {
      reactions: 'RA = w*L / 6, RB = w*L / 3',
      maxShear: 'V_max = w*L / 3 (en x=L)',
      maxMoment: 'M_max = w*L^2 / (9*sqrt(3))',
      maxMomentLocation: 'x = L / sqrt(3) ~ 0.57735 L',
      endSlopeLeft: 'theta_L = 7*w*L^3 / (360*EI)',
      endSlopeRight: 'theta_R = -8*w*L^3 / (360*EI)',
      elasticCurve: 'y(x) = (w*x / (360*EI*L)) * (7*L^4 - 10*L^2*x^2 + 3*x^4)',
      maxDeflection: 'delta_approx = 2.5*w*L^4 / (384*EI); delta_exact = 0.0065223 * w*L^4 / EI',
      maxDeflectionLocation: 'x_approx = 0.519 L; x_exact = sqrt((15 - sqrt(120))/15)*L ~ 0.51933 L',
    },
    verificationStatus: 'pedagogical_approximation',
    notes:
      'En la Tabla 6-2 de Pytel-Singer figura la aproximación pedagógica delta_max = 2.5*w*L^4 / (384*EI) = 0.0065104*w*L^4/EI en x=0.519*L. La solución analítica exacta de dy/dx=0 da x=0.51933*L y delta=0.0065223*w*L^4/EI (discrepancia de -0.18%).',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      loads: [{ id: 'W_tri', type: 'distributed', xStart: 0, xEnd: p.L!, wStart: 0, wEnd: p.w! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const w = p.w!;
      // Exact analytical roots: 7*L^4 - 30*L^2*x^2 + 15*x^4 = 0
      // x^2 = (30 - sqrt(900 - 420)) / 30 = (15 - sqrt(120)) / 15
      const xiFactor = Math.sqrt((15 - Math.sqrt(120)) / 15);
      const exactLocation = xiFactor * L; // ~ 0.51933 L
      const exactMaxDeflection =
        ((w * exactLocation) / (360 * EI * L)) *
        (7 * L ** 4 - 10 * L * L * exactLocation ** 2 + 3 * exactLocation ** 4);

      // Pytel approximation: 2.5 / 384 ~ 0.0065104167
      const approxMaxDeflection = (2.5 * w * L ** 4) / (384 * EI);

      return {
        RA: (w * L) / 6,
        RB: (w * L) / 3,
        maxMoment: (w * L * L) / (9 * Math.sqrt(3)),
        maxMomentLocation: L / Math.sqrt(3),
        thetaLeft: (7 * w * L ** 3) / (360 * EI),
        thetaRight: -(8 * w * L ** 3) / (360 * EI),
        maxDeflection: approxMaxDeflection,
        exactMaxDeflection,
        isApproximate: true,
        maxDeflectionLocation: exactLocation,
        evaluateDeflection: (x) =>
          ((w * x) / (360 * EI * L)) * (7 * L ** 4 - 10 * L * L * x * x + 3 * x ** 4),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 10: Viga simplemente apoyada con carga triangular simétrica
  // --------------------------------------------------------------------------
  10: {
    caseNumber: 10,
    page: 219,
    title: 'Viga simplemente apoyada con carga triangular simétrica',
    supportType: 'simply_supported',
    loadType: 'distributed_triangular',
    description: 'Viga biapoyada con carga triangular simétrica: 0 en apoyos, máxima w en x=L/2.',
    parameters: ['L', 'w'],
    formulas: {
      reactions: 'RA = RB = w*L / 4',
      maxShear: 'V_max = w*L / 4',
      maxMoment: 'M_max = w*L^2 / 12',
      maxMomentLocation: 'x = L/2',
      endSlopeLeft: 'theta_L = 5*w*L^3 / (192*EI)',
      endSlopeRight: 'theta_R = -5*w*L^3 / (192*EI)',
      elasticCurve: '0<=x<=L/2: y(x) = (w*x / (960*EI*L)) * (25*L^4 - 40*L^2*x^2 + 16*x^4)',
      maxDeflection: 'delta_max = w*L^4 / (120*EI)',
      maxDeflectionLocation: 'x = L/2',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      loads: [
        { id: 'W1', type: 'distributed', xStart: 0, xEnd: p.L! / 2, wStart: 0, wEnd: p.w! },
        { id: 'W2', type: 'distributed', xStart: p.L! / 2, xEnd: p.L!, wStart: p.w!, wEnd: 0 },
      ],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const w = p.w!;
      return {
        RA: (w * L) / 4,
        RB: (w * L) / 4,
        maxMoment: (w * L * L) / 12,
        maxMomentLocation: L / 2,
        thetaLeft: (5 * w * L ** 3) / (192 * EI),
        thetaRight: -(5 * w * L ** 3) / (192 * EI),
        maxDeflection: (w * L ** 4) / (120 * EI),
        maxDeflectionLocation: L / 2,
        evaluateDeflection: (x) => {
          const xEval = x <= L / 2 ? x : L - x;
          return (
            ((w * xEval) / (960 * EI * L)) *
            (25 * L ** 4 - 40 * L * L * xEval * xEval + 16 * xEval ** 4)
          );
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 11: Viga simplemente apoyada con momento en apoyo derecho x=L
  // --------------------------------------------------------------------------
  11: {
    caseNumber: 11,
    page: 219,
    title: 'Viga simplemente apoyada con momento concentrado en apoyo derecho',
    supportType: 'simply_supported',
    loadType: 'moment',
    description: 'Viga biapoyada con par concentrado horario M en apoyo derecho x=L (curvatura positiva/sagging).',
    parameters: ['L', 'M'],
    formulas: {
      reactions: 'RA = -M/L (hacia abajo), RB = M/L (hacia arriba)',
      maxShear: 'V = -M/L (constante)',
      maxMoment: 'M_max = M (en x=L)',
      maxMomentLocation: 'x = L',
      endSlopeLeft: 'theta_L = M*L / (6*EI)',
      endSlopeRight: 'theta_R = -M*L / (3*EI)',
      elasticCurve: 'y(x) = (M*x / (6*EI*L)) * (L^2 - x^2)',
      maxDeflection: 'delta_max = M*L^2 / (9*sqrt(3)*EI)',
      maxDeflectionLocation: 'x = L / sqrt(3) ~ 0.57735 L',
      centerDeflection: 'delta_mid = M*L^2 / (16*EI)',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      // Momento antihorario en x=L produce flexión positiva
      loads: [{ id: 'M_right', type: 'moment', x: p.L!, M: p.M! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const M = p.M!;
      return {
        RA: -M / L,
        RB: M / L,
        maxMoment: M,
        maxMomentLocation: L,
        thetaLeft: (M * L) / (6 * EI),
        thetaRight: -(M * L) / (3 * EI),
        maxDeflection: (M * L * L) / (9 * Math.sqrt(3) * EI),
        maxDeflectionLocation: L / Math.sqrt(3),
        evaluateDeflection: (x) => ((M * x) / (6 * EI * L)) * (L * L - x * x),
      };
    },
  },

  // --------------------------------------------------------------------------
  // CASO 12: Viga simplemente apoyada con momento en apoyo izquierdo x=0
  // --------------------------------------------------------------------------
  12: {
    caseNumber: 12,
    page: 219,
    title: 'Viga simplemente apoyada con momento concentrado en apoyo izquierdo',
    supportType: 'simply_supported',
    loadType: 'moment',
    description: 'Viga biapoyada con par concentrado antihorario M en apoyo izquierdo x=0 (flexión positiva).',
    parameters: ['L', 'M'],
    formulas: {
      reactions: 'RA = M/L (hacia arriba), RB = -M/L (hacia abajo)',
      maxShear: 'V = M/L (constante)',
      maxMoment: 'M_max = M (en x=0)',
      maxMomentLocation: 'x = 0',
      endSlopeLeft: 'theta_L = M*L / (3*EI)',
      endSlopeRight: 'theta_R = -M*L / (6*EI)',
      elasticCurve: 'y(x) = (M*x / (6*EI*L)) * (L - x) * (2*L - x)',
      maxDeflection: 'delta_max = M*L^2 / (9*sqrt(3)*EI)',
      maxDeflectionLocation: 'x = (1 - 1/sqrt(3)) * L ~ 0.42265 L',
      centerDeflection: 'delta_mid = M*L^2 / (16*EI)',
    },
    verificationStatus: 'independently_derived_and_verified',
    createModel: (p) => ({
      length: p.L!,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: p.L! },
      ],
      // Momento horario en x=0 produce flexión positiva
      loads: [{ id: 'M_left', type: 'moment', x: 0, M: -p.M! }],
    }),
    evaluateTheoretical: (p, EI) => {
      const L = p.L!;
      const M = p.M!;
      return {
        RA: M / L,
        RB: -M / L,
        maxMoment: M,
        maxMomentLocation: 0,
        thetaLeft: (M * L) / (3 * EI),
        thetaRight: -(M * L) / (6 * EI),
        maxDeflection: (M * L * L) / (9 * Math.sqrt(3) * EI),
        maxDeflectionLocation: (1 - 1 / Math.sqrt(3)) * L,
        evaluateDeflection: (x) => ((M * x) / (6 * EI * L)) * (L - x) * (2 * L - x),
      };
    },
  },
};
