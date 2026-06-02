-- 1) Normalização dos dados existentes (apenas UPDATE — aditivo)
UPDATE public.questoes_simulado
SET grande_area = trim(grande_area)
WHERE grande_area IS NOT NULL
  AND grande_area <> trim(grande_area);

UPDATE public.questoes_simulado
SET grande_area = 'Ginecologia e Obstetrícia'
WHERE trim(grande_area) = 'Ginecologia';

UPDATE public.questoes_simulado
SET grande_area = 'Preventiva'
WHERE trim(grande_area) IN ('Medicina Preventiva', 'Medicina Preventiva/Saúde Coletiva');

-- 2) Função canônica reutilizável
CREATE OR REPLACE FUNCTION public.normalize_grande_area(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN trim(raw) = '' THEN NULL
    WHEN trim(raw) = 'Ginecologia' THEN 'Ginecologia e Obstetrícia'
    WHEN trim(raw) IN ('Medicina Preventiva', 'Medicina Preventiva/Saúde Coletiva') THEN 'Preventiva'
    ELSE trim(raw)
  END;
$$;

-- 3) Trigger para impedir regressão em importações futuras
CREATE OR REPLACE FUNCTION public.tg_normalize_questoes_grande_area()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.grande_area := public.normalize_grande_area(NEW.grande_area);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_grande_area ON public.questoes_simulado;

CREATE TRIGGER trg_normalize_grande_area
BEFORE INSERT OR UPDATE OF grande_area ON public.questoes_simulado
FOR EACH ROW
EXECUTE FUNCTION public.tg_normalize_questoes_grande_area();