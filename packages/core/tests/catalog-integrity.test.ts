import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STEEL_PROFILES,
  TOTAL_STEEL_PROFILES_COUNT,
  STEEL_PROFILES_COUNT_BY_TYPE,
  STEEL_PROFILES_BY_DESIGNATION,
  getProfilesByType,
} from '../src/catalog/steel-profiles.js';
import type { SteelProfileType } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveCsvPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../perfiles_estructurales.csv'),
    path.resolve(process.cwd(), 'perfiles_estructurales.csv'),
    path.resolve(process.cwd(), '../perfiles_estructurales.csv'),
    path.resolve(process.cwd(), '../../perfiles_estructurales.csv'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No se localizó perfiles_estructurales.csv en ninguna de las rutas evaluadas: ${candidates.join(', ')}`
  );
}

describe('OptiSteel 2.0 — Catálogo de Perfiles de Acero (Integridad y Validación)', () => {
  const csvPath = resolveCsvPath();
  const rawCsv = fs.readFileSync(csvPath, 'utf-8');
  const lines = rawCsv
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const [headerLine, ...csvDataRows] = lines;

  it('1. El archivo fuente CSV existe y contiene exactamente 76 filas de datos', () => {
    expect(fs.existsSync(csvPath)).toBe(true);
    expect(headerLine).toBe('tipo,designacion,masa_kg_m,d_mm,tw_mm,Ix_10e6_mm4,Sx_10e3_mm3');
    expect(csvDataRows.length).toBe(76);
  });

  it('2. El catálogo TypeScript exporta exactamente 76 registros inmutables', () => {
    expect(STEEL_PROFILES).toBeDefined();
    expect(STEEL_PROFILES.length).toBe(76);
    expect(TOTAL_STEEL_PROFILES_COUNT).toBe(76);
  });

  it('3. Todas las 76 designaciones son únicas y no existen registros duplicados', () => {
    const designations = STEEL_PROFILES.map((p) => p.designation);
    const uniqueDesignations = new Set(designations);
    expect(uniqueDesignations.size).toBe(76);

    const designationsMap = new Map<string, number>();
    for (const d of designations) {
      designationsMap.set(d, (designationsMap.get(d) ?? 0) + 1);
    }
    for (const [desig, count] of designationsMap.entries()) {
      expect(count, `Designación duplicada: ${desig}`).toBe(1);
    }
  });

  it('4. Distribución exacta de familias de perfiles: 46 W, 16 S y 14 C', () => {
    const counts: Record<SteelProfileType, number> = { W: 0, S: 0, C: 0 };
    for (const p of STEEL_PROFILES) {
      counts[p.type] = (counts[p.type] ?? 0) + 1;
    }

    expect(counts.W).toBe(46);
    expect(counts.S).toBe(16);
    expect(counts.C).toBe(14);
    expect(counts.W + counts.S + counts.C).toBe(76);

    expect(STEEL_PROFILES_COUNT_BY_TYPE.W).toBe(46);
    expect(STEEL_PROFILES_COUNT_BY_TYPE.S).toBe(16);
    expect(STEEL_PROFILES_COUNT_BY_TYPE.C).toBe(14);
  });

  it('5. Tipos permitidos exclusivamente W, S y C', () => {
    const allowedTypes = new Set<string>(['W', 'S', 'C']);
    for (const p of STEEL_PROFILES) {
      expect(allowedTypes.has(p.type)).toBe(true);
      expect(['W', 'S', 'C']).toContain(p.type);
    }
  });

  it('6. Campos obligatorios presentes y valores numéricos estrictamente positivos y finitos', () => {
    for (const p of STEEL_PROFILES) {
      expect(typeof p.designation).toBe('string');
      expect(p.designation.trim().length).toBeGreaterThan(0);

      expect(typeof p.massKgPerM).toBe('number');
      expect(Number.isFinite(p.massKgPerM)).toBe(true);
      expect(p.massKgPerM).toBeGreaterThan(0);

      expect(typeof p.depthMm).toBe('number');
      expect(Number.isFinite(p.depthMm)).toBe(true);
      expect(p.depthMm).toBeGreaterThan(0);
      expect(Number.isInteger(p.depthMm)).toBe(true);

      expect(typeof p.webThicknessMm).toBe('number');
      expect(Number.isFinite(p.webThicknessMm)).toBe(true);
      expect(p.webThicknessMm).toBeGreaterThan(0);

      expect(typeof p.ixMillionMm4).toBe('number');
      expect(Number.isFinite(p.ixMillionMm4)).toBe(true);
      expect(p.ixMillionMm4).toBeGreaterThan(0);

      expect(typeof p.sxThousandMm3).toBe('number');
      expect(Number.isFinite(p.sxThousandMm3)).toBe(true);
      expect(p.sxThousandMm3).toBeGreaterThan(0);
    }
  });

  it('7. Comparación determinista 1 a 1 entre el CSV fuente y el catálogo TypeScript', () => {
    expect(STEEL_PROFILES.length).toBe(csvDataRows.length);

    csvDataRows.forEach((rowStr, index) => {
      const parts = rowStr.split(',');
      expect(parts.length).toBe(7);

      const [tipo, designacion, masa_kg_m, d_mm, tw_mm, Ix_10e6_mm4, Sx_10e3_mm3] = parts;
      const tsProfile = STEEL_PROFILES[index]!;

      // Coincidencia exacta de cada campo
      expect(tsProfile.type).toBe(tipo!.trim());
      expect(tsProfile.designation).toBe(designacion!.trim());
      expect(tsProfile.massKgPerM).toBe(Number(masa_kg_m));
      expect(tsProfile.depthMm).toBe(Number(d_mm));
      expect(tsProfile.webThicknessMm).toBe(Number(tw_mm));
      expect(tsProfile.ixMillionMm4).toBe(Number(Ix_10e6_mm4));
      expect(tsProfile.sxThousandMm3).toBe(Number(Sx_10e3_mm3));
    });
  });

  it('8. Mapa de búsqueda por designación y función de filtrado por tipo operan correctamente', () => {
    expect(STEEL_PROFILES_BY_DESIGNATION.size).toBe(76);

    const firstW = STEEL_PROFILES_BY_DESIGNATION.get('W920x446');
    expect(firstW).toBeDefined();
    expect(firstW?.depthMm).toBe(933);
    expect(firstW?.massKgPerM).toBe(447.2);

    const lastC = STEEL_PROFILES_BY_DESIGNATION.get('C100x11');
    expect(lastC).toBeDefined();
    expect(lastC?.depthMm).toBe(102);
    expect(lastC?.massKgPerM).toBe(10.8);

    expect(getProfilesByType('W').length).toBe(46);
    expect(getProfilesByType('S').length).toBe(16);
    expect(getProfilesByType('C').length).toBe(14);
    expect(getProfilesByType('ALL').length).toBe(76);
  });

  it('9. Consistencia geométrica elástica teórica: Sx ≈ 2 * Ix / d', () => {
    // Para vigas simétricas de eje fuerte, Sx = Ix / c con c = d / 2, luego Sx ≈ (2 * Ix * 10^6) / d
    // En unidades de la tabla: (2 * ixMillionMm4 * 1e6) / depthMm ≈ sxThousandMm3 * 1e3
    // Ratio = (2 * ixMillionMm4 * 1000) / (depthMm * sxThousandMm3) ≈ 1.0
    for (const p of STEEL_PROFILES) {
      const sxTeoricoThousand = (2 * p.ixMillionMm4 * 1000) / p.depthMm;
      const ratio = p.sxThousandMm3 / sxTeoricoThousand;

      // La relación se encuentra dentro de ±2.5% para todas las secciones laminadas
      expect(ratio).toBeGreaterThan(0.97);
      expect(ratio).toBeLessThan(1.03);
    }
  });
});
