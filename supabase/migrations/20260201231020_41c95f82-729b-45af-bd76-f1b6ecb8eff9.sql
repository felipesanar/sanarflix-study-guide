-- Tabela para rastrear notificações de desempenho já enviadas
CREATE TABLE IF NOT EXISTS public.performance_notifications_sent (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, simulado_id)
);

-- Habilitar RLS
ALTER TABLE public.performance_notifications_sent ENABLE ROW LEVEL SECURITY;

-- Política: Apenas service_role pode gerenciar (usado pela edge function)
CREATE POLICY "Service role pode gerenciar notificações"
ON public.performance_notifications_sent
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Índice para busca rápida
CREATE INDEX idx_performance_notifications_user_simulado 
ON public.performance_notifications_sent(user_id, simulado_id);