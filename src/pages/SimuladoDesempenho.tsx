import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy, Target, TrendingUp, BarChart3, BarChart, Loader2, FileText, Star, TrendingDown, HelpCircle, ChevronsUpDown, ChevronLeft, ChevronRight, XCircle, CheckCircle, Ban, FileDown, ChevronDown, BookOpen, ClipboardList, RefreshCw } from 'lucide-react';
import { generateGabaritoPDF, GabaritoQuestao } from '@/utils/pdfGabarito';
import { generateProvaRevisadaPDF, QuestaoRevisada, ProvaRevisadaStats } from '@/utils/pdfProvaRevisada';
import { toast } from '@/hooks/use-toast';
import { ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, BarChart as RechartsBarChart, Bar } from 'recharts';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AddToErrorNotebookButton } from '@/components/caderno-erros/AddToErrorNotebookButton';
import { AddToErrorNotebookDrawer } from '@/components/caderno-erros/AddToErrorNotebookDrawer';

console.log('[UIUX] SimuladoDesempenho page loaded');

// Helper component to manage error notebook state per question inside the modal
const ErrorNotebookButtonInModal: React.FC<{
  questionId: string;
  simuladoId: string;
  simuladoNome: string;
  wasCorrect: boolean;
  grandeArea: string | null;
  especialidade: string | null;
  tema: string | null;
}> = ({ questionId, simuladoId, simuladoNome, wasCorrect, grandeArea, especialidade, tema }) => {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <>
      <AddToErrorNotebookButton
        key={refreshKey}
        questionId={questionId}
        simuladoId={simuladoId}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
      <AddToErrorNotebookDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        questionId={questionId}
        simuladoId={simuladoId}
        simuladoNome={simuladoNome}
        grandeArea={grandeArea}
        especialidade={especialidade}
        tema={tema}
        wasCorrect={wasCorrect}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
    </>
  );
};

// --- Interfaces ---
interface Simulado { id: string; nome: string; }
interface PerformanceData { name: string; total: number; acertos: number; percentual: number; }
interface SpecialtyPerformanceData extends PerformanceData { area_name?: string; area_id?: number; }
interface SubspecialtyPerformanceData extends PerformanceData { specialty_name?: string; specialty_id?: number; area_name?: string; }
interface RankingData { rank: number; total: number; }
interface OverallStats { total: number; acertos: number; percentual: number; }
interface UserData { semestre: number; }
interface ReviewedQuestion {
  id: string;
  gabarito: 'A' | 'B' | 'C' | 'D';
  enunciado: string;
  a: string; b: string; c: string; d: string;
  comentario: string;
  imagem: string | null;
  acertou: boolean;
  user_answer?: string | null;
  anulada?: boolean;
}

// --- Premium Tooltip ---
const PremiumChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border/50 rounded-xl shadow-lg px-4 py-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{data.name}</p>
        <p className="text-muted-foreground">
          Acertos: <span className="font-bold text-foreground">{data.acertos}/{data.total}</span>
        </p>
        <p className="text-muted-foreground">
          Percentual: <span className="font-bold text-foreground">{data.value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === 0 || height < 14) return null;
  return (
    <text x={x + width / 2} y={y + height / 2} fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="bold">
      {value}%
    </text>
  );
};



