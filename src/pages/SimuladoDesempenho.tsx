import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target, TrendingUp, BarChart3, BarChart, Loader2, FileText, Star, TrendingDown, HelpCircle, ChevronsUpDown, ChevronLeft, ChevronRight, XCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, BarChart as RechartsBarChart, Bar } from 'recharts';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

// --- Interfaces ---
interface Simulado { id: number; nome: string; }
interface PerformanceData { name: string; total: number; acertos: number; percentual: number; }
interface SpecialtyPerformanceData extends PerformanceData { area_name?: string; area_id?: number; }
interface SubspecialtyPerformanceData extends PerformanceData { specialty_name?: string; specialty_id?: number; area_name?: string; }
interface RankingData { rank: number; total: number; }
interface OverallStats { total: number; acertos: number; percentual: number; }
interface DifficultyData { name: string; value: number; fill: string; total: number; acertos: number; }
interface UserData { semestre: number; }
interface ReviewedQuestion { 
  id: string; 
  gabarito: 'A' | 'B' | 'C' | 'D'; 
  enunciado: string; 
  a: string; b: string; c: string; d: string; 
  comentario: string; 
  imagem: string | null; 
  dificuldade: 'Fácil' | 'Médio' | 'Difícil' | string;
  acertou: boolean; 
}

// --- Componentes Auxiliares ---
const CustomBarTooltip = ({ active, payload }: any) => { 
  if (active && payload && payload.length) { 
    const data = payload[0].payload; 
    return ( 
      <div className="bg-background p-3 border rounded-md shadow-lg"> 
        <p className="font-bold mb-2">{data.name}</p> 
        <p className="text-sm">Percentual de Acertos: {data.value}%</p> 
        <p className="text-sm">Acertos: {data.acertos}/{data.total}</p> 
      </div> 
    ); 
  } 
  return null; 
};

const CustomBarLabel = (props: any) => { 
  const { x, y, width, height, value } = props; 
  return ( 
    <text 
      x={x + width / 2} 
      y={y + height / 2} 
      fill="hsl(var(--primary-foreground))" 
      textAnchor="middle" 
      dominantBaseline="middle" 
      fontSize={12} 
      fontWeight="bold" 
    > 
      {value}% 
    </text> 
  );
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const styles = {
    Fácil: "bg-green-500/10 text-green-500",
    Médio: "bg-amber-500/10 text-amber-500",
    Difícil: "bg-red-500/10 text-red-500",
  };
  const difficultyNormalized = difficulty as keyof typeof styles;
  return ( 
    <span className={cn("px-2 py-1 rounded-md text-xs font-semibold", styles[difficultyNormalized] || "bg-muted text-muted-foreground")}> 
      {difficulty} 
    </span> 
  );
};

