
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressCard } from '@/components/ProgressCard';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Target, TrendingUp, Award, BookOpen, CheckCircle } from 'lucide-react';

const COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#eab308',
  danger: '#dc2626',
  gray: '#6b7280'
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { progress, studyContents } = useStudy();

  // Prepare data for charts
  const disciplineData = Object.entries(progress.progressByDiscipline).map(([discipline, data]) => ({
    name: discipline,
    completed: data.completed,
    total: data.total,
    percentage: data.percentage,
    remaining: data.total - data.completed
  }));

  const pieData = disciplineData.map((item, index) => ({
    name: item.name,
    value: item.completed,
    color: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger][index % 4]
  }));

  const totalCompleted = progress.completedItems.length;
  const totalProgress = progress.totalItems > 0 ? Math.round((totalCompleted / progress.totalItems) * 100) : 0;

  // Content type distribution
  const contentTypes = studyContents.reduce((acc, content) => {
    acc[content.type] = (acc[content.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(contentTypes).map(([type, count]) => ({
    name: type === 'video' ? 'Vídeos' : type === 'exercise' ? 'Exercícios' : 'Leituras',
    value: count,
    completed: studyContents.filter(c => c.type === type && c.completed).length
  }));

  const radialData = [{
    name: 'Progresso Geral',
    progress: totalProgress,
    fill: COLORS.primary
  }];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Progresso</h1>
            <p className="text-gray-600">
              Acompanhe seu desempenho no {user?.faculty} - {user?.semester}º período
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <ProgressCard
          title="Progresso Geral"
          current={totalCompleted}
          total={progress.totalItems}
          percentage={totalProgress}
          color="primary"
          icon={<Target className="h-4 w-4" />}
        />
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total de Conteúdos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">{progress.totalItems}</div>
            <p className="text-sm text-gray-600">Itens disponíveis</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Concluídos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-success-600">{totalCompleted}</div>
            <p className="text-sm text-gray-600">Itens finalizados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Disciplinas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {Object.keys(progress.progressByDiscipline).length}
            </div>
            <p className="text-sm text-gray-600">Em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Bar Chart - Progress by Discipline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Progresso por Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disciplineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `${value} ${name === 'completed' ? 'concluído(s)' : 'total'}`,
                      name === 'completed' ? 'Concluídos' : 'Total'
                    ]}
                  />
                  <Bar dataKey="total" fill="#e5e7eb" name="total" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" fill={COLORS.primary} name="completed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Content Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-success-600" />
              Distribuição de Conteúdos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} concluído(s)`, 'Itens']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Radial Progress and Content Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radial Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Progresso Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData}>
                  <RadialBar
                    dataKey="progress"
                    cornerRadius={10}
                    fill={COLORS.primary}
                  />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-gray-900">
                    {totalProgress}%
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                {totalCompleted} de {progress.totalItems} conteúdos concluídos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Content Types Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-success-600" />
              Tipos de Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {typeData.map((type, index) => {
                const percentage = type.value > 0 ? Math.round((type.completed / type.value) * 100) : 0;
                const colors = [COLORS.primary, COLORS.success, COLORS.warning];
                
                return (
                  <div key={type.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{type.name}</span>
                      <span className="text-sm text-gray-600">
                        {type.completed}/{type.value} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: colors[index % colors.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
