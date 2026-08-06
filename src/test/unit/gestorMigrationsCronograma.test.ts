/**
 * Testes estáticos da migration de get_gestor_cronograma que sucede
 * 20260804140100 (achados 2/10, cards Ordem 101/114) e fecha os dois gaps
 * apontados pela verificação independente de 04/08:
 *
 *   - card Ordem 119 (achado 15): autorização de IES trocada de
 *     user_can_access_ies para o helper gestor_pode_acessar_ies, que para
 *     papel 'gestor' puro usa SOMENTE users.id_ies (nunca get_accessible_ies
 *     — o vazamento por linha órfã em user_groups).
 *   - card Ordem 114 (achado 10), gap remanescente: `participantes` deixa de
 *     ficar preso a status = 'realizado' e passa a aparecer em qualquer
 *     status com pelo menos um registro (inclui a prova aberta ainda sendo
 *     respondida), continuando null (nunca 0) quando não há nenhum registro.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — não dá para rodar a função de
 * verdade aqui. Este arquivo faz o possível sem banco: lê o texto-fonte da
 * migration e verifica, por padrão, que os bugs documentados foram removidos
 * e que as correções esperadas estão presentes. Não substitui o passo manual
 * descrito no rodapé da migration (pg_get_functiondef + teste funcional em
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
 * verificação. Necessário porque o cabeçalho documenta DE PROPÓSITO o
 * comportamento antigo (user_can_access_ies, status = 'realizado') para
 * explicar o que foi trocado e por quê — testar "não contém mais X" contra o
 * arquivo inteiro dispara falso-positivo nessas linhas de prosa, que não são
 * código executado.
 */
function codeOnly(body: string): string {
  const start = body.indexOf('CREATE OR REPLACE FUNCTION');
  const lastGrant = body.lastIndexOf('GRANT EXECUTE');
  const end = body.indexOf('\n', lastGrant);
  return body.slice(start, end === -1 ? body.length : end);
}

