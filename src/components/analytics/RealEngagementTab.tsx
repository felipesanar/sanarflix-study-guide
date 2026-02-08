import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { EmptyState } from './EmptyState';
import { StudentJourneySection } from './StudentJourneySection';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Activity, Clock, Smartphone, Monitor, BarChart3, Route } from 'lucide-react';
import type { EngagementMetrics } from '@/hooks/useAnalyticsData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RealEngagementTabProps {
  engagement: EngagementMetrics;
  isLoading: boolean;
  filters: {
    dateRange: { start: Date; end: Date };
    iesId?: string;
    excludedIES?: string[];
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

export const RealEngagementTab: React.FC<RealEngagementTabProps> = ({
  engagement,
  isLoading,
  filters,
}) => {
  const [activeSubTab, setActiveSubTab] = useState('metrics');
  
  const hasSessions = engagement.sessoesPorDia.length > 0;
  const hasPageViews = engagement.pageViewsPorPagina.length > 0;
  const hasHorarios = engagement.horariosPico.length > 0;

  const totalDispositivos = engagement.dispositivosMobile + engagement.dispositivosDesktop;
  const percentMobile = totalDispositivos > 0 
    ? Math.round((engagement.dispositivosMobile / totalDispositivos) * 100) 
    : 0;

  // Formatar dados para gráficos
  const sessoesPorDiaFormatted = engagement.sessoesPorDia.map(s => ({
    ...s,
    dataFormatada: format(new Date(s.data), 'dd/MM', { locale: ptBR }),
  }));

  // Encontrar horário de pico
  const horarioPico = engagement.horariosPico.reduce(
    (max, h) => h.acessos > max.acessos ? h : max,
    { hora: 0, acessos: 0 }
  );

  const dispositivosData = [
    { name: 'Mobile', value: engagement.dispositivosMobile },
    { name: 'Desktop', value: engagement.dispositivosDesktop },
  ];

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
    <div className="space-y-6">
      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Métricas Gerais
          </TabsTrigger>
          <TabsTrigger value="journey" className="flex items-center gap-2">
            <Route className="w-4 h-4" />
            Jornada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-8">
          {/* Seção: Sessões ao Longo do Tempo */}
          <section>
            <SectionHeader
              titulo="Sessões ao Longo do Tempo"
              subtitulo="Evolução do número de sessões e tempo médio por dia"
              icon={<Activity className="w-5 h-5 text-primary" />}
            />

            {!hasSessions ? (
              <EmptyState
                titulo="Dados de sessões ainda não disponíveis"
                motivo="O tracking de sessões foi ativado recentemente. As métricas serão populadas conforme os usuários acessam a plataforma."
                sugestao="Aguarde algumas horas para dados significativos"
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sessões e Duração Média (últimos 7 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={sessoesPorDiaFormatted}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dataFormatada" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name) => [
                          name === 'sessoes' ? `${value} sessões` : `${value} min`,
                          name === 'sessoes' ? 'Sessões' : 'Duração Média'
                        ]}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="sessoes" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="duracao_media" 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span>Sessões</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                      <span>Duração Média (min)</span>
                    </div>
                  </div>

                  {/* Interpretação */}
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      <strong>Como interpretar:</strong> Linhas ascendentes indicam crescimento de engajamento. 
                      A duração média alta (acima de 5 min) sugere que usuários estão consumindo conteúdo adequadamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Seção: Páginas Mais Acessadas e Dispositivos */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Páginas mais acessadas */}
            <div>
              <SectionHeader
                titulo="Páginas Mais Acessadas"
                subtitulo="Rotas com maior número de visualizações"
                icon={<BarChart3 className="w-5 h-5 text-primary" />}
              />

              {!hasPageViews ? (
                <EmptyState
                  titulo="Dados de page views ainda não disponíveis"
                  motivo="O tracking de páginas foi ativado recentemente."
                  sugestao="As visualizações serão registradas conforme usuários navegam"
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={engagement.pageViewsPorPagina.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis 
                          dataKey="pagina" 
                          type="category" 
                          width={100} 
                          className="text-xs"
                          tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value) => [`${value} views`, 'Visualizações']}
                        />
                        <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        <strong>Como interpretar:</strong> Páginas no topo são as mais visitadas. 
                        Use isso para priorizar melhorias de UX nas rotas mais importantes.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Dispositivos */}
            <div>
              <SectionHeader
                titulo="Dispositivos de Acesso"
                subtitulo="Distribuição entre mobile e desktop"
                icon={<Smartphone className="w-5 h-5 text-primary" />}
              />

              {totalDispositivos === 0 ? (
                <EmptyState
                  titulo="Dados de dispositivos ainda não disponíveis"
                  motivo="Aguardando sessões para identificar tipos de dispositivos."
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={dispositivosData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dispositivosData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name) => [`${value} sessões`, name]}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <span className="text-sm">Mobile: <strong>{percentMobile}%</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Desktop: <strong>{100 - percentMobile}%</strong></span>
                      </div>
                    </div>

                    {/* Insight automático */}
                    <div className="mt-4">
                      {percentMobile > 70 ? (
                        <InsightBox
                          tipo="insight"
                          titulo="Maioria mobile"
                          descricao={`${percentMobile}% dos acessos são via celular. Priorize otimizações mobile-first e teste funcionalidades em telas pequenas.`}
                        />
                      ) : percentMobile < 30 ? (
                        <InsightBox
                          tipo="insight"
                          titulo="Maioria desktop"
                          descricao={`${100 - percentMobile}% dos acessos são via desktop. Considere melhorar a experiência mobile para aumentar alcance.`}
                        />
                      ) : (
                        <InsightBox
                          tipo="info"
                          titulo="Distribuição equilibrada"
                          descricao="O acesso está bem distribuído entre mobile e desktop. Mantenha ambas as experiências otimizadas."
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {/* Seção: Horários de Pico */}
          <section>
            <SectionHeader
              titulo="Horários de Maior Atividade"
              subtitulo="Quando os usuários mais acessam a plataforma"
              icon={<Clock className="w-5 h-5 text-primary" />}
            />

            {!hasHorarios ? (
              <EmptyState
                titulo="Dados de horários ainda não disponíveis"
                motivo="Aguardando sessões suficientes para identificar padrões de horário."
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={engagement.horariosPico}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="hora" 
                        className="text-xs"
                        tickFormatter={(hora) => `${hora}h`}
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(hora) => `${hora}:00`}
                        formatter={(value) => [`${value} acessos`, 'Sessões']}
                      />
                      <Bar 
                        dataKey="acessos" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  {horarioPico.acessos > 0 && (
                    <div className="mt-4">
                      <InsightBox
                        tipo="insight"
                        titulo={`Pico de atividade às ${horarioPico.hora}h`}
                        descricao={`O horário com mais acessos é ${horarioPico.hora}:00 com ${horarioPico.acessos} sessões. Considere programar conteúdos importantes para este horário.`}
                        acao="Agende notificações e lançamentos para este horário"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        </TabsContent>

        <TabsContent value="journey">
          <StudentJourneySection filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
