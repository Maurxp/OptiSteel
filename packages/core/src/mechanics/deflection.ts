import type {
  BeamModel,
  DeflectionPlaceholder,
  DeflectionAnalysis,
} from '../types.js';
import type {
  DeflectionExtremumResult,
  DeflectionSpanEvaluation,
  DeflectionSpanType,
  MaterialsMechanicsOptions,
} from './types.js';
import { formatNum } from './formatter.js';

interface InternalSpanDef {
  index: number;
  type: DeflectionSpanType;
  xStart: number;
  xEnd: number;
  lengthM: number;
  description: string;
}

/**
 * Extracts individual spans and cantilevers/overhangs from the structural model.
 */
function extractBeamSpans(beamLength: number, model?: BeamModel): InternalSpanDef[] {
  if (!model || !model.supports || model.supports.length === 0) {
    return [
      {
        index: 1,
        type: 'supported_span',
        xStart: 0,
        xEnd: beamLength,
        lengthM: beamLength,
        description: `Vano único (L = ${formatNum(beamLength)} m)`,
      },
    ];
  }

  const sortedSupports = [...model.supports].sort((a, b) => a.x - b.x);

  // Single fixed support (Cantilever beam)
  if (sortedSupports.length === 1 && sortedSupports[0]!.type === 'fixed') {
    const s = sortedSupports[0]!;
    return [
      {
        index: 1,
        type: 'cantilever',
        xStart: 0,
        xEnd: beamLength,
        lengthM: beamLength,
        description: `Voladizo empotrado en x = ${formatNum(s.x)} m (L = ${formatNum(beamLength)} m)`,
      },
    ];
  }

  const spans: InternalSpanDef[] = [];
  const tol = 1e-4;

  // 1. Left cantilever / overhang
  if (sortedSupports[0]!.x > tol) {
    const len = sortedSupports[0]!.x;
    spans.push({
      index: spans.length + 1,
      type: 'cantilever',
      xStart: 0,
      xEnd: sortedSupports[0]!.x,
      lengthM: len,
      description: `Voladizo izquierdo (x ∈ [0, ${formatNum(sortedSupports[0]!.x)}] m, L = ${formatNum(len)} m)`,
    });
  }

  // 2. Supported spans between adjacent supports
  for (let i = 0; i < sortedSupports.length - 1; i++) {
    const sA = sortedSupports[i]!;
    const sB = sortedSupports[i + 1]!;
    const len = sB.x - sA.x;
    if (len > tol) {
      spans.push({
        index: spans.length + 1,
        type: 'supported_span',
        xStart: sA.x,
        xEnd: sB.x,
        lengthM: len,
        description: `Vano ${spans.length + 1} (entre apoyos ${sA.id} y ${sB.id}, L = ${formatNum(len)} m)`,
      });
    }
  }

  // 3. Right cantilever / overhang
  const lastSupport = sortedSupports[sortedSupports.length - 1]!;
  if (lastSupport.x < beamLength - tol) {
    const len = beamLength - lastSupport.x;
    spans.push({
      index: spans.length + 1,
      type: 'cantilever',
      xStart: lastSupport.x,
      xEnd: beamLength,
      lengthM: len,
      description: `Voladizo derecho (x ∈ [${formatNum(lastSupport.x)}, ${formatNum(beamLength)}] m, L = ${formatNum(len)} m)`,
    });
  }

  if (spans.length === 0) {
    return [
      {
        index: 1,
        type: 'supported_span',
        xStart: 0,
        xEnd: beamLength,
        lengthM: beamLength,
        description: `Vano único (L = ${formatNum(beamLength)} m)`,
      },
    ];
  }

  return spans;
}

/**
 * Evaluates maximum deflections (absolute, downward, upward), exact stationary locations,
 * and span-aware serviceability limits (e.g. L_span/360 for spans, 2*L_cant/360 for cantilevers).
 */
