-- ===========================================
-- TABELAS DE ANALYTICS PARA CAPTAÇÃO DE DADOS
-- ===========================================

-- 1. Tabela de eventos genéricos (base para analytics)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  event_data jsonb DEFAULT '{}',
  page_path text,
  session_id text,
  ies_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para queries de analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ies_id ON public.analytics_events(ies_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON public.analytics_events(event_category);

-- Habilitar RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies: usuários podem inserir seus próprios eventos, admins podem ver todos
CREATE POLICY "Users can insert their own events" ON public.analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own events" ON public.analytics_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all events" ON public.analytics_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Tabela de sessões de usuário
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  pages_visited integer DEFAULT 0,
  ies_id uuid,
  user_agent text,
  is_mobile boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ies_id ON public.user_sessions(ies_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Tabela de início de simulados (preenche gap identificado)
CREATE TABLE IF NOT EXISTS public.simulados_iniciados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, simulado_id)
);

CREATE INDEX IF NOT EXISTS idx_simulados_iniciados_user_id ON public.simulados_iniciados(user_id);
CREATE INDEX IF NOT EXISTS idx_simulados_iniciados_simulado_id ON public.simulados_iniciados(simulado_id);
CREATE INDEX IF NOT EXISTS idx_simulados_iniciados_started_at ON public.simulados_iniciados(started_at DESC);

ALTER TABLE public.simulados_iniciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own started simulados" ON public.simulados_iniciados
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own started simulados" ON public.simulados_iniciados
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all started simulados" ON public.simulados_iniciados
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Tabela de views e downloads do SanarClass
CREATE TABLE IF NOT EXISTS public.sanarclass_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.sanarclass_lessons(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('view', 'download')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sanarclass_views_user_id ON public.sanarclass_views(user_id);
CREATE INDEX IF NOT EXISTS idx_sanarclass_views_lesson_id ON public.sanarclass_views(lesson_id);
CREATE INDEX IF NOT EXISTS idx_sanarclass_views_created_at ON public.sanarclass_views(created_at DESC);

ALTER TABLE public.sanarclass_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own views" ON public.sanarclass_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own views" ON public.sanarclass_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all views" ON public.sanarclass_views
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Tabela de page views para tracking de navegação
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  page_title text,
  referrer text,
  session_id text,
  time_on_page_seconds integer,
  ies_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON public.page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON public.page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_ies_id ON public.page_views(ies_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert page views" ON public.page_views
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own page views" ON public.page_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all page views" ON public.page_views
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Habilitar Realtime para tabelas de analytics
ALTER TABLE public.analytics_events REPLICA IDENTITY FULL;
ALTER TABLE public.simulados_iniciados REPLICA IDENTITY FULL;
ALTER TABLE public.sanarclass_views REPLICA IDENTITY FULL;
ALTER TABLE public.page_views REPLICA IDENTITY FULL;
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;