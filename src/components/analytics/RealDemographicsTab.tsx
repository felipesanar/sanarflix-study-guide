import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { MetricCard } from './MetricCard';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { 
  Users, 
  Building2, 
  GraduationCap, 
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
  MousePointerClick,
  Sparkles,
} from 'lucide-react';
import type { DemographicsMetrics } from '@/hooks/useAnalyticsData';

interface RealDemographicsTabProps {
  demographics: DemographicsMetrics;
  isLoading: boolean;
}

// Cores para gráficos baseadas no design system
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// Helper para determinar cor baseada em faixa de progresso
const getBarColor = (percentual: number, index: number): string => {
  if (percentual >= 20) return 'hsl(var(--primary))';
  if (percentual >= 10) return 'hsl(var(--chart-2))';
  if (percentual >= 5) return 'hsl(var(--chart-3))';
  return COLORS[index % COLORS.length];
};

// Helper para interpretar HHI
const interpretarHHI = (hhi: number): { status: 'positivo' | 'neutro' | 'alerta'; texto: string } => {
  if (hhi < 1500) return { status: 'positivo', texto: 'Mercado competitivo. Boa diversificação de IES.' };
  if (hhi < 2500) return { status: 'neutro', texto: 'Mercado moderadamente concentrado. Considere expandir.' };
  return { status: 'alerta', texto: 'Mercado altamente concentrado. Alta dependência de poucas IES.' };
};

