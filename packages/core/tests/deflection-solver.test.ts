import { describe, expect, it } from 'vitest';
import {
  analyzeBeam,
  calculateFlexuralRigidity,
  findSlopeRootsOnSegment,
  solveCubicRoots,
  solveDeflections,
} from '../src/index.js';
import type { BeamMaterial, BeamModel, BeamSection } from '../src/types.js';

describe('Solucionador General de Deformaciones y Condiciones de Contorno', () => {
  const material: BeamMaterial = { name: 'Acero A36', E: 200.0 }; // GPa
  const section: BeamSection = { name: 'W10x30 aprox', Iz: 7076.0 }; // cm^4
  const EI = calculateFlexuralRigidity(material, section); // 200 * 7076 * 10^-2 = 14152 kN*m^2

  it('Verifica conversión exacta de unidades para rigidez a flexión EI', () => {
    // 1 GPa = 10^6 kN/m^2
    // 1 cm^4 = 10^-8 m^4
    // EI = 200 * 10^6 * 7076 * 10^-8 = 14152 kN*m^2
    expect(EI).toBeCloseTo(14152.0, 8);
  });

  it('Rechaza propiedades elásticas no físicas o no finitas', () => {
    expect(() =>
      calculateFlexuralRigidity({ E: 0 }, { Iz: 5000 })
    ).toThrow(/módulo de elasticidad/i);

    expect(() =>
      calculateFlexuralRigidity({ E: -200 }, { Iz: 5000 })
    ).toThrow(/módulo de elasticidad/i);

    expect(() =>
      calculateFlexuralRigidity({ E: 200 }, { Iz: 0 })
    ).toThrow(/momento de inercia/i);

    expect(() =>
      calculateFlexuralRigidity({ E: 200 }, { Iz: -100 })
    ).toThrow(/momento de inercia/i);

    expect(() =>
      calculateFlexuralRigidity({ E: NaN }, { Iz: 5000 })
    ).toThrow(/módulo de elasticidad/i);
  });

  it('Verificación estricta de condiciones de contorno en apoyos y empotramientos', () => {
    // 1. Voladizo empotrado en x = 0
    const cantModel: BeamModel = {
      length: 5.0,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [{ id: 'P', type: 'point', x: 5.0, P: 20.0 }],
      material,
      section,
    };
    const resCant = analyzeBeam(cantModel);
    if (!resCant.deflection.isImplemented) throw new Error('Deflection not implemented');

    // En el empotramiento: deflexión y pendiente deben ser rigurosamente 0
    expect(resCant.deflection.evaluate(0)).toBeCloseTo(0, 10);
    expect(resCant.deflection.evaluateSlope(0)).toBeCloseTo(0, 10);

    // 2. Viga con apoyos en x = 2 y x = 8 (voladizos en ambos lados)
    const overhangModel: BeamModel = {
      length: 10.0,
      supports: [
        { id: 'S1', type: 'pin', x: 2.0 },
        { id: 'S2', type: 'roller', x: 8.0 },
      ],
      loads: [
        { id: 'P_tip1', type: 'point', x: 0, P: 15.0 },
        { id: 'W_mid', type: 'distributed', xStart: 2.0, xEnd: 8.0, wStart: 10.0, wEnd: 10.0 },
        { id: 'P_tip2', type: 'point', x: 10.0, P: 20.0 },
      ],
      material,
      section,
    };
    const resOverhang = analyzeBeam(overhangModel);
    if (!resOverhang.deflection.isImplemented) throw new Error('Deflection not implemented');

    // En los apoyos x=2 y x=8 la deflexión debe ser 0
    expect(resOverhang.deflection.evaluate(2.0)).toBeCloseTo(0, 9);
    expect(resOverhang.deflection.evaluate(8.0)).toBeCloseTo(0, 9);

    // En las puntas de los voladizos x=0 y x=10 bajo cargas descendentes,
    // el extremo deflecta hacia abajo (y > 0)
    expect(resOverhang.deflection.evaluate(0.0)).toBeGreaterThan(0);
    expect(resOverhang.deflection.evaluate(10.0)).toBeGreaterThan(0);

    // Continuidad de pendiente dy/dx en los apoyos interiores
    const delta = 1e-5;
    const slopeBefore = (resOverhang.deflection.evaluate(2.0) - resOverhang.deflection.evaluate(2.0 - delta)) / delta;
    const slopeAfter = (resOverhang.deflection.evaluate(2.0 + delta) - resOverhang.deflection.evaluate(2.0)) / delta;
    expect(slopeBefore).toBeCloseTo(slopeAfter, 3);
  });

  it('Deflexión negativa (hacia arriba) en voladizo debido a carga en vano interior', () => {
    // Viga con voladizo izquierdo [0, 2] y vano apoyado [2, 8]
    // Carga uniforme SOLAMENTE en el vano interior [2, 8]
    // Por continuidad de pendiente en el apoyo S1 (x=2), la punta libre x=0 debe levantarse (y < 0)
    const model: BeamModel = {
      length: 8.0,
      supports: [
        { id: 'S1', type: 'pin', x: 2.0 },
        { id: 'S2', type: 'roller', x: 8.0 },
      ],
      loads: [
        { id: 'W_mid', type: 'distributed', xStart: 2.0, xEnd: 8.0, wStart: 25.0, wEnd: 25.0 },
      ],
      material,
      section,
    };

    const res = analyzeBeam(model);
    if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');

    // Apoyos en cero
    expect(res.deflection.evaluate(2.0)).toBeCloseTo(0, 9);
    expect(res.deflection.evaluate(8.0)).toBeCloseTo(0, 9);

    // Vano interior baja (y > 0)
    expect(res.deflection.evaluate(5.0)).toBeGreaterThan(0);

    // Punta del voladizo izquierdo sube (y < 0 / upward deflection)
    const yTip = res.deflection.evaluate(0);
    expect(yTip).toBeLessThan(0);
    expect(res.deflection.maxUpward.value).toBeCloseTo(yTip, 8);
    expect(res.deflection.maxUpward.x).toBeCloseTo(0, 8);
  });

  it('Principio de Superposición para deformaciones', () => {
    // Estado A: Carga distribuida uniforme
    const modelA: BeamModel = {
      length: 6.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 6.0 },
      ],
      loads: [{ id: 'W', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 12.0, wEnd: 12.0 }],
      material,
      section,
    };

    // Estado B: Carga puntual en tercio
    const modelB: BeamModel = {
      length: 6.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 6.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 2.0, P: 30.0 }],
      material,
      section,
    };

    // Estado Combinado A + B
    const modelComb: BeamModel = {
      length: 6.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 6.0 },
      ],
      loads: [
        { id: 'W', type: 'distributed', xStart: 0, xEnd: 6.0, wStart: 12.0, wEnd: 12.0 },
        { id: 'P', type: 'point', x: 2.0, P: 30.0 },
      ],
      material,
      section,
    };

    const resA = analyzeBeam(modelA);
    const resB = analyzeBeam(modelB);
    const resComb = analyzeBeam(modelComb);

    if (
      !resA.deflection.isImplemented ||
      !resB.deflection.isImplemented ||
      !resComb.deflection.isImplemented
    ) {
      throw new Error('Deflection not implemented');
    }

    // Pendientes en extremos
    expect(resComb.deflection.endSlopes.thetaLeft).toBeCloseTo(
      resA.deflection.endSlopes.thetaLeft + resB.deflection.endSlopes.thetaLeft,
      8
    );
    expect(resComb.deflection.endSlopes.thetaRight).toBeCloseTo(
      resA.deflection.endSlopes.thetaRight + resB.deflection.endSlopes.thetaRight,
      8
    );

    // Deflexiones en múltiples puntos a lo largo de la viga
    for (const x of [0.5, 1.5, 2.0, 3.0, 4.5, 5.5]) {
      const yA = resA.deflection.evaluate(x);
      const yB = resB.deflection.evaluate(x);
      const yComb = resComb.deflection.evaluate(x);
      expect(yComb).toBeCloseTo(yA + yB, 8);
    }
  });

  it('Modelo sin material ni sección devuelve placeholder informativo de deflexión', () => {
    const model: BeamModel = {
      length: 5.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0 },
        { id: 'S2', type: 'roller', x: 5.0 },
      ],
      loads: [{ id: 'P', type: 'point', x: 2.5, P: 20.0 }],
    };
    const res = analyzeBeam(model);
    expect(res.deflection.isImplemented).toBe(false);
    if (!res.deflection.isImplemented) {
      expect(res.deflection.note).toContain('proporcione');
    }
  });

  // =========================================================================
  // REQUISITOS OBLIGATORIOS AUDITORÍA H-F2-01: RAÍCES DE PENDIENTE Y DEFLEXIÓN
  // =========================================================================

  describe('H-F2-01: Detección exhaustiva de puntos estacionarios de pendiente', () => {
    // 1. Contraejemplo de auditoría
    it('Contraejemplo de auditoría: detecta los dos ceros interiores de pendiente y no subestima deflexión máxima', () => {
      // Longitud: 10 m, Apoyos en x=0 y x=8 m
      // Carga puntual de 50 kN en x=2 m, Carga puntual de 30 kN en x=10 m
      const model: BeamModel = {
        length: 10.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0 },
          { id: 'S2', type: 'roller', x: 8.0 },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 2.0, P: 50.0 },
          { id: 'P2', type: 'point', x: 10.0, P: 30.0 },
        ],
        material,
        section,
      };

      const res = analyzeBeam(model);
      if (!res.deflection.isImplemented) throw new Error('Deflection not implemented');

      // Buscar puntos estacionarios de deflexión (donde theta = 0)
      const stationaryPoints = res.deflection.criticalPoints.filter(
        (p) => p.type === 'local_max'
      );

      // Comprobar que se detectan los 2 puntos estacionarios interiores reportados por la auditoría en [2, 8]
      expect(stationaryPoints.length).toBe(2);

      const root1 = stationaryPoints.find((p) => Math.abs(p.x - 2.6548) < 0.01);
      const root2 = stationaryPoints.find((p) => Math.abs(p.x - 7.3452) < 0.01);

      expect(root1).toBeDefined();
      expect(root2).toBeDefined();

      // Verificar que en ambos la pendiente es efectivamente cero (|theta| < 1e-7 rad)
      expect(Math.abs(res.deflection.evaluateSlope(root1!.x))).toBeLessThan(1e-7);
      expect(Math.abs(res.deflection.evaluateSlope(root2!.x))).toBeLessThan(1e-7);

      // Deflexión en x1 (máximo positivo / hacia abajo)
      expect(root1!.value).toBeCloseTo(0.011376, 5); // ~11.38 mm
      // Deflexión en x2 (máximo negativo / hacia arriba)
      expect(root2!.value).toBeCloseTo(-0.000777, 5); // ~ -0.78 mm

      // Deflexión en la punta libre x = 10 m
      const yTip = res.deflection.evaluate(10.0);
      expect(yTip).toBeCloseTo(0.010599, 5); // ~10.60 mm

      // La deflexión máxima global hacia abajo DEBE ser la del punto estacionario interior x ~ 2.65 m
      // y NO la de la punta x = 10 m (que el algoritmo anterior subestimaba al omitir las raíces interiores)
      expect(res.deflection.maxDownward.x).toBeCloseTo(root1!.x, 4);
      expect(res.deflection.maxDownward.value).toBeCloseTo(root1!.value, 6);
      expect(res.deflection.maxDownward.value).toBeGreaterThan(yTip);

      // Comprobar maxUpward
      expect(res.deflection.maxUpward.x).toBeCloseTo(root2!.x, 4);
      expect(res.deflection.maxUpward.value).toBeCloseTo(root2!.value, 6);

      // Comprobar maxAbsolute
      expect(res.deflection.maxAbsolute.value).toBeCloseTo(root1!.value, 6);
    });

    // 2. Tramo con varias raíces de pendiente
    it('Detecta múltiples ceros de pendiente en un mismo tramo polinómico', () => {
      // Direct unit test of polynomial root finder on [0, 4]
      // theta(xi) = (xi - 1)(xi - 2)(xi - 3) = xi^3 - 6*xi^2 + 11*xi - 6
      // t0 = -6, t1 = 11, t2 = -6, t3 = 1, t4 = 0, h = 4
      const rootsCubic = findSlopeRootsOnSegment(-6, 11, -6, 1, 0, 4.0);
      expect(rootsCubic.length).toBe(3);
      expect(rootsCubic[0]).toBeCloseTo(1.0, 6);
      expect(rootsCubic[1]).toBeCloseTo(2.0, 6);
      expect(rootsCubic[2]).toBeCloseTo(3.0, 6);

      // Polynomial of degree 4 with 3 roots inside [0, 5]:
      // theta(xi) = (xi - 1)(xi - 2.5)(xi - 4) * (xi + 1)
      // Expansion: (xi^2 - 3.5xi + 2.5)(xi - 4) = xi^3 - 7.5xi^2 + 16.5xi - 10
      // Multiplied by (xi + 1) = xi^4 - 6.5xi^3 + 9xi^2 + 6.5xi - 10
      // Roots in (0, 5) are xi = 1.0, 2.5, 4.0
      const rootsQuartic = findSlopeRootsOnSegment(-10, 6.5, 9, -6.5, 1, 5.0);
      expect(rootsQuartic.length).toBe(3);
      expect(rootsQuartic[0]).toBeCloseTo(1.0, 6);
      expect(rootsQuartic[1]).toBeCloseTo(2.5, 6);
      expect(rootsQuartic[2]).toBeCloseTo(4.0, 6);
    });

    // 3. Raíz múltiple o tangencial, sin cambio de signo
    it('Detecta raíz tangencial/múltiple donde la pendiente no cambia de signo (theta(xi)=0 y theta_prime(xi)=0)', () => {
      // theta(xi) = (xi - 2)^2 = xi^2 - 4*xi + 4 on [0, 4]
      // theta(0) = 4 > 0, theta(4) = 4 > 0.
      // En todo el intervalo theta(xi) >= 0. No hay cambio de signo en los extremos.
      // Un método que requiera f(a)*f(b) < 0 no detectaría la raíz doble en xi = 2.
      const rootsTangential = findSlopeRootsOnSegment(4, -4, 1, 0, 0, 4.0);
      expect(rootsTangential.length).toBe(1);
      expect(rootsTangential[0]).toBeCloseTo(2.0, 6);

      // Raíz múltiple cúbica tangencial con punto de inflexión horizontal:
      // theta(xi) = (xi - 1.5)^2 * (xi - 3) on [0, 4]
      // = (xi^2 - 3xi + 2.25)(xi - 3) = xi^3 - 6xi^2 + 11.25xi - 6.75
      // Tiene raíz doble en xi = 1.5 (tangencial) y raíz simple en xi = 3 (transversal)
      const rootsMixed = findSlopeRootsOnSegment(-6.75, 11.25, -6, 1, 0, 4.0);
      expect(rootsMixed.length).toBe(2);
      expect(rootsMixed[0]).toBeCloseTo(1.5, 6);
      expect(rootsMixed[1]).toBeCloseTo(3.0, 6);
    });

    // 4. Extremos situados en fronteras de tramo y extremos de la viga
    it('Evalúa y clasifica correctamente extremos en fronteras de tramo y extremos de la viga', () => {
      // Caso 1: Viga en voladizo (empotre en x=0, carga en extremo x=L)
      // La máxima deflexión ocurre exactamente en la frontera/extremo de la viga (x=L),
      // donde theta(L) != 0 (no es punto estacionario).
      const cantileverModel: BeamModel = {
        length: 6.0,
        supports: [{ id: 'S1', type: 'fixed', x: 0 }],
        loads: [{ id: 'P', type: 'point', x: 6.0, P: 40.0 }],
        material,
        section,
      };
      const resCant = analyzeBeam(cantileverModel);
      if (!resCant.deflection.isImplemented) throw new Error('Deflection not implemented');

      // Extremo en frontera x = 6 m
      expect(resCant.deflection.maxDownward.x).toBeCloseTo(6.0, 6);
      expect(resCant.deflection.maxAbsolute.x).toBeCloseTo(6.0, 6);
      expect(resCant.deflection.maxDownward.value).toBeGreaterThan(0);
      // El empotre en x=0 tiene deflexión 0
      expect(resCant.deflection.evaluate(0)).toBeCloseTo(0, 9);

      // Caso 2: Viga con carga en la frontera de tramo y apoyo intermedio
      // Viga con voladizo [0, 3] y tramo apoyado [3, 9] con apoyos en x=3 y x=9
      // Carga en x = 0 (punta del voladizo, extremo de la viga)
      const overhangTipModel: BeamModel = {
        length: 9.0,
        supports: [
          { id: 'S1', type: 'pin', x: 3.0 },
          { id: 'S2', type: 'roller', x: 9.0 },
        ],
        loads: [{ id: 'P_tip', type: 'point', x: 0, P: 25.0 }],
        material,
        section,
      };
      const resTip = analyzeBeam(overhangTipModel);
      if (!resTip.deflection.isImplemented) throw new Error('Deflection not implemented');

      // En el extremo x=0 se produce la deflexión hacia abajo máxima
      expect(resTip.deflection.maxDownward.x).toBeCloseTo(0, 6);
      expect(resTip.deflection.maxDownward.value).toBeGreaterThan(0);

      // En el vano interior [3, 9], la viga se curva hacia arriba (deflexión negativa)
      expect(resTip.deflection.maxUpward.value).toBeLessThan(0);
      expect(resTip.deflection.maxUpward.x).toBeGreaterThan(3.0);
      expect(resTip.deflection.maxUpward.x).toBeLessThan(9.0);

      // Las fronteras de tramo están presentes en criticalPoints con tipo 'boundary'
      const boundaryPoints = resTip.deflection.criticalPoints.filter((p) => p.type === 'boundary');
      expect(boundaryPoints.some((p) => Math.abs(p.x - 0) < 1e-4)).toBe(true);
      expect(boundaryPoints.some((p) => Math.abs(p.x - 3) < 1e-4)).toBe(true);
      expect(boundaryPoints.some((p) => Math.abs(p.x - 9) < 1e-4)).toBe(true);
    });
  });
});
