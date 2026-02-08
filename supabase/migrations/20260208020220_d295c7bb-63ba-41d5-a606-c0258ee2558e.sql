-- ============================================
-- TABELA: user_progress_nodes
-- Suporta conclusão em múltiplos níveis da hierarquia de conteúdos
-- ============================================

-- Criar enum para tipos de nó
CREATE TYPE public.progress_node_type AS ENUM ('aula', 'subtema', 'tema', 'materia');

-- Criar enum para fonte da conclusão
CREATE TYPE public.progress_source AS ENUM ('manual', 'bulk', 'auto');

-- Criar tabela principal
CREATE TABLE public.user_progress_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    node_type progress_node_type NOT NULL,
    node_id TEXT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    source progress_source NOT NULL DEFAULT 'manual',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Constraint única: um usuário só pode ter um registro por nó
    CONSTRAINT unique_user_node UNIQUE (user_id, node_type, node_id)
);

-- Índices para performance
CREATE INDEX idx_user_progress_nodes_user_id ON public.user_progress_nodes(user_id);
CREATE INDEX idx_user_progress_nodes_node_type ON public.user_progress_nodes(node_type);
CREATE INDEX idx_user_progress_nodes_completed_at ON public.user_progress_nodes(completed_at DESC);
CREATE INDEX idx_user_progress_nodes_lookup ON public.user_progress_nodes(user_id, node_type, node_id);

-- Habilitar RLS
ALTER TABLE public.user_progress_nodes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own progress nodes"
ON public.user_progress_nodes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress nodes"
ON public.user_progress_nodes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress nodes"
ON public.user_progress_nodes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress nodes"
ON public.user_progress_nodes
FOR DELETE
USING (auth.uid() = user_id);

