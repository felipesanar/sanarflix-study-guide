import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, RotateCcw, TrendingUp, Users, Target, AlertTriangle,
  ArrowRight, Info, Sparkles, CheckCircle2, Zap, Crosshair,
} from 'lucide-react';
import { TooltipInfo } from '@/components/analytics/v2/TooltipInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
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

type GranularityLevel = 'area' | 'especialidade' | 'tema';
type SegmentFilter = 'todos' | 'proximos' | 'risco';
type SimulationMode = 'effort' | 'goal';

interface SimulationScenario {
  granularity: GranularityLevel;
  selectedArea: string;
  selectedSpecialty: string;
  selectedTema: string;
  improvement: number;
  segment: SegmentFilter;
  desiredRecovered: number;
}

interface SimulationResult {
  currentProficientes: number;
  simulatedProficientes: number;
  newProficientes: number;
  currentPercent: number;
  simulatedPercent: number;
  deltaPercent: number;
  currentConceito: string;
  simulatedConceito: string;
  conceitoChanged: boolean;
  affectedStudents: StudentScore[];
  targetLabel: string;
  explanation: string;
  premisses: string[];
  totalImpactados: number;
  taxaConversao: number;
  eficiencia: number;
  targetTotal: number;
  totalQuestions: number;
  weight: number;
  effectiveImprovement: number;
  // Goal mode specific
  requiredEffort?: number;
  isInfeasible?: boolean;
  isTrivial?: boolean;
}

const DEFAULT_SCENARIO: SimulationScenario = {
  granularity: 'tema',
  selectedArea: '',
  selectedSpecialty: '',
  selectedTema: '',
  improvement: 5,
  segment: 'todos',
  desiredRecovered: 1,
};

function getConceito(percentProficientes: number): string {
  if (percentProficientes >= 90) return '5';
  if (percentProficientes >= 75) return '4';
  if (percentProficientes >= 60) return '3';
  if (percentProficientes >= 40) return '2';
  return '1';
}

function getConceitoColor(conceito: string): string {
  switch (conceito) {
    case '5': return 'text-emerald-600 dark:text-emerald-400';
    case '4': return 'text-blue-600 dark:text-blue-400';
    case '3': return 'text-amber-600 dark:text-amber-400';
    case '2': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-destructive';
  }
}

function resolveTargetNode(
  data: InstitutionalViewModel,
  scenario: SimulationScenario,
): { targetNode: { percentual: number; total: number }; targetLabel: string } | null {
  if (scenario.granularity === 'area' && scenario.selectedArea) {
    const area = data.curricular.areas.find(a => a.name === scenario.selectedArea);
    if (!area) return null;
    return { targetNode: area, targetLabel: area.name };
  }
  if (scenario.granularity === 'especialidade' && scenario.selectedSpecialty) {
    for (const area of data.curricular.areas) {
      const sp = area.specialties.find(s => s.name === scenario.selectedSpecialty);
      if (sp) return { targetNode: sp, targetLabel: `${sp.name} (${area.name})` };
    }
  }
  if (scenario.granularity === 'tema' && scenario.selectedTema) {
    for (const area of data.curricular.areas) {
      for (const sp of area.specialties) {
        const tema = sp.temas.find(t => t.name === scenario.selectedTema);
        if (tema) return { targetNode: tema, targetLabel: `${tema.name} (${sp.name})` };
      }
    }
  }
  return null;
}

function getFilteredStudents(data: InstitutionalViewModel, segment: SegmentFilter): StudentScore[] {
  let students = data.allStudents.filter(s => s.percentual < PROFICIENCY_THRESHOLD);
  if (segment === 'proximos') {
    students = students.filter(s => s.percentual >= PROFICIENCY_THRESHOLD - 10);
  } else if (segment === 'risco') {
    students = students.filter(s => s.percentual < PROFICIENCY_THRESHOLD - 15);
  }
  return students;
}

