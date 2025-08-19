import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Target, CheckCircle, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface AreaPerformance {
  name: string;
  total: number;
  acertos: number;
  percentual: number;
}

type SimuladoProgress = {
  correct: boolean | null;
  questions_enamed: {
    "Tema (Grande Área)": string;
  } | null;
};

export const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [performancePorArea, setPerformancePorArea] = useState<AreaPerformance[]>([]);
  const [stats, setStats] = useState({ total: 0, acertos: 0, erros: 0, percentual: 0 });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPerformanceData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // A MUDANÇA ESTÁ AQUI: Usamos .eq('email', user.email)
        const { data, error } = await supabase
          .from('answer_progress_enamed')
          .select('correct, questions_enamed("Tema (Grande Área)")')
          .eq('email', user.email); // Corrigido para usar o email do usuário logado

        if (error) throw error;

        if (data && data.length > 0) {
          const total = data.length;
          const acertos = data.filter(item => item.correct === true).length;
          const erros = total - acertos;
          const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
          setStats({ total, acertos, erros, percentual });

          const statsPorArea = (data as SimuladoProgress[]).reduce((acc, item) => {
            const area = item.questions_enamed?.["Tema (Grande Área)"] || 'Não categorizado';
            
            if (!acc[area]) {
              acc[area] = { total: 0, acertos: 0 };
            }
            acc[area].total += 1;
            if (item.correct === true) {
              acc[area].acertos += 1;
            }
            return acc;
          }, {} as Record<string, { total: number; acertos: number }>);

          const performanceData = Object.entries(statsPorArea).map(([area, dados]) => ({
            name: area,
            total: dados.total,
            acertos: dados.acertos,
            percentual: dados.total > 0 ? Math.round((dados.acertos / dados.total) * 100) : 0,
          }));

          setPerformancePorArea(performanceData);
        }
      } catch (error) {
        console.error("Erro ao buscar dados de desempenho:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [user]);

  // O resto do componente (JSX) não precisa de alterações.
  if (loading) {
    return <div className="p-6">Carregando desempenho...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Desempenho no Simulado</h1>
        <p className="text-muted-foreground">Veja seus resultados detalhados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-primary" />
              Percentual de Acerto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.percentual}%</p>
            <p className="text-xs text-muted-foreground">{stats.acertos} de {stats.total} questões</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Total de Acertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.acertos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <XCircle className="h-4 w-4 text-red-500" />
              Total de Erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.erros}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Questões Respondidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Área de Conhecimento</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          {performancePorArea.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performancePorArea} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background p-2 border rounded-md shadow-lg">
                          <p className="font-bold">{label}</p>
                          <p className="text-sm text-primary">
                            Acertos: {payload[0].payload.acertos} de {payload[0].payload.total}
                          </p>
                           <p className="text-sm">
                            Percentual: {payload[0].value}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend formatter={(value) => <span className="capitalize">{value}</span>} />
                <Bar dataKey="percentual" name="Percentual de Acertos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Nenhum dado de simulado encontrado para exibir o gráfico.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};