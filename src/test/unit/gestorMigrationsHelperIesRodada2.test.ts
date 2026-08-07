/**
 * Testes estáticos das migrations que fecham o gap do card Ordem 119 em
 * get_gestor_avisos, get_gestor_diagnostico, get_gestor_diagnostico_temas e
 * get_gestor_questoes (autorização de IES trocada de user_can_access_ies
 * para public.gestor_pode_acessar_ies, criada em
 * 20260804160000_gestor_pode_acessar_ies.sql), e o gap do card 115 em
 * get_gestor_diagnostico_temas (p_grande_area deixa de ser opcional na
 * prática).
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
 * verificação. O cabeçalho documenta DE PROPÓSITO o comportamento antigo
 * (user_can_access_ies, WHERE permissivo) para explicar a troca — testar
 * "não contém mais X" contra o arquivo inteiro dispararia falso-positivo
 * nessas linhas de prosa, que não são código executado.
 */
function codeOnly(body: string): string {
  const start = body.indexOf('CREATE OR REPLACE FUNCTION');
  const lastGrant = body.lastIndexOf('GRANT EXECUTE');
  const end = body.indexOf('\n', lastGrant);
  return body.slice(start, end === -1 ? body.length : end);
}

/**
 * Remove comentários de linha (`-- ...`) do bloco de código, para que
 * asserções negativas não mordam a prosa explicativa (que cita de propósito
 * o padrão antigo). Nenhuma string literal do código real destas quatro
 * migrations contém "--" (o travessão usado em texto de UI é "—", U+2014,
 * não dois hifens), então cortar a partir do primeiro "--" de cada linha é
 * seguro aqui.
 */
function semComentarios(codigo: string): string {
  return codigo
    .split('\n')
    .map((linha) => {
      const idx = linha.indexOf('--');
      return idx === -1 ? linha : linha.slice(0, idx);
    })
    .join('\n');
}

describe('migration get_gestor_avisos (gap 119)', () => {
  const FILE = '20260804161000_get_gestor_avisos_gestor_pode_acessar_ies.sql';
  const sql = () => readMigration(FILE);

  it('troca a autorização de IES por gestor_pode_acessar_ies(v_ies), nunca mais user_can_access_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(semComentarios(code)).not.toMatch(/user_can_access_ies/);
  });

  it('resolve v_ies (sem checar acesso) e só autoriza DEPOIS, cobrindo os dois ramos do IF/ELSE', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /IF p_ies_id IS NOT NULL THEN\s*\n\s*v_ies := p_ies_id;\s*\n\s*ELSE\s*\n\s*SELECT u\.id_ies INTO v_ies FROM public\.users u WHERE u\.id = v_uid;\s*\n\s*IF v_ies IS NULL THEN\s*\n\s*v_ies := \(public\.get_accessible_ies\(v_uid\)\)\[1\];/,
    );
  });

  it('ordem final do preâmbulo: Access denied -> IES not resolved -> autorização -> feature', () => {
    const code = codeOnly(sql());
    const idxAccessDenied = code.indexOf('Access denied');
    const idxIesNotResolved = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxAccessDenied).toBeGreaterThan(-1);
    expect(idxIesNotResolved).toBeGreaterThan(idxAccessDenied);
    expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('não altera a mensagem de erro de autorização (front-end mapeia essa string)', () => {
    const code = codeOnly(sql());
    const matches = code.match(/Permission denied: cannot access this IES/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('preserva o critério de visibilidade, o COALESCE de publico_alvo e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/'gestor' = ANY \(COALESCE\(a\.publico_alvo, ARRAY\['aluno'\]::text\[\]\)\)/);
    expect(body).toMatch(/ORDER BY v\.lido ASC, v\.created_at DESC/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_avisos\(uuid\) TO authenticated;/);
  });
});

describe('migration get_gestor_diagnostico (gap 119, achado 18 herdado)', () => {
  const FILE = '20260804162000_get_gestor_diagnostico_gestor_pode_acessar_ies.sql';
  const sql = () => readMigration(FILE);

  it('troca a autorização de IES por gestor_pode_acessar_ies(v_ies), nunca mais user_can_access_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(semComentarios(code)).not.toMatch(/user_can_access_ies/);
  });

  it('ordem final do preâmbulo: Access denied -> IES not resolved -> autorização -> feature', () => {
    const code = codeOnly(sql());
    const idxAccessDenied = code.indexOf('Access denied');
    const idxIesNotResolved = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxAccessDenied).toBeGreaterThan(-1);
    expect(idxIesNotResolved).toBeGreaterThan(idxAccessDenied);
    expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('NÃO regride o achado 18: desempenho continua classificado sobre o MESMO valor arredondado de acertoPct', () => {
    const body = sql();
    expect(body).toMatch(/round\(100\.0 \* count\(\*\) FILTER \(WHERE b\.correct\) \/ NULLIF\(count\(\*\),0\), 0\) AS acerto_pct/);
    expect(body).toMatch(/WHEN\s+a\.acerto_pct\s*<\s*30\s+THEN\s+'critico'/);
    expect(body).toMatch(/WHEN\s+a\.acerto_pct\s*>=\s*80\s+THEN\s+'excelente'/);
    expect(body).not.toMatch(/100\.0\s*\*\s*a\.acertos\s*\/\s*a\.total\s*<\s*30/);
  });

  it('preserva os grants originais (assinatura de 3 parâmetros)', () => {
    const body = sql();
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_diagnostico\(uuid, text, text\) TO authenticated;/,
    );
  });
});

