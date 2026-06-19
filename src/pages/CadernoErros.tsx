import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Search, AlertCircle, PlusCircle, Brain, Sparkles, Star, FileText, Flag, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorNotebook, ErrorNotebookFilters as Filters, ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { ErrorNotebookList } from '@/components/caderno-erros/ErrorNotebookList';
import { ErrorNotebookFilters } from '@/components/caderno-erros/ErrorNotebookFilters';
import { ErrorNotebookDashboard } from '@/components/caderno-erros/ErrorNotebookDashboard';
import { ManualEntryForm } from '@/components/caderno-erros/ManualEntryForm';
import { AIInsightsCard } from '@/components/caderno-erros/AIInsightsCard';
import { CalibrationPanel } from '@/components/caderno-erros/CalibrationPanel';
import { InsightCards } from '@/components/caderno-erros/InsightCards';
import { ExportCadernoButton } from '@/components/caderno-erros/ExportCadernoButton';
import { NotificationPreferenceToggle } from '@/components/caderno-erros/NotificationPreferenceToggle';
import { FavoritesList } from '@/components/caderno-erros/FavoritesList';
import { NotesPanel } from '@/components/caderno-erros/NotesPanel';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { useNotebookDueCount } from '@/hooks/useNotebookDueCount';
import { motion } from 'framer-motion';
import { Logger } from '@/utils/logger';

Logger.info('[ErrorNotebookUI] CadernoErros page loaded');

export const CadernoErros: React.FC = () => {
  const { entries, loading, error, fetchEntries, clearError } = useErrorNotebook();
  const { trackEvent } = useAnalyticsTracker();
  const navigate = useNavigate();
  const { count: dueCount, refresh: refreshDueCount } = useNotebookDueCount();
  const [filters, setFilters] = useState<Filters>({});
  const [searchInput, setSearchInput] = useState('');
  const [allEntries, setAllEntries] = useState<ErrorNotebookEntry[]>([]);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('erros');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackEvent({ eventName: 'ce_page_viewed', category: 'navigation' });
      trackedRef.current = true;
    }
  }, [trackEvent]);

  useEffect(() => { fetchEntries().then(() => {}); }, [fetchEntries]);

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
      if (value) trackEvent({ eventName: 'ce_search_used', category: 'interaction' });
    }, 300);
  }, [trackEvent]);

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleRefresh = useCallback(() => { fetchEntries(filters); refreshDueCount(); }, [fetchEntries, filters, refreshDueCount]);
  const hasFiltersActive = !!(filters.grande_area || filters.tema || filters.reason || filters.simulado_id || filters.search);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl lg:max-w-6xl space-y-6 sm:space-y-8">
      {/* ─── Premium Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
              <BookMarked className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Caderno de Erros
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Revise seus gaps e transforme erros em aprendizado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(dueCount > 0 ? '/caderno-de-erros/revisao' : '/caderno-de-erros/revisao?mode=all')}
                className="gap-2 rounded-xl border-border/50 hover:bg-accent/50 hover:shadow-sm transition-all duration-200 flex-1 sm:flex-none h-10 text-sm shadow-sm"
              >
                <Brain className="h-4 w-4" />
                {dueCount > 0 ? `Revisar ${dueCount} devido${dueCount === 1 ? '' : 's'}` : 'Modo Revisão'}
              </Button>
            )}
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/caderno-de-erros/reta-final')}
                className="gap-2 rounded-xl border-border/50 hover:bg-accent/50 hover:shadow-sm transition-all duration-200 flex-1 sm:flex-none h-10 text-sm shadow-sm"
              >
                <Flag className="h-4 w-4" />
                Reta Final
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setManualFormOpen(true)}
              className="gap-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex-1 sm:flex-none h-10 text-sm"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">Fechar</button>
        </motion.div>
      )}

      {/* ─── Tab Layout ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <TabsList className="bg-muted/40 border border-border/30 rounded-xl p-1 h-auto">
            <TabsTrigger
              value="erros"
              className="rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:shadow-sm transition-all duration-200"
            >
              <BookMarked className="h-4 w-4 mr-2" />
              Meus Erros
              {allEntries.length > 0 && (
                <span className="ml-2 text-[11px] font-mono bg-muted/80 px-1.5 py-0.5 rounded-md tabular-nums">
                  {allEntries.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="favoritos"
              className="rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:shadow-sm transition-all duration-200"
            >
              <Star className="h-4 w-4 mr-2" />
              Favoritos
            </TabsTrigger>
            <TabsTrigger
              value="anotacoes"
              className="rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:shadow-sm transition-all duration-200"
            >
              <FileText className="h-4 w-4 mr-2" />
              Anotações
            </TabsTrigger>
            <TabsTrigger
              value="evolucao"
              className="rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:shadow-sm transition-all duration-200"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Evolução
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* Tab: Meus Erros */}
        <TabsContent value="erros" className="space-y-5 mt-0">
          {allEntries.length > 0 && (
            <div className="flex justify-end">
              <ExportCadernoButton />
            </div>
          )}
          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar nos aprendizados..."
              className="pl-11 h-12 rounded-xl bg-card border-border/40 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all duration-200 text-sm shadow-sm"
            />
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.16 }}
          >
            <ErrorNotebookFilters
              entries={allEntries.length > 0 ? allEntries : entries}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              resultCount={entries.length}
            />
          </motion.div>

          {/* List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <ErrorNotebookList
              entries={entries}
              loading={loading}
              hasFiltersActive={hasFiltersActive}
              onEntryDeleted={handleRefresh}
              onEntryUpdated={handleRefresh}
            />
          </motion.div>
        </TabsContent>

        {/* Tab: Favoritos */}
        <TabsContent value="favoritos" className="space-y-5 mt-0">
          <FavoritesList />
        </TabsContent>

        {/* Tab: Anotações */}
        <TabsContent value="anotacoes" className="space-y-5 mt-0">
          <NotesPanel />
        </TabsContent>

        {/* Tab: Evolução */}
        <TabsContent value="evolucao" className="space-y-6 mt-0">
          <NotificationPreferenceToggle />
          {allEntries.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <InsightCards />
              <ErrorNotebookDashboard entries={allEntries} />
              <CalibrationPanel />
              <AIInsightsCard entries={allEntries} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5 border border-border/20">
                <Sparkles className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">Sem dados de evolução</h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Adicione registros ao seu caderno de erros para visualizar insights e evolução.
              </p>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

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