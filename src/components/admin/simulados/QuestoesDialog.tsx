/**
 * Fatia C1 — Diálogo "Ver questões" de um simulado: lista de cards com
 * gabarito, status de anulação e ação de anular (RPC transacional
 * `admin_anular_questao`, ver `src/services/admin/simulados.ts`).
 *
 * SUBSTITUI o antigo modal client-side de `SimuladosTab.tsx`: não há mais
 * update direto em `questoes_simulado`/`answer_progress` — a RPC faz as duas
 * mudanças em transação e grava a auditoria.
 */
import { useEffect, useState } from 'react';
import { Ban, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminEmpty, AdminError, AdminLoading, DangerZone, MonoValue, StatusPill } from '@/experiences/admin/ui';
import { anularQuestao, countRespostasQuestao } from '@/services/admin/simulados';
import { cn } from '@/lib/utils';

interface QuestaoRow {
  id: string;
  ordem: number;
  numero_questao: number | null;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string | null;
  correta: string;
  comentario: string | null;
  anulada: boolean;
}

export interface QuestoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simuladoId: string | null;
  simuladoNome: string;
}

export default function QuestoesDialog({ open, onOpenChange, simuladoId, simuladoNome }: QuestoesDialogProps) {
  const [questoes, setQuestoes] = useState<QuestaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [countingId, setCountingId] = useState<string | null>(null);
  const [anularTarget, setAnularTarget] = useState<QuestaoRow | null>(null);
  // `null` = a contagem falhou (nunca deve virar "não há respostas" — achado P3).
  const [anularImpact, setAnularImpact] = useState<number | null>(0);
  const [dangerOpen, setDangerOpen] = useState(false);

  const fetchQuestoes = async () => {
    if (!simuladoId) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('questoes_simulado')
        .select('id, ordem, numero_questao, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario, anulada')
        .eq('simulado_id', simuladoId)
        .order('ordem');

      if (fetchError) throw fetchError;
      setQuestoes((data ?? []) as QuestaoRow[]);
    } catch (err) {
      Logger.error('[QuestoesDialog] falha ao carregar questões:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as questões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && simuladoId) {
      fetchQuestoes();
      setExpanded(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, simuladoId]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAnular = async (questao: QuestaoRow) => {
    setCountingId(questao.id);
    const count = await countRespostasQuestao(questao.id);
    setCountingId(null);
    setAnularTarget(questao);
    setAnularImpact(count);
    setDangerOpen(true);
  };

  const handleConfirmAnular = async () => {
    if (!anularTarget) return;
    try {
      const result = await anularQuestao(anularTarget.id);
      setQuestoes((prev) => prev.map((q) => (q.id === anularTarget.id ? { ...q, anulada: true } : q)));
      toast.success('Questão anulada', {
        description: `${result.respostas_recontabilizadas} resposta(s) recontabilizada(s) como corretas.`,
      });
    } catch (err) {
      toast.error('Erro ao anular questão', { description: err instanceof Error ? err.message : String(err) });
      throw err; // mantém a DangerZone aberta para nova tentativa.
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Questões — {simuladoNome}</DialogTitle>
            <DialogDescription>
              {loading ? 'Carregando…' : `${questoes.length} questão(ões) cadastrada(s).`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <AdminLoading rows={4} rowHeight="h-24" />
            ) : error ? (
              <AdminError message={error} onRetry={fetchQuestoes} />
            ) : questoes.length === 0 ? (
              <AdminEmpty title="Nenhuma questão" description="Este simulado ainda não tem questões cadastradas." />
            ) : (
              <div className="space-y-3">
                {questoes.map((questao) => {
                  const isExpanded = expanded.has(questao.id);
                  return (
                    <div key={questao.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <MonoValue className="text-sm font-semibold">
                            Questão {questao.numero_questao ?? questao.ordem}
                          </MonoValue>
                          <StatusPill variant="emerald">Gab. {questao.correta}</StatusPill>
                          {questao.anulada && <StatusPill variant="amber">ANULADA</StatusPill>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!questao.anulada && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={countingId === questao.id}
                              onClick={() => handleOpenAnular(questao)}
                            >
                              {countingId === questao.id ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Anular
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => toggleExpanded(questao.id)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <p className={cn('mt-2 text-sm', !isExpanded && 'line-clamp-2')}>{questao.enunciado}</p>

                      {isExpanded && (
                        <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                          {(['a', 'b', 'c', 'd', 'e'] as const).map((letra) => {
                            const valor = questao[`alternativa_${letra}` as const];
                            if (!valor) return null;
                            const isCorreta = questao.correta.toUpperCase() === letra.toUpperCase();
                            return (
                              <p key={letra} className={cn(isCorreta && 'font-semibold text-emerald-600 dark:text-emerald-400')}>
                                {letra.toUpperCase()}) {valor}
                              </p>
                            );
                          })}
                          {questao.comentario && (
                            <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground">
                              {questao.comentario}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DangerZone
        open={dangerOpen}
        onOpenChange={setDangerOpen}
        level="medium"
        title={`Anular Questão ${anularTarget?.numero_questao ?? anularTarget?.ordem ?? ''}`}
        impact={
          anularImpact === null ? (
            'A questão será marcada como anulada. Não foi possível estimar o impacto.'
          ) : anularImpact > 0 ? (
            <>
              A questão será marcada como anulada e até <MonoValue>{anularImpact}</MonoValue> resposta(s) serão
              recontabilizadas — quem a respondeu errado por causa dela pode passar a ser considerado correto.
            </>
          ) : (
            'A questão será marcada como anulada. Ainda não há respostas registradas para ela.'
          )
        }
        actionLabel="Anular questão"
        onConfirm={handleConfirmAnular}
      />
    </>
  );
}
