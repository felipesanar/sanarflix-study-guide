import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { EmptyState } from './EmptyState';
import { MetricCard } from './MetricCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Area,
  AreaChart,
  ReferenceLine,
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
  Hourglass,
  GraduationCap,
  Activity,
  Eye,
  EyeOff,
  Calendar,
  PieChart as PieChartIcon,
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

const getProgressColor = (progresso: number): string => {
  if (progresso < 25) return 'hsl(var(--destructive))';
  if (progresso < 50) return 'hsl(var(--chart-2))';
  if (progresso < 75) return 'hsl(var(--chart-3))';
  return 'hsl(var(--primary))';
};

const TendenciaIcon = ({ tendencia }: { tendencia: 'up' | 'down' | 'stable' }) => {
  if (tendencia === 'up') return <TrendingUp className="w-5 h-5 text-green-500" />;
  if (tendencia === 'down') return <TrendingDown className="w-5 h-5 text-red-500" />;
  return <Minus className="w-5 h-5 text-muted-foreground" />;
};

// Componente para estado de poucos dados
const LowDataState: React.FC<{ 
  usuariosComProgresso: number; 
  totalUsuarios: number;
}> = ({ usuariosComProgresso, totalUsuarios }) => (
  <Card className="border-dashed border-2 border-muted">
    <CardContent className="p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-4 rounded-full bg-muted/50">
          <Hourglass className="w-8 h-8 text-muted-foreground animate-pulse" />
        </div>
      </div>
      <h3 className="font-semibold text-xl mb-2">Coletando Dados de Progresso</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-4">
        O tracking está ativo. Atualmente temos dados de <strong>{usuariosComProgresso}</strong> usuário(s) 
        ({totalUsuarios > 0 ? ((usuariosComProgresso / totalUsuarios) * 100).toFixed(2) : 0}% da base).
      </p>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Os gráficos serão populados conforme mais usuários interagem com o Guia de Estudos.</span>
      </div>
    </CardContent>
  </Card>
);

