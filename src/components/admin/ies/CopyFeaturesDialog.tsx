import * as React from 'react';
import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeatureCatalogEntry } from '@/services/admin/featureCatalog';
import type { IesData } from '@/components/admin/ies/IesFeaturesBoard';

export interface CopyFeaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IES cujo card abriu o dialog — excluída das opções de origem. */
  currentIesId: string;
  /** Todas as IES (para o `Select` de origem). */
  iesList: IesData[];
  catalog: { aluno: FeatureCatalogEntry[]; gestao: FeatureCatalogEntry[] };
  /** Valor efetivo (original + pending) da IES atual — usado só para o preview. */
  getEffectiveValue: (featureKey: string) => boolean;
  /** Aplica como pendências (nunca salva direto) — quem decide o diff real é o orquestrador. */
  onApply: (sourceIesId: string) => void;
}

/**
 * Dialog "Copiar de..." — escolhe uma IES fonte e aplica as diferenças como
 * pendências na IES atual. Não chama nenhuma RPC: só delega ao orquestrador
 * via `onApply`, que recalcula o diff efetivo (pending-aware) e grava em
 * `pendingChanges`.
 */
export const CopyFeaturesDialog: React.FC<CopyFeaturesDialogProps> = ({
  open,
  onOpenChange,
  currentIesId,
  iesList,
  catalog,
  getEffectiveValue,
  onApply,
}) => {
  const [sourceIesId, setSourceIesId] = useState<string>('');

  const sourceOptions = useMemo(
    () => iesList.filter((ies) => ies.id !== currentIesId),
    [iesList, currentIesId],
  );

  const source = useMemo(
    () => sourceOptions.find((ies) => ies.id === sourceIesId),
    [sourceOptions, sourceIesId],
  );

  const changingCount = useMemo(() => {
    if (!source) return 0;
    const allKeys = [...catalog.aluno, ...catalog.gestao];
    return allKeys.filter((entry) => (source.features[entry.key] ?? false) !== getEffectiveValue(entry.key)).length;
  }, [source, catalog, getEffectiveValue]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setSourceIesId('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar de...</DialogTitle>
          <DialogDescription>
            Aplica as features de outra IES aqui como alterações pendentes — nada é salvo automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Select value={sourceIesId} onValueChange={setSourceIesId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a IES de origem" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((ies) => (
                <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {source && (
            <p className="text-sm text-muted-foreground">
              {changingCount === 0
                ? 'Nenhuma feature vai mudar.'
                : `${changingCount} feature${changingCount === 1 ? '' : 's'} vão mudar.`}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => sourceIesId && onApply(sourceIesId)} disabled={!sourceIesId || changingCount === 0}>
            <Copy className="h-4 w-4 mr-2" />
            Aplicar como pendências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
