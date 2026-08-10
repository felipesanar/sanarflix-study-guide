-- A versão nova (com p_semestre) coexistia com a antiga de 4 argumentos, o que
-- torna a chamada com 4 parâmetros ambígua. Só a nova permanece.
DROP FUNCTION IF EXISTS public.get_gestor_detalhamento_temas(uuid, uuid[], text, text);