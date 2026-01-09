-- Habilitar REPLICA IDENTITY FULL para capturar dados completos
ALTER TABLE aula_views REPLICA IDENTITY FULL;
ALTER TABLE simulados_finalizados REPLICA IDENTITY FULL;
ALTER TABLE study_progress REPLICA IDENTITY FULL;

-- Adicionar apenas tabelas que ainda não estão na publicação
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'aula_views'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE aula_views;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'simulados_finalizados'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE simulados_finalizados;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'study_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE study_progress;
    END IF;
END $$;