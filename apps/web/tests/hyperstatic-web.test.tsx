import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';
import { BeamSchematic } from '../src/components/BeamSchematic.js';
import { getHyperstaticPresets, adaptFormToBeamModel } from '../src/adapters/beamAdapter.js';
import { validateBeamModel, analyzeBeam } from '@optisteel/core';

describe('OptiSteel 2.0 — Web Integration & Didactic Report Tests (H1–H4)', () => {
  it('1. Carga del Caso H1 (Empotrada-Apoyada con Carga Puntual) y verificación completa en UI', () => {
    render(<App />);

    // Click H1 canonical preset button
    const h1Buttons = screen.getAllByRole('button', { name: /H1/i });
    expect(h1Buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(h1Buttons[0]!);

    // Classification banner indicates hyperstatic
    expect(screen.getByText(/Viga Hiperestática/i)).toBeInTheDocument();
    expect(screen.getByText(/H1 • Grado 1/i)).toBeInTheDocument();

    // Verify support reactions rendered in reactions table:
    // P=16 kN at center, L=4: RB = 5.000 kN, RA = 11.000 kN, MA = +12.000 kN*m (↺ CCW)
    expect(screen.getAllByText(/5\.000 kN/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/11\.000 kN/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/12\.000 kN·m \(↺ CCW\)/i).length).toBeGreaterThanOrEqual(1);

    // Verify Didactic Report is rendered
    expect(
      screen.getAllByText(/Caso H1: Viga Empotrada-Apoyada/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Estructura Primaria/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ecuación de Compatibilidad/i).length).toBeGreaterThanOrEqual(1);

    // Verify key didactic steps exist
    expect(screen.getByText(/Definición de la Estructura Primaria Isostática/i)).toBeInTheDocument();
    expect(screen.getByText(/Ecuación de Compatibilidad Elástica de Desplazamientos/i)).toBeInTheDocument();
    expect(screen.getByText(/Cálculo de Flexibilidad y Deflexión de la Estructura Primaria/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolución de la Reacción Redundante RB/i)).toBeInTheDocument();
    expect(screen.getByText(/Equilibrio Global y Reacciones en el Empotramiento A/i)).toBeInTheDocument();
    expect(screen.getByText(/Deformada Elástica y Verificación de Condiciones de Frontera/i)).toBeInTheDocument();

    // Verify verified badge
    const checkedBadges = screen.getAllByText(/Verificado/i);
    expect(checkedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Carga del Caso H2 (Empotrada-Apoyada con Carga Uniforme) y verificación didáctica', () => {
    render(<App />);

    const h2Buttons = screen.getAllByRole('button', { name: /H2/i });
    fireEvent.click(h2Buttons[0]!);

    expect(screen.getByText(/Viga Hiperestática/i)).toBeInTheDocument();
    expect(screen.getByText(/H2 • Grado 1/i)).toBeInTheDocument();

    // L=6, w=10: RB = 3/8*w*L = 22.50 kN, RA = 5/8*w*L = 37.50 kN, MA = +1/8*w*L^2 = +45.00 kN*m (↺ CCW)
    expect(screen.getAllByText(/22\.500 kN/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/37\.500 kN/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/45\.000 kN·m \(↺ CCW\)/i).length).toBeGreaterThanOrEqual(1);

    // Didactic report for H2
    expect(
      screen.getAllByText(/Caso H2: Viga Empotrada-Apoyada/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Estructura Primaria y Coeficiente de Flexibilidad/i)).toBeInTheDocument();
    expect(screen.getByText(/Compatibilidad Vertical y Resolución de RB/i)).toBeInTheDocument();
    expect(screen.getByText(/Leyes de Cortante, Momento Máximo e Inflexión/i)).toBeInTheDocument();
  });

  it('3. Carga del Caso H3 (Viga Biempotrada con Carga Uniforme)', () => {
    render(<App />);

    const h3Buttons = screen.getAllByRole('button', { name: /H3/i });
    fireEvent.click(h3Buttons[0]!);

    expect(screen.getByText(/Viga Hiperestática/i)).toBeInTheDocument();
    expect(screen.getByText(/H3 • Grado 2/i)).toBeInTheDocument();

    // L=6, w=12: RA = RB = 36.000 kN, MA = -36.000 kN*m, MB = +36.000 kN*m
    const shearReactions = screen.getAllByText(/36\.000 kN/);
    expect(shearReactions.length).toBeGreaterThanOrEqual(2);

    expect(screen.getAllByText(/-36\.000 kN·m \(↻ CW\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/36\.000 kN·m \(↺ CCW\)/i).length).toBeGreaterThanOrEqual(1);

    // Didactic report for H3
    expect(
      screen.getAllByText(/Caso H3: Viga Biempotrada con Carga Uniformemente Distribuida/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Condiciones de Contorno Cinemáticas Dobles/i)).toBeInTheDocument();
    expect(screen.getByText(/Cálculo de Momentos Reactivos de Empotramiento Perfecto/i)).toBeInTheDocument();
  });

  it('4. Carga del Caso H4 (Dos Vanos Continuos con Carga Uniforme)', () => {
    render(<App />);

    const h4Buttons = screen.getAllByRole('button', { name: /H4/i });
    fireEvent.click(h4Buttons[0]!);

    expect(screen.getByText(/Viga Hiperestática/i)).toBeInTheDocument();
    expect(screen.getByText(/H4 • Grado 1/i)).toBeInTheDocument();

    // L=8 (Lv=4), w=6:
    // MB = -12.00 kN*m, RB = 30.00 kN, RA = RC = 9.00 kN
    expect(screen.getAllByText(/30\.000 kN/).length).toBeGreaterThanOrEqual(1);
    const endReactions = screen.getAllByText(/9\.000 kN/);
    expect(endReactions.length).toBeGreaterThanOrEqual(2);

    // Didactic report for H4 Clapeyron
    expect(
      screen.getAllByText(/Caso H4: Viga Continua de Dos Vanos Iguales/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ecuación de los Tres Momentos de Clapeyron/i)).toBeInTheDocument();
    expect(screen.getByText(/Equilibrio de Fuerzas en Cada Vano Aislado/i)).toBeInTheDocument();
    expect(screen.getByText(/Deformada Elástica, Continuidad en B y Flecha Máxima/i)).toBeInTheDocument();
  });

  it('5. Rechazo explícito en la UI de configuraciones hiperestáticas fuera del alcance soportado', () => {
    render(<App />);

    // Load H4 first (3 supports)
    const h4Buttons = screen.getAllByRole('button', { name: /H4/i });
    fireEvent.click(h4Buttons[0]!);

    // Add an unsupported moment load
    const addMomentBtn = screen.getByRole('button', { name: /\+ Momento/i });
    fireEvent.click(addMomentBtn);

    // Core validation rejects, and error alert is shown
    expect(
      screen.getByText(/Configuración Incompleta o No Isostática/i)
    ).toBeInTheDocument();

    // Verify unsupported load message
    expect(
      screen.getByText(/Configuración hiperestática aún no soportada/i)
    ).toBeInTheDocument();

    // The Didactic Report must NOT be displayed for invalid/unsupported configurations
    expect(
      screen.queryByText(/Derivación paso a paso: formulación elástica de Euler-Bernoulli/i)
    ).not.toBeInTheDocument();
  });

  it('6. Interacción de expansión y colapso en el Reporte Didáctico', () => {
    render(<App />);

    const h1Buttons = screen.getAllByRole('button', { name: /H1/i });
    fireEvent.click(h1Buttons[0]!);

    const collapseAllBtn = screen.getByRole('button', { name: /Colapsar todo/i });
    expect(collapseAllBtn).toBeInTheDocument();
    fireEvent.click(collapseAllBtn);

    const expandAllBtn = screen.getByRole('button', { name: /Expandir todo/i });
    expect(expandAllBtn).toBeInTheDocument();
    fireEvent.click(expandAllBtn);
  });

  it('7. Presets hiperestáticos son válidos en @optisteel/core y tienen coherencia física', () => {
    const presets = getHyperstaticPresets();
    expect(presets).toHaveLength(4);

    for (const preset of presets) {
      const model = adaptFormToBeamModel(preset.state);
      const validation = validateBeamModel(model);
      expect(validation.isValid, `Caso ${preset.id} debe ser válido`).toBe(true);
      expect(validation.classification).toBe('hyperstatic');

      const result = analyzeBeam(model);
      expect(result.equilibrium.isBalanced).toBe(true);
      expect(result.didacticReport).toBeDefined();
      expect(result.didacticReport?.caseId).toBe(preset.id);
      expect(result.didacticReport?.steps.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('8. Renderizado simultáneo de dos BeamSchematic garantiza IDs únicos y enlaces url(#...) válidos', () => {
    const presets = getHyperstaticPresets();
    const model1 = adaptFormToBeamModel(presets[0]!.state);
    const model2 = adaptFormToBeamModel(presets[1]!.state);
    const res1 = analyzeBeam(model1);
    const res2 = analyzeBeam(model2);

    const { container } = render(
      <div>
        <div data-testid="schematic-1">
          <BeamSchematic model={model1} reactions={res1.reactions} />
        </div>
        <div data-testid="schematic-2">
          <BeamSchematic model={model2} reactions={res2.reactions} />
        </div>
      </div>
    );

    // Get all elements with id attribute inside the rendered container
    const idElements = container.querySelectorAll('[id]');
    const allIds = Array.from(idElements).map((el) => el.getAttribute('id')!);
    expect(allIds.length).toBeGreaterThan(0);

    // Verify all IDs are completely unique
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);

    // Check all url(#...) references in attributes like marker-end or fill
    const elementsWithUrl = container.querySelectorAll('[marker-end], [fill*="url"]');
    expect(elementsWithUrl.length).toBeGreaterThan(0);

    for (const el of Array.from(elementsWithUrl)) {
      const markerEnd = el.getAttribute('marker-end');
      if (markerEnd && markerEnd.startsWith('url(#')) {
        const targetId = markerEnd.slice(5, -1);
        expect(uniqueIds.has(targetId), `El marcador referenciado ${targetId} debe existir en el DOM`).toBe(true);
      }
      const fill = el.getAttribute('fill');
      if (fill && fill.startsWith('url(#')) {
        const targetId = fill.slice(5, -1);
        expect(uniqueIds.has(targetId), `El gradiente/patrón referenciado ${targetId} debe existir en el DOM`).toBe(true);
      }
    }
  });

  it('9. Caso H4 en UI comunica explícitamente ambos máximos simétricos de deflexión', () => {
    render(<App />);

    const h4Buttons = screen.getAllByRole('button', { name: /H4/i });
    fireEvent.click(h4Buttons[0]!);

    // Verify that symmetric maximums are rendered in the Didactic Report
    expect(screen.getAllByText(/x₁ = 1\.686 m \(Vano 1\) y x₂ = 6\.314 m \(Vano 2\)/i).length).toBeGreaterThanOrEqual(1);
  });
});
