import {
  LENGTH_TOLERANCE,
  LOAD_INTENSITY_TOLERANCE,
  SPAN_EQUALITY_TOLERANCE,
} from './constants.js';
import type {
  BeamModel,
  DistributedLoad,
  Load,
  ValidationResult,
  DeterminacyClassification,
} from './types.js';

export function validateBeamModel(model: BeamModel): ValidationResult {
  const errors: string[] = [];

  // 1. Validate beam length
  if (!Number.isFinite(model.length)) {
    errors.push('La longitud de la viga debe ser un número finito.');
  } else if (model.length <= 0) {
    errors.push(
      `La longitud de la viga (${model.length} m) debe ser estrictamente mayor que cero.`
    );
  }

  const length = model.length;

  // 2. Validate supports array
  if (!Array.isArray(model.supports)) {
    errors.push('La lista de apoyos debe ser un arreglo.');
    return {
      isValid: false,
      errors,
      classification: 'invalid',
    };
  }

  // Validate individual supports
  for (let i = 0; i < model.supports.length; i++) {
    const s = model.supports[i];
    if (!s) continue;

    if (!['pin', 'roller', 'fixed'].includes(s.type)) {
      errors.push(`Apoyo #${i + 1} ('${s.id}'): tipo inválido '${s.type}'.`);
    }

    if (!Number.isFinite(s.x)) {
      errors.push(
        `Apoyo #${i + 1} ('${s.id}'): posición x no es un número finito.`
      );
    } else if (s.x < -LENGTH_TOLERANCE || s.x > length + LENGTH_TOLERANCE) {
      errors.push(
        `Apoyo #${i + 1} ('${s.id}'): posición x=${s.x} m fuera de la viga [0, ${length}].`
      );
    }
  }

  // Check coincident supports
  for (let i = 0; i < model.supports.length; i++) {
    for (let j = i + 1; j < model.supports.length; j++) {
      const s1 = model.supports[i];
      const s2 = model.supports[j];
      if (
        s1 &&
        s2 &&
        Number.isFinite(s1.x) &&
        Number.isFinite(s2.x) &&
        Math.abs(s1.x - s2.x) < LENGTH_TOLERANCE
      ) {
        errors.push(
          `Apoyos coincidentes en x=${s1.x} m ('${s1.id}' y '${s2.id}'). No se permiten apoyos en la misma coordenada.`
        );
      }
    }
  }

  // 3. Validate loads array
  if (!Array.isArray(model.loads)) {
    errors.push('La lista de cargas debe ser un arreglo.');
  } else {
    for (let i = 0; i < model.loads.length; i++) {
      const load = model.loads[i];
      if (!load) continue;
      validateLoad(load, length, i + 1, errors);
    }
  }

  // 4. Determine structural classification for transverse isostatic solver
  let classification: DeterminacyClassification = 'invalid';

  if (errors.length > 0) {
    classification = 'invalid';
    return { isValid: false, errors, classification };
  }

  const supports = model.supports;
  if (supports.length === 0) {
    classification = 'unstable';
    errors.push('La viga no tiene apoyos (sistema inestable/mecanismo libre).');
  } else if (supports.length === 1) {
    const s = supports[0];
    if (s && s.type === 'fixed') {
      classification = 'isostatic'; // Cantilever isostatic
    } else {
      classification = 'unstable';
      errors.push(
        `Un único apoyo simple de tipo '${s?.type}' es un mecanismo libre inestable ante cargas transversales.`
      );
    }
  } else if (supports.length === 2) {
    const s1 = supports[0];
    const s2 = supports[1];
    if (s1 && s2) {
      const fixedCount =
        (s1.type === 'fixed' ? 1 : 0) + (s2.type === 'fixed' ? 1 : 0);
      if (fixedCount > 0) {
        classification = 'hyperstatic';
        if (fixedCount === 1) {
          // Supported H1 and H2 configurations: 1 fixed, 1 simple support, point and/or distributed loads
          const hasUnsupportedLoads = model.loads.some(
            (l) => l.type !== 'point' && l.type !== 'distributed'
          );
          if (hasUnsupportedLoads) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas empotradas-apoyadas con momentos aplicados aún no están implementadas.'
            );
          } else if (!model.material || !model.section) {
            errors.push(
              'El análisis de vigas hiperestáticas (empotrada-apoyada) requiere propiedades de material (E en GPa) y sección (Iz en cm^4).'
            );
          }

          // Case H1: Propped cantilever point loads must be within the span between supports
          const minSupportX = Math.min(s1.x, s2.x);
          const maxSupportX = Math.max(s1.x, s2.x);
          const hasOverhangPointLoad = model.loads.some(
            (l) =>
              l.type === 'point' &&
              (l.x < minSupportX - LENGTH_TOLERANCE ||
                l.x > maxSupportX + LENGTH_TOLERANCE)
          );
          if (hasOverhangPointLoad) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas empotradas-apoyadas con cargas puntuales en voladizo exterior fuera del tramo entre apoyos.'
            );
          }

          // Case H2: Propped cantilever distributed loads must be within the span between supports
          const hasOverhangDistLoad = model.loads.some(
            (l) =>
              l.type === 'distributed' &&
              (Math.min(l.xStart, l.xEnd) < minSupportX - LENGTH_TOLERANCE ||
                Math.max(l.xStart, l.xEnd) > maxSupportX + LENGTH_TOLERANCE)
          );
          if (hasOverhangDistLoad) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas empotradas-apoyadas con cargas distribuidas en voladizo exterior fuera del tramo entre apoyos.'
            );
          }
        } else if (fixedCount === 2) {
          // Supported H3 configuration: 2 fixed supports, point and/or distributed loads
          const hasUnsupportedLoads = model.loads.some(
            (l) => l.type !== 'point' && l.type !== 'distributed'
          );
          if (hasUnsupportedLoads) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas biempotradas con momentos aplicados aún no están implementadas.'
            );
          } else if (!model.material || !model.section) {
            errors.push(
              'El análisis de vigas hiperestáticas (biempotrada) requiere propiedades de material (E en GPa) y sección (Iz en cm^4).'
            );
          }

          // Case H3: Bi-clamped beam point loads must be within the span between supports
          const minSupportX = Math.min(s1.x, s2.x);
          const maxSupportX = Math.max(s1.x, s2.x);
          const hasOverhangPointLoad = model.loads.some(
            (l) =>
              l.type === 'point' &&
              (l.x < minSupportX - LENGTH_TOLERANCE ||
                l.x > maxSupportX + LENGTH_TOLERANCE)
          );
          if (hasOverhangPointLoad) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas biempotradas con cargas puntuales en voladizo exterior fuera del tramo entre apoyos.'
            );
          }

          // Case H3: Bi-clamped beam distributed loads must be within the span between supports
          const hasOverhangDistLoad = model.loads.some(
            (l) =>
              l.type === 'distributed' &&
              (Math.min(l.xStart, l.xEnd) < minSupportX - LENGTH_TOLERANCE ||
                Math.max(l.xStart, l.xEnd) > maxSupportX + LENGTH_TOLERANCE)
          );
          if (hasOverhangDistLoad) {
            errors.push(
              'Configuración hiperestática aún no soportada: vigas biempotradas con cargas distribuidas en voladizo exterior fuera del tramo entre apoyos.'
            );
          }
        }
      } else {
        classification = 'isostatic'; // Two simple supports (pin/roller or roller/roller)
      }
    }
  } else if (supports.length === 3) {
    // 3 supports: two-span continuous beam (H4)
    classification = 'hyperstatic';
    const hasFixed = supports.some((s) => s.type === 'fixed');
    if (hasFixed) {
      errors.push(
        'Configuración hiperestática aún no soportada: vigas continuas con empotramientos aún no están implementadas.'
      );
    } else {
      const sortedSupports = [...supports].sort((a, b) => a.x - b.x);
      const s1 = sortedSupports[0]!;
      const s2 = sortedSupports[1]!;
      const s3 = sortedSupports[2]!;
      const L1 = s2.x - s1.x;
      const L2 = s3.x - s2.x;
      const areSpansEqual = Math.abs(L1 - L2) <= SPAN_EQUALITY_TOLERANCE;

      const minSupportX = s1.x;
      const maxSupportX = s3.x;

      // Case H4: Point loads are not supported
      const hasPointLoad = model.loads.some((l) => l.type === 'point');

      // Case H4: Check for loads in exterior overhangs beyond outer supports
      const hasOverhangPointLoad = model.loads.some(
        (l) =>
          l.type === 'point' &&
          (l.x < minSupportX - LENGTH_TOLERANCE ||
            l.x > maxSupportX + LENGTH_TOLERANCE)
      );
      if (hasOverhangPointLoad) {
        errors.push(
          'Configuración hiperestática aún no soportada: vigas continuas con cargas puntuales en voladizo exterior fuera del tramo entre apoyos.'
        );
      }

      const hasOverhangDistLoad = model.loads.some(
        (l) =>
          l.type === 'distributed' &&
          (Math.min(l.xStart, l.xEnd) < minSupportX - LENGTH_TOLERANCE ||
            Math.max(l.xStart, l.xEnd) > maxSupportX + LENGTH_TOLERANCE)
      );
      if (hasOverhangDistLoad) {
        errors.push(
          'Configuración hiperestática aún no soportada: vigas continuas con cargas distribuidas en voladizo exterior fuera del tramo entre apoyos.'
        );
      }

      const firstDist = model.loads.find(
        (l): l is DistributedLoad => l.type === 'distributed'
      );
      const firstW = firstDist?.wStart ?? 0;

      // H4 requires uniform distributed load over both spans between s1 and s3
      const isUniformOverBothSpans =
        model.loads.length > 0 &&
        !hasPointLoad &&
        !hasOverhangDistLoad &&
        firstDist !== undefined &&
        model.loads.every(
          (l) =>
            l.type === 'distributed' &&
            Math.abs(l.wStart - l.wEnd) <= LOAD_INTENSITY_TOLERANCE &&
            Math.abs(l.wStart - firstW) <= LOAD_INTENSITY_TOLERANCE &&
            Math.abs(l.xStart - minSupportX) <= LENGTH_TOLERANCE &&
            Math.abs(l.xEnd - maxSupportX) <= LENGTH_TOLERANCE
        );

      if (!areSpansEqual || (!isUniformOverBothSpans && !hasOverhangDistLoad && !hasOverhangPointLoad)) {
        errors.push(
          'Configuración hiperestática aún no soportada: vigas continuas con cargas puntuales, vanos desiguales o cargas parciales aún no están implementadas (solo Caso H4: dos vanos iguales con carga uniforme continua).'
        );
      } else if (!model.material || !model.section) {
        errors.push(
          'El análisis de vigas hiperestáticas continuas requiere propiedades de material (E en GPa) y sección (Iz en cm^4).'
        );
      }
    }
  } else {
    // 4 or more supports
    classification = 'hyperstatic';
    errors.push(
      `El modelo tiene ${supports.length} apoyos, lo cual supera los 3 apoyos soportados (viga continua hiperestática de más de 2 vanos aún no soportada).`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    classification,
  };
}

