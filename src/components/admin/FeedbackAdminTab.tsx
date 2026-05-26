import React, { useEffect, useMemo, useState } from 'react';
import { Bug, Lightbulb, Sparkles, Heart, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  user_id: string;
  category: 'bug' | 'suggestion' | 'feature_request' | 'praise';
  message: string;
  status: 'received' | 'in_review' | 'resolved' | 'archived';
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
};

const CAT_META = {
  bug: { label: 'Bug', icon: Bug, color: 'text-destructive' },
  suggestion: { label: 'Sugestão', icon: Lightbulb, color: 'text-primary' },
  feature_request: { label: 'Funcionalidade', icon: Sparkles, color: 'text-accent-foreground' },
  praise: { label: 'Elogio', icon: Heart, color: 'text-rose-500' },
} as const;

const STATUS_META = {
  received: { label: 'Recebido', cls: 'bg-muted text-muted-foreground' },
  in_review: { label: 'Em análise', cls: 'bg-primary/15 text-primary border-primary/30' },
  resolved: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  archived: { label: 'Arquivado', cls: 'bg-muted/60 text-muted-foreground' },
} as const;

export const FeedbackAdminTab: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<Record<string, { nome: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Row | null>(null);
  const [draft, setDraft] = useState('');
  const [draftStatus, setDraftStatus] = useState<Row['status']>('received');
  const [saving, setSaving] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error('Erro ao carregar feedbacks');
    } else {
      setRows((data ?? []) as Row[]);
      const uids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      if (uids.length) {
        const { data: us } = await supabase.from('users').select('id, nome, email').in('id', uids);
        const map: Record<string, { nome: string; email: string }> = {};
        (us ?? []).forEach((u: any) => (map[u.id] = { nome: u.nome, email: u.email }));
        setUsers(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selected) {
      setDraft(selected.admin_response ?? '');
      setDraftStatus(selected.status);
    }
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setScreenshotUrl(null);
      if (selected?.screenshot_url) {
        const { data } = await supabase.storage
          .from('feedback-screenshots')
          .createSignedUrl(selected.screenshot_url, 3600);
        if (!cancelled) setScreenshotUrl(data?.signedUrl ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

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
    const c: Record<string, number> = { bug: 0, suggestion: 0, feature_request: 0, praise: 0 };
    rows.forEach((r) => { c[r.category]++; });
    return c;
  }, [rows]);

  const handleSave = async () => {
    if (!selected || !user?.id) return;
    setSaving(true);
    const payload: any = {
      admin_response: draft.trim() || null,
      status: draftStatus,
    };
    if (draft.trim() && draft !== (selected.admin_response ?? '')) {
      payload.responded_by = user.id;
      payload.responded_at = new Date().toISOString();
    }
    const { error } = await supabase.from('user_feedback').update(payload).eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível salvar');
      return;
    }
    toast.success('Feedback atualizado');
    setSelected(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['bug', 'suggestion', 'feature_request', 'praise'] as const).map((k) => {
          const m = CAT_META[k];
          const Icon = m.icon;
          return (
            <div key={k} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={cn('h-4 w-4', m.color)} /> {m.label}
              </div>
              <div className="text-2xl font-semibold mt-1">{counts[k]}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por texto, nome ou email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="in_review">Em análise</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="suggestion">Sugestão</SelectItem>
            <SelectItem value="feature_request">Funcionalidade</SelectItem>
            <SelectItem value="praise">Elogio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Nenhum feedback com esses filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = CAT_META[r.category];
            const status = STATUS_META[r.status];
            const Icon = meta.icon;
            const u = users[r.user_id];
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-4 flex gap-4"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className={cn('h-4 w-4', meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{u?.nome ?? '—'}</span>
                    <span>·</span>
                    <span>{u?.email ?? r.user_id.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-sm line-clamp-2">{r.message}</p>
                </div>
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-xs border self-start whitespace-nowrap', status.cls)}>
                  {status.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (() => {
            const meta = CAT_META[selected.category];
            const Icon = meta.icon;
            const u = users[selected.user_id];
            return (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className={cn('h-4 w-4', meta.color)} /> {meta.label}
                  </div>
                  <h3 className="text-lg font-semibold mt-1">{u?.nome ?? '—'}</h3>
                  <div className="text-xs text-muted-foreground">{u?.email}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Mensagem</div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>

                {screenshotUrl && (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Print</div>
                    <img src={screenshotUrl} alt="Print" className="rounded-xl border border-border w-full" />
                  </div>
                )}

                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div><span className="font-medium text-foreground">Página:</span> {selected.page_url || '—'}</div>
                  <div><span className="font-medium text-foreground">Tela:</span> {selected.viewport || '—'}</div>
                  <div><span className="font-medium text-foreground">Semestre:</span> {selected.semestre ?? '—'}</div>
                  <div><span className="font-medium text-foreground">Role:</span> {selected.user_role || '—'}</div>
                  <div className="break-all"><span className="font-medium text-foreground">Agent:</span> {selected.user_agent || '—'}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Status</label>
                  <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as Row['status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Recebido</SelectItem>
                      <SelectItem value="in_review">Em análise</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="archived">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Resposta para o aluno</label>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    placeholder="Escreva uma resposta — ela aparece na página 'Meus feedbacks' do aluno."
                    className="rounded-xl"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelected(null)} className="rounded-xl">Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving} className="rounded-xl">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : 'Salvar'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default FeedbackAdminTab;