export const RealDemographicsTab: React.FC<RealDemographicsTabProps> = ({
  demographics,
  isLoading,
}) => {
  const [showAllIES, setShowAllIES] = useState(false);
  const [showAllSemestres, setShowAllSemestres] = useState(false);

  const hasIESData = demographics.usuariosPorIES.length > 0;
  const hasSemestreData = demographics.usuariosPorSemestre.length > 0;

  const { 
    totalUsuarios, 
    usuariosComIES, 
    usuariosSemIES,
    usuariosComSemestre,
    usuariosSemSemestre,
    taxaCompletude, 
    indiceHHI, 
    concentracaoTop3,
    semestresPorGrupo 
  } = demographics;

  const iesLider = demographics.usuariosPorIES[0];
  const hhi = interpretarHHI(indiceHHI);

  // Preparar dados para gráficos
  const iesChartData = showAllIES 
    ? demographics.usuariosPorIES 
    : demographics.usuariosPorIES.slice(0, 8);
  
  const semestreChartData = showAllSemestres
    ? demographics.usuariosPorSemestre
    : demographics.usuariosPorSemestre.slice(0, 10);

  // Dados de grupos de semestre para gráfico resumido
  const gruposSemestreData = [
    { grupo: 'Iniciais (1-4)', quantidade: semestresPorGrupo.iniciais, cor: COLORS[0] },
    { grupo: 'Intermediários (5-8)', quantidade: semestresPorGrupo.intermediarios, cor: COLORS[1] },
    { grupo: 'Avançados (9+)', quantidade: semestresPorGrupo.avancados, cor: COLORS[2] },
    { grupo: 'Não informado', quantidade: semestresPorGrupo.naoInformado, cor: 'hsl(var(--muted-foreground))' },
  ].filter(g => g.quantidade > 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-36 bg-muted/30" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-80 bg-muted/30" />
          <Card className="h-80 bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Seção 1: Hero Metrics com MetricCards */}
      <section>
        <SectionHeader
          titulo="Resumo Demográfico"
          subtitulo="Visão geral da base de usuários"
          icon={<Users className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            titulo="Total de Usuários"
            valor={totalUsuarios.toLocaleString('pt-BR')}
            subtitulo="excluindo administradores"
            interpretacao={
              usuariosSemIES > 0 
                ? `${usuariosSemIES} usuário(s) sem IES associada.`
                : 'Todos os usuários têm IES associada.'
            }
            status={usuariosSemIES > totalUsuarios * 0.05 ? 'alerta' : 'positivo'}
            icon={<Users className="w-4 h-4 text-primary" />}
          />

          <MetricCard
            titulo="IES Parceiras"
            valor={demographics.usuariosPorIES.length.toString()}
            subtitulo="instituições ativas"
            interpretacao={
              concentracaoTop3 > 60 
                ? `Top 3 IES concentram ${concentracaoTop3}% da base. Risco de dependência.`
                : `Top 3 IES representam ${concentracaoTop3}% da base. Boa diversificação.`
            }
            status={concentracaoTop3 > 70 ? 'alerta' : concentracaoTop3 > 50 ? 'neutro' : 'positivo'}
            icon={<Building2 className="w-4 h-4 text-primary" />}
          />

          <MetricCard
            titulo="Cadastros Completos"
            valor={`${taxaCompletude}%`}
            subtitulo="com IES e semestre"
            interpretacao={
              taxaCompletude >= 90 
                ? 'Excelente taxa de completude de cadastros.'
                : `${usuariosSemSemestre} usuários sem semestre informado.`
            }
            status={taxaCompletude >= 90 ? 'positivo' : taxaCompletude >= 70 ? 'neutro' : 'alerta'}
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
          />

          <MetricCard
            titulo="Índice HHI"
            valor={indiceHHI.toLocaleString('pt-BR')}
            subtitulo="concentração de mercado"
            interpretacao={hhi.texto}
            status={hhi.status}
            icon={<TrendingUp className="w-4 h-4 text-primary" />}
          />
        </div>
      </section>

      {/* Seção 2: Saúde do Cadastro */}
      <section>
        <SectionHeader
          titulo="Saúde do Cadastro"
          subtitulo="Qualidade dos dados demográficos"
          icon={<ShieldCheck className="w-5 h-5 text-primary" />}
        />

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usuários com IES</span>
                  <span className="font-medium">
                    {usuariosComIES.toLocaleString('pt-BR')} de {totalUsuarios.toLocaleString('pt-BR')} 
                    <span className="text-muted-foreground ml-1">
                      ({totalUsuarios > 0 ? Math.round((usuariosComIES / totalUsuarios) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <Progress 
                  value={totalUsuarios > 0 ? (usuariosComIES / totalUsuarios) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usuários com Semestre</span>
                  <span className="font-medium">
                    {usuariosComSemestre.toLocaleString('pt-BR')} de {totalUsuarios.toLocaleString('pt-BR')}
                    <span className="text-muted-foreground ml-1">
                      ({totalUsuarios > 0 ? Math.round((usuariosComSemestre / totalUsuarios) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <Progress 
                  value={totalUsuarios > 0 ? (usuariosComSemestre / totalUsuarios) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cadastros Completos (IES + Semestre)</span>
                  <span className="font-medium">
                    {demographics.cadastrosCompletos.toLocaleString('pt-BR')} de {totalUsuarios.toLocaleString('pt-BR')}
                    <span className="text-muted-foreground ml-1">({taxaCompletude}%)</span>
                  </span>
                </div>
                <Progress 
                  value={taxaCompletude} 
                  className="h-2"
                />
              </div>

              {(usuariosSemIES > 0 || usuariosSemSemestre > 0) && (
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t text-xs text-muted-foreground">
                  {usuariosSemIES > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {usuariosSemIES} sem IES
                    </Badge>
                  )}
                  {usuariosSemSemestre > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {usuariosSemSemestre} sem semestre
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção 3: Distribuição por IES e Semestre */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por IES */}
        <div>
          <SectionHeader
            titulo="Distribuição por IES"
            subtitulo="Usuários por instituição de ensino"
            icon={<Building2 className="w-5 h-5 text-primary" />}
          />

          {!hasIESData ? (
            <Card className="p-6">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum dado de IES disponível</p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={Math.max(300, iesChartData.length * 40)}>
                  <BarChart data={iesChartData} layout="vertical" margin={{ right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      dataKey="ies_nome" 
                      type="category" 
                      width={100} 
                      className="text-xs"
                      tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name, props) => [
                        `${value} usuários (${props.payload.percentual}%)`, 
                        'Quantidade'
                      ]}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      radius={[0, 4, 4, 0]}
                    >
                      {iesChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getBarColor(entry.percentual, index)}
                        />
                      ))}
                      <LabelList 
                        dataKey="percentual" 
                        position="right" 
                        formatter={(value: number) => `${value}%`}
                        className="text-xs fill-foreground"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {demographics.usuariosPorIES.length > 8 && (
                  <div className="mt-4 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowAllIES(!showAllIES)}
                      className="gap-1"
                    >
                      {showAllIES ? (
                        <>Mostrar menos <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Ver todas as {demographics.usuariosPorIES.length} IES <ChevronDown className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                )}

                {/* Legenda de concentração */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>Concentração:</strong> Top 3 IES representam <strong>{concentracaoTop3}%</strong> da base.
                    {concentracaoTop3 > 60 && ' Considere estratégias de diversificação.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Por Semestre */}
        <div>
          <SectionHeader
            titulo="Distribuição por Semestre"
            subtitulo="Usuários por período do curso"
            icon={<GraduationCap className="w-5 h-5 text-primary" />}
          />

          {!hasSemestreData ? (
            <Card className="p-6">
              <div className="text-center text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum dado de semestre disponível</p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                {/* Resumo por grupos */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {gruposSemestreData.map((grupo, idx) => (
                    <div 
                      key={grupo.grupo}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: grupo.cor }}
                        />
                        <span className="text-xs text-muted-foreground">{grupo.grupo}</span>
                      </div>
                      <div className="text-lg font-bold">
                        {grupo.quantidade.toLocaleString('pt-BR')}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({totalUsuarios > 0 ? Math.round((grupo.quantidade / totalUsuarios) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gráfico de barras horizontal por semestre */}
                <ResponsiveContainer width="100%" height={Math.max(250, semestreChartData.length * 30)}>
                  <BarChart data={semestreChartData} layout="vertical" margin={{ right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      dataKey="semestre" 
                      type="category" 
                      width={80} 
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name, props) => [
                        `${value} usuários (${props.payload.percentual}%)`,
                        props.payload.semestre
                      ]}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    >
                      {semestreChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.semestre === 'Não informado' 
                            ? 'hsl(var(--muted-foreground))' 
                            : COLORS[index % COLORS.length]
                          }
                        />
                      ))}
                      <LabelList 
                        dataKey="percentual" 
                        position="right" 
                        formatter={(value: number) => `${value}%`}
                        className="text-xs fill-foreground"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {demographics.usuariosPorSemestre.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowAllSemestres(!showAllSemestres)}
                      className="gap-1"
                    >
                      {showAllSemestres ? (
                        <>Mostrar menos <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Ver todos <ChevronDown className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção 4: Insights Inteligentes */}
      <section>
        <SectionHeader
          titulo="Insights Demográficos"
          subtitulo="Padrões identificados na base de usuários"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Insight: Concentração de IES */}
          {iesLider && iesLider.percentual > 25 && (
            <InsightBox
              tipo="alerta"
              titulo="Alta concentração em uma IES"
              descricao={`${iesLider.ies_nome} representa ${iesLider.percentual}% da base. Dependência significativa de uma única instituição.`}
              acao="Considere estratégias de expansão para outras IES"
              valor={`${iesLider.percentual}%`}
            />
          )}

          {iesLider && iesLider.percentual <= 25 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Base bem diversificada"
              descricao={`A maior IES (${iesLider.ies_nome}) representa apenas ${iesLider.percentual}% da base. Boa diversificação reduz riscos.`}
            />
          )}

          {/* Insight: Top 3 concentração */}
          {concentracaoTop3 > 60 && (
            <InsightBox
              tipo="alerta"
              titulo="Top 3 IES muito concentradas"
              descricao={`As 3 maiores IES concentram ${concentracaoTop3}% dos usuários. Isso representa risco caso uma parceria seja encerrada.`}
              acao="Diversifique a base com novas parcerias"
              valor={`${concentracaoTop3}%`}
            />
          )}

          {/* Insight: Semestres avançados */}
          {semestresPorGrupo.avancados > totalUsuarios * 0.30 && (
            <InsightBox
              tipo="insight"
              titulo="Maioria em semestres avançados"
              descricao={`${Math.round((semestresPorGrupo.avancados / totalUsuarios) * 100)}% dos usuários estão em semestres 9+. Base madura, focada em residência.`}
              acao="Considere conteúdo avançado e preparatório para residência"
            />
          )}

          {/* Insight: Semestres iniciais */}
          {semestresPorGrupo.iniciais > totalUsuarios * 0.30 && (
            <InsightBox
              tipo="insight"
              titulo="Forte presença em semestres iniciais"
              descricao={`${Math.round((semestresPorGrupo.iniciais / totalUsuarios) * 100)}% dos usuários estão em semestres 1-4. Foco em conteúdo básico e retenção.`}
              acao="Invista em onboarding e conteúdo fundamental"
            />
          )}

          {/* Insight: Cadastros incompletos */}
          {taxaCompletude < 90 && (
            <InsightBox
              tipo="info"
              titulo="Cadastros incompletos"
              descricao={`${100 - taxaCompletude}% dos usuários não têm cadastro completo. Isso pode afetar segmentação e análises.`}
              acao="Considere campanha de atualização de perfil"
              valor={`${Math.round(100 - taxaCompletude)}%`}
            />
          )}

          {/* Insight: Múltiplas IES */}
          {demographics.usuariosPorIES.length >= 10 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Presença em múltiplas IES"
              descricao={`A plataforma está presente em ${demographics.usuariosPorIES.length} instituições diferentes. Excelente penetração de mercado.`}
            />
          )}

          {/* Insight: HHI */}
          {indiceHHI > 2500 && (
            <InsightBox
              tipo="alerta"
              titulo="Mercado altamente concentrado"
              descricao={`O índice HHI de ${indiceHHI.toLocaleString('pt-BR')} indica alta concentração. Valores acima de 2500 representam risco.`}
              acao="Priorize diversificação de parcerias institucionais"
              valor={indiceHHI.toLocaleString('pt-BR')}
            />
          )}

          {/* Fallback se poucos insights */}
          {!hasIESData && !hasSemestreData && (
            <InsightBox
              tipo="info"
              titulo="Coletando dados demográficos"
              descricao="Os dados demográficos serão populados conforme usuários são cadastrados."
            />
          )}
        </div>
      </section>
    </div>
  );
};