export function calculateDeflectionExtremum(
  deflection: DeflectionPlaceholder | DeflectionAnalysis,
  beamLengthOrModel: number | BeamModel,
  options?: MaterialsMechanicsOptions
): DeflectionExtremumResult {
  const notes: string[] = [];

  const beamLength =
    typeof beamLengthOrModel === 'number'
      ? beamLengthOrModel
      : beamLengthOrModel.length;

  const model =
    typeof beamLengthOrModel === 'object' ? beamLengthOrModel : undefined;

  if (!deflection.isImplemented) {
    return {
      status: 'insufficient_elastic_data',
      criticalPointsSummary: [],
      notes: [
        'Cálculo de deflexiones elásticas no activo: proporcione módulo de elasticidad E (GPa) e inercia Iz (cm⁴).',
      ],
    };
  }

  const maxAbsM = deflection.maxAbsolute.value; // m
  const maxAbsLocation = deflection.maxAbsolute.x;
  const maxDownM = deflection.maxDownward.value; // m
  const maxDownLocation = deflection.maxDownward.x;
  const maxUpM = deflection.maxUpward.value; // m
  const maxUpLocation = deflection.maxUpward.x;

  const maxAbsoluteDeflectionMm = maxAbsM * 1000;
  const maxDownwardDeflectionMm = maxDownM * 1000;
  const maxUpwardDeflectionMm = Math.abs(maxUpM * 1000);

  const limitDenominator = options?.deflectionLimitDenominator ?? 360;

  // 1. Extract physical spans (supported spans and cantilevers)
  const spans = extractBeamSpans(beamLength, model);

  // 2. Evaluate serviceability for each span individually
  const spanEvaluations: DeflectionSpanEvaluation[] = [];

  for (const sp of spans) {
    // Find all critical points inside this span [sp.xStart, sp.xEnd]
    const ptsInSpan = deflection.criticalPoints.filter(
      (pt) => pt.x >= sp.xStart - 1e-4 && pt.x <= sp.xEnd + 1e-4
    );

    let maxSpanDefMm = 0;
    let maxSpanLocM = sp.xStart;

    if (ptsInSpan.length > 0) {
      for (const pt of ptsInSpan) {
        const absValMm = Math.abs(pt.value * 1000);
        if (absValMm > maxSpanDefMm) {
          maxSpanDefMm = absValMm;
          maxSpanLocM = pt.x;
        }
      }
    } else {
      // Evaluate at mid-span if no critical points were explicitly recorded inside
      const midX = 0.5 * (sp.xStart + sp.xEnd);
      maxSpanDefMm = Math.abs(deflection.evaluate(midX) * 1000);
      maxSpanLocM = midX;
    }

    // Determine reference length and allowable limit
    let refLenM: number;
    let allowableMm: number;
    let formulaStr: string;

    if (sp.type === 'cantilever') {
      refLenM = sp.lengthM;
      // Standard structural code criterion for cantilevers: 2 * L_cant / n = L_cant / (n / 2)
      allowableMm = (2 * refLenM * 1000) / limitDenominator;
      formulaStr = `δ_adm = (2 · L_vol · 10³ mm/m) / ${limitDenominator} = (2 × ${formatNum(refLenM)} m × 10³) / ${limitDenominator} = ${formatNum(allowableMm, 2)} mm (criterio voladizo 2·a/n)`;
    } else {
      refLenM = sp.lengthM;
      allowableMm = (refLenM * 1000) / limitDenominator;
      formulaStr = `δ_adm = (L_vano · 10³ mm/m) / ${limitDenominator} = (${formatNum(refLenM)} m × 10³) / ${limitDenominator} = ${formatNum(allowableMm, 2)} mm`;
    }

    const uRatio = allowableMm > 0 ? maxSpanDefMm / allowableMm : 0;
    const passes = maxSpanDefMm <= allowableMm + 1e-6;

    spanEvaluations.push({
      spanIndex: sp.index,
      spanType: sp.type,
      xStart: Number(sp.xStart.toFixed(4)),
      xEnd: Number(sp.xEnd.toFixed(4)),
      spanLengthM: Number(sp.lengthM.toFixed(4)),
      referenceLengthM: Number(refLenM.toFixed(4)),
      description: sp.description,
      maxDeflectionMm: Number(maxSpanDefMm.toFixed(3)),
      maxDeflectionLocationM: Number(maxSpanLocM.toFixed(4)),
      limitDenominator,
      allowableDeflectionMm: Number(allowableMm.toFixed(3)),
      utilizationRatio: Number(uRatio.toFixed(4)),
      passesService: passes,
      formula: formulaStr,
    });
  }

  // 3. Determine governing span (highest utilization ratio or span containing maxAbsolute)
  let governingSpan = spanEvaluations[0]!;
  for (const se of spanEvaluations) {
    if (se.utilizationRatio > governingSpan.utilizationRatio) {
      governingSpan = se;
    }
  }

  // Also check if the global absolute maximum deflection is in a span with slightly lower ratio
  const spanWithGlobalMax = spanEvaluations.find(
    (se) => maxAbsLocation >= se.xStart - 1e-4 && maxAbsLocation <= se.xEnd + 1e-4
  );
  if (spanWithGlobalMax && spanWithGlobalMax.utilizationRatio >= governingSpan.utilizationRatio - 1e-6) {
    governingSpan = spanWithGlobalMax;
  }

  const allPassed = spanEvaluations.every((se) => se.passesService);
  const allowableDeflectionMm = governingSpan.allowableDeflectionMm;
  const utilizationRatio = governingSpan.utilizationRatio;
  const passesService = allPassed;

  if (spans.length > 1) {
    notes.push(
      `Evaluación ELS por vanos (${spans.length} sectores identificados): Se evaluó cada vano y voladizo con su longitud de referencia correspondiente (L_vano/n para tramos entre apoyos, 2·a/n para voladizos).`
    );
    if (passesService) {
      notes.push(
        `Todos los vanos CUMPLEN con sus límites de servicio elásticos. Sector gobernante: ${governingSpan.description} con |v| = ${formatNum(governingSpan.maxDeflectionMm, 3)} mm vs δ_adm = ${formatNum(governingSpan.allowableDeflectionMm, 2)} mm (Uso: ${(governingSpan.utilizationRatio * 100).toFixed(1)}%).`
      );
    } else {
      const failedSpans = spanEvaluations.filter((se) => !se.passesService);
      notes.push(
        `Atención: ${failedSpans.length} sector(es) EXCEDEN la flecha admisible. Sector gobernante: ${governingSpan.description} (Uso: ${(governingSpan.utilizationRatio * 100).toFixed(1)}%).`
      );
    }
  } else {
    if (passesService) {
      notes.push(
        `Deflexión máxima |v_max| = ${formatNum(maxAbsoluteDeflectionMm, 3)} mm CUMPLE con el límite de servicio elástico ${governingSpan.formula} (Uso: ${(utilizationRatio * 100).toFixed(1)}%).`
      );
    } else {
      notes.push(
        `Deflexión máxima |v_max| = ${formatNum(maxAbsoluteDeflectionMm, 3)} mm EXCEDE el límite de servicio elástico ${governingSpan.formula} (Uso: ${(utilizationRatio * 100).toFixed(1)}%).`
      );
    }
  }

  // 4. Summarize key critical points
  const criticalPointsSummary = deflection.criticalPoints.map((pt) => ({
    x: Number(pt.x.toFixed(4)),
    deflectionMm: Number((pt.value * 1000).toFixed(3)),
    description: pt.description ?? `Punto en x = ${formatNum(pt.x)} m`,
  }));

  return {
    status: 'calculated',
    maxAbsoluteDeflectionMm: Number(maxAbsoluteDeflectionMm.toFixed(3)),
    maxAbsoluteLocationM: Number(maxAbsLocation.toFixed(4)),
    maxDownwardDeflectionMm: Number(maxDownwardDeflectionMm.toFixed(3)),
    maxDownwardLocationM: Number(maxDownLocation.toFixed(4)),
    maxUpwardDeflectionMm:
      maxUpM < -1e-6 ? Number(maxUpwardDeflectionMm.toFixed(3)) : 0,
    maxUpwardLocationM: maxUpM < -1e-6 ? Number(maxUpLocation.toFixed(4)) : undefined,
    serviceLimitDenominator: limitDenominator,
    referenceLengthM: governingSpan.referenceLengthM,
    referenceSpanDescription: governingSpan.description,
    referenceCriterionFormula: governingSpan.formula,
    allowableDeflectionMm: Number(allowableDeflectionMm.toFixed(3)),
    deflectionUtilizationRatio: Number(utilizationRatio.toFixed(4)),
    serviceCheckStatus: passesService ? 'passed' : 'failed',
    spanEvaluations,
    criticalPointsSummary,
    notes,
  };
}
