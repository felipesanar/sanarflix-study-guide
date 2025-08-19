import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Target, TrendingUp, BarChart3, BookOpen, BookText, BarChart } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, BarChart as RechartsBarChart } from 'recharts';

// --- Interfaces ---
interface PerformanceData {
  name: string;
  total: number;
  acertos: number;
  percentual: number;
}

interface RankingData {
  rank: number;
  total: number;
}

interface OverallStats {
  total: number;
  acertos: number;
  percentual: number;
}

interface DifficultyData {
  name: string;
  value: number;
  fill: string;
  total: number;
  acertos: number;
}

interface UserData {
  semestre: number;
}

// --- Componente auxiliar para as Tabelas de Performance ---
const PerformanceTable: React.FC<{ title: string; data: PerformanceData[]; icon: React.ReactNode }> = ({ title, data, icon }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Acertos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Percentual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sort((a, b) => b.total - a.total).map((item) => (
              <TableRow key={item.name}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-right">{item.acertos}</TableCell>
                <TableCell className="text-right">{item.total}</TableCell>
                <TableCell className="text-right font-semibold">{item.percentual}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

// --- Componente personalizado para o Tooltip do Gráfico de Barras ---
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

// --- Componente personalizado para o Label das Barras ---
const CustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  return (
    <text
      x={x + width - 30}
      y={y + 15}
      fill="white"
      textAnchor="end"
      fontSize={12}
      fontWeight="bold"
    >
      {value}%
    </text>
  );
};

export const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [performancePorArea, setPerformancePorArea] = useState<PerformanceData[]>([]);
  const [bySpecialty, setBySpecialty] = useState<PerformanceData[]>([]);
  const [bySubspecialty, setBySubspecialty] = useState<PerformanceData[]>([]);
  const [byDifficulty, setByDifficulty] = useState<PerformanceData[]>([]);
  const [ranking, setRanking] = useState<{ ies: RankingData, semester: RankingData } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Buscar dados do usuário primeiro para obter o semestre
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('semestre')
          .eq('email', user.email)
          .single();

        if (userError) throw userError;
        setUserData(userData);

        const [performanceResult, rankingResult] = await Promise.all([
          supabase.rpc('get_user_performance_aggregates').single(),
          supabase.rpc('get_user_rankings').single()
        ]);

        if (performanceResult.error) throw performanceResult.error;
        if (performanceResult.data) {
          const { overallStats, byArea, bySpecialty, bySubspecialty, byDifficulty } = performanceResult.data;
          
          const processData = (d: any[]) => (d || []).map(item => ({
            ...item,
            percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0
          }));
            
          setStats({
            total: overallStats?.total || 0,
            acertos: overallStats?.acertos || 0,
            percentual: overallStats?.total > 0 ? Math.round((overallStats.acertos / overallStats.total) * 100) : 0
          });
          setPerformancePorArea(processData(byArea || []));
          setBySpecialty(processData(bySpecialty || []));
          setBySubspecialty(processData(bySubspecialty || []));
          setByDifficulty(processData(byDifficulty || []));
        }

        if (rankingResult.error) throw rankingResult.error;
        if (rankingResult.data) {
            setRanking({
                ies: rankingResult.data.rankingIES || null,
                semester: rankingResult.data.rankingSemester || null
            });
        }
      } catch (error) {
        console.error("Erro ao buscar dados de desempenho:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [user]);

  // Preparar dados para o gráfico de barras horizontais de dificuldade
  const barData: DifficultyData[] = byDifficulty
    .sort((a, b) => {
      const order = { 'Fácil': 1, 'Moderado': 2, 'Médio': 2, 'Difícil': 3 };
      return (order[a.name as keyof typeof order] || 4) - (order[b.name as keyof typeof order] || 4);
    })
    .map((item, index) => ({
      name: item.name,
      value: item.percentual,
      // Gradação de vermelhos do mais claro ao mais escuro
      fill: ['#fca5a5', '#ef4444', '#7f1d1d'][index] || '#6b7280',
      total: item.total,
      acertos: item.acertos
    }));

  if (loading) return <div className="p-6">Carregando dashboard de desempenho...</div>;
  if (!stats || stats.total === 0) return <div className="p-6">Nenhum dado de simulado encontrado.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Desempenho</h1>
        <p className="text-muted-foreground">Sua performance detalhada no simulado ENAMED.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumo do Desempenho - Tamanho reduzido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Resumo do Desempenho
            </CardTitle>
          </CardHeader>
          <CardContent  className="min-h-[270px] space-y-6">
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
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Ranking na IES
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
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Ranking no {userData.semestre}° semestre
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

        {/* Gráfico de Barras Horizontais - Dificuldade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Acertos por Dificuldade
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={barData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  unit="%"
                  tick={{ fill: 'white', fontWeight: 'bold' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fill: 'white', fontWeight: 'bold', fontSize: 12 }}
                  width={80}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar 
                  dataKey="value" 
                  name="Percentual de Acertos"
                  radius={[0, 4, 4, 0]}
                  label={<CustomBarLabel />}
                >
                  {barData.map((entry, index) => (
                    <rect 
                      key={`bar-${index}`} 
                      fill={entry.fill}
                    />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Desempenho por Grande Área com ícone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            Desempenho por Grande Área
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={performancePorArea} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'white', fontWeight: 'bold', fontSize: 12 }} 
              />
              <YAxis 
                yAxisId="left" 
                stroke="hsl(var(--primary))" 
                tick={{ fill: 'white', fontWeight: 'bold', fontSize: 12 }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#82ca9d" 
                tick={{ fill: 'white', fontWeight: 'bold', fontSize: 12 }} 
                unit="%" 
                domain={[0, 100]} 
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const barData = payload.find(p => p.dataKey === 'total');
                    const lineData = payload.find(p => p.dataKey === 'percentual');
                    return (
                      <div className="bg-background p-3 border rounded-md shadow-lg">
                        <p className="font-bold mb-2">{label}</p>
                        {barData && <p className="text-sm" style={{ color: barData.color }}>Total de Questões: {barData.value}</p>}
                        {lineData && <p className="text-sm" style={{ color: lineData.color }}>Percentual de Acertos: {lineData.value}%</p>}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend formatter={(value) => <span className="capitalize" style={{ color: 'white', fontWeight: 'bold' }}>{value}</span>} />
              <Bar yAxisId="left" dataKey="total" name="Total de Questões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="percentual" name="Percentual de Acertos" stroke="#82ca9d" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceTable 
          title="Desempenho por Especialidade" 
          data={bySpecialty} 
          icon={<BookOpen className="h-5 w-5 text-primary" />}
        />
        <PerformanceTable 
          title="Desempenho por Subespecialidade" 
          data={bySubspecialty} 
          icon={<BookText className="h-5 w-5 text-primary" />}
        />
      </div>
    </div>
  );
};