// dashboard-desempenho.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target, TrendingUp, BarChart3, BarChart, Loader2, FileText, Star, TrendingDown, HelpCircle, ChevronsUpDown } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart as RechartsBarChart, Bar, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces (adicionar Simulado) ---
interface Simulado {
  id: number;
  nome: string;
}
interface PerformanceData { name: string; total: number; acertos: number; percentual: number; }
interface SpecialtyPerformanceData extends PerformanceData { area_name?: string; area_id?: number; }
interface SubspecialtyPerformanceData extends PerformanceData { specialty_name?: string; specialty_id?: number; area_name?: string; }
interface RankingData { rank: number; total: number; }
interface OverallStats { total: number; acertos: number; percentual: number; }
interface DifficultyData { name: string; value: number; fill: string; total: number; acertos: number; }
interface UserData { semestre: number; }
interface QuestionDetails { id: string; gabarito: 'A' | 'B' | 'C' | 'D'; enunciado: string; a: string; b: string; c: string; d: string; comentario: string; imagem: string | null; }

// --- Componentes Auxiliares (sem alterações) ---
const CustomBarTooltip = ({ active, payload }: any) => { if (active && payload && payload.length) { const data = payload[0].payload; return ( <div className="bg-background p-3 border rounded-md shadow-lg"> <p className="font-bold mb-2">{data.name}</p> <p className="text-sm">Percentual de Acertos: {data.value}%</p> <p className="text-sm">Acertos: {data.acertos}/{data.total}</p> </div> ); } return null; };
const CustomBarLabel = (props: any) => { const { x, y, width, height, value } = props; return ( <text x={x + width / 2} y={y + height / 2} fill="white" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold" > {value}% </text> );};

// --- Componente do Modal de Questão (sem alterações) ---
const QuestionModal: React.FC<{ isOpen: boolean; onOpenChange: (open: boolean) => void; question: QuestionDetails | null; isLoading: boolean; }> = ({ isOpen, onOpenChange, question, isLoading }) => { const alternatives: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> = question ? [ { key: 'A', text: question.a }, { key: 'B', text: question.b }, { key: 'C', text: question.c }, { key: 'D', text: question.d } ] : []; return ( <Dialog open={isOpen} onOpenChange={onOpenChange}> <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"> <DialogHeader> <DialogTitle>Revisão de Questão</DialogTitle> </DialogHeader> {isLoading ? ( <div className="flex justify-center items-center h-64"> <Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-4">Buscando questão...</p> </div> ) : question ? ( <div className="space-y-6 py-4"> <p className="text-base leading-relaxed whitespace-pre-wrap">{question.enunciado}</p> {question.imagem && ( <div className="flex justify-center my-4"> <img src={question.imagem} alt="Imagem da questão" className="max-w-full h-auto rounded-md" /> </div> )} <div className="space-y-3"> {alternatives.map(alt => ( <div key={alt.key} className={cn("p-3 border rounded-md text-left", question.gabarito === alt.key ? "bg-green-500/20 border-green-500 text-green-300" : "bg-muted/30")}> <span className="font-bold mr-2">{alt.key})</span> {alt.text} </div> ))} </div> <div className="bg-zinc-800/80 p-4 rounded-md space-y-2 border border-zinc-700"> <h4 className="font-bold text-lg text-primary">Comentário do Professor</h4> <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{question.comentario}</p> </div> </div> ) : ( <div className="flex justify-center items-center h-64"> <p>Nenhuma questão de exemplo foi encontrada para esta subespecialidade.</p> </div> )} </DialogContent> </Dialog> ); };

