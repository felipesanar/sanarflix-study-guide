import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Users, MapPin, Smartphone, Clock, TrendingDown, Filter } from 'lucide-react';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface DemographicsTabProps {
  filters: AnalyticsFilters;
}

const universityData = [
  { name: 'USP', value: 45, color: '#3B82F6', students: 2250 },
  { name: 'UNIFESP', value: 25, color: '#10B981', students: 1250 },
  { name: 'UNICAMP', value: 15, color: '#F59E0B', students: 750 },
  { name: 'USCS', value: 10, color: '#EF4444', students: 500 },
  { name: 'Outros', value: 5, color: '#6B7280', students: 250 }
];

const courseData = [
  { name: 'Medicina', value: 55, color: '#8B5CF6', students: 2750 },
  { name: 'Enfermagem', value: 20, color: '#06B6D4', students: 1000 },
  { name: 'Farmácia', value: 12, color: '#84CC16', students: 600 },
  { name: 'Fisioterapia', value: 8, color: '#F97316', students: 400 },
  { name: 'Outros', value: 5, color: '#6B7280', students: 250 }
];

const deviceData = [
  { device: 'Mobile', percentage: 80, color: '#10B981' },
  { device: 'Desktop', percentage: 20, color: '#3B82F6' }
];

const hourlyAccessData = [
  { hour: '00h', access: 15 },
  { hour: '03h', access: 8 },
  { hour: '06h', access: 25 },
  { hour: '09h', access: 45 },
  { hour: '12h', access: 38 },
  { hour: '15h', access: 52 },
  { hour: '18h', access: 68 },
  { hour: '21h', access: 75 },
  { hour: '24h', access: 22 }
];

const regionData = [
  { region: 'São Paulo', percentage: 55, students: 2750 },
  { region: 'Rio de Janeiro', percentage: 20, students: 1000 },
  { region: 'Minas Gerais', percentage: 12, students: 600 },
  { region: 'Paraná', percentage: 8, students: 400 },
  { region: 'Outros', percentage: 5, students: 250 }
];

const churnData = [
  { segment: '1º Semestre', churn: 18, color: '#EF4444' },
  { segment: '2º Semestre', churn: 15, color: '#F97316' },
  { segment: '3º Semestre', churn: 12, color: '#F59E0B' },
  { segment: '4º Semestre', churn: 8, color: '#84CC16' },
  { segment: '5º+ Semestre', churn: 5, color: '#10B981' }
];

const registrationVsFirstMarkData = [
  { month: 'Jan', registrations: 120, firstMark: 78 },
  { month: 'Fev', registrations: 140, firstMark: 91 },
  { month: 'Mar', registrations: 110, firstMark: 75 },
  { month: 'Abr', registrations: 160, firstMark: 104 },
  { month: 'Mai', registrations: 130, firstMark: 89 },
  { month: 'Jun', registrations: 150, firstMark: 98 }
];

const inactiveUsersData = [
  { segment: 'Calouros Mobile', churn: 22, action: 'Lembretes Push' },
  { segment: 'Veteranos Desktop', churn: 8, action: 'Email Semanal' },
  { segment: 'Medicina Integral', churn: 15, action: 'Gamificação' },
  { segment: 'Enfermagem Noturno', churn: 18, action: 'Flexibilidade' }
];

// Mock Brazil map data (simplified)
const brazilStates = [
  { state: 'SP', intensity: 55, x: 200, y: 250 },
  { state: 'RJ', intensity: 20, x: 220, y: 230 },
  { state: 'MG', intensity: 12, x: 180, y: 200 },
  { state: 'PR', intensity: 8, x: 160, y: 280 },
  { state: 'RS', intensity: 5, x: 140, y: 320 },
  { state: 'SC', intensity: 4, x: 150, y: 300 },
  { state: 'GO', intensity: 3, x: 140, y: 170 },
  { state: 'BA', intensity: 6, x: 150, y: 120 }
];

const getIntensityColor = (intensity: number) => {
  if (intensity >= 40) return '#1E40AF'; // Dark blue
  if (intensity >= 20) return '#3B82F6'; // Blue
  if (intensity >= 10) return '#60A5FA'; // Light blue
  if (intensity >= 5) return '#93C5FD';  // Lighter blue
  return '#DBEAFE'; // Very light blue
};

