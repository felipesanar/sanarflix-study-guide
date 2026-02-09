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
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { 
  BookOpen, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Minus,
  CheckCircle, 
  Users, 
  Zap,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
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

const TendenciaIcon = ({ tendencia }: { tendencia: 'up' | 'down' | 'stable' }) => {
  if (tendencia === 'up') return <TrendingUp className="w-5 h-5 text-green-500" />;
  if (tendencia === 'down') return <TrendingDown className="w-5 h-5 text-red-500" />;
  return <Minus className="w-5 h-5 text-muted-foreground" />;
};

export const RealProgressTab: React.FC<RealProgressTabProps> = ({
  progress,
  isLoading,
}) => {
  const hasProgressData = progress.progressoMedioPorMateria.length > 0;
  const hasFaixaData = progress.usuariosPorFaixaProgresso.some(f => f.quantidade > 0);
  const hasVelocidadeData = progress.velocidadeEstudo.porDia.length > 0;

  // Identificar matérias problemáticas (< 10% de progresso com conteúdo disponível)
  const materiasProblematicas = progress.progressoMedioPorMateria.filter(
    m => m.progresso < 10 && m.aulasDisponiveis > 0
  );
  const materiasExcelentes = progress.progressoMedioPorMateria.filter(m => m.progresso > 50);

  // Calcular total de usuários por faixa
  const totalUsuariosFaixas = progress.usuariosPorFaixaProgresso.reduce((acc, f) => acc + f.quantidade, 0);
  const usuariosBaixoProgresso = progress.usuariosPorFaixaProgresso.find(f => f.faixa === '0-25%')?.quantidade || 0;
  const usuariosAltoProgresso = progress.usuariosPorFaixaProgresso.find(f => f.faixa === '75-100%')?.quantidade || 0;

  const percentBaixoProgresso = totalUsuariosFaixas > 0 
    ? Math.round((usuariosBaixoProgresso / totalUsuariosFaixas) * 100) 
    : 0;

  // Calcular velocidade média (aulas por semana)
  const velocidadeMedia = progress.velocidadeEstudo.aulasUltimaSemana;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 bg-muted/30" />
          ))}
        </div>
        <Card className="h-64 bg-muted/30" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-80 bg-muted/30" />
          <Card className="h-80 bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Seção 1: Visão Geral (KPIs Principais) */}
      <section>
        <SectionHeader
          titulo="Visão Geral de Progresso"
          subtitulo="Taxa de conclusão real baseada no conteúdo disponível"
          icon={<Target className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Taxa de Conclusão Real */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {progress.taxaConclusaoConteudo}%
                </div>
                <p className="text-sm text-muted-foreground">Taxa de Conclusão Real</p>
                <div className="mt-3">
                  <Progress value={progress.taxaConclusaoConteudo} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  vs conteúdo disponível
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Usuários com Progresso */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {progress.usuariosComProgresso}
                </div>
                <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    de {progress.totalUsuariosElegiveis} elegíveis
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.totalUsuariosElegiveis > 0 
                    ? `${Math.round((progress.usuariosComProgresso / progress.totalUsuariosElegiveis) * 100)}% engajados`
                    : 'Aguardando dados'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Velocidade de Estudo */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold text-primary">
                    {velocidadeMedia}
                  </span>
                  <TendenciaIcon tendencia={progress.velocidadeEstudo.tendencia} />
                </div>
                <p className="text-sm text-muted-foreground">Aulas/Semana</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.velocidadeEstudo.tendencia === 'up' && '+20% vs anterior'}
                  {progress.velocidadeEstudo.tendencia === 'down' && '-20% vs anterior'}
                  {progress.velocidadeEstudo.tendencia === 'stable' && 'Estável'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cobertura de Conteúdo */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {progress.coberturaConteudo.percentual}%
                </div>
                <p className="text-sm text-muted-foreground">Cobertura</p>
                <div className="mt-3">
                  <Progress value={progress.coberturaConteudo.percentual} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {progress.coberturaConteudo.aulasAcessadas} de {progress.coberturaConteudo.totalAulas} aulas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 2: Tendência Temporal */}
      <section>
        <SectionHeader
          titulo="Velocidade de Estudo"
          subtitulo="Conclusões de aulas ao longo do período selecionado"
          icon={<Clock className="w-5 h-5 text-primary" />}
        />

        {!hasVelocidadeData ? (
          <EmptyState
            titulo="Dados temporais ainda não disponíveis"
            motivo="Nenhuma conclusão de aula registrada no período selecionado."
            sugestao="Selecione um período maior ou aguarde mais atividade"
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={progress.velocidadeEstudo.porDia}>
                  <defs>
                    <linearGradient id="colorConclusoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="data" 
                    className="text-xs"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [`${value} conclusões`, 'Aulas']}
                    labelFormatter={(label) => {
                      const date = new Date(label);
                      return date.toLocaleDateString('pt-BR');
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conclusoes" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1}
                    fill="url(#colorConclusoes)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Última semana:</span>
                  <span className="font-semibold">{progress.velocidadeEstudo.aulasUltimaSemana} aulas</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Semana anterior:</span>
                  <span className="font-semibold">{progress.velocidadeEstudo.aulasSemanaAnterior} aulas</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Seção 3: Progresso por Matéria + Matérias Populares */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progresso por Matéria */}
        <div>
          <SectionHeader
            titulo="Progresso por Matéria"
            subtitulo="vs conteúdo disponível"
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
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={progress.progressoMedioPorMateria.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" unit="%" />
                    <YAxis 
                      dataKey="materia" 
                      type="category" 
                      width={130} 
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
                        `${value}% (${props.payload.aulasConcluidas}/${props.payload.aulasDisponiveis} aulas)`,
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Matérias Mais Populares */}
        <div>
          <SectionHeader
            titulo="Matérias Mais Populares"
            subtitulo="Por volume de usuários únicos"
            icon={<Sparkles className="w-5 h-5 text-primary" />}
          />

          {progress.materiasPopulares.length === 0 ? (
            <EmptyState
              titulo="Nenhuma matéria acessada ainda"
              motivo="Aguardando usuários interagirem com o conteúdo."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {progress.materiasPopulares.slice(0, 8).map((m, index) => (
                    <div 
                      key={m.materia} 
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${index === 0 ? 'bg-yellow-500/20 text-yellow-600' : 
                          index === 1 ? 'bg-gray-300/30 text-gray-600' :
                          index === 2 ? 'bg-orange-400/20 text-orange-600' :
                          'bg-muted text-muted-foreground'}
                      `}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.materia}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.totalConclusoes} conclusões
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{m.usuariosUnicos}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção 4: Distribuição e Cobertura */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Faixa */}
        <div>
          <SectionHeader
            titulo="Usuários por Faixa de Progresso"
            subtitulo="Baseado em progresso real vs conteúdo disponível"
            icon={<BarChart3 className="w-5 h-5 text-primary" />}
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cobertura de Conteúdo */}
        <div>
          <SectionHeader
            titulo="Cobertura de Conteúdo"
            subtitulo="Aulas que foram acessadas por pelo menos um usuário"
            icon={<Target className="w-5 h-5 text-primary" />}
          />

          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-primary mb-2">
                  {progress.coberturaConteudo.aulasAcessadas}
                </div>
                <p className="text-muted-foreground">
                  de {progress.coberturaConteudo.totalAulas} aulas acessadas
                </p>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Cobertura</span>
                  <span className="font-semibold">{progress.coberturaConteudo.percentual}%</span>
                </div>
                <Progress value={progress.coberturaConteudo.percentual} className="h-3" />
              </div>

              {progress.coberturaConteudo.percentual < 30 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Baixa cobertura de conteúdo
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {100 - progress.coberturaConteudo.percentual}% do conteúdo nunca foi acessado. 
                        Considere revisar a visibilidade ou relevância dessas aulas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {progress.coberturaConteudo.percentual >= 70 && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Excelente cobertura!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        A maior parte do conteúdo está sendo descoberta pelos usuários.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 5: Insights Inteligentes */}
      <section>
        <SectionHeader
          titulo="Insights de Progresso"
          subtitulo="Padrões identificados e recomendações"
          icon={<Sparkles className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Matérias problemáticas */}
          {materiasProblematicas.length > 0 && (
            <InsightBox
              tipo="problema"
              titulo={`${materiasProblematicas.length} matéria(s) com baixíssimo progresso`}
              descricao={`${materiasProblematicas.slice(0, 3).map(m => m.materia).join(', ')} têm menos de 10% de conclusão. Investigue se há problemas de visibilidade ou conteúdo.`}
              acao="Revise o posicionamento dessas matérias no guia de estudos"
            />
          )}

          {/* Matérias excelentes */}
          {materiasExcelentes.length > 0 && (
            <InsightBox
              tipo="oportunidade"
              titulo={`${materiasExcelentes.length} matéria(s) com alto engajamento`}
              descricao={`${materiasExcelentes.slice(0, 3).map(m => m.materia).join(', ')} têm mais de 50% de conclusão. Use como referência para outras matérias.`}
            />
          )}

          {/* Velocidade em alta */}
          {progress.velocidadeEstudo.tendencia === 'up' && (
            <InsightBox
              tipo="oportunidade"
              titulo="Velocidade de estudo em alta"
              descricao={`${progress.velocidadeEstudo.aulasUltimaSemana} aulas concluídas na última semana, +20% vs semana anterior. Momentum positivo!`}
              valor={`+${Math.round(((progress.velocidadeEstudo.aulasUltimaSemana - progress.velocidadeEstudo.aulasSemanaAnterior) / Math.max(progress.velocidadeEstudo.aulasSemanaAnterior, 1)) * 100)}%`}
            />
          )}

          {/* Velocidade em queda */}
          {progress.velocidadeEstudo.tendencia === 'down' && (
            <InsightBox
              tipo="alerta"
              titulo="Velocidade de estudo em queda"
              descricao={`Apenas ${progress.velocidadeEstudo.aulasUltimaSemana} aulas esta semana vs ${progress.velocidadeEstudo.aulasSemanaAnterior} na anterior. Considere ações de reengajamento.`}
              acao="Envie lembretes ou notificações de incentivo"
            />
          )}

          {/* Baixa taxa de engajamento */}
          {progress.totalUsuariosElegiveis > 0 && 
           (progress.usuariosComProgresso / progress.totalUsuariosElegiveis) < 0.3 && (
            <InsightBox
              tipo="alerta"
              titulo="Baixa taxa de engajamento"
              descricao={`Apenas ${Math.round((progress.usuariosComProgresso / progress.totalUsuariosElegiveis) * 100)}% dos usuários elegíveis têm progresso registrado.`}
              acao="Considere onboarding guiado ou gamificação"
              valor={`${progress.usuariosComProgresso}/${progress.totalUsuariosElegiveis}`}
            />
          )}

          {/* Taxa de conclusão baixa */}
          {progress.taxaConclusaoConteudo < 20 && hasProgressData && (
            <InsightBox
              tipo="alerta"
              titulo="Taxa de conclusão muito baixa"
              descricao={`Apenas ${progress.taxaConclusaoConteudo}% do conteúdo disponível está sendo concluído. O volume de conteúdo pode estar sobrecarregando os usuários.`}
              acao="Considere curadoria ou priorização de conteúdos essenciais"
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {/* Boa taxa de conclusão */}
          {progress.taxaConclusaoConteudo >= 40 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Boa taxa de conclusão"
              descricao={`${progress.taxaConclusaoConteudo}% do conteúdo está sendo concluído. O engajamento está saudável.`}
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {/* Muitos usuários com baixo progresso */}
          {percentBaixoProgresso > 50 && (
            <InsightBox
              tipo="problema"
              titulo="Maioria com progresso inicial"
              descricao={`${percentBaixoProgresso}% dos usuários estão na faixa 0-25%. Muitos começam mas não avançam.`}
              acao="Investigue barreiras de progressão e simplifique o caminho inicial"
              valor={`${percentBaixoProgresso}%`}
            />
          )}

          {/* Sem dados suficientes */}
          {!hasProgressData && (
            <InsightBox
              tipo="info"
              titulo="Coletando dados de progresso"
              descricao="O tracking de progresso está ativo. Os dados serão populados conforme os usuários marcam conteúdos como concluídos no Guia de Estudos."
            />
          )}
        </div>
      </section>
    </div>
  );
};