export const RealProgressTab: React.FC<RealProgressTabProps> = ({
  progress,
  isLoading,
}) => {
  const [showNeverAccessed, setShowNeverAccessed] = useState(false);

  const hasProgressData = progress.progressoMedioPorMateria.length > 0;
  const hasFaixaData = progress.usuariosPorFaixaProgresso.some(f => f.quantidade > 0);
  const hasVelocidadeData = progress.velocidadeEstudo.porDia.length > 0;
  const isLowData = progress.usuariosComProgresso < 5;

  // Identificar matérias problemáticas (< 10% de progresso com conteúdo disponível)
  const materiasProblematicas = progress.progressoMedioPorMateria.filter(
    m => m.progresso < 10 && m.aulasDisponiveis > 0
  );
  const materiasExcelentes = progress.progressoMedioPorMateria.filter(m => m.progresso > 50);

  // Calcular total de usuários por faixa
  const totalUsuariosFaixas = progress.usuariosPorFaixaProgresso.reduce((acc, f) => acc + f.quantidade, 0);
  const usuariosBaixoProgresso = progress.usuariosPorFaixaProgresso.find(f => f.faixa === '0-25%')?.quantidade || 0;

  const percentBaixoProgresso = totalUsuariosFaixas > 0 
    ? Math.round((usuariosBaixoProgresso / totalUsuariosFaixas) * 100) 
    : 0;

  // Interpretar métricas para MetricCards
  const getInterpretacaoTaxaConclusao = () => {
    if (progress.taxaConclusaoConteudo < 5) {
      return "Valor esperado para fase inicial. O tracking foi recentemente ativado.";
    }
    if (progress.taxaConclusaoConteudo < 15) {
      return "Progresso em construção. Benchmark institucional: 15-25%.";
    }
    if (progress.taxaConclusaoConteudo < 30) {
      return "Taxa saudável para plataforma ativa. Continue incentivando o uso.";
    }
    return "Excelente engajamento! A taxa está acima do benchmark.";
  };

  const getInterpretacaoAtivacao = () => {
    if (progress.taxaAtivacao < 1) {
      return "Poucos usuários iniciaram. Considere onboarding guiado.";
    }
    if (progress.taxaAtivacao < 10) {
      return "Taxa de ativação em construção. Investigue barreiras de entrada.";
    }
    if (progress.taxaAtivacao < 30) {
      return "Taxa saudável. Foque em aumentar a profundidade do uso.";
    }
    return "Excelente ativação! A maioria dos usuários está engajada.";
  };

  const getInterpretacaoVelocidade = () => {
    if (progress.velocidadeEstudo.aulasUltimaSemana === 0) {
      return "Nenhuma conclusão na última semana. Considere reengajamento.";
    }
    if (progress.velocidadeEstudo.tendencia === 'up') {
      return "Momentum positivo! O engajamento está crescendo.";
    }
    if (progress.velocidadeEstudo.tendencia === 'down') {
      return "Queda no ritmo. Envie lembretes de estudo.";
    }
    return "Ritmo estável de conclusões.";
  };

  const getInterpretacaoCobertura = () => {
    if (progress.coberturaConteudo.percentual < 5) {
      return "Baixa descoberta de conteúdo. Melhore a navegabilidade.";
    }
    if (progress.coberturaConteudo.percentual < 20) {
      return "Cobertura em expansão. Destaque conteúdos menos acessados.";
    }
    if (progress.coberturaConteudo.percentual < 50) {
      return "Boa cobertura. A biblioteca está sendo explorada.";
    }
    return "Excelente! A maior parte do catálogo foi descoberta.";
  };

  const getStatusMetrica = (value: number, thresholds: { bad: number; ok: number; good: number }): 'positivo' | 'negativo' | 'neutro' | 'alerta' => {
    if (value <= thresholds.bad) return 'negativo';
    if (value <= thresholds.ok) return 'alerta';
    if (value <= thresholds.good) return 'neutro';
    return 'positivo';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner de baixo volume de dados */}
      {isLowData && (
        <LowDataState 
          usuariosComProgresso={progress.usuariosComProgresso} 
          totalUsuarios={progress.totalUsuariosElegiveis} 
        />
      )}

      {/* Seção 1: Hero Metrics com MetricCards */}
      <section>
        <SectionHeader
          titulo="Visão Geral de Progresso"
          subtitulo="Métricas calculadas com base no conteúdo disponível por usuário"
          icon={<Target className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            titulo="Taxa de Conclusão"
            valor={`${progress.taxaConclusaoConteudo}%`}
            subtitulo="vs conteúdo disponível"
            interpretacao={getInterpretacaoTaxaConclusao()}
            status={getStatusMetrica(progress.taxaConclusaoConteudo, { bad: 5, ok: 15, good: 30 })}
            icon={<Target className="w-5 h-5 text-primary" />}
            tendencia={progress.velocidadeEstudo.tendencia !== 'stable' ? {
              valor: progress.velocidadeEstudo.tendencia === 'up' ? 20 : -20,
              periodo: '7d'
            } : undefined}
          />

          <MetricCard
            titulo="Taxa de Ativação"
            valor={`${progress.taxaAtivacao}%`}
            subtitulo={`${progress.usuariosComProgresso} de ${progress.totalUsuariosElegiveis} usuários`}
            interpretacao={getInterpretacaoAtivacao()}
            status={getStatusMetrica(progress.taxaAtivacao, { bad: 1, ok: 10, good: 30 })}
            icon={<Users className="w-5 h-5 text-primary" />}
          />

          <MetricCard
            titulo="Velocidade de Estudo"
            valor={`${progress.velocidadeEstudo.aulasUltimaSemana}`}
            subtitulo="aulas/semana"
            interpretacao={getInterpretacaoVelocidade()}
            status={progress.velocidadeEstudo.tendencia === 'up' ? 'positivo' : 
                   progress.velocidadeEstudo.tendencia === 'down' ? 'alerta' : 'neutro'}
            icon={<Zap className="w-5 h-5 text-primary" />}
            tendencia={progress.velocidadeEstudo.aulasSemanaAnterior > 0 ? {
              valor: Math.round(((progress.velocidadeEstudo.aulasUltimaSemana - progress.velocidadeEstudo.aulasSemanaAnterior) / progress.velocidadeEstudo.aulasSemanaAnterior) * 100),
              periodo: 'vs semana anterior'
            } : undefined}
          />

          <MetricCard
            titulo="Cobertura de Conteúdo"
            valor={`${progress.coberturaConteudo.percentual}%`}
            subtitulo={`${progress.coberturaConteudo.aulasAcessadas} de ${progress.coberturaConteudo.totalAulas} aulas`}
            interpretacao={getInterpretacaoCobertura()}
            status={getStatusMetrica(progress.coberturaConteudo.percentual, { bad: 5, ok: 20, good: 50 })}
            icon={<BookOpen className="w-5 h-5 text-primary" />}
          />
        </div>

        {/* Métricas secundárias */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{progress.profundidadeMedia}</div>
              <p className="text-xs text-muted-foreground">Aulas por usuário ativo</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{progress.diasComAtividade}</div>
              <p className="text-xs text-muted-foreground">Dias com atividade</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{progress.coberturaConteudo.materiasAcessadas}</div>
              <p className="text-xs text-muted-foreground">Matérias acessadas</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{progress.concentracaoTop3}%</div>
              <p className="text-xs text-muted-foreground">Concentração Top 3</p>
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
                  {/* Linha de média móvel */}
                  <ReferenceLine 
                    y={progress.velocidadeEstudo.mediaMovel7Dias} 
                    stroke="hsl(var(--chart-2))" 
                    strokeDasharray="5 5"
                    label={{ value: `Média: ${progress.velocidadeEstudo.mediaMovel7Dias}`, position: 'right', fontSize: 10 }}
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
                  <TendenciaIcon tendencia={progress.velocidadeEstudo.tendencia} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Semana anterior:</span>
                  <span className="font-semibold">{progress.velocidadeEstudo.aulasSemanaAnterior} aulas</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Média diária (7d):</span>
                  <span className="font-semibold">{progress.velocidadeEstudo.mediaMovel7Dias}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Seção 3: Progresso por Matéria + Matérias Populares */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progresso por Matéria com cores graduais */}
        <div>
          <SectionHeader
            titulo="Progresso por Matéria"
            subtitulo="Barras coloridas por faixa de progresso"
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
                      radius={[0, 4, 4, 0]}
                    >
                      {progress.progressoMedioPorMateria.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getProgressColor(entry.progresso)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Legenda de cores */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                    <span>0-24%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                    <span>25-49%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                    <span>50-74%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                    <span>75-100%</span>
                  </div>
                </div>
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

        {/* Cobertura de Conteúdo + Matérias Nunca Acessadas */}
        <div>
          <SectionHeader
            titulo="Cobertura de Conteúdo"
            subtitulo="Aulas e matérias que foram acessadas"
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
                  <span className="text-muted-foreground">Cobertura de Aulas</span>
                  <span className="font-semibold">{progress.coberturaConteudo.percentual}%</span>
                </div>
                <Progress value={progress.coberturaConteudo.percentual} className="h-3" />
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Cobertura de Matérias</span>
                  <span className="font-semibold">
                    {progress.coberturaConteudo.materiasAcessadas}/{progress.coberturaConteudo.totalMaterias}
                  </span>
                </div>
                <Progress 
                  value={progress.coberturaConteudo.totalMaterias > 0 
                    ? (progress.coberturaConteudo.materiasAcessadas / progress.coberturaConteudo.totalMaterias) * 100 
                    : 0} 
                  className="h-3" 
                />
              </div>

              {/* Matérias nunca acessadas */}
              {progress.materiasNuncaAcessadas.length > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <button
                    onClick={() => setShowNeverAccessed(!showNeverAccessed)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      {showNeverAccessed ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-amber-600" />}
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {progress.materiasNuncaAcessadas.length} matéria(s) nunca acessadas
                      </span>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                      {showNeverAccessed ? 'Ocultar' : 'Ver'}
                    </Badge>
                  </button>
                  
                  {showNeverAccessed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {progress.materiasNuncaAcessadas.map((materia) => (
                        <Badge key={materia} variant="secondary" className="text-xs">
                          {materia}
                        </Badge>
                      ))}
                    </div>
                  )}
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
              descricao={`${progress.velocidadeEstudo.aulasUltimaSemana} aulas concluídas na última semana, ${progress.velocidadeEstudo.aulasSemanaAnterior > 0 ? `+${Math.round(((progress.velocidadeEstudo.aulasUltimaSemana - progress.velocidadeEstudo.aulasSemanaAnterior) / progress.velocidadeEstudo.aulasSemanaAnterior) * 100)}%` : ''} vs anterior. Momentum positivo!`}
              valor={`${progress.velocidadeEstudo.aulasUltimaSemana} aulas`}
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

          {/* Baixa taxa de ativação */}
          {progress.taxaAtivacao < 10 && progress.totalUsuariosElegiveis > 0 && (
            <InsightBox
              tipo="alerta"
              titulo="Baixa taxa de ativação"
              descricao={`Apenas ${progress.taxaAtivacao}% dos usuários elegíveis têm progresso registrado. A maioria ainda não começou.`}
              acao="Considere onboarding guiado ou gamificação"
              valor={`${progress.usuariosComProgresso}/${progress.totalUsuariosElegiveis}`}
            />
          )}

          {/* Alta concentração nas top 3 */}
          {progress.concentracaoTop3 > 70 && hasProgressData && (
            <InsightBox
              tipo="alerta"
              titulo="Alta concentração de estudo"
              descricao={`${progress.concentracaoTop3}% das conclusões estão em apenas 3 matérias. Considere diversificar o engajamento.`}
              acao="Destaque outras matérias na interface"
              valor={`${progress.concentracaoTop3}%`}
            />
          )}

          {/* Taxa de conclusão baixa */}
          {progress.taxaConclusaoConteudo < 10 && hasProgressData && (
            <InsightBox
              tipo="alerta"
              titulo="Taxa de conclusão muito baixa"
              descricao={`Apenas ${progress.taxaConclusaoConteudo}% do conteúdo disponível está sendo concluído. O volume pode estar sobrecarregando os usuários.`}
              acao="Considere curadoria ou priorização de conteúdos essenciais"
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {/* Boa taxa de conclusão */}
          {progress.taxaConclusaoConteudo >= 30 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Boa taxa de conclusão"
              descricao={`${progress.taxaConclusaoConteudo}% do conteúdo está sendo concluído. O engajamento está saudável.`}
              valor={`${progress.taxaConclusaoConteudo}%`}
            />
          )}

          {/* Muitos usuários com baixo progresso */}
          {percentBaixoProgresso > 50 && hasFaixaData && (
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
