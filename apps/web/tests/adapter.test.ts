import { describe, expect, it } from 'vitest';
import { adaptFormToBeamModel, getPresetModels } from '../src/adapters/beamAdapter.js';
import { validateBeamModel, analyzeBeam } from '@optisteel/core';
import type { BeamFormState } from '../src/types/ui.js';

describe('Adaptador de Modelo de Interfaz a Motor @optisteel/core', () => {
  it('Convierte correctamente el estado del formulario en un BeamModel analizable', () => {
    const form: BeamFormState = {
      length: 8.0,
      materialName: 'Acero A36',
      E: 200.0,
      sectionName: 'W12x40',
      Iz: 12900.0,
      supports: [
        { id: 'S1', type: 'pin', x: 0, label: 'Apoyo Izquierdo' },
        { id: 'S2', type: 'roller', x: 8.0, label: 'Apoyo Derecho' },
      ],
      loads: [
        { id: 'P1', type: 'point', x: 4.0, P: 50.0, label: 'Carga Central' },
        {
          id: 'W1',
          type: 'distributed',
          xStart: 0,
          xEnd: 8.0,
          wStart: 10.0,
          wEnd: 10.0,
          label: 'Carga Distribuida',
        },
        { id: 'M1', type: 'moment', x: 2.0, M: 25.0, label: 'Momento Aplicado' },
      ],
    };

    const model = adaptFormToBeamModel(form);

    expect(model.length).toBe(8.0);
    expect(model.supports).toHaveLength(2);
    expect(model.loads).toHaveLength(3);
    expect(model.material?.E).toBe(200.0);
    expect(model.section?.Iz).toBe(12900.0);

    // Valida contra el núcleo estructural
    const validation = validateBeamModel(model);
    expect(validation.isValid).toBe(true);
    expect(validation.classification).toBe('isostatic');

    // Ejecuta análisis y comprueba resultados reales
    const result = analyzeBeam(model);
    expect(result.reactions).toHaveLength(2);
    expect(result.equilibrium.isBalanced).toBe(true);
    expect(result.deflection.isImplemented).toBe(true);
  });

  it('Todas las plantillas predefinidas generan modelos isostáticos válidos en el núcleo', () => {
    const presets = getPresetModels();
    expect(presets.length).toBeGreaterThanOrEqual(4);

    for (const preset of presets) {
      const model = adaptFormToBeamModel(preset.state);
      const validation = validateBeamModel(model);
      expect(validation.isValid, `Plantilla "${preset.name}" debe ser válida`).toBe(true);
      expect(validation.classification).toBe('isostatic');

      const result = analyzeBeam(model);
      expect(result.equilibrium.isBalanced).toBe(true);
    }
  });

  it('Maneja entradas incompletas o nulas sin lanzar excepciones', () => {
    const emptyForm: BeamFormState = {
      length: 0,
      materialName: '',
      E: 0,
      sectionName: '',
      Iz: 0,
      supports: [],
      loads: [],
    };

    const model = adaptFormToBeamModel(emptyForm);
    expect(model.length).toBeGreaterThanOrEqual(0.1);
    expect(model.supports).toHaveLength(0);
    expect(model.loads).toHaveLength(0);
    expect(model.material).toBeUndefined();
    expect(model.section).toBeUndefined();

    const validation = validateBeamModel(model);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
