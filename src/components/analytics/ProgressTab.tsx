import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BookOpen, TrendingUp, Clock, Award, AlertTriangle, Target, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface ProgressTabProps {
  filters: AnalyticsFilters;
}

const courseProgressData = [
  { course: 'Medicina', completed: 50, total: 100, percentage: 50 },
  { course: 'Enfermagem', completed: 65, total: 100, percentage: 65 },
  { course: 'Farmácia', completed: 45, total: 100, percentage: 45 },
  { course: 'Fisioterapia', completed: 70, total: 100, percentage: 70 },
  { course: 'Psicologia', completed: 55, total: 100, percentage: 55 }
];

const funnelData = [
  { stage: 'Iniciaram', count: 1000, percentage: 100, color: '#10B981' },
  { stage: '25% Marcado', count: 750, percentage: 75, color: '#3B82F6' },
  { stage: '50% Marcado', count: 500, percentage: 50, color: '#F59E0B' },
  { stage: '75% Marcado', count: 300, percentage: 30, color: '#EF4444' },
  { stage: '100% Completo', count: 150, percentage: 15, color: '#8B5CF6' }
];

const markingRateData = [
  { type: 'Aulas', rate: 70 },
  { type: 'Questões', rate: 45 },
  { type: 'Leituras', rate: 60 },
  { type: 'Simulados', rate: 35 },
  { type: 'Revisões', rate: 55 }
];

const gapAnalysisData = [
  { user: 'Usuário #2847', expected: 25, marked: 18, gap: 7, status: 'Crítico' },
  { user: 'Usuário #1923', expected: 20, marked: 16, gap: 4, status: 'Moderado' },
  { user: 'Usuário #5671', expected: 30, marked: 29, gap: 1, status: 'Bom' },
  { user: 'Usuário #8934', expected: 15, marked: 8, gap: 7, status: 'Crítico' },
  { user: 'Usuário #4576', expected: 22, marked: 20, gap: 2, status: 'Bom' }
];

// Heatmap for curriculum items
const curriculumHeatmap = [
  { item: 'Bioquímica', completion: 30, color: 'bg-red-500' },
  { item: 'Anatomia', completion: 75, color: 'bg-green-500' },
  { item: 'Fisiologia', completion: 60, color: 'bg-yellow-500' },
  { item: 'Patologia', completion: 45, color: 'bg-orange-500' },
  { item: 'Farmacologia', completion: 80, color: 'bg-green-400' },
  { item: 'Clínica Médica', completion: 65, color: 'bg-blue-500' },
  { item: 'Cirurgia', completion: 25, color: 'bg-red-600' },
  { item: 'Pediatria', completion: 70, color: 'bg-green-400' }
];

