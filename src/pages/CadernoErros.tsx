import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BookMarked, Search, AlertCircle, PlusCircle, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useErrorNotebook, ErrorNotebookFilters as Filters, ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { ErrorNotebookList } from '@/components/caderno-erros/ErrorNotebookList';
import { ErrorNotebookFilters } from '@/components/caderno-erros/ErrorNotebookFilters';
import { ErrorNotebookDashboard } from '@/components/caderno-erros/ErrorNotebookDashboard';
import { FlashcardMode } from '@/components/caderno-erros/FlashcardMode';
import { ManualEntryForm } from '@/components/caderno-erros/ManualEntryForm';
import { AIInsightsCard } from '@/components/caderno-erros/AIInsightsCard';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';

export const CadernoErros: React.FC = () => {
  const { entries, loading, error, fetchEntries, clearError } = useErrorNotebook();
  const { trackEvent } = useAnalyticsTracker();
  const [filters, setFilters] = useState<Filters>({});
  const [searchInput, setSearchInput] = useState('');
  const [allEntries, setAllEntries] = useState<ErrorNotebookEntry[]>([]);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [flashcardOpen, setFlashcardOpen] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackEvent({ eventName: 'ce_page_viewed', category: 'navigation' });
      trackedRef.current = true;
    }
  }, [trackEvent]);

  useEffect(() => {
    fetchEntries().then(() => {});
  }, [fetchEntries]);

  useEffect(() => {
    if (!filters.grande_area && !filters.tema && !filters.reason && !filters.simulado_id && !filters.search) {
      setAllEntries(entries);
    }
  }, [entries, filters]);

  useEffect(() => {
    fetchEntries({
      grande_area: filters.grande_area,
      tema: filters.tema,
      reason: filters.reason,
      simulado_id: filters.simulado_id,
      search: filters.search,
    });
  }, [filters.grande_area, filters.tema, filters.reason, filters.simulado_id, filters.search, fetchEntries]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined }));
      if (value) {
        trackEvent({ eventName: 'ce_search_used', category: 'interaction' });
      }
    }, 300);
  }, [trackEvent]);

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleRefresh = useCallback(() => {
    fetchEntries(filters);
  }, [fetchEntries, filters]);

  const hasFiltersActive = !!(filters.grande_area || filters.tema || filters.reason || filters.simulado_id || filters.search);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookMarked className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Caderno de Erros</h1>
              <p className="text-sm text-muted-foreground">
                Revise seus gaps e evite repetir os mesmos erros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFlashcardOpen(true)}
                className="gap-2"
              >
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Modo Revisão</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setManualFormOpen(true)}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={clearError} className="ml-auto text-xs underline">Fechar</button>
        </div>
      )}

      {/* Dashboard (collapsible) */}
      {allEntries.length > 0 && (
        <Collapsible open={dashboardOpen} onOpenChange={setDashboardOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-between">
              <span className="text-sm font-medium">Dashboard de Evolução</span>
              {dashboardOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <ErrorNotebookDashboard entries={allEntries} />
            <AIInsightsCard entries={allEntries} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar nos aprendizados..."
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <ErrorNotebookFilters
        entries={allEntries.length > 0 ? allEntries : entries}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={entries.length}
      />

      {/* List */}
      <ErrorNotebookList
        entries={entries}
        loading={loading}
        hasFiltersActive={hasFiltersActive}
        onEntryDeleted={handleRefresh}
        onEntryUpdated={handleRefresh}
      />

      {/* Flashcard Mode */}
      <FlashcardMode
        isOpen={flashcardOpen}
        onOpenChange={setFlashcardOpen}
        entries={entries.length > 0 ? entries : allEntries}
      />

      {/* Manual Entry Form */}
      <ManualEntryForm
        isOpen={manualFormOpen}
        onOpenChange={setManualFormOpen}
        existingEntries={allEntries}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default CadernoErros;
