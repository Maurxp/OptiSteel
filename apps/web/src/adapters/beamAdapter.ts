import type {
  BeamModel,
  BeamMaterial,
  BeamSection,
  Support,
  Load,
  PointLoad,
  DistributedLoad,
  MomentLoad,
} from '@optisteel/core';
import type { BeamFormState } from '../types/ui.js';

/**
 * Converts UI form state into a valid @optisteel/core BeamModel.
 * Filters out incomplete or invalid items without throwing errors to allow smooth editing.
 */
export function adaptFormToBeamModel(form: BeamFormState): BeamModel {
  const L = Math.max(0.1, Number(form.length) || 1.0);

  const supports: Support[] = form.supports.map((s, idx) => {
    const item: Support = {
      id: s.id || `S${idx + 1}`,
      type: s.type,
      x: Number(s.x) || 0,
    };
    if (s.label) {
      item.label = s.label;
    }
    return item;
  });

  const loads: Load[] = [];

  form.loads.forEach((l, idx) => {
    const id = l.id || `L${idx + 1}`;
    if (l.type === 'point') {
      const pl: PointLoad = {
        id,
        type: 'point',
        x: Number(l.x) || 0,
        P: Number(l.P) || 0,
      };
      if (l.label) pl.label = l.label;
      loads.push(pl);
    } else if (l.type === 'distributed') {
      const dl: DistributedLoad = {
        id,
        type: 'distributed',
        xStart: Number(l.xStart) || 0,
        xEnd: Number(l.xEnd) || 0,
        wStart: Number(l.wStart) || 0,
        wEnd: Number(l.wEnd) || 0,
      };
      if (l.label) dl.label = l.label;
      loads.push(dl);
    } else if (l.type === 'moment') {
      const ml: MomentLoad = {
        id,
        type: 'moment',
        x: Number(l.x) || 0,
        M: Number(l.M) || 0,
      };
      if (l.label) ml.label = l.label;
      loads.push(ml);
    }
  });

  const model: BeamModel = {
    length: L,
    supports,
    loads,
  };

  if (Number.isFinite(form.E) && form.E > 0) {
    const mat: BeamMaterial = {
      E: form.E,
    };
    if (form.materialName) mat.name = form.materialName;
    model.material = mat;
  }

  if (Number.isFinite(form.Iz) && form.Iz > 0) {
    const sec: BeamSection = {
      Iz: form.Iz,
    };
    if (form.sectionName) sec.name = form.sectionName;
    model.section = sec;
  }

  return model;
}

/**
 * Creates a preset beam configuration for quick engineering setup.
 */
export function getPresetModels(): { name: string; description: string; state: BeamFormState }[] {
  return [
    {
      name: 'Viga Simplemente Apoyada con Carga Uniforme (Pytel Caso 5)',
      description: 'L = 6 m, apoyos en 0 y 6 m, carga w = 15 kN/m en todo el vano.',
      state: {
        length: 6.0,
        materialName: 'Acero A36 (E = 200 GPa)',
        E: 200.0,
        sectionName: 'W10x30 (Iz = 7076 cm⁴)',
        Iz: 7076.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0, label: 'A (Pin)' },
          { id: 'S2', type: 'roller', x: 6.0, label: 'B (Roller)' },
        ],
        loads: [
          {
            id: 'W1',
            type: 'distributed',
            xStart: 0,
            xEnd: 6.0,
            wStart: 15.0,
            wEnd: 15.0,
            label: 'Carga Uniforme w=15 kN/m',
          },
        ],
      },
    },
    {
      name: 'Viga con Carga Puntual Central (Pytel Caso 4)',
      description: 'L = 8 m, apoyos en 0 y 8 m, carga puntual P = 40 kN en x = 4 m.',
      state: {
        length: 8.0,
        materialName: 'Acero A36 (E = 200 GPa)',
        E: 200.0,
        sectionName: 'W12x40 (Iz = 12900 cm⁴)',
        Iz: 12900.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0, label: 'A' },
          { id: 'S2', type: 'roller', x: 8.0, label: 'B' },
        ],
        loads: [
          {
            id: 'P1',
            type: 'point',
            x: 4.0,
            P: 40.0,
            label: 'P = 40 kN (Centro)',
          },
        ],
      },
    },
    {
      name: 'Voladizo con Carga en Extremo Libre (Pytel Caso 1)',
      description: 'L = 4 m, empotramiento en x = 0, carga puntual P = 25 kN en x = 4 m.',
      state: {
        length: 4.0,
        materialName: 'Acero A36 (E = 200 GPa)',
        E: 200.0,
        sectionName: 'W8x24 (Iz = 3450 cm⁴)',
        Iz: 3450.0,
        supports: [{ id: 'S1', type: 'fixed', x: 0, label: 'Empotramiento A' }],
        loads: [
          {
            id: 'P1',
            type: 'point',
            x: 4.0,
            P: 25.0,
            label: 'P = 25 kN (Punta)',
          },
        ],
      },
    },
    {
      name: 'Viga con Voladizo y Dos Cargas Puntuales (Contraejemplo H-F2-01)',
      description: 'L = 10 m, apoyos en 0 y 8 m, cargas P1 = 50 kN en x = 2 m y P2 = 30 kN en x = 10 m.',
      state: {
        length: 10.0,
        materialName: 'Acero A36 (E = 200 GPa)',
        E: 200.0,
        sectionName: 'W10x30 (Iz = 7076 cm⁴)',
        Iz: 7076.0,
        supports: [
          { id: 'S1', type: 'pin', x: 0, label: 'S1 (Pin)' },
          { id: 'S2', type: 'roller', x: 8.0, label: 'S2 (Roller)' },
        ],
        loads: [
          { id: 'P1', type: 'point', x: 2.0, P: 50.0, label: 'P1 = 50 kN' },
          { id: 'P2', type: 'point', x: 10.0, P: 30.0, label: 'P2 = 30 kN (Voladizo)' },
        ],
      },
    },
  ];
}
