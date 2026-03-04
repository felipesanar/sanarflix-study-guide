/**
 * SheetMappingCard Component
 * Maps XLSX sheets to IES institutions
 */

import * as React from 'react';
import { Check, ChevronsUpDown, FileSpreadsheet, Link2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { IES, SheetInfo, SheetMapping } from '../types';

interface SheetMappingCardProps {
  sheet: SheetInfo;
  iesList: IES[];
  currentMapping: SheetMapping | null;
  duplicateIesIds: string[];
  onMappingChange: (sheetName: string, iesId: string, iesNome: string) => void;
  /** Whether this sheet is enabled for import (XLSX only) */
  enabled?: boolean;
  /** Toggle enabled state (XLSX only) */
  onToggleEnabled?: (sheetName: string) => void;
  /** Whether to show the enable/disable checkbox */
  showToggle?: boolean;
}

export const SheetMappingCard: React.FC<SheetMappingCardProps> = ({
  sheet,
  iesList,
  currentMapping,
  duplicateIesIds,
  onMappingChange,
  enabled = true,
  onToggleEnabled,
  showToggle = false,
}) => {
  const [open, setOpen] = React.useState(false);
  
  const selectedIes = iesList.find(ies => ies.id === currentMapping?.iesId);
  const isDuplicate = currentMapping?.iesId && duplicateIesIds.includes(currentMapping.iesId);
  const isMapped = !!currentMapping?.iesId;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        !enabled && 'opacity-50',
        enabled && isDuplicate && 'border-amber-500 bg-amber-500/5',
        enabled && isMapped && !isDuplicate && 'border-emerald-500/50 bg-emerald-500/5',
        enabled && !isMapped && 'border-muted-foreground/25',
        !enabled && 'border-muted-foreground/15 bg-muted/30'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {showToggle && (
            <Checkbox
              checked={enabled}
              onCheckedChange={() => onToggleEnabled?.(sheet.name)}
              aria-label={`Incluir aba ${sheet.name} na importação`}
              className="shrink-0"
            />
          )}
          <div className={cn(
            'rounded-lg p-2.5 shrink-0',
            isMapped && !isDuplicate && 'bg-emerald-500/10 text-emerald-600',
            isDuplicate && 'bg-amber-500/10 text-amber-600',
            !isMapped && 'bg-muted text-muted-foreground'
          )}>
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{sheet.name}</h4>
              {sheet.autoMatched && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Link2 className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {sheet.rowCount.toLocaleString('pt-BR')} linhas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                disabled={!enabled}
                aria-expanded={open}
                className={cn(
                  'w-full sm:w-[280px] justify-between',
                  isDuplicate && 'border-amber-500 text-amber-600'
                )}
              >
                {selectedIes ? (
                  <span className="truncate">{selectedIes.nome}</span>
                ) : (
                  <span className="text-muted-foreground">Selecionar IES...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar IES..." />
                <CommandList>
                  <CommandEmpty>Nenhuma IES encontrada.</CommandEmpty>
                  <CommandGroup>
                    {iesList.map((ies) => (
                      <CommandItem
                        key={ies.id}
                        value={ies.nome}
                        onSelect={() => {
                          onMappingChange(sheet.name, ies.id, ies.nome);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedIes?.id === ies.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="truncate">{ies.nome}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isDuplicate && (
        <div className="mt-3 flex items-center gap-2 text-amber-600 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Esta IES está mapeada em outra aba. Confirme se isso é intencional.</span>
        </div>
      )}
    </div>
  );
};
