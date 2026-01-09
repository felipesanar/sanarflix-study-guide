import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { EmptyState } from './EmptyState';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { BookOpen, Target, TrendingUp, CheckCircle } from 'lucide-react';
import type { ProgressMetrics } from '@/hooks/useAnalyticsData';

interface RealProgressTabProps {
  progress: ProgressMetrics;
  isLoading: boolean;
}

const COLORS = [
  'hsl(var(--destructive))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--primary))',
];

export const RealProgressTab: React.FC<RealProgressTabProps> = ({
  progress,
  isLoading,
}) => {
  const hasProgressData = progress.progressoMedioPorMateria.length > 0;
  const hasFaixaData = progress.usuariosPorFaixaProgresso.some(f => f.quantidade > 0);

  // Identificar matérias problemáticas (< 30% de progresso)
  const materiasProblematicas = progress.progressoMedioPorMateria.filter(m => m.progresso < 30);
  const materiasExcelentes = progress.progressoMedioPorMateria.filter(m => m.progresso > 70);

  // Calcular total de usuários por faixa
  const totalUsuariosFaixas = progress.usuariosPorFaixaProgresso.reduce((acc, f) => acc + f.quantidade, 0);
  const usuariosBaixoProgresso = progress.usuariosPorFaixaProgresso.find(f => f.faixa === '0-25%')?.quantidade || 0;
  const usuariosAltoProgresso = progress.usuariosPorFaixaProgresso.find(f => f.faixa === '75-100%')?.quantidade || 0;

  const percentBaixoProgresso = totalUsuariosFaixas > 0 
    ? Math.round((usuariosBaixoProgresso / totalUsuariosFaixas) * 100) 
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-80 bg-muted/30" />
          <Card className="h-80 bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Seção: Visão Geral de Progresso */}
      <section>
        <SectionHeader
          titulo="Visão Geral de Progresso"
          subtitulo="Taxa de conclusão de conteúdo pelos usuários"
          icon={<Target className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {progress.taxaConclusaoConteudo}%
                </div>
                <p className="text-sm text-muted-foreground">Taxa de Conclusão Geral</p>
                <div className="mt-4">
                  <Progress value={progress.taxaConclusaoConteudo} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {progress.taxaConclusaoConteudo < 30 
                    ? "Taxa baixa. Considere simplificar conteúdos ou aumentar incentivos."
                    : progress.taxaConclusaoConteudo < 60
                    ? "Taxa moderada. Há espaço para melhorar o engajamento."
                    : "Excelente taxa de conclusão!"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {progress.progressoMedioPorMateria.length}
                </div>
                <p className="text-sm text-muted-foreground">Matérias com Progresso</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {hasProgressData 
                    ? `${materiasProblematicas.length} matérias com progresso abaixo de 30%`
                    : "Aguardando dados de progresso"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {usuariosAltoProgresso}
                </div>
                <p className="text-sm text-muted-foreground">Usuários com 75%+ Completo</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {totalUsuariosFaixas > 0 
                    ? `${Math.round((usuariosAltoProgresso / totalUsuariosFaixas) * 100)}% da base quase concluiu`
                    : "Aguardando dados"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção: Progresso por Matéria e Distribuição */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progresso por Matéria */}
        <div>
          <SectionHeader
            titulo="Progresso por Matéria"
            subtitulo="Taxa de conclusão média de cada matéria"
            icon={<BookOpen className="w-5 h-5 text-primary" />}
          />

          {!hasProgressData ? (
            <EmptyState
              titulo="Dados de progresso ainda não disponíveis"
              motivo="Nenhum usuário registrou progresso de estudo ainda."
              sugestao="Os dados aparecerão conforme usuários marcam conteúdos como concluídos"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={progress.progressoMedioPorMateria.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" />
                    <YAxis 
                      dataKey="materia" 
                      type="category" 
                      width={120} 
                      className="text-xs"
                      tickFormatter={(value) => value.length > 18 ? value.slice(0, 18) + '...' : value}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name, props) => [
                        `${value}% (${props.payload.total_itens} itens)`,
                        'Progresso'
                      ]}
                    />
                    <Bar 
                      dataKey="progresso" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>Como interpretar:</strong> Barras curtas indicam matérias com baixa taxa de conclusão. 
                    Investigue se há problemas de conteúdo ou dificuldade.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Distribuição por Faixa */}
        <div>
          <SectionHeader
            titulo="Usuários por Faixa de Progresso"
            subtitulo="Distribuição de usuários por % de conclusão"
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
          />

          {!hasFaixaData ? (
            <EmptyState
              titulo="Dados de distribuição ainda não disponíveis"
              motivo="Aguardando mais usuários com progresso registrado."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={progress.usuariosPorFaixaProgresso}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="quantidade"
                      nameKey="faixa"
                      label={({ faixa, quantidade }) => quantidade > 0 ? `${faixa}` : ''}
                    >
                      {progress.usuariosPorFaixaProgresso.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value} usuários`, name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
                  {progress.usuariosPorFaixaProgresso.map((faixa, index) => (
                    <div key={faixa.faixa} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span>{faixa.faixa}: {faixa.quantidade}</span>
                    </div>
                  ))}
                </div>

                {percentBaixoProgresso > 40 && (
                  <div className="mt-4">
                    <InsightBox
                      tipo="alerta"
                      titulo="Muitos usuários com baixo progresso"
                      descricao={`${percentBaixoProgresso}% dos usuários estão na faixa 0-25%. Considere notificações de incentivo ou simplificação de conteúdo.`}
                      valor={`${percentBaixoProgresso}%`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção: Insights de Progresso */}
      <section>
        <SectionHeader
          titulo="Insights de Progresso"
          subtitulo="Padrões identificados e recomendações"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Matérias problemáticas */}
          {materiasProblematicas.length > 0 && (
            <InsightBox
              tipo="problema"
              titulo={`${materiasProblematicas.length} matéria(s) com baixo progresso`}
              descricao={`As matérias ${materiasProblematicas.slice(0, 3).map(m => m.materia).join(', ')} têm menos de 30% de conclusão. Investigue se há dificuldade ou falta de conteúdo.`}
              acao="Revise o conteúdo dessas matérias e considere material de apoio"
            />
          )}

          {/* Matérias excelentes */}
          {materiasExcelentes.length > 0 && (
            <InsightBox
              tipo="oportunidade"
              titulo={`${materiasExcelentes.length} matéria(s) com alto engajamento`}
              descricao={`As matérias ${materiasExcelentes.slice(0, 3).map(m => m.materia).join(', ')} têm mais de 70% de conclusão. Use como referência para outras matérias.`}
            />
          )}

          {/* Taxa de conclusão geral */}
          {progress.taxaConclusaoConteudo < 40 && (
            <InsightBox
              tipo="alerta"
              titulo="Taxa de conclusão abaixo de 40%"
              descricao={`Apenas ${progress.taxaConclusaoConteudo}% do conteúdo está sendo concluído. Considere revisar a complexidade ou aumentar incentivos.`}
              acao="Implemente gamificação ou notificações de lembrete"
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {progress.taxaConclusaoConteudo >= 60 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Boa taxa de conclusão"
              descricao={`${progress.taxaConclusaoConteudo}% do conteúdo está sendo concluído. Continue monitorando e mantenha o padrão.`}
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {/* Sem dados suficientes */}
          {!hasProgressData && (
            <InsightBox
              tipo="info"
              titulo="Coletando dados de progresso"
              descricao="O tracking de progresso está ativo. Os dados serão populados conforme os usuários marcam conteúdos como concluídos."
            />
          )}
        </div>
      </section>
    </div>
  );
};
