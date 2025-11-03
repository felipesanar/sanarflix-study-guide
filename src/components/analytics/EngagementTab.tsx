import * as React from 'react';
const { useEffect, useState } = React;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Clock, Users, MousePointer, TrendingUp, Activity, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface EngagementTabProps {
  filters: AnalyticsFilters;
}

const timelineData = [
  { date: '01/10', DAU: 720, WAU: 2100, MAU: 8500 },
  { date: '08/10', DAU: 750, WAU: 2200, MAU: 8800 },
  { date: '15/10', DAU: 800, WAU: 2350, MAU: 9200 },
  { date: '22/10', DAU: 820, WAU: 2400, MAU: 9500 },
  { date: '29/10', DAU: 880, WAU: 2600, MAU: 10000 }
];

const sessionData = [
  { day: 'Seg', sessions: 12, time: 18 },
  { day: 'Ter', sessions: 15, time: 22 },
  { day: 'Qua', sessions: 18, time: 25 },
  { day: 'Qui', sessions: 14, time: 19 },
  { day: 'Sex', sessions: 10, time: 15 },
  { day: 'Sáb', sessions: 22, time: 28 },
  { day: 'Dom', sessions: 25, time: 32 }
];

const accessData = [
  { name: 'Aulas', value: 50, color: '#3B82F6' },
  { name: 'Questões', value: 30, color: '#10B981' },
  { name: 'Cronograma', value: 15, color: '#F59E0B' },
  { name: 'Outros', value: 5, color: '#6B7280' }
];

interface UserActivityData {
  user: string;
  clicks: number;
  session: string;
  status: string;
}

// Heatmap data - hours vs days
const heatmapData = Array.from({ length: 24 }, (_, hour) => 
  Array.from({ length: 7 }, (_, day) => ({
    hour,
    day: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day],
    value: Math.floor(Math.random() * 100) + 1
  }))
).flat();

const getHeatmapColor = (value: number) => {
  if (value > 80) return 'bg-red-500';
  if (value > 60) return 'bg-orange-400';
  if (value > 40) return 'bg-yellow-400';
  if (value > 20) return 'bg-blue-400';
  return 'bg-blue-200';
};

export const EngagementTab: React.FC<EngagementTabProps> = ({ filters }) => {
  const [userData, setUserData] = useState<UserActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
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

        // Mock activity data with real names
        const mockActivityData: UserActivityData[] = users?.map((user, index) => ({
          user: user.nome,
          clicks: Math.floor(Math.random() * 40) + 15, // Random clicks between 15-55
          session: `${Math.floor(Math.random() * 25) + 8}min`, // Random session time between 8-33min
          status: ['Alto', 'Ativo', 'Moderado', 'Baixo'][Math.floor(Math.random() * 4)]
        })) || [];

        setUserData(mockActivityData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Tempo Médio</span>
            </div>
            <div className="text-2xl font-bold">18min</div>
            <p className="text-xs text-muted-foreground">por sessão</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Stickiness Rate</span>
            </div>
            <div className="text-2xl font-bold">15%</div>
            <p className="text-xs text-muted-foreground">DAU/MAU</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">Taxa de Bounce</span>
            </div>
            <div className="text-2xl font-bold">20%</div>
            <p className="text-xs text-muted-foreground">abandono inicial</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">Freq. Retorno</span>
            </div>
            <div className="text-2xl font-bold">3.2x</div>
            <p className="text-xs text-muted-foreground">por semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Evolução Temporal - DAU/WAU/MAU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value}`, name]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Line type="monotone" dataKey="DAU" stroke="#3B82F6" strokeWidth={3} />
              <Line type="monotone" dataKey="WAU" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="MAU" stroke="#F59E0B" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Session Analysis & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sessões por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sessionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="time" fill="#3B82F6" name="Tempo (min)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Acessos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={accessData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {accessData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Heatmap de Stickiness Rate (por hora/dia)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-1 text-xs">
              <div></div>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center font-medium">{day}</div>
              ))}
            </div>
            
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="grid grid-cols-8 gap-1">
                <div className="text-xs text-right pr-1 py-1">
                  {hour.toString().padStart(2, '0')}h
                </div>
                {Array.from({ length: 7 }, (_, day) => {
                  const dataPoint = heatmapData.find(d => d.hour === hour && d.day === ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day]);
                  return (
                    <div
                      key={day}
                      className={`h-4 w-full rounded-sm ${getHeatmapColor(dataPoint?.value || 0)} cursor-pointer hover:opacity-80`}
                      title={`${dataPoint?.day} ${hour}h: ${dataPoint?.value}%`}
                    />
                  );
                })}
              </div>
            ))}
            
            <div className="flex items-center justify-center gap-2 mt-4 text-xs">
              <span>Menos</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-blue-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-blue-400 rounded-sm"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
                <div className="w-3 h-3 bg-orange-400 rounded-sm"></div>
                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
              </div>
              <span>Mais</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade dos Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Sessão</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Carregando dados dos usuários...</TableCell>
                </TableRow>
              ) : userData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Nenhum dado disponível</TableCell>
                </TableRow>
              ) : (
                userData.map((user, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{user.user}</TableCell>
                    <TableCell>{user.clicks}</TableCell>
                    <TableCell>{user.session}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.status === 'Alto' ? 'default' : 
                                 user.status === 'Ativo' ? 'secondary' : 
                                 user.status === 'Moderado' ? 'outline' : 'destructive'}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Insights Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Insights de Engajamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p className="text-blue-800 text-sm">
                <strong>Stickiness baixo (15%):</strong> Implementar sistema de lembretes push
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <p className="text-blue-800 text-sm">
                <strong>Pico nos finais de semana:</strong> Concentrar conteúdo novo nos sábados
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-orange-600 rounded-full mt-2"></div>
              <p className="text-blue-800 text-sm">
                <strong>Alta nas madrugadas:</strong> Otimizar servidor para horário noturno
              </p>
            </div>
          </div>
          
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
            Simular Notificação Push
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};