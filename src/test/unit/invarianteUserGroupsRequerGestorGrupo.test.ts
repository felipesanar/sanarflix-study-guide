/**
 * Testes estáticos da migration
 * `20260807040000_invariante_user_groups_requer_gestor_grupo.sql` (PR 1 —
 * invariante de banco que fecha um furo de autorização pela raiz).
 *
 * O FURO, EM UMA FRASE: nove RLS policies, em seis tabelas, autorizam leitura
 * por `public.get_accessible_ies(auth.uid())`, que soma à IES própria todas
 * as IES dos grupos do usuário em `user_groups` — sem olhar o papel. Um
 * usuário rebaixado de `gestor_grupo` para `gestor` cuja linha em
 * `user_groups` não foi limpa mantém acesso de grupo por essa via, mesmo sem
 * ter mais o papel que o justificava.
 *
 * A CORREÇÃO É A INVARIANTE, NÃO AS NOVE POLICIES: em vez de reescrever as
 * policies (lidas também pelo aluno — risco desproporcional a um alvo medido
 * em zero instâncias em produção em 07/08/2026), esta migration torna
 * IMPOSSÍVEL o estado que as explora: só quem tem `gestor_grupo` em
 * `public.user_roles` pode ter linha em `public.user_groups`. Duas triggers,
 * as duas bordas do mesmo problema — cobrir só uma deixaria o furo aberto
 * pela outra:
 *   1) BEFORE INSERT OR UPDATE ON user_groups — recusa sem o papel.
 *   2) AFTER DELETE OR UPDATE ON user_roles — limpa (DELETE) o user_groups
 *      órfão quando o usuário perde gestor_grupo (é o vetor real: o console
 *      do admin roda `DELETE ... user_roles` isolado ao desmarcar a
 *      checkbox "Gestor de Grupo" em `src/components/admin/UsersListTable.tsx`).
 *
 * Não há harness de pgTAP neste repo — este arquivo é análise de texto sobre
 * a migration (mesmo método de `corpoDaFuncao` usado em
 * `gestorMigrations*.test.ts` e `hardeningFuncoesDePapel.test.ts`), não teste
 * de execução real contra o Postgres. Ele prova que o TEXTO das duas triggers
 * está no arquivo certo, nas tabelas certas, nos eventos certos, e que as
 * nove policies e as três funções de autorização (`get_accessible_ies`,
 * `gestor_pode_acessar_ies`, `has_role`) não foram tocadas — NÃO prova que a
 * trigger de fato dispara e recusa/limpa em runtime. Provar comportamento
 * exigiria banco.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const FILE = '20260807040000_invariante_user_groups_requer_gestor_grupo.sql';

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa maquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as assercoes abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf).
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const sql = readMigration(FILE);

/** O `(` no fim nao e enfeite: sem ele, um nome casaria com qualquer outra
 *  funcao cujo nome comece com o mesmo prefixo. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

/** Corpo de UMA funcao: do seu CREATE até o dollar-quote que o fecha (lido de
 *  `AS $tag$`, nao fixado). */
function corpoDaFuncao(texto: string, nome: string): string {
  const inicio = texto.indexOf(cabecalhoDe(nome));
  expect(inicio, `função ${nome} não encontrada em ${FILE}`).toBeGreaterThanOrEqual(0);
  const abertura = /\bAS\s+(\$[A-Za-z_]*\$)/.exec(texto.slice(inicio));
  expect(abertura, `não achei o dollar-quote que abre o corpo de ${nome}`).not.toBeNull();
  const tag = abertura![1];
  const fim = texto.indexOf(`${tag};`, inicio + abertura!.index + abertura![0].length);
  expect(fim, `função ${nome} não fecha com ${tag};`).toBeGreaterThan(inicio);
  return texto.slice(inicio, fim + tag.length + 1);
}

