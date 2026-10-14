import type { SteelProfile, SteelProfileType } from '../types.js';

/**
 * OptiSteel 2.0 — Canonical Structural Steel Profile Catalog
 *
 * Source:
 * Andrew Pytel & Ferdinand L. Singer, "Resistencia de Materiales", 4th Edition,
 * Appendix B (Table B-2: "Propiedades de perfiles de acero estructural laminados").
 *
 * SCALE FACTORS AND PHYSICAL UNITS:
 * - `designation`: Standard metric designation (e.g. "W920x446", "S610x179", "C380x74").
 * - `type`: Profile family ('W' for wide-flange, 'S' for American Standard beams, 'C' for channels).
 * - `massKgPerM`: Linear mass in kilograms per meter (kg/m).
 * - `depthMm`: Total section depth d in millimeters (mm).
 * - `webThicknessMm`: Web thickness tw in millimeters (mm).
 * - `ixMillionMm4`: Strong-axis moment of inertia Ix in millions of mm^4 (10^6 mm^4).
 *   NOTE: Stored directly in 10^6 mm^4 (equivalent to 100 cm^4 or 10^-6 m^4).
 *   To convert to mm^4: ixMillionMm4 * 1e6
 *   To convert to cm^4: ixMillionMm4 * 100
 *   To convert to m^4:  ixMillionMm4 * 1e-6
 * - `sxThousandMm3`: Strong-axis elastic section modulus Sx in thousands of mm^3 (10^3 mm^3).
 *   NOTE: Stored directly in 10^3 mm^3 (equivalent to 1 cm^3 or 10^-6 m^3).
 *   To convert to mm^3: sxThousandMm3 * 1e3
 *   To convert to cm^3: sxThousandMm3 * 1
 *   To convert to m^3:  sxThousandMm3 * 1e-6
 *
 * Total profiles: 76 (46 W, 16 S, 14 C).
 * All properties are immutable (readonly).
 */
