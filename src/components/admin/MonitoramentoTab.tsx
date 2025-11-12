import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, AlertTriangle, Clock, TrendingDown, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface SimuladoStats {
  id: string;
  nome: string;
  total_alunos: number;
  tempo_medio_segundos: number;
  taxa_abandono: number;
}

interface QuestaoErro {
  questao_id: string;
  enunciado: string;
  taxa_erro: number;
  total_respostas: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981'];

export const MonitoramentoTab = () => {
  const [loading, setLoading] = useState(true);
  const [simulados, setSimulados] = useState<SimuladoStats[]>([]);
  const [questoesErro, setQuestoesErro] = useState<QuestaoErro[]>([]);
  const [simuladoSelecionado, setSimuladoSelecionado] = useState<string | null>(null);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      // Buscar estatísticas de todos os simulados
      const { data: simuladosData, error: simuladosError } = await supabase
        .from('simulados_admin')
        .select('id, nome, duracao_minutos')
        .eq('status', 'ativo');

      if (simuladosError) throw simuladosError;

      // Para cada simulado, calcular estatísticas
      const stats: SimuladoStats[] = [];
      
      for (const sim of simuladosData || []) {
        // Contar total de alunos que fizeram o simulado
        const { data: respostas, error: respostasError } = await supabase
          .from('answer_progress')
          .select('email, correct')
          .eq('simulado', sim.id);

        if (respostasError) throw respostasError;

        const alunosUnicos = new Set(respostas?.map(r => r.email) || []).size;
        
        // Calcular tempo médio (mockado por enquanto - futura implementação)
        const tempoMedio = sim.duracao_minutos * 60 * 0.7; // Assumindo 70% do tempo total

        // Taxa de abandono (mockado por enquanto)
        const taxaAbandono = 15; // 15%

        stats.push({
          id: sim.id,
          nome: sim.nome,
          total_alunos: alunosUnicos,
          tempo_medio_segundos: tempoMedio,
          taxa_abandono: taxaAbandono
        });
      }

      setSimulados(stats);
      if (stats.length > 0) {
        setSimuladoSelecionado(stats[0].id);
        await carregarQuestoesComErro(stats[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const carregarQuestoesComErro = async (simuladoId: string) => {
    try {
      // Buscar todas as respostas do simulado
      const { data: respostas, error: respostasError } = await supabase
        .from('answer_progress')
        .select('question_id, correct')
        .eq('simulado', simuladoId);

      if (respostasError) throw respostasError;

      // Agrupar por questão e calcular taxa de erro
      const questaoMap = new Map<string, { corretas: number; total: number }>();
      
      respostas?.forEach(r => {
        const current = questaoMap.get(r.question_id) || { corretas: 0, total: 0 };
        current.total++;
        if (r.correct) current.corretas++;
        questaoMap.set(r.question_id, current);
      });

      // Buscar enunciados das questões
      const questoesIds = Array.from(questaoMap.keys());
      const { data: questoes, error: questoesError } = await supabase
        .from('questoes_simulado')
        .select('id, enunciado')
        .in('id', questoesIds);

      if (questoesError) throw questoesError;

      // Calcular taxa de erro e ordenar
      const questoesComErro: QuestaoErro[] = (questoes || []).map(q => {
        const stats = questaoMap.get(q.id)!;
        const taxaErro = ((stats.total - stats.corretas) / stats.total) * 100;
        return {
          questao_id: q.id,
          enunciado: q.enunciado.substring(0, 100) + '...',
          taxa_erro: taxaErro,
          total_respostas: stats.total
        };
      }).sort((a, b) => b.taxa_erro - a.taxa_erro).slice(0, 10);

      setQuestoesErro(questoesComErro);
    } catch (error) {
      console.error('Erro ao carregar questões com erro:', error);
    }
  };

  const formatarTempo = (segundos: number): string => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    return `${horas}h ${minutos}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const simuladoAtual = simulados.find(s => s.id === simuladoSelecionado);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          Dashboard de Monitoramento
        </h2>
        <p className="text-muted-foreground mt-2">
          Análise detalhada do desempenho dos alunos nos simulados
        </p>
      </div>

      {/* Seletor de Simulado */}
      <Tabs value={simuladoSelecionado || ''} onValueChange={(val) => {
        setSimuladoSelecionado(val);
        carregarQuestoesComErro(val);
      }}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          {simulados.map(sim => (
            <TabsTrigger key={sim.id} value={sim.id} className="whitespace-nowrap">
              {sim.nome}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {simuladoAtual && (
        <>
          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Alunos Participantes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{simuladoAtual.total_alunos}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Realizaram o simulado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tempo Médio
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatarTempo(simuladoAtual.tempo_medio_segundos)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Para conclusão
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Taxa de Abandono
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {simuladoAtual.taxa_abandono.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Não finalizaram
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Questões Críticas
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {questoesErro.filter(q => q.taxa_erro > 70).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Com +70% de erro
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Questões com Maior Taxa de Erro */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Questões com Maior Taxa de Erro</CardTitle>
              <CardDescription>
                Identificação de questões que exigem ajustes pedagógicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questoesErro.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={questoesErro}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="questao_id" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Taxa de Erro (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as QuestaoErro;
                          return (
                            <div className="bg-card p-4 border rounded-lg shadow-lg">
                              <p className="font-semibold mb-2">Questão: {data.questao_id.substring(0, 8)}...</p>
                              <p className="text-sm text-muted-foreground mb-2">{data.enunciado}</p>
                              <p className="text-sm">
                                <span className="font-medium">Taxa de Erro:</span> {data.taxa_erro.toFixed(1)}%
                              </p>
                              <p className="text-sm">
                                <span className="font-medium">Total de Respostas:</span> {data.total_respostas}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="taxa_erro" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum dado disponível para este simulado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela Detalhada de Questões Problemáticas */}
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada de Questões</CardTitle>
              <CardDescription>
                Questões ordenadas por taxa de erro decrescente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questoesErro.map((questao, index) => (
                  <div
                    key={questao.questao_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-mono text-sm text-muted-foreground">
                          {questao.questao_id.substring(0, 12)}...
                        </span>
                      </div>
                      <p className="text-sm">{questao.enunciado}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {questao.total_respostas} respostas
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-2xl font-bold ${
                        questao.taxa_erro > 70 ? 'text-red-500' :
                        questao.taxa_erro > 50 ? 'text-orange-500' :
                        'text-yellow-500'
                      }`}>
                        {questao.taxa_erro.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">de erro</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MonitoramentoTab;
