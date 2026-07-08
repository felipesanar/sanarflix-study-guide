/**
 * File parsing utilities for CSV and XLSX
 */

import * as XLSX from 'xlsx';
import type {
  FileType,
  ParsedFile,
  SheetInfo,
  RawRow,
  NormalizedRow,
  ValidationIssue,
  ValidationResult,
  REQUIRED_COLUMNS_CSV,
  REQUIRED_COLUMNS_XLSX,
} from '../types';
import { Logger } from '@/utils/logger';

const LOG_PREFIX = '[AdminStudyGuideImport:Parser]';

// ─── Column Alias Map ────────────────────────────────────────────────
// Maps canonical column names to all accepted aliases (already normalized: lowercase, no accents, no spaces)
const COLUMN_ALIASES: Record<string, string[]> = {
  semestre: ['semestre', 'semester', 'periodo', 'sem'],
  materia: ['materia', 'disciplina', 'discipline', 'subject'],
  tema: ['tema', 'theme', 'topic', 'modulo'],
  subtema: ['subtema', 'subtheme', 'subtopic', 'submodulo'],
  aula: ['aula', 'lesson', 'class', 'aula_nome'],
  link_aula: ['link_aula', 'linkaula', 'link_video', 'video', 'url_aula', 'urlaula'],
  link_pdf: ['link_pdf', 'linkpdf', 'corrigido_pdf', 'corrigidopdf', 'url_pdf', 'urlpdf'],
  link_quiz: ['link_quiz', 'linkquiz', 'corrigido_quiz', 'corrigidoquiz', 'url_quiz', 'urlquiz'],
  id_ies: ['id_ies', 'idies', 'ies_id', 'iesid'],
};

/**
 * Resolve a normalized header name to its canonical column name via aliases.
 */
function resolveColumnAlias(normalizedName: string): string {
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(normalizedName)) {
      return canonical;
    }
  }
  return normalizedName; // Return as-is if no alias matched
}

/**
 * Detect file type from extension
 */
export function detectFileType(file: File): FileType | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

/**
 * Detect CSV delimiter by analyzing multiple lines for consistency.
 * Supports comma, semicolon, and tab.
 */
function detectDelimiter(text: string): string {
  const candidates = [',', ';', '\t'] as const;
  const lines = text.split('\n').filter(line => line.trim()).slice(0, 10); // Analyze up to 10 lines

  if (lines.length === 0) return ',';

  // For each candidate, count fields per line and check consistency
  let bestDelimiter: string = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const fieldCounts = lines.map(line => {
      // Quick count: split by delimiter (ignoring quoted fields for speed)
      let count = 1;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === delim && !inQuotes) count++;
      }
      return count;
    });

    const headerFields = fieldCounts[0];
    if (headerFields <= 1) continue; // A delimiter that produces 1 field is useless

    // Score = number of data lines that match header field count
    const consistentLines = fieldCounts.slice(1).filter(c => c === headerFields).length;
    const score = consistentLines * 100 + headerFields; // Prefer more fields on tie

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  const delimName = bestDelimiter === '\t' ? 'TAB' : bestDelimiter;
  Logger.info(LOG_PREFIX, `Delimiter detected: "${delimName}" (score: ${bestScore})`);
  return bestDelimiter;
}

/**
 * Parse CSV text to rows
 */
function parseCSVText(text: string): { rows: Record<string, string>[]; rawHeaders: string[]; resolvedHeaders: string[] } {
  // Strip BOM
  text = text.replace(/^\uFEFF/, '');

  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length < 2) return { rows: [], rawHeaders: [], resolvedHeaders: [] };

  // Parse header
  const headerLine = lines[0];
  const rawHeaderValues = parseCSVLine(headerLine, delimiter);
  const rawHeaders = rawHeaderValues.map(h => h.trim());

  // Normalize then resolve aliases
  const resolvedHeaders = rawHeaders.map(h => {
    const normalized = normalizeColumnName(h);
    return resolveColumnAlias(normalized);
  });

  Logger.info(LOG_PREFIX, 'Raw headers:', rawHeaders);
  Logger.info(LOG_PREFIX, 'Resolved headers:', resolvedHeaders);

  // Check field count consistency between header and first data line
  if (lines.length >= 2) {
    const firstDataFields = parseCSVLine(lines[1], delimiter).length;
    if (firstDataFields !== rawHeaders.length) {
      Logger.warn(LOG_PREFIX, `⚠ Field count mismatch: header has ${rawHeaders.length} fields, first data row has ${firstDataFields} fields`);
    }
  }

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: Record<string, string> = {};

    resolvedHeaders.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    rows.push(row);
  }

  return { rows, rawHeaders, resolvedHeaders };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Normalize column name for consistency
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-]/g, '_')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^\w]/g, '');
}

