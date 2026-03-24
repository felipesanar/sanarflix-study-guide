import React, { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS, ErrorNotebookFilters as Filters } from '@/hooks/useErrorNotebook';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';

console.log('[ErrorNotebookUI] ErrorNotebookFilters loaded');

interface ErrorNotebookFiltersProps {
  entries: ErrorNotebookEntry[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  resultCount: number;
}

export const ErrorNotebookFilters: React.FC<ErrorNotebookFiltersProps> = ({
  entries,
  filters,
  onFiltersChange,
  resultCount,
}) => {
  const isMobile = useIsMobile();
  const { trackEvent } = useAnalyticsTracker();

  const uniqueAreas = useMemo(() =>
    [...new Set(entries.map(e => e.grande_area).filter(Boolean) as string[])].sort(),
    [entries]
  );

  const uniqueTemas = useMemo(() =>
    [...new Set(entries.map(e => e.tema).filter(Boolean) as string[])].sort(),
    [entries]
  );

  const uniqueSimulados = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => {
      if (e.simulado_id && e.simulado_nome && !map.has(e.simulado_id)) map.set(e.simulado_id, e.simulado_nome);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const activeCount = [filters.grande_area, filters.tema, filters.reason, filters.simulado_id].filter(Boolean).length;

  const handleChange = (key: keyof Filters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value === 'all' ? undefined : value };
    onFiltersChange(newFilters);
    trackEvent({ eventName: 'ce_filter_applied', category: 'interaction', data: { filter_type: key } });
  };

  const clearFilters = () => { onFiltersChange({ search: filters.search }); };

  const selectTriggerClass = "w-full sm:w-[175px] rounded-xl border-border/40 bg-card hover:bg-accent/30 transition-all duration-200 h-10 text-sm shadow-sm";

  const filterContent = (
    <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
      <Select value={filters.grande_area || 'all'} onValueChange={(v) => handleChange('grande_area', v)}>
        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Grande Área" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">Todas as áreas</SelectItem>
          {uniqueAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.tema || 'all'} onValueChange={(v) => handleChange('tema', v)}>
        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tema" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">Todos os temas</SelectItem>
          {uniqueTemas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.reason || 'all'} onValueChange={(v) => handleChange('reason', v)}>
        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Motivo" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">Todos os motivos</SelectItem>
          {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.simulado_id || 'all'} onValueChange={(v) => handleChange('simulado_id', v)}>
        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Simulado" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">Todos os simulados</SelectItem>
          {uniqueSimulados.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl h-10">
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-foreground tabular-nums">{resultCount}</span> registros
        </span>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/40 h-10 shadow-sm">
              <Filter className="h-4 w-4" />
              Filtros
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="rounded-t-2xl">
            <DrawerHeader><DrawerTitle>Filtros</DrawerTitle></DrawerHeader>
            <div className="px-4 pb-4">{filterContent}</div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full rounded-xl h-11">Aplicar</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {filterContent}
      <p className="text-xs text-muted-foreground/50">
        <span className="font-mono font-semibold text-muted-foreground tabular-nums">{resultCount}</span> registros encontrados
      </p>
    </div>
  );
};