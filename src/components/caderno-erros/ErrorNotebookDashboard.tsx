import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS } from '@/hooks/useErrorNotebook';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subWeeks, startOfWeek, format, isAfter, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Logger } from '@/utils/logger';

Logger.info('[ErrorNotebookUI] ErrorNotebookDashboard loaded');

interface ErrorNotebookDashboardProps {
  entries: ErrorNotebookEntry[];
}

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'hsl(var(--destructive))',
  did_not_remember: 'hsl(45, 93%, 47%)',
  did_not_understand_statement: 'hsl(217, 91%, 60%)',
  answered_without_confidence: 'hsl(262, 83%, 58%)',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border/40 rounded-xl shadow-lg px-4 py-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-muted-foreground">
            {p.name}: <span className="font-bold text-foreground">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ErrorNotebookDashboard: React.FC<ErrorNotebookDashboardProps> = ({ entries }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const recentCount = entries.filter(e => isAfter(new Date(e.created_at), sevenDaysAgo)).length;

    const temaMap = new Map<string, number>();
    entries.forEach(e => {
      const t = e.tema || 'Sem tema';
      temaMap.set(t, (temaMap.get(t) || 0) + 1);
    });
    const recurrentTemas = Array.from(temaMap.entries()).filter(([, c]) => c >= 2).length;

    const reasonCounts: Record<string, number> = {};
    entries.forEach(e => { reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1; });
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

  const kpiCards = [
    { icon: BarChart3, iconBg: 'bg-primary/10', iconColor: 'text-primary', value: stats.total, label: 'Total registros' },
    { icon: AlertTriangle, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', value: stats.recurrentTemas, label: 'Temas reincidentes' },
    { icon: TrendingUp, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', value: `${stats.dominantPct}%`, label: stats.dominantReason ? REASON_LABELS[stats.dominantReason[0] as ErrorReason] : '—' },
    { icon: Calendar, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', value: stats.recentCount, label: 'Últimos 7 dias' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
          >
            <Card className="border-border/30 rounded-2xl hover:shadow-sm transition-shadow duration-200">
              <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
                <div className={`h-10 w-10 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`h-[18px] w-[18px] ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.2 }}>
          <Card className="border-border/30 rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Erros por semana</p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="errGradPremium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" opacity={0.3} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#errGradPremium)" strokeWidth={2} name="Erros" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.25 }}>
          <Card className="border-border/30 rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Distribuição por motivo</p>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={reasonPieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {reasonPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.3 }}>
          <Card className="border-border/30 rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Top 5 temas</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={topTemasData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" opacity={0.4} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Erros" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};