describe('migration get_gestor_diagnostico_temas (gap 115 + gap 119)', () => {
  const FILE = '20260804163000_get_gestor_diagnostico_temas_grande_area_obrigatoria.sql';
  const sql = () => readMigration(FILE);

  it('gap 115: p_grande_area NULL (após normalização de string vazia) dispara grande_area_obrigatoria', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /IF p_grande_area IS NULL THEN\s*\n\s*RAISE EXCEPTION 'grande_area_obrigatoria' USING ERRCODE = '22023';/,
    );
  });

  it('gap 115: essa checagem vem ANTES da resolução de v_ies, igual a especialidade_obrigatoria', () => {
    const code = codeOnly(sql());
    const idxEspecialidade = code.indexOf('especialidade_obrigatoria');
    const idxGrandeArea = code.indexOf('grande_area_obrigatoria');
    const idxResolucaoIes = code.indexOf('IF p_ies_id IS NOT NULL THEN');
    expect(idxEspecialidade).toBeGreaterThan(-1);
    expect(idxGrandeArea).toBeGreaterThan(idxEspecialidade);
    expect(idxResolucaoIes).toBeGreaterThan(idxGrandeArea);
  });

  it('gap 115: o WHERE de temas não tem mais o "OR" permissivo — filtra direto por q.grande_area = p_grande_area', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/q\.especialidade = p_especialidade/);
    expect(code).toMatch(/AND\s+q\.grande_area = p_grande_area\s*\n\s*AND q\.tema IS NOT NULL/);
    expect(semComentarios(code)).not.toMatch(/p_grande_area IS NULL OR/);
  });

  it('gap 115: meta.criterio não usa mais o COALESCE com o texto de "não informada" (p_grande_area é sempre presente)', () => {
    const body = sql();
    expect(body).toMatch(/Grande área de origem: %s\./);
    const codigoCriterio = semComentarios(codeOnly(body));
    expect(codigoCriterio).not.toMatch(/não informada pelo chamador/);
  });

  it('mantém a assinatura aditiva (p_grande_area text DEFAULT NULL), sem novo DROP FUNCTION', () => {
    const body = sql();
    expect(body).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_gestor_diagnostico_temas\(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL\)/,
    );
    expect(codeOnly(body)).not.toMatch(/DROP FUNCTION/);
  });

  it('gap 119: troca a autorização de IES por gestor_pode_acessar_ies(v_ies), nunca mais user_can_access_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(semComentarios(code)).not.toMatch(/user_can_access_ies/);
  });

  it('gap 119: ordem final do preâmbulo (depois das validações de negócio): IES not resolved -> autorização -> feature', () => {
    const code = codeOnly(sql());
    const idxGrandeArea = code.indexOf('grande_area_obrigatoria');
    const idxIesNotResolved = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxIesNotResolved).toBeGreaterThan(idxGrandeArea);
    expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('preserva os grants originais (assinatura de 4 parâmetros)', () => {
    const body = sql();
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_diagnostico_temas\(uuid, text, text, text\) TO authenticated;/,
    );
  });
});

