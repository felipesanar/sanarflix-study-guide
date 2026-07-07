import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminEmpty } from '@/experiences/admin/ui/AdminEmpty';
import { MonoValue } from '@/experiences/admin/ui/MonoValue';
import { cn } from '@/lib/utils';
import { FEEDBACK_CATEGORY_META, FEEDBACK_STATUS_META, FEEDBACK_STATUS_ORDER, type FeedbackStatus } from './feedbackMeta';
import type { FeedbackRow, FeedbackUserInfo } from './types';

export interface FeedbackDetailSheetProps {
  feedback: FeedbackRow | null;
  userInfo?: FeedbackUserInfo;
  onOpenChange: (open: boolean) => void;
  onSave: (feedback: FeedbackRow, next: { status: FeedbackStatus; resposta: string }) => Promise<void>;
}

/**
 * Sheet lateral (~460px) de detalhe/resposta de um feedback: mensagem
 * completa, screenshot (signed URL do bucket `feedback-screenshots`),
 * metadados de contexto, status real e resposta para o aluno.
 */
export function FeedbackDetailSheet({ feedback, userInfo, onOpenChange, onSave }: FeedbackDetailSheetProps) {
  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>('received');
  const [draftResponse, setDraftResponse] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (feedback) {
      setDraftStatus(feedback.status);
      setDraftResponse(feedback.admin_response ?? '');
    }
  }, [feedback]);

  useEffect(() => {
    let cancelled = false;
    setScreenshotUrl(null);
    if (feedback?.screenshot_url) {
      supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(feedback.screenshot_url, 3600)
        .then(({ data }) => {
          if (!cancelled) setScreenshotUrl(data?.signedUrl ?? null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [feedback]);

  const handleSave = async () => {
    if (!feedback) return;
    setSaving(true);
    try {
      await onSave(feedback, { status: draftStatus, resposta: draftResponse });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!feedback} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[460px]">
        {feedback &&
          (() => {
            const meta = FEEDBACK_CATEGORY_META[feedback.category];
            const Icon = meta.icon;
            return (
              <div className="space-y-5">
                <SheetHeader className="text-left">
                  <div className={cn('flex items-center gap-2 font-mono text-xs uppercase tracking-wide', meta.iconClassName)}>
                    <Icon className="h-4 w-4" /> {meta.label}
                  </div>
                  <SheetTitle>{userInfo?.nome ?? '—'}</SheetTitle>
                  <SheetDescription className="font-mono">{userInfo?.email ?? feedback.user_id}</SheetDescription>
                </SheetHeader>

                <div>
                  <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Mensagem</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.message}</p>
                </div>

                <div>
                  <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Print</div>
                  {screenshotUrl ? (
                    <img src={screenshotUrl} alt="Print enviado pelo aluno" className="w-full rounded-xl border" />
                  ) : (
                    <AdminEmpty
                      title="Sem print"
                      description="O aluno não anexou uma captura de tela a este feedback."
                      className="py-6"
                    />
                  )}
                </div>

                <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Página</span>
                    <MonoValue muted className="truncate text-right">{feedback.page_url ?? '—'}</MonoValue>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Viewport</span>
                    <MonoValue muted>{feedback.viewport ?? '—'}</MonoValue>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Semestre</span>
                    <MonoValue muted>{feedback.semestre ?? '—'}</MonoValue>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Role</span>
                    <MonoValue muted>{feedback.user_role ?? '—'}</MonoValue>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Enviado</span>
                    <MonoValue muted>{format(new Date(feedback.created_at), 'dd/MM/yyyy HH:mm')}</MonoValue>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">Status</label>
                  <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as FeedbackStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_STATUS_ORDER.map((value) => (
                        <SelectItem key={value} value={value}>
                          {FEEDBACK_STATUS_META[value].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">Resposta para o aluno</label>
                  <Textarea
                    value={draftResponse}
                    onChange={(e) => setDraftResponse(e.target.value)}
                    rows={5}
                    placeholder="Aparece na página 'Meus feedbacks' do aluno."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
      </SheetContent>
    </Sheet>
  );
}

export default FeedbackDetailSheet;