-- Política para admins poderem ver todos (para analytics)
CREATE POLICY "Admins can view all progress nodes"
ON public.user_progress_nodes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RPC: Marcar tema como concluído (batch)
-- Marca todas as aulas do tema + cria registro do tema
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_theme(
    p_materia TEXT,
    p_tema TEXT,
    p_subtema TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_ies_id UUID;
    v_semestre INTEGER;
    v_aulas_count INTEGER;
    v_node_id TEXT;
BEGIN
    -- Obter dados do usuário
    v_user_id := auth.uid();
    
    SELECT id_ies, semestre INTO v_ies_id, v_semestre
    FROM public.users
    WHERE id = v_user_id;
    
    IF v_ies_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Construir node_id baseado no nível
    IF p_subtema IS NOT NULL THEN
        v_node_id := p_materia || '::' || p_tema || '::' || p_subtema;
    ELSE
        v_node_id := p_materia || '::' || p_tema;
    END IF;
    
    -- Buscar todas as aulas do tema/subtema
    WITH aulas AS (
        SELECT id
        FROM public.conteudos
        WHERE id_ies = v_ies_id
          AND materia = p_materia
          AND tema = p_tema
          AND (p_subtema IS NULL OR subtema = p_subtema)
    )
    -- Inserir progresso para cada aula (ignorar duplicatas)
    INSERT INTO public.user_progress (user_id, content_id)
    SELECT v_user_id, id FROM aulas
    ON CONFLICT (user_id, content_id) DO NOTHING;
    
    GET DIAGNOSTICS v_aulas_count = ROW_COUNT;
    
    -- Registrar o nó do tema como concluído
    INSERT INTO public.user_progress_nodes (
        user_id, 
        node_type, 
        node_id, 
        source,
        metadata
    )
    VALUES (
        v_user_id,
        CASE WHEN p_subtema IS NOT NULL THEN 'subtema'::progress_node_type ELSE 'tema'::progress_node_type END,
        v_node_id,
        'bulk',
        json_build_object(
            'materia', p_materia,
            'tema', p_tema,
            'subtema', p_subtema,
            'aulas_marcadas', v_aulas_count
        )
    )
    ON CONFLICT (user_id, node_type, node_id) 
    DO UPDATE SET 
        completed_at = now(),
        metadata = EXCLUDED.metadata;
    
    RETURN json_build_object(
        'success', true, 
        'aulas_completed', v_aulas_count,
        'node_id', v_node_id
    );
END;
$$;

-- ============================================
-- RPC: Desfazer conclusão de tema
-- Remove o registro do tema + todas as aulas dele
-- ============================================
CREATE OR REPLACE FUNCTION public.uncomplete_theme(
    p_materia TEXT,
    p_tema TEXT,
    p_subtema TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_ies_id UUID;
    v_aulas_count INTEGER;
    v_node_id TEXT;
BEGIN
    v_user_id := auth.uid();
    
    SELECT id_ies INTO v_ies_id
    FROM public.users
    WHERE id = v_user_id;
    
    IF v_ies_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Construir node_id
    IF p_subtema IS NOT NULL THEN
        v_node_id := p_materia || '::' || p_tema || '::' || p_subtema;
    ELSE
        v_node_id := p_materia || '::' || p_tema;
    END IF;
    
    -- Remover progresso das aulas do tema
    WITH aulas AS (
        SELECT id
        FROM public.conteudos
        WHERE id_ies = v_ies_id
          AND materia = p_materia
          AND tema = p_tema
          AND (p_subtema IS NULL OR subtema = p_subtema)
    )
    DELETE FROM public.user_progress
    WHERE user_id = v_user_id
      AND content_id IN (SELECT id FROM aulas);
    
    GET DIAGNOSTICS v_aulas_count = ROW_COUNT;
    
    -- Remover registro do nó
    DELETE FROM public.user_progress_nodes
    WHERE user_id = v_user_id
      AND node_id = v_node_id;
    
    RETURN json_build_object(
        'success', true, 
        'aulas_removed', v_aulas_count,
        'node_id', v_node_id
    );
END;
$$;

-- ============================================
-- RPC: Obter resumo de progresso do hub
-- Agregações otimizadas para a Central de Progresso
-- ============================================
CREATE OR REPLACE FUNCTION public.get_progress_hub_summary()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_ies_id UUID;
    v_semestre INTEGER;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    
    SELECT id_ies, semestre INTO v_ies_id, v_semestre
    FROM public.users
    WHERE id = v_user_id;
    
    IF v_ies_id IS NULL THEN
        RETURN json_build_object('error', 'User not found');
    END IF;
    
    WITH 
    -- Total de conteúdos disponíveis
    total_contents AS (
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT materia) as total_materias,
            COUNT(DISTINCT tema) FILTER (WHERE tema IS NOT NULL) as total_temas
        FROM public.conteudos
        WHERE id_ies = v_ies_id
    ),
    -- Progresso do usuário
    user_progress_stats AS (
        SELECT COUNT(*) as completed
        FROM public.user_progress up
        JOIN public.conteudos c ON up.content_id = c.id
        WHERE up.user_id = v_user_id
          AND c.id_ies = v_ies_id
    ),
    -- Progresso por matéria
    progress_by_materia AS (
        SELECT 
            c.materia,
            COUNT(*) as total,
            COUNT(up.content_id) as completed,
            ROUND(COUNT(up.content_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100) as percentage
        FROM public.conteudos c
        LEFT JOIN public.user_progress up 
            ON c.id = up.content_id AND up.user_id = v_user_id
        WHERE c.id_ies = v_ies_id
        GROUP BY c.materia
        ORDER BY c.materia
    ),
    -- Progresso por tema (dentro de cada matéria)
    progress_by_tema AS (
        SELECT 
            c.materia,
            c.tema,
            COUNT(*) as total,
            COUNT(up.content_id) as completed,
            ROUND(COUNT(up.content_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100) as percentage
        FROM public.conteudos c
        LEFT JOIN public.user_progress up 
            ON c.id = up.content_id AND up.user_id = v_user_id
        WHERE c.id_ies = v_ies_id
          AND c.tema IS NOT NULL
        GROUP BY c.materia, c.tema
        ORDER BY c.materia, c.tema
    ),
    -- Evolução semanal (últimas 8 semanas)
    weekly_evolution AS (
        SELECT 
            DATE_TRUNC('week', up.completed_at) as week_start,
            COUNT(*) as completed_count
        FROM public.user_progress up
        JOIN public.conteudos c ON up.content_id = c.id
        WHERE up.user_id = v_user_id
          AND c.id_ies = v_ies_id
          AND up.completed_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', up.completed_at)
        ORDER BY week_start DESC
    ),
    -- Streak: dias consecutivos com atividade
    daily_activity AS (
        SELECT DISTINCT DATE(up.completed_at) as activity_date
        FROM public.user_progress up
        JOIN public.conteudos c ON up.content_id = c.id
        WHERE up.user_id = v_user_id
          AND c.id_ies = v_ies_id
          AND up.completed_at >= NOW() - INTERVAL '30 days'
        ORDER BY activity_date DESC
    ),
    -- Calcular streak atual
    streak_calc AS (
        SELECT 
            COALESCE(
                (
                    SELECT COUNT(*)
                    FROM (
                        SELECT activity_date,
                               activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::INTEGER as grp
                        FROM daily_activity
                        WHERE activity_date >= CURRENT_DATE - 7
                    ) sub
                    WHERE grp = (
                        SELECT activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::INTEGER
                        FROM daily_activity
                        WHERE activity_date = CURRENT_DATE OR activity_date = CURRENT_DATE - 1
                        LIMIT 1
                    )
                ),
                0
            ) as current_streak,
            (SELECT COUNT(*) FROM daily_activity WHERE activity_date >= CURRENT_DATE - 7) as active_days_this_week
    ),
    -- Última atividade
    last_activity AS (
        SELECT 
            up.content_id,
            c.materia,
            c.tema,
            c.aula,
            up.completed_at
        FROM public.user_progress up
        JOIN public.conteudos c ON up.content_id = c.id
        WHERE up.user_id = v_user_id
          AND c.id_ies = v_ies_id
        ORDER BY up.completed_at DESC
        LIMIT 1
    ),
    -- Próximas sugestões (conteúdos não concluídos)
    pending_content AS (
        SELECT 
            c.id,
            c.materia,
            c.tema,
            c.subtema,
            c.aula,
            c.link_aula,
            c.link_pdf,
            c.link_quiz
        FROM public.conteudos c
        LEFT JOIN public.user_progress up 
            ON c.id = up.content_id AND up.user_id = v_user_id
        WHERE c.id_ies = v_ies_id
          AND up.content_id IS NULL
        LIMIT 50
    )
    SELECT json_build_object(
        'overview', json_build_object(
            'total', (SELECT total FROM total_contents),
            'completed', (SELECT completed FROM user_progress_stats),
            'percentage', ROUND((SELECT completed FROM user_progress_stats)::NUMERIC / NULLIF((SELECT total FROM total_contents), 0) * 100),
            'total_materias', (SELECT total_materias FROM total_contents),
            'total_temas', (SELECT total_temas FROM total_contents)
        ),
        'streak', json_build_object(
            'current', (SELECT current_streak FROM streak_calc),
            'active_days_week', (SELECT active_days_this_week FROM streak_calc),
            'goal', 3
        ),
        'by_materia', (SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM progress_by_materia m),
        'by_tema', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM progress_by_tema t),
        'weekly_evolution', (SELECT COALESCE(json_agg(row_to_json(w)), '[]'::json) FROM weekly_evolution w),
        'last_activity', (SELECT row_to_json(la) FROM last_activity la),
        'pending_sample', (SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json) FROM pending_content p)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;