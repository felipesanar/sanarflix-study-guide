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

    // Admin client (service role can validate any JWT without session)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate JWT using admin client
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      console.error('get-progress-hub: Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = { id: authUser.id };

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

    // 2. Get contents for user's IES - SEMESTER SCOPED
    // CRITICAL: The Progress Dashboard must only consider content from the student's current semester
    const userSemestre = userData.semestre;
    const INTERNATO_FALLBACK_SEMESTERS = [9, 10, 11, 12];
    const shouldTryInternato = userSemestre && INTERNATO_FALLBACK_SEMESTERS.includes(userSemestre);
    
    if (!userSemestre) {
      console.warn('get-progress-hub: User has no semester defined, using fallback');
    }
    
    // Build query - filter by semester if available
    let conteudosQuery = supabaseAdmin
      .from('conteudos')
      .select('id, materia, tema, subtema, aula, semestre, link_aula, link_pdf, link_quiz')
      .eq('id_ies', userData.id_ies);
    
    // SEMESTER FILTER: Only fetch content from user's semester
    if (userSemestre) {
      conteudosQuery = conteudosQuery.eq('semestre', String(userSemestre));
    }
    
    let { data: conteudos, error: conteudosError } = await conteudosQuery;

    if (conteudosError) {
      console.error('get-progress-hub: Contents error:', conteudosError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contents' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INTERNATO FALLBACK: If semesters 9-12 returned no content, try INTERNATO
    let effectiveSemestre: number | string | null = userSemestre;
    if (!conteudosError && (!conteudos || conteudos.length === 0) && shouldTryInternato) {
      console.log(`get-progress-hub: No content for semester ${userSemestre}, falling back to INTERNATO`);
      
      const { data: internatoConteudos, error: internatoError } = await supabaseAdmin
        .from('conteudos')
        .select('id, materia, tema, subtema, aula, semestre, link_aula, link_pdf, link_quiz')
        .eq('id_ies', userData.id_ies)
        .eq('semestre', 'INTERNATO');
      
      if (!internatoError && internatoConteudos && internatoConteudos.length > 0) {
        conteudos = internatoConteudos;
        effectiveSemestre = 'INTERNATO';
        console.log(`get-progress-hub: INTERNATO fallback found ${internatoConteudos.length} contents`);
      }
    }
    
    console.log(`get-progress-hub: Fetched ${conteudos?.length || 0} contents for semester ${effectiveSemestre || 'ALL'}`);
    
    // Handle empty state - no contents for semester
    if (!conteudos || conteudos.length === 0) {
      console.log('get-progress-hub: No contents found for semester, returning empty state');
      return new Response(
        JSON.stringify({
          overview: {
            total: 0,
            completed: 0,
            percentage: 0,
            total_materias: 0,
            total_temas: 0,
            status_level: 'starting',
            status_message: 'Sem conteúdos para seu semestre'
          },
          streak: { current: 0, active_days_week: 0, active_days_of_week: [], goal: 3 },
          by_materia: [],
          by_tema: [],
          by_subtema: [],
          weekly_evolution: [],
          last_activity: null,
          next_actions: [],
          risk_alerts: [],
          today_subjects: [],
          user: {
            nome: userData.nome,
            semestre: userSemestre,
            effective_semestre: String(effectiveSemestre || userSemestre),
            semestre_warning: !userSemestre ? 'Semestre não definido' : null,
            streak_goal: 3
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get user's progress from BOTH tables (legacy user_progress + new study_progress)
    // This ensures we catch progress from both the old and new systems
    const [legacyProgressResult, studyProgressResult] = await Promise.all([
      supabaseAdmin
        .from('user_progress')
        .select('content_id, completed_at')
        .eq('user_id', user.id),
      supabaseAdmin
        .from('study_progress')
        .select('content_id, completed_at, semestre')
        .eq('user_id', user.id)
        .eq('completed', true)
    ]);

    if (legacyProgressResult.error) {
      console.error('get-progress-hub: Legacy progress error:', legacyProgressResult.error);
    }
    if (studyProgressResult.error) {
      console.error('get-progress-hub: Study progress error:', studyProgressResult.error);
    }

    // Merge both progress sources - SEMESTER SCOPED
    const legacyProgress = legacyProgressResult.data || [];
    const studyProgress = studyProgressResult.data || [];
    
    // Build a Set of valid content IDs from the semester (for cross-referencing)
    const validContentIds = new Set(conteudos.map(c => c.id));
    
    // Helper function to generate composite ID matching the Study Guide format
    // Defined early so it can be used in progress filtering
    const getCompositeId = (content: { materia?: string; tema?: string | null; subtema?: string | null; aula?: string | null }, semestre: number | string): string => {
      const parts = [
        String(semestre),
        content.materia || '',
        content.tema || '',
        content.subtema || '',
        content.aula || ''
      ];
      return parts.join('-');
    };
    const extractSemestreFromContentId = (contentId: string): string | null => {
      if (!contentId) return null;
      // Check for INTERNATO prefix
      if (contentId.startsWith('INTERNATO-')) {
        return 'INTERNATO';
      }
      const parts = contentId.split('-');
      if (parts.length >= 1) {
        const firstPart = parseInt(parts[0], 10);
        if (!isNaN(firstPart) && firstPart >= 1 && firstPart <= 12) {
          return String(firstPart);
        }
      }
      return null;
    };
    
    // Filter function to check if progress belongs to active semester
    const isProgressFromSemester = (contentId: string): boolean => {
      // Method 1: Check if content_id is a valid UUID from the semester contents
      if (validContentIds.has(contentId)) return true;
      
      // Method 2: Extract semester from composite content_id
      if (effectiveSemestre) {
        const extractedSemestre = extractSemestreFromContentId(contentId);
        if (extractedSemestre !== null) {
          return extractedSemestre === String(effectiveSemestre);
        }
      }
      
      // Method 3: If content_id matches composite format for any semester content
      for (const content of conteudos) {
        const compositeId = getCompositeId(content, effectiveSemestre || 1);
        if (compositeId === contentId) return true;
      }
      
      return false;
    };
    
    // Build a map of content_id to completed_at from both sources - FILTERED BY SEMESTER
    const progressMap = new Map<string, string>();
    
    // Add legacy progress - only if content belongs to semester
    for (const p of legacyProgress) {
      if (p.completed_at && isProgressFromSemester(p.content_id)) {
        progressMap.set(p.content_id, p.completed_at);
      }
    }
    
    // Add study_progress - filter by semester field or content_id
    for (const p of studyProgress) {
      if (!p.completed_at) continue;
      
      // First check explicit semester field
      // For INTERNATO fallback, accept progress from semesters 9-12 as well as INTERNATO composite IDs
      const numericSemestre = typeof effectiveSemestre === 'number' ? effectiveSemestre : userSemestre;
      if (numericSemestre && p.semestre && p.semestre !== numericSemestre) {
        // If using INTERNATO fallback, also accept progress from the user's original numeric semester
        if (effectiveSemestre !== 'INTERNATO' || !INTERNATO_FALLBACK_SEMESTERS.includes(p.semestre)) {
          continue; // Skip progress from other semesters
        }
      }
      
      // Then check content_id
      if (!isProgressFromSemester(p.content_id)) {
        continue;
      }
      
      const existing = progressMap.get(p.content_id);
      if (!existing || new Date(p.completed_at) > new Date(existing)) {
        progressMap.set(p.content_id, p.completed_at);
      }
    }
    
    // Convert to array format for compatibility with existing code
    const progressData = Array.from(progressMap.entries()).map(([content_id, completed_at]) => ({
      content_id,
      completed_at
    }));
    
    console.log(`get-progress-hub: Semester ${userSemestre} - Found ${progressData.length} progress items (filtered from ${legacyProgress.length} legacy + ${studyProgress.length} study)`);

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

    // Build lookup sets - now we need to match both by UUID and composite ID
    const completedIdsSet = new Set((progressData || []).map(p => p.content_id));
    const allContents = conteudos || [];
    
    // Note: getCompositeId already defined above for progress filtering
    
    // Helper to check if content is completed (by UUID or composite ID)
    const isContentCompleted = (content: typeof allContents[0]): boolean => {
      // Check by UUID (legacy user_progress)
      if (completedIdsSet.has(content.id)) return true;
      
      // Check by composite ID (study_progress format)
      const compositeId = getCompositeId(content, effectiveSemestre || 1);
      if (completedIdsSet.has(compositeId)) return true;
      
      return false;
    };
    
    // Get completed_at for a content (checking both formats)
    const getCompletedAt = (content: typeof allContents[0]): string | null => {
      // Check by UUID first
      const byUUID = progressData.find(p => p.content_id === content.id);
      if (byUUID) return byUUID.completed_at;
      
      // Check by composite ID
      const compositeId = getCompositeId(content, effectiveSemestre || 1);
      const byComposite = progressData.find(p => p.content_id === compositeId);
      if (byComposite) return byComposite.completed_at;
      
      return null;
    };
    
    // Calculate overview
    const totalContents = allContents.length;
    const completedContents = allContents.filter(c => isContentCompleted(c)).length;
    const percentage = totalContents > 0 ? Math.round((completedContents / totalContents) * 100) : 0;
    
    console.log(`get-progress-hub: Total contents: ${totalContents}, Completed: ${completedContents}, Percentage: ${percentage}%`);

    // Calculate progress by materia, tema, and subtema
    const materiaMap = new Map<string, { 
      total: number; 
      completed: number; 
      temas: Map<string, { 
        total: number; 
        completed: number;
        subtemas: Map<string, { total: number; completed: number }>;
      }> 
    }>();
    
    for (const content of allContents) {
      const materia = content.materia || 'Geral';
      const tema = content.tema || 'Sem tema';
      const subtema = content.subtema || '';
      
      if (!materiaMap.has(materia)) {
        materiaMap.set(materia, { total: 0, completed: 0, temas: new Map() });
      }
      
      const materiaData = materiaMap.get(materia)!;
      materiaData.total++;
      
      if (isContentCompleted(content)) {
        materiaData.completed++;
      }
      
      if (!materiaData.temas.has(tema)) {
        materiaData.temas.set(tema, { total: 0, completed: 0, subtemas: new Map() });
      }
      
      const temaData = materiaData.temas.get(tema)!;
      temaData.total++;
      
      if (isContentCompleted(content)) {
        temaData.completed++;
      }
      
      // Track subtema if exists
      if (subtema) {
        if (!temaData.subtemas.has(subtema)) {
          temaData.subtemas.set(subtema, { total: 0, completed: 0 });
        }
        const subtemaData = temaData.subtemas.get(subtema)!;
        subtemaData.total++;
        if (isContentCompleted(content)) {
          subtemaData.completed++;
        }
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
    
    // Get last activity per tema - need to match both UUID and composite ID formats
    const temaLastActivity = new Map<string, string>();
    for (const p of (progressData || [])) {
      if (!p.completed_at) continue;
      
      // Try to find content by UUID first
      let content = allContents.find(c => c.id === p.content_id);
      
      // If not found, try matching by composite ID
      if (!content) {
        content = allContents.find(c => {
          const compositeId = getCompositeId(c, effectiveSemestre || 1);
          return compositeId === p.content_id;
        });
      }
      
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
    
    // Build by_subtema array
    const bySubtema: Array<{ 
      materia: string; 
      tema: string; 
      subtema: string;
      total: number; 
      completed: number; 
      percentage: number;
    }> = [];
    
    for (const [materia, data] of materiaMap.entries()) {
      for (const [tema, temaData] of data.temas.entries()) {
        for (const [subtema, subtemaData] of temaData.subtemas.entries()) {
          bySubtema.push({
            materia,
            tema,
            subtema,
            total: subtemaData.total,
            completed: subtemaData.completed,
            percentage: subtemaData.total > 0 ? Math.round((subtemaData.completed / subtemaData.total) * 100) : 0
          });
        }
      }
    }
    bySubtema.sort((a, b) => 
      a.materia.localeCompare(b.materia) || 
      a.tema.localeCompare(b.tema) || 
      a.subtema.localeCompare(b.subtema)
    );
    
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
    
    // Active days this week (Sunday = 0, Monday = 1, etc.)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start from Sunday
    let activeDaysThisWeek = 0;
    const activeDaysOfWeek: number[] = []; // Array with specific day indices (0=Sun, 1=Mon, etc.)
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart.getTime() + i * 86400000);
      if (activityDates.has(checkDate.toISOString().split('T')[0])) {
        activeDaysThisWeek++;
        activeDaysOfWeek.push(i); // Store the day index
      }
    }

    // Get last activity
    const sortedProgress = (progressData || [])
      .filter(p => p.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    
    let lastActivity = null;
    if (sortedProgress.length > 0) {
      const lastContentId = sortedProgress[0].content_id;
      
      // Try to find content by UUID first, then by composite ID
      let lastContent = allContents.find(c => c.id === lastContentId);
      if (!lastContent) {
        lastContent = allContents.find(c => {
          const compositeId = getCompositeId(c, effectiveSemestre || 1);
          return compositeId === lastContentId;
        });
      }
      
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
      .filter(c => !isContentCompleted(c))
      .slice(0, 50);

    // Build next actions (smart recommendations)
    // Estimated minutes: quick_win = 10, today_focus = 15, unlock_progress = 20
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
            type: 'today_focus',
            estimated_minutes: 15
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
          type: 'quick_win',
          estimated_minutes: 10
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
          type: 'unlock_progress',
          estimated_minutes: 20
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
            type: 'today_focus',
            estimated_minutes: 15
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
        active_days_of_week: activeDaysOfWeek, // Specific day indices [0=Sun, 1=Mon, ...]
        goal: 3 // Default goal, can be made configurable later
      },
      by_materia: byMateria,
      by_tema: byTema,
      by_subtema: bySubtema,
      weekly_evolution: weeklyEvolution,
      last_activity: lastActivity,
      next_actions: nextActions,
      risk_alerts: riskAlerts,
      today_subjects: todaySubjects,
      user: {
        nome: userData.nome,
        semestre: userSemestre,
        effective_semestre: String(effectiveSemestre || userSemestre),
        semestre_warning: !userSemestre ? 'Semestre não definido para o usuário' : null,
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
