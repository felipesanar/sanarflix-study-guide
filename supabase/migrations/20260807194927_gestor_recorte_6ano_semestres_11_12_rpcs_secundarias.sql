-- Reconstruído a partir de supabase_migrations.schema_migrations em produção
-- (gvqvrmkizemwsasmupmo) em 2026-08-08, durante sincronização de drift banco↔repo.
-- Este arquivo nunca existiu no working tree local; a migration foi aplicada
-- direto em produção (provavelmente via Lovable) sem passar pelo Git.
--
-- PARTE A de 20260807200000_gestor_recorte_6ano_e_conceito_geral.sql
--
-- O segmento "6º ano (Padrão)" nunca filtrou nada: nas RPCs que recebem
-- p_semestre o ramo era 'v_sems := NULL' -- 11º/12º entravam so como EVIDENCIA
-- visual no grafico (v_evid), sem tocar em nenhuma conta. Efeito pratico:
-- "6º ano (Padrão)" e "Geral" devolviam numeros IDENTICOS.
--
-- Aqui corrigimos as QUATRO RPCs secundarias. A get_gestor_visao_geral vem na
-- Parte B (corpo inteiro, porque nela a mudanca nao e de uma linha).
--
-- POR QUE PATCH TEXTUAL E NAO CREATE OR REPLACE: cada uma destas muda UMA
-- linha. Recolar o corpo inteiro das quatro e o acidente que o cabecalho de
-- 20260807040000_get_gestor_visao_geral_criterio_negocio.sql documenta -- uma
-- migration nascida de base desatualizada reverte, em silencio, o que outra
-- tinha mudado no meio. O Lovable empurra codigo para producao varias vezes ao
-- dia, entao "a base certa" e alvo movel. O DO abaixo le a definicao VIVA,
-- troca a linha exata e reexecuta: o resto do corpo continua byte a byte o que
-- ja estava em producao. E ABORTA se o alvo nao aparecer exatamente uma vez.
DO $patch$
DECLARE
  v_fn      text;
  v_oid     oid;
  v_qtd     int;
  v_def     text;
  v_novo    text;
  v_alvo    text;
  v_troca   text;
  v_alvos   text[] := ARRAY[
    'get_gestor_alunos',
    'get_gestor_diagnostico',
    'get_gestor_diagnostico_temas',
    'get_gestor_detalhamento'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_alvos LOOP
    -- Nenhuma das quatro tem sobrecarga hoje (conferido em 07/08), mas o
    -- SELECT INTO pegaria UMA delas em silencio se alguem criasse outra
    -- assinatura -- e o patch cairia na funcao errada. Conta antes.
    SELECT count(*), min(p.oid) INTO v_qtd, v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;

    IF v_qtd = 0 THEN
      RAISE EXCEPTION 'recorte_6ano_funcao_ausente: %', v_fn;
    END IF;
    IF v_qtd > 1 THEN
      RAISE EXCEPTION 'recorte_6ano_funcao_sobrecarregada: % (% assinaturas)', v_fn, v_qtd;
    END IF;

    v_def := pg_get_functiondef(v_oid);

    -- Duas formas convivem em producao: get_gestor_detalhamento tambem grava
    -- v_evid no mesmo ramo, as outras tres nao. Trocamos so o 'v_sems := NULL'
    -- daquele ramo e o texto do recorte; v_evid continua exatamente como esta.
    v_alvo := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
              '    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := ''todos os semestres, 11º e 12º em evidência'';';
    v_troca := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
               '    v_sems := ARRAY[11,12]; v_evid := ARRAY[11,12]; v_recorte := ''somente o 6º ano (11º e 12º semestres)'';';

    IF position(v_alvo IN v_def) = 0 THEN
      v_alvo := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
                '    v_sems := NULL; v_recorte := ''todos os semestres, 11º e 12º em evidência'';';
      v_troca := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
                 '    v_sems := ARRAY[11,12]; v_recorte := ''somente o 6º ano (11º e 12º semestres)'';';
    END IF;

    -- Exatamente UMA ocorrencia. Zero = a base mudou por baixo (nao aplicar as
    -- cegas). Duas ou mais = o ramo aparece em dois lugares e trocar os dois
    -- sem ler seria um chute.
    IF position(v_alvo IN v_def) = 0 THEN
      RAISE EXCEPTION 'recorte_6ano_alvo_nao_encontrado: %', v_fn;
    END IF;
    IF (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 THEN
      RAISE EXCEPTION 'recorte_6ano_alvo_ambiguo: %', v_fn;
    END IF;

    v_novo := replace(v_def, v_alvo, v_troca);
    IF v_novo = v_def THEN
      RAISE EXCEPTION 'recorte_6ano_patch_sem_efeito: %', v_fn;
    END IF;

    EXECUTE v_novo;
    RAISE NOTICE 'recorte 6ano corrigido em %', v_fn;
  END LOOP;
END
$patch$;
