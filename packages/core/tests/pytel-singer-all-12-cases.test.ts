import { describe, expect, it } from 'vitest';
import {
  analyzeBeam,
  calculateFlexuralRigidity,
  PYTEL_SINGER_CASES,
} from '../src/index.js';
import type { BeamMaterial, BeamSection } from '../src/types.js';

describe('Pytel-Singer Tabla 6-2 - Auditoría y Validación Completa de los 12 Casos', () => {
  // Propiedades elásticas estándar para los ensayos:
  // Acero estructural: E = 200 GPa
  // Sección IPE 300 aprox: Iz = 8356 cm^4
  // EI = 200 * 8356 * 10^-2 = 16712 kN*m^2
  const material: BeamMaterial = { name: 'Acero Estructural', E: 200.0 };
  const section: BeamSection = { name: 'Perfil Ensayo', Iz: 8356.0 };
  const EI = calculateFlexuralRigidity(material, section);

  // --------------------------------------------------------------------------
  // CASO 1: Voladizo con carga puntual en extremo libre (x = L)
  // --------------------------------------------------------------------------
  it('Caso 1: Voladizo con carga puntual en extremo libre', () => {
    const c1 = PYTEL_SINGER_CASES[1]!;
    const params = { L: 4.0, P: 25.0 };
    const model = { ...c1.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c1.evaluateTheoretical(params, EI);

    // 1. Reacciones y momento
    expect(res.reactions[0]!.Ry).toBeCloseTo(theo.RA, 8);
    expect(res.reactions[0]!.Mr).toBeCloseTo(theo.MA!, 8);
    expect(res.moment.maxAbsolute.value).toBeCloseTo(Math.abs(theo.maxMoment), 8);

    // 2. Pendientes y elástica
    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    // Comprobación seccional punto a punto
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      const x = frac * params.L;
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 2: Voladizo con carga puntual intermedia en x = a
  // --------------------------------------------------------------------------
  it('Caso 2: Voladizo con carga puntual intermedia (x = a)', () => {
    const c2 = PYTEL_SINGER_CASES[2]!;
    const params = { L: 6.0, a: 4.0, P: 30.0 };
    const model = { ...c2.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c2.evaluateTheoretical(params, EI);

    expect(res.reactions[0]!.Ry).toBeCloseTo(theo.RA, 8);
    expect(res.reactions[0]!.Mr).toBeCloseTo(theo.MA!, 8);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(0, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [1.0, 2.0, 4.0, 5.0, 6.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 3: Voladizo con carga uniformemente distribuida w
  // --------------------------------------------------------------------------
  it('Caso 3: Voladizo con carga uniformemente distribuida', () => {
    const c3 = PYTEL_SINGER_CASES[3]!;
    const params = { L: 5.0, w: 12.0 };
    const model = { ...c3.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c3.evaluateTheoretical(params, EI);

    expect(res.reactions[0]!.Ry).toBeCloseTo(theo.RA, 8);
    expect(res.reactions[0]!.Mr).toBeCloseTo(theo.MA!, 8);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(0, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const frac of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      const x = frac * params.L;
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 4: Voladizo con carga triangular creciente (0 en empotramiento, w en extremo)
  // --------------------------------------------------------------------------
  it('Caso 4: Voladizo con carga triangular creciente', () => {
    const c4 = PYTEL_SINGER_CASES[4]!;
    const params = { L: 6.0, w: 18.0 };
    const model = { ...c4.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c4.evaluateTheoretical(params, EI);

    expect(res.reactions[0]!.Ry).toBeCloseTo(theo.RA, 8);
    expect(res.reactions[0]!.Mr).toBeCloseTo(theo.MA!, 8);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(0, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [1.5, 3.0, 4.5, 6.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 5: Voladizo con momento concentrado en el extremo libre
  // --------------------------------------------------------------------------
  it('Caso 5: Voladizo con momento concentrado en el extremo libre', () => {
    const c5 = PYTEL_SINGER_CASES[5]!;
    const params = { L: 4.0, M: 20.0 };
    const model = { ...c5.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c5.evaluateTheoretical(params, EI);

    expect(res.reactions[0]!.Ry).toBeCloseTo(theo.RA, 8);
    expect(res.reactions[0]!.Mr).toBeCloseTo(theo.MA!, 8);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(0, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [1.0, 2.0, 3.0, 4.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 6: Viga simplemente apoyada con carga puntual central
  // --------------------------------------------------------------------------
  it('Caso 6: Viga simplemente apoyada con carga puntual central', () => {
    const c6 = PYTEL_SINGER_CASES[6]!;
    const params = { L: 8.0, P: 40.0 };
    const model = { ...c6.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c6.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [1.0, 2.0, 4.0, 6.0, 7.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 7: Viga simplemente apoyada con carga puntual excéntrica
  // --------------------------------------------------------------------------
  it('Caso 7: Viga simplemente apoyada con carga puntual excéntrica', () => {
    const c7 = PYTEL_SINGER_CASES[7]!;
    const params = { L: 10.0, a: 6.0, P: 50.0 }; // a > b (a=6, b=4)
    const model = { ...c7.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c7.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 7);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 4);

    for (const x of [1.5, 3.0, 6.0, 8.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 8: Viga simplemente apoyada con carga uniforme completa
  // --------------------------------------------------------------------------
  it('Caso 8: Viga simplemente apoyada con carga uniforme completa', () => {
    const c8 = PYTEL_SINGER_CASES[8]!;
    const params = { L: 6.0, w: 15.0 };
    const model = { ...c8.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c8.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [0.5, 1.5, 3.0, 4.5, 5.5]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 9: Viga simplemente apoyada con carga triangular completa
  // Auditoría crítica: fórmula aproximada del texto vs solución analítica exacta
  // --------------------------------------------------------------------------
  it('Caso 9: Viga simplemente apoyada con carga triangular completa (Auditoría exacta vs aprox)', () => {
    const c9 = PYTEL_SINGER_CASES[9]!;
    const params = { L: 6.0, w: 16.0 };
    const model = { ...c9.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c9.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    // 1. Pendientes extremas exactas
    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);

    // 2. Comprobación de la elástica exacta en varios puntos
    for (const x of [1.0, 2.0, 3.116, 4.5, 5.5]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }

    // 3. Verificación de la raíz exacta del solucionador general:
    // x_exact = sqrt((15 - sqrt(120))/15) * 6 ~ 3.11598 m (0.51933 L)
    // delta_exact = 0.0065223 * w*L^4 / EI
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 4);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.exactMaxDeflection!, 7);

    // 4. Comparación con la aproximación pedagógica de Pytel: 2.5 / 384 ~ 0.0065104
    // Discrepancia del -0.18%
    const relativeDiff =
      (theo.maxDeflection - theo.exactMaxDeflection!) / theo.exactMaxDeflection!;
    expect(relativeDiff).toBeCloseTo(-0.0018, 3);
  });

  // --------------------------------------------------------------------------
  // CASO 10: Viga simplemente apoyada con carga triangular simétrica
  // --------------------------------------------------------------------------
  it('Caso 10: Viga simplemente apoyada con carga triangular simétrica', () => {
    const c10 = PYTEL_SINGER_CASES[10]!;
    const params = { L: 8.0, w: 20.0 };
    const model = { ...c10.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c10.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 8);

    for (const x of [1.0, 2.5, 4.0, 5.5, 7.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 11: Viga simplemente apoyada con momento en apoyo derecho
  // --------------------------------------------------------------------------
  it('Caso 11: Viga simplemente apoyada con momento concentrado en apoyo derecho', () => {
    const c11 = PYTEL_SINGER_CASES[11]!;
    const params = { L: 6.0, M: 36.0 };
    const model = { ...c11.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c11.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 4);

    for (const x of [1.0, 2.0, 3.464, 4.5, 5.5]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });

  // --------------------------------------------------------------------------
  // CASO 12: Viga simplemente apoyada con momento en apoyo izquierdo
  // --------------------------------------------------------------------------
  it('Caso 12: Viga simplemente apoyada con momento concentrado en apoyo izquierdo', () => {
    const c12 = PYTEL_SINGER_CASES[12]!;
    const params = { L: 6.0, M: 36.0 };
    const model = { ...c12.createModel(params), material, section };

    const res = analyzeBeam(model);
    const theo = c12.evaluateTheoretical(params, EI);

    expect(res.deflection.isImplemented).toBe(true);
    if (!res.deflection.isImplemented) return;

    expect(res.deflection.endSlopes.thetaLeft).toBeCloseTo(theo.thetaLeft, 8);
    expect(res.deflection.endSlopes.thetaRight).toBeCloseTo(theo.thetaRight, 8);
    expect(res.deflection.maxDownward.value).toBeCloseTo(theo.maxDeflection, 8);
    expect(res.deflection.maxDownward.x).toBeCloseTo(theo.maxDeflectionLocation, 4);

    for (const x of [1.0, 2.536, 4.0, 5.0]) {
      expect(res.deflection.evaluate(x)).toBeCloseTo(theo.evaluateDeflection(x), 8);
    }
  });
});
