import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain, Check, X, Trophy, AlertTriangle, Loader2, Volume2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { REASON_LABELS, type ErrorReason } from '@/hooks/useErrorNotebook';
import { useActiveRecallSession, type RecallMode } from '@/hooks/useActiveRecallSession';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import type { SrsConfidence, SrsOutcome } from '@/lib/srs';

const CONFIDENCE_OPTIONS: { value: SrsConfidence; label: string; hint: string }[] = [
  { value: 'baixa', label: 'Chutei', hint: 'Não tinha certeza' },
  { value: 'media', label: 'Mais ou menos', hint: 'Fiquei em dúvida' },
  { value: 'alta', label: 'Tenho certeza', hint: 'Sabia a resposta' },
];

const GRADE_OPTIONS: { value: SrsOutcome; label: string; tone: string }[] = [
  { value: 'errei', label: 'Errei', tone: 'border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10' },
  { value: 'dificil', label: 'Difícil', tone: 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
  { value: 'bom', label: 'Bom', tone: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  { value: 'facil', label: 'Fácil', tone: 'border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10' },
];

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'bg-red-500/10 text-red-600 dark:text-red-400',
  did_not_remember: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  did_not_understand_statement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  answered_without_confidence: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

export const CadernoRevisao: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') === 'all' ? 'all' : 'due') as RecallMode;

  const s = useActiveRecallSession(mode);
  const tts = useTextToSpeech();
  const back = () => { tts.stop(); navigate('/caderno-de-erros'); };

  const progress = s.total > 0 ? (s.index / s.total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={back} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Brain className="h-4 w-4 text-primary" />
          Revisão {mode === 'all' ? 'completa' : 'do dia'}
        </div>
      </div>

      {s.loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-3" />
          <p className="text-sm">Carregando sua sessão…</p>
        </div>
      ) : s.error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{s.error}</span>
        </div>
      ) : s.total === 0 ? (
        <EmptyState onBack={back} />
      ) : s.done ? (
        <Summary reviewed={s.stats.reviewed} correct={s.stats.correct} onBack={back} />
      ) : s.current ? (
        <>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{s.index + 1} de {s.total}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <motion.div key={s.current.entryId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  {s.current.grandeArea && <Badge variant="outline" className="text-xs">{s.current.grandeArea}</Badge>}
                  {s.current.tema && <span className="text-xs text-muted-foreground">{s.current.tema}</span>}
                  <Badge variant="outline" className={cn('text-xs ml-auto', REASON_COLORS[s.current.reason])}>
                    {REASON_LABELS[s.current.reason]}
                  </Badge>
                </div>

                {/* Enunciado (quando há questão) */}
                {s.current.hasQuestion ? (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{s.current.enunciado}</p>
                ) : (
                  <p className="text-base font-semibold text-foreground">{s.current.tema || s.current.especialidade || 'Revisão'}</p>
                )}

                {/* ── Fase: responder ── */}
                {s.phase === 'answering' && s.current.hasQuestion && (
                  <div className="space-y-2">
                    {s.current.options.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => s.setSelectedLabel(opt.label)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all min-h-[44px]',
                          s.selectedLabel === opt.label
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/30 hover:bg-accent/50',
                        )}
                      >
                        <span className="font-semibold text-sm shrink-0">{opt.label}</span>
                        <span className="text-sm">{opt.text}</span>
                      </button>
                    ))}
                    <Button onClick={s.submitAnswer} disabled={!s.selectedLabel} className="w-full mt-2">
                      Confirmar resposta
                    </Button>
                  </div>
                )}

                {/* ── Fase: confiança ── */}
                {s.phase === 'confidence' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Qual era a sua confiança?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {CONFIDENCE_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => s.setConfidence(c.value)}
                          className="flex flex-col items-start gap-0.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-all min-h-[44px]"
                        >
                          <span className="text-sm font-medium">{c.label}</span>
                          <span className="text-xs text-muted-foreground">{c.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Fase: revelado ── */}
                {s.phase === 'revealed' && (
                  <div className="space-y-4">
                    {s.current.hasQuestion && s.current.correctLabel && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Resposta correta: </span>
                        <span className={cn('font-semibold', s.wasCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {s.current.correctLabel}
                          {s.wasCorrect ? ' ✓ você acertou' : ` — você marcou ${s.selectedLabel ?? '—'}`}
                        </span>
                      </div>
                    )}
                    {(s.current.comentario || s.current.learningText) && (
                      <div className="space-y-2">
                        {tts.supported && (
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-8 text-xs text-muted-foreground"
                              onClick={() =>
                                tts.speaking
                                  ? tts.stop()
                                  : tts.speak((s.current!.comentario || s.current!.learningText) ?? '')
                              }
                            >
                              {tts.speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                              {tts.speaking ? 'Parar' : 'Ouvir'}
                            </Button>
                          </div>
                        )}
                        <div className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-lg p-4 whitespace-pre-wrap">
                          {s.current.comentario || s.current.learningText}
                        </div>
                      </div>
                    )}

                    {s.leechEntryId ? (
                      <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                          <AlertTriangle className="h-4 w-4" /> Este card está travando você
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Você errou este item várias vezes. Recomende reestudar o tema e recomeçar o card do zero.
                        </p>
                        <Button onClick={s.handleResetLeech} variant="outline" size="sm" className="gap-2">
                          Recomeçar este card
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Como foi?</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {GRADE_OPTIONS.map((g) => {
                            const disabled =
                              s.isCommitting ||
                              (g.value === 'facil' && s.current!.hasQuestion && s.wasCorrect === false);
                            return (
                              <Button
                                key={g.value}
                                variant="outline"
                                onClick={() => { tts.stop(); s.submitSelfGrade(g.value); }}
                                disabled={disabled}
                                className={cn('min-h-[44px]', g.tone)}
                              >
                                {s.isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : g.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : null}
    </div>
  );
};

const EmptyState: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
      <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
    </div>
    <h3 className="text-base font-semibold text-foreground mb-1.5">Nada para revisar agora</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-5">
      Você está em dia com suas revisões. Volte mais tarde ou revise tudo.
    </p>
    <Button variant="outline" onClick={onBack}>Voltar ao caderno</Button>
  </div>
);

const Summary: React.FC<{ reviewed: number; correct: number; onBack: () => void }> = ({ reviewed, correct, onBack }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
      <Trophy className="h-8 w-8 text-primary" />
    </div>
    <div>
      <h3 className="text-xl font-bold text-foreground">Revisão concluída!</h3>
      <p className="text-sm text-muted-foreground mt-1">{reviewed} itens revisados</p>
    </div>
    <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
      <Card><CardContent className="p-4 text-center">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{correct}</p>
        <p className="text-xs text-muted-foreground">Acertos</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-center">
        <p className="text-2xl font-bold text-foreground">{reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%</p>
        <p className="text-xs text-muted-foreground">Aproveitamento</p>
      </CardContent></Card>
    </div>
    <Button onClick={onBack}>Voltar ao caderno</Button>
  </div>
);

export default CadernoRevisao;
