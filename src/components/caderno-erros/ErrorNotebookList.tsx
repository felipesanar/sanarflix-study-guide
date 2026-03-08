import React, { useMemo } from 'react';
import { ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { ErrorNotebookItem } from './ErrorNotebookItem';
import { ErrorNotebookEmptyState } from './ErrorNotebookEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface ErrorNotebookListProps {
  entries: ErrorNotebookEntry[];
  loading: boolean;
  hasFiltersActive: boolean;
  onEntryDeleted: () => void;
  onEntryUpdated: () => void;
}

export const ErrorNotebookList: React.FC<ErrorNotebookListProps> = ({
  entries,
  loading,
  hasFiltersActive,
  onEntryDeleted,
  onEntryUpdated,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ErrorNotebookEntry[]>>();
    entries.forEach(entry => {
      const area = entry.grande_area || 'Sem área';
      const tema = entry.tema || 'Sem tema';
      if (!map.has(area)) map.set(area, new Map());
      const temaMap = map.get(area)!;
      if (!temaMap.has(tema)) temaMap.set(tema, []);
      temaMap.get(tema)!.push(entry);
    });
    return map;
  }, [entries]);

  const recurrenceByTema = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach(e => {
      const key = e.tema || 'Sem tema';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [entries]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-4 w-28 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <ErrorNotebookEmptyState type={hasFiltersActive ? 'no-results' : 'no-entries'} />;
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([area, temaMap], areaIndex) => {
        const areaEntryCount = Array.from(temaMap.values()).reduce((sum, items) => sum + items.length, 0);
        return (
          <motion.div
            key={area}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: areaIndex * 0.05 }}
            className="space-y-4"
          >
            {/* Grande Área header */}
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-primary/40" />
              <h2 className="text-base font-bold text-foreground tracking-tight">{area}</h2>
              <Badge variant="secondary" className="text-[10px] font-mono rounded-full px-2 py-0 h-5 bg-muted/60">
                {areaEntryCount}
              </Badge>
            </div>

            {Array.from(temaMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([tema, items], temaIndex) => {
              const recurrence = recurrenceByTema.get(tema) || 0;
              return (
                <motion.div
                  key={tema}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: (areaIndex * 0.05) + (temaIndex * 0.03) }}
                  className="space-y-2.5 pl-4 sm:pl-5"
                >
                  {/* Tema subheader */}
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{tema}</h3>
                    <div className="flex-1 border-t border-dashed border-border/30" />
                    <span className="text-[10px] font-mono text-muted-foreground/50">{items.length}</span>
                  </div>

                  {/* Items */}
                  <div className="space-y-2.5">
                    {items.map(entry => (
                      <ErrorNotebookItem
                        key={entry.id}
                        entry={entry}
                        onDeleted={onEntryDeleted}
                        onUpdated={onEntryUpdated}
                        showRecurrence={recurrence >= 2}
                        recurrenceCount={recurrence}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
};
