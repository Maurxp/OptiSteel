import type { SupportType } from '@optisteel/core';

export interface FormSupport {
  id: string;
  type: SupportType;
  x: number;
  label?: string | undefined;
}

export type FormLoadType = 'point' | 'distributed' | 'moment';

export interface FormLoad {
  id: string;
  type: FormLoadType;
  label?: string | undefined;
  // Point or Moment load position:
  x?: number | undefined;
  // Point load magnitude in kN (positive downwards):
  P?: number | undefined;
  // Moment magnitude in kN*m (positive CCW):
  M?: number | undefined;
  // Distributed load:
  xStart?: number | undefined;
  xEnd?: number | undefined;
  wStart?: number | undefined;
  wEnd?: number | undefined;
}

export interface BeamFormState {
  length: number;
  materialName: string;
  E: number; // GPa
  sectionName: string;
  Iz: number; // cm^4
  // Extended section geometry for Mechanics of Materials:
  sectionType?: 'rectangular' | 'i_shape' | 'circular' | 'general' | undefined;
  widthMm?: number | undefined; // b in mm
  heightMm?: number | undefined; // h in mm
  webThicknessMm?: number | undefined;
  flangeThicknessMm?: number | undefined;
  flangeWidthMm?: number | undefined;
  diameterMm?: number | undefined;
  cMm?: number | undefined;
  Wz?: number | undefined; // cm^3
  areaCm2?: number | undefined;
  allowableBendingStressMPa?: number | undefined;
  allowableShearStressMPa?: number | undefined;
  deflectionLimitDenominator?: number | undefined;
  supports: FormSupport[];
  loads: FormLoad[];
}

export type ActiveTab = 'analyzer' | 'pytel-singer' | 'sign-conventions';
