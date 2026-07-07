import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MonoValue } from '@/experiences/admin/ui';
import { toBrazilDate } from '@/utils/timezone';
import type { FinalizacaoRow } from './liberacoes-types';

export interface LiberacoesDialogProps {
  row: FinalizacaoRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => Promise<void>;
}

/**
 * Dialog de confirmação simples (não é uma ação de alto risco reversível — apenas libera
 * uma nova tentativa) com os dados do aluno/simulado/tentativa e um campo de motivo opcional.
 * Chama `admin_liberar_tentativa`, que grava a auditoria no mesmo commit.
 */
export function LiberacoesDialog({ row, onOpenChange, onConfirm }: LiberacoesDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) setMotivo('');
  }, [row]);

  const handleConfirm = async () => {
    if (!row) return;
    setSubmitting(true);
    try {
      await onConfirm(motivo);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={row !== null} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar nova tentativa</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-left text-foreground">
              {row && (
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Aluno</dt>
                  <dd>{row.user_nome ?? 'Nome não disponível'} · <MonoValue muted>{row.user_email ?? '—'}</MonoValue></dd>
                  <dt className="text-muted-foreground">Simulado</dt>
                  <dd>{row.simulado_nome ?? 'Simulado não encontrado'}</dd>
                  <dt className="text-muted-foreground">Tentativa</dt>
                  <dd><MonoValue>#{row.tentativa_numero || 1}</MonoValue></dd>
                  <dt className="text-muted-foreground">Finalizado em</dt>
                  <dd>
                    <MonoValue>
                      {format(toBrazilDate(row.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </MonoValue>
                  </dd>
                </dl>
              )}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="liberacao-motivo" className="text-xs text-muted-foreground">
                  Motivo (opcional)
                </Label>
                <Textarea
                  id="liberacao-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: aluno reportou queda de conexão durante a prova"
                  disabled={submitting}
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">Esta ação fica registrada em auditoria.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Liberar tentativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
