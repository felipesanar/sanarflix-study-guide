import { AlertTriangle, Info } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { ItemCronograma } from '../api/types';

/** Acima disso a leitura dos gráficos degrada — aviso, nunca bloqueio (§4.7.2). */
export const LIMITE_LEGIBILIDADE = 5;

const MOTIVO_POR_STATUS: Record<ItemCronograma['status'], string | null> = {
  realizado: null,
  processing: 'Gabarito em processamento',
  agendado: 'Simulado ainda não realizado',
  reagendado: 'Simulado ainda não realizado',
  previsto: 'Simulado previsto, sem data definida',
};

/** `null` = selecionável. Qualquer string = motivo de indisponibilidade (§4.7.1). */
export function motivoIndisponivel(item: ItemCronograma): string | null {
  return item.indisponivelPorque ?? MOTIVO_POR_STATUS[item.status];
}

export interface SeletorSimuladosProps {
  itens: ItemCronograma[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}

export function SeletorSimulados({ itens, selecionados, onChange }: SeletorSimuladosProps) {
  const semSelecao = selecionados.length === 0;
  const excedeLegibilidade = selecionados.length > LIMITE_LEGIBILIDADE;

  return (
    <div
      data-testid="seletor-simulados"
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        semSelecao && 'border-destructive ring-2 ring-destructive/20',
      )}
    >
      <p className="mb-2 text-sm font-medium text-foreground">Simulados</p>

      <ToggleGroup
        type="multiple"
        value={selecionados}
        onValueChange={onChange}
        aria-label="Selecione os simulados do detalhamento"
        className="flex flex-wrap justify-start gap-2"
      >
        {itens.map((item) => {
          const motivo = motivoIndisponivel(item);
          return (
            <ToggleGroupItem
              key={item.id}
              value={item.id}
              disabled={motivo !== null}
              aria-label={motivo ? `${item.nome} — ${motivo}` : item.nome}
              className="h-auto flex-col items-start gap-0.5 px-3 py-2 data-[state=on]:bg-primary/10"
            >
              <span className="text-sm">{item.nome}</span>
              {motivo && <span className="text-xs text-muted-foreground">{motivo}</span>}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      {semSelecao && (
        // Task: contraste AA de "Escolha ao menos um simulado" (texto real, text-sm — mínimo
        // 4,5:1; o <Info> é aria-hidden e redundante com este texto, só herda a cor por
        // currentColor). text-destructive contra o bg-card deste <div> dava 3,78:1 no claro e
        // 3,48:1 no escuro (reprova AA) — mesmo achado do KpiCard. gp-text-danger
        // (--gp-danger-on) dá 11,09:1 no claro e 7,15:1 no escuro. Ver contrasteDestructive.test.tsx.
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm gp-text-danger">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Escolha ao menos um simulado
        </p>
      )}

      {excedeLegibilidade && (
        <p
          role="status"
          data-testid="aviso-legibilidade"
          className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {selecionados.length} simulados selecionados: os gráficos podem ficar difíceis de ler. A leitura continua
          disponível.
        </p>
      )}
    </div>
  );
}
