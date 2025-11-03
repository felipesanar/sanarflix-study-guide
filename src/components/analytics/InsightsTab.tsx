import * as React from 'react';
const { useState, useEffect } = React;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertCircle, Target, Zap, Download, Brain, Lightbulb, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface InsightsTabProps {
  filters: AnalyticsFilters;
}

const correlationData = [
  { sessionTime: 5, completion: 15 },
  { sessionTime: 10, completion: 25 },
  { sessionTime: 15, completion: 40 },
  { sessionTime: 20, completion: 55 },
  { sessionTime: 25, completion: 70 },
  { sessionTime: 30, completion: 80 },
  { sessionTime: 35, completion: 85 },
  { sessionTime: 40, completion: 90 },
  { sessionTime: 45, completion: 92 },
  { sessionTime: 50, completion: 95 },
  { sessionTime: 55, completion: 96 },
  { sessionTime: 60, completion: 98 }
];

const benchmarkData = [
  { metric: 'Cliques SanarFlix', current: 10000, previous: 9000, change: 11.1 },
  { metric: 'Completude', current: 55, previous: 50, change: 10 },
  { metric: 'Retenção', current: 50, previous: 48, change: 4.2 },
  { metric: 'Engajamento', current: 800, previous: 750, change: 6.7 }
];

interface DropOffData {
  user: string;
  score: number;
  reason: string;
  risk: string;
}

const itemHeatmapData = [
  { type: 'Aulas', completion: 70, color: '#10B981' },
  { type: 'Questões', completion: 50, color: '#F59E0B' },
  { type: 'Leituras', completion: 60, color: '#3B82F6' },
  { type: 'Simulados', completion: 35, color: '#EF4444' },
  { type: 'Revisões', completion: 45, color: '#8B5CF6' }
];

const eventImpactData = [
  { event: 'Provas ENEM', impact: 30, icon: '📚' },
  { event: 'Semana de Provas', impact: 45, icon: '📝' },
  { event: 'Férias', impact: -20, icon: '🏖️' },
  { event: 'Início Semestre', impact: 25, icon: '🎓' }
];

const sentimentData = [
  { sentiment: 'Positivo', value: 70, color: '#10B981', quotes: ['Cronograma muito útil!', 'Adoro a organização'] },
  { sentiment: 'Neutro', value: 20, color: '#F59E0B', quotes: ['Tá ok', 'Normal'] },
  { sentiment: 'Negativo', value: 10, color: '#EF4444', quotes: ['Poderia melhorar', 'Difícil de usar'] }
];

const crossPlatformData = [
  { platform: 'SanarFlix', clicks: 8500, change: 20 },
  { platform: 'Geral', clicks: 10000, change: 10 }
];

const alerts = [
  { id: 1, message: '30 usuários em risco de abandono', type: 'critical', count: 30 },
  { id: 2, message: 'Baixa completude em Bioquímica', type: 'warning', count: 15 },
  { id: 3, message: 'Pico de acesso não atendido', type: 'info', count: 5 }
];

