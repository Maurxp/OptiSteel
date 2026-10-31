import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisResults } from '../src/components/AnalysisResults.js';
import { analyzeBeam } from '@optisteel/core';
import type { BeamModel } from '@optisteel/core';

describe('OptiSteel 2.0 — Materials Mechanics Web Integration Tests', () => {
  const rectangularBeamModel: BeamModel = {
    length: 8.0,
    supports: [
      { id: 'A', type: 'pin', x: 0 },
      { id: 'B', type: 'roller', x: 8.0 },
    ],
    loads: [
      {
        id: 'W1',
        type: 'distributed',
        xStart: 0,
        xEnd: 8.0,
        wStart: 12.5,
        wEnd: 12.5,
      },
    ],
    material: { name: 'Acero Estructural', E: 200.0 },
    section: {
      name: 'Viga Rectangular 200x400',
      type: 'rectangular',
      widthMm: 200,
      heightMm: 400,
      Iz: 106666.67,
      Wz: 5333.33,
      areaCm2: 800,
      allowableBendingStressMPa: 150.0,
      allowableShearStressMPa: 90.0,
      deflectionLimitDenominator: 360,
    },
  };

  it('1. Renderiza tarjetas ejecutivas completas incluyendo Esfuerzo Flexión y Cortante', () => {
    const analysis = analyzeBeam(rectangularBeamModel);
    render(<AnalysisResults analysis={analysis} />);

    // Tarjeta Flexión
    expect(screen.getByText(/Esfuerzo Flexión Máx \(σ\)/i)).toBeDefined();
    // Tarjeta Cortante
    expect(screen.getByText(/Esfuerzo Cortante \(τ\)/i)).toBeDefined();
    // Tarjetas existentes
    expect(screen.getByText(/Cortante Máximo \|V\|/i)).toBeDefined();
    expect(screen.getByText(/Momento Positivo Máx \(M\+\)/i)).toBeDefined();
    expect(screen.getByText(/Deflexión Máxima \|δ\|/i)).toBeDefined();
  });

  it('2. Despliega el panel de Resistencia de Materiales y permite alternar pestañas', () => {
    const analysis = analyzeBeam(rectangularBeamModel);
    render(<AnalysisResults analysis={analysis} />);

    expect(screen.getByText(/Resultados de Resistencia de Materiales y Desarrollo Matemático/i)).toBeDefined();

    // Pestaña activa por defecto: Flexión Normal (σ)
    expect(screen.getByText(/Fórmula de Navier/i)).toBeDefined();
    expect(screen.getByText(/Ecuación Gobernante:/i)).toBeDefined();

    // Cambiar a pestaña Cortante
    const shearTabBtn = screen.getByRole('button', { name: /Cortante Seccional \(τ\)/i });
    fireEvent.click(shearTabBtn);
    expect(screen.getByText(/Fórmula de Jourawski \/ Colignon/i)).toBeDefined();
    expect(screen.getByText(/Sección Rectangular \(τmáx = 1.5 τ_prom\)/i)).toBeDefined();

    // Cambiar a pestaña Curva Elástica
    const elasticTabBtn = screen.getByRole('button', { name: /Ecuación de la Curva Elástica/i });
    fireEvent.click(elasticTabBtn);
    expect(screen.getByText(/Ecuación Diferencial de la Curva Elástica \(Euler-Bernoulli\)/i)).toBeDefined();
    expect(screen.getByText(/Condiciones de Frontera Físicas:/i)).toBeDefined();

    // Cambiar a pestaña Deformaciones y ELS
    const defTabBtn = screen.getByRole('button', { name: /Deformaciones y ELS/i });
    fireEvent.click(defTabBtn);
    expect(screen.getByText(/Deformación Máxima y Estado Límite de Servicio \(ELS\)/i)).toBeDefined();
    expect(screen.getByText(/✓ CUMPLE ELS/i)).toBeDefined();
  });

  it('3. Modo "Ver Todo Desplegado" muestra simultáneamente todas las subsecciones', () => {
    const analysis = analyzeBeam(rectangularBeamModel);
    render(<AnalysisResults analysis={analysis} />);

    const viewAllBtn = screen.getByRole('button', { name: /Ver Todo Desplegado/i });
    fireEvent.click(viewAllBtn);

    expect(screen.getByText(/Fórmula de Navier/i)).toBeDefined();
    expect(screen.getByText(/Fórmula de Jourawski \/ Colignon/i)).toBeDefined();
    expect(screen.getByText(/Ecuación Diferencial de la Curva Elástica \(Euler-Bernoulli\)/i)).toBeDefined();
    expect(screen.getByText(/Deformación Máxima y Estado Límite de Servicio \(ELS\)/i)).toBeDefined();

    // Alternar de vuelta a vista por pestañas
    const tabsBtn = screen.getByRole('button', { name: /Vista por Pestañas/i });
    fireEvent.click(tabsBtn);
    expect(screen.getByRole('button', { name: /Ver Todo Desplegado/i })).toBeDefined();
  });

  it('4. Convergencia con caso de catálogo Pytel-Singer: muestra resultados de mecánica de materiales', () => {
    // Caso 8 de la lista: Viga simplemente apoyada con carga uniforme
    const pytelModel: BeamModel = {
      length: 6.0,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0,
          xEnd: 6.0,
          wStart: 10.0,
          wEnd: 10.0,
        },
      ],
      material: { name: 'Acero A36', E: 200.0 },
      section: {
        name: 'W10x30',
        type: 'i_shape',
        Iz: 7076.0,
        Wz: 539.0,
        heightMm: 266.7,
        widthMm: 147.6,
        webThicknessMm: 7.6,
        flangeThicknessMm: 13.0,
        areaCm2: 57.0,
      },
    };

    const analysis = analyzeBeam(pytelModel);
    render(<AnalysisResults analysis={analysis} />);

    expect(screen.getByText(/Resultados de Resistencia de Materiales y Desarrollo Matemático/i)).toBeDefined();
    expect(analysis.mechanics).toBeDefined();
    expect(analysis.mechanics?.bending.actualStressMPa).toBeGreaterThan(0);
    expect(analysis.mechanics?.shear.averageShearStressMPa).toBeGreaterThan(0);
    expect(analysis.mechanics?.elasticCurve.segments.length).toBeGreaterThan(0);
  });
});
