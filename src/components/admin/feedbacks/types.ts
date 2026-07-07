import type { FeedbackCategory, FeedbackStatus } from './feedbackMeta';

/** Linha de `user_feedback` (ver `src/integrations/supabase/types.ts`). */
export interface FeedbackRow {
  id: string;
  user_id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  admin_response: string | null;
  responded_at: string | null;
  screenshot_url: string | null;
  page_url: string | null;
  viewport: string | null;
  user_agent: string | null;
  ies_id: string | null;
  semestre: number | null;
  user_role: string | null;
  created_at: string;
}

export interface FeedbackUserInfo {
  nome: string;
  email: string;
}
