
import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressCard } from '@/components/ProgressCard';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Target, TrendingUp, Award, BookOpen, CheckCircle, Calendar } from 'lucide-react';
import { ReminderSettings } from '@/components/ReminderSettings';
import { useTheme } from 'next-themes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

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
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [selectedDiscipline, setSelectedDiscipline] = React.useState<string>('');
  const [selectedWeek, setSelectedWeek] = React.useState<string>('');
  const [showCompletedOnly, setShowCompletedOnly] = React.useState<boolean>(false);

  const allDisciplineData = React.useMemo(() => Object.entries(progress.progressByDiscipline).map(([discipline, data]) => ({
    name: discipline,
    completed: data.completed,
    total: data.total,
    percentage: data.percentage,
    remaining: data.total - data.completed
  })), [progress.progressByDiscipline]);

  const filteredContents = React.useMemo(() => {
    return studyContents.filter(c => {
      const okDiscipline = selectedDiscipline ? c.discipline === selectedDiscipline : true;
      const okWeek = selectedWeek ? String(c.week) === selectedWeek : true;
      const okCompleted = showCompletedOnly ? !!c.completed : true;
      return okDiscipline && okWeek && okCompleted;
    });
  }, [studyContents, selectedDiscipline, selectedWeek, showCompletedOnly]);

  const disciplineData = React.useMemo(() => {
    const base = selectedDiscipline ? allDisciplineData.filter(d => d.name === selectedDiscipline) : allDisciplineData;
    if (showCompletedOnly) {
      return base.map(b => ({ ...b, total: b.completed, remaining: 0, percentage: 100 }));
    }
    return base;
  }, [allDisciplineData, selectedDiscipline, showCompletedOnly]);

  const pieData = disciplineData.map((item, index) => ({
    name: item.name,
    value: item.completed,
    color: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger][index % 4]
  }));

  const totalCompleted = filteredContents.filter(c => c.completed).length;
  const totalProgress = filteredContents.length > 0 ? Math.round((totalCompleted / filteredContents.length) * 100) : 0;

  const contentTypes = filteredContents.reduce((acc, content) => {
    acc[content.type] = (acc[content.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(contentTypes).map(([type, count]) => ({
    name: type === 'video' ? 'Vídeos' : type === 'exercise' ? 'Exercícios' : 'Leituras',
    value: count,
    completed: filteredContents.filter(c => c.type === type && c.completed).length
  }));

  const radialData = [{
    name: 'Progresso Geral',
    progress: totalProgress,
    fill: COLORS.primary
  }];

  const weeks = React.useMemo(() => {
    const s = new Set<string>();
    studyContents.forEach(c => s.add(String(c.week)));
    return Array.from(s).sort((a,b)=>parseInt(a)-parseInt(b));
  }, [studyContents]);

  const timeSeriesData = React.useMemo(() => {
    return weeks.map(w => {
      const subset = studyContents.filter(c => String(c.week) === w);
      const completed = subset.filter(c => c.completed).length;
      const pct = subset.length > 0 ? Math.round((completed / subset.length) * 100) : 0;
      return { week: w, percentage: pct };
    });
  }, [weeks, studyContents]);

  const axisColor = isDark ? '#d1d5db' : '#6b7280';
  const gridColor = isDark ? '#2b2b2b' : '#f0f0f0';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : 'white',
    border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    borderRadius: '8px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  } as React.CSSProperties;

  const barChartRef = React.useRef<HTMLDivElement>(null);
  const pieChartRef = React.useRef<HTMLDivElement>(null);
  const radialChartRef = React.useRef<HTMLDivElement>(null);
  const exportCSV = () => {
    const rows = [['Disciplina','Concluídos','Total','%']].concat(disciplineData.map(d => [d.name, String(d.completed), String(d.total), String(d.percentage)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progresso_disciplinas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportSVGFromRef = (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const svg = ref.current.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 justify-between">
          <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Dashboard de Progresso</h1>
            <p className="text-sm sm:text-base opacity-80">
              Acompanhe seu desempenho no {user?.ies_nome} - {user?.semestre}º período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDiscipline || '_all'} onValueChange={(v) => setSelectedDiscipline(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {Object.keys(progress.progressByDiscipline).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWeek || '_all'} onValueChange={(v) => setSelectedWeek(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {weeks.map(w => (<SelectItem key={w} value={w}>Semana {w}</SelectItem>))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={showCompletedOnly} onCheckedChange={setShowCompletedOnly} />
              <Label className="text-sm">Concluídos</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedDiscipline(''); setSelectedWeek(''); setShowCompletedOnly(false); }}>Limpar</Button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
        {/* Bar Chart - Progress by Discipline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Progresso por Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            {disciplineData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-sm opacity-70">Sem dados para os filtros selecionados</div>
            ) : (
              <div className="h-80" ref={barChartRef}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" fontSize={12} tick={{ fill: axisColor }} axisLine={{ stroke: axisColor }} />
                    <YAxis fontSize={12} tick={{ fill: axisColor }} axisLine={{ stroke: axisColor }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [
                      `${value} ${name === 'completed' ? 'concluído(s)' : 'total'}`,
                      name === 'completed' ? 'Concluídos' : 'Total'
                    ]} />
                    <Bar dataKey="total" fill={isDark ? '#475569' : '#e5e7eb'} name="total" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="completed" fill={COLORS.primary} name="completed" radius={[2, 2, 0, 0]} onClick={(data) => {
                      const n = (data && (data as any).activeLabel) || undefined;
                      if (n) navigate(`/guia-estudos?materia=${encodeURIComponent(String(n))}`);
                    }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>Exportar CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportSVGFromRef(barChartRef, 'progresso_disciplinas.svg')}>Exportar SVG</Button>
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
            {pieData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-sm opacity-70">Sem dados para os filtros selecionados</div>
            ) : (
              <div className="h-80" ref={pieChartRef}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} outerRadius={80} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} onClick={() => navigate(`/guia-estudos?materia=${encodeURIComponent(entry.name)}`)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} concluído(s)`, 'Itens']} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportSVGFromRef(pieChartRef, 'distribuicao_conteudos.svg')}>Exportar SVG</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Radial Progress and Content Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Radial Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Progresso Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center" ref={radialChartRef}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData}>
                  <RadialBar dataKey="progress" cornerRadius={10} fill={COLORS.primary} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold" fill={isDark ? '#e5e7eb' : '#111827'}>
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
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportSVGFromRef(radialChartRef, 'progresso_geral.svg')}>Exportar SVG</Button>
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
            {typeData.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm opacity-70">Sem dados para os filtros selecionados</div>
            ) : (
              <div className="space-y-6">
                {typeData.map((type, index) => {
                  const percentage = type.value > 0 ? Math.round((type.completed / type.value) * 100) : 0;
                  const colors = [COLORS.primary, COLORS.success, COLORS.warning];
                  return (
                    <div key={type.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{type.name}</span>
                        <span className="text-sm opacity-80">
                          {type.completed}/{type.value} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ backgroundColor: isDark ? '#334155' : '#e5e7eb' }}>
                        <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${percentage}%`, backgroundColor: colors[index % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              Progresso por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeriesData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm opacity-70">Sem dados para os filtros selecionados</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="week" tick={{ fill: axisColor }} axisLine={{ stroke: axisColor }} />
                    <YAxis tick={{ fill: axisColor }} axisLine={{ stroke: axisColor }} domain={[0,100]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, 'Progresso']} />
                    <Line type="monotone" dataKey="percentage" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reminder Settings */}
      <div className="mt-6">
        <ReminderSettings />
      </div>
    </div>
  );
};
