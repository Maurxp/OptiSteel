import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisResults } from '../src/components/AnalysisResults.js';
import { analyzeBeam } from '@optisteel/core';
import type { BeamModel } from '@optisteel/core';

describe('Verificación de Etiquetas en Tabla de Puntos Notables y Secciones Críticas', () => {
  it('1. Voladizo de 4m con carga puntual en extremo: no etiqueta x=4 como M Máx Positivo', () => {
    // Caso reportado: L=4m, empotramiento en x=0, carga descendente P=25 kN en x=4m
    const cantileverModel: BeamModel = {
      length: 4.0,
      supports: [{ id: 'S1', type: 'fixed', x: 0 }],
      loads: [{ id: 'P1', type: 'point', x: 4.0, P: 25.0 }],
      material: { name: 'Acero A36', E: 200.0 },
      section: { name: 'W8x24', Iz: 3450.0 },
    };

    const analysis = analyzeBeam(cantileverModel);
    render(<AnalysisResults analysis={analysis} />);

    // Abrir la tabla colapsable
    const toggleButton = screen.getByRole('button', { name: /Ver Tabla Completa/i });
    fireEvent.click(toggleButton);

    // Obtener las filas específicamente de la tabla de puntos críticos
    const critSection = screen.getByText(/Tabla de Puntos Notables y Secciones Críticas/i).closest('.glass-panel')!;
    const rows = Array.from(critSection.querySelectorAll('tbody tr'));
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Fila para x = 0.000 m
    const rowX0 = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '0.000');
    expect(rowX0).toBeDefined();
    expect(rowX0?.textContent).toContain('Apoyo S1 (FIXED)');
    expect(rowX0?.textContent).toContain('M Máx Negativo');
    expect(rowX0?.textContent).not.toContain('M Máx Positivo');

    // Fila para x = 4.000 m
    const rowX4 = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '4.000');
    expect(rowX4).toBeDefined();
    expect(rowX4?.textContent).toContain('Extremo Derecho (x=4m)');
    expect(rowX4?.textContent).toContain('Carga Puntual P=25 kN');
    expect(rowX4?.textContent).toContain('M = 0');
    expect(rowX4?.textContent).toContain('Deflexión Máxima |δ| (Descendente)');

    // COMPROBACIÓN CRÍTICA: x=4 no debe estar etiquetado como M Máx Positivo
    expect(rowX4?.textContent).not.toContain('M Máx Positivo');
  });

  it('2. Viga simplemente apoyada: distingue M Máx Positivo en vano y M = 0 en apoyos', () => {
    const simpleModel: BeamModel = {
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
          wStart: 12.0,
          wEnd: 12.0,
        },
      ],
      material: { name: 'Acero A36', E: 200.0 },
      section: { name: 'W10x30', Iz: 7076.0 },
    };

    const analysis = analyzeBeam(simpleModel);
    render(<AnalysisResults analysis={analysis} />);

    // Abrir tabla
    fireEvent.click(screen.getByRole('button', { name: /Ver Tabla Completa/i }));

    const critSection = screen.getByText(/Tabla de Puntos Notables y Secciones Críticas/i).closest('.glass-panel')!;
    const rows = Array.from(critSection.querySelectorAll('tbody tr'));

    // Fila x = 0.000 m
    const row0 = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '0.000');
    expect(row0?.textContent).toContain('Apoyo A (PIN)');
    expect(row0?.textContent).toContain('M = 0');
    expect(row0?.textContent).not.toContain('M Máx Positivo');

    // Fila x = 3.000 m (centro de vano)
    const row3 = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '3.000');
    expect(row3?.textContent).toContain('V = 0 (Pico M)');
    expect(row3?.textContent).toContain('M Máx Positivo');
    expect(row3?.textContent).not.toContain('M = 0');

    // Fila x = 6.000 m
    const row6 = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '6.000');
    expect(row6?.textContent).toContain('Apoyo B (ROLLER)');
    expect(row6?.textContent).toContain('M = 0');
    expect(row6?.textContent).not.toContain('M Máx Positivo');
  });

  it('3. Combinación de cargas con momento externo y verificación de no contradicción', () => {
    const combinedModel: BeamModel = {
      length: 6.0,
      supports: [
        { id: 'A', type: 'pin', x: 0 },
        { id: 'B', type: 'roller', x: 6.0 },
      ],
      loads: [
        { id: 'P1', type: 'point', x: 2.0, P: 15.0 },
        { id: 'M1', type: 'moment', x: 4.0, M: 20.0 },
      ],
    };

    const analysis = analyzeBeam(combinedModel);
    render(<AnalysisResults analysis={analysis} />);

    fireEvent.click(screen.getByRole('button', { name: /Ver Tabla Completa/i }));

    const critSection = screen.getByText(/Tabla de Puntos Notables y Secciones Críticas/i).closest('.glass-panel')!;
    const rows = Array.from(critSection.querySelectorAll('tbody tr'));

    // Verificar fila x = 2.000 m
    const rowP = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '2.000');
    expect(rowP?.textContent).toContain('Carga Puntual P=15 kN');

    // Verificar fila x = 4.000 m
    const rowM = rows.find((r) => r.querySelector('td')?.textContent?.trim() === '4.000');
    expect(rowM?.textContent).toContain('Momento Aplicado M=20 kN·m');

    // En ninguna fila deben coexistir etiquetas contradictorias
    for (const row of rows) {
      const text = row.textContent || '';
      const hasMaxPos = text.includes('M Máx Positivo');
      const hasZeroM = text.includes('M = 0') || text.includes('Punto de Inflexión (M=0)');
      const hasMaxNeg = text.includes('M Máx Negativo');

      // Si tiene M Máx Positivo, no debe decir M = 0 ni M Máx Negativo
      if (hasMaxPos) {
        expect(hasZeroM).toBe(false);
        expect(hasMaxNeg).toBe(false);
      }
      // Si tiene M = 0, no debe decir M Máx Positivo ni M Máx Negativo
      if (hasZeroM) {
        expect(hasMaxPos).toBe(false);
        expect(hasMaxNeg).toBe(false);
      }
    }
  });
});
