import * as React from 'react';
import { useState } from 'react';
import { Building2, Copy, History, Loader2, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { MonoValue } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import type { FeatureCatalogEntry } from '@/services/admin/featureCatalog';
import type { IesData } from '@/components/admin/ies/IesFeaturesBoard';
import { CopyFeaturesDialog } from '@/components/admin/ies/CopyFeaturesDialog';
import { IesAuditTrail } from '@/components/admin/ies/IesAuditTrail';

export interface IesFeatureCardProps {
  ies: IesData;
  /** Catálogo agrupado por experiência (`groupCatalogByExperience`). */
  catalog: { aluno: FeatureCatalogEntry[]; gestao: FeatureCatalogEntry[] };
  /** `pendingChanges[ies.id]` do orquestrador — diff local ainda não salvo. */
  pending?: Record<string, boolean>;
  /** `saving === ies.id` do orquestrador. */
  saving: boolean;
  /** Lista completa de IES (para o `Select` de origem do dialog de cópia). */
  iesList: IesData[];
  onToggle: (featureKey: string, enabled: boolean) => void;
  onSave: () => void;
  onCopyFrom: (sourceIesId: string) => void;
}

/**
 * Card de uma IES: seção "Experiência do Aluno", header com badge de
 * pendências, "Copiar de...", "Histórico" e "Salvar". Renderiza a partir do
 * catálogo do banco — nada de lista hardcoded de features.
 *
 * O Portal do Gestor deixou de ser liberado por feature de IES (acesso
 * passou a depender de papel) — a seção "Experiência do Gestor" e o master
 * switch de `gestao.enabled` foram removidos daqui. `catalog.gestao` segue
 * no tipo só porque `CopyFeaturesDialog` soma `catalog.aluno` + `catalog.gestao`
 * de forma genérica; hoje chega vazio.
 */
export const IesFeatureCard: React.FC<IesFeatureCardProps> = ({
  ies,
  catalog,
  pending,
  saving,
  iesList,
  onToggle,
  onSave,
  onCopyFrom,
}) => {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pendingCount = Object.keys(pending ?? {}).length;
  const hasPending = pendingCount > 0;

  const getEffective = (featureKey: string): boolean => pending?.[featureKey] ?? ies.features[featureKey] ?? false;

  const alunoEnabled = catalog.aluno.filter((f) => getEffective(f.key)).length;

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border p-4 transition-colors',
        hasPending && 'border-primary',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">{ies.nome}</span>
          {hasPending && (
            <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
              {pendingCount} alteraç{pendingCount === 1 ? 'ão' : 'ões'} não salva{pendingCount === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCopyDialogOpen(true)} disabled={saving}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar de...
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen((prev) => !prev)}>
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Button size="sm" onClick={onSave} disabled={!hasPending || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Experiência do Aluno</h4>
          <MonoValue muted className="text-xs">
            {alunoEnabled}/{catalog.aluno.length}
          </MonoValue>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {catalog.aluno.map((feature) => {
            const isEnabled = getEffective(feature.key);
            const changed = pending?.[feature.key] !== undefined;
            return (
              <div
                key={feature.key}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3',
                  changed ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`${ies.id}-${feature.key}`} className="cursor-pointer text-sm font-medium">
                    {feature.label}
                  </Label>
                  <p className="truncate text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <Switch
                  id={`${ies.id}-${feature.key}`}
                  checked={isEnabled}
                  disabled={saving}
                  onCheckedChange={(checked) => onToggle(feature.key, checked)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Collapsible open={historyOpen}>
        <CollapsibleContent>
          <IesAuditTrail iesId={ies.id} open={historyOpen} />
        </CollapsibleContent>
      </Collapsible>

      <CopyFeaturesDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        currentIesId={ies.id}
        iesList={iesList}
        catalog={catalog}
        getEffectiveValue={getEffective}
        onApply={(sourceIesId) => {
          onCopyFrom(sourceIesId);
          setCopyDialogOpen(false);
        }}
      />
    </div>
  );
};
