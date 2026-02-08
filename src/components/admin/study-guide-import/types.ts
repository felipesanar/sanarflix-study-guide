/**
 * Types for Study Guide Import System
 * Schema inferred from:
 * - CSV: semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz
 * - XLSX: id_ies, semestre, materia, tema, subtema, aula, link_aula, corrigido_pdf, corrigido_quiz
 */

export type ImportMode = 'MERGE' | 'REPLACE' | 'APPEND';

export type FileType = 'csv' | 'xlsx';

export type ImportStep = 
  | 'upload' 
  | 'configure' 
  | 'validate' 
  | 'import' 
  | 'result';

export type ImportStatus = 
  | 'idle' 
  | 'parsing' 
  | 'validating' 
  | 'ready_to_import' 
  | 'importing' 
  | 'success' 
  | 'error';

export interface IES {
  id: string;
  nome: string;
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  mappedIesId: string | null;
  mappedIesName: string | null;
  autoMatched: boolean;
}

export interface ParsedFile {
  type: FileType;
  name: string;
  size: number;
  sheets: SheetInfo[];
  totalRows: number;
}

export interface RawRow {
  rowNumber: number;
  sheetName?: string;
  id_ies?: string;
  semestre: string | number;
  materia: string;
  tema?: string;
  subtema?: string;
  aula?: string;
  link_aula?: string;
  link_pdf?: string;
  link_quiz?: string;
  [key: string]: unknown;
}

export interface NormalizedRow {
  rowNumber: number;
  sheetName?: string;
  id_ies: string;
  semestre: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  rowNumber: number;
  sheetName?: string;
  field: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  invalidValue?: string;
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalizedData: NormalizedRow[];
}

export interface ChangePlan {
  inserts: number;
  updates: number;
  deletes: number;
  ignored: number;
}

export interface ImportConfig {
  mode: ImportMode;
  scope: 'ies_semestre' | 'ies_full';
  emptyBehavior: 'ignore' | 'null';
  strictMode: boolean;
  dryRun: boolean;
}

export interface SheetMapping {
  sheetName: string;
  iesId: string;
  iesNome: string;
}

export interface ImportPayload {
  config: ImportConfig;
  institutionMappings: SheetMapping[];
  rows: NormalizedRow[];
}

export interface ImportResultRow {
  rowNumber: number;
  sheetName?: string;
  status: 'inserted' | 'updated' | 'ignored' | 'error';
  error?: string;
}

export interface ImportResponse {
  success: boolean;
  requestId: string;
  counts: {
    inserted: number;
    updated: number;
    deleted: number;
    ignored: number;
    errors: number;
  };
  errors: ImportResultRow[];
  durationMs: number;
}

export interface ImportProgress {
  stage: 'parsing' | 'normalizing' | 'uploading' | 'processing' | 'verifying';
  stageProgress: number;
  totalProgress: number;
  message: string;
}

// Wizard state
export interface WizardState {
  step: ImportStep;
  status: ImportStatus;
  file: File | null;
  parsedFile: ParsedFile | null;
  sheetMappings: SheetMapping[];
  config: ImportConfig;
  validation: ValidationResult | null;
  changePlan: ChangePlan | null;
  progress: ImportProgress | null;
  result: ImportResponse | null;
  error: string | null;
}

export const REQUIRED_COLUMNS_CSV = [
  'semestre',
  'materia',
] as const;

export const REQUIRED_COLUMNS_XLSX = [
  'id_ies',
  'semestre',
  'materia',
] as const;

export const OPTIONAL_COLUMNS = [
  'tema',
  'subtema',
  'aula',
  'link_aula',
  'link_pdf',
  'link_quiz',
  'corrigido_pdf',
  'corrigido_quiz',
] as const;

export const DEFAULT_CONFIG: ImportConfig = {
  mode: 'MERGE',
  scope: 'ies_semestre',
  emptyBehavior: 'ignore',
  strictMode: false,
  dryRun: false,
};
