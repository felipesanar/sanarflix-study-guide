import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { GestorPanel } from '@/experiences/gestor/ui';
import { cn } from '@/lib/utils';

export interface ReportSection {
  id: string;
  label: string;
  /** Nota muted exibida abaixo do label (ex.: restrição de dado nominal). */
  note?: string;
  checked: boolean;
  /** Quando `true`, a seção não pode ser alterada pelo usuário (informativo). */
  disabled?: boolean;
}

interface ReportSectionsBuilderProps {
  sections: ReportSection[];
  onToggle: (id: string) => void;
}

/**
 * Checklist de seções do "Montar relatório" — Checkbox shadcn por seção, com
 * nota muted opcional (ex.: "dado nominal — restrito" em Alunos em risco).
 */
export const ReportSectionsBuilder: React.FC<ReportSectionsBuilderProps> = ({ sections, onToggle }) => (
  <GestorPanel title="Montar relatório" subtitle="Selecione as seções · o recorte global é aplicado">
    <div className="space-y-1">
      {sections.map((section) => (
        <label
          key={section.id}
          htmlFor={`report-section-${section.id}`}
          className={cn(
            'flex items-start gap-3 rounded-lg p-2.5 -mx-2.5 transition-colors',
            !section.disabled && 'cursor-pointer hover:bg-accent/50',
          )}
        >
          <Checkbox
            id={`report-section-${section.id}`}
            checked={section.checked}
            disabled={section.disabled}
            onCheckedChange={() => onToggle(section.id)}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{section.label}</p>
            {section.note && <p className="text-xs text-muted-foreground">{section.note}</p>}
          </div>
        </label>
      ))}
    </div>
  </GestorPanel>
);