export const ProgressTab: React.FC<ProgressTabProps> = ({ filters }) => {
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState('');

  const handleAwardBadge = (badge: string) => {
    setSelectedBadge(badge);
    setShowAwardModal(true);
  };

  const simulateAward = () => {
    setShowAwardModal(false);
    toast({
      title: "Badge atribuído!",
      description: `${selectedBadge} concedido a usuários elegíveis`,
      duration: 3000,
    });

    // Simulate improvement in completion rate
    setTimeout(() => {
      toast({
        title: "Impacto positivo",
        description: "Completude geral aumentou 10%",
        duration: 2000,
      });
    }, 1500);
  };

  const criticalGaps = gapAnalysisData.filter(user => user.status === 'Crítico').length;

  return (
    <div className="space-y-6">
      {/* Alert Banner for Critical Gaps */}
      {criticalGaps > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-900">
                  Alerta: {criticalGaps} estudantes com atraso crítico
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-red-300 text-red-700"
                onClick={() => setShowAlertModal(true)}
              >
                Ver Detalhes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Completude Média</span>
            </div>
            <div className="text-2xl font-bold">55%</div>
            <p className="text-xs text-muted-foreground">cronogramas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">Tempo Médio</span>
            </div>
            <div className="text-2xl font-bold">12min</div>
            <p className="text-xs text-muted-foreground">para marcar item</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Taxa Revisão</span>
            </div>
            <div className="text-2xl font-bold">20%</div>
            <p className="text-xs text-muted-foreground">itens revisitados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">Concluídos</span>
            </div>
            <div className="text-2xl font-bold">200</div>
            <p className="text-xs text-muted-foreground">de 1.000 criados</p>
          </CardContent>
        </Card>
      </div>

      {/* Course Progress & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Progresso por Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={courseProgressData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="course" type="category" width={80} />
                <Tooltip formatter={(value) => [`${value}%`, 'Completude']} />
                <Bar dataKey="percentage" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Heatmap de Itens do Cronograma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {curriculumHeatmap.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-white cursor-pointer hover:opacity-80 ${item.color}`}
                  title={`${item.item}: ${item.completion}% de completude`}
                >
                  <div className="font-medium text-sm">{item.item}</div>
                  <div className="text-xs opacity-90">{item.completion}%</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>Baixa completude</span>
              <span>Alta completude</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel & Marking Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Funil de Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((stage, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{stage.stage}</span>
                    <span>{stage.count} usuários ({stage.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="h-8 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all duration-500"
                      style={{ 
                        width: `${stage.percentage}%`, 
                        backgroundColor: stage.color,
                        minWidth: stage.percentage > 10 ? 'auto' : '60px'
                      }}
                    >
                      {stage.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Marcação por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={markingRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Taxa de Marcação']} />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Análise de Gaps de Aprendizagem
            <Badge variant="destructive" className="ml-2">
              {criticalGaps} críticos
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Marcados</TableHead>
                <TableHead>Gap (dias)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gapAnalysisData.map((user, index) => (
                <TableRow 
                  key={index}
                  className={user.status === 'Crítico' ? 'bg-red-50' : ''}
                >
                  <TableCell className="font-medium">{user.user}</TableCell>
                  <TableCell>{user.expected}</TableCell>
                  <TableCell>{user.marked}</TableCell>
                  <TableCell>{user.gap}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.status === 'Crítico' ? 'destructive' : 
                               user.status === 'Moderado' ? 'outline' : 'secondary'}
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Awards & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-900 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Sistema de Premiações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="font-medium">Cronograma Mestre</div>
                    <div className="text-sm text-muted-foreground">100% de completude</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleAwardBadge('Cronograma Mestre')}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Atribuir
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium">Consistência</div>
                    <div className="text-sm text-muted-foreground">7 dias seguidos</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleAwardBadge('Consistência')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Atribuir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights de Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-900 mb-1">
                  Gaps críticos em Bioquímica
                </div>
                <p className="text-sm text-blue-700">
                  30% dos estudantes estão atrasados nesta matéria. Sugerir conteúdo de reforço.
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <div className="font-medium text-green-900 mb-1">
                  Anatomia com melhor performance
                </div>
                <p className="text-sm text-green-700">
                  75% de completude. Usar como modelo para outras disciplinas.
                </p>
              </div>

              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="font-medium text-orange-900 mb-1">
                  Baixa taxa de revisão
                </div>
                <p className="text-sm text-orange-700">
                  Apenas 20% revisitam conteúdos. Implementar sistema de repetição espaçada.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Award Modal */}
      <Dialog open={showAwardModal} onOpenChange={setShowAwardModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Badge: {selectedBadge}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border text-center">
              <Award className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
              <h3 className="font-bold text-yellow-900">{selectedBadge}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Este badge será atribuído a todos os usuários elegíveis
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAwardModal(false)}>
                Cancelar
              </Button>
              <Button onClick={simulateAward} className="bg-yellow-600 hover:bg-yellow-700">
                Confirmar Atribuição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Modal */}
      <Dialog open={showAlertModal} onOpenChange={setShowAlertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Estudantes em Risco
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Os seguintes estudantes têm gaps críticos e precisam de atenção:
            </p>
            
            <div className="space-y-2">
              {gapAnalysisData
                .filter(user => user.status === 'Crítico')
                .map((user, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="font-medium">{user.user}</span>
                    <Badge variant="destructive">{user.gap} dias atraso</Badge>
                  </div>
                ))}
            </div>
            
            <Button onClick={() => setShowAlertModal(false)} className="w-full">
              Enviar Lembretes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};