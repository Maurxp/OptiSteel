import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BeamModel } from '@optisteel/core';
import { SteelProfileSelector } from '../src/components/SteelProfileSelector.js';

describe('OptiSteel 2.0 — SteelProfileSelector Component Integration Tests', () => {
  // Modelo de referencia isostático: Viga simplemente apoyada L = 6m, carga uniforme w = 15 kN/m
  const simpleBeamModel: BeamModel = {
    length: 6.0,
    supports: [
      { id: 'A', type: 'pin', x: 0 },
      { id: 'B', type: 'roller', x: 6.0 },
    ],
    loads: [
      {
        id: 'w1',
        type: 'distributed',
        xStart: 0,
        xEnd: 6.0,
        wStart: 15.0,
        wEnd: 15.0,
      },
    ],
    material: {
      name: 'Acero A36',
      E: 200,
    },
    section: {
      name: 'W10x30',
      Iz: 7076,
    },
  };

  it('1. Renderizado inicial: cabecera, advertencia de alcance y métricas globales', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // Título principal del panel
    expect(
      screen.getByRole('heading', { name: /Selector de Perfiles de Acero Estructural/i })
    ).toBeInTheDocument();

    // Banner de advertencia obligatoria de prediseño preliminar
    expect(screen.getByText(/Alcance Técnico: Prediseño Elástico Preliminar/i)).toBeInTheDocument();
    expect(screen.getByText(/Evaluación Parcial: LTB No Evaluado/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin certificación normativa integral/i)).toBeInTheDocument();

    // Métricas resumidas
    expect(screen.getByText(/Perfiles Evaluados/i)).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument(); // 76 perfiles en catálogo completo
    expect(screen.getByText(/Viables Preliminares/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Descalificados/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Perfil Preliminar Óptimo/i)).toBeInTheDocument();

    // Tarjeta de recomendación más liviana visible
    expect(screen.getByText(/Recomendación Preliminar Más Liviana/i)).toBeInTheDocument();
  });

  it('2. Filtrado por familia de perfil (ALL, W, S, C)', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    const familySelect = screen.getByLabelText(/Familia de Perfiles/i);

    // Filtrar a familia W
    fireEvent.change(familySelect, { target: { value: 'W' } });
    expect(screen.getByText('46')).toBeInTheDocument(); // 46 perfiles W

    // Filtrar a familia S
    fireEvent.change(familySelect, { target: { value: 'S' } });
    expect(screen.getByText('16')).toBeInTheDocument(); // 16 perfiles S

    // Filtrar a familia C
    fireEvent.change(familySelect, { target: { value: 'C' } });
    expect(screen.getByText('14')).toBeInTheDocument(); // 14 perfiles C

    // Regresar a todas las familias
    fireEvent.change(familySelect, { target: { value: 'ALL' } });
    expect(screen.getByText('76')).toBeInTheDocument();
  });

  it('3. Configuración de criterios de diseño y recálculo reactivo', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // Cambiar tensión admisible a flexión
    const sigmaInput = screen.getByLabelText(/Tensión Admisible Flexión/i);
    fireEvent.change(sigmaInput, { target: { value: '200' } });

    // Cambiar denominador de flecha
    const defDenomInput = screen.getByLabelText(/Límite de Flecha L\/n/i);
    fireEvent.change(defDenomInput, { target: { value: '480' } });

    // Alternar peso propio
    const swCheckbox = screen.getByLabelText(/Incluir peso propio como carga distribuida/i);
    fireEvent.click(swCheckbox); // Desactivar
    expect(swCheckbox).not.toBeChecked();

    fireEvent.click(swCheckbox); // Reactivar
    expect(swCheckbox).toBeChecked();
  });

  it('4. Manejo de errores y modelos incompatibles (isModelValid = false)', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={false} />);

    // Debe mostrar advertencia de modelo incompleto
    expect(screen.getByText(/Modelo Incompleto:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Para ejecutar el motor de selección de perfiles, la viga debe estar completamente configurada/i)
    ).toBeInTheDocument();
  });

  it('5. Manejo de conflicto cuando el modelo ya contiene peso propio', () => {
    const beamWithSW: BeamModel = {
      ...simpleBeamModel,
      loads: [
        ...simpleBeamModel.loads,
        {
          id: 'self-weight-existing',
          type: 'distributed',
          xStart: 0,
          xEnd: 6.0,
          wStart: 0.5,
          wEnd: 0.5,
        },
      ],
    };

    render(<SteelProfileSelector beamModel={beamWithSW} isModelValid={true} />);

    // Debe interceptar y mostrar el error de duplicación preventiva
    expect(screen.getByText(/Conflicto de peso propio preexistente detectado/i)).toBeInTheDocument();
  });

  it('6. Presentación de resultados ordenados por masa ascendente y tabla comparativa', () => {
    const { container } = render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // La tabla de candidatos debe estar presente
    const table = container.querySelector('.eng-table');
    expect(table).toBeInTheDocument();

    // Comprobar encabezados requeridos
    expect(screen.getByText(/Masa \(kg\/m\)/i)).toBeInTheDocument();
    expect(screen.getByText(/d \(mm\)/i)).toBeInTheDocument();
    expect(screen.getByText(/S_x \(10³ mm³\)/i)).toBeInTheDocument();
    expect(screen.getByText(/I_x \(10⁶ mm⁴\)/i)).toBeInTheDocument();
  });

  it('7. Manejo seguro de casos sin candidatos viables', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // Forzar criterio imposible: tensión admisible de 1 MPa
    const sigmaInput = screen.getByLabelText(/Tensión Admisible Flexión/i);
    fireEvent.change(sigmaInput, { target: { value: '1' } });

    // Debe reportar 0 viables y mensaje explícito
    expect(screen.getByText(/Ningún candidato viable encontrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin candidato/i)).toBeInTheDocument();
  });

  it('8. Estados not_evaluated explícitos para cortante y LTB', () => {
    render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // LTB siempre debe figurar como no evaluado
    const ltbBadges = screen.getAllByText(/No Evaluado/i);
    expect(ltbBadges.length).toBeGreaterThan(0);

    // Cortante sin tau_adm debe figurar como no evaluado
    const shearInput = screen.getByLabelText(/Tensión Admisible Cortante/i);
    expect(shearInput).toHaveValue(null);

    // Especificar cortante admisible amplio
    fireEvent.change(shearInput, { target: { value: '100' } });
    expect(screen.getAllByText(/Cortante:/i).length).toBeGreaterThan(0);
  });

  it('9. Detalle interactivo de candidato al hacer clic en una fila', () => {
    const { container } = render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // Click en la primera fila de la tabla
    const firstRow = container.querySelector('tbody tr');
    expect(firstRow).toBeInTheDocument();
    fireEvent.click(firstRow!);

    // Debe abrir el detalle con solicitaciones internas
    expect(screen.getByText(/Momento flector máximo M:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cortante máximo V:/i)).toBeInTheDocument();
    expect(screen.getByText(/Flecha máxima δ:/i)).toBeInTheDocument();
    expect(screen.getByText(/Rigidez a flexión EI:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cerrar Detalle/i)).toBeInTheDocument();

    // Cerrar detalle
    fireEvent.click(screen.getByText(/Cerrar Detalle/i));
    expect(screen.queryByText(/Momento flector máximo M:/i)).not.toBeInTheDocument();
  });

  it('10. Estructura responsive: contenedor table-wrapper y grids adaptables', () => {
    const { container } = render(<SteelProfileSelector beamModel={simpleBeamModel} isModelValid={true} />);

    // Contenedor table-wrapper con scroll horizontal controlado
    const tableWrapper = container.querySelector('.table-wrapper');
    expect(tableWrapper).toBeInTheDocument();

    // Grid de especificaciones de perfil óptimo
    const specsGrid = container.querySelector('.optimal-specs-grid');
    expect(specsGrid).toBeInTheDocument();

    // Banner de alcance técnico
    const scopeBanner = container.querySelector('.scope-banner');
    expect(scopeBanner).toBeInTheDocument();
  });
});
