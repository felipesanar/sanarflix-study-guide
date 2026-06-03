-- Canoniza o formato de `semestre` em `conteudos` para "Nº Semestre"
-- Apenas linhas em CAIXA ALTA do padrão "N° SEMESTRE" são afetadas (aditivo, sem perda de dados).
UPDATE public.conteudos
SET semestre = regexp_replace(trim(semestre), '^(\d+)º\s+SEMESTRE$', '\1º Semestre')
WHERE trim(semestre) ~ '^\d+º\s+SEMESTRE$';