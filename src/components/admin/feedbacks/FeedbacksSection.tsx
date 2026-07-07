import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/services/admin/logAction';
import { AdminSectionHeader } from '@/experiences/admin/ui/AdminSectionHeader';
import { AdminLoading } from '@/experiences/admin/ui/AdminLoading';
import { AdminError } from '@/experiences/admin/ui/AdminError';
import { AdminEmpty } from '@/experiences/admin/ui/AdminEmpty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackStatCards } from './FeedbackStatCards';
import { FeedbackList } from './FeedbackList';
import { FeedbackDetailSheet } from './FeedbackDetailSheet';
import {
  FEEDBACK_CATEGORY_META,
  FEEDBACK_CATEGORY_ORDER,
  FEEDBACK_STATUS_META,
  FEEDBACK_STATUS_ORDER,
  type FeedbackCategory,
  type FeedbackStatus,
} from './feedbackMeta';
import type { FeedbackRow, FeedbackUserInfo } from './types';

type LoadState = 'loading' | 'error' | 'ready';

/**
 * Seção Feedbacks (`/admin/feedbacks` e `/atendimento/feedbacks` — mesmo
 * componente, RLS de `user_feedback` recorta o que cada portal vê).
 * StatCards por categoria + filtros + lista → Sheet de detalhe/resposta.
 */
export function FeedbacksSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [users, setUsers] = useState<Record<string, FeedbackUserInfo>>({});
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all');
  const [selected, setSelected] = useState<FeedbackRow | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      setState('error');
      return;
    }
    const feedbackRows = (data ?? []) as FeedbackRow[];
    setRows(feedbackRows);

    const uids = Array.from(new Set(feedbackRows.map((r) => r.user_id)));
    if (uids.length) {
      const { data: us } = await supabase.from('users').select('id, nome, email').in('id', uids);
      const map: Record<string, FeedbackUserInfo> = {};
      (us ?? []).forEach((u) => {
        map[u.id] = { nome: u.nome ?? '—', email: u.email ?? '—' };
      });
      setUsers(map);
    } else {
      setUsers({});
    }
    setState('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (q) {
        const u = users[r.user_id];
        const hay = `${r.message} ${u?.nome ?? ''} ${u?.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, categoryFilter, users]);

  const counts = useMemo(() => {
    const c: Record<FeedbackCategory, number> = { bug: 0, suggestion: 0, feature_request: 0, praise: 0 };
    rows.forEach((r) => {
      c[r.category] += 1;
    });
    return c;
  }, [rows]);

  const handleSave = async (feedback: FeedbackRow, next: { status: FeedbackStatus; resposta: string }) => {
    const respostaTrimmed = next.resposta.trim();
    const payload: {
      status: FeedbackStatus;
      admin_response: string | null;
      responded_by?: string;
      responded_at?: string;
    } = {
      status: next.status,
      admin_response: respostaTrimmed || null,
    };
    const respondeu = respostaTrimmed.length > 0;
    if (respondeu && respostaTrimmed !== (feedback.admin_response ?? '') && user?.id) {
      payload.responded_by = user.id;
      payload.responded_at = new Date().toISOString();
    }

    const { error } = await supabase.from('user_feedback').update(payload).eq('id', feedback.id);
    if (error) {
      toast.error('Não foi possível salvar o feedback.');
      throw error;
    }

    toast.success('Feedback atualizado.');
    await logAdminAction('feedback_update', feedback.user_id, {
      feedback_id: feedback.id,
      status: next.status,
      respondeu,
    });
    setSelected(null);
    load();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Feedbacks"
        subtitle="Triagem do feedback dos alunos: bug, sugestão, funcionalidade e elogio."
      />

      {state === 'loading' && <AdminLoading rows={6} />}
      {state === 'error' && <AdminError message="Não foi possível carregar os feedbacks." onRetry={load} />}

      {state === 'ready' && (
        <>
          <FeedbackStatCards counts={counts} />

          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por texto, nome ou e-mail…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | FeedbackStatus)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {FEEDBACK_STATUS_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FEEDBACK_STATUS_META[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as 'all' | FeedbackCategory)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {FEEDBACK_CATEGORY_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FEEDBACK_CATEGORY_META[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <AdminEmpty
              title="Nenhum feedback com esses filtros"
              description="Ajuste a busca ou os filtros para ver outros resultados."
            />
          ) : (
            <FeedbackList rows={filtered} users={users} onSelect={setSelected} />
          )}
        </>
      )}

      <FeedbackDetailSheet
        feedback={selected}
        userInfo={selected ? users[selected.user_id] : undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

export default FeedbacksSection;