export const STEEL_PROFILES: readonly SteelProfile[] = [
  // --- W (Wide-flange / Perfiles I de patín ancho) — 46 perfiles ---
  { designation: 'W920x446', type: 'W', massKgPerM: 447.2, depthMm: 933, webThicknessMm: 24.0, ixMillionMm4: 8470.0, sxThousandMm3: 18200.0 },
  { designation: 'W920x417', type: 'W', massKgPerM: 418.1, depthMm: 928, webThicknessMm: 22.5, ixMillionMm4: 7880.0, sxThousandMm3: 17000.0 },
  { designation: 'W920x387', type: 'W', massKgPerM: 387.0, depthMm: 921, webThicknessMm: 21.3, ixMillionMm4: 7180.0, sxThousandMm3: 15600.0 },
  { designation: 'W920x342', type: 'W', massKgPerM: 342.4, depthMm: 912, webThicknessMm: 19.3, ixMillionMm4: 6250.0, sxThousandMm3: 13700.0 },
  { designation: 'W920x253', type: 'W', massKgPerM: 253.7, depthMm: 919, webThicknessMm: 17.3, ixMillionMm4: 4370.0, sxThousandMm3: 9520.0 },
  { designation: 'W920x201', type: 'W', massKgPerM: 201.3, depthMm: 903, webThicknessMm: 15.2, ixMillionMm4: 3250.0, sxThousandMm3: 7200.0 },
  { designation: 'W840x359', type: 'W', massKgPerM: 359.4, depthMm: 868, webThicknessMm: 21.1, ixMillionMm4: 5910.0, sxThousandMm3: 13600.0 },
  { designation: 'W840x176', type: 'W', massKgPerM: 176.0, depthMm: 835, webThicknessMm: 14.0, ixMillionMm4: 2460.0, sxThousandMm3: 5900.0 },
  { designation: 'W760x314', type: 'W', massKgPerM: 314.4, depthMm: 786, webThicknessMm: 19.7, ixMillionMm4: 4270.0, sxThousandMm3: 10900.0 },
  { designation: 'W760x147', type: 'W', massKgPerM: 147.1, depthMm: 753, webThicknessMm: 13.2, ixMillionMm4: 1660.0, sxThousandMm3: 4410.0 },
  { designation: 'W690x265', type: 'W', massKgPerM: 264.5, depthMm: 706, webThicknessMm: 18.4, ixMillionMm4: 2900.0, sxThousandMm3: 8220.0 },
  { designation: 'W690x125', type: 'W', massKgPerM: 125.6, depthMm: 678, webThicknessMm: 11.7, ixMillionMm4: 1190.0, sxThousandMm3: 3500.0 },
  { designation: 'W610x241', type: 'W', massKgPerM: 241.7, depthMm: 635, webThicknessMm: 17.9, ixMillionMm4: 2150.0, sxThousandMm3: 6780.0 },
  { designation: 'W610x140', type: 'W', massKgPerM: 140.1, depthMm: 617, webThicknessMm: 13.1, ixMillionMm4: 1120.0, sxThousandMm3: 3630.0 },
  { designation: 'W610x125', type: 'W', massKgPerM: 125.1, depthMm: 612, webThicknessMm: 11.9, ixMillionMm4: 985.0, sxThousandMm3: 3220.0 },
  { designation: 'W610x101', type: 'W', massKgPerM: 101.7, depthMm: 603, webThicknessMm: 10.5, ixMillionMm4: 764.0, sxThousandMm3: 2530.0 },
  { designation: 'W610x92', type: 'W', massKgPerM: 92.3, depthMm: 603, webThicknessMm: 10.9, ixMillionMm4: 646.0, sxThousandMm3: 2140.0 },
  { designation: 'W610x82', type: 'W', massKgPerM: 81.9, depthMm: 599, webThicknessMm: 10.0, ixMillionMm4: 560.0, sxThousandMm3: 1870.0 },
  { designation: 'W530x85', type: 'W', massKgPerM: 84.7, depthMm: 535, webThicknessMm: 10.3, ixMillionMm4: 485.0, sxThousandMm3: 1810.0 },
  { designation: 'W530x82a', type: 'W', massKgPerM: 82.4, depthMm: 528, webThicknessMm: 9.5, ixMillionMm4: 479.0, sxThousandMm3: 1810.0 },
  { designation: 'W530x74', type: 'W', massKgPerM: 74.7, depthMm: 529, webThicknessMm: 9.7, ixMillionMm4: 411.0, sxThousandMm3: 1550.0 },
  { designation: 'W530x66', type: 'W', massKgPerM: 65.7, depthMm: 525, webThicknessMm: 8.9, ixMillionMm4: 351.0, sxThousandMm3: 1340.0 },
  { designation: 'W460x82', type: 'W', massKgPerM: 81.9, depthMm: 460, webThicknessMm: 9.9, ixMillionMm4: 370.0, sxThousandMm3: 1610.0 },
  { designation: 'W460x60', type: 'W', massKgPerM: 59.6, depthMm: 455, webThicknessMm: 8.0, ixMillionMm4: 255.0, sxThousandMm3: 1120.0 },
  { designation: 'W460x52', type: 'W', massKgPerM: 52.0, depthMm: 450, webThicknessMm: 7.6, ixMillionMm4: 212.0, sxThousandMm3: 943.0 },
  { designation: 'W410x85', type: 'W', massKgPerM: 85.0, depthMm: 417, webThicknessMm: 10.9, ixMillionMm4: 315.0, sxThousandMm3: 1510.0 },
  { designation: 'W410x60', type: 'W', massKgPerM: 59.5, depthMm: 407, webThicknessMm: 7.7, ixMillionMm4: 216.0, sxThousandMm3: 1060.0 },
  { designation: 'W410x46', type: 'W', massKgPerM: 46.2, depthMm: 403, webThicknessMm: 7.0, ixMillionMm4: 156.0, sxThousandMm3: 773.0 },
  { designation: 'W410x39', type: 'W', massKgPerM: 39.2, depthMm: 399, webThicknessMm: 6.4, ixMillionMm4: 127.0, sxThousandMm3: 634.0 },
  { designation: 'W360x51', type: 'W', massKgPerM: 50.6, depthMm: 355, webThicknessMm: 7.2, ixMillionMm4: 141.0, sxThousandMm3: 796.0 },
  { designation: 'W360x45', type: 'W', massKgPerM: 45.0, depthMm: 352, webThicknessMm: 6.9, ixMillionMm4: 122.0, sxThousandMm3: 691.0 },
  { designation: 'W360x33', type: 'W', massKgPerM: 32.8, depthMm: 349, webThicknessMm: 5.8, ixMillionMm4: 82.7, sxThousandMm3: 474.0 },
  { designation: 'W310x52', type: 'W', massKgPerM: 52.3, depthMm: 317, webThicknessMm: 7.6, ixMillionMm4: 118.0, sxThousandMm3: 747.0 },
  { designation: 'W310x38.7', type: 'W', massKgPerM: 38.7, depthMm: 310, webThicknessMm: 5.8, ixMillionMm4: 85.1, sxThousandMm3: 549.0 },
  { designation: 'W310x28', type: 'W', massKgPerM: 28.4, depthMm: 309, webThicknessMm: 6.0, ixMillionMm4: 54.3, sxThousandMm3: 351.0 },
  { designation: 'W310x21', type: 'W', massKgPerM: 21.1, depthMm: 303, webThicknessMm: 5.1, ixMillionMm4: 37.0, sxThousandMm3: 244.0 },
  { designation: 'W250x45', type: 'W', massKgPerM: 44.9, depthMm: 266, webThicknessMm: 7.6, ixMillionMm4: 71.1, sxThousandMm3: 534.0 },
  { designation: 'W250x33', type: 'W', massKgPerM: 32.7, depthMm: 258, webThicknessMm: 6.1, ixMillionMm4: 48.9, sxThousandMm3: 379.0 },
  { designation: 'W250x28', type: 'W', massKgPerM: 28.5, depthMm: 260, webThicknessMm: 6.4, ixMillionMm4: 40.0, sxThousandMm3: 307.0 },
  { designation: 'W250x18', type: 'W', massKgPerM: 17.9, depthMm: 251, webThicknessMm: 4.8, ixMillionMm4: 22.4, sxThousandMm3: 179.0 },
  { designation: 'W200x46', type: 'W', massKgPerM: 46.0, depthMm: 203, webThicknessMm: 7.2, ixMillionMm4: 45.5, sxThousandMm3: 448.0 },
  { designation: 'W200x27', type: 'W', massKgPerM: 26.6, depthMm: 207, webThicknessMm: 5.8, ixMillionMm4: 25.8, sxThousandMm3: 249.0 },
  { designation: 'W200x22', type: 'W', massKgPerM: 22.4, depthMm: 206, webThicknessMm: 6.2, ixMillionMm4: 20.0, sxThousandMm3: 194.0 },
  { designation: 'W200x15', type: 'W', massKgPerM: 15.0, depthMm: 200, webThicknessMm: 4.3, ixMillionMm4: 12.7, sxThousandMm3: 127.0 },
  { designation: 'W150x22', type: 'W', massKgPerM: 22.3, depthMm: 152, webThicknessMm: 5.8, ixMillionMm4: 12.1, sxThousandMm3: 159.0 },
  { designation: 'W150x14', type: 'W', massKgPerM: 13.6, depthMm: 150, webThicknessMm: 4.3, ixMillionMm4: 6.87, sxThousandMm3: 91.5 },

  // --- S (American Standard I-beams / Vigas estándar I) — 16 perfiles ---
  { designation: 'S610x179', type: 'S', massKgPerM: 178.9, depthMm: 610, webThicknessMm: 20.3, ixMillionMm4: 1260.0, sxThousandMm3: 4140.0 },
  { designation: 'S610x118.9', type: 'S', massKgPerM: 119.1, depthMm: 610, webThicknessMm: 12.7, ixMillionMm4: 879.0, sxThousandMm3: 2880.0 },
  { designation: 'S510x141', type: 'S', massKgPerM: 141.8, depthMm: 508, webThicknessMm: 20.3, ixMillionMm4: 674.0, sxThousandMm3: 2660.0 },
  { designation: 'S510x97.3', type: 'S', massKgPerM: 97.8, depthMm: 508, webThicknessMm: 12.7, ixMillionMm4: 494.0, sxThousandMm3: 1950.0 },
  { designation: 'S460x104', type: 'S', massKgPerM: 104.7, depthMm: 457, webThicknessMm: 18.1, ixMillionMm4: 387.0, sxThousandMm3: 1690.0 },
  { designation: 'S460x81.4', type: 'S', massKgPerM: 81.6, depthMm: 457, webThicknessMm: 11.7, ixMillionMm4: 335.0, sxThousandMm3: 1470.0 },
  { designation: 'S380x74', type: 'S', massKgPerM: 74.6, depthMm: 381, webThicknessMm: 14.0, ixMillionMm4: 203.0, sxThousandMm3: 1060.0 },
  { designation: 'S310x74', type: 'S', massKgPerM: 74.6, depthMm: 305, webThicknessMm: 17.4, ixMillionMm4: 128.0, sxThousandMm3: 836.0 },
  { designation: 'S310x52', type: 'S', massKgPerM: 52.2, depthMm: 305, webThicknessMm: 10.9, ixMillionMm4: 95.8, sxThousandMm3: 629.0 },
  { designation: 'S250x52', type: 'S', massKgPerM: 52.3, depthMm: 254, webThicknessMm: 15.1, ixMillionMm4: 61.6, sxThousandMm3: 485.0 },
  { designation: 'S250x38', type: 'S', massKgPerM: 37.8, depthMm: 254, webThicknessMm: 7.9, ixMillionMm4: 51.4, sxThousandMm3: 405.0 },
  { designation: 'S200x34', type: 'S', massKgPerM: 34.3, depthMm: 203, webThicknessMm: 11.2, ixMillionMm4: 27.0, sxThousandMm3: 266.0 },
  { designation: 'S200x27', type: 'S', massKgPerM: 27.5, depthMm: 203, webThicknessMm: 6.9, ixMillionMm4: 24.0, sxThousandMm3: 237.0 },
  { designation: 'S150x26', type: 'S', massKgPerM: 25.5, depthMm: 152, webThicknessMm: 11.8, ixMillionMm4: 10.8, sxThousandMm3: 143.0 },
  { designation: 'S130x22', type: 'S', massKgPerM: 21.9, depthMm: 127, webThicknessMm: 12.5, ixMillionMm4: 6.33, sxThousandMm3: 99.6 },
  { designation: 'S100x14.1', type: 'S', massKgPerM: 14.0, depthMm: 102, webThicknessMm: 8.3, ixMillionMm4: 2.81, sxThousandMm3: 55.2 },

  // --- C (American Standard Channels / Canales en U) — 14 perfiles ---
  { designation: 'C380x74', type: 'C', massKgPerM: 74.4, depthMm: 381, webThicknessMm: 18.2, ixMillionMm4: 168.0, sxThousandMm3: 881.0 },
  { designation: 'C380x50', type: 'C', massKgPerM: 50.5, depthMm: 381, webThicknessMm: 10.2, ixMillionMm4: 131.0, sxThousandMm3: 687.0 },
  { designation: 'C310x45', type: 'C', massKgPerM: 44.7, depthMm: 305, webThicknessMm: 13.0, ixMillionMm4: 67.3, sxThousandMm3: 442.0 },
  { designation: 'C310x30.8', type: 'C', massKgPerM: 30.8, depthMm: 305, webThicknessMm: 7.2, ixMillionMm4: 53.5, sxThousandMm3: 351.0 },
  { designation: 'C250x45', type: 'C', massKgPerM: 44.5, depthMm: 254, webThicknessMm: 17.1, ixMillionMm4: 42.8, sxThousandMm3: 337.0 },
  { designation: 'C250x30', type: 'C', massKgPerM: 29.6, depthMm: 254, webThicknessMm: 9.6, ixMillionMm4: 32.7, sxThousandMm3: 257.0 },
  { designation: 'C250x23', type: 'C', massKgPerM: 22.6, depthMm: 254, webThicknessMm: 6.1, ixMillionMm4: 27.8, sxThousandMm3: 219.0 },
  { designation: 'C200x28', type: 'C', massKgPerM: 27.9, depthMm: 203, webThicknessMm: 12.4, ixMillionMm4: 18.2, sxThousandMm3: 180.0 },
  { designation: 'C200x21', type: 'C', massKgPerM: 20.4, depthMm: 203, webThicknessMm: 7.7, ixMillionMm4: 14.9, sxThousandMm3: 147.0 },
  { designation: 'C180x22', type: 'C', massKgPerM: 21.9, depthMm: 178, webThicknessMm: 10.6, ixMillionMm4: 11.3, sxThousandMm3: 127.0 },
  { designation: 'C150x19', type: 'C', massKgPerM: 19.2, depthMm: 152, webThicknessMm: 11.1, ixMillionMm4: 7.12, sxThousandMm3: 93.7 },
  { designation: 'C150x16', type: 'C', massKgPerM: 15.5, depthMm: 152, webThicknessMm: 8.0, ixMillionMm4: 6.22, sxThousandMm3: 81.9 },
  { designation: 'C130x13', type: 'C', massKgPerM: 13.3, depthMm: 127, webThicknessMm: 8.3, ixMillionMm4: 3.66, sxThousandMm3: 57.6 },
  { designation: 'C100x11', type: 'C', massKgPerM: 10.8, depthMm: 102, webThicknessMm: 8.2, ixMillionMm4: 1.91, sxThousandMm3: 37.4 },
] as const;

/** Total count of canonical profiles in the catalog */
export const TOTAL_STEEL_PROFILES_COUNT = STEEL_PROFILES.length;

/** Count of profiles categorized by structural type */
export const STEEL_PROFILES_COUNT_BY_TYPE = {
  W: 46,
  S: 16,
  C: 14,
} as const;

/** Fast lookup map indexed by profile designation */
export const STEEL_PROFILES_BY_DESIGNATION: ReadonlyMap<string, SteelProfile> = new Map(
  STEEL_PROFILES.map((p) => [p.designation, p])
);

/**
 * Filter profiles by section type ('W', 'S', 'C' or 'ALL').
 *
 * @param type The profile family to filter by, or 'ALL' to retrieve the entire catalog.
 * @returns Readonly array of matching profiles.
 */
export function getProfilesByType(type: SteelProfileType | 'ALL'): readonly SteelProfile[] {
  if (type === 'ALL') {
    return STEEL_PROFILES;
  }
  return STEEL_PROFILES.filter((p) => p.type === type);
}
