import type {
  BeamModel,
  FunctionAnalysis,
  MomentSegment,
  DeflectionPlaceholder,
  DeflectionAnalysis,
} from '../types.js';
import type {
  BoundaryConditionRecord,
  ElasticCurveResult,
  ElasticCurveSegment,
} from './types.js';
import { formatNum, formatPolynomial } from './formatter.js';

/**
 * Builds piecewise mathematical equations of the elastic curve and records
 * physical boundary conditions and integration constants.
 */
export function buildElasticCurveResult(
  model: BeamModel,
  moment: FunctionAnalysis<MomentSegment>,
  deflection: DeflectionPlaceholder | DeflectionAnalysis
): ElasticCurveResult {
  const differentialEquation = 'EI · (d²v / dx²) = -M(x)';
  const slopeIntegralEquation = 'EI · θ(x) = ∫ -M(x) dx + C₁';
  const deflectionIntegralEquation = 'EI · v(x) = ∬ -M(x) dx dx + C₁·x + C₂';

  const boundaryConditions: BoundaryConditionRecord[] = [];
  const notes: string[] = [];

  // 1. Identify boundary conditions from model supports
  const sortedSupports = [...model.supports].sort((a, b) => a.x - b.x);

  for (const s of sortedSupports) {
    if (s.type === 'fixed') {
      boundaryConditions.push({
        description: `Empotramiento en apoyo ${s.id} (x = ${formatNum(s.x)} m): desplazamiento nulo.`,
        locationM: s.x,
        conditionType: 'deflection_zero',
        mathematicalForm: `v(${formatNum(s.x)}) = 0`,
      });
      boundaryConditions.push({
        description: `Empotramiento en apoyo ${s.id} (x = ${formatNum(s.x)} m): giro de la sección nulo.`,
        locationM: s.x,
        conditionType: 'slope_zero',
        mathematicalForm: `θ(${formatNum(s.x)}) = 0`,
      });
    } else {
      boundaryConditions.push({
        description: `Apoyo simple ${s.type === 'pin' ? 'articulado' : 'móvil'} en ${s.id} (x = ${formatNum(s.x)} m): desplazamiento nulo.`,
        locationM: s.x,
        conditionType: 'deflection_zero',
        mathematicalForm: `v(${formatNum(s.x)}) = 0`,
      });
    }
  }

  if (!deflection.isImplemented) {
    return {
      status: 'insufficient_elastic_data',
      differentialEquation,
      slopeIntegralEquation,
      deflectionIntegralEquation,
      boundaryConditions,
      segments: [],
      notes: [
        'Ecuaciones elásticas no calculadas: se requiere definir el módulo de elasticidad E (GPa) y el momento de inercia Iz (cm⁴) para integrar la rigidez flexionante EI.',
      ],
    };
  }

  const EI = deflection.EI;

  // Global integration constants
  // C1 = theta(0) in rad
  // C2 = v(0) in meters
  const C1 = deflection.endSlopes.thetaLeft;
  const C2 = deflection.evaluate(0);

  const integrationConstants = {
    C1: Number(C1.toFixed(8)),
    C2: Number(C2.toFixed(8)),
    descriptionC1: `C₁ = EI·θ(0) = ${formatNum(EI * C1, 4)} kN·m² (θ(0) = ${formatNum(C1, 6)} rad)`,
    descriptionC2: `C₂ = EI·v(0) = ${formatNum(EI * C2, 4)} kN·m³ (v(0) = ${formatNum(C2 * 1000, 4)} mm)`,
  };

  // 2. Build equations for each segment
  const segments: ElasticCurveSegment[] = [];

  for (let k = 0; k < moment.segments.length; k++) {
    const mSeg = moment.segments[k]!;
    const xStart = mSeg.xStart;
    const xEnd = mSeg.xEnd;
    const spanM = xEnd - xStart;

    const isGlobalX = Math.abs(xStart) < 1e-9;
    const varName = isGlobalX ? 'x' : 'ξ';
    const localCoordinateNote = isGlobalX
      ? 'Variable longitudinal x ∈ [0, ' + formatNum(xEnd) + '] m'
      : `Variable local ξ = (x - ${formatNum(xStart)}) m, con x ∈ [${formatNum(xStart)}, ${formatNum(xEnd)}] m`;

    // M(xi) = d0 + d1*xi + d2*xi^2 + d3*xi^3  [kN*m]
    const mCoeffs = [mSeg.d0, mSeg.d1, mSeg.d2, mSeg.d3];
    const momentEquation = `M(${varName}) = ${formatPolynomial(mCoeffs, varName, { order: 'descending' })} kN·m`;

    // Evaluate thetaStart and yStart at xStart from deflection solver
    const thetaStart = deflection.evaluateSlope(xStart); // rad
    const yStart = deflection.evaluate(xStart); // m

    // EI * theta(xi) = EI*thetaStart - d0*xi - (d1/2)*xi^2 - (d2/3)*xi^3 - (d3/4)*xi^4  [kN*m^2]
    const eiThetaCoeffs = [
      EI * thetaStart,
      -mSeg.d0,
      -0.5 * mSeg.d1,
      -(1 / 3) * mSeg.d2,
      -0.25 * mSeg.d3,
    ];
    const slopeEquation = `EI·θ(${varName}) = ${formatPolynomial(eiThetaCoeffs, varName, { order: 'descending' })} kN·m²`;

    // EI * v(xi) = EI*yStart + (EI*thetaStart)*xi - (d0/2)*xi^2 - (d1/6)*xi^3 - (d2/12)*xi^4 - (d3/20)*xi^5  [kN*m^3]
    const eiYCoeffs = [
      EI * yStart,
      EI * thetaStart,
      -0.5 * mSeg.d0,
      -(1 / 6) * mSeg.d1,
      -(1 / 12) * mSeg.d2,
      -(1 / 20) * mSeg.d3,
    ];
    const deflectionEquation = `EI·v(${varName}) = ${formatPolynomial(eiYCoeffs, varName, { order: 'descending' })} kN·m³`;

    segments.push({
      segmentIndex: k + 1,
      xStart: Number(xStart.toFixed(4)),
      xEnd: Number(xEnd.toFixed(4)),
      spanM: Number(spanM.toFixed(4)),
      momentEquation,
      slopeEquation,
      deflectionEquation,
      localCoordinateNote,
    });
  }

  notes.push(
    'Ecuaciones polinómicas analíticas exactas por tramos obtenidas mediante doble integración directa de Euler-Bernoulli EI·v\'\'(x) = -M(x).'
  );
  notes.push(
    'Convención de deflexión: v(x) > 0 indica desplazamiento hacia abajo (descenso flexional); v(x) < 0 indica levantamiento hacia arriba.'
  );

  return {
    status: 'exact_analytical',
    differentialEquation,
    slopeIntegralEquation,
    deflectionIntegralEquation,
    flexuralRigidityEI: Number(EI.toFixed(1)),
    boundaryConditions,
    integrationConstants,
    segments,
    notes,
  };
}

