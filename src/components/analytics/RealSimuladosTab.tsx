import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from './SectionHeader';
import { InsightBox } from './InsightBox';
import { EmptyState } from './EmptyState';
import { Progress } from '@/components/ui/progress';
import { FileText, AlertTriangle, TrendingUp, CheckCircle, Target } from 'lucide-react';
import type { SimuladoMetrics } from '@/hooks/useAnalyticsData';

interface RealSimuladosTabProps {
  simulados: SimuladoMetrics;
  isLoading: boolean;
}

export const RealSimuladosTab: React.FC<RealSimuladosTabProps> = ({
  simulados,
  isLoading,
}) => {
  const hasSimulados = simulados.simuladosDisponiveis.length > 0;
  const hasQuestoesProblematicas = simulados.questoesProblematicas.length > 0;

  // Calcular métricas
  const totalIniciados = simulados.simuladosDisponiveis.reduce((acc, s) => acc + s.iniciados, 0);
  const totalFinalizados = simulados.simuladosDisponiveis.reduce((acc, s) => acc + s.finalizados, 0);
  const taxaConclusaoGeral = totalIniciados > 0 
    ? Math.round((totalFinalizados / totalIniciados) * 100) 
    : 0;

  // Simulados com baixa taxa de conclusão
  const simuladosProblematicos = simulados.simuladosDisponiveis.filter(
    s => s.iniciados > 0 && s.taxa_conclusao < 50
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
      {/* Seção: Visão Geral de Simulados */}
      <section>
        <SectionHeader
          titulo="Visão Geral de Simulados"
          subtitulo="Performance e taxas de conclusão dos simulados"
          icon={<FileText className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {simulados.simuladosDisponiveis.length}
                </div>
                <p className="text-sm text-muted-foreground">Simulados Configurados</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {totalIniciados}
                </div>
                <p className="text-sm text-muted-foreground">Total de Inícios</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {totalFinalizados}
                </div>
                <p className="text-sm text-muted-foreground">Total de Conclusões</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className={`text-4xl font-bold mb-2 ${
                  taxaConclusaoGeral < 50 ? 'text-destructive' : 
                  taxaConclusaoGeral < 75 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {taxaConclusaoGeral}%
                </div>
                <p className="text-sm text-muted-foreground">Taxa de Conclusão</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção: Desempenho e Questões Problemáticas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desempenho por Simulado */}
        <div>
          <SectionHeader
            titulo="Performance por Simulado"
            subtitulo="Taxa de conclusão de cada simulado"
            icon={<Target className="w-5 h-5 text-primary" />}
          />

          {!hasSimulados ? (
            <EmptyState
              titulo="Nenhum simulado configurado"
              motivo="Adicione simulados no painel administrativo para ver as métricas."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Simulado</TableHead>
                      <TableHead className="text-right">Iniciados</TableHead>
                      <TableHead className="text-right">Conclusão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulados.simuladosDisponiveis.slice(0, 10).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.nome.length > 25 ? s.nome.slice(0, 25) + '...' : s.nome}
                        </TableCell>
                        <TableCell className="text-right">{s.iniciados}</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={
                              s.iniciados === 0 ? 'outline' :
                              s.taxa_conclusao < 50 ? 'destructive' : 
                              s.taxa_conclusao < 75 ? 'secondary' : 'default'
                            }
                          >
                            {s.iniciados === 0 ? '-' : `${s.taxa_conclusao}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {simulados.simuladosDisponiveis.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum simulado encontrado
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Questões Problemáticas */}
        <div>
          <SectionHeader
            titulo="Questões com Alta Taxa de Erro"
            subtitulo="Questões onde a maioria dos alunos erra"
            icon={<AlertTriangle className="w-5 h-5 text-primary" />}
          />

          {!hasQuestoesProblematicas ? (
            <EmptyState
              titulo="Nenhuma questão problemática identificada"
              motivo="Questões com taxa de erro acima de 50% aparecerão aqui."
              sugestao="Aguarde mais respostas para identificar padrões"
            />
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {simulados.questoesProblematicas.slice(0, 8).map((q, index) => (
                  <div key={q.questao_id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">
                        {q.enunciado}
                      </span>
                      <Badge variant="destructive">{q.taxa_erro}% erro</Badge>
                    </div>
                    <Progress value={q.taxa_erro} className="h-2" />
                  </div>
                ))}

                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>Como interpretar:</strong> Taxa de erro alta (acima de 70%) pode indicar:
                    questão mal formulada, conteúdo não ensinado, ou nível de dificuldade excessivo.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Seção: Insights de Simulados */}
      <section>
        <SectionHeader
          titulo="Insights de Simulados"
          subtitulo="Padrões identificados e recomendações"
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Taxa de conclusão geral */}
          {taxaConclusaoGeral > 0 && taxaConclusaoGeral < 50 && (
            <InsightBox
              tipo="problema"
              titulo="Baixa taxa de conclusão geral"
              descricao={`Apenas ${taxaConclusaoGeral}% dos simulados iniciados são finalizados. Revise duração, dificuldade ou condições técnicas.`}
              acao="Considere simulados mais curtos ou com pausas permitidas"
              valor={`${taxaConclusaoGeral}%`}
            />
          )}

          {taxaConclusaoGeral >= 75 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Excelente taxa de conclusão"
              descricao={`${taxaConclusaoGeral}% dos simulados são concluídos. Os alunos estão engajando bem com as avaliações.`}
              valor={`${taxaConclusaoGeral}%`}
            />
          )}

          {/* Simulados problemáticos */}
          {simuladosProblematicos.length > 0 && (
            <InsightBox
              tipo="alerta"
              titulo={`${simuladosProblematicos.length} simulado(s) com problemas`}
              descricao={`Os simulados ${simuladosProblematicos.slice(0, 2).map(s => s.nome).join(', ')} têm menos de 50% de conclusão. Investigue as causas.`}
              acao="Revise duração, dificuldade e feedbacks dos alunos"
            />
          )}

          {/* Questões problemáticas */}
          {simulados.questoesProblematicas.length > 5 && (
            <InsightBox
              tipo="alerta"
              titulo={`${simulados.questoesProblematicas.length} questões com alta taxa de erro`}
              descricao="Muitas questões têm taxa de erro acima de 50%. Pode indicar gaps de ensino ou questões mal formuladas."
              acao="Revise as questões e considere material de apoio"
            />
          )}

          {/* Média de acertos */}
          {simulados.desempenhoGeral.media_acertos > 0 && simulados.desempenhoGeral.media_acertos < 50 && (
            <InsightBox
              tipo="alerta"
              titulo="Média de acertos abaixo de 50%"
              descricao={`Os alunos estão acertando apenas ${simulados.desempenhoGeral.media_acertos}% das questões. Pode indicar dificuldade excessiva.`}
              acao="Considere oferecer material de reforço antes dos simulados"
              valor={`${simulados.desempenhoGeral.media_acertos}%`}
            />
          )}

          {simulados.desempenhoGeral.media_acertos >= 70 && (
            <InsightBox
              tipo="oportunidade"
              titulo="Bom desempenho geral"
              descricao={`Média de ${simulados.desempenhoGeral.media_acertos}% de acertos. Os alunos estão preparados para os simulados.`}
              valor={`${simulados.desempenhoGeral.media_acertos}%`}
            />
          )}

          {/* Sem dados */}
          {!hasSimulados && (
            <InsightBox
              tipo="info"
              titulo="Nenhum simulado configurado"
              descricao="Configure simulados no painel administrativo para começar a coletar métricas de desempenho."
            />
          )}
        </div>
      </section>
    </div>
  );
};