// --- Componente do Modal de Questão ---
const QuestionModal: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questions: ReviewedQuestion[];
  isLoading: boolean;
}> = ({ isOpen, onOpenChange, questions, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => { if (isOpen) { setCurrentIndex(0); } }, [isOpen, questions]);

  const handleNext = () => setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));
  
  const question = questions.length > 0 ? questions[currentIndex] : null;
  const alternatives: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> = question ? [ 
    { key: 'A', text: question.a }, 
    { key: 'B', text: question.b }, 
    { key: 'C', text: question.c }, 
    { key: 'D', text: question.d } 
  ] : [];
  
  const userGotItRight = question?.acertou;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center gap-2">
            <DialogTitle>Revisão de Questão</DialogTitle>
            <div className="flex items-center gap-2">
              {question?.dificuldade && <DifficultyBadge difficulty={question.dificuldade} />}
              {question && typeof question.acertou === 'boolean' && (
                <div className={cn("flex items-center gap-2 px-2 py-1 rounded-md text-xs font-semibold", 
                  userGotItRight ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                  {userGotItRight ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{userGotItRight ? "Você acertou" : "Você errou"}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4">
          {isLoading ? ( 
            <div className="flex justify-center items-center h-full"> 
              <Loader2 className="h-8 w-8 animate-spin" /> 
              <p className="ml-4">Buscando questões...</p> 
            </div>
          ) : question ? (
            <div className="space-y-6 py-4">
              <p className="text-base leading-relaxed whitespace-pre-wrap">{question.enunciado}</p>
              {question.imagem && ( 
                <div className="flex justify-center my-4"> 
                  <img src={question.imagem} alt="Imagem da questão" className="max-w-full h-auto rounded-md" /> 
                </div> 
              )}
              <div className="space-y-3"> 
                {alternatives.map(alt => {
                  const isCorrectAnswer = question.gabarito === alt.key;
                  return (
                    <div key={alt.key} className={cn( "p-3 border rounded-md text-left transition-colors", 
                      isCorrectAnswer 
                        ? "bg-green-100 border-green-500 text-green-800 dark:bg-green-500/20 dark:border-green-600 dark:text-green-300" 
                        : "bg-muted/30"
                    )}> 
                      <span className="font-bold mr-2">{alt.key})</span> {alt.text} 
                    </div>
                  );
                })}
              </div>
              <div className="bg-muted/80 p-4 rounded-md space-y-2 border"> 
                <h4 className="font-bold text-lg text-primary">Comentário do Professor</h4> 
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{question.comentario}</p> 
              </div>
            </div>
          ) : ( 
            <div className="flex justify-center items-center h-full"> 
              <p>Nenhuma questão de exemplo foi encontrada para esta subespecialidade.</p> 
            </div> 
          )}
        </div>
        {questions.length > 1 && (
          <div className="flex-shrink-0 pt-4 border-t flex justify-between items-center">
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}> 
              <ChevronLeft className="h-4 w-4 mr-2" /> Anterior 
            </Button>
            <span className="text-sm text-muted-foreground font-medium"> 
              Questão {currentIndex + 1} de {questions.length} 
            </span>
            <Button variant="outline" onClick={handleNext} disabled={currentIndex === questions.length - 1}> 
              Próxima <ChevronRight className="h-4 w-4 ml-2" /> 
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Componente de Resumo de Desempenho ---
const PerformanceSummary: React.FC<{ 
  stats: OverallStats; 
  performancePorArea: PerformanceData[]; 
  bySpecialty: SpecialtyPerformanceData[]; 
  byDifficulty: PerformanceData[]; 
}> = ({ stats, performancePorArea, bySpecialty, byDifficulty }) => {
  if (performancePorArea.length === 0) return null;
  
  const sortedAreas = [...performancePorArea].sort((a, b) => b.percentual - a.percentual);
  const bestArea = sortedAreas[0];
  const worstArea = sortedAreas[sortedAreas.length - 1];
  const bestSpecialtyInBestArea = bySpecialty.filter(s => s.area_name === bestArea.name).sort((a, b) => b.percentual - a.percentual)[0];
  const specialtiesToImprove = bySpecialty.filter(s => s.area_name === worstArea.name).sort((a, b) => a.percentual - b.percentual).slice(0, 2);
  const worstDifficulty = [...byDifficulty].sort((a, b) => a.percentual - b.percentual)[0];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Relatório de Desempenho
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p>Seu aproveitamento geral foi de <strong>{stats.percentual}%</strong> ({stats.acertos}/{stats.total} questões). Veja abaixo os principais destaques para guiar seus estudos.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-green-500" /> Pontos Fortes
            </h3>
            <p>Sua principal fortaleza foi em <strong>{bestArea.name}</strong>, com <strong>{bestArea.percentual}%</strong> de acertos.</p>
            {bestSpecialtyInBestArea && (
              <p>Dentro desta área, você se destacou em <strong>{bestSpecialtyInBestArea.name}</strong> ({bestSpecialtyInBestArea.percentual}%).</p>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" /> Oportunidades de Melhoria
            </h3>
            <p>A área com maior oportunidade de crescimento é <strong>{worstArea.name}</strong>, com <strong>{worstArea.percentual}%</strong> de acertos.</p>
            {specialtiesToImprove.length > 0 && (
              <div>
                <p className="mb-1">Foque nos temas:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {specialtiesToImprove.map(s => <li key={s.name}>{s.name} ({s.percentual}%)</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
        {worstDifficulty && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-500" /> Análise por Dificuldade
            </h3>
            <p>Seu maior desafio foi em questões de nível <strong>{worstDifficulty.name}</strong>, com <strong>{worstDifficulty.percentual}%</strong> de acertos. Revisar casos clínicos e conceitos mais complexos pode ajudar.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Componentes da Árvore de Decomposição ---
const Node: React.FC<{ 
  name: string; 
  percentage: number; 
  isSelected: boolean; 
  onClick: () => void; 
}> = ({ name, percentage, isSelected, onClick }) => ( 
  <button 
    onClick={onClick} 
    className={cn( 
      "card-container w-full text-left p-3 border rounded-md transition-all duration-200 hover:bg-muted/80", 
      isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border" 
    )} 
  > 
    <div className="flex justify-between items-center gap-2"> 
      <span className="font-medium font-dynamic pr-2">{name}</span> 
      <span className={cn("font-bold text-sm", isSelected ? "text-primary-foreground" : "text-primary")}> 
        {percentage}% 
      </span> 
    </div> 
  </button> 
);

const Column: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  isEmpty?: boolean; 
  emptyText?: string 
}> = ({ title, children, isEmpty = false, emptyText = "Selecione um item na coluna anterior." }) => ( 
  <div className="flex-1 min-w-[250px]"> 
    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{title}</h3> 
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2"> 
      {isEmpty ? ( 
        <div className="flex items-center justify-center h-40 text-center text-muted-foreground text-sm p-4 border border-dashed rounded-md"> 
          {emptyText} 
        </div> 
      ) : children} 
    </div> 
  </div> 
);

const listContainerVariants = { 
  hidden: { opacity: 0 }, 
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.05, 
    }, 
  }, 
};

const listItemVariants = { 
  hidden: { y: 20, opacity: 0 }, 
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { 
      duration: 0.4, 
    } 
  }, 
  exit: { 
    opacity: 0, 
    y: -20, 
    transition: { 
      duration: 0.2, 
    } 
  }, 
};

const DecompositionTree: React.FC<{ 
  overallStats: OverallStats; 
  areas: PerformanceData[]; 
  specialties: SpecialtyPerformanceData[]; 
  subspecialties: SubspecialtyPerformanceData[]; 
  onSubspecialtyClick: (subspecialtyName: string) => void; 
  selectedSimulado: number | null; 
}> = ({ overallStats, areas, specialties, subspecialties, onSubspecialtyClick, selectedSimulado }) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  
  useEffect(() => { 
    setSelectedArea(null); 
    setSelectedSpecialty(null); 
  }, [selectedSimulado]);
  
  const handleAreaClick = (areaName: string) => { 
    if (selectedArea === areaName) { 
      setSelectedArea(null); 
      setSelectedSpecialty(null); 
    } else { 
      setSelectedArea(areaName); 
      setSelectedSpecialty(null); 
    } 
  };
  
  const handleSpecialtyClick = (specialtyName: string) => { 
    setSelectedSpecialty(prevState => prevState === specialtyName ? null : specialtyName); 
  };
  
  const filteredSpecialties = selectedArea ? specialties.filter(s => s.area_name && s.area_name.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueFilteredSpecialties = filteredSpecialties.filter((specialty, index, self) => 
    index === self.findIndex((s) => s.name.toLowerCase() === specialty.name.toLowerCase())
  ).sort((a, b) => b.percentual - a.percentual);
  
  const filteredSubspecialties = selectedArea && selectedSpecialty ? 
    subspecialties.filter(s => 
      s.specialty_name?.toLowerCase() === selectedSpecialty.toLowerCase() && 
      s.area_name?.toLowerCase() === selectedArea.toLowerCase()
    ) : [];
  
  const uniqueFilteredSubspecialties = filteredSubspecialties.filter((sub, index, self) => 
    index === self.findIndex((s) => s.name.toLowerCase() === sub.name.toLowerCase())
  ).sort((a, b) => b.percentual - a.percentual);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5 text-primary" />
          Análise de Desempenho Hierárquica
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:border-r lg:pr-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Percentual de Acertos</h3>
              <div className="flex items-center justify-center bg-primary text-primary-foreground p-4 rounded-md min-w-[200px]">
                <div className="text-center">
                  <p className="text-3xl font-bold">{overallStats.percentual}%</p>
                  <p className="text-xs opacity-80">{overallStats.acertos} / {overallStats.total} questões</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-x-auto">
            <Column title="Tema (Grande Área)">
              <motion.div 
                variants={listContainerVariants} 
                initial="hidden" 
                animate="visible" 
                className="space-y-2"
              >
                {areas.map(area => (
                  <motion.div key={area.name} variants={listItemVariants}>
                    <Node 
                      name={area.name} 
                      percentage={area.percentual} 
                      isSelected={selectedArea === area.name} 
                      onClick={() => handleAreaClick(area.name)} 
                    />
                  </motion.div>
                ))}
              </motion.div>
            </Column>
            
            <Column 
              title="Especialidade" 
              isEmpty={!selectedArea || uniqueFilteredSpecialties.length === 0} 
              emptyText={!selectedArea ? "Selecione uma Grande Área." : "Nenhuma especialidade encontrada."} 
            >
              <motion.div 
                variants={listContainerVariants} 
                initial="hidden" 
                animate="visible" 
                className="space-y-2"
              >
                <AnimatePresence>
                  {uniqueFilteredSpecialties.map(specialty => (
                    <motion.div 
                      key={specialty.name} 
                      variants={listItemVariants} 
                      exit="exit" 
                    >
                      <Node 
                        name={specialty.name} 
                        percentage={specialty.percentual} 
                        isSelected={selectedSpecialty === specialty.name} 
                        onClick={() => handleSpecialtyClick(specialty.name)} 
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </Column>
            
            <Column 
              title="Subespecialidade / Assunto" 
              isEmpty={!selectedSpecialty || uniqueFilteredSubspecialties.length === 0} 
              emptyText={!selectedSpecialty ? "Selecione uma Especialidade." : "Nenhuma subespecialidade encontrada."} 
            >
              <motion.div 
                variants={listContainerVariants} 
                initial="hidden" 
                animate="visible" 
                className="space-y-2"
              >
                <AnimatePresence>
                  {uniqueFilteredSubspecialties.map(sub => (
                    <motion.div 
                      key={sub.name} 
                      variants={listItemVariants} 
                      exit="exit" 
                    >
                      <button onClick={() => onSubspecialtyClick(sub.name)} className="w-full">
                        <div className="card-container w-full text-left p-3 border rounded-md bg-muted/40 hover:bg-muted/80 transition-colors">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-medium font-dynamic pr-2">{sub.name}</span>
                            <span className="font-bold text-sm text-primary">{sub.percentual}%</span>
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
  );
};

// --- Componente do Gráfico de Evolução ---
interface EvolutionData { name: string; [key: string]: string | number; }

const RenderCustomEvolutionBarLabel = (props: any) => { 
  const { x, y, width, height, value } = props; 
  if (value === 0 || value === undefined || height < 15) return null; 
  return (
    <text 
      x={x + width / 2} 
      y={y} 
      fill="hsl(var(--muted-foreground))" 
      textAnchor="middle" 
      dominantBaseline="auto" 
      dy={-8} 
      fontSize={12} 
      fontWeight="bold"
    >
      {`${value}%`}
    </text>
  ); 
};

const generateRedShades = (count: number): string[] => { 
  if (count <= 1) return ['#ef4444']; 
  const startColor = { r: 0xfc, g: 0xa5, b: 0xa5 }; 
  const endColor = { r: 0xb9, g: 0x1c, b: 0x1c }; 
  const shades: string[] = []; 
  for (let i = 0; i < count; i++) { 
    const ratio = count === 1 ? 0.5 : i / (count - 1); 
    const r = Math.round(startColor.r + ratio * (endColor.r - startColor.r)); 
    const g = Math.round(startColor.g + ratio * (endColor.g - startColor.g)); 
    const b = Math.round(startColor.b + ratio * (endColor.b - startColor.b)); 
    const toHex = (c: number) => ('00' + c.toString(16)).slice(-2); 
    shades.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`); 
  } 
  return shades; 
};

const EvolutionChart: React.FC<{ allPerformanceData: any[] }> = ({ allPerformanceData }) => {
  const evolutionData = useMemo(() => { 
    const areasMap = new Map<string, EvolutionData>(); 
    const simuladoNames: { [key: number]: string } = {}; 
    
    allPerformanceData.forEach(item => { 
      if (!simuladoNames[item.simulado_id]) { 
        simuladoNames[item.simulado_id] = item.simulado_nome; 
      } 
      if (!areasMap.has(item.area_name)) { 
        areasMap.set(item.area_name, { name: item.area_name }); 
      } 
      const area = areasMap.get(item.area_name)!; 
      const percentual = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0; 
      area[`simulado_${item.simulado_id}`] = percentual; 
    }); 
    
    const data = Array.from(areasMap.values()); 
    const simulados = Object.entries(simuladoNames).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.id - b.id); 
    return { data, simulados }; 
  }, [allPerformanceData]);
  
  const dynamicColors = generateRedShades(evolutionData.simulados.length);
  
  if (evolutionData.data.length === 0 || evolutionData.simulados.length === 0) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução por Grande Área
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={evolutionData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend />
              {evolutionData.simulados.map((simulado, index) => (
                <Bar 
                  key={simulado.id} 
                  dataKey={`simulado_${simulado.id}`} 
                  name={simulado.name} 
                  fill={dynamicColors[index]} 
                  label={<RenderCustomEvolutionBarLabel />} 
                />
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Componente Principal ---
const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [selectedSimulado, setSelectedSimulado] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverallStats>({ total: 0, acertos: 0, percentual: 0 });
  const [performancePorArea, setPerformancePorArea] = useState<PerformanceData[]>([]);
  const [bySpecialty, setBySpecialty] = useState<SpecialtyPerformanceData[]>([]);
  const [bySubspecialty, setBySubspecialty] = useState<SubspecialtyPerformanceData[]>([]);
  const [byDifficulty, setByDifficulty] = useState<PerformanceData[]>([]);
  const [ranking, setRanking] = useState<{ ies: RankingData | null; semester: RankingData | null } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<ReviewedQuestion[]>([]);

  const CACHE_KEY_PREFIX = `performanceData_${user?.id}`;

  const fetchDataForView = async (simuladoId: number | null, forceRefresh = false) => {
    if (!user) return;
    setLoading(true);
    
    const PERFORMANCE_CACHE_KEY = `${CACHE_KEY_PREFIX}_${simuladoId || 'all'}`;
    if (!forceRefresh && sessionStorage.getItem(PERFORMANCE_CACHE_KEY)) {
      const parsedData = JSON.parse(sessionStorage.getItem(PERFORMANCE_CACHE_KEY)!);
      setStats(parsedData.stats); 
      setPerformancePorArea(parsedData.performancePorArea); 
      setBySpecialty(parsedData.bySpecialty); 
      setBySubspecialty(parsedData.bySubspecialty); 
      setByDifficulty(parsedData.byDifficulty); 
      setRanking(parsedData.ranking); 
      setUserData(parsedData.userData); 
      setSimulados(parsedData.simulados);
      setLoading(false);
      return;
    }
    
    try {
      // Mock simulados data since we don't have direct access to simulados table
      const mockSimulados: Simulado[] = [
        { id: 1, nome: 'Simulado 1' },
        { id: 2, nome: 'Simulado 2' },
        { id: 3, nome: 'Simulado 3' }
      ];
      
      setSimulados(mockSimulados);
      
      // Mock data for demonstration - replace with actual table queries
      const mockStats = { total: 100, acertos: 75, percentual: 75 };
      const mockPerformanceData = [
        { name: 'Clínica Médica', total: 30, acertos: 25, percentual: 83 },
        { name: 'Cirurgia', total: 25, acertos: 18, percentual: 72 },
        { name: 'Pediatria', total: 20, acertos: 15, percentual: 75 },
        { name: 'Ginecologia', total: 25, acertos: 17, percentual: 68 }
      ];
      
      setStats(mockStats);
      setPerformancePorArea(mockPerformanceData);
      setBySpecialty(mockPerformanceData.map(item => ({ ...item, area_name: item.name })));
      setBySubspecialty([]);
      setByDifficulty([
        { name: 'Fácil', total: 40, acertos: 35, percentual: 88 },
        { name: 'Médio', total: 40, acertos: 28, percentual: 70 },
        { name: 'Difícil', total: 20, acertos: 12, percentual: 60 }
      ]);
      setRanking({ ies: { rank: 15, total: 100 }, semester: { rank: 8, total: 50 } });
      
    } catch (error) { 
      console.error("Erro ao buscar dados:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    if (user) { 
      fetchDataForView(selectedSimulado); 
    } 
  }, [user, selectedSimulado]);

  useEffect(() => {
    if (!user) return;
    
    // Mock evolution data
    setAllPerformanceData([
      { simulado_id: 1, simulado_nome: 'Simulado 1', area_name: 'Clínica Médica', total: 30, acertos: 20 },
      { simulado_id: 2, simulado_nome: 'Simulado 2', area_name: 'Clínica Médica', total: 30, acertos: 25 },
    ]);
  }, [user]);

  const handleRefresh = () => { 
    sessionStorage.clear(); 
    fetchDataForView(selectedSimulado, true); 
  };
  
  const handleSimuladoChange = (simuladoIdStr: string) => { 
    const simuladoId = simuladoIdStr === 'all' ? null : Number(simuladoIdStr);
    setSelectedSimulado(simuladoId); 
  };
  
  const handleSubspecialtyClick = async (subspecialtyName: string) => {
    setIsModalOpen(true); 
    setIsLoadingQuestion(true); 
    setSelectedQuestions([]);
    
    try {
      // Mock question data for demonstration
      const mockQuestions: ReviewedQuestion[] = [
        {
          id: '1',
          gabarito: 'A',
          enunciado: 'Qual é o principal tratamento para hipertensão arterial?',
          a: 'Medicamentos anti-hipertensivos',
          b: 'Cirurgia',
          c: 'Apenas dieta',
          d: 'Exercícios apenas',
          comentario: 'O tratamento da hipertensão arterial envolve principalmente medicamentos anti-hipertensivos.',
          imagem: null,
          dificuldade: 'Médio',
          acertou: true
        }
      ];
      
      setSelectedQuestions(mockQuestions);
    } catch (error) { 
      console.error("Erro ao buscar as questões:", error); 
    } finally { 
      setIsLoadingQuestion(false); 
    }
  };

  const barData: DifficultyData[] = byDifficulty.sort((a, b) => { 
    const order = { 'Fácil': 1, 'Moderado': 2, 'Médio': 2, 'Difícil': 3 }; 
    return (order[a.name as keyof typeof order] || 4) - (order[b.name as keyof typeof order] || 4); 
  }).map((item, index) => ({ 
    name: item.name, 
    value: item.percentual, 
    fill: ['#f87171', '#dc2626', '#b91c1c'][index] || '#7f1d1d', 
    total: item.total, 
    acertos: item.acertos 
  }));
  
  if (loading) return (
    <div className="p-6 flex justify-center items-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className='ml-4'>Carregando dashboard...</p>
    </div>
  );
  
  if (!stats || stats.total === 0 && simulados.length === 0) return (
    <div className="p-6">Nenhum dado de simulado encontrado.</div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <style>{` 
        .card-container { 
          container-type: inline-size; 
          container-name: node-card; 
        } 
        .font-dynamic { 
          font-size: clamp(0.7rem, 5cqw, 0.875rem); 
          line-height: 1.2; 
        } 
      `}</style>
      
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Desempenho</h1>
          <p className="text-muted-foreground">Sua performance detalhada nos simulados.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="min-w-[200px]">
            <Select onValueChange={handleSimuladoChange} value={selectedSimulado?.toString() ?? 'all'}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visão Geral</SelectItem>
                {simulados.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <ChevronsUpDown className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Aproveitamento Geral</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.percentual}%</div>
            <p className="text-xs text-muted-foreground">{stats.acertos}/{stats.total} questões</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">Ranking na IES</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {ranking?.ies ? `${ranking.ies.rank}º` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {ranking?.ies ? `de ${ranking.ies.total} alunos` : 'Não disponível'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Ranking no Semestre</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {ranking?.semester ? `${ranking.semester.rank}º` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {ranking?.semester ? `de ${ranking.semester.total} alunos` : 'Não disponível'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Melhor Área</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {performancePorArea.length > 0 ? 
                Math.max(...performancePorArea.map(a => a.percentual)) + '%' : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {performancePorArea.length > 0 ? 
                performancePorArea.reduce((prev, current) => 
                  prev.percentual > current.percentual ? prev : current).name : 'Não disponível'}
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.total > 0 && (
        <PerformanceSummary 
          stats={stats} 
          performancePorArea={performancePorArea} 
          bySpecialty={bySpecialty} 
          byDifficulty={byDifficulty} 
        />
      )}

      {stats.total > 0 && (
        <DecompositionTree 
          overallStats={stats} 
          areas={performancePorArea} 
          specialties={bySpecialty} 
          subspecialties={bySubspecialty} 
          onSubspecialtyClick={handleSubspecialtyClick} 
          selectedSimulado={selectedSimulado} 
        />
      )}

      {byDifficulty.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Desempenho por Nível de Dificuldade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={barData}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="value" label={<CustomBarLabel />} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {allPerformanceData.length > 0 && (
        <EvolutionChart allPerformanceData={allPerformanceData} />
      )}

      <QuestionModal 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        questions={selectedQuestions} 
        isLoading={isLoadingQuestion} 
      />
    </div>
  );
};

export default SimuladoDesempenho;