/**
 * Validate that required columns exist in parsed headers.
 * Throws a descriptive error if mandatory columns are missing.
 */
function validateRequiredHeaders(resolvedHeaders: string[], rawHeaders: string[], requiredColumns: readonly string[]): void {
  const missing = requiredColumns.filter(col => !resolvedHeaders.includes(col));

  if (missing.length > 0) {
    const msg = `Colunas obrigatórias não encontradas: [${missing.join(', ')}]. ` +
      `Colunas detectadas no arquivo: [${rawHeaders.join(', ')}] → normalizadas para [${resolvedHeaders.join(', ')}]. ` +
      `Verifique o formato e o delimitador do arquivo.`;
    Logger.error(LOG_PREFIX, msg);
    throw new Error(msg);
  }
}

/**
 * Parse CSV file
 */
export async function parseCSV(file: File): Promise<{
  rows: Record<string, string>[];
  sheetInfo: SheetInfo;
}> {
  Logger.info(LOG_PREFIX, 'Parsing CSV:', file.name);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { rows, rawHeaders, resolvedHeaders } = parseCSVText(text);

        // Validate required columns for CSV
        validateRequiredHeaders(resolvedHeaders, rawHeaders, ['semestre', 'materia']);

        const sheetInfo: SheetInfo = {
          name: file.name.replace(/\.[^.]+$/, ''),
          rowCount: rows.length,
          mappedIesId: null,
          mappedIesName: null,
          autoMatched: false,
        };

        Logger.info(LOG_PREFIX, `Parsed ${rows.length} rows from CSV`);
        resolve({ rows, sheetInfo });
      } catch (error) {
        Logger.error(LOG_PREFIX, 'CSV parse error:', error);
        reject(error instanceof Error ? error : new Error('Falha ao processar arquivo CSV'));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Normalize text for fuzzy matching (removes accents, lowercase, remove common suffixes)
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[\s\-_]/g, '') // Remove spaces, dashes, underscores
    .replace(/[^\w]/g, '') // Remove special chars
    .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein-inspired approach with prefix/contains bonuses
 */
function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);

  // Exact match (after normalization)
  if (normA === normB) return 1.0;

  // One contains the other entirely
  if (normA.includes(normB) || normB.includes(normA)) {
    const longer = Math.max(normA.length, normB.length);
    const shorter = Math.min(normA.length, normB.length);
    return 0.8 + (shorter / longer) * 0.2;
  }

  // Prefix match
  const minLen = Math.min(normA.length, normB.length);
  let prefixMatch = 0;
  for (let i = 0; i < minLen; i++) {
    if (normA[i] === normB[i]) {
      prefixMatch++;
    } else {
      break;
    }
  }

  if (prefixMatch >= 3) {
    return 0.6 + (prefixMatch / Math.max(normA.length, normB.length)) * 0.3;
  }

  // Simple character overlap score
  const setA = new Set(normA.split(''));
  const setB = new Set(normB.split(''));
  let overlap = 0;
  setA.forEach(c => { if (setB.has(c)) overlap++; });

  const overlapScore = overlap / Math.max(setA.size, setB.size);

  return overlapScore * 0.5;
}

/**
 * Find best matching IES for a sheet name
 */
