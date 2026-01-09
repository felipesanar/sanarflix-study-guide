import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { EmptyState } from './EmptyState';
import { Badge } from '@/components/ui/badge';
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
import { Users, Building2, GraduationCap, TrendingUp } from 'lucide-react';
import type { DemographicsMetrics } from '@/hooks/useAnalyticsData';

interface RealDemographicsTabProps {
  demographics: DemographicsMetrics;
  isLoading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const RealDemographicsTab: React.FC<RealDemographicsTabProps> = ({
  demographics,
  isLoading,
}) => {
  const hasIESData = demographics.usuariosPorIES.length > 0;
  const hasSemestreData = demographics.usuariosPorSemestre.length > 0;

  const totalUsuarios = demographics.usuariosPorIES.reduce((acc, ies) => acc + ies.quantidade, 0);

  // Calcular concentração de IES
  const iesLider = demographics.usuariosPorIES[0];
  const percentIesLider = totalUsuarios > 0 && iesLider 
    ? Math.round((iesLider.quantidade / totalUsuarios) * 100) 
    : 0;

  // Semestre mais comum
  const semestreLider = demographics.usuariosPorSemestre.reduce(
    (max, s) => s.quantidade > max.quantidade ? s : max,
    { semestre: 0, quantidade: 0 }
  );

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
      {/* Seção: Resumo Demográfico */}
      <section>
        <SectionHeader
          titulo="Resumo Demográfico"
          subtitulo="Visão geral da distribuição de usuários"
          icon={<Users className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {totalUsuarios}
                </div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Usuários cadastrados na plataforma
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {demographics.usuariosPorIES.length}
                </div>
                <p className="text-sm text-muted-foreground">IES Representadas</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Instituições de ensino com usuários ativos
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {demographics.usuariosPorSemestre.length}
                </div>
                <p className="text-sm text-muted-foreground">Semestres Ativos</p>
                <p className="text-xs text-muted-foreground mt-3">
                  {semestreLider.semestre > 0 && `Maior concentração no ${semestreLider.semestre}º semestre`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção: Distribuição por IES e Semestre */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por IES */}
        <div>
          <SectionHeader
            titulo="Distribuição por IES"
            subtitulo="Usuários por instituição de ensino"
            icon={<Building2 className="w-5 h-5 text-primary" />}
          />

          {!hasIESData ? (
            <EmptyState
              titulo="Dados de IES ainda não disponíveis"
              motivo="Nenhum usuário tem IES associada ainda."
              sugestao="Os dados aparecerão conforme usuários são cadastrados com IES"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demographics.usuariosPorIES.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      dataKey="ies_nome" 
                      type="category" 
                      width={120} 
                      className="text-xs"
                      tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => [`${value} usuários`, 'Quantidade']}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Interpretação */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>Como interpretar:</strong> Concentração em poucas IES pode indicar dependência. 
                    Diversificar a base reduz riscos de negócio.
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
            <EmptyState
              titulo="Dados de semestre ainda não disponíveis"
              motivo="Nenhum usuário tem semestre associado ainda."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={demographics.usuariosPorSemestre}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="quantidade"
                      label={({ semestre }) => `${semestre}º`}
                    >
                      {demographics.usuariosPorSemestre.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} usuários`,
                        `${props.payload.semestre}º Semestre`
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs">
                  {demographics.usuariosPorSemestre.map((s, index) => (
                    <Badge key={s.semestre} variant="outline" className="gap-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {s.semestre}º sem: {s.quantidade}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção: Insights Demográficos */}
      <section>
        <SectionHeader
          titulo="Insights Demográficos"
          subtitulo="Padrões identificados na base de usuários"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Concentração de IES */}
          {percentIesLider > 50 && iesLider && (
            <InsightBox
              tipo="alerta"
              titulo="Alta concentração em uma IES"
              descricao={`${percentIesLider}% dos usuários são da ${iesLider.ies_nome}. Alta dependência de uma única instituição representa risco.`}
              acao="Considere estratégias de expansão para outras IES"
              valor={`${percentIesLider}%`}
            />
          )}

          {percentIesLider <= 50 && iesLider && (
            <InsightBox
              tipo="oportunidade"
              titulo="Base diversificada"
              descricao={`A maior IES (${iesLider.ies_nome}) representa apenas ${percentIesLider}% da base. Boa diversificação reduz riscos.`}
            />
          )}

          {/* Semestres iniciais */}
          {semestreLider.semestre <= 2 && semestreLider.quantidade > 0 && (
            <InsightBox
              tipo="insight"
              titulo="Maioria em semestres iniciais"
              descricao={`A maior concentração está no ${semestreLider.semestre}º semestre. Foque em conteúdo para iniciantes e retenção a longo prazo.`}
            />
          )}

          {semestreLider.semestre > 4 && semestreLider.quantidade > 0 && (
            <InsightBox
              tipo="insight"
              titulo="Maioria em semestres avançados"
              descricao={`A maior concentração está no ${semestreLider.semestre}º semestre. Esses usuários podem ter maior maturidade e expectativas específicas.`}
              acao="Considere conteúdo avançado e preparatório para residência"
            />
          )}

          {/* Sem dados suficientes */}
          {!hasIESData && !hasSemestreData && (
            <InsightBox
              tipo="info"
              titulo="Coletando dados demográficos"
              descricao="Os dados demográficos serão populados conforme usuários são cadastrados com informações de IES e semestre."
            />
          )}

          {/* Múltiplas IES */}
          {demographics.usuariosPorIES.length > 5 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Presença em múltiplas IES"
              descricao={`A plataforma está presente em ${demographics.usuariosPorIES.length} instituições diferentes. Boa penetração de mercado.`}
            />
          )}
        </div>
      </section>
    </div>
  );
};
