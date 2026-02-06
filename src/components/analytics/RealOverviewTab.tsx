import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from './MetricCard';
import { InsightBox } from './InsightBox';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { TrackingHealthSection } from './TrackingHealthSection';
import { 
  Users, 
  Clock, 
  Eye, 
  FileText, 
  Play, 
  CheckSquare,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import type { OverviewMetrics, EngagementMetrics, SimuladoMetrics, TrackingHealth } from '@/hooks/useAnalyticsData';

interface RealOverviewTabProps {
  overview: OverviewMetrics;
  engagement: EngagementMetrics;
  simulados: SimuladoMetrics;
  trackingHealth: TrackingHealth[];
  isLoading: boolean;
}

export const RealOverviewTab: React.FC<RealOverviewTabProps> = ({
  overview,
  engagement,
  simulados,
  trackingHealth,
  isLoading,
}) => {
  // Calcular insights dinâmicos
  const taxaRetencao = overview.totalUsuarios > 0 
    ? Math.round((overview.usuariosAtivos7Dias / overview.totalUsuarios) * 100) 
    : 0;

  const taxaMobile = engagement.dispositivosMobile + engagement.dispositivosDesktop > 0
    ? Math.round((engagement.dispositivosMobile / (engagement.dispositivosMobile + engagement.dispositivosDesktop)) * 100)
    : 0;

  const hasData = overview.totalUsuarios > 0;
  const hasSessions = overview.sessoesHoje > 0 || overview.usuariosAtivos7Dias > 0;
  const hasSimulados = simulados.simuladosDisponiveis.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="h-40 bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Seção: O que está acontecendo agora */}
      <section>
        <SectionHeader
          titulo="O que está acontecendo agora"
          subtitulo="Métricas de atividade em tempo real e do dia atual"
          icon={<Activity className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            titulo="Usuários Ativos Hoje"
            valor={overview.usuariosAtivosHoje}
            subtitulo="Usuários únicos com sessão hoje"
            interpretacao={
              overview.usuariosAtivosHoje === 0
                ? "Nenhum usuário acessou ainda hoje. Pode ser um horário de baixo tráfego ou início do dia."
                : overview.usuariosAtivosHoje < 10
                ? "Poucos usuários ativos. Considere verificar se há algum problema técnico ou se é um padrão esperado."
                : "Atividade normal. O número indica engajamento saudável para o horário."
            }
            status={overview.usuariosAtivosHoje === 0 ? 'neutro' : overview.usuariosAtivosHoje < 5 ? 'alerta' : 'positivo'}
            icon={<Users className="w-5 h-5 text-blue-600" />}
            dataIndisponivel={!hasSessions && overview.usuariosAtivosHoje === 0}
            motivoIndisponivel="Aguardando primeiras sessões do dia"
          />

          <MetricCard
            titulo="Sessões Hoje"
            valor={overview.sessoesHoje}
            subtitulo="Total de sessões iniciadas"
            interpretacao={
              overview.sessoesHoje === 0
                ? "Nenhuma sessão registrada hoje. O tracking de sessões pode ainda estar coletando dados."
                : `Cada usuário ativo teve em média ${overview.usuariosAtivosHoje > 0 ? (overview.sessoesHoje / overview.usuariosAtivosHoje).toFixed(1) : 0} sessões.`
            }
            status={overview.sessoesHoje === 0 ? 'neutro' : 'positivo'}
            icon={<Clock className="w-5 h-5 text-green-600" />}
            dataIndisponivel={!hasSessions && overview.sessoesHoje === 0}
            motivoIndisponivel="Tracking de sessões iniciado recentemente"
          />

          <MetricCard
            titulo="Visualizações de Página"
            valor={overview.pageViewsHoje}
            subtitulo="Page views registrados hoje"
            interpretacao={
              overview.pageViewsHoje === 0
                ? "Nenhuma visualização registrada. O tracking de page views pode estar iniciando a coleta."
                : overview.pageViewsHoje > overview.sessoesHoje * 3
                ? "Alta navegação por sessão. Usuários estão explorando bastante o conteúdo."
                : "Navegação normal. Usuários estão encontrando o que precisam rapidamente."
            }
            status={overview.pageViewsHoje === 0 ? 'neutro' : 'positivo'}
            icon={<Eye className="w-5 h-5 text-purple-600" />}
            dataIndisponivel={overview.pageViewsHoje === 0 && !hasSessions}
            motivoIndisponivel="Tracking de page views iniciado recentemente"
          />

          <MetricCard
            titulo="Tempo Médio de Sessão"
            valor={`${overview.mediaTempoSessao} min`}
            subtitulo="Média dos últimos 7 dias"
            interpretacao={
              overview.mediaTempoSessao === 0
                ? "Sem dados suficientes. Aguarde acúmulo de sessões finalizadas para calcular."
                : overview.mediaTempoSessao < 2
                ? "Sessões muito curtas. Usuários podem estar tendo dificuldade ou saindo rapidamente."
                : overview.mediaTempoSessao > 20
                ? "Sessões longas indicam alto engajamento com o conteúdo."
                : "Duração saudável. Usuários estão consumindo conteúdo adequadamente."
            }
            status={
              overview.mediaTempoSessao === 0 ? 'neutro' :
              overview.mediaTempoSessao < 2 ? 'alerta' :
              overview.mediaTempoSessao > 5 ? 'positivo' : 'neutro'
            }
            icon={<Clock className="w-5 h-5 text-orange-600" />}
          />
        </div>
      </section>

      {/* Seção: Simulados e Avaliações */}
      <section>
        <SectionHeader
          titulo="Simulados e Avaliações"
          subtitulo="Atividade de simulados e taxa de conclusão"
          icon={<FileText className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            titulo="Simulados Iniciados Hoje"
            valor={overview.simuladosIniciadosHoje}
            subtitulo="Alunos que começaram simulado"
            interpretacao={
              overview.simuladosIniciadosHoje === 0
                ? "Nenhum simulado iniciado hoje. Verifique se há simulados ativos disponíveis."
                : "Alunos estão engajando com os simulados. Acompanhe a taxa de conclusão."
            }
            status={overview.simuladosIniciadosHoje === 0 ? 'neutro' : 'positivo'}
            icon={<Play className="w-5 h-5 text-blue-600" />}
            dataIndisponivel={!hasSimulados}
            motivoIndisponivel="Nenhum simulado configurado ainda"
          />

          <MetricCard
            titulo="Simulados Finalizados Hoje"
            valor={overview.simuladosFinalizadosHoje}
            subtitulo="Alunos que concluíram simulado"
            interpretacao={
              overview.simuladosFinalizadosHoje === 0 && overview.simuladosIniciadosHoje > 0
                ? "Simulados iniciados mas não finalizados. Pode indicar dificuldade ou tempo insuficiente."
                : overview.simuladosFinalizadosHoje > 0
                ? "Bom índice de conclusão. Alunos estão completando os simulados."
                : "Aguardando conclusões do dia."
            }
            status={
              overview.simuladosFinalizadosHoje === 0 && overview.simuladosIniciadosHoje > 0 
                ? 'alerta' 
                : overview.simuladosFinalizadosHoje > 0 ? 'positivo' : 'neutro'
            }
            icon={<CheckSquare className="w-5 h-5 text-green-600" />}
          />

          <MetricCard
            titulo="Taxa de Abandono"
            valor={`${overview.taxaAbandonoSimulados}%`}
            subtitulo="Iniciaram mas não finalizaram"
            interpretacao={
              overview.taxaAbandonoSimulados === 0
                ? "Sem dados de abandono ou todos os simulados foram concluídos."
                : overview.taxaAbandonoSimulados > 30
                ? "Taxa alta de abandono. Revise duração, dificuldade ou condições técnicas dos simulados."
                : overview.taxaAbandonoSimulados > 15
                ? "Taxa moderada. Alguns abandonos são esperados, mas vale monitorar."
                : "Taxa saudável. A maioria dos alunos está concluindo os simulados."
            }
            status={
              overview.taxaAbandonoSimulados > 30 ? 'negativo' :
              overview.taxaAbandonoSimulados > 15 ? 'alerta' : 'positivo'
            }
            icon={<TrendingUp className="w-5 h-5 text-orange-600" />}
          />

          <MetricCard
            titulo="Média de Acertos"
            valor={`${simulados.desempenhoGeral.media_acertos}%`}
            subtitulo={`${simulados.desempenhoGeral.total_respostas} respostas totais`}
            interpretacao={
              simulados.desempenhoGeral.total_respostas === 0
                ? "Nenhuma resposta registrada ainda. Aguarde alunos responderem questões."
                : simulados.desempenhoGeral.media_acertos < 40
                ? "Média baixa. Revise a dificuldade das questões ou ofereça material de apoio."
                : simulados.desempenhoGeral.media_acertos > 80
                ? "Média alta. Considere aumentar a dificuldade para melhor diferenciação."
                : "Média equilibrada. O nível de dificuldade parece adequado."
            }
            status={
              simulados.desempenhoGeral.total_respostas === 0 ? 'neutro' :
              simulados.desempenhoGeral.media_acertos < 40 ? 'alerta' :
              simulados.desempenhoGeral.media_acertos > 80 ? 'alerta' : 'positivo'
            }
            icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
          />
        </div>
      </section>

      {/* Seção: Saúde da Plataforma */}
      <section>
        <SectionHeader
          titulo="Saúde da Plataforma"
          subtitulo="Indicadores gerais de uso e retenção"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            titulo="Total de Usuários"
            valor={overview.totalUsuarios}
            subtitulo="Usuários cadastrados na plataforma"
            interpretacao={
              overview.totalUsuarios === 0
                ? "Nenhum usuário cadastrado. A plataforma está aguardando primeiros cadastros."
                : `Base de ${overview.totalUsuarios} usuários. Foque em ativar os inativos.`
            }
            status={overview.totalUsuarios === 0 ? 'neutro' : 'positivo'}
            icon={<Users className="w-5 h-5 text-blue-600" />}
          />

          <MetricCard
            titulo="Usuários Ativos (7 dias)"
            valor={overview.usuariosAtivos7Dias}
            subtitulo="Usuários com sessão nos últimos 7 dias"
            interpretacao={
              taxaRetencao === 0
                ? "Nenhum usuário ativo recentemente. Verifique se o tracking está funcionando."
                : taxaRetencao < 20
                ? `Apenas ${taxaRetencao}% da base está ativa. Considere campanhas de reengajamento.`
                : taxaRetencao < 50
                ? `${taxaRetencao}% de retenção semanal. Há espaço para melhoria.`
                : `${taxaRetencao}% de retenção semanal. Excelente engajamento!`
            }
            status={
              taxaRetencao === 0 ? 'neutro' :
              taxaRetencao < 20 ? 'negativo' :
              taxaRetencao < 50 ? 'alerta' : 'positivo'
            }
            icon={<Activity className="w-5 h-5 text-green-600" />}
          />

          <MetricCard
            titulo="Views SanarClass Hoje"
            valor={overview.sanarclassViewsHoje}
            subtitulo="Acessos ao conteúdo SanarClass"
            interpretacao={
              overview.sanarclassViewsHoje === 0
                ? "Nenhum acesso ao SanarClass hoje. Verifique se há conteúdo disponível."
                : "Usuários estão consumindo conteúdo do SanarClass."
            }
            status={overview.sanarclassViewsHoje === 0 ? 'neutro' : 'positivo'}
            icon={<Eye className="w-5 h-5 text-purple-600" />}
          />
        </div>
      </section>

      {/* Insights Automáticos */}
      <section>
        <SectionHeader
          titulo="Insights Automáticos"
          subtitulo="Padrões identificados e recomendações baseadas nos dados"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Insight: Taxa de Retenção */}
          {taxaRetencao > 0 && taxaRetencao < 30 && (
            <InsightBox
              tipo="problema"
              titulo="Baixa retenção semanal"
              descricao={`Apenas ${taxaRetencao}% dos usuários retornaram nos últimos 7 dias. Isso indica que a maioria não está engajando regularmente.`}
              acao="Considere implementar notificações push ou emails de lembrete"
              valor={`${taxaRetencao}%`}
            />
          )}

          {taxaRetencao >= 30 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Retenção saudável"
              descricao={`${taxaRetencao}% da base ativa em 7 dias. Foque em converter os ativos em usuários recorrentes.`}
              valor={`${taxaRetencao}%`}
            />
          )}

          {/* Insight: Taxa de Abandono */}
          {overview.taxaAbandonoSimulados > 25 && (
            <InsightBox
              tipo="alerta"
              titulo="Alta taxa de abandono em simulados"
              descricao={`${overview.taxaAbandonoSimulados}% dos alunos iniciam mas não finalizam. Pode indicar problemas de duração, dificuldade ou técnicos.`}
              acao="Revise a duração e considere dividir simulados longos"
              valor={`${overview.taxaAbandonoSimulados}%`}
            />
          )}

          {/* Insight: Mobile vs Desktop */}
          {taxaMobile > 70 && (
            <InsightBox
              tipo="insight"
              titulo="Plataforma predominantemente mobile"
              descricao={`${taxaMobile}% dos acessos são via dispositivos móveis. Priorize otimizações mobile-first.`}
              acao="Garanta que todas as features funcionem bem em telas pequenas"
              valor={`${taxaMobile}%`}
            />
          )}

          {/* Insight: Sessões curtas */}
          {overview.mediaTempoSessao > 0 && overview.mediaTempoSessao < 3 && (
            <InsightBox
              tipo="alerta"
              titulo="Sessões muito curtas"
              descricao={`Média de ${overview.mediaTempoSessao} minutos por sessão. Usuários podem estar tendo dificuldade em encontrar o que precisam.`}
              acao="Revise a navegação e facilite o acesso ao conteúdo principal"
            />
          )}

          {/* Insight: Sem dados suficientes */}
          {!hasData && (
            <InsightBox
              tipo="info"
              titulo="Coletando dados iniciais"
              descricao="O sistema de analytics foi ativado recentemente. As métricas serão populadas conforme os usuários interagem com a plataforma. Aguarde algumas horas para dados significativos."
            />
          )}

          {/* Insight: Desempenho de simulados */}
          {simulados.desempenhoGeral.media_acertos > 0 && simulados.desempenhoGeral.media_acertos < 50 && (
            <InsightBox
              tipo="alerta"
              titulo="Média de acertos abaixo de 50%"
              descricao={`Os alunos estão acertando apenas ${simulados.desempenhoGeral.media_acertos}% das questões. Pode indicar dificuldade excessiva ou gaps de conhecimento.`}
              acao="Considere oferecer material de reforço ou revisar questões problemáticas"
              valor={`${simulados.desempenhoGeral.media_acertos}%`}
            />
          )}
        </div>

        {/* Caso não haja insights relevantes */}
        {hasData && taxaRetencao >= 30 && overview.taxaAbandonoSimulados <= 25 && overview.mediaTempoSessao >= 3 && (
          <div className="mt-4">
            <InsightBox
              tipo="oportunidade"
              titulo="Métricas saudáveis"
              descricao="Os indicadores principais estão dentro de parâmetros normais. Continue monitorando para identificar tendências."
            />
          </div>
        )}
      </section>

      {/* Seção: Saúde do Tracking */}
      <section>
        <TrackingHealthSection trackingHealth={trackingHealth} isLoading={isLoading} />
      </section>
    </div>
  );
};
