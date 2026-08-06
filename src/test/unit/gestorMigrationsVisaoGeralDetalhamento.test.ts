/**
 * Testes estáticos das migrations dos achados 2/5/8/9 (get_gestor_visao_geral)
 * e 2/8/14 (get_gestor_detalhamento) da revisão adversarial de 03/08.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — não dá para rodar as funções de
 * verdade aqui. Este arquivo faz o possível sem banco: lê o texto-fonte da
 * migration e verifica, por padrão, que o bug documentado foi removido e que
 * a correção esperada está presente. Não substitui o passo manual descrito
 * no rodapé de cada migration (pg_get_functiondef + teste funcional em
 * transação revertida, rodado em gvqv antes de aplicar).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa máquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as asserções abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf)
  // para a camada complementar, que só age em checkout novo.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Recorta só o bloco de código real (CREATE OR REPLACE FUNCTION … último
 * GRANT EXECUTE), excluindo o comentário de cabeçalho e o rodapé de
 * verificação. Necessário porque o cabeçalho documenta DE PROPÓSITO a
 * chamada antiga (para explicar o que foi trocado e por quê) — testar
 * "não contém mais X" contra o arquivo inteiro dispara falso-positivo nessas
 * linhas de prosa, que não são código executado.
 */
function codeOnly(body: string): string {
  const start = body.indexOf('CREATE OR REPLACE FUNCTION');
  const lastGrant = body.lastIndexOf('GRANT EXECUTE');
  const end = body.indexOf('\n', lastGrant);
  return body.slice(start, end === -1 ? body.length : end);
}

describe('migration get_gestor_visao_geral (achados 2, 5, 8 e 9)', () => {
  const FILE = '20260804130000_get_gestor_visao_geral_guard_kpi_lowsample.sql';
  const sql = () => readMigration(FILE);

  it('troca o guard de feature por user_has_feature_for_ies com v_ies (achado 2)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(code).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('checa a feature DEPOIS de resolver v_ies, nunca antes (regressão do achado 2)', () => {
    const code = codeOnly(sql());
    const idxIesResolvida = code.indexOf('IES not resolved');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxIesResolvida);
  });

  it('KPI de simulados usa slots do contrato vigente com simulado realizado, não qualquer simulado com resposta/TRI (achado 5)', () => {
    const code = codeOnly(sql());
    // numerador novo: slots do contrato, critério idêntico ao get_gestor_cronograma
    expect(code).toMatch(/kpi_slots AS \(/);
    expect(code).toMatch(/FROM public\.ies_simulado_previsto sp/);
    expect(code).toMatch(/JOIN kpi_contrato kc ON kc\.contrato_id = sp\.contrato_id/);
    expect(code).toMatch(/kpi_com_tri AS \(/);
    expect(code).toMatch(/'realizados',\s*COALESCE\(\(SELECT count\(\*\) FROM kpi_realizados\), 0\)/);
    expect(code).toMatch(/'contratados',\s*\(SELECT kc\.simulados_contratados FROM kpi_contrato kc\)/);
    // o bug original: contava qualquer simulado com resposta/TRI, sem vínculo com o contrato
    expect(code).not.toMatch(/'realizados',\s*\(SELECT count\(\*\) FROM realizados\)/);
  });

  it('numerador de proficientes é distinto por aluno, igual ao denominador n_tri (achado 8 — prof_pct não passa de 100%)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /count\(DISTINCT t\.student_id\) FILTER \(WHERE t\.score_proprio >= 60\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/,
    );
    // o bug original contava linhas de TRI (não distintas) no numerador, com denominador já distinto
    expect(code).not.toMatch(/count\(\*\) FILTER \(WHERE t\.score_proprio >= 60\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/);
  });

  it('lowSample olha só o ponto "atual", não o máximo entre todos os simulados do recorte (achado 9)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /'lowSample',\s*COALESCE\(\(SELECT GREATEST\(p\.n_tri, p\.n_resp\) FROM pontos p WHERE p\.rotulo = 'atual'\), 0\) < 10/,
    );
    expect(code).not.toMatch(/'lowSample',\s*COALESCE\(\(SELECT max\(GREATEST\(m\.n_tri, m\.n_resp\)\) FROM realizados m\), 0\) < 10/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e o grant original', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_visao_geral\(uuid, text\) TO authenticated;/);
  });
});