export const DemographicsTab: React.FC<DemographicsTabProps> = ({ filters }) => {
  const handleSegmentFilter = (segment: string) => {
    console.log(`Filtering by segment: ${segment}`);
    // This would update the global filters
  };

  return (
    <div className="space-y-6">
      {/* Demographics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Total Usuários</span>
            </div>
            <div className="text-2xl font-bold">5.000</div>
            <p className="text-xs text-muted-foreground">ativos este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Cobertura</span>
            </div>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">estados brasileiros</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">Mobile First</span>
            </div>
            <div className="text-2xl font-bold">80%</div>
            <p className="text-xs text-muted-foreground">acessos mobile</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">Pico de Uso</span>
            </div>
            <div className="text-2xl font-bold">19h-21h</div>
            <p className="text-xs text-muted-foreground">horário noturno</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Universidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={universityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {universityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={courseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {courseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {courseData.map((course, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: course.color }}
                  />
                  <span>{course.name}: {course.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brazil Map & Device Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição Regional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Simplified Brazil Map */}
              <div className="w-full h-64 bg-gray-100 rounded-lg relative overflow-hidden">
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  {/* Simplified Brazil outline */}
                  <path
                    d="M100 50 L300 50 L320 100 L350 150 L340 200 L360 250 L350 300 L320 350 L280 380 L200 380 L150 350 L120 300 L100 250 L80 200 L90 150 L100 100 Z"
                    fill="#F3F4F6"
                    stroke="#D1D5DB"
                    strokeWidth="2"
                  />
                  
                  {/* State markers */}
                  {brazilStates.map((state, index) => (
                    <g key={index}>
                      <circle
                        cx={state.x}
                        cy={state.y}
                        r={Math.sqrt(state.intensity) * 3}
                        fill={getIntensityColor(state.intensity)}
                        opacity={0.8}
                      />
                      <text
                        x={state.x}
                        y={state.y + 4}
                        textAnchor="middle"
                        className="text-xs font-medium fill-white"
                      >
                        {state.state}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              
              {/* Legend */}
              <div className="mt-4 flex items-center justify-between text-xs">
                <span>Menor acesso</span>
                <div className="flex gap-1">
                  <div className="w-4 h-4 bg-blue-100 rounded"></div>
                  <div className="w-4 h-4 bg-blue-300 rounded"></div>
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <div className="w-4 h-4 bg-blue-700 rounded"></div>
                </div>
                <span>Maior acesso</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispositivos & Horários</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Device Usage */}
            <div>
              <h4 className="font-medium mb-3">Tipo de Dispositivo</h4>
              <div className="space-y-2">
                {deviceData.map((device, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{device.device}</span>
                    <div className="flex items-center gap-2 flex-1 ml-4">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${device.percentage}%`,
                            backgroundColor: device.color
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">{device.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly Access */}
            <div>
              <h4 className="font-medium mb-3">Acessos por Horário</h4>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={hourlyAccessData}>
                  <XAxis dataKey="hour" />
                  <YAxis hide />
                  <Tooltip formatter={(value) => [`${value}%`, 'Acessos']} />
                  <Line 
                    type="monotone" 
                    dataKey="access" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Churn Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Churn Rate por Semestre</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="segment" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Churn Rate']} />
                <Bar dataKey="churn" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <Badge variant="destructive">
                Calouros têm maior taxa de abandono
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro vs Primeira Marcação</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={registrationVsFirstMarkData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="registrations" fill="#3B82F6" name="Cadastros" />
                <Bar dataKey="firstMark" fill="#10B981" name="Primeira Marcação" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Cadastros</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Primeira Marcação (65%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inactive Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Usuários Inativos por Segmento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segmento</TableHead>
                <TableHead>% Churn</TableHead>
                <TableHead>Ação Recomendada</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inactiveUsersData.map((segment, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{segment.segment}</TableCell>
                  <TableCell>
                    <Badge variant={segment.churn > 20 ? 'destructive' : segment.churn > 15 ? 'outline' : 'secondary'}>
                      {segment.churn}%
                    </Badge>
                  </TableCell>
                  <TableCell>{segment.action}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleSegmentFilter(segment.segment)}
                      className="gap-1"
                    >
                      <Filter className="w-3 h-3" />
                      Filtrar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Insights Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900">Insights Demográficos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-purple-900">Segmentos para Engajamento</h4>
              <div className="space-y-2">
                {inactiveUsersData.slice(0, 2).map((segment, index) => (
                  <Card key={index} className="p-3 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{segment.segment}</div>
                        <div className="text-xs text-muted-foreground">{segment.action}</div>
                      </div>
                      <Button size="sm" variant="outline">
                        Aplicar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-purple-900">Oportunidades</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                  <span><strong>Mobile dominance:</strong> Priorizar UX mobile</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <span><strong>Concentração SP:</strong> Expandir para outros estados</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5"></div>
                  <span><strong>Churn inicial:</strong> Melhorar onboarding</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};