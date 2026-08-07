/**
 * Testes estaticos da migration
 * `20260807030000_announcements_rls_publico_alvo.sql` (Task 6 do PR 1 de
 * simplificacao de acesso, 07/08) -- a policy de SELECT de
 * `public.announcements` passa a filtrar por persona (aluno vs. gestor),
 * fechando o furo em que qualquer autenticado lia aviso de gestor direto
 * via `GET /rest/v1/announcements`, contornando o filtro que so existia
 * dentro da RPC `get_gestor_avisos`.
 *
 * Regra de persona (ver cabecalho da migration): particao binaria pelo
 * papel do LEITOR -- admin, gestor ou gestor_grupo (o mesmo conjunto que
 * guarda as 11 RPCs get_gestor_*) cai no ramo 'gestor'; todo o resto cai
 * no ramo 'aluno'. Nao e uniao por papel: um usuario com dois papeis so
 * ve um dos dois baldes por esta policy. Admin ve tudo mesmo assim,
 * porque a policy separada "Admins can manage announcements" (FOR ALL)
 * e permissiva e o postgres combina policies permissivas do mesmo
 * comando com OR -- o SELECT do admin passa por aquela, independente
 * desta.
 *
 * Isto e analise de texto sobre a migration (mesmo metodo dos testes
 * `gestorMigrations*` e `hardeningFuncoesDePapel`), NAO prova de RLS --
 * RLS so se prova executando contra o Postgres com usuarios reais.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const FILE = '20260807030000_announcements_rls_publico_alvo.sql';

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF, mesmo motivo do hardeningFuncoesDePapel.test.ts:
  // numa maquina com core.autocrlf=true o checkout materializa \r\n.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const sql = readMigration(FILE);

/** Corpo da policy "Users can view their IES announcements": do CREATE
 *  POLICY que a declara até o `);` que fecha o USING. */
function corpoDaPolicy(texto: string, nome: string): string {
  const marcador = `CREATE POLICY "${nome}"`;
  const inicio = texto.indexOf(marcador);
  expect(inicio, `policy "${nome}" não encontrada em ${FILE}`).toBeGreaterThanOrEqual(0);
  const fim = texto.indexOf(');', inicio);
  expect(fim, `policy "${nome}" não fecha com ");"`).toBeGreaterThan(inicio);
  return texto.slice(inicio, fim + 2);
}

describe('Task 6 (07/08) — migration 20260807030000_announcements_rls_publico_alvo.sql', () => {
  it('recria a policy por DROP + CREATE (RLS não tem ALTER POLICY USING)', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Users can view their IES announcements" ON public\.announcements;/,
    );
    expect(sql).toMatch(/CREATE POLICY "Users can view their IES announcements"/);
  });

  it('a policy de announcements filtra por publico_alvo', () => {
    const corpo = corpoDaPolicy(sql, 'Users can view their IES announcements');
    expect(corpo).toMatch(/publico_alvo/);
  });

  it('preserva os filtros que já existiam (regressão real seria perder um destes)', () => {
    const corpo = corpoDaPolicy(sql, 'Users can view their IES announcements');
    expect(corpo).toMatch(/ativo = true/);
    expect(corpo).toMatch(/data_expiracao IS NULL OR data_expiracao > now\(\)/);
    expect(corpo).toMatch(/visibilidade = 'todas'/);
    expect(corpo).toMatch(/visibilidade = 'seletivo' AND get_current_user_ies_id\(\) = ANY\(ies_selecionadas\)/);
    expect(corpo).toMatch(
      /visibilidade = 'exceto' AND NOT \(get_current_user_ies_id\(\) = ANY\(ies_excluidas\)\)/,
    );
  });

  it('quem tem admin, gestor ou gestor_grupo cai no ramo gestor da persona', () => {
    const corpo = corpoDaPolicy(sql, 'Users can view their IES announcements');
    expect(corpo).toMatch(/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
    expect(corpo).toMatch(/has_role\(auth\.uid\(\), 'gestor'::app_role\)/);
    expect(corpo).toMatch(/has_role\(auth\.uid\(\), 'gestor_grupo'::app_role\)/);
    expect(corpo).toMatch(/THEN 'gestor' = ANY\(COALESCE\(publico_alvo, ARRAY\['aluno'\]::text\[\]\)\)/);
  });

  it('todo o resto (sem esses três papéis) cai no ramo aluno, por padrão', () => {
    const corpo = corpoDaPolicy(sql, 'Users can view their IES announcements');
    expect(corpo).toMatch(/ELSE 'aluno' = ANY\(COALESCE\(publico_alvo, ARRAY\['aluno'\]::text\[\]\)\)/);
  });

  it('a policy roda para authenticated, no comando SELECT', () => {
    expect(sql).toMatch(/FOR SELECT\s*\nTO authenticated/);
  });

  it('não toca a policy "Admins can manage announcements" (só a menciona em comentário)', () => {
    expect(sql).not.toMatch(/(DROP|CREATE) POLICY "Admins can manage announcements"/);
  });

  it('o cabeçalho registra que a migration não foi aplicada em produção', () => {
    expect(sql).toMatch(/NAO FOI APLICADA em producao/);
  });
});