export const InsightsTab: React.FC<InsightsTabProps> = ({ filters }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [dropOffData, setDropOffData] = useState<DropOffData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDropOffData = async () => {
      try {
        setLoading(true);
        const { data: users, error } = await supabase
          .from('users')
          .select('nome, email')
          .limit(10);

        if (error) {
          console.error('Error fetching users:', error);
          return;
        }

        // Mock drop-off data with real names
        const reasons = [
          'Sem progresso há 14 dias',
          'Baixa interação',
          'Cronograma incompleto',
          'Poucas marcações',
          'Acesso irregular',
          'Não usa funcionalidades',
          'Baixo engajamento'
        ];

        const risks = ['Crítico', 'Alto', 'Médio'];

        const mockDropOffData: DropOffData[] = users?.map((user) => {
          const score = Math.floor(Math.random() * 40) + 60; // 60-100
          const reason = reasons[Math.floor(Math.random() * reasons.length)];
          const risk = score > 90 ? 'Crítico' : score > 80 ? 'Alto' : 'Médio';
          
          return {
            user: user.nome,
            score,
            reason,
            risk
          };
        }) || [];

        setDropOffData(mockDropOffData);
      } catch (error) {
        console.error('Error fetching drop-off data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDropOffData();
  }, [filters]);

  const handleGenerateReport = () => {
    setShowReportModal(true);
  };

  const simulateReportDownload = () => {
    setShowReportModal(false);
    
    // Simulate download with progress
    toast({
      title: "Gerando relatório...",
      description: "Preparando insights avançados",
      duration: 1000,
    });

    setTimeout(() => {
      toast({
        title: "Relatório exportado!",
        description: "insights_analytics_avancados.pdf baixado com sucesso",
        duration: 3000,
      });
    }, 2000);
  };

  const handleAlertClick = (alert: any) => {
    setSelectedAlert(alert);
    // Filter data based on alert
    console.log(`Filtering by alert: ${alert.message}`);
  };

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <Card 
            key={alert.id}
            className={`cursor-pointer hover:shadow-md transition-shadow ${
              alert.type === 'critical' ? 'border-red-200 bg-red-50' :
              alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
              'border-blue-200 bg-blue-50'
            }`}
            onClick={() => handleAlertClick(alert)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className={`w-5 h-5 ${
                    alert.type === 'critical' ? 'text-red-600' :
                    alert.type === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <span className="text-sm font-medium">{alert.message}</span>
                </div>
                <Badge variant={alert.type === 'critical' ? 'destructive' : 'outline'}>
                  {alert.count}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Correlation Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Análise de Correlação: Tempo de Sessão vs Completude
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart data={correlationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="sessionTime" 
                    type="number" 
                    domain={[0, 60]}
                    label={{ value: 'Tempo de Sessão (min)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    dataKey="completion"
                    type="number"
                    domain={[0, 100]}
                    label={{ value: '% Completude', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'completion' ? `${value}%` : `${value}min`,
                      name === 'completion' ? 'Completude' : 'Tempo de Sessão'
                    ]}
                  />
                  <Scatter name="Correlação" dataKey="completion" fill="#3B82F6" />
                  {/* Trend line */}
                  <Scatter 
                    data={[{sessionTime: 0, completion: 5}, {sessionTime: 60, completion: 98}]}
                    line={{ stroke: '#EF4444', strokeWidth: 2, strokeDasharray: '5 5' }}
                    fill="none"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Correlação Forte</h4>
                <div className="text-2xl font-bold text-blue-600 mb-1">r = 0.89</div>
                <p className="text-sm text-blue-700">
                  Maior tempo de sessão está fortemente correlacionado com maior completude
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Sweet Spot</h4>
                <div className="text-lg font-bold text-green-600 mb-1">20-30 min</div>
                <p className="text-sm text-green-700">
                  Zona ótima para engajamento efetivo
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark: Atual vs Período Anterior</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={benchmarkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="current" fill="#3B82F6" name="Atual" />
              <Bar dataKey="previous" fill="#94A3B8" name="Anterior" />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {benchmarkData.map((item, index) => (
              <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium">{item.metric}</div>
                <div className={`text-lg font-bold ${item.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.change > 0 ? '+' : ''}{item.change}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drop-off Analysis & Item Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Análise de Drop-off Prioritizada</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Razão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Carregando dados...</TableCell>
                  </TableRow>
                ) : dropOffData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nenhum dado disponível</TableCell>
                  </TableRow>
                ) : (
                  dropOffData.map((user, index) => (
                    <TableRow 
                      key={index}
                      className={user.score > 80 ? 'bg-red-50' : ''}
                    >
                      <TableCell className="font-medium">{user.user}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={user.score} className="w-16 h-2" />
                          <span className="text-sm">{user.score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.reason}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Heatmap de Itens de Cronograma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itemHeatmapData.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.type}</span>
                    <span>{item.completion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="h-4 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ 
                        width: `${item.completion}%`, 
                        backgroundColor: item.color,
                        minWidth: item.completion > 20 ? 'auto' : '40px'
                      }}
                    >
                      {item.completion}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-orange-900">Insight</span>
              </div>
              <p className="text-sm text-orange-800">
                Simulados têm baixa completude (35%). Considere gamificação ou recompensas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Impact & Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Impacto de Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eventImpactData.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{event.icon}</span>
                    <span className="font-medium">{event.event}</span>
                  </div>
                  <div className={`flex items-center gap-1 ${
                    event.impact > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span className="font-bold">
                      {event.impact > 0 ? '+' : ''}{event.impact}%
                    </span>
                    <TrendingUp className={`w-4 h-4 ${event.impact < 0 ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Análise de Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Sentimento']} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="space-y-2 mt-4">
              {sentimentData.map((sentiment, index) => (
                <div key={index} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: sentiment.color }}
                    />
                    <span className="font-medium">{sentiment.sentiment}: {sentiment.value}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-5">
                    "{sentiment.quotes[0]}"
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cross-Platform & ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comparação Cross-Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={crossPlatformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clicks" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="font-medium text-green-900 mb-1">
                SanarFlix Outperforming
              </div>
              <p className="text-sm text-green-700">
                +20% cliques vs plataforma geral. Estratégia de redirecionamento eficaz.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI de Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Gamificação</h4>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div>Pré-implementação: 50%</div>
                    <div>Pós-implementação: 60%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">+20%</div>
                    <div className="text-xs text-muted-foreground">ROI</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">Push Notifications</h4>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div>Retenção: 48% → 52%</div>
                    <div>Engajamento: +15%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">+8%</div>
                    <div className="text-xs text-muted-foreground">ROI</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Insights Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-indigo-900">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Insights Avançados - Resumo Executivo
            </div>
            <Button 
              onClick={handleGenerateReport}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <FileText className="w-4 h-4" />
              Gerar Relatório
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-indigo-900 mb-3">Principais Descobertas</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-green-600 mt-0.5" />
                  <span><strong>Correlação tempo-completude:</strong> 89% - Focar em sessões 20-30min</span>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
                  <span><strong>SanarFlix performance:</strong> +20% vs geral - Ampliar estratégia</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <span><strong>Simulados críticos:</strong> 35% completude - Needs gamificação</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-indigo-900 mb-3">Ações Recomendadas</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-white rounded border-l-4 border-l-green-500">
                  <strong>Curto prazo:</strong> Implementar badges para simulados
                </div>
                <div className="p-2 bg-white rounded border-l-4 border-l-blue-500">
                  <strong>Médio prazo:</strong> Otimizar duração de sessões
                </div>
                <div className="p-2 bg-white rounded border-l-4 border-l-purple-500">
                  <strong>Longo prazo:</strong> Expandir redirecionamentos inteligentes
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Generation Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relatório de Insights Avançados</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Conteúdo do Relatório</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium mb-2">Análises Incluídas:</h5>
                  <ul className="space-y-1">
                    <li>• Correlações estatísticas</li>
                    <li>• Benchmarks temporais</li>
                    <li>• Previsões de churn</li>
                    <li>• ROI de ações</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium mb-2">Formato:</h5>
                  <ul className="space-y-1">
                    <li>• PDF executivo (12 páginas)</li>
                    <li>• Gráficos interativos</li>
                    <li>• Recomendações priorizadas</li>
                    <li>• Dados anonimizados</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReportModal(false)}>
                Cancelar
              </Button>
              <Button onClick={simulateReportDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};