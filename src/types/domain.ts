/**
 * Type aliases de alto nível para entidades do domínio.
 *
 * O arquivo gerado src/integrations/supabase/types.ts (~2199 linhas) é
 * exaustivo mas verboso. Este módulo expõe aliases curtos por domínio,
 * facilitando substituir `as any` em consumers.
 *
 * Padrão: derive sempre do schema gerado (não duplique). Quando o
 * schema mudar, este arquivo recompila automaticamente.
 *
 * Uso:
 *   import type { User, CalendarSubject, Simulado } from '@/types/domain';
 */
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
type RpcReturn<K extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][K]['Returns'];

// ─── Usuários ────────────────────────────────────────────────────────────────
export type UserRow = Tables['users']['Row'];
export type UserInsert = Tables['users']['Insert'];
export type UserUpdate = Tables['users']['Update'];

export type UserRoleRow = Tables['user_roles']['Row'];

// ─── IES ─────────────────────────────────────────────────────────────────────
export type IesRow = Tables['ies']['Row'];

// ─── Calendário ──────────────────────────────────────────────────────────────
export type CalendarSubjectRow = Tables['calendar_subjects']['Row'];
export type CalendarArrangementRow = Tables['calendar_arrangements']['Row'];

// ─── Simulados ───────────────────────────────────────────────────────────────
export type SimuladoIniciadoRow = Tables['simulados_iniciados']['Row'];
export type SimuladoFinalizadoRow = Tables['simulados_finalizados']['Row'];

// ─── Progresso / estudo ──────────────────────────────────────────────────────
export type StudyProgressRow = Tables['study_progress']['Row'];

// ─── Notas:
// - Não exportar TUDO daqui. Apenas tipos consumidos em components/services
//   recorrentes. Para RPCs específicas, derive in-place no service:
//     type X = RpcReturn<'rpc_name'>
// - Quando uma RPC não está em types.ts (sometimes migrations não foram
//   regeradas), usar `as unknown as Y` é aceitável — mas adicionar a RPC
//   ao schema é o fix preferido.
// ─────────────────────────────────────────────────────────────────────────────
