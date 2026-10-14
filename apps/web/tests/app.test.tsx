import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';

describe('OptiSteel 2.0 Web Application Component Tests', () => {
  it('1. Renderizado inicial: interfaz completa, esquema y resultados del motor', () => {
    render(<App />);

    // Brand and navigation (using getAllByText since OptiSteel appears in header and footer)
    const brandElements = screen.getAllByText(/OptiSteel 2.0/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    expect(brandElements[0]).toBeInTheDocument();

    expect(screen.getByText(/Analizador de Vigas/i)).toBeInTheDocument();
    expect(screen.getByText(/Casos Pytel-Singer/i)).toBeInTheDocument();

    // Beam schematic header
    expect(
      screen.getByText(/Esquema Estructural de la Viga y Cargas/i)
    ).toBeInTheDocument();

    // Summary cards calculated from @optisteel/core for default model (L=6, w=15)
    // Reactions for simply supported with uniform load: R = 15 * 6 / 2 = 45 kN
    // Max moment: M_max = 15 * 6^2 / 8 = 67.5 kN*m
    expect(screen.getByText(/Cortante Máximo \|V\|/i)).toBeInTheDocument();
    expect(screen.getByText(/Momento Positivo Máx \(M\+\)/i)).toBeInTheDocument();

    const momentValues = screen.getAllByText(/67\.50/);
    expect(momentValues.length).toBeGreaterThanOrEqual(1);

    const shearValues = screen.getAllByText(/45\.00/);
    expect(shearValues.length).toBeGreaterThanOrEqual(1);

    // Equilibrium verified badge
    expect(screen.getByText(/✓ Equilibrio Verificado/i)).toBeInTheDocument();
  });

  it('2. Manejo de configuraciones inválidas o inestables', () => {
    render(<App />);

    // Delete first support using aria-label
    const deleteButtons = screen.getAllByRole('button', { name: /Eliminar apoyo/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]!);

    // Check that error banner appears with core validation warning
    expect(
      screen.getByText(/Configuración Incompleta o No Isostática/i)
    ).toBeInTheDocument();
  });

  it('3. Adición dinámica de cargas y actualización de resultados', () => {
    render(<App />);

    // Click "+ Puntual" to add a point load
    const addPointBtn = screen.getByText(/\+ Puntual/i);
    fireEvent.click(addPointBtn);

    // Verify point load item card added
    expect(screen.getByText(/POINT #2/i)).toBeInTheDocument();

    // Check that reactions updated with additional load
    expect(screen.getByText(/✓ Equilibrio Verificado/i)).toBeInTheDocument();
  });

  it('4. Biblioteca de Referencia Pytel-Singer y carga en el analizador', () => {
    render(<App />);

    // Switch to Pytel-Singer tab
    const pytelTabBtn = screen.getByText(/Casos Pytel-Singer/i);
    fireEvent.click(pytelTabBtn);

    // Verify header of library
    expect(
      screen.getByText(/Biblioteca Canónica de Deformaciones — Pytel & Singer/i)
    ).toBeInTheDocument();

    // Verify all 12 cases exist
    expect(screen.getByText(/CASO 1 /i)).toBeInTheDocument();
    expect(screen.getByText(/CASO 12 /i)).toBeInTheDocument();

    // Click "Cargar Caso en el Analizador" on Case 1 (Cantilever with point load at tip)
    const loadButtons = screen.getAllByText(/⚡ Cargar Caso en el Analizador/i);
    expect(loadButtons.length).toBe(12);

    fireEvent.click(loadButtons[0]!);

    // Should return to analyzer tab automatically
    expect(screen.getByText(/Analizador de Vigas/i)).toHaveClass('active');
    // Verify support type updated to fixed/cantilever
    const fixedLabels = screen.getAllByText(/Empotramiento/i);
    expect(fixedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Modal de Convenciones de Signos interactivo', () => {
    render(<App />);

    // Click conventions button using getByRole to avoid matching modal title
    const conventionsBtn = screen.getByRole('button', { name: /Convenciones de Signos/i });
    fireEvent.click(conventionsBtn);

    // Dialog title
    expect(
      screen.getByText(/Convenciones de Signos y Fundamentos Mecánicos/i)
    ).toBeInTheDocument();

    // Click "Entendido"
    const closeBtn = screen.getByText(/Entendido/i);
    fireEvent.click(closeBtn);
  });
});
