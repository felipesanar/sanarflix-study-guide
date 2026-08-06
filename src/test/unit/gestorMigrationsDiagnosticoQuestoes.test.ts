/**
 * Testes estáticos das migrations dos achados 2/18 (get_gestor_diagnostico),
 * 2/11 (get_gestor_diagnostico_temas) e 2/14 (get_gestor_questoes) da revisão
 * adversarial de 03/08.
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
 * Remove comentários de linha (`-- ...`) antes de qualquer asserção. Os
 * cabeçalhos destas migrations documentam o bug antigo em prosa — inclusive
 * citando o padrão que o fix substitui — e isso faria uma asserção negativa
 * (".not.toMatch") ou uma comparação de posição (".indexOf") morder a
 * própria explicação em vez do código. Nenhuma string literal do CÓDIGO
 * destas três migrations contém "--" (conferido manualmente), então cortar
 * a partir do primeiro "--" de cada linha é seguro aqui.
 */
function codigo(sqlComComentarios: string): string {
  return sqlComComentarios
    .split('\n')
    .map((linha) => {
      const idx = linha.indexOf('--');
      return idx === -1 ? linha : linha.slice(0, idx);
    })
    .join('\n');
}

describe('migration get_gestor_diagnostico (achados 2 e 18)', () => {
  const FILE = '20260804131500_get_gestor_diagnostico_nivel_e_feature_por_ies.sql';
  const sql = () => codigo(readMigration(FILE));

  it('troca o guard de feature por user_has_feature_for_ies com v_ies (achado 2)', () => {
    const body = sql();
    expect(body).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(body).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('checa a feature DEPOIS de resolver v_ies, nunca antes (regressão do achado 2)', () => {
    const body = sql();
    const idxIesResolvida = body.indexOf('IES not resolved');
    const idxFeature = body.indexOf('user_has_feature_for_ies');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxIesResolvida);
  });

  it('classifica desempenho sobre o MESMO valor arredondado que acertoPct expõe (achado 18)', () => {
    const body = sql();
    expect(body).toMatch(/WHEN\s+a\.acerto_pct\s*<\s*30\s+THEN\s+'critico'/);
    expect(body).toMatch(/WHEN\s+a\.acerto_pct\s*>=\s*80\s+THEN\s+'excelente'/);
    // o bug original comparava a razão bruta (29,6), não o valor já arredondado (30)
    expect(body).not.toMatch(/100\.0\s*\*\s*a\.acertos\s*\/\s*a\.total\s*<\s*30/);
    expect(body).not.toMatch(/100\.0\s*\*\s*a\.acertos\s*\/\s*a\.total\s*>=\s*80/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e os grants originais', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_diagnostico\(uuid, text, text\) TO authenticated;/,
    );
  });
});

describe('migration get_gestor_diagnostico_temas (achados 2 e 11)', () => {
  const FILE = '20260804132000_get_gestor_diagnostico_temas_escopo_grande_area.sql';
  const sql = () => codigo(readMigration(FILE));

  it('troca o guard de feature por user_has_feature_for_ies com v_ies (achado 2)', () => {
    const body = sql();
    expect(body).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(body).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('adiciona p_grande_area (default NULL) e derruba o overload antigo de 3 parâmetros (achado 11)', () => {
    const body = sql();
    expect(body).toMatch(/DROP FUNCTION IF EXISTS public\.get_gestor_diagnostico_temas\(uuid,\s*text,\s*text\)\s*;/);
    expect(body).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_gestor_diagnostico_temas\(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL\)/,
    );
  });

  it('escopa a soma de temas pela grande área de origem quando ela é informada (achado 11)', () => {
    const body = sql();
    expect(body).toMatch(/q\.especialidade = p_especialidade/);
    expect(body).toMatch(/\(p_grande_area IS NULL OR q\.grande_area = p_grande_area\)/);
  });

  it('grants apontam para a assinatura nova de 4 parâmetros', () => {
    const body = sql();
    expect(body).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_diagnostico_temas\(uuid, text, text, text\) TO authenticated;/,
    );
  });
});

describe('migration get_gestor_questoes (achados 2 e 14)', () => {
  const FILE = '20260804133000_get_gestor_questoes_gabarito_prova_aberta.sql';
  const sql = () => codigo(readMigration(FILE));

  it('troca o guard de feature por user_has_feature_for_ies com v_ies (achado 2)', () => {
    const body = sql();
    expect(body).toMatch(/user_has_feature_for_ies\(\s*'gestao\.portal_v2'\s*,\s*v_ies\s*\)/);
    expect(body).not.toMatch(/user_has_feature\(\s*'gestao\.portal_v2'\s*\)/);
  });

  it('calcula v_aberta com o MESMO critério de "aberto ao aluno" de simuladosApi.listarSimulados (achado 14)', () => {
    const body = sql();
    expect(body).toMatch(/v_aberta\s+boolean/);
    expect(body).toMatch(/sa\.status\s*=\s*'ativo'/);
    expect(body).toMatch(/sa\.data_liberacao IS NULL OR sa\.data_liberacao <= now\(\)/);
    expect(body).toMatch(/sa\.data_encerramento IS NULL OR sa\.data_encerramento >= now\(\)/);
  });

  it('não expõe qual alternativa é a correta enquanto a prova está aberta (achado 14)', () => {
    const body = sql();
    expect(body).toMatch(/'correta',\s*CASE WHEN v_aberta THEN NULL ELSE \(a\.letra = f\.correta\) END/);
    // o bug original expunha incondicionalmente:
    expect(body).not.toMatch(/'correta',\s*\(a\.letra = f\.correta\)/);
  });

  it('também oculta o distrator dominante enquanto a prova está aberta (mesmo corte, achado 14)', () => {
    const body = sql();
    expect(body).toMatch(/CASE WHEN v_aberta THEN NULL ELSE\s*\(\s*SELECT d\.letra/);
  });

  it('preserva a paginação, ordenação e filtro de área originais', () => {
    const body = sql();
    expect(body).toMatch(/v_sort NOT IN \('numero','acerto'\)/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_questoes\(uuid, uuid, int, int, text, text\) TO authenticated;/);
  });
});