// --- Componente de Resumo de Desempenho (sem alterações) ---
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

  const bestSpecialtyInBestArea = bySpecialty
    .filter(s => s.area_name === bestArea.name)
    .sort((a, b) => b.percentual - a.percentual)[0];
  
  const specialtiesToImprove = bySpecialty
    .filter(s => s.area_name === worstArea.name)
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 2);

  const worstDifficulty = [...byDifficulty].sort((a, b) => a.percentual - b.percentual)[0];

  const getAdjective = (percentual: number) => {
    if (percentual >= 80) return "excelente";
    if (percentual >= 65) return "muito bom";
    if (percentual >= 50) return "sólido";
    return "um bom ponto de partida";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Relatório de Desempenho
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p>
          Seu aproveitamento geral de <strong>{stats.percentual}%</strong> ({stats.acertos}/{stats.total} questões) é um resultado <strong>{getAdjective(stats.percentual)}</strong>. Veja abaixo os principais destaques para guiar seus estudos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-green-500" /> Pontos Fortes</h3>
            <p>Sua principal fortaleza foi em <strong>{bestArea.name}</strong>, com <strong>{bestArea.percentual}%</strong> de acertos.</p>
            {bestSpecialtyInBestArea && (
              <p>Dentro desta área, você se destacou em <strong>{bestSpecialtyInBestArea.name}</strong> ({bestSpecialtyInBestArea.percentual}%).</p>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Oportunidades de Melhoria</h3>
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
            <h3 className="font-semibold flex items-center gap-2"><HelpCircle className="h-4 w-4 text-amber-500" /> Análise por Dificuldade</h3>
            <p>Seu maior desafio foi em questões de nível <strong>{worstDifficulty.name}</strong>, com <strong>{worstDifficulty.percentual}%</strong> de acertos. Revisar casos clínicos e conceitos mais complexos pode ajudar.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Componentes da Árvore de Decomposição (MODIFICADO) ---
const Node: React.FC<{ name: string; percentage: number; isSelected: boolean; onClick: () => void; }> = ({ name, percentage, isSelected, onClick }) => ( <button onClick={onClick} className={cn( "card-container w-full text-left p-3 border rounded-md transition-all duration-200 hover:bg-muted/80", isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border" )} > <div className="flex justify-between items-center gap-2"> <span className="font-medium font-dynamic pr-2">{name}</span> <span className={cn("font-bold text-sm", isSelected ? "text-primary-foreground" : "text-primary")}> {percentage}% </span> </div> </button> );
const Column: React.FC<{ title: string; children: React.ReactNode; isEmpty?: boolean; emptyText?: string }> = ({ title, children, isEmpty = false, emptyText = "Selecione um item na coluna anterior." }) => ( <div className="flex-1 min-w-[250px]"> <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{title}</h3> <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2"> {isEmpty ? ( <div className="flex items-center justify-center h-40 text-center text-muted-foreground text-sm p-4 border border-dashed rounded-md"> {emptyText} </div> ) : children} </div> </div> );
const listContainerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, }, }, };
const listItemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }, exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }, };

const DecompositionTree: React.FC<{
  overallStats: OverallStats;
  areas: PerformanceData[];
  specialties: SpecialtyPerformanceData[];
  subspecialties: SubspecialtyPerformanceData[];
  onSubspecialtyClick: (subspecialtyName: string) => void;
  simulados: Simulado[];
  selectedSimulado: number | null;
  onSimuladoChange: (simuladoId: number | null) => void;
}> = ({
  overallStats,
  areas,
  specialties,
  subspecialties,
  onSubspecialtyClick,
  simulados,
  selectedSimulado,
  onSimuladoChange
}) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  useEffect(() => {
    // Reset selections when simulado changes
    setSelectedArea(null);
    setSelectedSpecialty(null);
  }, [selectedSimulado]);

  const handleAreaClick = (areaName: string) => { if (selectedArea === areaName) { setSelectedArea(null); setSelectedSpecialty(null); } else { setSelectedArea(areaName); setSelectedSpecialty(null); } };
  const handleSpecialtyClick = (specialtyName: string) => { setSelectedSpecialty(prevState => prevState === specialtyName ? null : specialtyName); };

  const filteredSpecialties = selectedArea ? specialties.filter(s => s.area_name && s.area_name.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueFilteredSpecialties = filteredSpecialties.filter((specialty, index, self) => index === self.findIndex((s) => s.name.toLowerCase() === specialty.name.toLowerCase())).sort((a, b) => b.percentual - a.percentual);

  const filteredSubspecialties = selectedArea && selectedSpecialty ? subspecialties.filter(s => s.specialty_name?.toLowerCase() === selectedSpecialty.toLowerCase() && s.area_name?.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueFilteredSubspecialties = filteredSubspecialties.filter((sub, index, self) => index === self.findIndex((s) => s.name.toLowerCase() === sub.name.toLowerCase())).sort((a, b) => b.percentual - a.percentual);

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
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Selecione o Simulado</h3>
              <Select onValueChange={(value) => onSimuladoChange(value === 'all' ? null : Number(value))} value={selectedSimulado?.toString() ?? 'all'}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visão Geral</SelectItem>
                  {simulados.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                {areas.map(area => (
                  <motion.div key={area.name} variants={listItemVariants}>
                    <Node name={area.name} percentage={area.percentual} isSelected={selectedArea === area.name} onClick={() => handleAreaClick(area.name)} />
                  </motion.div>
                ))}
              </motion.div>
            </Column>
            <Column title="Especialidade" isEmpty={!selectedArea || uniqueFilteredSpecialties.length === 0} emptyText={!selectedArea ? "Selecione uma Grande Área." : "Nenhuma especialidade encontrada."} >
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                <AnimatePresence>
                  {uniqueFilteredSpecialties.map(specialty => (
                    <motion.div key={specialty.name} variants={listItemVariants} exit="exit" >
                      <Node name={specialty.name} percentage={specialty.percentual} isSelected={selectedSpecialty === specialty.name} onClick={() => handleSpecialtyClick(specialty.name)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </Column>
            <Column title="Subespecialidade / Assunto" isEmpty={!selectedSpecialty || uniqueFilteredSubspecialties.length === 0} emptyText={!selectedSpecialty ? "Selecione uma Especialidade." : "Nenhuma subespecialidade encontrada."} >
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible" className="space-y-2">
                <AnimatePresence>
                  {uniqueFilteredSubspecialties.map(sub => (
                    <motion.div key={sub.name} variants={listItemVariants} exit="exit" >
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


// --- NOVO COMPONENTE: GRÁFICO DE EVOLUÇÃO ---
interface EvolutionData {
  name: string; // Nome da especialidade
  [key: string]: string | number; // `simulado_1`: 80, `simulado_2`: 85...
}

const EvolutionChart: React.FC<{ allPerformanceData: any[] }> = ({ allPerformanceData }) => {
  const evolutionData = useMemo(() => {
    const specialtiesMap = new Map<string, EvolutionData>();
    const simuladoNames: { [key: number]: string } = {};

    allPerformanceData.forEach(item => {
      if (!simuladoNames[item.simulado_id]) {
        simuladoNames[item.simulado_id] = item.simulado_nome;
      }
      if (!specialtiesMap.has(item.specialty_name)) {
        specialtiesMap.set(item.specialty_name, { name: item.specialty_name });
      }
      const specialty = specialtiesMap.get(item.specialty_name)!;
      const percentual = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0;
      specialty[`simulado_${item.simulado_id}`] = percentual;
    });

    const data = Array.from(specialtiesMap.values());
    const simulados = Object.entries(simuladoNames).map(([id, name]) => ({ id: Number(id), name }));

    return { data, simulados };
  }, [allPerformanceData]);

  // Cores para as barras
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  if (evolutionData.data.length === 0 || evolutionData.simulados.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChevronsUpDown className="h-5 w-5 text-primary" />
            Evolução entre Simulados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Realize pelo menos dois simulados para ver sua evolução.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChevronsUpDown className="h-5 w-5 text-primary" />
          Evolução entre Simulados por Especialidade
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={evolutionData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {evolutionData.simulados.map((simulado, index) => (
              <Bar key={simulado.id} dataKey={`simulado_${simulado.id}`} name={simulado.name} fill={colors[index % colors.length]} />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};


// --- COMPONENTE PRINCIPAL (MODIFICADO) ---
export const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [performancePorArea, setPerformancePorArea] = useState<PerformanceData[]>([]);
  const [bySpecialty, setBySpecialty] = useState<SpecialtyPerformanceData[]>([]);
  const [bySubspecialty, setBySubspecialty] = useState<SubspecialtyPerformanceData[]>([]);
  const [byDifficulty, setByDifficulty] = useState<PerformanceData[]>([]);
  const [ranking, setRanking] = useState<{ ies: RankingData, semester: RankingData } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionDetails | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  
  // Novos estados
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [selectedSimulado, setSelectedSimulado] = useState<number | null>(null);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  
  const CACHE_KEY_PREFIX = `performanceData_${user?.id}`;

  const fetchData = async (forceRefresh = false) => {
    if (!user) return;
    setLoading(true);

    const CACHE_KEY = `${CACHE_KEY_PREFIX}_${selectedSimulado || 'all'}`;

    if (!forceRefresh) {
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      if (cachedData) {
        console.log(`Loading data from cache for simulado ${selectedSimulado || 'all'}! ⚡️`);
        const parsedData = JSON.parse(cachedData);
        setStats(parsedData.stats);
        setPerformancePorArea(parsedData.performancePorArea);
        setBySpecialty(parsedData.bySpecialty);
        setBySubspecialty(parsedData.bySubspecialty);
        setByDifficulty(parsedData.byDifficulty);
        setRanking(parsedData.ranking);
        setUserData(parsedData.userData);
        setSimulados(parsedData.simulados || []);
        setAllPerformanceData(parsedData.allPerformanceData || []);
        setLoading(false);
        return;
      }
    }

    console.log(`Fetching data from Supabase for simulado ${selectedSimulado || 'all'}... ☁️`);
    try {
      // Simplified: Get unique simulados from user's answers
      const { data: answersData } = await supabase
        .from('answer_progress_enamed')
        .select('simulado')
        .eq('email', user.email);
      
      const uniqueSimulados = [...new Set(answersData?.map(a => a.simulado) || [])];
      const simuladosFormatted = uniqueSimulados.map(id => ({ 
        id, 
        nome: `Simulado ${id}` 
      }));
      setSimulados(simuladosFormatted);

      // Busca os dados de performance
      const { data: userDataResponse, error: userError } = await supabase.from('users').select('semestre').eq('email', user.email).single();
      if (userError) throw userError;

      const [performanceResult, rankingResult, allPerformanceResult] = await Promise.all([
        supabase.rpc('get_user_performance_aggregates').single(),
        supabase.rpc('get_user_rankings').single(),
        // Simplified evolution data
        supabase
          .from('answer_progress_enamed')
          .select('simulado, correct, questions_enamed!inner(Especialidade)')
          .eq('email', user.email)
      ]);
      
      if (performanceResult.error) throw performanceResult.error;
      if (rankingResult.error) throw rankingResult.error;
      if (allPerformanceResult.error) throw allPerformanceResult.error;

      // Processa os dados de performance para o simulado selecionado
      if (performanceResult.data) {
        const { overallStats, byArea, bySpecialty, bySubspecialty, byDifficulty } = performanceResult.data as any;
        const processData = (d: any[]) => (d || []).map(item => ({ ...item, percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0 }));
        
        const newStats = { total: overallStats?.total || 0, acertos: overallStats?.acertos || 0, percentual: overallStats?.total > 0 ? Math.round((overallStats.acertos / overallStats.total) * 100) : 0 };
        const newPerformancePorArea = processData(byArea || []);
        const newBySpecialty = processData(bySpecialty || []);
        const newBySubspecialty = processData(bySubspecialty || []);
        const newByDifficulty = processData(byDifficulty || []);
        const rankingData = rankingResult.data as any;
        const newRanking = rankingData ? { ies: rankingData.rankingIES || null, semester: rankingData.rankingSemester || null } : null;
        
        setUserData(userDataResponse);
        setStats(newStats);
        setPerformancePorArea(newPerformancePorArea);
        setBySpecialty(newBySpecialty);
        setBySubspecialty(newBySubspecialty);
        setByDifficulty(newByDifficulty);
        setRanking(newRanking);
        // Process evolution data from simplified query
        const groupedData = new Map();
        (allPerformanceResult.data || []).forEach((item: any) => {
          const key = `${item.simulado}-${item.questions_enamed?.Especialidade}`;
          if (!groupedData.has(key)) {
            groupedData.set(key, {
              simulado_id: item.simulado,
              simulado_nome: `Simulado ${item.simulado}`,
              specialty_name: item.questions_enamed?.Especialidade || 'Não especificado',
              total: 0,
              acertos: 0
            });
          }
          const entry = groupedData.get(key);
          entry.total++;
          if (item.correct) entry.acertos++;
        });
        setAllPerformanceData(Array.from(groupedData.values()));

        const dataToCache = {
          stats: newStats,
          performancePorArea: newPerformancePorArea,
          bySpecialty: newBySpecialty,
          bySubspecialty: newBySubspecialty,
          byDifficulty: newByDifficulty,
          ranking: newRanking,
          userData: userDataResponse,
          simulados: simuladosFormatted || [],
          allPerformanceData: allPerformanceResult.data || []
        };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
        console.log(`Data for simulado ${selectedSimulado || 'all'} saved to cache! ✅`);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedSimulado]);

  const handleRefresh = () => {
    sessionStorage.clear(); // Limpa todo o cache para garantir consistência
    fetchData(true);
  };
  
  const handleSimuladoChange = (simuladoId: number | null) => {
    setSelectedSimulado(simuladoId);
  };

  const handleSubspecialtyClick = async (subspecialtyName: string) => { setIsModalOpen(true); setIsLoadingQuestion(true); setSelectedQuestion(null); try { const { data, error } = await supabase.rpc('get_question_by_subspecialty', { sub_name: subspecialtyName }).maybeSingle(); if (error) throw error; if (data) { setSelectedQuestion(data as QuestionDetails); } else { console.warn(`Nenhuma questão encontrada para: ${subspecialtyName}`); } } catch (error) { console.error("Erro ao buscar a questão:", error); } finally { setIsLoadingQuestion(false); } };

  const barData: DifficultyData[] = byDifficulty.sort((a, b) => { const order = { 'Fácil': 1, 'Moderado': 2, 'Médio': 2, 'Difícil': 3 }; return (order[a.name as keyof typeof order] || 4) - (order[b.name as keyof typeof order] || 4); }).map((item, index) => ({ name: item.name, value: item.percentual, fill: ['#f87171', '#dc2626', '#b91c1c'][index] || '#7f1d1d', total: item.total, acertos: item.acertos }));
  if (loading) return <div className="p-6 flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /><p className='ml-4'>Carregando dashboard de desempenho...</p></div>;
  if (!stats || stats.total === 0 && simulados.length === 0) return <div className="p-6">Nenhum dado de simulado encontrado.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <style>{` .card-container { container-type: inline-size; container-name: node-card; } .font-dynamic { font-size: clamp(0.7rem, 5cqw, 0.875rem); line-height: 1.2; } `}</style>
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Desempenho</h1>
          <p className="text-muted-foreground">Sua performance detalhada no simulado ENAMED.</p>
        </div>
        <button onClick={handleRefresh} className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar Dados"}
        </button>
      </div>

      {stats && performancePorArea.length > 0 && (
        <PerformanceSummary
          stats={stats}
          performancePorArea={performancePorArea}
          bySpecialty={bySpecialty}
          byDifficulty={byDifficulty}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Resumo do Desempenho
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-[270px] space-y-6">
            <div className="text-center pt-6">
              <p className="text-4xl font-bold">{stats.percentual}% de Acertos</p>
              <p className="text-lg text-muted-foreground mt-2">
                {stats.acertos} de {stats.total} questões corretas
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {ranking?.ies && ranking.ies.total > 0 && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium mb-2">
                    <Trophy className="h-4 w-4 text-amber-500" /> Ranking na IES
                  </div>
                  <p className="text-xl font-bold text-primary">{ranking.ies.rank}º</p>
                  <p className="text-xs text-muted-foreground">
                    de {ranking.ies.total} {ranking.ies.total !== 1 ? 'alunos' : 'aluno'}
                  </p>
                </div>
              )}
              {ranking?.semester && ranking.semester.total > 0 && userData && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" /> Ranking no {userData.semestre}° semestre
                  </div>
                  <p className="text-xl font-bold text-primary">{ranking.semester.rank}º</p>
                  <p className="text-xs text-muted-foreground">
                    de {ranking.semester.total} {ranking.semester.total !== 1 ? 'alunos' : 'aluno'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Acertos por Dificuldade
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={barData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="value" name="Percentual de Acertos" radius={[0, 4, 4, 0]} label={<CustomBarLabel />}>
                  {barData.map((entry) => (
                    <rect key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico de Evolução */}
      <EvolutionChart allPerformanceData={allPerformanceData} />

      {stats && (
        <DecompositionTree
          overallStats={stats}
          areas={performancePorArea}
          specialties={bySpecialty}
          subspecialties={bySubspecialty}
          onSubspecialtyClick={handleSubspecialtyClick}
          simulados={simulados}
          selectedSimulado={selectedSimulado}
          onSimuladoChange={handleSimuladoChange}
        />
      )}
      <QuestionModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} question={selectedQuestion} isLoading={isLoadingQuestion} />
    </div>
  );
};