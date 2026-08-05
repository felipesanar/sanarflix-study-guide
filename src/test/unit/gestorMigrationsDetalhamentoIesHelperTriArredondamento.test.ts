/**
 * Testes estáticos da migration 20260804170000, que fecha três gaps da
 * verificação independente sobre get_gestor_detalhamento (card Ordem 119 —
 * achado 15; card Ordem 112 — achado 8 incompleto; card Ordem 117):
 *
 *   - gap 119: autorização de IES via public.gestor_pode_acessar_ies, no
 *     lugar de public.user_can_access_ies (vazamento por user_groups órfão).
 *   - gap 112: uma linha por (student_id, pai_id) em `tri`, com desempate
 *     explícito, antes de contar/agregar proficientes.
 *   - gap 117: 'critica' classificada sobre o MESMO valor arredondado que
 *     'acertoPct' expõe, não sobre a razão crua.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — este arquivo faz o possível sem
 * banco: lê o texto-fonte da migration e verifica, por padrão, que o bug
 * documentado foi removido e a correção esperada está presente. Não
 * substitui o passo manual descrito no rodapé da migration (pg_get_functiondef
 * + teste funcional em transação revertida, rodado em gvqv antes de aplicar).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
}

/**
 * Recorta só o bloco de código real (CREATE OR REPLACE FUNCTION … último
 * GRANT EXECUTE), excluindo o comentário de cabeçalho e o rodapé de
 * verificação — mesmo helper usado em gestorMigrationsVisaoGeralDetalhamento
 * .test.ts, necessário porque o cabeçalho documenta de propósito a chamada
 * antiga (user_can_access_ies, razão crua) para explicar o que foi trocado.
 */
function codeOnly(body: string): string {
  const start = body.indexOf('CREATE OR REPLACE FUNCTION');
  const lastGrant = body.lastIndexOf('GRANT EXECUTE');
  const end = body.indexOf('\n', lastGrant);
  return body.slice(start, end === -1 ? body.length : end);
}

describe('migration get_gestor_detalhamento (gaps 119, 112 e 117)', () => {
  const FILE = '20260804170500_get_gestor_detalhamento_ies_helper_tri_dedupe_arredondamento.sql';
  const sql = () => readMigration(FILE);

  it('autoriza a IES resolvida via gestor_pode_acessar_ies, não mais via user_can_access_ies (gap 119)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/IF NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN/);
    // não há mais CHAMADA a user_can_access_ies no código (o nome ainda
    // aparece em um comentário explicativo, ancorando "substitui ... " --
    // por isso o regex exige a sintaxe de chamada, não a string nua).
    expect(code).not.toMatch(/public\.user_can_access_ies\(v_uid/);
  });

  it('resolve v_ies (ambos os ramos) ANTES de autorizar, e autoriza ANTES da feature (ordem do preâmbulo)', () => {
    const code = codeOnly(sql());
    const idxIesResolvida = code.indexOf('IES not resolved');
    const idxAutorizacao = code.indexOf('gestor_pode_acessar_ies');
    const idxFeature = code.indexOf('user_has_feature_for_ies');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxIesResolvida);
    expect(idxFeature).toBeGreaterThan(idxAutorizacao);
  });

  it('não mantém a mensagem de erro nem a assinatura do guard alteradas (front-end mapeia a string)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/RAISE EXCEPTION 'Permission denied: cannot access this IES';/);
  });

  it('deduplica resultados_alunos_tri para uma linha por (student_id, pai_id) antes de contar/agregar (gap 112)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/tri_raw AS \(/);
    expect(code).toMatch(/DISTINCT ON \(t\.student_id, t\.pai_id\)/);
    // O desempate tem que ser o CANONICO da rodada — `score_proprio DESC`, a maior nota —
    // e nao a tentativa mais recente. A primeira versao desta migration usava
    // `data_ref DESC`, coerente com as CTEs `ultima`/`ultima_fb` desta funcao mas
    // DIVERGENTE de get_gestor_visao_geral, get_gestor_alunos e get_gestor_aluno, que
    // usam `score_proprio DESC`. Dois criterios corretos e incoerentes entre si nao
    // fecham o gap 112 — so o trocam de lugar: o mesmo aluno no mesmo simulado voltaria
    // a dar numero diferente em duas telas. Este teste existe para travar a COERENCIA
    // entre as quatro, nao a escolha em si.
    expect(code).toMatch(/ORDER BY t\.student_id, t\.pai_id, t\.score_proprio DESC/);
    expect(code).not.toMatch(/ORDER BY t\.student_id, t\.pai_id, t\.data_ref DESC/);
    // n_tri/n_prof/prof_media continuam lendo de `tri` (agora deduplicada), não de tri_raw
    expect(code).toMatch(/FROM tri t WHERE t\.pai_id = s\.id\) AS n_tri/);
    expect(code).toMatch(/FROM tri t WHERE t\.pai_id = s\.id\) AS n_prof/);
    expect(code).toMatch(/\(SELECT avg\(t\.score_proprio\) FROM tri t WHERE t\.pai_id = s\.id\) AS prof_media/);
  });

  it('classifica "critica" sobre o mesmo valor arredondado exposto em "acertoPct", não sobre a razão crua (gap 117)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/areas_nivel AS \(/);
    expect(code).toMatch(/round\(100\.0 \* a\.acertos \/ NULLIF\(a\.total,0\), 0\) AS acerto_pct/);
    expect(code).toMatch(/'acertoPct',\s*a\.acerto_pct,/);
    expect(code).toMatch(/'critica',\s*COALESCE\(a\.acerto_pct < 30, false\)/);
    // o bug original: 'critica' recomputava a razão crua dentro do próprio jsonb_build_object
    expect(code).not.toMatch(/'critica',\s*COALESCE\(\(100\.0 \* a\.acertos/);
  });

  it('não regride o mascaramento de gabarito de prova aberta (achado 14, v_aberta)', () => {
    const code = codeOnly(sql());
    expect(code).toMatch(/'correta',\s*CASE WHEN v_aberta THEN NULL ELSE \(a\.letra = f\.correta\) END/);
    expect(code).toMatch(/v_aberta\s+boolean/);
  });

  it('preserva SECURITY DEFINER, STABLE, search_path e o grant original', () => {
    const body = sql();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/\bSTABLE\b/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_gestor_detalhamento\(uuid, text, uuid\[\]\) TO authenticated;/);
  });
});
