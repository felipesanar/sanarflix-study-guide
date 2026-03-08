import React, { useMemo } from 'react';
import { ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { ErrorNotebookItem } from './ErrorNotebookItem';
import { ErrorNotebookEmptyState } from './ErrorNotebookEmptyState';
import { Skeleton } from '@/components/ui/skeleton';

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
  // Group by grande_area > tema
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

  // Count recurrences per tema
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
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
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
      {Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([area, temaMap]) => (
        <div key={area} className="space-y-4">
          <h2 className="text-lg font-bold text-foreground border-b pb-2">{area}</h2>
          {Array.from(temaMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([tema, items]) => {
            const recurrence = recurrenceByTema.get(tema) || 0;
            return (
              <div key={tema} className="space-y-3 pl-2 sm:pl-4">
                <h3 className="text-sm font-semibold text-muted-foreground">{tema}</h3>
                <div className="space-y-2">
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
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
