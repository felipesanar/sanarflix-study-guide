/**
 * Testes estáticos das migrations dos achados 2 (get_gestor_avisos,
 * get_gestor_aluno), 15 (get_gestor_contexto) e 12/16 (get_gestor_aluno_contato)
 * da revisão adversarial de 03/08.
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

describe('migration get_gestor_avisos (achado 2)', () => {
  const FILE = '20260804130400_get_gestor_avisos_feature_por_ies.sql';
  const sql = () => readMigration(FILE);

  it('troca o guard de feature por user_has_feature_for_ies com v_ies', () => {
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

  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_avisos\(uuid\) TO authenticated;/);
  });

  it('preserva o critério de visibilidade e o COALESCE de publico_alvo (não regride nada além do guard)', () => {
    const body = sql();
    expect(body).toMatch(/'gestor' = ANY \(COALESCE\(a\.publico_alvo, ARRAY\['aluno'\]::text\[\]\)\)/);
    expect(body).toMatch(/ORDER BY v\.lido ASC, v\.created_at DESC/);
  });
});

describe('migration get_gestor_aluno (achado 2)', () => {
  const FILE = '20260804130100_get_gestor_aluno_feature_por_ies.sql';
  const sql = () => readMigration(FILE);

  it('parte da versão com o estado aguardando_resultado (aplicada em produção em 20260803150000)', () => {
    const body = sql();
    expect(body).toMatch(/situacao',\s*CASE WHEN NOT lv\.participou\s+THEN 'nao_participou'/);
    expect(body).toMatch(/WHEN lv\.proficiencia IS NULL\s+THEN 'aguardando_resultado'/);
  });

  it('troca o guard de feature por user_has_feature_for_ies com v_ies', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(code).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('checa a feature DEPOIS de resolver v_ies e ANTES de validar o aluno', () => {
    const code = codeOnly(sql());
    const idxIesResolvida = code.indexOf('IES not resolved');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    const idxAlunoObrigatorio = code.indexOf('aluno_obrigatorio');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxIesResolvida);
    expect(idxAlunoObrigatorio).toBeGreaterThan(idxFeature);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais (assinatura de 3 parâmetros)', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/search_path TO 'public'/);
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_aluno\(uuid, uuid, uuid\[\]\) TO authenticated;/,
    );
  });
});

describe('migration get_gestor_contexto (achado 15)', () => {
  const FILE = '20260804130200_get_gestor_contexto_ies_disponiveis_por_papel.sql';
  const sql = () => readMigration(FILE);

  it('NÃO troca o guard por user_has_feature_for_ies (função não recebe p_ies_id — exceção documentada)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/user_has_feature\('gestao\.portal_v2'\)/);
    expect(code).not.toMatch(/user_has_feature_for_ies/);
  });

  it('papel gestor puro recebe SOMENTE a própria IES em v_ies_list, nunca get_accessible_ies', () => {
    const code = codeOnly(sql());
    // O branch do ELSE (papel = 'gestor', depois do branch gestor_grupo) deve
    // resolver via users.id_ies, não get_accessible_ies.
    const elseBranch = code.slice(code.indexOf("papel = 'gestor':"), code.indexOf('SELECT u.id_ies INTO v_ies_atual'));
    expect(elseBranch.length).toBeGreaterThan(0);
    expect(elseBranch).toMatch(/FROM public\.users u\s*\n\s*WHERE u\.id = v_uid AND u\.id_ies IS NOT NULL/);
    expect(elseBranch).not.toMatch(/get_accessible_ies\(/);
  });

  it('gestor_grupo continua usando get_accessible_ies (comportamento preservado)', () => {
    const body = sql();
    expect(body).toMatch(/ELSIF v_papel = 'gestor_grupo' THEN\s*\n\s*v_ies_list := COALESCE\(public\.get_accessible_ies\(v_uid\), ARRAY\[\]::uuid\[\]\);/);
  });

  it('podeTrocarIes continua restrito a admin e gestor_grupo (inalterado)', () => {
    const body = sql();
    expect(body).toMatch(/'podeTrocarIes',\s*\(v_papel IN \('admin','gestor_grupo'\)\)/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_contexto\(\) TO authenticated;/);
  });
});

describe('migration get_gestor_aluno_contato (achados 12 e 16)', () => {
  const FILE = '20260804130300_get_gestor_aluno_contato_feature_por_ies.sql';
  const sql = () => readMigration(FILE);

  it('mantém o OR entre gestao.enabled e gestao.portal_v2 (não restringe cegamente ao v2 — quebraria produção)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(
      /user_has_feature_for_ies\('gestao\.enabled', v_ies\)\s*\n\s*OR public\.user_has_feature_for_ies\('gestao\.portal_v2', v_ies\)/,
    );
  });

  it('nenhum branch do guard usa mais o user_has_feature não-escopado por IES', () => {
    const code = codeOnly(sql());
    expect(code).not.toMatch(/user_has_feature\('gestao\.enabled'\)/);
    expect(code).not.toMatch(/user_has_feature\('gestao\.portal_v2'\)/);
  });

  it('checa a feature DEPOIS de autorizar o acesso ao aluno (anti-enumeração preservada)', () => {
    const code = codeOnly(sql());
    const idxAutorizacao = code.indexOf('aluno_nao_encontrado');
    const idxFeature = code.lastIndexOf('user_has_feature_for_ies');
    expect(idxAutorizacao).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('resolve v_ies a partir do próprio aluno (função não recebe p_ies_id)', () => {
    const body = sql();
    expect(body).toMatch(/SELECT u\.id_ies, u\.telefone\s*\n\s*INTO v_ies, v_telefone/);
  });

  it('preserva a exclusão de staff via user_roles e a mensagem única aluno_nao_encontrado', () => {
    const body = sql();
    expect(body).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_roles ur WHERE ur\.user_id = u\.id\)/);
    expect(body).toMatch(/IF v_ies IS NULL OR NOT public\.user_can_access_ies\(v_uid, v_ies\) THEN\s*\n\s*RAISE EXCEPTION 'aluno_nao_encontrado'/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_aluno_contato\(uuid\) TO authenticated;/);
  });
});
