import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { toast } from '@/hooks/use-toast';
import { Logger } from '@/utils/logger';
import { REASON_LABELS, type ErrorReason } from '@/hooks/useErrorNotebook';
import { generateCadernoPDF, type CadernoExportEntry } from '@/utils/cadernoPdfExport';

export const ExportCadernoButton: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      const { data: entries, error } = await supabase
        .from('error_notebook_entries')
        .select('grande_area, tema, reason, learning_text, question_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('grande_area', { ascending: true });
      if (error) throw error;

      const qIds = (entries ?? []).map((e) => e.question_id).filter((id): id is string => !!id);
      const qMap = new Map<string, { enunciado: string; correta: string; comentario: string | null }>();
      if (qIds.length > 0) {
        const { data: qs } = await supabase
          .from('questoes_simulado')
          .select('id, enunciado, correta, comentario')
          .in('id', qIds);
        for (const q of qs ?? []) qMap.set(q.id, { enunciado: q.enunciado, correta: q.correta, comentario: q.comentario });
      }

      const exportEntries: CadernoExportEntry[] = (entries ?? []).map((e) => {
        const q = e.question_id ? qMap.get(e.question_id) : undefined;
        return {
          grandeArea: e.grande_area,
          tema: e.tema,
          reasonLabel: REASON_LABELS[e.reason as ErrorReason] ?? e.reason,
          learningText: e.learning_text,
          enunciado: q?.enunciado ?? null,
          correta: q?.correta ?? null,
          comentario: q?.comentario ?? null,
        };
      });

      if (exportEntries.length === 0) {
        toast({ title: 'Caderno vazio', description: 'Não há registros para exportar.' });
        return;
      }
      generateCadernoPDF(exportEntries);
      trackEvent({ eventName: 'ce_export_pdf', category: 'interaction', data: { count: exportEntries.length } });
    } catch (err) {
      Logger.error('[Caderno] export error:', err);
      toast({ title: 'Erro ao exportar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={disabled || busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Exportar PDF
    </Button>
  );
};
