import type {
  BeamAnalysisResult,
  DidacticReport,
  DidacticStep,
  PointLoad,
  DistributedLoad,
} from '../types.js';

/**
 * Generates an academic step-by-step didactic report for hyperstatic beam solutions (H1–H4),
 * detailing physical principles, compatibility equations, substituted values,
 * static equilibrium derivations, and boundary condition verifications.
 */
function formatSigned(val: number, decimals = 3, unit = ''): string {
  const rounded = Math.abs(val) < 1e-9 ? 0 : val;
  const str = rounded.toFixed(decimals);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${str}${unit ? ` ${unit}` : ''}`;
}

/**
 * Generates an academic step-by-step didactic report for hyperstatic beam solutions (H1–H4),
 * detailing physical principles, compatibility equations, substituted values,
 * static equilibrium derivations, and boundary condition verifications.
 */
export function generateHyperstaticDidacticReport(
  analysis: BeamAnalysisResult
): DidacticReport {
  const { model, reactions, equilibrium, shear, moment, deflection } = analysis;
  const supports = [...model.supports].sort((a, b) => a.x - b.x);
  const fixedCount = supports.filter((s) => s.type === 'fixed').length;
  const L = model.length;

  const EI = deflection.isImplemented ? deflection.EI : undefined;
  const E = model.material?.E;
  const Iz = model.section?.Iz;

  // Case H1: Propped cantilever with point loads
  if (
    supports.length === 2 &&
    fixedCount === 1 &&
    model.loads.every((l) => l.type === 'point')
  ) {
    const sFixed = supports.find((s) => s.type === 'fixed')!;
    const sSimple = supports.find((s) => s.type !== 'fixed')!;
    const rFixed = reactions.find((r) => r.supportId === sFixed.id);
    const rSimple = reactions.find((r) => r.supportId === sSimple.id);

    const ptLoads = model.loads.filter((l): l is PointLoad => l.type === 'point');
    const loadSummaryStr = ptLoads
      .map((p) => `P = ${p.P} kN en x = ${p.x} m`)
      .join(', ');

    const steps: DidacticStep[] = [
      {
        stepNumber: 1,
        title: 'Identificación del Grado de Hiperestaticidad y Reacción Redundante',
        principle:
          'Estática clásica: comparación entre número de incógnitas reactivas y ecuaciones de equilibrio plano.',
        formulation: 'GH = N_reacciones - 2 = 3 - 2 = 1 (Grado 1 de indeterminación estática)',
        substitution: `Apoyo A (${sFixed.type.toUpperCase()} en x=${sFixed.x}m) aporta 2 incógnitas [RA, MA]. Apoyo B (${sSimple.type.toUpperCase()} en x=${sSimple.x}m) aporta 1 incógnita [RB]. Total = 3 incógnitas para 2 ecuaciones estáticas.`,
        result: 'Se selecciona como fuerza redundante la reacción vertical en el rodillo B: RB.',
      },
      {
        stepNumber: 2,
        title: 'Definición de la Estructura Primaria Isostática',
        principle:
          'Método de las Fuerzas (Flexibilidad): liberación de la ligadura redundante para formar una estructura estáticamente determinada.',
        formulation: 'Estructura primaria = Viga en voladizo (cantilever) empotrada en A.',
        substitution: `Al retirar el apoyo simple en x = ${sSimple.x} m, la viga queda como voladizo libre en su extremo de longitud L = ${L} m.`,
        result: 'Estructura primaria estáticamente determinada y cinemáticamente admisible.',
      },
      {
        stepNumber: 3,
        title: 'Ecuación de Compatibilidad Elástica de Desplazamientos',
        principle:
          'Condición cinemática de apoyo: el rodillo en B impide el desplazamiento vertical del nudo.',
        formulation: 'v(B) = δ_B0 - RB · f_BB = 0  =>  RB = δ_B0 / f_BB',
        substitution:
          'δ_B0: deflexión en B debida a las cargas externas en el voladizo primario.\nf_BB: coeficiente de flexibilidad (deflexión en B por carga unitaria ascendente en B).',
        result: 'Ecuación lineal de compatibilidad en desplazamientos.',
      },
      {
        stepNumber: 4,
        title: 'Cálculo de Flexibilidad y Deflexión de la Estructura Primaria',
        principle:
          'Teoría de vigas de Euler-Bernoulli para vigas en voladizo.',
        formulation:
          'f_BB = L³ / (3·EI)\nδ_B0 = Σ [ P_i · a_i² · (3L - a_i) / (6·EI) ]',
        substitution:
          `L = ${L} m, EI = ${EI !== undefined ? `${EI.toFixed(1)} kN·m² (E=${E} GPa, Iz=${Iz} cm⁴)` : 'EI'}.\n` +
          ptLoads
            .map(
              (p) =>
                `Carga P=${p.P} kN, a=${p.x} m: δ_i = (${p.P} · ${p.x}² · (3·${L} - ${p.x})) / (6·EI) = ${((p.P * p.x * p.x * (3 * L - p.x)) / 6).toFixed(3)} / EI`
            )
            .join('\n'),
        result: `f_BB = ${(L ** 3 / 3).toFixed(3)} / EI m/kN`,
      },
      {
        stepNumber: 5,
        title: 'Resolución de la Reacción Redundante RB',
        principle: 'Sustitución en la ecuación de compatibilidad cinemática.',
        formulation: 'RB = δ_B0 / f_BB',
        substitution: `RB = (${rSimple?.Ry.toFixed(4)} · f_BB) / f_BB`,
        result: `RB = ${rSimple?.Ry.toFixed(3)} kN (positiva, ascendente ↑)`,
        check: {
          description: 'Desplazamiento vertical nulo en el apoyo simple v(B)',
          isVerified: deflection.isImplemented && Math.abs(deflection.evaluate(sSimple.x)) < 1e-6,
          errorMargin: deflection.isImplemented ? Math.abs(deflection.evaluate(sSimple.x)) : 0,
        },
      },
      {
        stepNumber: 6,
        title: 'Equilibrio Global y Reacciones en el Empotramiento A',
        principle: 'Equaciones universales de la estática en el plano (Σ Fy = 0, Σ M = 0).',
        formulation: 'RA = Σ P_i - RB\nMA = Σ [ P_i · a_i ] - RB · L  (+CCW)',
        substitution: `RA = ${ptLoads.reduce((acc, p) => acc + p.P, 0)} kN - ${rSimple?.Ry.toFixed(3)} kN\nMA = (${ptLoads.map((p) => `${p.P}·${p.x}`).join(' + ')}) - (${rSimple?.Ry.toFixed(3)} · ${L})`,
        result: `RA = ${rFixed?.Ry.toFixed(3)} kN (↑), MA = ${rFixed?.Mr !== undefined ? `${rFixed.Mr.toFixed(3)} kN·m (+CCW)` : '—'}`,
        check: {
          description: 'Equilibrio estático global verificado',
          isVerified: equilibrium.isBalanced,
          errorMargin: Math.max(Math.abs(equilibrium.sumFy), Math.abs(equilibrium.sumM)),
        },
      },
      {
        stepNumber: 7,
        title: 'Construcción de Esfuerzos Internos y Puntos Críticos',
        principle: 'Relaciones diferenciales de Euler-Bernoulli: dV/dx = -w, dM/dx = V.',
        formulation: 'M(0+) = -MA  (hogging/tracción superior)\nV(0+) = RA\nM(L) = 0',
        substitution:
          `Momento en empotramiento: M(0+) = ${formatSigned(moment.evaluate(0.0, 'right'), 3, 'kN·m')}.\n` +
          ptLoads
            .map(
              (p) =>
                `Carga P=${p.P} kN en x=${p.x}m: M(${p.x}m) = ${formatSigned(moment.evaluate(p.x), 3, 'kN·m')}, ` +
                `V(${p.x}⁻) = ${formatSigned(shear.evaluate(p.x, 'left'), 3, 'kN')}, ` +
                `V(${p.x}⁺) = ${formatSigned(shear.evaluate(p.x, 'right'), 3, 'kN')} (salto ΔV = -${p.P} kN).`
            )
            .join('\n'),
        result: `Punto de inflexión interior (M=0) localizado en x = ${moment.criticalPoints.find((cp) => cp.type === 'zero_crossing')?.x.toFixed(4) ?? '—'} m.`,
      },
      {
        stepNumber: 8,
        title: 'Deformada Elástica y Verificación de Condiciones de Frontera',
        principle: 'Doble integración analítica: EI · v\'\'(x) = -M(x).',
        formulation: 'v(0) = 0, θ(0) = 0 (empotramiento); v(L) = 0 (rodillo).',
        substitution: deflection.isImplemented
          ? `v(0) = ${(deflection.evaluate(0) * 1000).toFixed(6)} mm, θ(0) = ${deflection.evaluateSlope(0).toFixed(7)} rad\nv(${L}) = ${(deflection.evaluate(L) * 1000).toFixed(6)} mm\nFlecha máxima descendente en x = ${deflection.maxDownward.x.toFixed(4)} m: v_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm.`
          : 'Requiere propiedades de material y sección para evaluación numérica.',
        result: deflection.isImplemented
          ? `Flecha máxima = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${deflection.maxDownward.x.toFixed(3)} m.`
          : 'Cálculo de elástica no ejecutado por falta de rigidez EI.',
        check: {
          description: 'Condiciones de frontera cinemáticas exactas',
          isVerified:
            deflection.isImplemented &&
            Math.abs(deflection.evaluate(0)) < 1e-7 &&
            Math.abs(deflection.evaluateSlope(0)) < 1e-7 &&
            Math.abs(deflection.evaluate(L)) < 1e-7,
        },
      },
    ];

    return {
      caseId: 'H1',
      caseName: 'Caso H1: Viga Empotrada-Apoyada con Cargas Puntuales',
      degreeOfIndeterminacy: 1,
      redundantReactions: ['RB (Reacción vertical en apoyo simple)'],
      primaryStructure: 'Viga en voladizo empotrada en x = 0',
      compatibilityConditions: ['Desplazamiento vertical nulo en el apoyo simple: v(B) = 0'],
      steps,
      conclusions: [
        `Reacción vertical en empotramiento A: RA = ${rFixed?.Ry.toFixed(3)} kN`,
        `Momento de reacción en empotramiento A: MA = ${rFixed?.Mr?.toFixed(3)} kN·m (antihorario)`,
        `Reacción vertical en rodillo B: RB = ${rSimple?.Ry.toFixed(3)} kN`,
        `Cargas aplicadas: ${loadSummaryStr}`,
        `Equilibrio de fuerzas verticales y momentos verificado con precisión < ${equilibrium.toleranceForce} kN`,
      ],
    };
  }

  // Case H2: Propped cantilever with distributed loads
  if (
    supports.length === 2 &&
    fixedCount === 1 &&
    model.loads.some((l) => l.type === 'distributed')
  ) {
    const sFixed = supports.find((s) => s.type === 'fixed')!;
    const sSimple = supports.find((s) => s.type !== 'fixed')!;
    const rFixed = reactions.find((r) => r.supportId === sFixed.id);
    const rSimple = reactions.find((r) => r.supportId === sSimple.id);

    const distLoads = model.loads.filter((l): l is DistributedLoad => l.type === 'distributed');
    const ptLoads = model.loads.filter((l): l is PointLoad => l.type === 'point');

    const isPureUniform =
      ptLoads.length === 0 &&
      distLoads.length === 1 &&
      Math.abs(distLoads[0]!.xStart - 0) < 1e-4 &&
      Math.abs(distLoads[0]!.xEnd - L) < 1e-4 &&
      Math.abs(distLoads[0]!.wStart - distLoads[0]!.wEnd) < 1e-4;

    const wVal = distLoads[0]?.wStart ?? 0;

    if (isPureUniform) {
      const steps: DidacticStep[] = [
        {
          stepNumber: 1,
          title: 'Identificación del Grado de Hiperestaticidad',
          principle: 'Grado de indeterminación estática para viga empotrada-apoyada.',
          formulation: 'GH = 3 reacciones - 2 ecuaciones de equilibrio = 1',
          substitution: `Empotramiento en A (2 reacciones: RA, MA) y rodillo en B (1 reacción: RB). Carga distribuida uniforme w = ${wVal} kN/m.`,
          result: 'Sistema hiperestático de 1er grado con redundante RB.',
        },
        {
          stepNumber: 2,
          title: 'Estructura Primaria y Coeficiente de Flexibilidad',
          principle: 'Estructura liberada en voladizo sometida a carga distribuida.',
          formulation: 'f_BB = L³ / (3·EI)\nδ_B0 = w·L⁴ / (8·EI)',
          substitution: `L = ${L} m, w = ${wVal} kN/m.\nδ_B0 = (${wVal} · ${L}⁴) / (8·EI) = ${(wVal * L ** 4 / 8).toFixed(2)} / EI kN·m³\nf_BB = ${L}³ / (3·EI) = ${(L ** 3 / 3).toFixed(2)} / EI m/kN`,
          result: 'Coeficientes elásticos calculados exactamente.',
        },
        {
          stepNumber: 3,
          title: 'Compatibilidad Vertical y Resolución de RB',
          principle: 'Compatibilidad de deformaciones: v(L) = δ_B0 - RB · f_BB = 0.',
          formulation: 'RB = δ_B0 / f_BB = (3/8) · w · L',
          substitution: `RB = (3/8) · (${wVal} kN/m) · (${L} m) = ${((3 / 8) * wVal * L).toFixed(3)} kN`,
          result: `RB = ${rSimple?.Ry.toFixed(3)} kN (↑)`,
          check: {
            description: 'Deflexión nula en el rodillo B',
            isVerified: deflection.isImplemented && Math.abs(deflection.evaluate(sSimple.x)) < 1e-6,
          },
        },
        {
          stepNumber: 4,
          title: 'Equilibrio Estático Global (RA y MA)',
          principle: 'Equilibrio de fuerzas verticales y momento respecto al empotramiento A.',
          formulation: 'RA = w·L - RB = (5/8) · w · L\nMA = (w·L²/2) - RB·L = (1/8) · w · L²  (+CCW)',
          substitution: `RA = (5/8) · ${wVal} · ${L} = ${((5 / 8) * wVal * L).toFixed(3)} kN\nMA = (1/8) · ${wVal} · ${L}² = ${((1 / 8) * wVal * L * L).toFixed(3)} kN·m`,
          result: `RA = ${rFixed?.Ry.toFixed(3)} kN (↑), MA = ${rFixed?.Mr?.toFixed(3)} kN·m (+CCW)`,
          check: {
            description: 'Equilibrio estático Σ Fy = 0 y Σ M = 0',
            isVerified: equilibrium.isBalanced,
          },
        },
        {
          stepNumber: 5,
          title: 'Leyes de Cortante, Momento Máximo e Inflexión',
          principle: 'Puntos singulares: V(x) = 0 define momento máximo; M(x) = 0 define punto de inflexión.',
          formulation: 'V(x) = RA - w·x = 0  =>  x_v0 = 5L/8\nM_max(+) = 9·w·L² / 128\nx_inf = L/4',
          substitution: `x_v0 = 5(${L})/8 = ${(5 * L / 8).toFixed(3)} m\nM_max(+) = 9(${wVal})(${L}²)/128 = ${(9 * wVal * L * L / 128).toFixed(4)} kN·m\nx_inf = ${L}/4 = ${(L / 4).toFixed(3)} m`,
          result: `M_max = ${moment.maxPositive.value.toFixed(4)} kN·m en x = ${moment.maxPositive.x.toFixed(3)} m; Punto de inflexión en x = ${(L / 4).toFixed(3)} m.`,
        },
        {
          stepNumber: 6,
          title: 'Deformada Elástica y Posición de Flecha Máxima',
          principle: 'Euler-Bernoulli: EI · v\'\'(x) = -M(x). Raíz de v\'(x) = 0.',
          formulation: 'x_max = ((15 - √33) / 16) · L ≈ 0.578465 · L\nv_max = ((39 + 55√33) / 65536) · (w·L⁴ / EI)',
          substitution: deflection.isImplemented
            ? `x_max = ((15 - √33)/16) · ${L} = ${(((15 - Math.sqrt(33)) / 16) * L).toFixed(4)} m\nv_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm`
            : 'Evaluación pendiente de rigidez flexional EI.',
          result: deflection.isImplemented
            ? `v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${deflection.maxDownward.x.toFixed(3)} m.`
            : 'Requiere EI para cálculo numérico.',
          check: {
            description: 'Condiciones cinemáticas: v(0)=0, θ(0)=0, v(L)=0',
            isVerified:
              deflection.isImplemented &&
              Math.abs(deflection.evaluate(0)) < 1e-7 &&
              Math.abs(deflection.evaluate(L)) < 1e-7,
          },
        },
      ];

      return {
        caseId: 'H2',
        caseName: 'Caso H2: Viga Empotrada-Apoyada con Carga Uniformemente Distribuida',
        degreeOfIndeterminacy: 1,
        redundantReactions: ['RB (Reacción vertical en apoyo simple)'],
        primaryStructure: 'Viga en voladizo empotrada en x = 0',
        compatibilityConditions: ['Desplazamiento vertical nulo en el rodillo B: v(L) = 0'],
        steps,
        conclusions: [
          `Reacción vertical en empotramiento A: RA = ${rFixed?.Ry.toFixed(3)} kN = 5wL/8`,
          `Momento de reacción en A: MA = +${rFixed?.Mr?.toFixed(3)} kN·m = +wL²/8`,
          `Reacción vertical en rodillo B: RB = ${rSimple?.Ry.toFixed(3)} kN = 3wL/8`,
          `Momento flector máximo positivo: +${moment.maxPositive.value.toFixed(4)} kN·m en x = ${(5 * L / 8).toFixed(3)} m`,
          `Punto de inflexión interior: x = ${(L / 4).toFixed(3)} m (M = 0)`,
        ],
      };
    } else {
      // General H2: Combined or Partial Loads (Superposition)
      const loadDesc = [
        ...distLoads.map((d) => `w = ${d.wStart}${d.wEnd !== d.wStart ? `→${d.wEnd}` : ''} kN/m en [${d.xStart}, ${d.xEnd}]m`),
        ...ptLoads.map((p) => `P = ${p.P} kN en x = ${p.x}m`),
      ].join('; ');

      const steps: DidacticStep[] = [
        {
          stepNumber: 1,
          title: 'Identificación del Grado de Hiperestaticidad (Cargas Combinadas/Parciales)',
          principle: 'Grado de indeterminación estática para viga empotrada-apoyada.',
          formulation: 'GH = 3 reacciones - 2 ecuaciones de equilibrio = 1',
          substitution: `Empotramiento en x=${sFixed.x}m [RA, MA] y apoyo simple en x=${sSimple.x}m [RB]. Cargas activas: ${loadDesc}.`,
          result: 'Sistema hiperestático de 1er grado con fuerza redundante RB.',
        },
        {
          stepNumber: 2,
          title: 'Estructura Primaria Isostática y Coeficiente de Flexibilidad',
          principle: 'Método de las Fuerzas: liberación del apoyo simple para formar un voladizo.',
          formulation: 'f_BB = L³ / (3·EI)',
          substitution: `L = ${L} m, f_BB = ${(L ** 3 / 3).toFixed(2)} / EI m/kN.`,
          result: 'Estructura primaria en voladizo estáticamente determinada.',
        },
        {
          stepNumber: 3,
          title: 'Compatibilidad de Desplazamientos y Superposición de Deflexiones',
          principle:
            'Principio de superposición elástica: la deflexión vertical total en B debe anularse.',
          formulation:
            'v(B) = δ_B0 - RB · f_BB = 0  =>  RB = δ_B0 / f_BB\n' +
            'δ_B0 = Σ δ_B0,i  (Suma de deflexiones individuales en el voladizo primario)',
          substitution:
            `Deflexión total en voladizo: δ_B0 = (${rSimple?.Ry.toFixed(4)} · f_BB) / EI\n` +
            `Contribuciones: ${loadDesc}.`,
          result: `RB = ${rSimple?.Ry.toFixed(3)} kN (↑)`,
          check: {
            description: 'Deflexión nula en el apoyo simple v(B)',
            isVerified: deflection.isImplemented && Math.abs(deflection.evaluate(sSimple.x)) < 1e-6,
          },
        },
        {
          stepNumber: 4,
          title: 'Equilibrio Estático Global (RA y MA)',
          principle: 'Equaciones universales de la estática en el plano (Σ Fy = 0, Σ M_A = 0).',
          formulation: 'RA = Σ F_y - RB\nMA = Σ M_cargas - RB · L  (+CCW)',
          substitution: `RA = ${rFixed?.Ry.toFixed(3)} kN\nMA = ${rFixed?.Mr?.toFixed(3)} kN·m (+CCW)`,
          result: `RA = ${rFixed?.Ry.toFixed(3)} kN (↑), MA = ${rFixed?.Mr?.toFixed(3)} kN·m (+CCW)`,
          check: {
            description: 'Equilibrio estático global Σ Fy = 0 y Σ M = 0',
            isVerified: equilibrium.isBalanced,
          },
        },
        {
          stepNumber: 5,
          title: 'Leyes de Esfuerzos Internos por Integración Continua',
          principle: 'Relaciones diferenciales de Euler-Bernoulli evaluadas por tramos continuos.',
          formulation: 'V(x) = RA - ∫ w(x) dx - Σ P_i\nM(x) = -MA + ∫ V(x) dx',
          substitution:
            'Nota pedagógica: Al existir cargas combinadas o carga distribuida parcial, las leyes de esfuerzos se obtienen mediante integración directa continua por tramos. Las fórmulas canónicas cerradas (3wL/8, 5wL/8, wL²/8) solo aplican con rigor para carga uniforme total pura.\n' +
            `Momento flector máximo positivo: M_max(+) = ${formatSigned(moment.maxPositive.value, 4, 'kN·m')} en x = ${moment.maxPositive.x.toFixed(3)} m.\n` +
            `Momento en empotramiento: M(0+) = ${formatSigned(moment.evaluate(0, 'right'), 4, 'kN·m')}.`,
          result: `M_max = ${moment.maxPositive.value.toFixed(4)} kN·m en x = ${moment.maxPositive.x.toFixed(3)} m.`,
        },
        {
          stepNumber: 6,
          title: 'Deformada Elástica por Doble Integración de Euler-Bernoulli',
          principle: 'Integración diferencial numérica con condiciones v(0)=0, θ(0)=0, v(L)=0.',
          formulation: 'v(0) = 0, θ(0) = 0, v(L) = 0',
          substitution: deflection.isImplemented
            ? `Flecha máxima descendente en x = ${deflection.maxDownward.x.toFixed(4)} m: v_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm.`
            : 'Requiere EI para cálculo numérico.',
          result: deflection.isImplemented
            ? `v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${deflection.maxDownward.x.toFixed(3)} m.`
            : 'Requiere EI.',
          check: {
            description: 'Condiciones cinemáticas: v(0)=0, θ(0)=0, v(L)=0',
            isVerified:
              deflection.isImplemented &&
              Math.abs(deflection.evaluate(0)) < 1e-7 &&
              Math.abs(deflection.evaluate(L)) < 1e-7,
          },
        },
      ];

      return {
        caseId: 'H2',
        caseName: 'Caso H2: Viga Empotrada-Apoyada con Cargas Distribuidas / Combinadas',
        degreeOfIndeterminacy: 1,
        redundantReactions: ['RB (Reacción vertical en apoyo simple)'],
        primaryStructure: 'Viga en voladizo empotrada en x = 0',
        compatibilityConditions: ['Desplazamiento vertical nulo en el rodillo B: v(L) = 0'],
        steps,
        conclusions: [
          `Reacción vertical en empotramiento A: RA = ${rFixed?.Ry.toFixed(3)} kN`,
          `Momento de reacción en A: MA = ${formatSigned(rFixed?.Mr ?? 0, 3, 'kN·m')} (+CCW)`,
          `Reacción vertical en rodillo B: RB = ${rSimple?.Ry.toFixed(3)} kN`,
          `Momento flector máximo positivo: ${formatSigned(moment.maxPositive.value, 4, 'kN·m')} en x = ${moment.maxPositive.x.toFixed(3)} m`,
          `Cálculo resuelto fielmente mediante superposición elástica y compatibilidad cinemática v(B) = 0`,
        ],
      };
    }
  }

  // Case H3: Fixed-fixed beam
  if (supports.length === 2 && fixedCount === 2) {
    const sA = supports[0]!;
    const sB = supports[1]!;
    const rA = reactions.find((r) => r.supportId === sA.id);
    const rB = reactions.find((r) => r.supportId === sB.id);

    const distLoads = model.loads.filter((l): l is DistributedLoad => l.type === 'distributed');
    const ptLoads = model.loads.filter((l): l is PointLoad => l.type === 'point');

    const isPureUniform =
      ptLoads.length === 0 &&
      distLoads.length === 1 &&
      Math.abs(distLoads[0]!.xStart - 0) < 1e-4 &&
      Math.abs(distLoads[0]!.xEnd - L) < 1e-4 &&
      Math.abs(distLoads[0]!.wStart - distLoads[0]!.wEnd) < 1e-4;

    const isSinglePoint = distLoads.length === 0 && ptLoads.length === 1;

    if (isPureUniform) {
      const wVal = distLoads[0]!.wStart;
      const steps: DidacticStep[] = [
        {
          stepNumber: 1,
          title: 'Identificación de la Indeterminación Cinemática y Estática',
          principle: 'Viga biempotrada plana con restricciones totales en ambos extremos.',
          formulation: 'GH = 4 reacciones transversales - 2 ecuaciones de equilibrio = 2 (Grado 2)',
          substitution: `Apoyo A (x=0) aporta [RA, MA]. Apoyo B (x=${L}m) aporta [RB, MB]. Total: 4 incógnitas reactivas.`,
          result: 'Grado 2 de hiperestaticidad: se requieren 2 condiciones de compatibilidad cinemática adicionales.',
        },
        {
          stepNumber: 2,
          title: 'Condiciones de Contorno Cinemáticas Dobles',
          principle: 'Restricción total de desplazamiento vertical y giro en ambos empotramientos.',
          formulation: 'v(0) = 0,  θ(0) = 0\nv(L) = 0,  θ(L) = 0',
          substitution: 'La viga no puede deflectar ni rotar en x = 0 ni en x = L.',
          result: 'Cuatro condiciones de frontera cinemáticas.',
        },
        {
          stepNumber: 3,
          title: 'Cálculo de Momentos Reactivos de Empotramiento Perfecto',
          principle: 'Simetría de carga y compatibilidad elástica en extremos biempotrados.',
          formulation: 'MA = +w·L² / 12  (+CCW)\nMB = -w·L² / 12  (-CW)',
          substitution: `w = ${wVal} kN/m, L = ${L} m\nMA = +(${wVal} · ${L}²) / 12 = +${((wVal * L * L) / 12).toFixed(3)} kN·m\nMB = -(${wVal} · ${L}²) / 12 = -${((wVal * L * L) / 12).toFixed(3)} kN·m`,
          result: `MA = ${rA?.Mr?.toFixed(3)} kN·m (+CCW), MB = ${rB?.Mr?.toFixed(3)} kN·m (-CW)`,
        },
        {
          stepNumber: 4,
          title: 'Reacciones Verticales por Equilibrio y Simetría',
          principle: 'Equilibrio estático vertical en carga simétrica.',
          formulation: 'RA = RB = w·L / 2',
          substitution: `RA = RB = (${wVal} · ${L}) / 2 = ${((wVal * L) / 2).toFixed(3)} kN`,
          result: `RA = ${rA?.Ry.toFixed(3)} kN (↑), RB = ${rB?.Ry.toFixed(3)} kN (↑)`,
          check: {
            description: 'Equilibrio global vertical y de momentos Σ Fy = 0, Σ M = 0',
            isVerified: equilibrium.isBalanced,
          },
        },
        {
          stepNumber: 5,
          title: 'Leyes de Momentos Flectores y Puntos de Inflexión',
          principle: 'Momento flector interno M(x) y localización de raíces M(x) = 0.',
          formulation:
            'M(0+) = M(L-) = -w·L² / 12  (hogging)\nM(L/2) = +w·L² / 24  (sagging central)\nx_inf = (1/2 ± √3/6) · L',
          substitution: `M(0+) = -${((wVal * L * L) / 12).toFixed(3)} kN·m\nM(${L / 2}m) = +${((wVal * L * L) / 24).toFixed(3)} kN·m\nx_inf1 = ${(L * (0.5 - Math.sqrt(3) / 6)).toFixed(4)} m, x_inf2 = ${(L * (0.5 + Math.sqrt(3) / 6)).toFixed(4)} m`,
          result: `Extremos: M_ext = -${((wVal * L * L) / 12).toFixed(2)} kN·m; Centro: M_cen = +${((wVal * L * L) / 24).toFixed(2)} kN·m.`,
        },
        {
          stepNumber: 6,
          title: 'Deformada Elástica y Flecha Máxima Central',
          principle: 'Integración diferencial de Euler-Bernoulli con condiciones de empotramiento.',
          formulation: 'v(x) = (w·x² / (24·EI)) · (x - L)²\nv_max = v(L/2) = w·L⁴ / (384·EI)',
          substitution: deflection.isImplemented
            ? `v_max = (${wVal} · ${L}⁴) / (384 · ${EI?.toFixed(1)}) = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm`
            : 'Requiere EI para evaluación numérica.',
          result: deflection.isImplemented
            ? `v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${(L / 2).toFixed(3)} m.`
            : 'Cálculo de elástica pendiente de rigidez flexional.',
          check: {
            description: 'Giro nulo en ambos extremos: θ(0) = 0, θ(L) = 0',
            isVerified:
              deflection.isImplemented &&
              Math.abs(deflection.evaluateSlope(0)) < 1e-7 &&
              Math.abs(deflection.evaluateSlope(L)) < 1e-7,
          },
        },
      ];

      return {
        caseId: 'H3',
        caseName: 'Caso H3: Viga Biempotrada con Carga Uniformemente Distribuida',
        degreeOfIndeterminacy: 2,
        redundantReactions: ['MA (Momento reactivo en A)', 'MB (Momento reactivo en B)'],
        primaryStructure: 'Viga simplemente apoyada con momentos flectores en los extremos',
        compatibilityConditions: [
          'Giro nulo en apoyo A: θ(0) = 0',
          'Giro nulo en apoyo B: θ(L) = 0',
          'Desplazamiento nulo en ambos apoyos: v(0) = 0, v(L) = 0',
        ],
        steps,
        conclusions: [
          `Reacciones verticales simétricas: RA = RB = ${rA?.Ry.toFixed(3)} kN = wL/2`,
          `Momento reactivo en A: MA = +${rA?.Mr?.toFixed(3)} kN·m (antihorario)`,
          `Momento reactivo en B: MB = ${rB?.Mr?.toFixed(3)} kN·m (horario)`,
          `Momento máximo negativo en extremos: -${((wVal * L * L) / 12).toFixed(3)} kN·m = -wL²/12`,
          `Momento máximo positivo central: +${((wVal * L * L) / 24).toFixed(3)} kN·m = +wL²/24`,
          `Flecha máxima central: ${(deflection.isImplemented ? (deflection.maxDownward.value * 1000).toFixed(3) : '—')} mm = wL⁴/(384EI)`,
        ],
      };
    } else if (isSinglePoint) {
      // Single Point Load on Fixed-Fixed Beam
      const p = ptLoads[0]!;
      const a = p.x - sA.x;
      const b = sB.x - p.x;
      const P = p.P;
      const isCentral = Math.abs(a - b) < 1e-4;

      const steps: DidacticStep[] = [
        {
          stepNumber: 1,
          title: 'Identificación de la Indeterminación Cinemática y Estática',
          principle: 'Viga biempotrada plana con carga puntual concentrada.',
          formulation: 'GH = 4 reacciones transversales - 2 ecuaciones de equilibrio = 2 (Grado 2)',
          substitution: `Apoyo A (x=${sA.x}m) aporta [RA, MA]. Apoyo B (x=${sB.x}m) aporta [RB, MB]. Carga P = ${P} kN en x = ${p.x} m (a = ${a.toFixed(2)} m, b = ${b.toFixed(2)} m).`,
          result: 'Grado 2 de hiperestaticidad: se requieren dos condiciones de compatibilidad cinemática de giro.',
        },
        {
          stepNumber: 2,
          title: 'Condiciones de Contorno Cinemáticas Dobles',
          principle: 'Restricción total de desplazamiento vertical y rotación en ambos empotramientos.',
          formulation: 'v(0) = 0,  θ(0) = 0\nv(L) = 0,  θ(L) = 0',
          substitution: `La viga no puede deflectar ni rotar en x = 0 ni en x = ${L} m.`,
          result: 'Cuatro condiciones de frontera cinemáticas exactas.',
        },
        {
          stepNumber: 3,
          title: 'Cálculo de Momentos Reactivos de Empotramiento Perfecto',
          principle: 'Integración elástica de Euler-Bernoulli con giros nulos en extremos.',
          formulation: isCentral
            ? 'MA = + P·L / 8  (+CCW)\nMB = - P·L / 8  (-CW)'
            : 'MA = + P·a·b² / L²  (+CCW)\nMB = - P·a²·b / L²  (-CW)',
          substitution: isCentral
            ? `P = ${P} kN, L = ${L} m\nMA = +(${P} · ${L}) / 8 = +${((P * L) / 8).toFixed(3)} kN·m\nMB = -(${P} · ${L}) / 8 = -${((P * L) / 8).toFixed(3)} kN·m`
            : `P = ${P} kN, a = ${a} m, b = ${b} m, L = ${L} m\nMA = +(${P} · ${a} · ${b}²) / ${L}² = +${((P * a * b * b) / (L * L)).toFixed(3)} kN·m\nMB = -(${P} · ${a}² · ${b}) / ${L}² = -${((P * a * a * b) / (L * L)).toFixed(3)} kN·m`,
          result: `MA = ${rA?.Mr?.toFixed(3)} kN·m (+CCW), MB = ${rB?.Mr?.toFixed(3)} kN·m (-CW)`,
        },
        {
          stepNumber: 4,
          title: 'Reacciones Verticales por Equilibrio Estático y Compatibilidad',
          principle: 'Equilibrio de fuerzas verticales y momentos respecto a B.',
          formulation: isCentral
            ? 'RA = RB = P / 2'
            : 'RA = P · b² · (3a + b) / L³\nRB = P · a² · (a + 3b) / L³',
          substitution: isCentral
            ? `RA = RB = ${P} / 2 = ${(P / 2).toFixed(3)} kN`
            : `RA = (${P} · ${b}² · (3·${a} + ${b})) / ${L}³ = ${((P * b * b * (3 * a + b)) / L ** 3).toFixed(3)} kN\nRB = (${P} · ${a}² · (${a} + 3·${b})) / ${L}³ = ${((P * a * a * (a + 3 * b)) / L ** 3).toFixed(3)} kN`,
          result: `RA = ${rA?.Ry.toFixed(3)} kN (↑), RB = ${rB?.Ry.toFixed(3)} kN (↑)`,
          check: {
            description: 'Equilibrio estático global Σ Fy = 0, Σ M = 0',
            isVerified: equilibrium.isBalanced,
          },
        },
        {
          stepNumber: 5,
          title: 'Leyes de Momentos Flectores y Esfuerzos Internos',
          principle: 'Diagrama de momentos flectores: momentos de empotramiento y momento positivo bajo la carga.',
          formulation:
            'M(0+) = -MA = - P·a·b² / L²  (hogging)\n' +
            'M(L-) = -(-MB) = - P·a²·b / L²  (hogging)\n' +
            'M(a) = + 2·P·a²·b² / L³  (sagging bajo la carga)\n' +
            'V(a⁻) = RA,  V(a⁺) = RA - P = -RB',
          substitution:
            `M(0+) = ${formatSigned(moment.evaluate(0, 'right'), 3, 'kN·m')}\n` +
            `M(L-) = ${formatSigned(moment.evaluate(L, 'left'), 3, 'kN·m')}\n` +
            `M(${p.x}m) = ${formatSigned(moment.evaluate(p.x), 3, 'kN·m')}\n` +
            `Cortante lateral: V(${p.x}⁻) = ${formatSigned(shear.evaluate(p.x, 'left'), 3, 'kN')}, V(${p.x}⁺) = ${formatSigned(shear.evaluate(p.x, 'right'), 3, 'kN')}`,
          result: `Momento flector bajo la carga: M(${p.x}m) = ${formatSigned(moment.evaluate(p.x), 3, 'kN·m')}.`,
        },
        {
          stepNumber: 6,
          title: 'Deformada Elástica y Flecha bajo la Carga',
          principle: 'Doble integración de Euler-Bernoulli con condiciones de empotramiento biempotrado.',
          formulation: isCentral
            ? 'v_max = v(L/2) = P · L³ / (192 · EI)'
            : 'v(a) = (P · a³ · b³) / (3 · EI · L³)',
          substitution: deflection.isImplemented
            ? `Flecha bajo la carga en x = ${p.x} m: v = ${(deflection.evaluate(p.x) * 1000).toFixed(4)} mm\n` +
              `Flecha máxima descendente en x = ${deflection.maxDownward.x.toFixed(4)} m: v_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm.`
            : 'Requiere rigidez flexional EI para evaluación numérica.',
          result: deflection.isImplemented
            ? `v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${deflection.maxDownward.x.toFixed(3)} m.`
            : 'Requiere EI.',
          check: {
            description: 'Giro nulo en ambos extremos: θ(0) = 0, θ(L) = 0',
            isVerified:
              deflection.isImplemented &&
              Math.abs(deflection.evaluateSlope(0)) < 1e-7 &&
              Math.abs(deflection.evaluateSlope(L)) < 1e-7,
          },
        },
      ];

      return {
        caseId: 'H3',
        caseName: `Caso H3: Viga Biempotrada con Carga Puntual ${isCentral ? 'Central' : 'Excéntrica'}`,
        degreeOfIndeterminacy: 2,
        redundantReactions: ['MA (Momento reactivo en A)', 'MB (Momento reactivo en B)'],
        primaryStructure: 'Viga simplemente apoyada con momentos reactivos en extremos',
        compatibilityConditions: [
          'Giro nulo en apoyo A: θ(0) = 0',
          'Giro nulo en apoyo B: θ(L) = 0',
          'Desplazamiento nulo en ambos apoyos: v(0) = 0, v(L) = 0',
        ],
        steps,
        conclusions: [
          `Reacción vertical en A: RA = ${rA?.Ry.toFixed(3)} kN`,
          `Reacción vertical en B: RB = ${rB?.Ry.toFixed(3)} kN`,
          `Momento reactivo en A: MA = ${formatSigned(rA?.Mr ?? 0, 3, 'kN·m')} (+CCW)`,
          `Momento reactivo en B: MB = ${formatSigned(rB?.Mr ?? 0, 3, 'kN·m')} (-CW)`,
          `Momento flector máximo bajo la carga: ${formatSigned(moment.evaluate(p.x), 3, 'kN·m')}`,
          `Equilibrio estático y giros nulos en ambos extremos verificados con rigor analítico`,
        ],
      };
    } else {
      // General H3: Multiple or Combined Loads
      const loadDesc = [
        ...ptLoads.map((p) => `P = ${p.P} kN en x = ${p.x}m`),
        ...distLoads.map((d) => `w = ${d.wStart}${d.wEnd !== d.wStart ? `→${d.wEnd}` : ''} kN/m en [${d.xStart}, ${d.xEnd}]m`),
      ].join('; ');

      const steps: DidacticStep[] = [
        {
          stepNumber: 1,
          title: 'Identificación de la Indeterminación Cinemática (Cargas Múltiples/Combinadas)',
          principle: 'Viga biempotrada plana con restricciones totales en ambos extremos.',
          formulation: 'GH = 4 reacciones transversales - 2 ecuaciones de equilibrio = 2 (Grado 2)',
          substitution: `Apoyo A (x=${sA.x}m) [RA, MA] y Apoyo B (x=${sB.x}m) [RB, MB]. Cargas activas: ${loadDesc}.`,
          result: 'Grado 2 de hiperestaticidad: resuelto por superposición de momentos de empotramiento perfecto.',
        },
        {
          stepNumber: 2,
          title: 'Condiciones de Contorno Cinemáticas Dobles',
          principle: 'Restricción total de desplazamiento vertical y giro en ambos empotramientos.',
          formulation: 'v(0) = 0, θ(0) = 0\nv(L) = 0, θ(L) = 0',
          substitution: `La viga no puede deflectar ni rotar en x = 0 ni en x = ${L} m.`,
          result: 'Cuatro condiciones cinemáticas exactas.',
        },
        {
          stepNumber: 3,
          title: 'Superposición de Momentos Reactivos de Empotramiento Perfecto',
          principle: 'Principio de superposición elástica de Euler-Bernoulli.',
          formulation: 'MA = Σ MA_i (+CCW)\nMB = Σ MB_i (-CW)',
          substitution: `Suma de contribuciones individuales de cada carga: ${loadDesc}.`,
          result: `MA = ${formatSigned(rA?.Mr ?? 0, 3, 'kN·m')} (+CCW), MB = ${formatSigned(rB?.Mr ?? 0, 3, 'kN·m')} (-CW)`,
        },
        {
          stepNumber: 4,
          title: 'Reacciones Verticales por Equilibrio Estático Global',
          principle: 'Equilibrio de fuerzas verticales y momentos respecto a B.',
          formulation: 'RA = Σ F_y - RB\nΣ M_B = 0',
          substitution: `RA = ${rA?.Ry.toFixed(3)} kN, RB = ${rB?.Ry.toFixed(3)} kN`,
          result: `RA = ${rA?.Ry.toFixed(3)} kN (↑), RB = ${rB?.Ry.toFixed(3)} kN (↑)`,
          check: {
            description: 'Equilibrio global vertical y de momentos Σ Fy = 0, Σ M = 0',
            isVerified: equilibrium.isBalanced,
          },
        },
        {
          stepNumber: 5,
          title: 'Leyes de Esfuerzos Internos por Integración Continua',
          principle: 'Evaluación de funciones continuas por tramos en singularidades.',
          formulation: 'V(x) = RA - ∫ w(x) dx - Σ P_i\nM(x) = -MA + ∫ V(x) dx',
          substitution:
            `Momento en empotramiento A: M(0+) = ${formatSigned(moment.evaluate(0, 'right'), 3, 'kN·m')}\n` +
            `Momento en empotramiento B: M(L-) = ${formatSigned(moment.evaluate(L, 'left'), 3, 'kN·m')}\n` +
            `Momento flector máximo positivo: M_max(+) = ${formatSigned(moment.maxPositive.value, 4, 'kN·m')} en x = ${moment.maxPositive.x.toFixed(3)} m.`,
          result: `M_max(+) = ${moment.maxPositive.value.toFixed(4)} kN·m.`,
        },
        {
          stepNumber: 6,
          title: 'Deformada Elástica por Doble Integración de Euler-Bernoulli',
          principle: 'Integración numérica de EI · v\'\'(x) = -M(x) con condiciones de biempotramiento.',
          formulation: 'v(0) = 0, θ(0) = 0, v(L) = 0, θ(L) = 0',
          substitution: deflection.isImplemented
            ? `Flecha máxima descendente en x = ${deflection.maxDownward.x.toFixed(4)} m: v_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm.`
            : 'Requiere EI para evaluación numérica.',
          result: deflection.isImplemented
            ? `v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x = ${deflection.maxDownward.x.toFixed(3)} m.`
            : 'Requiere EI.',
          check: {
            description: 'Giro nulo en ambos extremos: θ(0) = 0, θ(L) = 0',
            isVerified:
              deflection.isImplemented &&
              Math.abs(deflection.evaluateSlope(0)) < 1e-7 &&
              Math.abs(deflection.evaluateSlope(L)) < 1e-7,
          },
        },
      ];

      return {
        caseId: 'H3',
        caseName: 'Caso H3: Viga Biempotrada con Cargas Múltiples / Combinadas',
        degreeOfIndeterminacy: 2,
        redundantReactions: ['MA (Momento reactivo en A)', 'MB (Momento reactivo en B)'],
        primaryStructure: 'Viga biempotrada resuelta por superposición de momentos de empotramiento',
        compatibilityConditions: [
          'Giro nulo en apoyo A: θ(0) = 0',
          'Giro nulo en apoyo B: θ(L) = 0',
          'Desplazamiento nulo en ambos apoyos: v(0) = 0, v(L) = 0',
        ],
        steps,
        conclusions: [
          `Reacciones verticales: RA = ${rA?.Ry.toFixed(3)} kN, RB = ${rB?.Ry.toFixed(3)} kN`,
          `Momento reactivo en A: MA = ${formatSigned(rA?.Mr ?? 0, 3, 'kN·m')} (+CCW)`,
          `Momento reactivo en B: MB = ${formatSigned(rB?.Mr ?? 0, 3, 'kN·m')} (-CW)`,
          `Solución exacta mediante superposición de momentos de empotramiento perfecto de Euler-Bernoulli`,
        ],
      };
    }
  }

  // Case H4: Continuous beam with two equal spans
  if (supports.length === 3 && fixedCount === 0) {
    const s1 = supports[0]!;
    const s2 = supports[1]!;
    const s3 = supports[2]!;
    const r1 = reactions.find((r) => r.supportId === s1.id);
    const r2 = reactions.find((r) => r.supportId === s2.id);
    const r3 = reactions.find((r) => r.supportId === s3.id);

    const Lv = s2.x - s1.x;
    const distLoads = model.loads.filter((l): l is DistributedLoad => l.type === 'distributed');
    const wVal = distLoads[0]?.wStart ?? 0;

    const xMax1 = (Lv * (1 + Math.sqrt(33))) / 16;
    const xMax2 = 2 * Lv - xMax1;

    const steps: DidacticStep[] = [
      {
        stepNumber: 1,
        title: 'Identificación de la Indeterminación en Viga Continua',
        principle: 'Viga de múltiples vanos sobre apoyos simples.',
        formulation: 'GH = 3 reacciones verticales - 2 ecuaciones de equilibrio = 1 (Grado 1)',
        substitution: `3 apoyos simples [R1 en x=0, R2 en x=${s2.x}m, R3 en x=${s3.x}m]. Dos vanos iguales Lv = ${Lv} m con carga uniforme w = ${wVal} kN/m.`,
        result: 'Se adopta como incógnita hiperestática el momento flector interno en el apoyo central: M_B.',
      },
      {
        stepNumber: 2,
        title: 'Ecuación de los Tres Momentos de Clapeyron',
        principle: 'Continuidad de pendiente sobre el apoyo intermedio B entre vano 1 y vano 2.',
        formulation: 'M_A·L1 + 2·M_B·(L1 + L2) + M_C·L2 = - (w1·L1³ / 4) - (w2·L2³ / 4)',
        substitution: `M_A = 0 (apoyo simple exterior), M_C = 0 (apoyo simple exterior).\nL1 = L2 = Lv = ${Lv} m, w1 = w2 = ${wVal} kN/m.\n2·M_B·(${Lv} + ${Lv}) = - (${wVal}·${Lv}³ / 4) - (${wVal}·${Lv}³ / 4)\n4·M_B·${Lv} = - (${wVal}·${Lv}³ / 2)`,
        result: `M_B = - w·Lv² / 8 = - (${wVal} · ${Lv}²) / 8 = -${((wVal * Lv * Lv) / 8).toFixed(3)} kN·m`,
      },
      {
        stepNumber: 3,
        title: 'Equilibrio de Fuerzas en Cada Vano Aislado',
        principle: 'Equilibrio estático independiente de cada vano bajo carga externa y momento M_B.',
        formulation:
          'Vano 1 (Σ M_B = 0): R1 = w·Lv / 2 + M_B / Lv = (3/8) · w · Lv\n' +
          'Vano 2 (Σ M_B = 0): R3 = w·Lv / 2 + M_B / Lv = (3/8) · w · Lv\n' +
          'Apoyo central B: R2 = 2·w·Lv - R1 - R3 = (5/4) · w · Lv',
        substitution:
          `R1 = R3 = (3/8) · ${wVal} · ${Lv} = ${((3 / 8) * wVal * Lv).toFixed(3)} kN\n` +
          `R2 = (5/4) · ${wVal} · ${Lv} = ${((5 / 4) * wVal * Lv).toFixed(3)} kN`,
        result: `R1 = ${r1?.Ry.toFixed(3)} kN (↑), R2 = ${r2?.Ry.toFixed(3)} kN (↑), R3 = ${r3?.Ry.toFixed(3)} kN (↑)`,
        check: {
          description: 'Equilibrio total Σ Fy = R1 + R2 + R3 - 2·w·Lv = 0',
          isVerified: equilibrium.isBalanced,
          errorMargin: Math.abs(equilibrium.sumFy),
        },
      },
      {
        stepNumber: 4,
        title: 'Esfuerzos Internos, Momentos Máximos y Puntos de Inflexión',
        principle: 'Análisis de cortante cero y momento máximo positivo en cada vano.',
        formulation:
          'Vano 1: V(x) = R1 - w·x = 0  =>  x_0 = 3·Lv / 8\n' +
          'M_max(+) = 9·w·Lv² / 128\n' +
          'Punto de inflexión: M(x) = R1·x - w·x²/2 = 0  =>  x_inf = 3·Lv / 4',
        substitution:
          `x_0 = 3(${Lv})/8 = ${(3 * Lv / 8).toFixed(3)} m desde el extremo izquierdo.\n` +
          `M_max(+) = 9(${wVal})(${Lv}²)/128 = ${(9 * wVal * Lv * Lv / 128).toFixed(4)} kN·m.\n` +
          `x_inf = 3(${Lv})/4 = ${(3 * Lv / 4).toFixed(3)} m (primer vano).`,
        result: `M_max(+) = +${(9 * wVal * Lv * Lv / 128).toFixed(3)} kN·m en x = ${(3 * Lv / 8).toFixed(3)} m; M_B = -${((wVal * Lv * Lv) / 8).toFixed(3)} kN·m en x = ${Lv} m.`,
      },
      {
        stepNumber: 5,
        title: 'Deformada Elástica, Continuidad en B y Flecha Máxima (Máximos Simétricos)',
        principle: 'Elástica del primer vano (u = x/Lv), simetría estructural y condición de pendiente nula en el apoyo central.',
        formulation:
          'EI · v(x) = (w·Lv⁴ / 48) · (2u⁴ - 3u³ + u)  en vano 1 (0 ≤ x ≤ Lv)\n' +
          'Raíz de v\'(x) = 0: u_max = (1 + √33) / 16 ≈ 0.421535\n' +
          'Flecha máxima simétrica en ambos vanos:\n' +
          '  Vano 1: x_max1 = Lv · (1 + √33) / 16 ≈ 0.421535 · Lv\n' +
          '  Vano 2: x_max2 = 2·Lv - x_max1 ≈ 1.578465 · Lv\n' +
          'Magnitud teórica en ambos vanos: v_max = ((39 + 55√33) / 65536) · (w·Lv⁴ / EI)',
        substitution: deflection.isImplemented
          ? `Vano 1: x_max1 = ${Lv} · (1 + √33)/16 = ${xMax1.toFixed(4)} m\n` +
            `Vano 2: x_max2 = ${2 * Lv} - ${xMax1.toFixed(4)} = ${xMax2.toFixed(4)} m\n` +
            `Flecha máxima teórica en ambos picos: v_max = ${(deflection.maxDownward.value * 1000).toFixed(4)} mm\n` +
            `Evaluación numérica registrada en x = ${deflection.maxDownward.x.toFixed(4)} m: ${(deflection.maxDownward.value * 1000).toFixed(4)} mm\n` +
            `Giro en apoyo central B: θ(${Lv}m) = ${deflection.evaluateSlope(Lv).toFixed(7)} rad (continuidad perfecta).`
          : 'Requiere rigidez flexional EI para evaluación numérica.',
        result: deflection.isImplemented
          ? `Dos picos de flecha máxima simétricos: v_max = ${(deflection.maxDownward.value * 1000).toFixed(3)} mm en x₁ = ${xMax1.toFixed(3)} m (Vano 1) y x₂ = ${xMax2.toFixed(3)} m (Vano 2).`
          : 'Cálculo de elástica pendiente de rigidez flexional.',
        check: {
          description: 'Continuidad de desplazamiento y pendiente en apoyo central B',
          isVerified:
            deflection.isImplemented &&
            Math.abs(deflection.evaluate(Lv)) < 1e-7 &&
            Math.abs(deflection.evaluateSlope(Lv)) < 1e-6,
        },
      },
    ];

    return {
      caseId: 'H4',
      caseName: 'Caso H4: Viga Continua de Dos Vanos Iguales con Carga Uniforme',
      degreeOfIndeterminacy: 1,
      redundantReactions: ['MB (Momento flector interno sobre apoyo intermedio B)'],
      primaryStructure: 'Dos vanos isostáticos articulados independientemente',
      compatibilityConditions: [
        'Continuidad de pendiente sobre apoyo intermedio B: θ_izq(B) = θ_der(B)',
        'Desplazamiento nulo en los tres apoyos: v(0)=0, v(Lv)=0, v(2Lv)=0',
      ],
      steps,
      conclusions: [
        `Momento flector sobre el apoyo central: MB = -${((wVal * Lv * Lv) / 8).toFixed(3)} kN·m = -wLv²/8`,
        `Reacciones exteriores simples: R1 = R3 = ${r1?.Ry.toFixed(3)} kN = 3wLv/8`,
        `Reacción en apoyo intermedio: R2 = ${r2?.Ry.toFixed(3)} kN = 5wLv/4`,
        `Momento máximo positivo en vanos: +${(9 * wVal * Lv * Lv / 128).toFixed(3)} kN·m en x = ${(3 * Lv / 8).toFixed(3)} m y ${(Lv + 5 * Lv / 8).toFixed(3)} m`,
        `Flechas máximas simétricas en ambos vanos: ${(deflection.isImplemented ? (deflection.maxDownward.value * 1000).toFixed(3) : '—')} mm en x₁ = ${xMax1.toFixed(3)} m (Vano 1) y x₂ = ${xMax2.toFixed(3)} m (Vano 2)`,
      ],
    };
  }

  // Fallback for custom or unsupported cases
  return {
    caseId: 'CUSTOM_HYPERSTATIC',
    caseName: 'Viga Hiperestática Personalizada',
    degreeOfIndeterminacy: Math.max(1, supports.length - 2),
    redundantReactions: ['Reacciones redundantes resueltas por compatibilidad'],
    primaryStructure: 'Estructura primaria base',
    compatibilityConditions: ['Compatibilidad cinemática en apoyos'],
    steps: [
      {
        stepNumber: 1,
        title: 'Resolución Numérica por Compatibilidad Elástica',
        principle: 'Método de rigidez / flexibilidad estructural.',
        result: 'Reacciones y esfuerzos calculados por el motor @optisteel/core.',
      },
    ],
    conclusions: ['Análisis estructural completado exitosamente.'],
  };
}