describe('migration get_gestor_detalhamento (achados 2, 8 e 14)', () => {
  const FILE = '20260804131000_get_gestor_detalhamento_guard_prof_gabarito.sql';
  const sql = () => readMigration(FILE);

  it('troca o guard de feature por user_has_feature_for_ies com v_ies (achado 2)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(code).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('checa a feature DEPOIS de resolver v_ies, nunca antes (regressão do achado 2)', () => {
    const code = codeOnly(sql());
    const idxIesResolvida = code.indexOf('IES not resolved');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxIesResolvida);
  });

  it('n_tri e n_prof contam alunos distintos, não linhas de resultados_alunos_tri (achado 8 — mesmo denominador da Visão Geral)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/\(SELECT count\(DISTINCT t\.student_id\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_tri/);
    expect(code).toMatch(
      /\(SELECT count\(DISTINCT t\.student_id\) FILTER \(WHERE t\.score_proprio >= 60\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/,
    );
    // o bug original: count(*) sem DISTINCT nos dois lados
    expect(code).not.toMatch(/\(SELECT count\(\*\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_tri/);
    expect(code).not.toMatch(/\(SELECT count\(\*\) FILTER \(WHERE t\.score_proprio >= 60\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/);
  });

  it('calcula v_aberta com o MESMO critério de "aberto ao aluno" de simuladosApi.listarSimulados, igual a get_gestor_questoes (achado 14)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/v_aberta\s+boolean/);
    expect(code).toMatch(/sa\.status\s*=\s*'ativo'/);
    expect(code).toMatch(/sa\.data_liberacao IS NULL OR sa\.data_liberacao <= now\(\)/);
    expect(code).toMatch(/sa\.data_encerramento IS NULL OR sa\.data_encerramento >= now\(\)/);
    // só calcula quando v_n = 1 (único caso em que `questoes` existe)
    expect(code).toMatch(/IF v_n = 1 THEN/);
  });

  it('não expõe qual alternativa é a correta enquanto a prova está aberta, sem bloquear a chamada inteira (achado 14)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/'correta',\s*CASE WHEN v_aberta THEN NULL ELSE \(a\.letra = f\.correta\) END/);
    // o bug original expunha incondicionalmente:
    expect(code).not.toMatch(/'correta',\s*\(a\.letra = f\.correta\)/);
  });

  it('também oculta o distrator dominante enquanto a prova está aberta (mesmo corte, achado 14)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/CASE WHEN v_aberta THEN NULL ELSE\s*\(\s*SELECT d\.letra/);
  });

  it('NÃO bloqueia métricas agregadas (metricas/acertoPorAreaESemestre/dispersao) por causa da janela de aplicação — só o conteúdo bruto é mascarado', () => {
    const code = codeOnly(sql());
    // a checagem de elegibilidade pré-existente continua igual, sem condição de janela de aplicação
    expect(code).toMatch(/RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';/);
    // v_aberta é CALCULADO (não só declarado) só DEPOIS da elegibilidade já ter passado —
    // nunca condiciona o próprio bloco EXISTS que decide 'simulado_fora_do_escopo'
    const idxElegibilidade = code.indexOf("todo simulado pedido tem de ser elegível");
    const idxExiste = code.indexOf('simulado_fora_do_escopo');
    const idxCalculoAberta = code.indexOf('IF v_n = 1 THEN');
    expect(idxElegibilidade).toBeGreaterThan(-1);
    expect(idxExiste).toBeGreaterThan(idxElegibilidade);
    expect(idxCalculoAberta).toBeGreaterThan(idxExiste);
    // a condição EXISTS de elegibilidade, isolada, não referencia v_aberta em nenhum ponto
    const blocoElegibilidade = code.slice(idxElegibilidade, idxExiste);
    expect(blocoElegibilidade).not.toMatch(/v_aberta/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e o grant original', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_detalhamento\(uuid, text, uuid\[\]\) TO authenticated;/);
  });
});

describe('migration get_gestor_visao_geral (2ª rodada — achado 15/119, gaps 109, 112 e 117)', () => {
  const FILE = '20260804174000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql';
  const sql = () => readMigration(FILE);

  it('troca user_can_access_ies por gestor_pode_acessar_ies(v_ies), autorizando DEPOIS da resolução de v_ies (achado 15 / card 119)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(code).not.toMatch(/user_can_access_ies/);

    const idxIesNotResolved = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxIesNotResolved).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('resolve v_ies para os dois ramos (p_ies_id explícito e fallback) ANTES de autorizar, cobrindo o vazamento do fallback (achado 15/119)', () => {
    const code = codeOnly(sql());
    // a resolução (sem chamada de autorização dentro do IF) precisa vir antes do guard único
    const idxResolucao = code.indexOf('IF p_ies_id IS NOT NULL THEN\n    v_ies := p_ies_id;');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    expect(idxResolucao).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxResolucao);
  });

  it('KPI de contratados soma TODOS os contratos vigentes, não escolhe um só via LIMIT 1 (gap 109)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/kpi_contratos_vigentes AS \(/);
    expect(code).toMatch(/current_date BETWEEN c\.vigencia_inicio AND c\.vigencia_fim/);
    expect(code).toMatch(/kpi_contrato_fallback AS \(/);
    expect(code).toMatch(/'contratados',\s*\(SELECT sum\(kc\.simulados_contratados\) FROM kpi_contrato kc\)/);
    // o bug original: um único contrato via LIMIT 1, sem união de vigentes
    expect(code).not.toMatch(/'contratados',\s*\(SELECT kc\.simulados_contratados FROM kpi_contrato kc\)/);
  });

  it('deduplica tri em UMA linha por (student_id, pai_id) por maior score_proprio antes de qualquer contagem/média/dispersão (gap 112)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/tri_raw AS \(/);
    expect(code).toMatch(
      /DISTINCT ON \(tr\.student_id, tr\.pai_id\)\s*\n\s*tr\.pai_id, tr\.student_id, tr\.semestre, tr\.score_proprio\s*\n\s*FROM tri_raw tr\s*\n\s*ORDER BY tr\.student_id, tr\.pai_id, tr\.score_proprio DESC/,
    );
    // por_sim, aluno_prof e dispersao continuam lendo de `tri` (agora já deduplicada), não de tri_raw
    expect(code).toMatch(/FROM tri t WHERE t\.pai_id = s\.id/);
    expect(code).not.toMatch(/FROM tri_raw t WHERE t\.pai_id = s\.id/);
  });

  it('classifica areas_nivel.nivel e evolucaoPorArea.critica sobre o MESMO acerto_pct já arredondado, via areas_pct (gap 117)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/areas_pct AS \(/);
    expect(code).toMatch(/areas_nivel AS \(\s*\n\s*SELECT p\.area, p\.amostra, p\.acerto_pct,/);
    expect(code).toMatch(/WHEN p\.acerto_pct\s*<\s*30 THEN 'critico'/);
    expect(code).toMatch(/WHEN p\.acerto_pct\s*>=\s*80 THEN 'excelente'/);
    expect(code).toMatch(/'critica',\s*COALESCE\(t\.acerto_pct < 30, false\)/);
    expect(code).toMatch(/FROM areas_pct t\), '\[\]'::jsonb\)/);
    // o bug original: classificava sobre o percentual bruto, não o arredondado
    expect(code).not.toMatch(/WHEN 100\.0 \* t\.acertos \/ t\.total\s*<\s*30 THEN 'critico'/);
    expect(code).not.toMatch(/'critica',\s*COALESCE\(\(100\.0 \* t\.acertos \/ NULLIF\(t\.total,0\)\) < 30, false\)/);
  });

  it('preserva os achados 5, 8 e 9 da rodada anterior nesta migration (KPI vinculado ao contrato, n_prof distinto, lowSample no ponto atual) — o guard de feature do achado 2 foi removido depois, ver describe no fim do arquivo', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/kpi_slots AS \(/);
    expect(code).toMatch(/JOIN kpi_contrato kc ON kc\.contrato_id = sp\.contrato_id/);
    expect(code).toMatch(
      /count\(DISTINCT t\.student_id\) FILTER \(WHERE t\.score_proprio >= 60\) FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/,
    );
    expect(code).toMatch(
      /'lowSample',\s*COALESCE\(\(SELECT GREATEST\(p\.n_tri, p\.n_resp\) FROM pontos p WHERE p\.rotulo = 'atual'\), 0\) < 10/,
    );
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e o grant original', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_visao_geral\(uuid, text\) TO authenticated;/);
  });
});

