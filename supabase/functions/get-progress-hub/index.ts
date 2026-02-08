import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CalendarSubject {
  name: string;
  day_of_week: number;
}

interface PendingContent {
  id: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
}

interface NextAction {
  id: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
  reason: string;
  priority: number;
  type: 'today_focus' | 'quick_win' | 'unlock_progress';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('get-progress-hub: Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Client with user auth for JWT validation
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('get-progress-hub: Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('get-progress-hub: Fetching data for user:', user.id);

    // 1. Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id_ies, semestre, nome')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.id_ies) {
      console.error('get-progress-hub: User fetch error:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get all contents for user's IES
    const { data: conteudos, error: conteudosError } = await supabaseAdmin
      .from('conteudos')
      .select('id, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
      .eq('id_ies', userData.id_ies);

    if (conteudosError) {
      console.error('get-progress-hub: Contents error:', conteudosError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contents' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get user's progress
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from('user_progress')
      .select('content_id, completed_at')
      .eq('user_id', user.id);

    if (progressError) {
      console.error('get-progress-hub: Progress error:', progressError);
    }

    // 4. Get user's calendar subjects
    const { data: calendarData } = await supabaseAdmin
      .from('calendar_subjects')
      .select('name, day_of_week')
      .eq('user_id', user.id);

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const todaySubjects = (calendarData || [])
      .filter((s: CalendarSubject) => s.day_of_week === dayOfWeek)
      .map((s: CalendarSubject) => s.name.toLowerCase());

    // Build lookup sets
    const completedIds = new Set((progressData || []).map(p => p.content_id));
    const allContents = conteudos || [];
    
    // Calculate overview
    const totalContents = allContents.length;
    const completedContents = allContents.filter(c => completedIds.has(c.id)).length;
    const percentage = totalContents > 0 ? Math.round((completedContents / totalContents) * 100) : 0;

    // Calculate progress by materia
    const materiaMap = new Map<string, { total: number; completed: number; temas: Map<string, { total: number; completed: number }> }>();
    
    for (const content of allContents) {
      const materia = content.materia || 'Geral';
      const tema = content.tema || 'Sem tema';
      
      if (!materiaMap.has(materia)) {
        materiaMap.set(materia, { total: 0, completed: 0, temas: new Map() });
      }
      
      const materiaData = materiaMap.get(materia)!;
      materiaData.total++;
      
      if (completedIds.has(content.id)) {
        materiaData.completed++;
      }
      
      if (!materiaData.temas.has(tema)) {
        materiaData.temas.set(tema, { total: 0, completed: 0 });
      }
      
      const temaData = materiaData.temas.get(tema)!;
      temaData.total++;
      
      if (completedIds.has(content.id)) {
        temaData.completed++;
      }
    }

    // Build by_materia array
    const byMateria = Array.from(materiaMap.entries()).map(([materia, data]) => ({
      materia,
      total: data.total,
      completed: data.completed,
      percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    })).sort((a, b) => a.materia.localeCompare(b.materia));

    // Build by_tema array with last activity tracking
    const byTema: Array<{ 
      materia: string; 
      tema: string; 
      total: number; 
      completed: number; 
      percentage: number;
      last_activity_at: string | null;
      days_inactive: number;
    }> = [];
    
    // Get last activity per tema
    const temaLastActivity = new Map<string, string>();
    for (const p of (progressData || [])) {
      if (!p.completed_at) continue;
      const content = allContents.find(c => c.id === p.content_id);
      if (!content) continue;
      
      const temaKey = `${content.materia}::${content.tema || 'Sem tema'}`;
      const existingDate = temaLastActivity.get(temaKey);
      if (!existingDate || new Date(p.completed_at) > new Date(existingDate)) {
        temaLastActivity.set(temaKey, p.completed_at);
      }
    }
    
    for (const [materia, data] of materiaMap.entries()) {
      for (const [tema, temaData] of data.temas.entries()) {
        const temaKey = `${materia}::${tema}`;
        const lastActivityAt = temaLastActivity.get(temaKey) || null;
        
        let daysInactive = 999;
        if (lastActivityAt) {
          const lastDate = new Date(lastActivityAt);
          daysInactive = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (temaData.completed > 0) {
          daysInactive = 0;
        }
        
        byTema.push({
          materia,
          tema,
          total: temaData.total,
          completed: temaData.completed,
          percentage: temaData.total > 0 ? Math.round((temaData.completed / temaData.total) * 100) : 0,
          last_activity_at: lastActivityAt,
          days_inactive: daysInactive
        });
      }
    }
    byTema.sort((a, b) => a.materia.localeCompare(b.materia) || a.tema.localeCompare(b.tema));
    
    // Build risk alerts (temas with no activity in 14+ days and < 80% complete)
    const riskAlerts = byTema
      .filter(t => t.days_inactive >= 14 && t.percentage < 80 && t.percentage > 0)
      .sort((a, b) => b.days_inactive - a.days_inactive)
      .slice(0, 5)
      .map(t => ({
        id: `risk_${t.materia}_${t.tema}`.replace(/\s+/g, '_').toLowerCase(),
        materia: t.materia,
        tema: t.tema,
        days_inactive: t.days_inactive,
        percentage: t.percentage
      }));

    // Calculate weekly evolution (last 8 weeks)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    
    const weeklyMap = new Map<string, number>();
    for (const p of (progressData || [])) {
      if (!p.completed_at) continue;
      const date = new Date(p.completed_at);
      if (date < eightWeeksAgo) continue;
      
      // Get week start (Monday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + 1);
    }
    
    const weeklyEvolution = Array.from(weeklyMap.entries())
      .map(([week_start, completed_count]) => ({ week_start, completed_count }))
      .sort((a, b) => b.week_start.localeCompare(a.week_start));

    // Calculate streak
    const activityDates = new Set<string>();
    for (const p of (progressData || [])) {
      if (!p.completed_at) continue;
      const date = new Date(p.completed_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (date >= thirtyDaysAgo) {
        activityDates.add(date.toISOString().split('T')[0]);
      }
    }
    
    // Calculate current streak
    let currentStreak = 0;
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    
    if (activityDates.has(todayStr) || activityDates.has(yesterdayStr)) {
      let checkDate = activityDates.has(todayStr) ? today : new Date(today.getTime() - 86400000);
      
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (activityDates.has(dateStr)) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        } else {
          break;
        }
      }
    }
    
    // Active days this week
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    let activeDaysThisWeek = 0;
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart.getTime() + i * 86400000);
      if (activityDates.has(checkDate.toISOString().split('T')[0])) {
        activeDaysThisWeek++;
      }
    }

    // Get last activity
    const sortedProgress = (progressData || [])
      .filter(p => p.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    
    let lastActivity = null;
    if (sortedProgress.length > 0) {
      const lastContentId = sortedProgress[0].content_id;
      const lastContent = allContents.find(c => c.id === lastContentId);
      if (lastContent) {
        lastActivity = {
          content_id: lastContentId,
          materia: lastContent.materia,
          tema: lastContent.tema,
          aula: lastContent.aula,
          completed_at: sortedProgress[0].completed_at
        };
      }
    }

    // Get pending contents (not completed)
    const pendingContents: PendingContent[] = allContents
      .filter(c => !completedIds.has(c.id))
      .slice(0, 50);

    // Build next actions (smart recommendations)
    const nextActions: NextAction[] = [];
    
    // Priority 1: Today's focus (from calendar)
    if (todaySubjects.length > 0) {
      for (const subjectName of todaySubjects) {
        const pending = pendingContents.find(c => 
          c.materia?.toLowerCase() === subjectName
        );
        if (pending && nextActions.length < 3) {
          nextActions.push({
            ...pending,
            reason: `Está no seu calendário de hoje`,
            priority: 1,
            type: 'today_focus'
          });
        }
      }
    }

    // Priority 2: Quick win (materia with high progress, close to completion)
    const almostComplete = byMateria
      .filter(m => m.percentage >= 70 && m.percentage < 100)
      .sort((a, b) => b.percentage - a.percentage);
    
    for (const materia of almostComplete) {
      if (nextActions.length >= 3) break;
      const pending = pendingContents.find(c => 
        c.materia === materia.materia && 
        !nextActions.some(a => a.id === c.id)
      );
      if (pending) {
        nextActions.push({
          ...pending,
          reason: `${materia.materia} está com ${materia.percentage}% - quase lá!`,
          priority: 2,
          type: 'quick_win'
        });
      }
    }

    // Priority 3: Unlock progress (materia with lowest progress)
    const lowestProgress = byMateria
      .filter(m => m.percentage < 50)
      .sort((a, b) => a.percentage - b.percentage);
    
    for (const materia of lowestProgress) {
      if (nextActions.length >= 3) break;
      const pending = pendingContents.find(c => 
        c.materia === materia.materia && 
        !nextActions.some(a => a.id === c.id)
      );
      if (pending) {
        nextActions.push({
          ...pending,
          reason: `Avance em ${materia.materia} (${materia.percentage}% concluído)`,
          priority: 3,
          type: 'unlock_progress'
        });
      }
    }

    // Fill remaining slots
    if (nextActions.length < 3) {
      for (const pending of pendingContents) {
        if (nextActions.length >= 3) break;
        if (!nextActions.some(a => a.id === pending.id)) {
          nextActions.push({
            ...pending,
            reason: 'Continue seu progresso',
            priority: 4,
            type: 'today_focus'
          });
        }
      }
    }

    // Determine status level based on percentage and streak
    let statusLevel: 'starting' | 'recovering' | 'consistent' | 'accelerating' | 'dominating';
    let statusMessage: string;
    
    if (percentage < 10) {
      statusLevel = 'starting';
      statusMessage = 'Começando a jornada';
    } else if (currentStreak === 0 && percentage < 30) {
      statusLevel = 'recovering';
      statusMessage = 'Hora de retomar';
    } else if (currentStreak >= 3 && percentage >= 70) {
      statusLevel = 'dominating';
      statusMessage = 'Dominando o semestre';
    } else if (currentStreak >= 2 || percentage >= 50) {
      statusLevel = 'consistent';
      statusMessage = 'Você está consistente';
    } else {
      statusLevel = 'accelerating';
      statusMessage = 'Acelerando';
    }

    const response = {
      overview: {
        total: totalContents,
        completed: completedContents,
        percentage,
        total_materias: materiaMap.size,
        total_temas: byTema.length,
        status_level: statusLevel,
        status_message: statusMessage
      },
      streak: {
        current: currentStreak,
        active_days_week: activeDaysThisWeek,
        goal: 3 // Default goal, can be made configurable later
      },
      by_materia: byMateria,
      by_tema: byTema,
      weekly_evolution: weeklyEvolution,
      last_activity: lastActivity,
      next_actions: nextActions,
      risk_alerts: riskAlerts,
      today_subjects: todaySubjects,
      user: {
        nome: userData.nome,
        semestre: userData.semestre,
        streak_goal: 3 // Default, can be stored in user preferences
      }
    };

    console.log('get-progress-hub: Success - returning data');

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-progress-hub: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
