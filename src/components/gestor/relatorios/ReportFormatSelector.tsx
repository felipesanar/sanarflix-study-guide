import * as React from 'react';
import { FileText, Table2, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ReportFormat = 'pdf' | 'xlsx' | 'link';

interface FormatOption {
  id: ReportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'pdf', label: 'PDF branded', description: 'Documento pronto para a mantenedora', icon: FileText },
  { id: 'xlsx', label: 'XLSX (dados)', description: 'Planilha para análise própria', icon: Table2 },
  { id: 'link', label: 'Link seguro', description: 'Compartilhamento por link', icon: Link2, disabled: true },
];

interface ReportFormatSelectorProps {
  value: ReportFormat;
  onChange: (format: ReportFormat) => void;
}

/** Seletor de formato do relatório — 3 cards clicáveis, "Link seguro" desabilitado com Badge "em breve". */
export const ReportFormatSelector: React.FC<ReportFormatSelectorProps> = ({ value, onChange }) => (
  <div>
    <p className="mb-2 text-xs font-medium text-muted-foreground">Formato</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {FORMAT_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors',
              selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/50',
              opt.disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
              {opt.disabled && (
                <Badge variant="outline" className="text-[9px] font-medium tracking-wide">
                  EM BREVE
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{opt.label}</p>
              <p className="text-[11px] text-muted-foreground">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
