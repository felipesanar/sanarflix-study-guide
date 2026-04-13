import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowLeft, AlertCircle, BookOpen, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { CurricularSearchBar } from './CurricularSearchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeAccuracyEvolutionChart } from '@/components/analytics/v2/ThemeAccuracyEvolutionChart';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import type {
  InstitutionalViewModel,
  CurricularAreaNode,
  CurricularSpecialtyNode,
  CurricularTemaNode,
} from '@/types/desempenhoV2';

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  iesId?: string;
}

type DrillLevel = 'areas' | 'specialties' | 'temas' | 'tema-detail';

interface DrillState {
  level: DrillLevel;
  selectedArea?: CurricularAreaNode;
  selectedSpecialty?: CurricularSpecialtyNode;
  selectedTema?: CurricularTemaNode;
}

const PROFICIENCY_THRESHOLD = 60;

function getStatusColor(percentual: number): string {
  if (percentual >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (percentual >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getStatusBadge(percentual: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (percentual >= PROFICIENCY_THRESHOLD) return { label: 'Proficiente', variant: 'default' };
  if (percentual >= PROFICIENCY_THRESHOLD - 10) return { label: 'Próximo', variant: 'secondary' };
  return { label: 'Crítico', variant: 'destructive' };
}

// ── Reusable row component for each curricular item ──
const CurricularRow: React.FC<{
  name: string;
  total: number;
  acertos: number;
  percentual: number;
  questionsLabel?: string;
  onClick?: () => void;
  hasChildren?: boolean;
}> = ({ name, total, acertos, percentual, questionsLabel, onClick, hasChildren = true }) => {
  const status = getStatusBadge(percentual);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/20 transition-colors text-left group disabled:opacity-70 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{name}</span>
          <Badge variant={status.variant} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{questionsLabel ?? `${total} questões`}</span>
          <span>{acertos} acertos</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-24">
          <Progress value={percentual} className="h-2" />
        </div>
        <span className={`text-sm font-semibold w-14 text-right ${getStatusColor(percentual)}`}>
          {percentual}%
        </span>
        {hasChildren && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </div>
    </button>
  );
};

export const DiagnosticoCurricularModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [drill, setDrill] = useState<DrillState>({ level: 'areas' });

  const goToAreas = useCallback(() => {
    setDrill({ level: 'areas' });
    console.log('[DesempenhoV2:Diagnostico]', 'Navigate to areas');
  }, []);

  const goToSpecialties = useCallback((area: CurricularAreaNode) => {
    setDrill({ level: 'specialties', selectedArea: area });
    console.log('[DesempenhoV2:Diagnostico]', 'Navigate to specialties:', area.name);
  }, []);

  const goToTemas = useCallback((area: CurricularAreaNode, specialty: CurricularSpecialtyNode) => {
    setDrill({ level: 'temas', selectedArea: area, selectedSpecialty: specialty });
    console.log('[DesempenhoV2:Diagnostico]', 'Navigate to temas:', specialty.name);
  }, []);

  const goToTemaDetail = useCallback((area: CurricularAreaNode, specialty: CurricularSpecialtyNode, tema: CurricularTemaNode) => {
    setDrill({ level: 'tema-detail', selectedArea: area, selectedSpecialty: specialty, selectedTema: tema });
    console.log('[DesempenhoV2:Diagnostico]', 'Navigate to tema detail:', tema.name);
  }, []);

  if (loading) return <DesempenhoV2Skeleton />;

  if (error && !data) {
    return (
      <Card className="border-dashed border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{error}</p>
          {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-lg font-semibold mb-2">Selecione um simulado</h3>
          <p className="text-sm text-muted-foreground">Escolha um simulado nos filtros acima para visualizar o diagnóstico curricular.</p>
        </CardContent>
      </Card>
    );
  }

  const { curricular } = data;
  const areas = [...curricular.areas].sort((a, b) => a.percentual - b.percentual);

  if (areas.length === 0) {
    return (
      <ModuleEmptyState
        title="Sem dados curriculares no recorte atual"
        description="Ajuste os filtros globais para visualizar grandes áreas, especialidades e temas."
      />
    );
  }

  console.log('[DiagnosticoCurricular]', 'Render do módulo', {
    level: drill.level,
    areas: areas.length,
    selectedArea: drill.selectedArea?.name,
    selectedSpecialty: drill.selectedSpecialty?.name,
    selectedTema: drill.selectedTema?.name,
  });

  return (
    <motion.div className="space-y-4 sm:space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Search + Breadcrumb navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {drill.level !== 'areas' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                if (drill.level === 'specialties') goToAreas();
                else if (drill.level === 'temas') goToSpecialties(drill.selectedArea!);
                else if (drill.level === 'tema-detail') goToTemas(drill.selectedArea!, drill.selectedSpecialty!);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <CurricularSearchBar
            curricular={data.curricular}
            onSelectArea={(area) => goToSpecialties(area)}
            onSelectSpecialty={(area, sp) => goToTemas(area, sp)}
            onSelectTema={(area, sp, tema) => goToTemaDetail(area, sp, tema)}
          />
        </div>
        <Breadcrumb className="overflow-x-auto">
          <BreadcrumbList>
            <BreadcrumbItem>
              {drill.level === 'areas' ? (
                <BreadcrumbPage>Grandes Áreas</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="cursor-pointer" onClick={goToAreas}>Grandes Áreas</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {drill.selectedArea && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {drill.level === 'specialties' ? (
                    <BreadcrumbPage>{drill.selectedArea.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => goToSpecialties(drill.selectedArea!)}>
                      {drill.selectedArea.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {drill.selectedSpecialty && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {drill.level === 'temas' ? (
                    <BreadcrumbPage>{drill.selectedSpecialty.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => goToTemas(drill.selectedArea!, drill.selectedSpecialty!)}>
                      {drill.selectedSpecialty.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {drill.selectedTema && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{drill.selectedTema.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Content by level */}
      <AnimatePresence mode="wait">
        {drill.level === 'areas' && (
          <motion.div key="areas" className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{areas.length} grandes áreas • ordenadas por percentual de acertos</p>
            </div>
            {areas.map((area) => (
              <CurricularRow
                key={area.name}
                name={area.name}
                total={area.total}
                acertos={area.acertos}
                percentual={area.percentual}
                questionsLabel={`${area.total} questões · ${area.specialties.length} especialidades`}
                onClick={() => goToSpecialties(area)}
              />
            ))}
          </motion.div>
        )}

        {drill.level === 'specialties' && drill.selectedArea && (
          <motion.div key="specialties" className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            {/* Area summary card */}
            <Card className="mb-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{drill.selectedArea.name}</h3>
                    <p className="text-sm text-muted-foreground">{drill.selectedArea.total} questões · {drill.selectedArea.specialties.length} especialidades</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${getStatusColor(drill.selectedArea.percentual)}`}>
                      {drill.selectedArea.percentual}%
                    </span>
                    <p className="text-xs text-muted-foreground">acurácia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {[...drill.selectedArea.specialties].sort((a, b) => a.percentual - b.percentual).map((sp) => (
              <CurricularRow
                key={sp.name}
                name={sp.name}
                total={sp.total}
                acertos={sp.acertos}
                percentual={sp.percentual}
                questionsLabel={`${sp.total} questões · ${sp.temas.length} temas`}
                onClick={() => goToTemas(drill.selectedArea!, sp)}
              />
            ))}
          </motion.div>
        )}

        {drill.level === 'temas' && drill.selectedArea && drill.selectedSpecialty && (
          <motion.div key="temas" className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <Card className="mb-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{drill.selectedArea.name}</p>
                    <h3 className="font-semibold text-base">{drill.selectedSpecialty.name}</h3>
                    <p className="text-sm text-muted-foreground">{drill.selectedSpecialty.total} questões · {drill.selectedSpecialty.temas.length} temas</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${getStatusColor(drill.selectedSpecialty.percentual)}`}>
                      {drill.selectedSpecialty.percentual}%
                    </span>
                    <p className="text-xs text-muted-foreground">acurácia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {[...drill.selectedSpecialty.temas].sort((a, b) => a.percentual - b.percentual).map((tema) => (
              <CurricularRow
                key={tema.name}
                name={tema.name}
                total={tema.total}
                acertos={tema.acertos}
                percentual={tema.percentual}
                onClick={() => goToTemaDetail(drill.selectedArea!, drill.selectedSpecialty!, tema)}
                hasChildren={true}
              />
            ))}
          </motion.div>
        )}

        {drill.level === 'tema-detail' && drill.selectedTema && (
          <motion.div key="tema-detail" className="space-y-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <TemaDetailPanel
              tema={drill.selectedTema}
              area={drill.selectedArea!}
              specialty={drill.selectedSpecialty!}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Tema detail panel ──
const TemaDetailPanel: React.FC<{
  tema: CurricularTemaNode;
  area: CurricularAreaNode;
  specialty: CurricularSpecialtyNode;
  iesId?: string;
}> = ({ tema, area, specialty, iesId }) => {
  const gap = Math.max(0, PROFICIENCY_THRESHOLD - tema.percentual);
  const isCritical = tema.percentual < PROFICIENCY_THRESHOLD - 10;
  const isOpportunity = tema.percentual >= PROFICIENCY_THRESHOLD - 10 && tema.percentual < PROFICIENCY_THRESHOLD;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Overview card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Visão Geral do Tema</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{tema.name}</h3>
            <p className="text-sm text-muted-foreground">{area.name} → {specialty.name}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Acurácia</p>
              <p className={`text-2xl font-bold ${getStatusColor(tema.percentual)}`}>{tema.percentual}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Acertos</p>
              <p className="text-2xl font-bold text-foreground">{tema.acertos}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Questões</p>
              <p className="text-2xl font-bold text-foreground">{tema.total}</p>
            </div>
          </div>

          {iesId && (
            <ThemeAccuracyEvolutionChart themeName={tema.name} iesId={iesId} />
          )}
        </CardContent>
      </Card>

      {/* Status & Impact card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Classificação e Impacto</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Classification */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
            {isCritical ? (
              <TrendingDown className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            ) : isOpportunity ? (
              <TrendingUp className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium text-sm">
                {isCritical ? 'Tema Crítico' : isOpportunity ? 'Tema de Oportunidade' : 'Tema Proficiente'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isCritical
                  ? `Mais de 10pts abaixo da proficiência (${PROFICIENCY_THRESHOLD}%). Requer intervenção prioritária.`
                  : isOpportunity
                    ? `Próximo da proficiência — a menos de 10pts. Intervenção focada pode gerar resultados rápidos.`
                    : `Acima do limiar de proficiência. Manter monitoramento.`
                }
              </p>
            </div>
          </div>

          {/* Comparative context */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Contexto Comparativo</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">vs. Área ({area.name})</span>
                <span className={`font-medium ${tema.percentual >= area.percentual ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tema.percentual >= area.percentual ? '+' : ''}{Math.round((tema.percentual - area.percentual) * 10) / 10} pts
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">vs. Especialidade ({specialty.name})</span>
                <span className={`font-medium ${tema.percentual >= specialty.percentual ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tema.percentual >= specialty.percentual ? '+' : ''}{Math.round((tema.percentual - specialty.percentual) * 10) / 10} pts
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">vs. Proficiência ({PROFICIENCY_THRESHOLD}%)</span>
                <span className={`font-medium ${gap <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {gap <= 0 ? '+' : '-'}{Math.abs(Math.round((tema.percentual - PROFICIENCY_THRESHOLD) * 10) / 10)} pts
                </span>
              </div>
            </div>
          </div>

          {/* Prevalence */}
          <div className="p-3 rounded-lg border">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Prevalência no simulado</span>
              <span className="font-medium">
                {area.total > 0 ? Math.round((tema.total / area.total) * 1000) / 10 : 0}% da área
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {tema.total} de {area.total} questões na área {area.name}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