/**
 * Remove comentários de linha (`-- ...`) do bloco de código. Necessário para
 * asserções negativas dentro do corpo executado: o corpo comenta DE
 * PROPÓSITO o comportamento antigo (ex.: "troca de user_can_access_ies por
 * gestor_pode_acessar_ies") para explicar a mudança, e isso faria
 * `.not.toMatch(/user_can_access_ies/)` morder a própria explicação, não
 * código. Nenhuma string literal do código real desta migration contém "--"
 * (conferido manualmente — o travessão usado em 'periodo' é "—", U+2014, não
 * dois hifens), então cortar a partir do primeiro "--" de cada linha é
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

const FILE = '20260804170000_get_gestor_cronograma_helper_ies_e_participantes_prova_aberta.sql';
const sql = () => readMigration(FILE);

describe('migration get_gestor_cronograma — guard de papel e helper de IES (achado 15/card 119)', () => {
  it('mantém o guard de papel restrito a admin/gestor/gestor_grupo (Access denied)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /IF NOT \(\s*\n\s*has_role\(v_uid,'admin'::app_role\)\s*\n\s*OR has_role\(v_uid,'gestor'::app_role\)\s*\n\s*OR has_role\(v_uid,'gestor_grupo'::app_role\)\s*\n\s*\) THEN\s*\n\s*RAISE EXCEPTION 'Access denied';/,
    );
  });

  it('troca a autorização de IES por gestor_pode_acessar_ies(v_ies), nunca user_can_access_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    expect(code).toMatch(/RAISE EXCEPTION 'Permission denied: cannot access this IES';/);
    // sem comentários: o código executado não chama mais user_can_access_ies em nenhum ramo
    // (o nome só aparece em comentários explicando a troca, que são removidos aqui)
    expect(semComentarios(code)).not.toMatch(/user_can_access_ies/);
  });

  it('resolve v_ies (papel -> resolução -> IES not resolved) ANTES de autorizar, e autoriza ANTES da feature', () => {
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

  it('resolve v_ies = p_ies_id direto (sem checar acesso ainda) e cai no fallback de users.id_ies / get_accessible_ies só no ramo NULL', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /IF p_ies_id IS NOT NULL THEN\s*\n\s*v_ies := p_ies_id;\s*\n\s*ELSE\s*\n\s*SELECT u\.id_ies INTO v_ies FROM public\.users u WHERE u\.id = v_uid;\s*\n\s*IF v_ies IS NULL THEN\s*\n\s*v_ies := \(public\.get_accessible_ies\(v_uid\)\)\[1\];/,
    );
  });

  it('checa a feature via user_has_feature_for_ies com v_ies (achado 2, herdado nesta migration — guard removido depois, ver describe no fim do arquivo)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(code).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('não altera a mensagem de erro de autorização (front-end mapeia essa string)', () => {
    const code = codeOnly(sql());
    const matches = code.match(/Permission denied: cannot access this IES/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe('migration get_gestor_cronograma — precedência de datas sobre participação (achado 10, herdado)', () => {
  it('encerramento continua decidido só por status/data, nunca por participação (p.n não entra na CASE de status)', () => {
    const code = codeOnly(sql());
    const casesStatus = code.slice(code.indexOf('sim_status AS ('), code.indexOf('slots AS ('));
    expect(casesStatus).toMatch(/WHEN \(lower\(s\.status\) = 'encerrado'\s*\n\s*OR \(s\.data_encerramento IS NOT NULL AND s\.data_encerramento < now\(\)\)\)\s*\n\s*AND EXISTS \(SELECT 1 FROM com_tri c WHERE c\.pai_id = s\.id\)\s*\n\s*THEN 'realizado'/);
    expect(casesStatus).toMatch(/WHEN lower\(s\.status\) = 'encerrado'\s*\n\s*OR \(s\.data_encerramento IS NOT NULL AND s\.data_encerramento < now\(\)\)\s*\n\s*THEN 'processing'/);
    expect(casesStatus).toMatch(/WHEN s\.data_efetiva IS NULL THEN 'previsto'/);
    expect(casesStatus).toMatch(/WHEN s\.data_agendada_original IS NOT NULL\s*\n\s*AND s\.data_agendada_original <> s\.data_efetiva THEN 'reagendado'/);
    expect(casesStatus).toMatch(/ELSE 'agendado'/);
    // p.n (participação) só aparece na definição da coluna informativa `participantes`
    // (COALESCE(p.n, 0)) — nunca dentro de uma condição WHEN da CASE que decide o status.
    // Comentários removidos antes de contar: o cabeçalho do CASE cita "(p.n)" em prosa para
    // explicar a decisão, o que não é código executado.
    const linhasComPn = semComentarios(casesStatus)
      .split('\n')
      .filter((linha) => /\bp\.n\b/.test(linha));
    expect(linhasComPn.length).toBe(1);
    expect(linhasComPn[0]).toMatch(/COALESCE\(p\.n, 0\) AS participantes/);
  });
});

describe('migration get_gestor_cronograma — participantes de prova aberta (achado 10 / card 114, gap fechado nesta migration)', () => {
  it('exibe participantes em QUALQUER status, não mais só em status = realizado (os dois ramos do UNION ALL de itens)', () => {
    const code = codeOnly(sql());
    const itens = code.slice(code.indexOf('itens AS ('), code.indexOf('SELECT jsonb_build_object('));
    // os dois CASE de participantes dentro de itens não checam mais status = 'realizado'
    expect(itens).not.toMatch(/status\s*=\s*'realizado'\s+AND\s+ss\.participantes/);
    expect(itens).not.toMatch(/COALESCE\(ss\.status,\s*'previsto'\)\s*=\s*'realizado'\s+AND\s+ss\.participantes/);
    const casesParticipantes = itens.match(/CASE WHEN ss\.participantes > 0\s*\n\s*THEN ss\.participantes END/g) ?? [];
    expect(casesParticipantes.length).toBe(2);
  });

  it('continua null (nunca 0) quando não há nenhum registro — CASE sem ELSE, sempre condicionado a participantes > 0', () => {
    const code = codeOnly(sql());
    const itens = code.slice(code.indexOf('itens AS ('), code.indexOf('SELECT jsonb_build_object('));
    expect(itens).not.toMatch(/ELSE 0/);
    expect(itens).not.toMatch(/COALESCE\(ss\.participantes,\s*0\)\s*AS participantes/);
  });

  it('atualiza meta.criterio para descrever a regra nova de participantes (qualquer status, inclui prova aberta)', () => {
    const body = sql();
    expect(body).toMatch(
      /exibido em qualquer status havendo pelo menos um registro -- inclui prova aberta ainda sendo respondida, não só a realizada; null quando não há nenhum registro, nunca 0\./,
    );
    // o critério antigo (preso a status = realizado) não deve mais aparecer no texto do meta.criterio
    expect(body).not.toMatch(/exibido só quando realizado; null quando não há registro, nunca 0\./);
  });

  it('preserva a CTE participacao (simulados_finalizados UNIÃO answer_progress, deduplicada por aluno) intacta', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/participacao AS \(/);
    expect(code).toMatch(/SELECT p\.pai_id, count\(DISTINCT p\.user_id\) AS n/);
    expect(code).toMatch(/FROM public\.simulados_finalizados sf/);
    expect(code).toMatch(/FROM public\.answer_progress ap/);
  });
});

describe('migration get_gestor_cronograma — regressão do patch de produção answer_progress (meta.fonte)', () => {
  it('meta.fonte continua incluindo answer_progress (patch de produção sem .sql, reconciliado em 20260804140100)', () => {
    const body = sql();
    expect(body).toMatch(
      /'fonte',\s*'ies_contrato_simulados · ies_simulado_previsto · simulados_admin · simulados_finalizados · answer_progress · resultados_ies_tri'/,
    );
  });

  it('a CTE grupo e o JOIN de answer_progress por simulado (não por pai) continuam presentes', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/JOIN grupo g ON g\.simulado_id = ap\.simulado/);
  });
});

describe('migration get_gestor_cronograma — preservação de infraestrutura', () => {
  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais (assinatura de 1 parâmetro)', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.get_gestor_cronograma\(uuid\) FROM public, anon;/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_cronograma\(uuid\) TO authenticated;/);
  });

  it('documenta a sucessão explícita de 20260804140100 e a dependência de 20260804160000, sem editar nenhum dos dois', () => {
    const body = sql();
    expect(body).toMatch(/SUCEDE 20260804140100_get_gestor_cronograma_guard_precedencia_datas\.sql/);
    expect(body).toMatch(/DEPENDE de 20260804160000_gestor_pode_acessar_ies\.sql/);
  });
});

describe('migration get_gestor_cronograma — guard de feature removido (GA total, decisão do Felipe em 06/08)', () => {
  it('a migration mais recente não checa mais gestao.portal_v2 — a v2 vale para todo gestor, sem gate no banco', () => {
    const body = readMigration('20260806144647_gestor_remove_guard_portal_v2_ga_total.sql');
    const inicio = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_cronograma');
    const fim = body.indexOf('CREATE OR REPLACE FUNCTION public.get_gestor_avisos');
    const corpo = body.slice(inicio, fim);
    expect(corpo).not.toMatch(/user_has_feature/);
  });
});