// --- Premium Question Modal ---
const QuestionModal: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questions: ReviewedQuestion[];
  isLoading: boolean;
  simuladoId?: string | null;
  simuladoNome?: string;
}> = ({ isOpen, onOpenChange, questions, isLoading, simuladoId, simuladoNome }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => { if (isOpen) { setCurrentIndex(0); } }, [isOpen, questions]);

  const handleNext = () => setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  const question = questions.length > 0 ? questions[currentIndex] : null;
  const alternatives: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> = question ? [{ key: 'A', text: question.a }, { key: 'B', text: question.b }, { key: 'C', text: question.c }, { key: 'D', text: question.d }] : [];
  const userGotItRight = question?.acertou;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-border/40">
          <div className="flex justify-between items-center gap-3">
            <DialogTitle className="text-base font-bold tracking-tight">Revisão de Questão</DialogTitle>
            <div className="flex items-center gap-2">
              {question?.anulada && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 gap-1 rounded-lg text-[11px] font-semibold">
                  <Ban className="h-3 w-3" /> ANULADA
                </Badge>
              )}
              {question && (() => {
                const notAnswered = !question.user_answer;
                const isCorrect = question.anulada ? true : userGotItRight;
                const statusClass = notAnswered && !question.anulada
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : (isCorrect ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400");
                const icon = notAnswered && !question.anulada
                  ? <HelpCircle className="h-3.5 w-3.5" />
                  : (isCorrect ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />);
                const label = question.anulada
                  ? "Pontuação garantida"
                  : (notAnswered ? "Não respondida" : (userGotItRight ? "Você acertou" : "Você errou"));
                return (
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold", statusClass)}>
                    {icon}
                    <span>{label}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto px-5 sm:px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              <p className="text-sm text-muted-foreground">Buscando questões...</p>
            </div>
          ) : question ? (
            <div className="space-y-5 py-5">
              <p className="text-[15px] leading-[1.8] whitespace-pre-wrap text-foreground/90">{question.enunciado}</p>
              {question.imagem && (
                <div className="flex justify-center">
                  <img src={question.imagem} alt="Imagem da questão" className="max-w-full h-auto rounded-xl border border-border/30" />
                </div>
              )}
              <div className="space-y-2.5">
                {alternatives.map(alt => {
                  const isCorrectAnswer = question.gabarito === alt.key;
                  const isUserWrongSelection = question.user_answer === alt.key && !question.acertou;
                  return (
                    <div key={alt.key} className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-colors",
                      isCorrectAnswer
                        ? "bg-green-50 border-green-500/30 dark:bg-green-950/60 dark:border-green-500/40"
                        : isUserWrongSelection
                          ? "bg-red-50 border-red-500/30 dark:bg-red-950/60 dark:border-red-500/40"
                          : "bg-card border-border/40"
                    )}>
                      <span className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0",
                        isCorrectAnswer ? "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-300" :
                        isUserWrongSelection ? "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-300" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {alt.key}
                      </span>
                      <span className={cn(
                        "leading-relaxed flex-1 pt-0.5",
                        isCorrectAnswer && "text-green-900 dark:text-green-100 font-medium",
                        isUserWrongSelection && "text-red-900 dark:text-red-100"
                      )}>
                        {alt.text}
                      </span>
                      {isCorrectAnswer && <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-1" />}
                      {isUserWrongSelection && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-1" />}
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4 space-y-2">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Comentário do Professor
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{question.comentario}</p>
              </div>
              {simuladoId && (
                <ErrorNotebookButtonInModal
                  questionId={question.id}
                  simuladoId={simuladoId}
                  simuladoNome={simuladoNome || 'Simulado'}
                  wasCorrect={question.acertou}
                  grandeArea={null}
                  especialidade={null}
                  tema={null}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-muted-foreground">Nenhuma questão encontrada para esta subespecialidade.</p>
            </div>
          )}
        </div>
        {questions.length > 1 && (
          <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-border/40 flex flex-col sm:flex-row justify-between items-center gap-3 bg-muted/[0.02]">
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0} className="w-full sm:w-auto order-2 sm:order-1 rounded-xl h-10">
              <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground font-semibold tabular-nums order-1 sm:order-2">
              Questão {currentIndex + 1} de {questions.length}
            </span>
            <Button variant="outline" onClick={handleNext} disabled={currentIndex === questions.length - 1} className="w-full sm:w-auto order-3 rounded-xl h-10">
              Próxima <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Performance Summary ---
const PerformanceSummary: React.FC<{
  stats: OverallStats;
  performancePorArea: PerformanceData[];
  bySpecialty: SpecialtyPerformanceData[];
}> = ({ stats, performancePorArea, bySpecialty }) => {
  if (performancePorArea.length === 0) return null;
  const sortedAreas = [...performancePorArea].sort((a, b) => b.percentual - a.percentual);
  const bestArea = sortedAreas[0];
  const worstArea = sortedAreas[sortedAreas.length - 1];
  const bestSpecialtyInBestArea = bySpecialty.filter(s => s.area_name === bestArea.name).sort((a, b) => b.percentual - a.percentual)[0];
  const specialtiesToImprove = bySpecialty.filter(s => s.area_name === worstArea.name).sort((a, b) => a.percentual - b.percentual).slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="rounded-2xl border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            Relatório de Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            Seu aproveitamento geral foi de <strong className="text-foreground">{stats.percentual}%</strong> ({stats.acertos}/{stats.total} questões). Veja abaixo os principais destaques para guiar seus estudos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pontos Fortes */}
            <div className="rounded-xl border border-green-500/15 bg-green-500/[0.03] p-4 space-y-2.5">
              <h3 className="font-semibold flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <Star className="h-4 w-4" /> Pontos Fortes
              </h3>
              <p className="text-muted-foreground leading-relaxed text-[13px]">
                Sua principal fortaleza foi em <strong className="text-foreground">{bestArea.name}</strong>, com <strong className="text-foreground">{bestArea.percentual}%</strong> de acertos.
              </p>
              {bestSpecialtyInBestArea && (
                <p className="text-muted-foreground text-[13px]">
                  Destaque em <strong className="text-foreground">{bestSpecialtyInBestArea.name}</strong> ({bestSpecialtyInBestArea.percentual}%).
                </p>
              )}
            </div>

            {/* Oportunidades */}
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4 space-y-2.5">
              <h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                <TrendingDown className="h-4 w-4" /> Oportunidades de Melhoria
              </h3>
              <p className="text-muted-foreground leading-relaxed text-[13px]">
                A área com maior oportunidade é <strong className="text-foreground">{worstArea.name}</strong>, com <strong className="text-foreground">{worstArea.percentual}%</strong> de acertos.
              </p>
              {specialtiesToImprove.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-[13px] mb-1">Foque nos temas:</p>
                  <ul className="list-disc list-inside text-muted-foreground/80 text-[13px] space-y-0.5">
                    {specialtiesToImprove.map(s => <li key={s.name}>{s.name} ({s.percentual}%)</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
};

// --- Decomposition Tree Components ---
const Node: React.FC<{ name: string; percentage: number; isSelected: boolean; onClick: () => void; }> = ({ name, percentage, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "card-container w-full text-left p-3.5 rounded-xl border transition-all duration-200",
      isSelected
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card border-border/40 hover:bg-accent/30 hover:border-border/60"
    )}
  >
    <div className="flex justify-between items-center gap-2">
      <span className="font-medium text-sm font-dynamic pr-2">{name}</span>
      <span className={cn(
        "font-bold text-sm tabular-nums",
        isSelected ? "text-primary-foreground" : "text-primary"
      )}>
        {percentage}%
      </span>
    </div>
  </button>
);

const Column: React.FC<{ title: string; children: React.ReactNode; isEmpty?: boolean; emptyText?: string; className?: string }> = ({ title, children, isEmpty = false, emptyText = "Selecione um item na coluna anterior.", className }) => (
  <div className={cn("flex-1 min-w-0 md:min-w-[200px] lg:min-w-[250px]", className)}>
    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{title}</h3>
    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
      {isEmpty ? (
        <div className="flex items-center justify-center h-32 text-center text-muted-foreground/60 text-xs p-4 border border-dashed border-border/40 rounded-xl">
          {emptyText}
        </div>
      ) : children}
    </div>
  </div>
);

const listContainerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const listItemVariants = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }, exit: { opacity: 0, y: -12, transition: { duration: 0.2 } } };

const DecompositionTree: React.FC<{
  overallStats: OverallStats;
  areas: PerformanceData[];
  specialties: SpecialtyPerformanceData[];
  subspecialties: SubspecialtyPerformanceData[];
  onSubspecialtyClick: (subspecialtyName: string, areaName: string | null, specialtyName: string | null) => void;
  selectedSimulado: string | null;
}> = ({ overallStats, areas, specialties, subspecialties, onSubspecialtyClick, selectedSimulado }) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  useEffect(() => { setSelectedArea(null); setSelectedSpecialty(null); }, [selectedSimulado]);

  const handleAreaClick = (areaName: string) => { if (selectedArea === areaName) { setSelectedArea(null); setSelectedSpecialty(null); } else { setSelectedArea(areaName); setSelectedSpecialty(null); } };
  const handleSpecialtyClick = (specialtyName: string) => { setSelectedSpecialty(prevState => prevState === specialtyName ? null : specialtyName); };

  const filteredSpecialties = selectedArea ? specialties.filter(s => s.area_name && s.area_name.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueFilteredSpecialties = filteredSpecialties.filter((specialty, index, self) => index === self.findIndex((s) => s.name.toLowerCase() === specialty.name.toLowerCase())).sort((a, b) => b.percentual - a.percentual);
  const filteredSubspecialties = selectedArea && selectedSpecialty ? subspecialties.filter(s => s.specialty_name?.toLowerCase() === selectedSpecialty.toLowerCase() && s.area_name?.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueFilteredSubspecialties = filteredSubspecialties.filter((sub, index, self) => index === self.findIndex((s) => s.name.toLowerCase() === sub.name.toLowerCase())).sort((a, b) => b.percentual - a.percentual);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="rounded-2xl border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart className="h-4 w-4 text-primary" />
            </div>
            Análise Hierárquica
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Overall stat */}
            <div className="lg:border-r lg:border-border/30 lg:pr-6 space-y-3">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Aproveitamento</h3>
              <div className="flex items-center justify-center bg-primary text-primary-foreground p-4 rounded-xl min-w-0 sm:min-w-[180px]">
                <div className="text-center">
                  <p className="text-3xl font-bold tracking-tight">{overallStats.percentual}%</p>
                  <p className="text-xs opacity-80 mt-1">{overallStats.acertos} / {overallStats.total} questões</p>
                </div>
              </div>
            </div>

            {/* Columns */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Column title="Grande Área">
                <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                  {areas.map(area => (
                    <motion.div key={area.name} variants={listItemVariants}>
                      <Node name={area.name} percentage={area.percentual} isSelected={selectedArea === area.name} onClick={() => handleAreaClick(area.name)} />
                    </motion.div>
                  ))}
                </motion.div>
              </Column>

              <Column title="Especialidade" isEmpty={!selectedArea || uniqueFilteredSpecialties.length === 0} emptyText={!selectedArea ? "Selecione uma Grande Área." : "Nenhuma especialidade encontrada."}>
                <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                  <AnimatePresence>
                    {uniqueFilteredSpecialties.map(specialty => (
                      <motion.div key={specialty.name} variants={listItemVariants} exit="exit">
                        <Node name={specialty.name} percentage={specialty.percentual} isSelected={selectedSpecialty === specialty.name} onClick={() => handleSpecialtyClick(specialty.name)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </Column>

              <Column title="Tema / Assunto" isEmpty={!selectedSpecialty || uniqueFilteredSubspecialties.length === 0} emptyText={!selectedSpecialty ? "Selecione uma Especialidade." : "Nenhum tema encontrado."} className="sm:col-span-2 lg:col-span-1">
                <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                  <AnimatePresence>
                    {uniqueFilteredSubspecialties.map(sub => (
                      <motion.div key={sub.name} variants={listItemVariants} exit="exit">
                        <button onClick={() => onSubspecialtyClick(sub.name, selectedArea, selectedSpecialty)} className="w-full">
                          <div className="card-container w-full text-left p-3.5 rounded-xl border border-border/40 bg-card hover:bg-accent/30 hover:border-border/60 transition-all duration-200">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-medium text-sm font-dynamic pr-2">{sub.name}</span>
                              <span className="font-bold text-sm text-primary tabular-nums">{sub.percentual}%</span>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </Column>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// --- Evolution Chart ---
interface EvolutionData { name: string;[key: string]: string | number; }
const RenderCustomEvolutionBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === 0 || value === undefined || height < 15) return null;
  return (<text x={x + width / 2} y={y} fill="hsl(var(--muted-foreground))" textAnchor="middle" dominantBaseline="auto" dy={-8} fontSize={11} fontWeight="bold">{`${value}%`}</text>);
};

const generateRedShades = (count: number): string[] => {
  if (count <= 1) return ['hsl(var(--primary))'];
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const opacity = 0.4 + ratio * 0.6;
    shades.push(`hsla(var(--primary) / ${opacity})`);
  }
  return shades;
};

const EvolutionChart: React.FC<{ allPerformanceData: any[] }> = ({ allPerformanceData }) => {
  const evolutionData = useMemo(() => {
    const areasMap = new Map<string, EvolutionData>();
    const simuladoNames: { [key: string]: string } = {};
    allPerformanceData.forEach(item => {
      if (!simuladoNames[item.simulado_id]) { simuladoNames[item.simulado_id] = item.simulado_nome; }
      if (!areasMap.has(item.area_name)) { areasMap.set(item.area_name, { name: item.area_name }); }
      const area = areasMap.get(item.area_name)!;
      const percentual = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0;
      area[`simulado_${item.simulado_id}`] = percentual;
    });
    const data = Array.from(areasMap.values());
    const simulados = Object.entries(simuladoNames).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return { data, simulados };
  }, [allPerformanceData]);

  const dynamicColors = useMemo(() => generateRedShades(evolutionData.simulados.length), [evolutionData.simulados.length]);

  if (evolutionData.data.length === 0 || evolutionData.simulados.length < 2) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }} className="h-full">
        <Card className="rounded-2xl border-border/40 shadow-sm h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ChevronsUpDown className="h-4 w-4 text-primary" />
              </div>
              Evolução entre Simulados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground text-center">Realize pelo menos dois simulados para ver sua evolução.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }} className="h-full">
      <Card className="rounded-2xl border-border/40 shadow-sm h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <ChevronsUpDown className="h-4 w-4 text-primary" />
            </div>
            Evolução entre Simulados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={evolutionData.data} margin={{ top: 30, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={40} />
              <RechartsTooltip cursor={{ fill: 'hsl(var(--accent) / 0.3)' }} content={<PremiumChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {evolutionData.simulados.map((simulado, index) => (
                <Bar key={simulado.id} dataKey={`simulado_${simulado.id}`} name={simulado.name} fill={dynamicColors[index]} radius={[6, 6, 0, 0]} label={<RenderCustomEvolutionBarLabel />} />
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// --- Main Component ---
const readPerformanceCache = (userId: string, simuladoId: string | null): any | null => {
  try {
    const cacheKey = `performanceData_${userId}_${simuladoId || 'all'}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn('[UIUX] Cache read failure:', e);
  }
  return null;
};

export const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [selectedSimulado, setSelectedSimulado] = useState<string | null>(null);
  
  const cachedData = useMemo(() => {
    if (!user?.id) return null;
    return readPerformanceCache(user.id, selectedSimulado);
  }, [user?.id, selectedSimulado]);
  
  const [stats, setStats] = useState<OverallStats | null>(cachedData?.stats || null);
  const [performancePorArea, setPerformancePorArea] = useState<PerformanceData[]>(cachedData?.performancePorArea || []);
  const [bySpecialty, setBySpecialty] = useState<SpecialtyPerformanceData[]>(cachedData?.bySpecialty || []);
  const [bySubspecialty, setBySubspecialty] = useState<SubspecialtyPerformanceData[]>(cachedData?.bySubspecialty || []);
  const [ranking, setRanking] = useState<{ ies: RankingData, semester: RankingData } | null>(cachedData?.ranking || null);
  const [userData, setUserData] = useState<UserData | null>(cachedData?.userData || null);
  const [loading, setLoading] = useState(!cachedData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<ReviewedQuestion[]>([]);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [simulados, setSimulados] = useState<Simulado[]>(cachedData?.simulados || []);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingProvaRevisada, setIsDownloadingProvaRevisada] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const CACHE_KEY_PREFIX = `performanceData_${user?.id}`;

  const fetchDataForView = async (simuladoId: string | null, forceRefresh = false) => {
    if (!user) return;
    const hasInitialData = stats !== null || performancePorArea.length > 0;
    if (!hasInitialData) setLoading(true);
    
    const PERFORMANCE_CACHE_KEY = `${CACHE_KEY_PREFIX}_${simuladoId || 'all'}`;
    if (!forceRefresh && sessionStorage.getItem(PERFORMANCE_CACHE_KEY)) {
      const parsedData = JSON.parse(sessionStorage.getItem(PERFORMANCE_CACHE_KEY)!);
      setStats(parsedData.stats); setPerformancePorArea(parsedData.performancePorArea); setBySpecialty(parsedData.bySpecialty); setBySubspecialty(parsedData.bySubspecialty); setRanking(parsedData.ranking); setUserData(parsedData.userData); setSimulados(parsedData.simulados);
      setLoading(false);
      return;
    }
    try {
      const [simuladosResult, performanceResult, rankingResult, userDataResult] = await Promise.all([
        supabase.rpc('get_user_simulados'),
        simuladoId ? supabase.rpc('get_user_performance_aggregates', { p_simulado_id: simuladoId }).single() : supabase.rpc('get_user_performance_aggregates').single(),
        simuladoId ? supabase.rpc('get_user_rankings', { p_simulado_id: simuladoId }).single() : supabase.rpc('get_user_rankings').single(),
        supabase.from('users').select('semestre').eq('id', user.id).single()
      ]);
      if (simuladosResult.error) throw simuladosResult.error; if (performanceResult.error) throw performanceResult.error; if (rankingResult.error) throw rankingResult.error; if (userDataResult.error) throw userDataResult.error;
      const simuladosData = simuladosResult.data || [];
      setSimulados(simuladosData.map((s: any) => ({ ...s, id: s.id })));
      if (performanceResult.data) {
        const { overallStats, byArea, bySpecialty, bySubspecialty } = performanceResult.data as any;
        const processData = (d: any[]) => (d || []).map(item => ({ ...item, percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0 }));
        const newStats = { total: overallStats?.total || 0, acertos: overallStats?.acertos || 0, percentual: overallStats?.total > 0 ? Math.round((overallStats.acertos / overallStats.total) * 100) : 0 };
        const rankingData = rankingResult.data as any;
        const dataToCache = { stats: newStats, performancePorArea: processData(byArea || []), bySpecialty: processData(bySpecialty || []), bySubspecialty: processData(bySubspecialty || []), ranking: rankingData ? { ies: rankingData.rankingIES || null, semester: rankingData.rankingSemester || null } : null, userData: userDataResult.data, simulados: simuladosData };
        sessionStorage.setItem(PERFORMANCE_CACHE_KEY, JSON.stringify(dataToCache));
        setStats(newStats); setPerformancePorArea(processData(byArea || [])); setBySpecialty(processData(bySpecialty || [])); setBySubspecialty(processData(bySubspecialty || [])); setRanking(dataToCache.ranking); setUserData(userDataResult.data);
      }
    } catch (error) { console.error("[UIUX] Fetch error:", error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user || simulados.length === 0) return;
    const SIMULADOS_LIST_KEY = `simuladosList_${user.id}`;
    const cachedSimuladosList = sessionStorage.getItem(SIMULADOS_LIST_KEY);
    const currentSimuladosIds = simulados.map(s => s.id).sort().join(',');
    if (cachedSimuladosList && cachedSimuladosList !== currentSimuladosIds) {
      console.log('[UIUX] Simulados list changed, invalidating caches...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith(`performanceData_${user.id}`) || key.startsWith(`evolutionData_${user.id}`))) keysToRemove.push(key);
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
    sessionStorage.setItem(SIMULADOS_LIST_KEY, currentSimuladosIds);
  }, [user, simulados]);

  useEffect(() => { if (user) { fetchDataForView(selectedSimulado); } }, [user, selectedSimulado]);

  useEffect(() => {
    if (!user) return;
    const EVOLUTION_CACHE_KEY = `evolutionData_${user.id}`;
    const cachedEvolutionData = sessionStorage.getItem(EVOLUTION_CACHE_KEY);
    if (cachedEvolutionData) {
      setAllPerformanceData(JSON.parse(cachedEvolutionData));
    } else {
      supabase.rpc('get_all_user_performance_by_area').then(({ data, error }) => {
        if (error) { console.error('[UIUX] Evolution fetch error', error); return; }
        setAllPerformanceData(data || []);
        sessionStorage.setItem(EVOLUTION_CACHE_KEY, JSON.stringify(data || []));
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user || !simulados || simulados.length === 0) return;
    const preloadAllSimulados = async () => {
      for (const simuladoId of simulados.map(s => s.id)) {
        const CACHE_KEY = `${CACHE_KEY_PREFIX}_${simuladoId}`;
        if (sessionStorage.getItem(CACHE_KEY)) continue;
        try {
          const [pResult, rResult] = await Promise.all([
            supabase.rpc('get_user_performance_aggregates', { p_simulado_id: simuladoId }).single(),
            supabase.rpc('get_user_rankings', { p_simulado_id: simuladoId }).single()
          ]);
          if (pResult.data) {
            const { overallStats, byArea, bySpecialty, bySubspecialty } = pResult.data as any;
            const processData = (d: any[]) => (d || []).map(item => ({ ...item, percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0 }));
            const newStats = { total: overallStats?.total || 0, acertos: overallStats?.acertos || 0, percentual: overallStats?.total > 0 ? Math.round((overallStats.acertos / overallStats.total) * 100) : 0 };
            const rankingData = rResult.data as any;
            const dataToCache = { stats: newStats, performancePorArea: processData(byArea || []), bySpecialty: processData(bySpecialty || []), bySubspecialty: processData(bySubspecialty || []), ranking: rankingData ? { ies: rankingData.rankingIES || null, semester: rankingData.rankingSemester || null } : null, userData: userData, simulados: simulados };
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
          }
        } catch (error) { console.error(`[UIUX] Preload error ${simuladoId}:`, error); }
      }
    };
    const timer = setTimeout(preloadAllSimulados, 2000);
    return () => clearTimeout(timer);
  }, [simulados, user, userData]);

  const handleRefresh = () => { sessionStorage.clear(); fetchDataForView(selectedSimulado, true); };
  const handleSimuladoChange = (simuladoIdStr: string) => {
    setSelectedSimulado(simuladoIdStr === 'all' ? null : simuladoIdStr);
  };

  const handleDownloadGabarito = async () => {
    if (!selectedSimulado || !user) return;
    setIsDownloadingPDF(true);
    try {
      const { data: answers, error } = await supabase.from('answer_progress').select(`question_id, resposta_usuario, correct, questoes_simulado!inner (correta, tema, ordem)`).eq('simulado', selectedSimulado).eq('user_id', user.id);
      if (error) throw error;
      const sortedAnswers = (answers || []).sort((a, b) => { const ordemA = (a.questoes_simulado as any)?.ordem ?? 0; const ordemB = (b.questoes_simulado as any)?.ordem ?? 0; return ordemA - ordemB; });
      const questoes: GabaritoQuestao[] = sortedAnswers.map((a, index) => ({ numero: index + 1, respostaAluno: a.resposta_usuario?.toUpperCase() || null, gabarito: (a.questoes_simulado as any)?.correta?.toUpperCase() || '-', acertou: a.resposta_usuario ? a.correct : null, tema: (a.questoes_simulado as any)?.tema || '-' }));
      const simuladoNome = simulados.find(s => s.id === selectedSimulado)?.nome || 'Simulado';
      await generateGabaritoPDF(simuladoNome, user.email || 'Aluno', questoes, { acertos: stats?.acertos || 0, total: stats?.total || 0, percentual: stats?.percentual || 0 });
      toast({ title: 'Gabarito gerado!', description: 'O PDF foi baixado com sucesso.' });
    } catch (error) { console.error('[UIUX] PDF error:', error); toast({ title: 'Erro', description: 'Não foi possível gerar o gabarito.', variant: 'destructive' }); }
    finally { setIsDownloadingPDF(false); }
  };

  const handleDownloadProvaRevisada = async () => {
    if (!selectedSimulado || !user) return;
    setIsDownloadingProvaRevisada(true);
    setDownloadProgress('Preparando...');
    try {
      const { data: questoesCompletas, error: questoesError } = await supabase.from('questoes_simulado').select(`id, ordem, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario, imagem, imagem_comentario, grande_area, especialidade, tema, anulada`).eq('simulado_id', selectedSimulado).order('ordem', { ascending: true });
      if (questoesError) throw questoesError;
      if (!questoesCompletas || questoesCompletas.length === 0) throw new Error('Nenhuma questão encontrada');
      setDownloadProgress('Carregando respostas...');
      const { data: respostasAluno, error: respostasError } = await supabase.from('answer_progress').select('question_id, resposta_usuario, correct').eq('simulado', selectedSimulado).eq('user_id', user.id);
      if (respostasError) throw respostasError;
      const respostasMap = new Map((respostasAluno || []).map(r => [r.question_id, r]));
      const questoesRevisadas: QuestaoRevisada[] = questoesCompletas.map((q, index) => {
        const resposta = respostasMap.get(q.id);
        const respostaUsuario = resposta?.resposta_usuario?.toUpperCase() || null;
        const gabarito = q.correta?.toUpperCase() || 'A';
        let acertou: boolean | null = null;
        if (q.anulada) acertou = true;
        else if (respostaUsuario) acertou = respostaUsuario === gabarito;
        const alternativas: Array<{ letra: 'A' | 'B' | 'C' | 'D' | 'E'; texto: string; isCorreta: boolean; isMarcadaPeloAluno: boolean }> = [
          { letra: 'A', texto: q.alternativa_a || '', isCorreta: gabarito === 'A', isMarcadaPeloAluno: respostaUsuario === 'A' },
          { letra: 'B', texto: q.alternativa_b || '', isCorreta: gabarito === 'B', isMarcadaPeloAluno: respostaUsuario === 'B' },
          { letra: 'C', texto: q.alternativa_c || '', isCorreta: gabarito === 'C', isMarcadaPeloAluno: respostaUsuario === 'C' },
          { letra: 'D', texto: q.alternativa_d || '', isCorreta: gabarito === 'D', isMarcadaPeloAluno: respostaUsuario === 'D' },
        ];
        if (q.alternativa_e) alternativas.push({ letra: 'E', texto: q.alternativa_e, isCorreta: gabarito === 'E', isMarcadaPeloAluno: respostaUsuario === 'E' });
        return { numero: index + 1, enunciado: q.enunciado || '', alternativas, respostaAluno: respostaUsuario, gabarito, acertou, comentario: q.comentario || null, imagem: q.imagem || null, imagemComentario: (q as any).imagem_comentario || null, grandeArea: q.grande_area || 'Geral', especialidade: q.especialidade || '', tema: q.tema || '', anulada: q.anulada || false };
      });
      const acertos = questoesRevisadas.filter(q => q.acertou === true).length;
      const erros = questoesRevisadas.filter(q => q.acertou === false).length;
      const naoRespondidas = questoesRevisadas.filter(q => q.acertou === null).length;
      const total = questoesRevisadas.length;
      const areaMap = new Map<string, { acertos: number; total: number }>();
      questoesRevisadas.forEach(q => { const area = q.grandeArea || 'Outros'; const existing = areaMap.get(area) || { acertos: 0, total: 0 }; existing.total++; if (q.acertou === true) existing.acertos++; areaMap.set(area, existing); });
      const porArea = Array.from(areaMap.entries()).map(([area, data]) => ({ area, acertos: data.acertos, total: data.total, percentual: data.total > 0 ? Math.round((data.acertos / data.total) * 100) : 0 }));
      const provaStats: ProvaRevisadaStats = { acertos, erros, naoRespondidas, total, percentual: total > 0 ? Math.round((acertos / total) * 100) : 0, porArea };
      const simuladoNome = simulados.find(s => s.id === selectedSimulado)?.nome || 'Simulado';
      await generateProvaRevisadaPDF(simuladoNome, user.email || 'Aluno', questoesRevisadas, provaStats, (stage, current, totalItems) => {
        switch (stage) { case 'preparing': setDownloadProgress('Preparando...'); break; case 'loading_images': setDownloadProgress(`Imagens (${current}/${totalItems})...`); break; case 'generating': setDownloadProgress(`Gerando (${current}/${totalItems})...`); break; case 'complete': setDownloadProgress('Concluído!'); break; }
      });
      toast({ title: 'Prova revisada gerada!', description: 'O PDF completo foi baixado com sucesso.' });
    } catch (error) { console.error('[UIUX] Prova revisada error:', error); toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Não foi possível gerar a prova revisada.', variant: 'destructive' }); }
    finally { setIsDownloadingProvaRevisada(false); setDownloadProgress(''); }
  };

  const handleSubspecialtyClick = async (subspecialtyName: string, areaName: string | null, specialtyName: string | null) => {
    setIsModalOpen(true); setIsLoadingQuestion(true); setSelectedQuestions([]);
    try {
      const { data, error } = await supabase.rpc('get_questions_by_subspecialty', { sub_name: subspecialtyName, p_simulado_id: selectedSimulado, area_name: areaName, specialty_name: specialtyName } as any);
      if (error) throw error;
      if (data && data.length > 0) {
        setSelectedQuestions(data.map((q: any) => ({ ...q, acertou: q.acertou === true, user_answer: q.user_answer })));
      }
    } catch (error) { console.error("[UIUX] Question fetch error:", error); }
    finally { setIsLoadingQuestion(false); }
  };



  // --- Loading State ---
  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl lg:max-w-6xl xl:max-w-7xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-52 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!stats || (stats.total === 0 && simulados.length === 0)) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl lg:max-w-6xl">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-5">
            <Target className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1.5">Nenhum dado de simulado</h2>
          <p className="text-sm text-muted-foreground max-w-sm">Complete um simulado para visualizar seu desempenho detalhado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl space-y-6 sm:space-y-8">
      <style>{`.card-container { container-type: inline-size; container-name: node-card; } .font-dynamic { font-size: clamp(0.7rem, 5cqw, 0.875rem); line-height: 1.2; }`}</style>

      {/* ─── Premium Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="space-y-4"
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard de Desempenho</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Sua performance detalhada nos simulados</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select onValueChange={handleSimuladoChange} value={selectedSimulado?.toString() ?? 'all'}>
            <SelectTrigger className="w-full sm:w-[220px] h-11 rounded-xl border-border/50 bg-card shadow-sm text-sm font-medium">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Visão Geral</SelectItem>
              {simulados.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2 rounded-xl h-11 border-border/50 shadow-sm hover:shadow-md transition-all text-sm flex-1 sm:flex-none"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>

            <UITooltip>
              <TooltipTrigger asChild>
                <span className="flex-1 sm:flex-none">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={!selectedSimulado || isDownloadingPDF || isDownloadingProvaRevisada}
                        variant="outline"
                        className="gap-2 w-full rounded-xl h-11 border-border/50 shadow-sm hover:shadow-md transition-all text-sm"
                      >
                        {(isDownloadingPDF || isDownloadingProvaRevisada) ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="truncate">{downloadProgress || 'Gerando...'}</span>
                          </>
                        ) : (
                          <>
                            <FileDown className="h-4 w-4" />
                            Baixar PDF
                            <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-60" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-1.5 rounded-xl border-border/50 shadow-lg">
                      <DropdownMenuItem onClick={handleDownloadGabarito} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer">
                        <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-muted">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium">Gabarito Resumido</span>
                          <span className="text-xs text-muted-foreground mt-0.5">Tabela simples com respostas</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem onClick={handleDownloadProvaRevisada} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer">
                        <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-primary/10">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">Prova Revisada</span>
                            <Badge className="text-[9px] px-1.5 py-0 rounded-md h-4 font-bold bg-primary text-primary-foreground">NOVO</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5">Questões completas + comentários</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </TooltipTrigger>
              {!selectedSimulado && (
                <TooltipContent><p>Selecione um simulado específico para baixar</p></TooltipContent>
              )}
            </UITooltip>
          </div>
        </div>
      </motion.div>

      {/* ─── Performance Summary ─── */}
      {stats && performancePorArea.length > 0 && (
        <PerformanceSummary stats={stats} performancePorArea={performancePorArea} bySpecialty={bySpecialty} />
      )}

      {/* ─── Resumo + Evolução Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Resumo */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="h-full">
          <Card className="rounded-2xl border-border/40 shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                Resumo do Desempenho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-center py-4">
                <p className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">{stats.percentual}%</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {stats.acertos} de {stats.total} questões corretas
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ranking?.ies && ranking.ies.total > 0 && (
                  <div className="text-center p-4 rounded-xl border border-border/30 bg-card">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" /> Ranking IES
                    </div>
                    <p className="text-2xl font-bold text-primary">{ranking.ies.rank}º</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">de {ranking.ies.total} {ranking.ies.total !== 1 ? 'alunos' : 'aluno'}</p>
                  </div>
                )}
                {ranking?.semester && ranking.semester.total > 0 && userData && (
                  <div className="text-center p-4 rounded-xl border border-border/30 bg-card">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" /> {userData.semestre}° Semestre
                    </div>
                    <p className="text-2xl font-bold text-primary">{ranking.semester.rank}º</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">de {ranking.semester.total} {ranking.semester.total !== 1 ? 'alunos' : 'aluno'}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Evolução entre Simulados */}
        <div className="h-full">
          <EvolutionChart allPerformanceData={allPerformanceData} />
        </div>
      </div>

      {/* ─── Decomposition Tree ─── */}
      {stats && (
        <DecompositionTree
          overallStats={stats}
          areas={performancePorArea}
          specialties={bySpecialty}
          subspecialties={bySubspecialty}
          onSubspecialtyClick={handleSubspecialtyClick}
          selectedSimulado={selectedSimulado}
        />
      )}

      {/* ─── Question Modal ─── */}
      <QuestionModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        questions={selectedQuestions}
        isLoading={isLoadingQuestion}
        simuladoId={selectedSimulado}
        simuladoNome={simulados.find(s => s.id === selectedSimulado)?.nome}
      />
    </div>
  );
};
