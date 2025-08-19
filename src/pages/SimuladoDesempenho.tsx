import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Target } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

// Definimos um tipo para os dados que virão do Supabase
type SimuladoProgress = {
  correct: boolean | null;
  // Adicione outros campos da tabela que precisar, como 'area_conhecimento' se existir
};

export const SimuladoDesempenho: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, acertos: 0, percentual: 0 });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPerformanceData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Busca os dados de progresso do simulado para o usuário logado
        const { data, error } = await supabase
          .from('answer_progress_simulado_enamed')
          .select('correct') // Puxamos apenas a coluna 'correct' por enquanto
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          const total = data.length;
          const acertos = data.filter(item => item.correct === true).length;
          const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
          setStats({ total, acertos, percentual });
        }
      } catch (error) {
        console.error("Erro ao buscar dados de desempenho:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [user]);

  if (loading) {
    return <div className="p-6">Carregando desempenho...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Desempenho no Simulado</h1>
        <p className="text-muted-foreground">Veja seus resultados detalhados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" />
              Percentual de Acerto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.percentual}%</p>
          </CardContent>
        </Card>
        {/* Adicione outros cards para total de questões, etc. */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Área</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            (Aqui você pode adicionar um gráfico de barras com os resultados por disciplina)
          </p>
          {/* Exemplo de como usar o BarChart, similar ao seu Dashboard.tsx
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosPorDisciplina}>
                ...
              </BarChart>
            </ResponsiveContainer> 
          */}
        </CardContent>
      </Card>
    </div>
  );
};