function validateLoad(
  load: Load,
  beamLength: number,
  index: number,
  errors: string[]
): void {
  switch (load.type) {
    case 'point': {
      if (!Number.isFinite(load.P)) {
        errors.push(
          `Carga puntual #${index} ('${load.id}'): magnitud P no es un número finito.`
        );
      }
      if (!Number.isFinite(load.x)) {
        errors.push(
          `Carga puntual #${index} ('${load.id}'): posición x no es un número finito.`
        );
      } else if (
        load.x < -LENGTH_TOLERANCE ||
        load.x > beamLength + LENGTH_TOLERANCE
      ) {
        errors.push(
          `Carga puntual #${index} ('${load.id}'): posición x=${load.x} m fuera de la viga [0, ${beamLength}].`
        );
      }
      break;
    }
    case 'distributed': {
      if (!Number.isFinite(load.xStart) || !Number.isFinite(load.xEnd)) {
        errors.push(
          `Carga distribuida #${index} ('${load.id}'): extremos xStart/xEnd deben ser números finitos.`
        );
      } else {
        if (
          load.xStart < -LENGTH_TOLERANCE ||
          load.xStart > beamLength + LENGTH_TOLERANCE
        ) {
          errors.push(
            `Carga distribuida #${index} ('${load.id}'): xStart=${load.xStart} m fuera de la viga [0, ${beamLength}].`
          );
        }
        if (
          load.xEnd < -LENGTH_TOLERANCE ||
          load.xEnd > beamLength + LENGTH_TOLERANCE
        ) {
          errors.push(
            `Carga distribuida #${index} ('${load.id}'): xEnd=${load.xEnd} m fuera de la viga [0, ${beamLength}].`
          );
        }
        if (load.xEnd <= load.xStart + LENGTH_TOLERANCE) {
          errors.push(
            `Carga distribuida #${index} ('${load.id}'): xEnd (${load.xEnd} m) debe ser mayor que xStart (${load.xStart} m).`
          );
        }
      }

      if (!Number.isFinite(load.wStart) || !Number.isFinite(load.wEnd)) {
        errors.push(
          `Carga distribuida #${index} ('${load.id}'): intensidades wStart/wEnd deben ser números finitos.`
        );
      } else {
        if (load.wStart < 0 || load.wEnd < 0) {
          errors.push(
            `Carga distribuida #${index} ('${load.id}'): las intensidades wStart/wEnd deben ser no negativas (hacia abajo).`
          );
        }
      }
      break;
    }
    case 'moment': {
      if (!Number.isFinite(load.M)) {
        errors.push(
          `Momento concentrado #${index} ('${load.id}'): magnitud M no es un número finito.`
        );
      }
      if (!Number.isFinite(load.x)) {
        errors.push(
          `Momento concentrado #${index} ('${load.id}'): posición x no es un número finito.`
        );
      } else if (
        load.x < -LENGTH_TOLERANCE ||
        load.x > beamLength + LENGTH_TOLERANCE
      ) {
        errors.push(
          `Momento concentrado #${index} ('${load.id}'): posición x=${load.x} m fuera de la viga [0, ${beamLength}].`
        );
      }
      break;
    }
    default: {
      const unknownLoad = load as { type?: unknown; id?: unknown };
      errors.push(
        `Carga #${index} ('${String(unknownLoad.id)}'): tipo desconocido '${String(unknownLoad.type)}'.`
      );
    }
  }
}
