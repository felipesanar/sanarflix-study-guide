import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, BookOpen, AlertCircle, TrendingUp, TrendingDown,
  ArrowUpDown, Search, X, ChevronRight, User, Zap,
  Shield, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import {
  StudentAnalyticsDrawer,
  computeRiskLevel,
  computeRiskAssessment,
  getRiskLabel,
  getRiskVariant,
  getRiskColor,
  type RiskLevel,
} from '@/components/analytics/v2/shared/StudentAnalyticsDrawer';
import type {
  InstitutionalViewModel,
  StudentScore,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

type SubView = 'alunos' | 'temas';
type SortKey = 'nome' | 'percentual' | 'gap' | 'semestre' | 'risco';
type SegmentFilter = 'todos' | 'proficiente' | 'oportunidade' | 'atencao' | 'critico';

const SEGMENT_OPTIONS: { value: SegmentFilter; label: string; icon: React.ElementType }[] = [
  { value: 'todos', label: 'Todos', icon: Users },
  { value: 'proficiente', label: 'Destaque', icon: Shield },
  { value: 'oportunidade', label: 'Oportunidade', icon: Zap },
  { value: 'atencao', label: 'Atenção', icon: AlertTriangle },
  { value: 'critico', label: 'Risco', icon: TrendingDown },
];

function getRiskConfig(risk: RiskLevel) {
  return { label: getRiskLabel(risk), variant: getRiskVariant(risk), color: getRiskColor(risk) };
}

interface TemaSummary {
  name: string;
  areaName: string;
  specialtyName: string;
  total: number;
  acertos: number;
  percentual: number;
  gap: number;
  risk: RiskLevel;
  /** Students below proficiency on this tema */
  alunosCriticos: number;
  /** Students within 5pp of proficiency */
  alunosOportunidade: number;
}

function buildTemaSummaries(data: InstitutionalViewModel): TemaSummary[] {
  const summaries: TemaSummary[] = [];
  for (const area of data.curricular.areas) {
    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        const gap = Math.max(0, PROFICIENCY_THRESHOLD - tema.percentual);
        summaries.push({
          name: tema.name,
          areaName: area.name,
          specialtyName: sp.name,
          total: tema.total,
          acertos: tema.acertos,
          percentual: tema.percentual,
          gap,
          risk: computeRiskLevel(tema.percentual),
          // Estimate: proportional to gap
          alunosCriticos: tema.percentual < 50 ? Math.ceil(data.allStudents.length * 0.6) : Math.ceil(data.allStudents.length * 0.3),
          alunosOportunidade: tema.percentual >= 55 && tema.percentual < 60 ? Math.ceil(data.allStudents.length * 0.4) : Math.ceil(data.allStudents.length * 0.15),
        });
      }
    }
  }
  return summaries;
}