function simulateByEffort(
  data: InstitutionalViewModel,
  scenario: SimulationScenario,
  improvementOverride?: number,
): SimulationResult | null {
  const totalStudents = data.headerSummary.totalAlunos;
  if (!totalStudents) return null;

  const resolved = resolveTargetNode(data, scenario);
  if (!resolved) return null;
  const { targetNode, targetLabel } = resolved;

  const currentProficientes = Math.round(totalStudents * data.headerSummary.percentProficientes / 100);
  const currentPercent = data.headerSummary.percentProficientes;
  const affectedStudents = getFilteredStudents(data, scenario.segment);

  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0);
  const weight = totalQuestions > 0 ? targetNode.total / totalQuestions : 0.1;
  const improvement = improvementOverride ?? scenario.improvement;
  const effectiveImprovement = improvement * weight;

  let newProficientes = 0;
  const movedStudents: StudentScore[] = [];

  for (const student of affectedStudents) {
    const simulatedScore = Math.min(100, student.percentual + effectiveImprovement);
    if (simulatedScore >= PROFICIENCY_THRESHOLD && student.percentual < PROFICIENCY_THRESHOLD) {
      newProficientes++;
      movedStudents.push(student);
    }
  }

  const totalImpactados = affectedStudents.length;
  const taxaConversao = totalImpactados > 0 ? Math.round((newProficientes / totalImpactados) * 1000) / 10 : 0;
  const eficiencia = improvement > 0 ? Math.round((newProficientes / improvement) * 10) / 10 : 0;

  const simulatedProficientes = currentProficientes + newProficientes;
  const simulatedPercent = Math.min(100, Math.round((simulatedProficientes / totalStudents) * 100 * 10) / 10);
  const deltaPercent = Math.round((simulatedPercent - currentPercent) * 10) / 10;

  const currentConceito = getConceito(currentPercent);
  const simulatedConceito = getConceito(simulatedPercent);

  const segmentLabel = scenario.segment === 'proximos' ? 'alunos próximos da proficiência'
    : scenario.segment === 'risco' ? 'alunos em risco' : 'todos os alunos afetados';

  const explanation = newProficientes > 0
    ? `Se a IES melhorar ${improvement} pontos em ${targetLabel} para ${segmentLabel}, ${newProficientes} aluno(s) podem atingir proficiência, elevando a taxa de ${currentPercent}% para ${simulatedPercent}%.`
    : `Uma melhoria de ${improvement} pontos em ${targetLabel} para ${segmentLabel} não seria suficiente para mover alunos acima do limiar de proficiência (${PROFICIENCY_THRESHOLD}%). Considere aumentar a meta ou focar em alunos mais próximos.`;

  const premisses = [
    `Limiar de proficiência: ${PROFICIENCY_THRESHOLD}%`,
    `Peso do alvo no total: ${(weight * 100).toFixed(1)}% (${targetNode.total}/${totalQuestions} questões)`,
    `Melhoria efetiva por aluno: +${effectiveImprovement.toFixed(1)}pts (${improvement}pts × ${(weight * 100).toFixed(1)}%)`,
    `Segmento: ${segmentLabel} (${affectedStudents.length} alunos)`,
    'Premissa: melhoria no tema propaga-se proporcionalmente ao score geral',
    'Simulação baseada em dados do último simulado — não é projeção garantida',
  ];

  const result: SimulationResult = {
    currentProficientes, simulatedProficientes, newProficientes,
    currentPercent, simulatedPercent, deltaPercent,
    currentConceito, simulatedConceito,
    conceitoChanged: currentConceito !== simulatedConceito,
    affectedStudents: movedStudents, targetLabel, explanation, premisses,
    totalImpactados, taxaConversao, eficiencia,
    targetTotal: targetNode.total, totalQuestions, weight, effectiveImprovement,
  };

  console.log('[ImpactSimulator][Effort]', {
    inputs: { improvement, weight, effectiveImprovement, segment: scenario.segment },
    outputs: { newProficientes, totalImpactados, taxaConversao, eficiencia, deltaPercent },
  });

  return result;
}

function simulateByGoal(
  data: InstitutionalViewModel,
  scenario: SimulationScenario,
): SimulationResult | null {
  const totalStudents = data.headerSummary.totalAlunos;
  if (!totalStudents) return null;

  const resolved = resolveTargetNode(data, scenario);
  if (!resolved) return null;
  const { targetNode } = resolved;

  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0);
  const weight = totalQuestions > 0 ? targetNode.total / totalQuestions : 0.1;

  if (weight <= 0) return null;

  const eligible = getFilteredStudents(data, scenario.segment)
    .map(s => ({ ...s, gap: PROFICIENCY_THRESHOLD - s.percentual }))
    .filter(s => s.gap > 0)
    .sort((a, b) => a.gap - b.gap);

  const desired = Math.min(scenario.desiredRecovered, eligible.length);
  if (desired <= 0) return null;

  const targetStudents = eligible.slice(0, desired);
  const maxGap = Math.max(...targetStudents.map(s => s.gap));
  const requiredEffort = maxGap / weight;
  const isInfeasible = requiredEffort > 100;
  const isTrivial = requiredEffort < 1;
  const clampedEffort = Math.min(100, Math.max(0, requiredEffort));

  console.log('[ImpactSimulator][Mode]', 'goal');
  console.log('[ImpactSimulator][Goal]', {
    desiredRecovered: desired, requiredEffort: Math.round(requiredEffort * 10) / 10,
    maxGap: Math.round(maxGap * 10) / 10, weight, isInfeasible,
  });

  // Run the effort simulation with the calculated effort to get unified outputs
  const result = simulateByEffort(data, scenario, clampedEffort);
  if (!result) return null;

  return {
    ...result,
    requiredEffort: Math.round(requiredEffort * 10) / 10,
    isInfeasible,
    isTrivial,
  };
}