describe('PR 1 — migration 20260807040000_invariante_user_groups_requer_gestor_grupo.sql', () => {
  it('cria as duas funcoes de trigger com CREATE OR REPLACE (nunca DROP FUNCTION)', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_user_groups_requer_gestor_grupo\(/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.limpa_user_groups_ao_perder_gestor_grupo\(/);
    expect(sql).not.toMatch(/DROP FUNCTION/);
  });

  it('as duas funcoes de trigger retornam trigger, SECURITY DEFINER, com search_path fixo', () => {
    for (const nome of [
      'enforce_user_groups_requer_gestor_grupo',
      'limpa_user_groups_ao_perder_gestor_grupo',
    ]) {
      const corpo = corpoDaFuncao(sql, nome);
      expect(corpo, nome).toMatch(/RETURNS trigger/i);
      expect(corpo, nome).toMatch(/SECURITY DEFINER/);
      expect(corpo, nome).toMatch(/SET search_path = public, pg_temp/);
    }
  });

  it('borda 1: trigger na tabela e eventos certos (BEFORE INSERT OR UPDATE em user_groups)', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_user_groups_requer_gestor_grupo\s+BEFORE INSERT OR UPDATE ON public\.user_groups\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.enforce_user_groups_requer_gestor_grupo\(\)/,
    );
    // idempotente: DROP TRIGGER IF EXISTS antes do CREATE, mesmo padrao das
    // outras triggers do repo.
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_user_groups_requer_gestor_grupo ON public\.user_groups;/);
  });

  it('borda 1: recusa quando o usuario nao tem gestor_grupo em user_roles', () => {
    const corpo = corpoDaFuncao(sql, 'enforce_user_groups_requer_gestor_grupo');
    expect(corpo).toMatch(/NOT EXISTS/);
    expect(corpo).toMatch(/FROM public\.user_roles ur/);
    expect(corpo).toMatch(/ur\.user_id = NEW\.user_id/);
    expect(corpo).toMatch(/ur\.role = 'gestor_grupo'::public\.app_role/);
    expect(corpo).toMatch(/RAISE EXCEPTION/);
  });

  it('borda 2: trigger na tabela e eventos certos (AFTER DELETE OR UPDATE em user_roles)', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_limpa_user_groups_ao_perder_gestor_grupo\s+AFTER DELETE OR UPDATE ON public\.user_roles\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.limpa_user_groups_ao_perder_gestor_grupo\(\)/,
    );
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_limpa_user_groups_ao_perder_gestor_grupo ON public\.user_roles;/,
    );
  });

  it('borda 2: so age quando a linha afetada tinha role = gestor_grupo (DELETE ou UPDATE)', () => {
    const corpo = corpoDaFuncao(sql, 'limpa_user_groups_ao_perder_gestor_grupo');
    expect(corpo).toMatch(/TG_OP = 'DELETE'/);
    expect(corpo).toMatch(/OLD\.role = 'gestor_grupo'::public\.app_role/);
    expect(corpo).toMatch(/TG_OP = 'UPDATE'/);
    expect(corpo).toMatch(/NEW\.role IS DISTINCT FROM 'gestor_grupo'::public\.app_role/);
  });

  it('borda 2: reconfirma que o usuario nao tem mais gestor_grupo antes de limpar (defensivo)', () => {
    const corpo = corpoDaFuncao(sql, 'limpa_user_groups_ao_perder_gestor_grupo');
    // duas ocorrencias do papel: a deteccao de perda (OLD/NEW) e a
    // reconfirmacao via EXISTS antes do DELETE.
    expect(corpo).toMatch(/IF EXISTS \(\s*SELECT 1 FROM public\.user_roles ur/);
  });

  it('borda 2: limpa via DELETE em user_groups, nunca UPDATE nem soft-delete', () => {
    const corpo = corpoDaFuncao(sql, 'limpa_user_groups_ao_perder_gestor_grupo');
    expect(corpo).toMatch(/DELETE FROM public\.user_groups/);
    expect(corpo).toMatch(/WHERE user_id = v_user_id/);
  });

  it('borda 2: log em admin_audit_log e condicional a auth.uid() nao ser nulo (best-effort)', () => {
    const corpo = corpoDaFuncao(sql, 'limpa_user_groups_ao_perder_gestor_grupo');
    expect(corpo).toMatch(/v_admin_id\s*:=\s*auth\.uid\(\)/);
    expect(corpo).toMatch(/IF v_admin_id IS NOT NULL THEN/);
    expect(corpo).toMatch(/INSERT INTO public\.admin_audit_log \(admin_id, action, target_user_id, metadata\)/);
    // nao e tabela nova: usa a que ja existe, sem CREATE TABLE nem ALTER
    // TABLE nela.
    expect(sql).not.toMatch(/CREATE TABLE[^;]*admin_audit_log/i);
    expect(sql).not.toMatch(/ALTER TABLE[^;]*admin_audit_log/i);
  });

  it('migration aditiva: nenhum ALTER TABLE em coluna existente, nenhum DROP de algo que nao seja seu', () => {
    expect(sql).not.toMatch(/ALTER TABLE/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DROP POLICY/i);
  });

  it('nenhuma das nove RLS policies "Gestor de grupo pode ver ..." e tocada (nenhum DDL de policy no arquivo)', () => {
    // O texto "Gestor de grupo pode ver" aparece no CABECALHO, em prosa,
    // explicando a decisao de NAO tocar as policies -- por isso a asserção
    // que importa é sobre DDL de policy, não sobre a string aparecer em
    // comentário.
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/ALTER POLICY/i);
  });

  it('nenhuma das tres funcoes de autorizacao (get_accessible_ies, gestor_pode_acessar_ies, has_role) e recriada', () => {
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.get_accessible_ies\(/i);
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.gestor_pode_acessar_ies\(/i);
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.has_role\(/i);
  });

  it('o cabecalho registra decisao: as nove policies continuam autorizando por get_accessible_ies', () => {
    expect(sql).toMatch(/DECISAO REGISTRADA/);
    // Cada linha do cabecalho e um comentario SQL ("-- ..."); a frase quebra
    // em duas linhas, cada uma com seu proprio prefixo "--". \s+ puro nao
    // atravessa o "--" da linha seguinte -- por isso o prefixo opcional.
    expect(sql).toMatch(/nove policies CONTINUAM\s+(?:--\s*)?autorizando por get_accessible_ies/);
  });

  it('o cabecalho traz a consulta de verificacao pre-aplicacao (orfaos == zero)', () => {
    // Mesmo cuidado com a quebra de linha comentada (ver teste acima).
    expect(sql).toMatch(
      /SELECT ug\.user_id FROM public\.user_groups ug\s+(?:--\s*)?WHERE NOT EXISTS \(SELECT 1 FROM public\.user_roles ur\s+(?:--\s*)?WHERE ur\.user_id = ug\.user_id AND ur\.role = 'gestor_grupo'\);/,
    );
  });

  it('o cabecalho registra que a migration nao foi aplicada em producao', () => {
    expect(sql).toMatch(/NAO FOI APLICADA em producao \(07\/08\/2026\)/);
  });

  it('o cabecalho explica por que a correcao e a invariante e nao a reescrita das policies', () => {
    expect(sql).toMatch(/POR QUE A CORRECAO E A INVARIANTE/);
  });
});