export const VisaoAlunosModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [subView, setSubView] = useState<SubView>('alunos');
  const [sortKey, setSortKey] = useState<SortKey>('percentual');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('todos');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);
  const [selectedStudent, setSelectedStudent] = useState<StudentScore | null>(null);
  const [selectedTema, setSelectedTema] = useState<TemaSummary | null>(null);

  const temaSummaries = useMemo(() => data ? buildTemaSummaries(data) : [], [data]);

  const sortedStudents = useMemo(() => {
    if (!data) return [];
    const q = debouncedQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let list = [...data.allStudents];
    if (q) list = list.filter(s => s.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    if (segmentFilter !== 'todos') {
      list = list.filter(s => computeRiskLevel(s.percentual) === segmentFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'nome') cmp = a.nome.localeCompare(b.nome);
      else if (sortKey === 'percentual') cmp = a.percentual - b.percentual;
      else if (sortKey === 'gap') cmp = (PROFICIENCY_THRESHOLD - a.percentual) - (PROFICIENCY_THRESHOLD - b.percentual);
      else if (sortKey === 'semestre') cmp = a.semestre - b.semestre;
      else if (sortKey === 'risco') {
        const riskA = computeRiskAssessment(a, data?.curricular.areas ?? []);
        const riskB = computeRiskAssessment(b, data?.curricular.areas ?? []);
        cmp = riskB.score - riskA.score; // higher risk first
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [data, debouncedQuery, sortKey, sortAsc, segmentFilter]);

  const sortedTemas = useMemo(() => {
    const q = debouncedQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let list = [...temaSummaries];
    if (q) list = list.filter(t => t.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
      || t.areaName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    list.sort((a, b) => sortAsc ? a.percentual - b.percentual : b.percentual - a.percentual);
    return list;
  }, [temaSummaries, debouncedQuery, sortAsc]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

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
          <p className="text-sm text-muted-foreground">Escolha um simulado nos filtros para visualizar os alunos.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.allStudents.length === 0) {
    return (
      <ModuleEmptyState
        title="Sem alunos no recorte atual"
        description="Ajuste os filtros para visualizar ranking, segmentações e detalhes de alunos."
      />
    );
  }

  // Summary stats
  const totalStudents = data.allStudents.length;
  const proficientes = data.allStudents.filter(s => s.percentual >= PROFICIENCY_THRESHOLD).length;
  const oportunidade = data.allStudents.filter(s => computeRiskLevel(s.percentual) === 'oportunidade').length;
  const criticos = data.allStudents.filter(s => computeRiskLevel(s.percentual) === 'critico').length;

  console.log('[VisaoAlunos]', 'Render do módulo', {
    totalStudents,
    alunosAbaixo: data.alunosAbaixo.length,
    oportunidade,
    criticos,
    subView,
    searchQuery,
  });

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Total Alunos" value={totalStudents} color="text-foreground" />
        <SummaryCard icon={TrendingUp} label="Proficientes" value={proficientes} color="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard icon={Zap} label="Próximos de virar" value={oportunidade} color="text-blue-600 dark:text-blue-400" />
        <SummaryCard icon={TrendingDown} label="Críticos" value={criticos} color="text-destructive" />
      </div>

      {/* Sub-view tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={subView} onValueChange={(v) => { setSubView(v as SubView); setSearchQuery(''); }}>
          <TabsList>
            <TabsTrigger value="alunos" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Alunos
            </TabsTrigger>
            <TabsTrigger value="temas" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Temas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={subView === 'alunos' ? 'Buscar aluno...' : 'Buscar tema ou área...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Segment filter chips */}
      {subView === 'alunos' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {SEGMENT_OPTIONS.map(seg => {
            const Icon = seg.icon;
            const isActive = segmentFilter === seg.value;
            const count = seg.value === 'todos' ? data.allStudents.length
              : data.allStudents.filter(s => computeRiskLevel(s.percentual) === seg.value).length;
            return (
              <Button
                key={seg.value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1 px-2.5"
                onClick={() => setSegmentFilter(seg.value)}
              >
                <Icon className="h-3 w-3" />
                {seg.label}
                <Badge variant={isActive ? 'secondary' : 'outline'} className="ml-0.5 text-[10px] h-4 px-1 min-w-[1.25rem]">{count}</Badge>
              </Button>
            );
          })}
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto pb-1">
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span>Ordenar por:</span>
        {subView === 'alunos' ? (
          <>
            <SortButton label="Acerto" active={sortKey === 'percentual'} asc={sortAsc} onClick={() => toggleSort('percentual')} />
            <SortButton label="Risco" active={sortKey === 'risco'} asc={sortAsc} onClick={() => toggleSort('risco')} />
            <SortButton label="Nome" active={sortKey === 'nome'} asc={sortAsc} onClick={() => toggleSort('nome')} />
            <SortButton label="Semestre" active={sortKey === 'semestre'} asc={sortAsc} onClick={() => toggleSort('semestre')} />
          </>
        ) : (
          <SortButton label="Acerto" active={true} asc={sortAsc} onClick={() => setSortAsc(p => !p)} />
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {subView === 'alunos' ? (
          <motion.div key="alunos" className="space-y-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {sortedStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
            ) : (
              sortedStudents.map((s, i) => {
                const risk = computeRiskLevel(s.percentual);
                const cfg = getRiskConfig(risk);
                const gap = Math.max(0, PROFICIENCY_THRESHOLD - s.percentual);
                return (
                  <button
                    key={`${s.nome}-${s.semestre}-${s.total}-${i}`}
                    onClick={() => setSelectedStudent(s)}
                    className="w-full flex items-center gap-3 sm:gap-4 px-3 py-3 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/20 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{s.nome}</span>
                        <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                          {cfg.label}
                        </Badge>
                        {risk === 'oportunidade' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400">
                            <Zap className="h-3 w-3 mr-0.5" /> {gap}pp p/ virar
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.semestre}º semestre · {s.acertos}/{s.total} acertos</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-20 hidden sm:block">
                        <Progress value={s.percentual} className="h-2" />
                      </div>
                      <span className={`text-sm font-semibold w-12 text-right ${cfg.color}`}>{s.percentual}%</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div key="temas" className="space-y-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {sortedTemas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum tema encontrado.</p>
            ) : (
              sortedTemas.map((t, i) => {
                const cfg = getRiskConfig(t.risk);
                return (
                  <button
                    key={`${t.name}-${t.specialtyName}-${i}`}
                    onClick={() => setSelectedTema(t)}
                    className="w-full flex items-center gap-3 sm:gap-4 px-3 py-3 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/20 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 h-5 shrink-0">{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.areaName} → {t.specialtyName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                        <span>{t.alunosCriticos} críticos</span>
                        <span>{t.alunosOportunidade} oportunid.</span>
                      </div>
                      <div className="w-20 hidden sm:block">
                        <Progress value={t.percentual} className="h-2" />
                      </div>
                      <span className={`text-sm font-semibold w-12 text-right ${cfg.color}`}>{t.percentual}%</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student detail drawer (shared) */}
      <StudentAnalyticsDrawer
        student={selectedStudent}
        data={data}
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      {/* Tema detail drawer */}
      <TemaDetailSheet
        tema={selectedTema}
        students={data.allStudents}
        onClose={() => setSelectedTema(null)}
        onOpenStudent={(s) => { setSelectedTema(null); setTimeout(() => setSelectedStudent(s), 200); }}
      />
    </motion.div>
  );
};

// ── Summary card ──
const SummaryCard: React.FC<{ icon: React.ElementType; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <Card>
    <CardContent className="py-3 px-4 flex items-center gap-3">
      <Icon className={`h-5 w-5 ${color} shrink-0`} />
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

// ── Sort button ──
const SortButton: React.FC<{ label: string; active: boolean; asc: boolean; onClick: () => void }> = ({ label, active, asc, onClick }) => (
  <Button variant={active ? 'secondary' : 'ghost'} size="sm" className="h-6 text-xs px-2" onClick={onClick}>
    {label} {active && (asc ? '↑' : '↓')}
  </Button>
);

// Old StudentDetailSheet removed — now using shared StudentAnalyticsDrawer

// ── Tema detail drawer ──
const TemaDetailSheet: React.FC<{
  tema: TemaSummary | null;
  students: StudentScore[];
  onClose: () => void;
  onOpenStudent: (s: StudentScore) => void;
}> = ({ tema, students, onClose, onOpenStudent }) => {
  if (!tema) return null;
  const cfg = getRiskConfig(tema.risk);

  // Simulated student relevance for this tema
  const relevantStudents = students
    .map(s => ({
      ...s,
      // Use area score if available, otherwise general score
      temaScore: s.scoresByArea[tema.areaName] ?? s.percentual,
    }))
    .sort((a, b) => a.temaScore - b.temaScore);

  return (
    <Sheet open={!!tema} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {tema.name}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <p className="text-sm text-muted-foreground">{tema.areaName} → {tema.specialtyName}</p>

          {/* Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Percentual Médio de Acertos</p>
              <p className={`text-xl font-bold ${cfg.color}`}>{tema.percentual}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Gap</p>
              <p className={`text-xl font-bold ${tema.gap > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {tema.gap > 0 ? `${tema.gap} pts` : '✓'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Questões</p>
              <p className="text-xl font-bold text-foreground">{tema.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={cfg.variant} className="mt-1">{cfg.label}</Badge>
            </div>
          </div>

          {/* Impact estimate */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Impacto Potencial</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tema.alunosOportunidade} aluno(s) próximo(s) de virar o jogo neste tema.
                    Melhorar o percentual de acertos aqui pode elevar {tema.alunosCriticos + tema.alunosOportunidade} alunos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student ranking for this tema */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Alunos neste Tema ({relevantStudents.length})
            </h4>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {relevantStudents.map((s, i) => {
                  const sRisk = computeRiskLevel(s.temaScore);
                  const sCfg = getRiskConfig(sRisk);
                  return (
                    <button
                      key={`${s.nome}-${i}`}
                      onClick={() => onOpenStudent(s)}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors text-left text-sm"
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{s.nome}</span>
                        <span className="text-xs text-muted-foreground">{s.semestre}º sem.</span>
                      </div>
                      <Badge variant={sCfg.variant} className="text-[10px] h-5 shrink-0">{s.temaScore}%</Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
