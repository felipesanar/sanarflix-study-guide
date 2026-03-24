/**
 * useActiveSemester - Single source of truth for semester scoping
 * 
 * CRITICAL: The Progress Dashboard and all related components must use ONLY
 * content from the student's current semester. This hook provides the active
 * semester and validation utilities.
 * 
 * Rules:
 * - Dashboard is ALWAYS scoped to user.semestre
 * - Study Guide may allow navigation to other semesters, but Progress is locked
 * - If user.semestre is undefined/null, fallback with warning
 */

import { useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logger from '@/utils/logger';

export interface ActiveSemesterContext {
  /** The student's current semester (single source of truth for progress) */
  semestreAtivo: number | null;
  /** Whether the semester is valid and available */
  isValid: boolean;
  /** Warning message if semester is undefined or fallback was used */
  warning: string | null;
  /** Filter function to scope content by semester */
  filterBySemester: <T extends { semestre?: number | string }>(items: T[]) => T[];
  /** Check if a content_id belongs to the active semester (for composite IDs) */
  isContentFromActiveSemester: (contentId: string) => boolean;
  /** Extract semester from composite content_id */
  extractSemestreFromContentId: (contentId: string) => number | null;
}

/**
 * Extracts semester number from a composite content_id
 * Format: "semestre-materia-tema-subtema-aula"
 * Example: "3-Anatomia-Sistema Nervoso-..." → 3
 */
function extractSemestre(contentId: string): number | null {
  if (!contentId) return null;
  
  // Try parsing as number (legacy UUID-based IDs won't parse)
  const parts = contentId.split('-');
  if (parts.length >= 1) {
    const firstPart = parseInt(parts[0], 10);
    if (!isNaN(firstPart) && firstPart >= 1 && firstPart <= 12) {
      return firstPart;
    }
  }
  
  return null;
}

export function useActiveSemester(): ActiveSemesterContext {
  const { user } = useAuth();

  const context = useMemo<ActiveSemesterContext>(() => {
    // Primary: user's semester from auth
    let semestreAtivo: number | null = null;
    let warning: string | null = null;
    let isValid = false;

    if (user?.semestre && typeof user.semestre === 'number' && user.semestre >= 1) {
      semestreAtivo = user.semestre;
      isValid = true;
    } else {
      // Fallback: no semester defined
      warning = 'Semestre não definido para o usuário. Usando fallback.';
      semestreAtivo = 1; // Safe fallback
      Logger.warn('useActiveSemester: Semester not defined for user', { 
        userId: user?.id, 
        semestre: user?.semestre 
      });
    }

    /**
     * Filter items by the active semester
     * Works with objects that have a `semestre` property (number or string)
     */
    const filterBySemester = <T extends { semestre?: number | string }>(items: T[]): T[] => {
      if (!semestreAtivo) return items;
      
      return items.filter(item => {
        if (item.semestre === undefined || item.semestre === null) return false;
        
        // Handle string semestre (e.g., "3" or "3º")
        const itemSemestre = typeof item.semestre === 'string' 
          ? parseInt(item.semestre.replace(/[^\d]/g, ''), 10)
          : item.semestre;
        
        return itemSemestre === semestreAtivo;
      });
    };

    /**
     * Check if a composite content_id belongs to the active semester
     */
    const isContentFromActiveSemester = (contentId: string): boolean => {
      if (!semestreAtivo) return false;
      
      const extractedSemestre = extractSemestre(contentId);
      
      // If we can't extract semester (UUID-based legacy ID), assume it's valid
      // The backend should handle this filtering
      if (extractedSemestre === null) return true;
      
      return extractedSemestre === semestreAtivo;
    };

    return {
      semestreAtivo,
      isValid,
      warning,
      filterBySemester,
      isContentFromActiveSemester,
      extractSemestreFromContentId: extractSemestre,
    };
  }, [user?.id, user?.semestre]);

  return context;
}

/**
 * Utility function to filter progress records by semester
 * Used when we have content IDs and need to validate they belong to the active semester
 * 
 * @param progressRecords - Array of progress records with content_id
 * @param semestreAtivo - The active semester to filter by
 * @param allContents - All contents for cross-referencing (optional, for UUID-based IDs)
 */
export function filterProgressBySemester<T extends { content_id: string }>(
  progressRecords: T[],
  semestreAtivo: number,
  allContents?: { id: string; semestre?: number | string }[]
): T[] {
  if (!semestreAtivo) return progressRecords;

  // Build a Set of valid content IDs from the semester
  const validContentIds = new Set<string>();
  
  if (allContents) {
    for (const content of allContents) {
      const contentSemestre = typeof content.semestre === 'string'
        ? parseInt(content.semestre.replace(/[^\d]/g, ''), 10)
        : content.semestre;
      
      if (contentSemestre === semestreAtivo) {
        validContentIds.add(content.id);
        
        // Also add composite ID format
        // This assumes we have access to the full content structure
      }
    }
  }

  return progressRecords.filter(record => {
    // Method 1: Check if content_id is a valid UUID from the semester
    if (validContentIds.has(record.content_id)) return true;
    
    // Method 2: Extract semester from composite content_id
    const extractedSemestre = extractSemestre(record.content_id);
    if (extractedSemestre !== null) {
      return extractedSemestre === semestreAtivo;
    }
    
    // Method 3: If we can't determine, include it (backend should filter)
    // This is a safe fallback for legacy data
    return validContentIds.size === 0;
  });
}
