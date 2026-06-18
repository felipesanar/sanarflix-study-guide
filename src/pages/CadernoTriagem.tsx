import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { REASON_LABELS, type ErrorReason } from '@/hooks/useErrorNotebook';
import { useTriageSimulados, useTriageCandidates, type TriageCandidate } from '@/hooks/useTriageCandidates';
import { suggestReason } from '@/lib/triageHeuristic';
import { addToNotebookBulk, type BulkEntry } from '@/lib/cadernoSrsApi';
import type { SrsConfidence } from '@/lib/srs';

const CONFIDENCE_OPTIONS: { value: SrsConfidence; label: string }[] = [
  { value: 'baixa', label: 'Chutei' },
  { value: 'media', label: 'Em dúvida' },
  { value: 'alta', label: 'Tinha certeza' },
];

const REASON_VALUES = Object.keys(REASON_LABELS) as ErrorReason[];

interface ItemState {
  included: boolean;
  confidence: SrsConfidence;
  reason: ErrorReason;
  reasonTouched: boolean;
}

export const CadernoTriagem: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { trackEvent } = useAnalyticsTracker();

  const simuladoId = params.get('simulado');
  const { simulados, loading: loadingSimulados } = useTriageSimulados();
  const { candidates, loading, error } = useTriageCandidates(simuladoId);

  const simuladoNome = useMemo(
    () => simulados.find((s) => s.id === simuladoId)?.nome ?? 'Simulado',
    [simulados, simuladoId],
  );

  const [state, setState] = useState<Record<string, ItemState>>({});
  const [saving, setSaving] = useState(false);
  const trackedRef = React.useRef(false);

  // inicializa o estado por item quando os candidatos chegam
  useEffect(() => {
    const init: Record<string, ItemState> = {};
    for (const c of candidates) {
      const confidence: SrsConfidence = 'media';
      init[c.questionId] = {
        included: true,
        confidence,
        reason: suggestReason({ ...c, confidence }),
        reasonTouched: false,
      };
    }
    setState(init);
    if (candidates.length > 0 && !trackedRef.current) {
      trackEvent({ eventName: 'ce_triage_viewed', category: 'interaction', data: { simulado_id: simuladoId, total: candidates.length } });
      trackedRef.current = true;
    }
  }, [candidates, simuladoId, trackEvent]);

  const setConfidence = useCallback((c: TriageCandidate, value: SrsConfidence) => {
    setState((prev) => {
      const cur = prev[c.questionId];
      if (!cur) return prev;
      return {
        ...prev,
        [c.questionId]: {
          ...cur,
          confidence: value,
          // recomputa a causa sugerida, a menos que o usuário já tenha trocado
          reason: cur.reasonTouched ? cur.reason : suggestReason({ ...c, confidence: value }),
        },
      };
    });
  }, []);

  const setReason = useCallback((questionId: string, reason: ErrorReason) => {
    setState((prev) => ({ ...prev, [questionId]: { ...prev[questionId], reason, reasonTouched: true } }));
  }, []);

  const toggleIncluded = useCallback((questionId: string) => {
    setState((prev) => ({ ...prev, [questionId]: { ...prev[questionId], included: !prev[questionId].included } }));
  }, []);

  const selectedCount = useMemo(
    () => candidates.filter((c) => state[c.questionId]?.included).length,
    [candidates, state],
  );

  const handleAdd = useCallback(async () => {
    const entries: BulkEntry[] = candidates
      .filter((c) => state[c.questionId]?.included)
      .map((c) => {
        const st = state[c.questionId];
        return {
          question_id: c.questionId,
          simulado_id: simuladoId,
          simulado_nome: simuladoNome,
          grande_area: c.grandeArea,
          especialidade: c.especialidade,
          tema: c.tema,
          reason: st.reason,
          was_correct: c.wasCorrect,
          confidence_at_answer: st.confidence,
        };
      });
    if (entries.length === 0) return;

    setSaving(true);
    try {
      const res = await addToNotebookBulk(entries);
      trackEvent({ eventName: 'ce_triage_batch_added', category: 'interaction', data: { added: res.added, skipped: res.skipped } });
      toast({
        title: 'Adicionado ao Caderno de Erros',
        description: `${res.added} ${res.added === 1 ? 'questão adicionada' : 'questões adicionadas'}${res.skipped ? ` · ${res.skipped} já estavam no caderno` : ''}.`,
      });
      navigate('/caderno-de-erros');
    } catch (err) {
      toast({ title: 'Erro ao adicionar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [candidates, state, simuladoId, simuladoNome, trackEvent, navigate]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-3xl space-y-6 pb-28">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/caderno-de-erros')} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Triagem pós-prova
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Triagem de erros</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Marque sua confiança em cada erro e adicione ao caderno de uma vez.
        </p>
      </div>

      {/* Seletor de simulado (quando não veio por query param) */}
      {!simuladoId && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium">Escolha um simulado para triar</p>
            {loadingSimulados ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Select onValueChange={(v) => setParams({ simulado: v })}>
                <SelectTrigger className="w-full max-w-sm"><SelectValue placeholder="Selecione um simulado" /></SelectTrigger>
                <SelectContent>
                  {simulados.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {simuladoId && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-3" /><p className="text-sm">Carregando triagem…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum erro para triar</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Você não tem erros neste simulado — ou já triou todos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c, i) => {
              const st = state[c.questionId];
              if (!st) return null;
              return (
                <motion.div key={c.questionId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}>
                  <Card className={cn('transition-opacity', !st.included && 'opacity-50')}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={st.included} onCheckedChange={() => toggleIncluded(c.questionId)} className="mt-1" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {c.grandeArea && <Badge variant="outline" className="text-xs">{c.grandeArea}</Badge>}
                            {c.tema && <span className="text-xs text-muted-foreground">{c.tema}</span>}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {c.selectedLabel ? `Marcou ${c.selectedLabel}` : 'Em branco'} · correta {c.correctLabel}
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{c.enunciado}</p>
                        </div>
                      </div>

                      {st.included && (
                        <div className="pl-7 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            {CONFIDENCE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setConfidence(c, opt.value)}
                                className={cn(
                                  'text-xs px-2.5 py-1.5 rounded-lg border transition-all min-h-[32px]',
                                  st.confidence === opt.value
                                    ? 'border-primary bg-primary/5 text-primary font-medium'
                                    : 'border-border text-muted-foreground hover:border-primary/40',
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <Select value={st.reason} onValueChange={(v) => setReason(c.questionId, v as ErrorReason)}>
                            <SelectTrigger className="h-9 w-full sm:w-56 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REASON_VALUES.map((r) => <SelectItem key={r} value={r} className="text-xs">{REASON_LABELS[r]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* Barra de ação fixa */}
      {simuladoId && candidates.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3 z-20">
          <div className="container mx-auto max-w-3xl flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{selectedCount} selecionado(s)</span>
            <Button onClick={handleAdd} disabled={saving || selectedCount === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Adicionar ao caderno
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadernoTriagem;
