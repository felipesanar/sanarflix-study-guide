import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, RotateCcw, TrendingUp, Users, Target, AlertTriangle,
  ChevronRight, ArrowRight, Info, Sparkles, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type {
  InstitutionalViewModel,
  CurricularAreaNode,
  CurricularSpecialtyNode,
  CurricularTemaNode,
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

interface SimulationScenario {
  granularity: GranularityLevel;
  selectedArea: string;
  selectedSpecialty: string;
  selectedTema: string;
  improvement: number; // pp to add
  segment: SegmentFilter;
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
}

const DEFAULT_SCENARIO: SimulationScenario = {
  granularity: 'tema',
  selectedArea: '',
  selectedSpecialty: '',
  selectedTema: '',
  improvement: 5,
  segment: 'todos',
};

function getConceito(percentProficientes: number): string {
  if (percentProficientes >= 80) return '5';
  if (percentProficientes >= 60) return '4';
  if (percentProficientes >= 40) return '3';
  if (percentProficientes >= 20) return '2';
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

function simulateImpact(
  data: InstitutionalViewModel,
  scenario: SimulationScenario,
): SimulationResult | null {
  const totalStudents = data.headerSummary.totalAlunos;
  if (!totalStudents) return null;

  // Determine which node we're improving
  let targetLabel = '';
  let targetNode: { percentual: number; total: number } | null = null;

  if (scenario.granularity === 'area' && scenario.selectedArea) {
    const area = data.curricular.areas.find(a => a.name === scenario.selectedArea);
    if (!area) return null;
    targetNode = area;
    targetLabel = area.name;
  } else if (scenario.granularity === 'especialidade' && scenario.selectedSpecialty) {
    for (const area of data.curricular.areas) {
      const sp = area.specialties.find(s => s.name === scenario.selectedSpecialty);
      if (sp) { targetNode = sp; targetLabel = `${sp.name} (${area.name})`; break; }
    }
  } else if (scenario.granularity === 'tema' && scenario.selectedTema) {
    for (const area of data.curricular.areas) {
      for (const sp of area.specialties) {
        const tema = sp.temas.find(t => t.name === scenario.selectedTema);
        if (tema) { targetNode = tema; targetLabel = `${tema.name} (${sp.name})`; break; }
      }
      if (targetNode) break;
    }
  }

  if (!targetNode) return null;

  // Current state
  const currentProficientes = Math.round(totalStudents * data.headerSummary.percentProficientes / 100);
  const currentPercent = data.headerSummary.percentProficientes;

  // Find affected students based on segment
  let affectedStudents = data.allStudents.filter(s => s.percentual < PROFICIENCY_THRESHOLD);

  if (scenario.segment === 'proximos') {
    affectedStudents = affectedStudents.filter(s => s.percentual >= PROFICIENCY_THRESHOLD - 10);
  } else if (scenario.segment === 'risco') {
    affectedStudents = affectedStudents.filter(s => s.percentual < PROFICIENCY_THRESHOLD - 15);
  }

  // Estimate how many would cross the proficiency threshold
  // The improvement in a specific topic proportionally improves the student's overall score
  // Weight = topic questions / total questions
  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0);
  const weight = totalQuestions > 0 ? targetNode.total / totalQuestions : 0.1;
  const effectiveImprovement = scenario.improvement * weight;

  let newProficientes = 0;
  const movedStudents: StudentScore[] = [];

  for (const student of affectedStudents) {
    const simulatedScore = student.percentual + effectiveImprovement;
    if (simulatedScore >= PROFICIENCY_THRESHOLD && student.percentual < PROFICIENCY_THRESHOLD) {
      newProficientes++;
      movedStudents.push(student);
    }
  }

  const simulatedProficientes = currentProficientes + newProficientes;
  const simulatedPercent = Math.min(100, Math.round((simulatedProficientes / totalStudents) * 100 * 10) / 10);
  const deltaPercent = Math.round((simulatedPercent - currentPercent) * 10) / 10;

  const currentConceito = getConceito(currentPercent);
  const simulatedConceito = getConceito(simulatedPercent);

  // Build explanation
  const segmentLabel = scenario.segment === 'proximos' ? 'alunos próximos da proficiência'
    : scenario.segment === 'risco' ? 'alunos em risco' : 'todos os alunos afetados';

  const explanation = newProficientes > 0
    ? `Se a IES melhorar ${scenario.improvement} pontos em ${targetLabel} para ${segmentLabel}, ${newProficientes} aluno(s) podem atingir proficiência, elevando a taxa de ${currentPercent}% para ${simulatedPercent}%.`
    : `Uma melhoria de ${scenario.improvement} pontos em ${targetLabel} para ${segmentLabel} não seria suficiente para mover alunos acima do limiar de proficiência (${PROFICIENCY_THRESHOLD}%). Considere aumentar a meta ou focar em alunos mais próximos.`;

  const premisses = [
    `Limiar de proficiência: ${PROFICIENCY_THRESHOLD}%`,
    `Peso do alvo no total: ${(weight * 100).toFixed(1)}% (${targetNode.total}/${totalQuestions} questões)`,
    `Melhoria efetiva por aluno: +${effectiveImprovement.toFixed(1)}pp (${scenario.improvement}pp × ${(weight * 100).toFixed(1)}%)`,
    `Segmento: ${segmentLabel} (${affectedStudents.length} alunos)`,
    'Premissa: melhoria no tema propaga-se proporcionalmente ao score geral',
    'Simulação baseada em dados do último simulado — não é projeção garantida',
  ];

  return {
    currentProficientes,
    simulatedProficientes,
    newProficientes,
    currentPercent,
    simulatedPercent,
    deltaPercent,
    currentConceito,
    simulatedConceito,
    conceitoChanged: currentConceito !== simulatedConceito,
    affectedStudents: movedStudents,
    targetLabel,
    explanation,
    premisses,
  };
}

export const SimuladorImpactoModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [scenario, setScenario] = useState<SimulationScenario>(DEFAULT_SCENARIO);
  const [showResult, setShowResult] = useState(false);

  // Build option lists from data
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

  // All flat lists for direct selection
  const allSpecialties = useMemo(() =>
    areas.flatMap(a => a.specialties.map(sp => ({ ...sp, parentArea: a.name }))),
    [areas]);
  const allTemas = useMemo(() =>
    areas.flatMap(a => a.specialties.flatMap(sp => sp.temas.map(t => ({ ...t, parentArea: a.name, parentSpecialty: sp.name })))),
    [areas]);

  const result = useMemo(() => {
    if (!data || !showResult) return null;
    return simulateImpact(data, scenario);
  }, [data, scenario, showResult]);

  const updateScenario = useCallback((partial: Partial<SimulationScenario>) => {
    setScenario(prev => ({ ...prev, ...partial }));
    setShowResult(false);
  }, []);

  const resetScenario = useCallback(() => {
    setScenario(DEFAULT_SCENARIO);
    setShowResult(false);
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
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Simulador de Impacto — Dados Hipotéticos</p>
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

          {/* Improvement slider */}
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
            Simular Impacto
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
            {/* Before vs After comparison */}
            <Card className="border-2 border-dashed border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Resultado da Simulação
                  <Badge variant="outline" className="ml-auto text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    HIPOTÉTICO
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Explanation text */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-sm">{result.explanation}</p>
                </div>

                {/* Before/After grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground text-center">📊 Situação Atual</p>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Proficientes</p>
                      <p className="text-2xl font-bold">{result.currentProficientes}</p>
                      <p className="text-xs text-muted-foreground">{result.currentPercent}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Conceito</p>
                      <p className={`text-2xl font-bold ${getConceitoColor(result.currentConceito)}`}>{result.currentConceito}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground text-center">🔬 Cenário Simulado</p>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">Proficientes</p>
                      <p className="text-2xl font-bold text-primary">{result.simulatedProficientes}</p>
                      <p className="text-xs text-primary/80">{result.simulatedPercent}%</p>
                      {result.newProficientes > 0 && (
                        <Badge className="mt-1 text-[10px]" variant="default">
                          +{result.newProficientes} alunos
                        </Badge>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg text-center ${result.conceitoChanged ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/50'}`}>
                      <p className="text-xs text-muted-foreground">Conceito</p>
                      <p className={`text-2xl font-bold ${getConceitoColor(result.simulatedConceito)}`}>{result.simulatedConceito}</p>
                      {result.conceitoChanged && (
                        <Badge className="mt-1 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0">
                          <TrendingUp className="h-3 w-3 mr-0.5" /> Mudou!
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delta summary */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Δ Proficientes</p>
                    <p className={`text-lg font-bold ${result.newProficientes > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      +{result.newProficientes}
                    </p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Δ Taxa</p>
                    <p className={`text-lg font-bold ${result.deltaPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      +{result.deltaPercent}pp
                    </p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Conceito</p>
                    <p className="text-lg font-bold">
                      <span className={getConceitoColor(result.currentConceito)}>{result.currentConceito}</span>
                      <ArrowRight className="inline h-4 w-4 mx-1 text-muted-foreground" />
                      <span className={getConceitoColor(result.simulatedConceito)}>{result.simulatedConceito}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Moved students */}
            {result.affectedStudents.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
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
                            <span className="text-xs text-muted-foreground">{s.semestre}º sem. · {s.percentual}% atual</span>
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

            {/* Premisses card */}
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