export function findBestIesMatch(
  sheetName: string, 
  iesList: Array<{ id: string; nome: string }>
): { iesId: string | null; iesName: string | null; score: number } {
  if (!iesList.length) return { iesId: null, iesName: null, score: 0 };
  
  let bestMatch: { iesId: string; iesName: string; score: number } | null = null;
  
  for (const ies of iesList) {
    const score = calculateSimilarity(sheetName, ies.nome);
    
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { iesId: ies.id, iesName: ies.nome, score };
    }
  }
  
  // Only return if score is high enough (>= 0.7 = strong match)
  if (bestMatch && bestMatch.score >= 0.7) {
    return bestMatch;
  }
  
  return { iesId: null, iesName: null, score: 0 };
}

/**
 * Fill down empty cells in key columns to handle merged cells in Excel.
 */
function fillDownMergedCells(rows: Record<string, string>[], headers: string[]): void {
  const FILL_DOWN_COLUMNS = ['semestre', 'id_ies', 'idies', 'materia'];
  const columnsToFill = FILL_DOWN_COLUMNS.filter(col => headers.includes(col));
  
  if (columnsToFill.length === 0) return;
  
  const lastValues: Record<string, string> = {};
  const consecutiveEmpty: Record<string, number> = {};
  const MAX_CONSECUTIVE_FILL = 50;
  let filledCount = 0;
  
  for (const row of rows) {
    // Check if entire row is empty — reset fill-down state (section separator)
    const allEmpty = Object.values(row).every(v => !v || v.trim() === '');
    if (allEmpty) {
      // Reset all tracked values — this row is a separator between sections
      for (const col of columnsToFill) {
        delete lastValues[col];
        consecutiveEmpty[col] = 0;
      }
      continue;
    }
    
    for (const col of columnsToFill) {
      const val = row[col];
      if (val && val.trim() !== '') {
        lastValues[col] = val;
        consecutiveEmpty[col] = 0;
      } else if (lastValues[col]) {
        consecutiveEmpty[col] = (consecutiveEmpty[col] || 0) + 1;
        if (consecutiveEmpty[col] <= MAX_CONSECUTIVE_FILL) {
          row[col] = lastValues[col];
          filledCount++;
        } else {
          // Exceeded limit — stop propagating this column
          Logger.warn(LOG_PREFIX, `Fill-down limit reached for column "${col}" after ${MAX_CONSECUTIVE_FILL} consecutive empty rows`);
          delete lastValues[col];
        }
      }
    }
  }
  
  if (filledCount > 0) {
    Logger.info(LOG_PREFIX, `Fill-down: ${filledCount} empty cells filled across columns [${columnsToFill.join(', ')}]`);
  }
}

/**
 * Parse XLSX file with multiple sheets
 */
