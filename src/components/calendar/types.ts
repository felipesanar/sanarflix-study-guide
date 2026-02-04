// ============================================
// Study Calendar Types
// DO NOT modify business logic or data structure
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  materia: string;
  day: number; // 0-6 (domingo-sábado)
  startTime: string;
  endTime: string;
  color: string;
}

export interface CalendarSubjectDraggable {
  name: string;
  color: string;
  icon: string;
  category?: string; // e.g., "ANATOMIA", "FISIOLOGIA"
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

export interface CalendarEditorState {
  isDragging: boolean;
  draggedItem: string | null;
  dragOverDay: number | null;
  searchQuery: string;
  selectedDay: number; // For mobile
  undoStack: CalendarEvent[][];
  syncStatus: SyncStatus;
}

export const DAY_NAMES_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
export const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Color palette for subjects
export const SUBJECT_COLORS = [
  '#4361ee', '#3a0ca3', '#7209b7', '#f72585', 
  '#4cc9f0', '#4895ef', '#560bad', '#f3722c',
  '#06d6a0', '#118ab2', '#073b4c', '#ff006e'
];

// Get consistent color based on subject name
export const getMateriaColor = (materia: string): string => {
  let hash = 0;
  for (let i = 0; i < materia.length; i++) {
    hash = materia.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

// Get emoji icon based on subject name
export const getMateriaIcon = (materia: string): string => {
  const lower = materia.toLowerCase();
  if (lower.includes('anatomia')) return '🧠';
  if (lower.includes('fisiologia')) return '❤️';
  if (lower.includes('bioquímica')) return '🧪';
  if (lower.includes('farmacologia')) return '💊';
  if (lower.includes('patologia')) return '🔬';
  if (lower.includes('clínica')) return '🩺';
  if (lower.includes('cirurgia')) return '⚕️';
  if (lower.includes('pediatria')) return '👶';
  if (lower.includes('ginecologia')) return '🤰';
  if (lower.includes('microbiologia')) return '🦠';
  if (lower.includes('imunologia')) return '🛡️';
  if (lower.includes('parasitologia')) return '🦟';
  if (lower.includes('histologia')) return '🔬';
  if (lower.includes('embriologia')) return '👶';
  return '📚';
};

// Get category from subject name
export const getMateriaCategory = (materia: string): string => {
  const lower = materia.toLowerCase();
  if (lower.includes('anatomia')) return 'ANATOMIA';
  if (lower.includes('fisiologia')) return 'FISIOLOGIA';
  if (lower.includes('bioquímica')) return 'BIOQUÍMICA';
  if (lower.includes('farmacologia')) return 'FARMACOLOGIA';
  if (lower.includes('patologia')) return 'PATOLOGIA';
  if (lower.includes('histologia')) return 'HISTOLOGIA';
  if (lower.includes('imunologia')) return 'IMUNOLOGIA';
  if (lower.includes('clínica')) return 'CLÍNICA';
  return 'GERAL';
}
