import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, Layers, Brain, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { useFlashcards } from '@/hooks/useFlashcards';
import { listDueFlashcards, scheduleFlashcardReview, type Flashcard } from '@/lib/flashcardsApi';
import type { SrsOutcome } from '@/lib/srs';

const GRADES: { value: SrsOutcome; label: string; tone: string }[] = [
  { value: 'errei', label: 'Errei', tone: 'border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10' },
  { value: 'dificil', label: 'Difícil', tone: 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
  { value: 'bom', label: 'Bom', tone: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  { value: 'facil', label: 'Fácil', tone: 'border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10' },
];

export const FlashcardsPanel: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const { flashcards, dueCount, loading, create, remove, refresh } = useFlashcards();

  const [showForm, setShowForm] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);

  // estado de revisão
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);

  const handleCreate = async () => {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    try { await create(front.trim(), back.trim()); setFront(''); setBack(''); setShowForm(false); }
    finally { setSaving(false); }
  };

  const startReview = useCallback(async () => {
    if (!user?.id) return;
    const due = await listDueFlashcards(user.id);
    setQueue(due); setIdx(0); setFlipped(false);
    trackEvent({ eventName: 'ce_flashcard_session_started', category: 'interaction', data: { total: due.length } });
  }, [user?.id, trackEvent]);

  const grade = async (outcome: SrsOutcome) => {
    if (!queue || grading) return;
    const card = queue[idx];
    setGrading(true);
    try {
      await scheduleFlashcardReview(card.id, outcome);
      trackEvent({ eventName: 'ce_flashcard_reviewed', category: 'interaction', data: { outcome } });
    } finally {
      setGrading(false);
    }
    if (idx + 1 >= queue.length) { setQueue(null); refresh(); }
    else { setIdx(idx + 1); setFlipped(false); }
  };

  // ── Modo revisão ──
  if (queue) {
    if (queue.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trophy className="h-7 w-7 text-primary mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum flashcard para revisar</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">Você está em dia. Volte quando houver cards devidos.</p>
          <Button variant="outline" onClick={() => setQueue(null)}>Voltar</Button>
        </div>
      );
    }
    const card = queue[idx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{idx + 1} de {queue.length}</span>
          <button onClick={() => setQueue(null)} className="underline underline-offset-2">Sair</button>
        </div>
        <Card className="min-h-[220px] cursor-pointer" onClick={() => setFlipped((v) => !v)}>
          <CardContent className="p-6 flex items-center justify-center text-center min-h-[220px]">
            <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
              {flipped ? card.back_md : card.front_md}
            </p>
          </CardContent>
        </Card>
        {!flipped ? (
          <Button className="w-full" onClick={() => setFlipped(true)}>Mostrar resposta</Button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <Button key={g.value} variant="outline" disabled={grading} onClick={() => grade(g.value)} className={cn('min-h-[44px]', g.tone)}>
                {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : g.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Lista + criação ──
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Button onClick={startReview} disabled={dueCount === 0} className="gap-2">
          <Brain className="h-4 w-4" /> Revisar{dueCount > 0 ? ` (${dueCount})` : ''}
        </Button>
        <Button variant="outline" onClick={() => setShowForm((v) => !v)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo flashcard
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Frente (pergunta)" />
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Verso (resposta)" className="min-h-[100px] resize-none" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !front.trim() || !back.trim()} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : flashcards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Layers className="h-7 w-7 text-primary/70" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum flashcard ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Crie flashcards para memorizar com repetição espaçada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flashcards.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.front_md}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.back_md}</p>
                  </div>
                  {f.mastered_at && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">dominado</span>}
                  <Button variant="ghost" size="sm" onClick={() => remove(f.id)} aria-label="Excluir flashcard" className="shrink-0 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
