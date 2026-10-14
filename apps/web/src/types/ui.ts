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
  supports: FormSupport[];
  loads: FormLoad[];
}

export type ActiveTab = 'analyzer' | 'pytel-singer' | 'sign-conventions';
