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

const LOG_PREFIX = '[AdminStudyGuideImport:Parser]';

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
 * Detect CSV delimiter (comma or semicolon)
 */
function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse CSV text to rows
 */
function parseCSVText(text: string): Record<string, string>[] {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine, delimiter).map(h => 
    normalizeColumnName(h.trim())
  );

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    rows.push(row);
  }

  return rows;
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
 * Parse CSV file
 */
export async function parseCSV(file: File): Promise<{
  rows: Record<string, string>[];
  sheetInfo: SheetInfo;
}> {
  console.log(LOG_PREFIX, 'Parsing CSV:', file.name);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSVText(text);
        
        const sheetInfo: SheetInfo = {
          name: file.name.replace(/\.[^.]+$/, ''),
          rowCount: rows.length,
          mappedIesId: null,
          mappedIesName: null,
          autoMatched: false,
        };
        
        console.log(LOG_PREFIX, `Parsed ${rows.length} rows from CSV`);
        resolve({ rows, sheetInfo });
      } catch (error) {
        console.error(LOG_PREFIX, 'CSV parse error:', error);
        reject(new Error('Falha ao processar arquivo CSV'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Parse XLSX file with multiple sheets
 */
export async function parseXLSX(file: File): Promise<{
  sheets: Array<{
    name: string;
    rows: Record<string, string>[];
    sheetInfo: SheetInfo;
  }>;
}> {
  console.log(LOG_PREFIX, 'Parsing XLSX:', file.name);
  
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
          
          // First row as headers
          const headerRow = jsonData[0] as unknown[];
          const headers = headerRow.map(h => 
            normalizeColumnName(String(h || '').trim())
          );
          
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
          
          // Try to auto-match IES from first row's id_ies
          const firstRowIesId = rows[0]?.id_ies || rows[0]?.idies || null;
          
          sheets.push({
            name: sheetName,
            rows,
            sheetInfo: {
              name: sheetName,
              rowCount: rows.length,
              mappedIesId: firstRowIesId,
              mappedIesName: null,
              autoMatched: !!firstRowIesId,
            },
          });
        }
        
        console.log(LOG_PREFIX, `Parsed ${sheets.length} sheets from XLSX`);
        resolve({ sheets });
      } catch (error) {
        console.error(LOG_PREFIX, 'XLSX parse error:', error);
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
 * Validate and normalize raw rows
 */
export function validateAndNormalize(
  rawRows: Record<string, string>[],
  iesId: string,
  sheetName?: string
): ValidationResult {
  console.log(LOG_PREFIX, `Validating ${rawRows.length} rows for IES ${iesId}`);
  
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const normalizedData: NormalizedRow[] = [];
  
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header + 1-indexed
    
    // Required: semestre
    const semestreRaw = row.semestre || row.semester;
    const semestreNum = parseInt(String(semestreRaw), 10);
    
    if (!semestreRaw || isNaN(semestreNum) || semestreNum < 1 || semestreNum > 12) {
      errors.push({
        rowNumber,
        sheetName,
        field: 'semestre',
        severity: 'error',
        code: 'INVALID_SEMESTRE',
        message: `Semestre inválido: "${semestreRaw}". Deve ser um número entre 1 e 12.`,
      });
      return; // Skip this row
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
      });
      return;
    }
    
    // Optional fields
    const tema = normalizeValue(row.tema);
    const subtema = normalizeValue(row.subtema);
    const aula = normalizeValue(row.aula);
    
    // URL fields (accept both naming conventions)
    const linkAula = normalizeUrl(row.link_aula || row.linkaula);
    const linkPdf = normalizeUrl(row.link_pdf || row.linkpdf || row.corrigido_pdf || row.corrigidopdf);
    const linkQuiz = normalizeUrl(row.link_quiz || row.linkquiz || row.corrigido_quiz || row.corrigidoquiz);
    
    // Validate URLs
    if (linkAula && !isValidUrl(linkAula)) {
      warnings.push({
        rowNumber,
        sheetName,
        field: 'link_aula',
        severity: 'warning',
        code: 'INVALID_URL',
        message: `URL de aula inválida: "${linkAula?.substring(0, 50)}..."`,
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
      });
    }
    
    // Add normalized row
    normalizedData.push({
      rowNumber,
      sheetName,
      id_ies: iesId,
      semestre: String(semestreNum),
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
    });
  });
  
  const result: ValidationResult = {
    isValid: errors.length === 0,
    totalRows: rawRows.length,
    validRows: normalizedData.length,
    errors,
    warnings,
    normalizedData,
  };
  
  console.log(LOG_PREFIX, `Validation complete: ${result.validRows} valid, ${errors.length} errors, ${warnings.length} warnings`);
  
  return result;
}

/**
 * Generate error report as CSV
 */
export function generateErrorReport(issues: ValidationIssue[]): string {
  const headers = ['row_number', 'sheet_name', 'field', 'severity', 'code', 'message'];
  const rows = issues.map(issue => [
    String(issue.rowNumber),
    issue.sheetName || '',
    issue.field,
    issue.severity,
    issue.code,
    `"${issue.message.replace(/"/g, '""')}"`,
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
