import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  CurricularAreaNode,
  CurricularSpecialtyNode,
  CurricularTemaNode,
  CurricularBreakdown,
} from '@/types/desempenhoV2';
import { Logger } from '@/utils/logger';

export interface SearchResult {
  type: 'area' | 'specialty' | 'tema';
  name: string;
  percentual: number;
  area: CurricularAreaNode;
  specialty?: CurricularSpecialtyNode;
  tema?: CurricularTemaNode;
  breadcrumb: string;
}

interface Props {
  curricular: CurricularBreakdown;
  onSelectArea: (area: CurricularAreaNode) => void;
  onSelectSpecialty: (area: CurricularAreaNode, specialty: CurricularSpecialtyNode) => void;
  onSelectTema: (area: CurricularAreaNode, specialty: CurricularSpecialtyNode, tema: CurricularTemaNode) => void;
}

function getStatusBadgeInfo(p: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (p >= 60) return { label: 'Proficiente', variant: 'default' };
  if (p >= 50) return { label: 'Próximo', variant: 'secondary' };
  return { label: 'Crítico', variant: 'destructive' };
}

function flattenCurricular(curricular: CurricularBreakdown): SearchResult[] {
  const results: SearchResult[] = [];
  for (const area of curricular.areas) {
    results.push({
      type: 'area',
      name: area.name,
      percentual: area.percentual,
      area,
      breadcrumb: area.name,
    });
    for (const sp of area.specialties) {
      results.push({
        type: 'specialty',
        name: sp.name,
        percentual: sp.percentual,
        area,
        specialty: sp,
        breadcrumb: `${area.name} → ${sp.name}`,
      });
      for (const tema of sp.temas) {
        results.push({
          type: 'tema',
          name: tema.name,
          percentual: tema.percentual,
          area,
          specialty: sp,
          tema,
          breadcrumb: `${area.name} → ${sp.name} → ${tema.name}`,
        });
      }
    }
  }
  return results;
}

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const CurricularSearchBar: React.FC<Props> = ({
  curricular,
  onSelectArea,
  onSelectSpecialty,
  onSelectTema,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => flattenCurricular(curricular), [curricular]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query.trim());
    return allItems
      .filter((item) => normalize(item.name).includes(q) || normalize(item.breadcrumb).includes(q))
      .slice(0, 12);
  }, [query, allItems]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    Logger.info('[DesempenhoV2:Search]', 'Selected:', result.type, result.name);
    if (result.type === 'area') {
      onSelectArea(result.area);
    } else if (result.type === 'specialty' && result.specialty) {
      onSelectSpecialty(result.area, result.specialty);
    } else if (result.type === 'tema' && result.specialty && result.tema) {
      onSelectTema(result.area, result.specialty, result.tema);
    }
    setQuery('');
    setOpen(false);
  };

  const typeLabel: Record<string, string> = {
    area: 'Área',
    specialty: 'Especialidade',
    tema: 'Tema',
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar área, especialidade ou tema..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          className="pl-9 pr-8 h-9 text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-accent"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
          <ScrollArea className="max-h-72">
            <div className="p-1">
              {filtered.map((result, i) => {
                const status = getStatusBadgeInfo(result.percentual);
                return (
                  <button
                    key={`${result.type}-${result.name}-${i}`}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{result.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                          {typeLabel[result.type]}
                        </Badge>
                        <Badge variant={status.variant} className="text-[10px] px-1 py-0 h-4 shrink-0">
                          {result.percentual}%
                        </Badge>
                      </div>
                      {result.type !== 'area' && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          {result.area.name}
                          {result.specialty && result.type === 'tema' && (
                            <>
                              <ChevronRight className="h-3 w-3 inline shrink-0" />
                              {result.specialty.name}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p>
        </div>
      )}
    </div>
  );
};