export async function parseXLSX(
  file: File,
  iesList?: Array<{ id: string; nome: string }>
): Promise<{
  sheets: Array<{
    name: string;
    rows: Record<string, string>[];
    sheetInfo: SheetInfo;
  }>;
}> {
  Logger.info(LOG_PREFIX, 'Parsing XLSX:', file.name);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheets: Array<{
          name: string;
          rows: Record<string, string>[];
          sheetInfo: SheetInfo;
        }> = [];
        
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });
          
          if (jsonData.length < 2) continue;
          
          // First row as headers — normalize then resolve aliases
          const headerRow = jsonData[0] as unknown[];
          const headers = headerRow.map(h => {
            const normalized = normalizeColumnName(String(h || '').trim());
            return resolveColumnAlias(normalized);
          });

          // Valida colunas obrigatórias por aba (item 7 da auditoria): sem isso, uma aba com
          // cabeçalho errado/desalinhado gera dezenas de erros INVALID_SEMESTRE/MISSING_MATERIA
          // linha a linha em vez de um erro estrutural único e claro apontando a aba e as colunas
          // faltantes. id_ies NÃO entra na checagem porque pode ser resolvido via fuzzy match pelo
          // nome da aba (ver findBestIesMatch abaixo), então nem toda aba precisa ter essa coluna.
          const rawHeadersForSheet = headerRow.map(h => String(h || '').trim());
          try {
            validateRequiredHeaders(headers, rawHeadersForSheet, ['semestre', 'materia']);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Aba "${sheetName}": ${msg}`);
          }

          // Parse data rows
          const rows: Record<string, string>[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const values = jsonData[i] as unknown[];
            const row: Record<string, string> = {};
            
            headers.forEach((header, index) => {
              if (header) {
                row[header] = String(values[index] || '').trim();
              }
            });
            
            // Skip completely empty rows
            if (Object.values(row).some(v => v)) {
              rows.push(row);
            }
          }
          
          // Fill down merged cells for key columns
          fillDownMergedCells(rows, headers);
          
          // Try to auto-match IES from first row's id_ies (UUID)
          let mappedIesId: string | null = rows[0]?.id_ies || null;
          let mappedIesName: string | null = null;
          let autoMatched = !!mappedIesId;
          
          // If no direct ID match, try fuzzy match by sheet name
          if (!mappedIesId && iesList && iesList.length > 0) {
            const match = findBestIesMatch(sheetName, iesList);
            if (match.iesId) {
              mappedIesId = match.iesId;
              mappedIesName = match.iesName;
              autoMatched = true;
              Logger.info(LOG_PREFIX, `Auto-matched sheet "${sheetName}" to IES "${match.iesName}" (score: ${match.score.toFixed(2)})`);
            }
          }
          
          sheets.push({
            name: sheetName,
            rows,
            sheetInfo: {
              name: sheetName,
              rowCount: rows.length,
              mappedIesId,
              mappedIesName,
              autoMatched,
            },
          });
        }
        
        Logger.info(LOG_PREFIX, `Parsed ${sheets.length} sheets from XLSX`);
        resolve({ sheets });
      } catch (error) {
        Logger.error(LOG_PREFIX, 'XLSX parse error:', error);
        reject(new Error('Falha ao processar arquivo XLSX'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalize a single row value
 */
function normalizeValue(value: string | null | undefined): string | null {
  if (!value || value === '-' || value === 'null' || value === 'undefined') {
    return null;
  }
  
  // Trim and normalize spaces
  let normalized = value.trim().replace(/\s+/g, ' ');
  
  // Fix URL escaping from XLSX (e.g., https\:// -> https://)
  normalized = normalized.replace(/\\:/g, ':');
  
  return normalized || null;
}

/**
 * Normalize URL format
 */
function normalizeUrl(url: string | null | undefined): string | null {
  const normalized = normalizeValue(url);
  if (!normalized) return null;
  
  // Ensure proper URL format
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  
  return null;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string | null): boolean {
  if (!url) return true; // null is valid (optional field)
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a semester value for comparison purposes.
 */
export function normalizeSemestreForCompare(value: string): string {
  return value
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2060\u2028\u2029]/g, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normalize a semester value for storage.
 */
function normalizeSemestreForStorage(value: string): string {
  const cleaned = value
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2060\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const num = parseInt(cleaned, 10);
  if (!isNaN(num) && num >= 1 && String(num) === cleaned) {
    return String(num);
  }
  
  // Text-based semester: store in UPPERCASE, trimmed
  return cleaned.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Validate and normalize raw rows
 */
export function validateAndNormalize(
  rawRows: Record<string, string>[],
  iesId: string,
  sheetName?: string,
  existingSemestres?: string[]
): ValidationResult {
  Logger.info(LOG_PREFIX, `Validating ${rawRows.length} rows for IES ${iesId}`);
  
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const normalizedData: NormalizedRow[] = [];
  
  // Build a set of existing semesters (normalized for comparison)
  const existingNormalized = new Set(
    (existingSemestres || []).map(s => normalizeSemestreForCompare(s))
  );
  const newSemestresSet = new Set<string>();
  
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header + 1-indexed
    
    // Required: semestre
    const semestreRaw = row.semestre || row.semester;
    const semestreStr = String(semestreRaw || '')
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2060\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!semestreStr) {
      errors.push({
        rowNumber,
        sheetName,
        field: 'semestre',
        severity: 'error',
        code: 'INVALID_SEMESTRE',
        message: `Semestre vazio na linha ${rowNumber}. O campo é obrigatório.`,
        invalidValue: String(semestreRaw || ''),
      });
      return; // Skip this row
    }
    
    // Detect URL in semestre field (indicates column misalignment)
    if (semestreStr.includes('http://') || semestreStr.includes('https://')) {
      errors.push({
        rowNumber,
        sheetName,
        field: 'semestre',
        severity: 'error',
        code: 'URL_IN_SEMESTRE',
        message: `O campo semestre contém uma URL ("${semestreStr.substring(0, 60)}..."). Verifique se as colunas do arquivo estão alinhadas corretamente.`,
        invalidValue: semestreStr.substring(0, 100),
      });
      return;
    }
    
    const semestreStorage = normalizeSemestreForStorage(semestreStr);
    const semestreCompare = normalizeSemestreForCompare(semestreStr);
    
    // Check if this is a new semester (only when existingSemestres is provided)
    if (existingSemestres && !existingNormalized.has(semestreCompare)) {
      newSemestresSet.add(semestreStorage);
    }
    
    // Required: materia
    const materia = normalizeValue(row.materia);
    if (!materia) {
      errors.push({
        rowNumber,
        sheetName,
        field: 'materia',
        severity: 'error',
        code: 'MISSING_MATERIA',
        message: 'Campo matéria é obrigatório.',
        invalidValue: '',
      });
      return;
    }
    
    // Optional fields
    const tema = normalizeValue(row.tema);
    const subtema = normalizeValue(row.subtema);
    const aula = normalizeValue(row.aula);
    
    // URL fields
    const linkAula = normalizeUrl(row.link_aula);
    const linkPdf = normalizeUrl(row.link_pdf);
    const linkQuiz = normalizeUrl(row.link_quiz);
    
    // Validate URLs
    if (linkAula && !isValidUrl(linkAula)) {
      warnings.push({
        rowNumber,
        sheetName,
        field: 'link_aula',
        severity: 'warning',
        code: 'INVALID_URL',
        message: `URL de aula inválida: "${linkAula?.substring(0, 50)}..."`,
        invalidValue: linkAula?.substring(0, 100) || '',
      });
    }
    
    // Check for empty row (only required fields filled)
    if (!tema && !subtema && !aula && !linkAula) {
      warnings.push({
        rowNumber,
        sheetName,
        field: '*',
        severity: 'warning',
        code: 'SPARSE_ROW',
        message: 'Linha com poucos dados preenchidos.',
        invalidValue: undefined,
      });
    }
    
    // Add normalized row
    normalizedData.push({
      rowNumber,
      sheetName,
      id_ies: iesId,
      semestre: semestreStorage,
      materia,
      tema,
      subtema,
      aula,
      link_aula: linkAula,
      link_pdf: linkPdf,
      link_quiz: linkQuiz,
    });
  });
  
  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: number[] = [];
  
  normalizedData.forEach((row) => {
    const key = `${row.id_ies}|${row.semestre}|${row.materia}|${row.tema}|${row.subtema}|${row.aula}`;
    if (seen.has(key)) {
      duplicates.push(row.rowNumber);
    } else {
      seen.add(key);
    }
  });
  
  duplicates.forEach((rowNumber) => {
    warnings.push({
      rowNumber,
      sheetName,
      field: '*',
      severity: 'warning',
      code: 'DUPLICATE_ROW',
      message: 'Linha duplicada encontrada (será ignorada se modo MERGE).',
      invalidValue: undefined,
    });
  });
  
  const result: ValidationResult = {
    isValid: errors.length === 0,
    totalRows: rawRows.length,
    validRows: normalizedData.length,
    errors,
    warnings,
    normalizedData,
    newSemestres: Array.from(newSemestresSet).map(s => ({
      semestre: s,
      iesId,
      iesNome: '',
    })),
  };
  
  Logger.info(LOG_PREFIX, `Validation complete: ${result.validRows} valid, ${errors.length} errors, ${warnings.length} warnings`);
  
  return result;
}

/**
 * Generate error report as CSV
 */
export function generateErrorReport(issues: ValidationIssue[]): string {
  const headers = ['row_number', 'sheet_name', 'field', 'severity', 'code', 'message', 'invalid_value'];
  const rows = issues.map(issue => [
    String(issue.rowNumber),
    issue.sheetName || '',
    issue.field,
    issue.severity,
    issue.code,
    `"${issue.message.replace(/"/g, '""')}"`,
    `"${(issue.invalidValue || '').replace(/"/g, '""')}"`,
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Download text as file
 */
export function downloadAsFile(content: string, filename: string, type: string = 'text/csv'): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