describe('coerência entre get_gestor_detalhamento e get_gestor_questoes (achado 14, mesma prova)', () => {
  const DETALHAMENTO = readMigration('20260804131000_get_gestor_detalhamento_guard_prof_gabarito.sql');
  const QUESTOES = readMigration('20260804133000_get_gestor_questoes_gabarito_prova_aberta.sql');

  it('as duas usam EXATAMENTE o mesmo critério de v_aberta (nenhuma condição que a outra não tem)', () => {
    const criterioAberta = (sql: string) => {
      // âncora no literal exato "sa.status = 'ativo'" -- a checagem de
      // elegibilidade pré-existente usa "sa.status IN ('ativo','encerrado')"
      // (sem "="), então isso não confunde com a condição de v_aberta.
      const idx = sql.indexOf("sa.status = 'ativo'");
      return sql
        .slice(idx, idx + 220)
        .replace(/\s+/g, ' ')
        .trim();
    };
    const a = criterioAberta(codeOnly(DETALHAMENTO));
    const b = criterioAberta(codeOnly(QUESTOES));
    expect(a).toContain("sa.status = 'ativo'");
    expect(b).toContain("sa.status = 'ativo'");
    expect(a).toContain('data_liberacao IS NULL OR sa.data_liberacao <= now()');
    expect(b).toContain('data_liberacao IS NULL OR sa.data_liberacao <= now()');
    expect(a).toContain('data_encerramento IS NULL OR sa.data_encerramento >= now()');
    expect(b).toContain('data_encerramento IS NULL OR sa.data_encerramento >= now()');
  });
});

describe('migrations get_gestor_visao_geral / get_gestor_detalhamento — guard de feature removido (GA total, decisão do Felipe em 06/08)', () => {
  const GUARD_REMOVAL_FILE = '20260806144647_gestor_remove_guard_portal_v2_ga_total.sql';

  it('get_gestor_visao_geral na migration mais recente não checa mais gestao.portal_v2 — a v2 vale para todo gestor, sem gate no banco', () => {
    const body = readMigration(GUARD_REMOVAL_FILE);
    const inicio = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral');
    const fim = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico');
    const corpo = body.slice(inicio, fim);
    expect(corpo).not.toMatch(/user_has_feature/);
  });

  it('get_gestor_detalhamento na migration mais recente não checa mais gestao.portal_v2 — a v2 vale para todo gestor, sem gate no banco', () => {
    const body = readMigration(GUARD_REMOVAL_FILE);
    const inicio = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento');
    const fim = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_questoes');
    const corpo = body.slice(inicio, fim);
    expect(corpo).not.toMatch(/user_has_feature/);
  });
});