describe('migration get_gestor_questoes (gap 119, achado 14 herdado)', () => {
  const FILE = '20260804164000_get_gestor_questoes_gestor_pode_acessar_ies.sql';
  const sql = () => readMigration(FILE);

  it('troca a autorização de IES por gestor_pode_acessar_ies(v_ies), nunca mais user_can_access_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(semComentarios(code)).not.toMatch(/user_can_access_ies/);
  });

  it('ordem final do preâmbulo: Access denied -> simulado_obrigatorio -> IES not resolved -> autorização -> feature', () => {
    const code = codeOnly(sql());
    const idxAccessDenied = code.indexOf('Access denied');
    const idxSimuladoObrigatorio = code.indexOf('simulado_obrigatorio');
    const idxIesNotResolved = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies(v_ies)');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxAccessDenied).toBeGreaterThan(-1);
    expect(idxSimuladoObrigatorio).toBeGreaterThan(idxAccessDenied);
    expect(idxIesNotResolved).toBeGreaterThan(idxSimuladoObrigatorio);
    expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('NÃO regride o achado 14: v_aberta continua calculado e controlando correta/distratorDominante', () => {
    const body = sql();
    expect(body).toMatch(/v_aberta\s+boolean/);
    expect(body).toMatch(/sa\.status\s*=\s*'ativo'/);
    expect(body).toMatch(/sa\.data_liberacao IS NULL OR sa\.data_liberacao <= now\(\)/);
    expect(body).toMatch(/sa\.data_encerramento IS NULL OR sa\.data_encerramento >= now\(\)/);
    expect(body).toMatch(/'correta',\s*CASE WHEN v_aberta THEN NULL ELSE \(a\.letra = f\.correta\) END/);
    expect(body).toMatch(/CASE WHEN v_aberta THEN NULL ELSE\s*\(\s*SELECT d\.letra/);
  });

  it('preserva paginação, ordenação, filtro de área e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/v_sort NOT IN \('numero','acerto'\)/);
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_questoes\(uuid, uuid, int, int, text, text\) TO authenticated;/,
    );
  });
});

describe('migrations get_gestor_avisos / diagnostico / diagnostico_temas / questoes — guard de feature removido (GA total, 06/08)', () => {
  const GUARD_REMOVAL_FILE = '20260806144647_gestor_remove_guard_portal_v2_ga_total.sql';
  const NEXT_FUNCTION_MARKER: Record<string, string> = {
    get_gestor_avisos: 'CREATE OR REPLACE FUNCTION public.get_gestor_aluno_contato',
    get_gestor_diagnostico: 'CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas',
    get_gestor_diagnostico_temas: 'CREATE OR REPLACE FUNCTION public.get_gestor_alunos',
    // get_gestor_questoes é a última função da migration — o marcador de fim é
    // o comentário de "dado morto" que precede as exclusões de feature_catalog/
    // ies_features, não o fim do arquivo (que ainda cita
    // user_has_feature_for_ies no COMMENT ON FUNCTION final, sem relação com o
    // guard removido).
    get_gestor_questoes: '-- Dado morto:',
  };

  it.each(['get_gestor_avisos', 'get_gestor_diagnostico', 'get_gestor_diagnostico_temas', 'get_gestor_questoes'])(
    '%s na migration mais recente não checa mais gestao.portal_v2 — a v2 vale para todo gestor, sem gate no banco',
    (fnName) => {
      const body = readMigration(GUARD_REMOVAL_FILE);
      const inicio = body.indexOf(`CREATE OR REPLACE FUNCTION public.${fnName}`);
      const fim = body.indexOf(NEXT_FUNCTION_MARKER[fnName]);
      const corpo = body.slice(inicio, fim === -1 ? body.length : fim);
      expect(corpo).not.toMatch(/user_has_feature/);
    },
  );
});

describe('as quatro migrations dependem da mesma função nova, sem duplicar sua definição', () => {
  const FILES = [
    '20260804161000_get_gestor_avisos_gestor_pode_acessar_ies.sql',
    '20260804162000_get_gestor_diagnostico_gestor_pode_acessar_ies.sql',
    '20260804163000_get_gestor_diagnostico_temas_grande_area_obrigatoria.sql',
    '20260804164000_get_gestor_questoes_gestor_pode_acessar_ies.sql',
  ];

  it('nenhuma delas define CREATE FUNCTION gestor_pode_acessar_ies — só consome a de 20260804160000', () => {
    for (const file of FILES) {
      const body = readMigration(file);
      expect(body).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.gestor_pode_acessar_ies/);
      expect(body).toMatch(/gestor_pode_acessar_ies\(v_ies\)/);
    }
  });

  it('todas preservam SECURITY DEFINER, STABLE e search_path = public', () => {
    for (const file of FILES) {
      const body = readMigration(file);
      expect(body).toMatch(/SECURITY DEFINER/);
      expect(body).toMatch(/\bSTABLE\b/);
      expect(body).toMatch(/SET search_path = public/);
    }
  });
});
