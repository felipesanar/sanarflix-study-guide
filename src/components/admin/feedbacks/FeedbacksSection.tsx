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

/** Teto da lista principal — mesma janela usada para o aviso de "mostrando os N mais recentes". */
const FEEDBACK_LIST_LIMIT = 500;

/**
 * Tamanho do lote para o lookup de nomes/e-mails em `users`. Nunca um `.in()` gigante
 * com todos os `user_id` de uma vez — a URL estoura (mesma classe do bug histórico
 * "Nome não disponível"). Padrão de referência: `LiberacoesTab.tsx`.
 */
const USERS_BATCH_SIZE = 200;

/**
 * Seção Feedbacks (`/admin/feedbacks` e `/atendimento/feedbacks` — mesmo
 * componente, RLS de `user_feedback` recorta o que cada portal vê).
 * StatCards por categoria + filtros + lista → Sheet de detalhe/resposta.
 */
export function FeedbacksSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [users, setUsers] = useState<Record<string, FeedbackUserInfo>>({});
  const [usersLookupPartial, setUsersLookupPartial] = useState(false);
  const [counts, setCounts] = useState<Record<FeedbackCategory, number>>({
    bug: 0,
    suggestion: 0,
    feature_request: 0,
    praise: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all');
  const [selected, setSelected] = useState<FeedbackRow | null>(null);

  const load = useCallback(async () => {
    setState('loading');

    // Lista (janela dos mais recentes) e contagens reais por categoria em paralelo — as
    // contagens usam `count: 'exact', head: true` para bater com o Command Center em vez
    // de refletir só os FEEDBACK_LIST_LIMIT carregados na lista.
    const [listResult, countResults] = await Promise.all([
      supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(FEEDBACK_LIST_LIMIT),
      Promise.all(
        FEEDBACK_CATEGORY_ORDER.map((cat) =>
          supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', cat),
        ),
      ),
    ]);

    if (listResult.error) {
      setState('error');
      return;
    }
    const feedbackRows = (listResult.data ?? []) as FeedbackRow[];
    setRows(feedbackRows);

    const nextCounts: Record<FeedbackCategory, number> = { bug: 0, suggestion: 0, feature_request: 0, praise: 0 };
    FEEDBACK_CATEGORY_ORDER.forEach((cat, i) => {
      const result = countResults[i];
      // Falha isolada de uma contagem: cai para a contagem da janela carregada em vez de
      // mostrar 0 (best-effort — a contagem real volta a valer na próxima carga com sucesso).
      nextCounts[cat] = result.error
        ? feedbackRows.filter((r) => r.category === cat).length
        : (result.count ?? 0);
    });
    setCounts(nextCounts);
    setTotalCount(Object.values(nextCounts).reduce((sum, n) => sum + n, 0));

    const uids = Array.from(new Set(feedbackRows.map((r) => r.user_id)));
    if (uids.length) {
      const batches: string[][] = [];
      for (let i = 0; i < uids.length; i += USERS_BATCH_SIZE) {
        batches.push(uids.slice(i, i + USERS_BATCH_SIZE));
      }
      const usersResults = await Promise.all(
        batches.map((batch) => supabase.from('users').select('id, nome, email').in('id', batch)),
      );
      const map: Record<string, FeedbackUserInfo> = {};
      let partial = false;
      usersResults.forEach((r) => {
        if (r.error) {
          partial = true;
          return;
        }
        (r.data ?? []).forEach((u) => {
          map[u.id] = { nome: u.nome ?? '—', email: u.email ?? '—' };
        });
      });
      setUsers(map);
      setUsersLookupPartial(partial);
    } else {
      setUsers({});
      setUsersLookupPartial(false);
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

  const handleSave = async (feedback: FeedbackRow, next: { status: FeedbackStatus; resposta: string }) => {
    const respostaTrimmed = next.resposta.trim();
    const respostaAnterior = (feedback.admin_response ?? '').trim();
    const textoMudou = respostaTrimmed !== respostaAnterior;

    const payload: {
      status: FeedbackStatus;
      admin_response: string | null;
      responded_by?: string | null;
      responded_at?: string | null;
    } = {
      status: next.status,
      admin_response: respostaTrimmed || null,
    };

    if (!respostaTrimmed) {
      // Resposta foi limpa: zera quem/quando respondeu — senão fica um "respondido por"
      // órfão apontando pra um texto que não existe mais.
      payload.responded_by = null;
      payload.responded_at = null;
    } else if (textoMudou && user?.id) {
      payload.responded_by = user.id;
      payload.responded_at = new Date().toISOString();
    }

    const { error } = await supabase.from('user_feedback').update(payload).eq('id', feedback.id);
    if (error) {
      toast.error('Não foi possível salvar o feedback.');
      throw error;
    }

    toast.success('Feedback atualizado.');
    // `respondeu` só é true quando o TEXTO da resposta mudou — não quando o admin só
    // reabriu o sheet e salvou de novo o mesmo texto (ou só trocou o status).
    await logAdminAction('feedback_update', feedback.user_id, {
      feedback_id: feedback.id,
      status: next.status,
      respondeu: textoMudou,
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

          {(usersLookupPartial || totalCount > rows.length) && (
            <div className="space-y-1">
              {usersLookupPartial && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Não foi possível carregar alguns nomes de alunos. Recarregue a página para tentar de novo.
                </p>
              )}
              {totalCount > rows.length && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os {rows.length} feedbacks mais recentes de {totalCount} no total.
                </p>
              )}
            </div>
          )}

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