export const SimuladorImpactoModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [scenario, setScenario] = useState<SimulationScenario>(DEFAULT_SCENARIO);
  const [showResult, setShowResult] = useState(false);
  const [mode, setMode] = useState<SimulationMode>('effort');

  const areas = useMemo(() => data?.curricular.areas ?? [], [data]);
  const specialties = useMemo(() => {
    if (!scenario.selectedArea) return [];
    const area = areas.find(a => a.name === scenario.selectedArea);
    return area?.specialties ?? [];
  }, [areas, scenario.selectedArea]);
  const temas = useMemo(() => {
    if (!scenario.selectedSpecialty) return [];
    const sp = specialties.find(s => s.name === scenario.selectedSpecialty);
    return sp?.temas ?? [];
  }, [specialties, scenario.selectedSpecialty]);

  const allSpecialties = useMemo(() =>
    areas.flatMap(a => a.specialties.map(sp => ({ ...sp, parentArea: a.name }))),
    [areas]);

  // Count eligible students for goal mode max
  const eligibleCount = useMemo(() => {
    if (!data) return 0;
    return getFilteredStudents(data, scenario.segment)
      .filter(s => s.percentual < PROFICIENCY_THRESHOLD).length;
  }, [data, scenario.segment]);

  const result = useMemo(() => {
    if (!data || !showResult) return null;
    if (mode === 'goal') return simulateByGoal(data, scenario);
    return simulateByEffort(data, scenario);
  }, [data, scenario, showResult, mode]);

  const updateScenario = useCallback((partial: Partial<SimulationScenario>) => {
    setScenario(prev => ({ ...prev, ...partial }));
    setShowResult(false);
  }, []);

  const resetScenario = useCallback(() => {
    setScenario(DEFAULT_SCENARIO);
    setShowResult(false);
  }, []);

  const handleModeChange = useCallback((value: string) => {
    if (value === 'effort' || value === 'goal') {
      setMode(value);
      setShowResult(false);
    }
  }, []);

  const canSimulate = useMemo(() => {
    if (scenario.granularity === 'area') return !!scenario.selectedArea;
    if (scenario.granularity === 'especialidade') return !!scenario.selectedSpecialty;
    return !!scenario.selectedTema;
  }, [scenario]);

  if (loading) {
    return (
      <Card className="border-dashed animate-pulse">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Carregando simulador...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-dashed border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive mb-4" />
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
          <FlaskConical className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-2">Selecione um simulado</h3>
          <p className="text-sm text-muted-foreground">Escolha um simulado para iniciar o simulador de impacto.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Simulation disclaimer */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                Simulador de Impacto — Dados Hipotéticos
                <TooltipInfo
                  section="simulador_impacto"
                  text={"Simule intervenções pedagógicas e veja quantos alunos podem atingir proficiência.\n\nVocê pode:\n• Escolher área, especialidade ou tema\n• Ajustar o nível de melhoria\n• Selecionar o grupo de alunos\n\nO simulador estima o impacto real na taxa de proficiência com base no peso do conteúdo no exame."}
                />
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                Os resultados abaixo são <strong>simulações</strong> baseadas em premissas estatísticas.
                Não representam previsões garantidas. Use como ferramenta de apoio à decisão.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" /> Configurar Cenário
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={resetScenario}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode toggle */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Modo de simulação</label>
            <ToggleGroup type="single" value={mode} onValueChange={handleModeChange} className="w-full">
              <ToggleGroupItem value="effort" className="flex-1 text-xs gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Explorar impacto
              </ToggleGroupItem>
              <ToggleGroupItem value="goal" className="flex-1 text-xs gap-1.5">
                <Crosshair className="h-3.5 w-3.5" />
                Definir meta
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[10px] text-muted-foreground mt-1">
              {mode === 'effort'
                ? 'Simule uma melhoria e veja quantos alunos se tornam proficientes'
                : 'Defina quantos alunos quer recuperar e veja o esforço necessário'}
            </p>
          </div>

          {/* Granularity selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Nível de intervenção</label>
            <Tabs value={scenario.granularity} onValueChange={(v) => updateScenario({ granularity: v as GranularityLevel, selectedArea: '', selectedSpecialty: '', selectedTema: '' })}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="area" className="text-xs">Área</TabsTrigger>
                <TabsTrigger value="especialidade" className="text-xs">Especialidade</TabsTrigger>
                <TabsTrigger value="tema" className="text-xs">Tema</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Target selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scenario.granularity === 'area' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Área</label>
                <Select value={scenario.selectedArea} onValueChange={(v) => updateScenario({ selectedArea: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma área" /></SelectTrigger>
                  <SelectContent>
                    {areas.map(a => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name} ({a.percentual}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scenario.granularity === 'especialidade' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Especialidade</label>
                <Select value={scenario.selectedSpecialty} onValueChange={(v) => updateScenario({ selectedSpecialty: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma especialidade" /></SelectTrigger>
                  <SelectContent>
                    {allSpecialties.map(sp => (
                      <SelectItem key={`${sp.parentArea}-${sp.name}`} value={sp.name}>
                        {sp.name} — {sp.parentArea} ({sp.percentual}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scenario.granularity === 'tema' && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Área</label>
                  <Select value={scenario.selectedArea} onValueChange={(v) => updateScenario({ selectedArea: v, selectedSpecialty: '', selectedTema: '' })}>
                    <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Especialidade</label>
                  <Select value={scenario.selectedSpecialty} onValueChange={(v) => updateScenario({ selectedSpecialty: v, selectedTema: '' })} disabled={!scenario.selectedArea}>
                    <SelectTrigger><SelectValue placeholder="Especialidade" /></SelectTrigger>
                    <SelectContent>
                      {specialties.map(sp => (
                        <SelectItem key={sp.name} value={sp.name}>{sp.name} ({sp.percentual}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tema</label>
                  <Select value={scenario.selectedTema} onValueChange={(v) => updateScenario({ selectedTema: v })} disabled={!scenario.selectedSpecialty}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tema" /></SelectTrigger>
                    <SelectContent>
                      {temas.map(t => (
                        <SelectItem key={t.name} value={t.name}>{t.name} ({t.percentual}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Conditional slider based on mode */}
          {mode === 'effort' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Melhoria simulada</label>
                <Badge variant="outline" className="text-xs font-mono">+{scenario.improvement}pp</Badge>
              </div>
              <Slider
                value={[scenario.improvement]}
                onValueChange={([v]) => updateScenario({ improvement: v })}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>+1pp</span>
                <span>+15pp</span>
                <span>+30pp</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Quantos alunos quer tornar proficientes?</label>
                <Badge variant="outline" className="text-xs font-mono">{scenario.desiredRecovered} {scenario.desiredRecovered === 1 ? 'aluno' : 'alunos'}</Badge>
              </div>
              <Slider
                value={[scenario.desiredRecovered]}
                onValueChange={([v]) => updateScenario({ desiredRecovered: v })}
                min={1}
                max={Math.max(1, eligibleCount)}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 aluno</span>
                <span>{Math.max(1, eligibleCount)} alunos</span>
              </div>
            </div>
          )}

          {/* Segment filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Segmento de alunos</label>
            <Tabs value={scenario.segment} onValueChange={(v) => updateScenario({ segment: v as SegmentFilter })}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="todos" className="text-xs">Todos</TabsTrigger>
                <TabsTrigger value="proximos" className="text-xs">Próximos</TabsTrigger>
                <TabsTrigger value="risco" className="text-xs">Em risco</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-[10px] text-muted-foreground mt-1">
              {scenario.segment === 'proximos' ? 'Alunos a menos de 10pp da proficiência' :
               scenario.segment === 'risco' ? 'Alunos a mais de 15pp da proficiência' :
               'Todos os alunos abaixo da proficiência'}
            </p>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!canSimulate}
            onClick={() => setShowResult(true)}
          >
            <FlaskConical className="h-4 w-4" />
            {mode === 'effort' ? 'Simular Impacto' : 'Calcular Esforço'}
          </Button>
        </CardContent>
      </Card>

      {/* Simulation result */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Goal mode: infeasible warning */}
            {mode === 'goal' && result.isInfeasible && (
              <Card className="border-2 border-destructive/40 bg-destructive/5">
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Meta inviável apenas com este tema</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O esforço necessário ({result.requiredEffort}pp) ultrapassa o limite de 100pp.
                        Considere combinar com outros temas ou reduzir a meta.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goal mode: trivial badge */}
            {mode === 'goal' && result.isTrivial && !result.isInfeasible && (
              <Card className="border-2 border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Meta atingível com esforço mínimo ({result.requiredEffort}pp)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 1. HERO KPI — Alunos recuperados */}
            <Card className={`border-2 ${result.newProficientes > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dashed border-muted-foreground/20'}`}>
              <CardContent className="py-6 px-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={`rounded-full p-3 ${result.newProficientes > 0 ? 'bg-emerald-500/10' : 'bg-muted/50'}`}>
                    <Users className={`h-6 w-6 ${result.newProficientes > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                  </div>
                  <p className={`text-4xl sm:text-5xl font-bold ${result.newProficientes > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {result.newProficientes}
                  </p>
                  <p className="text-sm font-medium">
                    {result.newProficientes === 1 ? 'aluno se torna proficiente' : 'alunos se tornam proficientes'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    <span>{result.totalImpactados} alunos impactados</span>
                    <span className="hidden sm:inline">·</span>
                    <span>Taxa de conversão: {result.taxaConversao.toFixed(1)}%</span>
                  </div>
                  {mode === 'goal' && result.requiredEffort !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Crosshair className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        Esforço necessário: {result.requiredEffort}pp
                      </span>
                    </div>
                  )}
                  <Badge variant="outline" className="mt-1 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    HIPOTÉTICO
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 2. Impacto institucional — métricas secundárias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="py-4 px-4 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Δ Taxa Proficiência</p>
                  <p className={`text-xl font-bold ${result.deltaPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    +{result.deltaPercent}pp
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{result.currentPercent}% → {result.simulatedPercent}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 px-4 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Conceito</p>
                  <p className="text-xl font-bold">
                    <span className={getConceitoColor(result.currentConceito)}>{result.currentConceito}</span>
                    <ArrowRight className="inline h-4 w-4 mx-1 text-muted-foreground" />
                    <span className={getConceitoColor(result.simulatedConceito)}>{result.simulatedConceito}</span>
                  </p>
                  {result.conceitoChanged && (
                    <Badge className="mt-1 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0">
                      <TrendingUp className="h-3 w-3 mr-0.5" /> Mudou!
                    </Badge>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 px-4 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Eficiência</p>
                  <p className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {result.eficiencia.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">alunos/pp aplicado</p>
                </CardContent>
              </Card>
            </div>

            {/* 3. Explicação dinâmica (transparência) */}
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="py-4 px-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm">
                      {mode === 'effort'
                        ? result.explanation
                        : result.newProficientes > 0
                          ? `Para recuperar ${scenario.desiredRecovered} aluno(s), você precisa melhorar aproximadamente ${result.requiredEffort}pp em ${result.targetLabel}. Com esse esforço, ${result.newProficientes} aluno(s) atingiriam proficiência.`
                          : `Não foi possível encontrar alunos elegíveis para recuperação com os filtros atuais.`
                      }
                    </p>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      Este tema representa <strong>{result.targetTotal}</strong> de <strong>{result.totalQuestions}</strong> questões
                      ({(result.weight * 100).toFixed(1)}%). Uma melhoria de {mode === 'effort' ? scenario.improvement : result.requiredEffort} pontos gera <strong>+{result.effectiveImprovement.toFixed(1)}</strong> pontos no score geral dos alunos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Alunos recuperados */}
            {result.affectedStudents.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Alunos que atingiriam proficiência ({result.affectedStudents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {result.affectedStudents.map((s, i) => (
                        <div key={`${s.nome}-${i}`} className="flex items-center justify-between p-2 rounded-md bg-emerald-500/5 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{s.nome}</span>
                            <span className="text-xs text-muted-foreground">{s.semestre}º sem. · {s.percentual.toFixed(1)}% atual</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">→ proficiente</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* 5. Premissas */}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Premissas do Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {result.premisses.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-muted-foreground/50 mt-px">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
