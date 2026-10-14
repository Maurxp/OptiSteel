import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';

describe('OptiSteel 2.0 — Responsive Layout & UI Interaction Verification', () => {
  it('1. Renderiza estructura adaptable de cabecera con clases responsive', () => {
    const { container } = render(<App />);

    // Header top row exists for mobile 2-tier stacking
    const headerTopRow = container.querySelector('.header-top-row');
    expect(headerTopRow).toBeInTheDocument();

    // Verify dual label responsive elements exist
    expect(container.querySelector('.btn-text-full')).toBeInTheDocument();
    expect(container.querySelector('.btn-text-short')).toBeInTheDocument();
    expect(container.querySelector('.nav-text-full')).toBeInTheDocument();
    expect(container.querySelector('.nav-text-short')).toBeInTheDocument();

    // Verify brand and version badge
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('OptiSteel 2.0');
    expect(screen.getByText('CORE v0.1')).toBeInTheDocument();
  });

  it('2. Formulario de configuración: organiza filas con form-row, form-row-3 y load-action-buttons', () => {
    const { container } = render(<App />);

    // Geometry row should have form-row-3 class
    const formRow3 = container.querySelector('.form-row-3');
    expect(formRow3).toBeInTheDocument();

    // Action button container for loads
    const loadButtonsContainer = container.querySelector('.load-action-buttons');
    expect(loadButtonsContainer).toBeInTheDocument();

    // Buttons for adding point, distributed, and moment loads exist
    expect(screen.getByRole('button', { name: /\+ Puntual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Distribuida/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Momento/i })).toBeInTheDocument();
  });

  it('3. Gestión dinámica de apoyos y cargas: permite añadir y eliminar sin romper el diseño', () => {
    render(<App />);

    // Initial state has 2 supports
    const initialDeleteSupportBtns = screen.getAllByRole('button', { name: /Eliminar apoyo/i });
    expect(initialDeleteSupportBtns.length).toBe(2);

    // Add a support
    const addSupportBtn = screen.getByRole('button', { name: /Agregar nuevo apoyo/i });
    fireEvent.click(addSupportBtn);

    const updatedDeleteSupportBtns = screen.getAllByRole('button', { name: /Eliminar apoyo/i });
    expect(updatedDeleteSupportBtns.length).toBe(3);

    // Delete the newly added support
    fireEvent.click(updatedDeleteSupportBtns[2]!);
    expect(screen.getAllByRole('button', { name: /Eliminar apoyo/i }).length).toBe(2);

    // Initial state has 1 load (point load)
    const initialDeleteLoadBtns = screen.getAllByRole('button', { name: /Eliminar carga/i });
    expect(initialDeleteLoadBtns.length).toBe(1);

    // Add a distributed load
    const addDistLoadBtn = screen.getByRole('button', { name: /\+ Distribuida/i });
    fireEvent.click(addDistLoadBtn);
    expect(screen.getAllByRole('button', { name: /Eliminar carga/i }).length).toBe(2);

    // Add a moment load
    const addMomentBtn = screen.getByRole('button', { name: /\+ Momento/i });
    fireEvent.click(addMomentBtn);
    expect(screen.getAllByRole('button', { name: /Eliminar carga/i }).length).toBe(3);

    // Delete a load
    const currentDeleteLoadBtns = screen.getAllByRole('button', { name: /Eliminar carga/i });
    fireEvent.click(currentDeleteLoadBtns[2]!);
    expect(screen.getAllByRole('button', { name: /Eliminar carga/i }).length).toBe(2);
  });

  it('4. Contenedores de resultados: tablas encapsuladas en table-wrapper y gráficos en diagram-container', () => {
    const { container } = render(<App />);

    // Verify SVG diagram containers exist and are responsive
    const diagramContainers = container.querySelectorAll('.diagram-container');
    expect(diagramContainers.length).toBeGreaterThanOrEqual(3);

    const responsiveSvgs = container.querySelectorAll('.svg-responsive');
    expect(responsiveSvgs.length).toBeGreaterThanOrEqual(3);

    // Verify metrics grid
    const metricsGrid = container.querySelector('.metrics-grid');
    expect(metricsGrid).toBeInTheDocument();

    // Verify table wrappers for horizontal scroll isolation
    const tableWrappers = container.querySelectorAll('.table-wrapper');
    expect(tableWrappers.length).toBeGreaterThanOrEqual(1);

    // Verify equilibrium summary and slopes grid
    expect(container.querySelector('.equilibrium-summary')).toBeInTheDocument();
    expect(container.querySelector('.slopes-grid')).toBeInTheDocument();
  });

  it('5. Biblioteca Pytel-Singer: filtrado responsive y carga de caso en analizador', () => {
    const { container } = render(<App />);

    // Navigate to Pytel-Singer library
    const pytelTabBtn = screen.getByRole('button', { name: /Casos Pytel-Singer/i });
    fireEvent.click(pytelTabBtn);

    // Verify responsive panel header & filter buttons
    expect(container.querySelector('.pytel-panel-header')).toBeInTheDocument();
    expect(container.querySelector('.pytel-filter-buttons')).toBeInTheDocument();
    expect(container.querySelector('.pytel-grid')).toBeInTheDocument();

    // Filter by cantilever
    const cantileverBtn = screen.getByRole('button', { name: /Voladizos/i });
    fireEvent.click(cantileverBtn);

    // Pytel cards should be 5 cantilever cases (Cases 1, 2, 3, 4, 12)
    const cards = container.querySelectorAll('.pytel-card');
    expect(cards.length).toBe(5);

    // Load Case 1 into analyzer
    const loadButtons = screen.getAllByText(/⚡ Cargar Caso en el Analizador/i);
    fireEvent.click(loadButtons[0]!);

    // Should return to analyzer tab
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('OptiSteel 2.0');
    expect(screen.getByText(/Configuración de la Viga/i)).toBeInTheDocument();
  });

  it('6. Modal de convenciones de signos: contenido dentro de modal-body con cierre interactivo', () => {
    const { container } = render(<App />);

    // Open modal
    const conventionsBtn = screen.getByRole('button', { name: /Convenciones de Signos/i });
    fireEvent.click(conventionsBtn);

    // Verify modal element and modal-body container
    const modal = container.querySelector('dialog.custom-modal');
    expect(modal).toBeInTheDocument();
    expect(container.querySelector('.modal-body')).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = screen.getByRole('button', { name: /Cerrar ventana/i });
    fireEvent.click(closeBtn);
  });
});
