import type { FunctionAnalysis, ShearSegment, BeamSection } from '../types.js';
import type {
  CalculationStatus,
  MaterialsMechanicsOptions,
  ShearCalculationMethod,
  ShearDistributionType,
  ShearStressResult,
} from './types.js';
import { formatNum } from './formatter.js';

/**
 * Evaluates shear stresses distinguishing rigorously between:
 * - Average shear stress: tau_prom = |V| / A
 * - True maximum shear stress: tau_max = V * Q / (I * b) (rectangular: 1.5*V/A, circular: 4/3*V/A, I-shape web)
 * Never misrepresents V / A as the maximum shear stress of a general section.
 */
export function calculateShearStress(
  shear: FunctionAnalysis<ShearSegment>,
  section?: BeamSection,
  _options?: MaterialsMechanicsOptions
): ShearStressResult {
  const maxAbsShearKN = Math.abs(shear.maxAbsolute.value);
  const locationM = shear.maxAbsolute.x;

  const notes: string[] = [];

  // Determine cross-sectional area and detailed dimensions
  let crossSectionAreaCm2: number | undefined = section?.areaCm2;
  const izCm4 = section?.Iz ?? 0;

  const widthMm = section?.widthMm;
  const heightMm = section?.heightMm;
  const webThicknessMm = section?.webThicknessMm;
  const flangeThicknessMm = section?.flangeThicknessMm;
  const flangeWidthMm = section?.flangeWidthMm;
  const diameterMm = section?.diameterMm;

  let distributionType: ShearDistributionType = 'not_available';
  let calculationMethod: ShearCalculationMethod = 'not_available';
  let averageShearStressMPa: number | undefined;
  let maxShearStressMPa: number | undefined;
  let averageFormula = 'τ_prom = |V_max| / A';
  let averageSubstitution = '';
  let maxFormula: string | undefined;
  let maxSubstitution: string | undefined;
  let status: CalculationStatus = 'insufficient_section_data';

  // 1. Detect Rectangular Section
  const isRectangular =
    section?.type === 'rectangular' ||
    (widthMm !== undefined &&
      widthMm > 0 &&
      heightMm !== undefined &&
      heightMm > 0 &&
      section?.type !== 'i_shape' &&
      section?.type !== 'circular');

  // 2. Detect Circular Solid Section
  const isCircular =
    section?.type === 'circular' ||
    (diameterMm !== undefined && diameterMm > 0 && section?.type !== 'rectangular');

  // 3. Detect I-Shape / W-Shape Section
  const isIShape =
    section?.type === 'i_shape' ||
    (heightMm !== undefined &&
      heightMm > 0 &&
      webThicknessMm !== undefined &&
      webThicknessMm > 0 &&
      (flangeWidthMm !== undefined || flangeThicknessMm !== undefined));

  // 4. Detect Catalog Steel Profile with depth and web thickness
  const isSteelProfile =
    !isRectangular &&
    !isCircular &&
    heightMm !== undefined &&
    heightMm > 0 &&
    webThicknessMm !== undefined &&
    webThicknessMm > 0;

  if (isRectangular && widthMm && heightMm) {
    distributionType = 'rectangular';
    calculationMethod = 'rectangular_jourawski';
    crossSectionAreaCm2 = (widthMm * heightMm) / 100;
    const areaMm2 = widthMm * heightMm;

    // Average: |V| / A
    averageShearStressMPa = (maxAbsShearKN * 1000) / areaMm2;
    averageSubstitution =
      `τ_prom = (${formatNum(maxAbsShearKN * 1000, 2)} N) / (${formatNum(areaMm2, 1)} mm²) = ${formatNum(averageShearStressMPa, 3)} MPa`;

    // Maximum for solid rectangle: 1.5 * |V| / A
    maxShearStressMPa = 1.5 * averageShearStressMPa;
    maxFormula = 'τ_max = (3/2) · (|V_max| / A) = (3/2) · τ_prom';
    maxSubstitution =
      `τ_max = 1.5 · (${formatNum(averageShearStressMPa, 3)} MPa) = ${formatNum(maxShearStressMPa, 3)} MPa`;

    notes.push(
      'Distribución parabólica exacta de Jourawski para sección rectangular maciza: esfuerzo nulo en las fibras superior e inferior, y máximo τ_max = 1.5·τ_prom en el eje neutro (y = 0).'
    );
    status = 'calculated';
  } else if (isCircular && diameterMm) {
    distributionType = 'circular';
    calculationMethod = 'circular_jourawski';
    const areaMm2 = (Math.PI * diameterMm ** 2) / 4;
    crossSectionAreaCm2 = areaMm2 / 100;

    averageShearStressMPa = (maxAbsShearKN * 1000) / areaMm2;
    averageSubstitution =
      `τ_prom = (${formatNum(maxAbsShearKN * 1000, 2)} N) / (${formatNum(areaMm2, 1)} mm²) = ${formatNum(averageShearStressMPa, 3)} MPa`;

    // Maximum for solid circle: 4/3 * |V| / A
    maxShearStressMPa = (4 / 3) * averageShearStressMPa;
    maxFormula = 'τ_max = (4/3) · (|V_max| / A) = (4/3) · τ_prom';
    maxSubstitution =
      `τ_max = (4/3) · (${formatNum(averageShearStressMPa, 3)} MPa) = ${formatNum(maxShearStressMPa, 3)} MPa`;

    notes.push(
      'Distribución parabólica en sección circular maciza: esfuerzo máximo en el eje neutro τ_max = (4/3)·τ_prom.'
    );
    status = 'calculated';
  } else if (isIShape && heightMm && webThicknessMm && flangeWidthMm && flangeThicknessMm && izCm4 > 0) {
    distributionType = 'i_shape_web';
    calculationMethod = 'jourawski_neutral_axis';
    const d = heightMm;
    const tw = webThicknessMm;
    const bf = flangeWidthMm;
    const tf = flangeThicknessMm;

    const areaMm2 = 2 * bf * tf + (d - 2 * tf) * tw;
    crossSectionAreaCm2 = areaMm2 / 100;

    averageShearStressMPa = (maxAbsShearKN * 1000) / areaMm2;
    averageSubstitution =
      `τ_prom = (${formatNum(maxAbsShearKN * 1000, 2)} N) / (${formatNum(areaMm2, 1)} mm²) = ${formatNum(averageShearStressMPa, 3)} MPa`;

    // First moment of area Q at neutral axis:
    // Q_flange = (bf * tf) * (d - tf)/2
    // Q_web = tw * ((d - 2*tf)/2)^2 / 2 = tw * (d - 2*tf)^2 / 8
    const qFlange = bf * tf * (0.5 * (d - tf));
    const hWeb = Math.max(0, d - 2 * tf);
    const qWeb = (tw * hWeb ** 2) / 8;
    const qMax = qFlange + qWeb; // mm^3

    const imm4 = izCm4 * 10000;
    // tau_max = (V * Q) / (I * tw) in MPa
    maxShearStressMPa = (maxAbsShearKN * 1000 * qMax) / (imm4 * tw);
    maxFormula = 'τ_max = (|V_max| · Q_max) / (Iz · tw)';
    maxSubstitution =
      `τ_max = (${formatNum(maxAbsShearKN * 1000, 1)} N · ${formatNum(qMax, 1)} mm³) / (${formatNum(imm4, 0)} mm⁴ · ${formatNum(tw, 2)} mm) = ${formatNum(maxShearStressMPa, 2)} MPa`;

    const webAreaMm2 = d * tw;
    const tauWebAverage = (maxAbsShearKN * 1000) / webAreaMm2;
    notes.push(
      `Distribución elástica en perfil I/W: τ_max en el eje neutro = ${formatNum(maxShearStressMPa, 2)} MPa (Jourawski exacto). Cortante medio en el alma (d·tw): ${formatNum(tauWebAverage, 2)} MPa.`
    );
    status = 'calculated';
  } else if (isSteelProfile && heightMm && webThicknessMm) {
    distributionType = 'i_shape_web';
    calculationMethod = 'web_average';
    const webAreaMm2 = heightMm * webThicknessMm;
    const webAreaCm2 = webAreaMm2 / 100;
    if (!crossSectionAreaCm2) {
      crossSectionAreaCm2 = webAreaCm2;
    }

    // Average web shear stress (AISC simplified design)
    averageShearStressMPa = (maxAbsShearKN * 1000) / webAreaMm2;
    averageFormula = 'τ_alma_prom = |V_max| / (d · tw)';
    averageSubstitution =
      `τ_alma_prom = (${formatNum(maxAbsShearKN * 1000, 2)} N) / (${formatNum(webAreaMm2, 1)} mm²) = ${formatNum(averageShearStressMPa, 2)} MPa`;

    notes.push(
      `Cortante medio en el alma (AISC 360): τ = |V_max| / (d·tw) = ${formatNum(averageShearStressMPa, 2)} MPa. El alma absorbe más del 90-95% del cortante transversal total.`
    );
    status = 'average_only';
  } else if (crossSectionAreaCm2 !== undefined && crossSectionAreaCm2 > 0) {
    distributionType = 'average_only';
    calculationMethod = 'section_average';
    const areaMm2 = crossSectionAreaCm2 * 100;
    averageShearStressMPa = (maxAbsShearKN * 1000) / areaMm2;
    averageSubstitution =
      `τ_prom = (${formatNum(maxAbsShearKN * 1000, 2)} N) / (${formatNum(areaMm2, 1)} mm²) = ${formatNum(averageShearStressMPa, 2)} MPa`;

    notes.push(
      'Cortante promedio calculado como τ_prom = |V_max| / A. El cortante máximo τ_max no se evalúa al no disponer de las dimensiones detalladas de la sección para determinar el primer momento de área Q y el ancho local b(y).'
    );
    notes.push(
      'IMPORTANTE: OptiSteel no sustituye arbitrariamente V/A como cortante máximo para secciones de geometría general no especificada.'
    );
    status = 'average_only';
  } else {
    distributionType = 'not_available';
    calculationMethod = 'not_available';
    status = 'insufficient_section_data';
    averageSubstitution =
      'No disponible: se requiere definir el área transversal A (cm²) o las dimensiones geométricas de la sección (ej. ancho b y altura h).';
    notes.push(
      'Para evaluar el esfuerzo cortante se requiere definir el área transversal A o las dimensiones de la sección.'
    );
  }

  return {
    status,
    maxShearDemandKN: Number(maxAbsShearKN.toFixed(4)),
    maxShearLocationM: Number(locationM.toFixed(4)),
    crossSectionAreaCm2: crossSectionAreaCm2 ? Number(crossSectionAreaCm2.toFixed(2)) : undefined,
    averageShearStressMPa:
      averageShearStressMPa !== undefined
        ? Number(averageShearStressMPa.toFixed(2))
        : undefined,
    maxShearStressMPa:
      maxShearStressMPa !== undefined ? Number(maxShearStressMPa.toFixed(2)) : undefined,
    shearDistributionType: distributionType,
    calculationMethod,
    averageFormula,
    averageSubstitution,
    maxFormula,
    maxSubstitution,
    notes,
  };
}
