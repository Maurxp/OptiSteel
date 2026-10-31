import type { FunctionAnalysis, MomentSegment, BeamSection } from '../types.js';
import type {
  BendingPeakResult,
  BendingStressResult,
  ExtremeFibersState,
  MaterialsMechanicsOptions,
} from './types.js';
import { formatNum } from './formatter.js';

/**
 * Calculates normal bending stress sigma_max = |M_max| * c / I = |M_max| / S
 * and determines fiber states (tension / compression) according to OptiSteel conventions.
 */
export function calculateBendingStress(
  moment: FunctionAnalysis<MomentSegment>,
  section?: BeamSection,
  options?: MaterialsMechanicsOptions
): BendingStressResult {
  const maxAbsMomentKNm = Math.abs(moment.maxAbsolute.value);
  const locationM = moment.maxAbsolute.x;

  // Determine moment sign at critical position:
  // In OptiSteel conventions:
  // M > 0 is Sagging (+y downward, bottom fiber in tension, top fiber in compression)
  // M < 0 is Hogging (top fiber in tension, bottom fiber in compression)
  const evaluatedM = moment.evaluate(locationM);
  let momentType: 'positive' | 'negative' | 'zero';
  let extremeFibers: ExtremeFibersState;

  const tol = 1e-4;
  if (evaluatedM > tol) {
    momentType = 'positive';
    extremeFibers = {
      top: 'compression',
      bottom: 'tension',
      explanation:
        'Momento flector positivo (sagante): curvatura con concavidad hacia arriba. Produce tracción en las fibras inferiores y compresión en las fibras superiores.',
    };
  } else if (evaluatedM < -tol) {
    momentType = 'negative';
    extremeFibers = {
      top: 'tension',
      bottom: 'compression',
      explanation:
        'Momento flector negativo (hogante): curvatura con convexidad hacia arriba. Produce tracción en las fibras superiores y compresión en las fibras inferiores.',
    };
  } else {
    momentType = 'zero';
    extremeFibers = {
      top: 'neutral',
      bottom: 'neutral',
      explanation: 'Momento flector nulo en la sección crítica analizada.',
    };
  }

  const notes: string[] = [];
  const izCm4 = section?.Iz ?? 0;

  // Resolve distance to extreme fiber c and section modulus Wz (cm^3)
  let sectionModulusCm3: number | undefined = section?.Wz;
  let distanceToExtremeFiberMm: number | undefined = section?.cMm;
  let usedSymmetricHalfHeight = false;

  if (distanceToExtremeFiberMm === undefined && section?.heightMm !== undefined && section.heightMm > 0) {
    distanceToExtremeFiberMm = section.heightMm / 2;
    usedSymmetricHalfHeight = true;
  }

  if (sectionModulusCm3 === undefined || sectionModulusCm3 <= 0) {
    if (distanceToExtremeFiberMm !== undefined && distanceToExtremeFiberMm > 0 && izCm4 > 0) {
      // Iz [cm^4] * 10^4 [mm^4/cm^4] / (c [mm] * 10^3 [mm^3/cm^3]) = (Iz * 10) / c [cm^3]
      sectionModulusCm3 = (izCm4 * 10) / distanceToExtremeFiberMm;
    } else if (section?.type === 'rectangular' && section.widthMm && section.heightMm) {
      // Wz = b * h^2 / 6 in mm^3 -> divide by 1000 for cm^3
      sectionModulusCm3 = (section.widthMm * section.heightMm ** 2) / 6000;
      if (distanceToExtremeFiberMm === undefined) {
        distanceToExtremeFiberMm = section.heightMm / 2;
        usedSymmetricHalfHeight = true;
      }
    }
  } else if (distanceToExtremeFiberMm === undefined && izCm4 > 0 && sectionModulusCm3 > 0) {
    // c = (Iz * 10) / Wz  [mm]
    distanceToExtremeFiberMm = (izCm4 * 10) / sectionModulusCm3;
  }

  if (usedSymmetricHalfHeight) {
    notes.push(
      'Nota de alcance geométrico: El cálculo de c = h/2 asume simetría respecto al eje neutro baricéntrico (c_sup = c_inf = h/2). Para secciones asimétricas (ej. perfiles T o ángulos), debe suministrarse el módulo elástico Wz directo o las distancias baricéntricas reales.'
    );
  }

  const allowableStressMPa =
    options?.allowableBendingStressMPa ?? section?.allowableBendingStressMPa;

  if (!section || izCm4 <= 0) {
    return {
      status: 'insufficient_section_data',
      maxMomentDemandKNm: Number(maxAbsMomentKNm.toFixed(4)),
      maxMomentLocationM: Number(locationM.toFixed(4)),
      momentType,
      extremeFibers,
      momentOfInertiaCm4: izCm4,
      formula: 'σ_max = |M_max| · c / I = |M_max| / S',
      substitution:
        'Cálculo no disponible: se requiere definir el momento de inercia Iz (cm⁴) de la sección.',
      notes: [
        'Para evaluar el esfuerzo normal por flexión se requiere al menos el momento de inercia Iz y la distancia a la fibra extrema c o el módulo de sección elástico Wz.',
      ],
    };
  }

  if (!sectionModulusCm3 || sectionModulusCm3 <= 0) {
    return {
      status: 'insufficient_section_data',
      maxMomentDemandKNm: Number(maxAbsMomentKNm.toFixed(4)),
      maxMomentLocationM: Number(locationM.toFixed(4)),
      momentType,
      extremeFibers,
      momentOfInertiaCm4: izCm4,
      distanceToExtremeFiberMm,
      formula: 'σ_max = |M_max| · c / I = |M_max| / S',
      substitution: `|M_max| = ${formatNum(maxAbsMomentKNm)} kN·m, Iz = ${formatNum(izCm4)} cm⁴. Falta módulo de sección elástico Wz (o altura h / distancia c).`,
      notes: [
        'Se dispone del momento de inercia Iz, pero no del módulo de sección elástico Wz ni de la altura h de la sección.',
        'Especifique la altura h (mm), el semiespesor c (mm) o el módulo resistente Wz (cm³) para computar el esfuerzo en MPa.',
      ],
    };
  }

  // sigma = (|M_max| [kN*m] * 10^6 [N*mm / (kN*m)]) / (Wz [cm^3] * 10^3 [mm^3 / cm^3])
  //       = (|M_max| * 10^3) / Wz  [N/mm^2 = MPa]
  const actualStressMPa = (maxAbsMomentKNm * 1000) / sectionModulusCm3;

  let utilizationRatio: number | undefined;
  let safetyFactor: number | undefined;

  if (allowableStressMPa !== undefined && allowableStressMPa > 0) {
    utilizationRatio = actualStressMPa / allowableStressMPa;
    safetyFactor = actualStressMPa > 1e-6 ? allowableStressMPa / actualStressMPa : undefined;
    if (actualStressMPa > allowableStressMPa) {
      notes.push(
        `El esfuerzo real (${formatNum(actualStressMPa, 2)} MPa) SUPERA el esfuerzo admisible (${formatNum(allowableStressMPa, 2)} MPa). Uso: ${(utilizationRatio * 100).toFixed(1)}%.`
      );
    } else {
      notes.push(
        `El esfuerzo real (${formatNum(actualStressMPa, 2)} MPa) se encuentra DENTRO del límite admisible (${formatNum(allowableStressMPa, 2)} MPa). Factor de seguridad: ${safetyFactor ? formatNum(safetyFactor, 2) : '∞'}.`
      );
    }
  }

  // Evaluate distinct positive and negative moment extrema
  let positiveExtremum: BendingPeakResult | undefined;
  let negativeExtremum: BendingPeakResult | undefined;

  if (moment.maxPositive.value > tol) {
    const mPos = moment.maxPositive.value;
    const sPos = (mPos * 1000) / sectionModulusCm3;
    const uPos = allowableStressMPa && allowableStressMPa > 0 ? sPos / allowableStressMPa : undefined;
    const fsPos = allowableStressMPa && allowableStressMPa > 0 && sPos > 1e-6 ? allowableStressMPa / sPos : undefined;
    positiveExtremum = {
      momentKNm: Number(mPos.toFixed(4)),
      locationM: Number(moment.maxPositive.x.toFixed(4)),
      actualStressMPa: Number(sPos.toFixed(2)),
      extremeFibers: {
        top: 'compression',
        bottom: 'tension',
        explanation: 'Momento positivo (sagante): compresión en fibra superior y tracción en fibra inferior.',
      },
      utilizationRatio: uPos ? Number(uPos.toFixed(4)) : undefined,
      safetyFactor: fsPos ? Number(fsPos.toFixed(3)) : undefined,
    };
  }

  if (moment.maxNegative.value < -tol) {
    const mNegAbs = Math.abs(moment.maxNegative.value);
    const sNeg = (mNegAbs * 1000) / sectionModulusCm3;
    const uNeg = allowableStressMPa && allowableStressMPa > 0 ? sNeg / allowableStressMPa : undefined;
    const fsNeg = allowableStressMPa && allowableStressMPa > 0 && sNeg > 1e-6 ? allowableStressMPa / sNeg : undefined;
    negativeExtremum = {
      momentKNm: Number(moment.maxNegative.value.toFixed(4)),
      locationM: Number(moment.maxNegative.x.toFixed(4)),
      actualStressMPa: Number(sNeg.toFixed(2)),
      extremeFibers: {
        top: 'tension',
        bottom: 'compression',
        explanation: 'Momento negativo (hogante): tracción en fibra superior y compresión en fibra inferior.',
      },
      utilizationRatio: uNeg ? Number(uNeg.toFixed(4)) : undefined,
      safetyFactor: fsNeg ? Number(fsNeg.toFixed(3)) : undefined,
    };
  }

  const formula = 'σ_max = |M_max| · c / I = |M_max| / S';
  const substitution =
    `σ_max = (${formatNum(maxAbsMomentKNm, 4)} kN·m × 10³ N·m/kN) / (${formatNum(sectionModulusCm3, 2)} cm³ × 10⁻³ m³/cm³ × 10³)` +
    ` = (${formatNum(maxAbsMomentKNm * 1000, 2)} N·m) / (${formatNum(sectionModulusCm3, 2)} cm³) = ${formatNum(actualStressMPa, 2)} MPa`;

  return {
    status: 'calculated',
    maxMomentDemandKNm: Number(maxAbsMomentKNm.toFixed(4)),
    maxMomentLocationM: Number(locationM.toFixed(4)),
    momentType,
    extremeFibers,
    momentOfInertiaCm4: izCm4,
    sectionModulusCm3: Number(sectionModulusCm3.toFixed(3)),
    distanceToExtremeFiberMm: distanceToExtremeFiberMm
      ? Number(distanceToExtremeFiberMm.toFixed(2))
      : undefined,
    actualStressMPa: Number(actualStressMPa.toFixed(2)),
    allowableStressMPa,
    utilizationRatio: utilizationRatio ? Number(utilizationRatio.toFixed(4)) : undefined,
    safetyFactor: safetyFactor ? Number(safetyFactor.toFixed(3)) : undefined,
    formula,
    substitution,
    notes,
    positiveExtremum,
    negativeExtremum,
  };
}

