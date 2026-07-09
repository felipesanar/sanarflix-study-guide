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
 * Card de uma IES: seções "Experiência do Aluno" e "Experiência do Gestor"
 * (com master switch), header com badge de pendências, "Copiar de...",
 * "Histórico" e "Salvar". Renderiza a partir do catálogo do banco — nada de
 * lista hardcoded de features.
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
  const gestaoEnabled = catalog.gestao.filter((f) => getEffective(f.key)).length;

  const masterEntry = catalog.gestao.find((f) => f.isMaster);
  const masterOn = masterEntry ? getEffective(masterEntry.key) : true;
  const otherGestaoEntries = catalog.gestao.filter((f) => !f.isMaster);

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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Experiência do Gestor</h4>
          <MonoValue muted className="text-xs">
            {gestaoEnabled}/{catalog.gestao.length}
          </MonoValue>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {masterEntry && (
            <div
              key={masterEntry.key}
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border-2 p-3',
                pending?.[masterEntry.key] !== undefined ? 'border-primary/60 bg-primary/5' : 'border-primary/30 bg-muted/30',
              )}
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={`${ies.id}-${masterEntry.key}`} className="cursor-pointer text-sm font-medium">
                  {masterEntry.label}
                </Label>
                <p className="truncate text-xs text-muted-foreground">{masterEntry.description}</p>
              </div>
              <Switch
                id={`${ies.id}-${masterEntry.key}`}
                checked={masterOn}
                disabled={saving}
                onCheckedChange={(checked) => onToggle(masterEntry.key, checked)}
              />
            </div>
          )}
          {otherGestaoEntries.map((feature) => {
            const isEnabled = getEffective(feature.key);
            const changed = pending?.[feature.key] !== undefined;
            const disabled = saving || !masterOn;
            return (
              <div
                key={feature.key}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3',
                  changed ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                  !masterOn && 'opacity-50',
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
                  disabled={disabled}
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
