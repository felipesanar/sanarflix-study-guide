import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, TrendingUp, BookOpen, Target, AlertTriangle,
  Calendar, ChevronRight, Activity, Search, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell
} from 'recharts';

// Analytics event types for the journey
const JOURNEY_EVENTS = {
  views: ['progress_hub_view', 'progress_hub_first_view', 'study_guide_view'],
  completions: ['study_guide_lesson_completion_toggled'],
  searches: ['study_guide_search_performed', 'study_guide_search_no_results'],
  exams: ['progress_hub_exam_added', 'progress_hub_exam_removed'],
  content: ['study_guide_content_action'],
  calendar: ['study_guide_calendar_subject_added', 'study_guide_calendar_opened'],
};

interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  events: string[];
}

interface DayData {
  date: string;
  views: number;
  completions: number;
  searches: number;
}

const StudentJourneyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const days = parseInt(period);

  // Fetch analytics events
  const { data: events, isLoading } = useQuery({
    queryKey: ['student-journey-analytics', user?.id_ies, days],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_name, event_data, created_at, user_id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('event_name', [
          ...JOURNEY_EVENTS.views,
          ...JOURNEY_EVENTS.completions,
          ...JOURNEY_EVENTS.searches,
          ...JOURNEY_EVENTS.exams,
          ...JOURNEY_EVENTS.content,
          ...JOURNEY_EVENTS.calendar,
        ])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id_ies,
    staleTime: 5 * 60 * 1000,
  });

  // Process funnel data
  const funnelData = useMemo((): FunnelStep[] => {
    if (!events) return [];

    const uniqueUsers = new Set(events.map(e => e.user_id));
    const totalUsers = uniqueUsers.size || 1;

    const steps: FunnelStep[] = [
      {
        name: 'Visualizaram Hub',
        events: JOURNEY_EVENTS.views,
        count: new Set(events.filter(e => JOURNEY_EVENTS.views.includes(e.event_name)).map(e => e.user_id)).size,
        percentage: 100,
      },
      {
        name: 'Acessaram Guia',
        events: ['study_guide_view'],
        count: new Set(events.filter(e => e.event_name === 'study_guide_view').map(e => e.user_id)).size,
        percentage: 0,
      },
      {
        name: 'Interagiram com Conteúdo',
        events: JOURNEY_EVENTS.content,
        count: new Set(events.filter(e => JOURNEY_EVENTS.content.includes(e.event_name)).map(e => e.user_id)).size,
        percentage: 0,
      },
      {
        name: 'Completaram Aulas',
        events: JOURNEY_EVENTS.completions,
        count: new Set(events.filter(e => JOURNEY_EVENTS.completions.includes(e.event_name)).map(e => e.user_id)).size,
        percentage: 0,
      },
    ];

    // Calculate percentages based on first step
    const baseCount = steps[0].count || 1;
    steps.forEach((step, i) => {
      step.percentage = Math.round((step.count / baseCount) * 100);
    });

    return steps;
  }, [events]);

  // Process daily data for chart
  const dailyData = useMemo((): DayData[] => {
    if (!events) return [];

    const byDay = new Map<string, DayData>();
    
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
      byDay.set(date, { date, views: 0, completions: 0, searches: 0 });
    }

    events.forEach(e => {
      const date = format(new Date(e.created_at), 'yyyy-MM-dd');
      const day = byDay.get(date);
      if (!day) return;

      if (JOURNEY_EVENTS.views.includes(e.event_name)) day.views++;
      if (JOURNEY_EVENTS.completions.includes(e.event_name)) day.completions++;
      if (JOURNEY_EVENTS.searches.includes(e.event_name)) day.searches++;
    });

    return Array.from(byDay.values()).map(d => ({
      ...d,
      date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
    }));
  }, [events, days]);

  // Key metrics
  const metrics = useMemo(() => {
    if (!events) return { totalViews: 0, totalCompletions: 0, avgPerUser: 0, searchNoResults: 0 };

    const views = events.filter(e => JOURNEY_EVENTS.views.includes(e.event_name)).length;
    const completions = events.filter(e => JOURNEY_EVENTS.completions.includes(e.event_name)).length;
    const uniqueUsers = new Set(events.map(e => e.user_id)).size;
    const noResults = events.filter(e => e.event_name === 'study_guide_search_no_results').length;

    return {
      totalViews: views,
      totalCompletions: completions,
      avgPerUser: uniqueUsers > 0 ? Math.round(completions / uniqueUsers * 10) / 10 : 0,
      searchNoResults: noResults,
    };
  }, [events]);

  // Top materias from completions
  const topMaterias = useMemo(() => {
    if (!events) return [];

    const materiaCounts = new Map<string, number>();
    
    events
      .filter(e => JOURNEY_EVENTS.completions.includes(e.event_name))
      .forEach(e => {
        const data = e.event_data as Record<string, unknown>;
        const materia = String(data?.materia || 'Desconhecido');
        materiaCounts.set(materia, (materiaCounts.get(materia) || 0) + 1);
      });

    return Array.from(materiaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([materia, count]) => ({ materia, count }));
  }, [events]);

  // Search queries without results
  const failedSearches = useMemo(() => {
    if (!events) return [];

    const searchCounts = new Map<string, number>();
    
    events
      .filter(e => e.event_name === 'study_guide_search_no_results')
      .forEach(e => {
        const data = e.event_data as Record<string, unknown>;
        const queryLength = Number(data?.query_length || 0);
        const bucket = queryLength <= 5 ? '1-5 chars' : queryLength <= 10 ? '6-10 chars' : '10+ chars';
        searchCounts.set(bucket, (searchCounts.get(bucket) || 0) + 1);
      });

    return Array.from(searchCounts.entries())
      .map(([bucket, count]) => ({ bucket, count }));
  }, [events]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const FUNNEL_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Jornada do Estudante</h1>
              <p className="text-sm text-muted-foreground">
                Análise de comportamento e engajamento
              </p>
            </div>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as '7' | '30')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                Visualizações
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.totalViews}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Target className="h-4 w-4" />
                Conclusões
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.totalCompletions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                Média/Usuário
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.avgPerUser}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Search className="h-4 w-4" />
                Buscas s/ resultado
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-500">{metrics.searchNoResults}</p>
            </CardContent>
          </Card>
        </div>

        {/* Funnel and Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ChevronRight className="h-5 w-5 text-primary" />
                Funil de Engajamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelData.map((step, i) => (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{step.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{step.count}</Badge>
                      <span className="text-sm text-muted-foreground">{step.percentage}%</span>
                    </div>
                  </div>
                  <Progress 
                    value={step.percentage} 
                    className="h-2"
                    style={{ 
                      ['--progress-background' as string]: FUNNEL_COLORS[i] 
                    }}
                  />
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* Daily Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Atividade Diária
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorViews)"
                      name="Visualizações"
                    />
                    <Area
                      type="monotone"
                      dataKey="completions"
                      stroke="hsl(var(--chart-2))"
                      fillOpacity={1}
                      fill="url(#colorCompletions)"
                      name="Conclusões"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Materias */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Top Matérias (por conclusões)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topMaterias.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Nenhum dado disponível
                </p>
              ) : (
                <div className="space-y-3">
                  {topMaterias.map((m, i) => (
                    <div key={m.materia} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.materia}</p>
                      </div>
                      <Badge variant="secondary">{m.count} aulas</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Failed Searches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Buscas sem Resultado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {failedSearches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                    <Search className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma busca sem resultado no período
                  </p>
                </div>
              ) : (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={failedSearches} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="bucket" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        width={80}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={4} name="Quantidade" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentJourneyDashboard;
