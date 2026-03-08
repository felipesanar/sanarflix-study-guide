import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS } from '@/hooks/useErrorNotebook';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subWeeks, startOfWeek, format, isAfter, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ErrorNotebookDashboardProps {
  entries: ErrorNotebookEntry[];
}

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'hsl(var(--destructive))',
  did_not_remember: 'hsl(45, 93%, 47%)',
  did_not_understand_statement: 'hsl(217, 91%, 60%)',
  answered_without_confidence: 'hsl(262, 83%, 58%)',
};

export const ErrorNotebookDashboard: React.FC<ErrorNotebookDashboardProps> = ({ entries }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const recentCount = entries.filter(e => isAfter(new Date(e.created_at), sevenDaysAgo)).length;

    // Recurrence: temas with 2+ entries
    const temaMap = new Map<string, number>();
    entries.forEach(e => {
      const t = e.tema || 'Sem tema';
      temaMap.set(t, (temaMap.get(t) || 0) + 1);
    });
    const recurrentTemas = Array.from(temaMap.entries()).filter(([, c]) => c >= 2).length;

    // Dominant reason
    const reasonCounts: Record<string, number> = {};
    entries.forEach(e => {
      reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1;
    });
    const dominantReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantPct = dominantReason ? Math.round((dominantReason[1] / entries.length) * 100) : 0;

    return { total: entries.length, recentCount, recurrentTemas, dominantReason, dominantPct };
  }, [entries]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });
      const count = entries.filter(e => {
        const d = new Date(e.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({ week: format(weekStart, 'dd/MM', { locale: ptBR }), count });
    }
    return weeks;
  }, [entries]);

  const reasonPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => { counts[e.reason] = (counts[e.reason] || 0) + 1; });
    return Object.entries(counts).map(([reason, value]) => ({
      name: REASON_LABELS[reason as ErrorReason] || reason,
      value,
      color: REASON_COLORS[reason as ErrorReason] || 'hsl(var(--muted-foreground))',
    }));
  }, [entries]);

  const topTemasData = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach(e => {
      const t = e.tema || 'Sem tema';
      map.set(t, (map.get(t) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, count }));
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total registros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.recurrentTemas}</p>
              <p className="text-xs text-muted-foreground">Temas reincidentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.dominantPct}%</p>
              <p className="text-xs text-muted-foreground truncate">
                {stats.dominantReason ? REASON_LABELS[stats.dominantReason[0] as ErrorReason] : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.recentCount}</p>
              <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weekly trend */}
        <Card className="md:col-span-1">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Erros por semana</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#errGrad)" strokeWidth={2} name="Erros" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reason pie */}
        <Card className="md:col-span-1">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Distribuição por motivo</p>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={reasonPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={2}>
                  {reasonPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top temas */}
        <Card className="md:col-span-1">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Top 5 temas</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={topTemasData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Erros" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
