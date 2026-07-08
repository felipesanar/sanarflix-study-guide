import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronsUpDown, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdminError } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import { brazilISOToDatetimeLocal, datetimeLocalToBrazilISO } from '@/utils/timezone';
import type { SimuladoOpt } from './importar-respostas-types';

export interface ImportarSimuladoStepProps {
  simulados: SimuladoOpt[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedSimulado: string;
  onSelectSimulado: (id: string) => void;
  sourceLabel: string;
  onSourceLabelChange: (value: string) => void;
  defaultDate: string;
  onDefaultDateChange: (value: string) => void;
  disabled?: boolean;
}

/** Passo 1 do wizard: picker de simulado (Command shadcn) + rótulo de importação + data padrão. */
export function ImportarSimuladoStep({
  simulados,
  loading,
  error,
  onRetry,
  selectedSimulado,
  onSelectSimulado,
  sourceLabel,
  onSourceLabelChange,
  defaultDate,
  onDefaultDateChange,
  disabled,
}: ImportarSimuladoStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const selectedSimuladoData = simulados.find((s) => s.id === selectedSimulado);

  const filteredSimulados = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return simulados;
    return simulados.filter((s) => s.nome.toLowerCase().includes(q));
  }, [simulados, pickerQuery]);

  if (error) {
    return <AdminError message={error} title="Falha ao carregar simulados" onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Simulado de destino</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                disabled={loading || disabled}
                className="w-full justify-between font-normal"
              >
                {loading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                  </span>
                ) : selectedSimuladoData ? (
                  <span className="truncate">{selectedSimuladoData.nome}</span>
                ) : (
                  <span className="text-muted-foreground">Selecione um simulado</span>
                )}
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Buscar simulado…" value={pickerQuery} onValueChange={setPickerQuery} />
                <CommandList>
                  <CommandEmpty>{simulados.length === 0 ? 'Nenhum simulado cadastrado.' : 'Nenhum simulado encontrado.'}</CommandEmpty>
                  <CommandGroup>
                    {filteredSimulados.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.id}
                        onSelect={() => {
                          onSelectSimulado(s.id);
                          setPickerOpen(false);
                          setPickerQuery('');
                          if (!sourceLabel) {
                            onSourceLabelChange(`${s.nome} — ${new Date().toLocaleDateString('pt-BR')}`);
                          }
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Check className={cn('h-4 w-4 shrink-0', selectedSimulado === s.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{s.nome}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Badge variant={s.total_questoes === 0 ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {s.total_questoes}q
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {s.ies_count} IES
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedSimuladoData && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={selectedSimuladoData.total_questoes === 0 ? 'destructive' : 'secondary'}>
                {selectedSimuladoData.total_questoes} questões
              </Badge>
              <Badge variant="outline">{selectedSimuladoData.ies_count} IES vinculada(s)</Badge>
              {selectedSimuladoData.total_questoes === 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Cadastre questões antes
                </Badge>
              )}
            </div>
          )}
        </div>

        <div>
          <Label>Rótulo da importação</Label>
          <Input
            value={sourceLabel}
            onChange={(e) => onSourceLabelChange(e.target.value)}
            placeholder="Ex: FUNEPE - Aplicação 24/03/2026"
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aparece no histórico de auditoria. Auto-preenchido ao escolher o simulado.
          </p>
        </div>
      </div>

      <div>
        <Label>Data de finalização padrão (opcional)</Label>
        <Input
          type="datetime-local"
          // Exibe/interpreta sempre em horário de Brasília — antes usava
          // toISOString().slice(0,16) (hora UTC "de parede"), então o admin via
          // um horário diferente do que tinha digitado e "corrigir" mudava o
          // valor real salvo.
          value={defaultDate ? brazilISOToDatetimeLocal(defaultDate) : ''}
          onChange={(e) => onDefaultDateChange(e.target.value ? datetimeLocalToBrazilISO(e.target.value) : '')}
          disabled={disabled}
          className="max-w-xs"
        />
        <p className="mt-1 text-xs text-muted-foreground">Aplicada a alunos sem data própria na planilha.</p>
      </div>

      {!loading && simulados.length === 0 && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Recarregar simulados
        </Button>
      )}
    </div>
  );
}
