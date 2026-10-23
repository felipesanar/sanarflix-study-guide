/**
 * Testes estáticos das migrations do Engajamento SanarFlix (camada `eng_*` e
 * RPCs `get_gestor_engajamento_*` / `get_admin_engajamento`).
 *
 * Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md
 * (§5 grants das tabelas, §7.1/§7.2 forma das RPCs, §15.2 testes).
 *
 * Não há banco aqui: o arquivo lê o texto das migrations e prova, por padrão,
 * as regras de segurança que não podem regredir:
 *  - tabela nova revoga de PUBLIC, anon E authenticated e liga RLS (o default
 *    ACL do Supabase dá tudo a anon/authenticated);
 *  - função interna `eng_*` revoga de PUBLIC, anon e authenticated;
 *  - RPC do gestor segue a ordem papel → v_ies → gestor_pode_acessar_ies e não
 *    usa feature flag nem lê as fatos/JSON da origem;
 *  - RPC do admin exige has_role(admin) antes de qualquer WITH e não emite
 *    dado individual de aluno.
 *
 * A fonte é sempre a migration MAIS RECENTE que recria a função (mesmo padrão
 * de gestorMigrationsAvisosAlunoContatoContexto.test.ts): um .sql pinado nunca
 * fica vermelho quando outro arquivo o substitui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  // CRLF -> LF: com core.autocrlf=true o checkout materializa os .sql com \r\n.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

function migrationsOrdenadas(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** O `(` no fim evita que `get_gestor_engajamento_aluno` case com `..._alunos`. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

function vigente(nome: string): { arquivo: string; sql: string } {
  const marca = cabecalhoDe(nome);
  const candidatos = migrationsOrdenadas()
    .map((arquivo) => ({ arquivo, sql: readMigration(arquivo) }))
    .filter(({ sql }) => sql.includes(marca));
  expect(candidatos.length, `nenhuma migration recria ${nome}`).toBeGreaterThan(0);
  return candidatos[candidatos.length - 1];
}

/** Remove linhas que são só comentário SQL (a prosa não é executada). */
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*--/.test(linha))
    .join('\n');

/** Corpo de UMA função: do CREATE até o dollar-quote que a fecha. */
function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(cabecalhoDe(nome));
  expect(inicio, `função ${nome} não encontrada na migration`).toBeGreaterThanOrEqual(0);
  const abertura = /\bAS\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(inicio));
  expect(abertura, `não achei o dollar-quote que abre o corpo de ${nome}`).not.toBeNull();
  const tag = abertura![1];
  const fim = sql.indexOf(`${tag};`, inicio + abertura!.index + abertura![0].length);
  expect(fim, `função ${nome} não fecha com ${tag};`).toBeGreaterThan(inicio);
  return sql.slice(inicio, fim + tag.length + 1);
}

const corpoVigente = (nome: string) => semComentarios(corpoDaFuncao(vigente(nome).sql, nome));

/** Migrations do Engajamento: as que criam tabela/função `eng_*` ou as RPCs novas. */
function migrationsDoEngajamento(): string[] {
  return migrationsOrdenadas().filter((arquivo) => {
    const sql = readMigration(arquivo);
    return /CREATE (?:OR REPLACE )?FUNCTION public\.(?:eng_|get_gestor_engajamento_|get_admin_engajamento)/.test(sql)
      || /CREATE TABLE public\.eng_/.test(sql);
  });
}

const RPCS_DO_GESTOR = [
  'get_gestor_engajamento_alunos',
  'get_gestor_engajamento_aluno',
  'get_gestor_engajamento_conteudo_alunos',
  'get_gestor_engajamento_conteudos',
  'get_gestor_engajamento_export_alunos',
  'get_gestor_engajamento_lista',
  'get_gestor_engajamento_questoes',
  'get_gestor_engajamento_questoes_alunos',
  'get_gestor_engajamento_visao_geral',
];

/** Assinatura (tipos) de cada RPC, §8.11 — a mesma que o REVOKE/GRANT precisa citar. */
const ASSINATURAS: Record<string, string> = {
  get_gestor_engajamento_visao_geral: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_alunos: 'uuid, date, date, smallint, text, text, boolean, integer, integer',
  get_gestor_engajamento_lista: 'uuid, date, date, smallint, text, text, text, integer, integer',
  get_gestor_engajamento_aluno: 'uuid, date, date, text',
  get_gestor_engajamento_questoes: 'uuid, date, date, smallint',
  get_gestor_engajamento_questoes_alunos: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_conteudos: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_conteudo_alunos: 'uuid, date, date, smallint, text, text, text',
  get_gestor_engajamento_export_alunos: 'uuid, date, date, smallint, text, text, boolean',
};

describe('RPCs get_gestor_engajamento_* (spec §7.1)', () => {
  it('descobre as 9 RPCs do Engajamento — se este número mudar, o escopo dos testes mudou', () => {
    const nomes = new Set<string>();
    for (const arquivo of migrationsOrdenadas()) {
      for (const m of readMigration(arquivo).matchAll(
        /CREATE OR REPLACE FUNCTION public\.(get_gestor_engajamento_[a-z_]+)\(/g,
      )) {
        nomes.add(m[1]);
      }
    }
    expect([...nomes].sort()).toEqual([...RPCS_DO_GESTOR].sort());
  });

  describe.each(RPCS_DO_GESTOR)('%s', (nome) => {
    const corpo = corpoVigente(nome);
    const migration = vigente(nome);

    it('é SECURITY DEFINER, STABLE e SET search_path TO \'public\'', () => {
      expect(corpo).toMatch(/SECURITY DEFINER/);
      expect(corpo).toMatch(/\bSTABLE\b/);
      expect(corpo).toMatch(/SET search_path TO 'public'/);
    });

    it('mantém a ordem papel → resolução de v_ies → gestor_pode_acessar_ies → validação de período', () => {
      const idxPapel = corpo.indexOf("has_role(v_uid,'admin'::app_role)");
      const idxResolucao = corpo.indexOf('IES not resolved');
      const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
      const idxPeriodo = corpo.indexOf('eng_validar_periodo');
      expect(idxPapel).toBeGreaterThan(-1);
      expect(corpo).toMatch(/has_role\(v_uid,'gestor'::app_role\)/);
      expect(corpo).toMatch(/has_role\(v_uid,'gestor_grupo'::app_role\)/);
      expect(idxResolucao).toBeGreaterThan(idxPapel);
      expect(idxAutorizacao).toBeGreaterThan(idxResolucao);
      expect(idxPeriodo).toBeGreaterThan(idxAutorizacao);
      expect(corpo).toMatch(/Permission denied: cannot access this IES/);
    });

    it('não usa feature flag nem lê as fatos / JSON da origem (só eng_* e dim via eng_base_ativa)', () => {
      expect(corpo).not.toMatch(/ies_features/);
      expect(corpo).not.toMatch(/feature_catalog/);
      expect(corpo).not.toMatch(/gestao\.portal_v2/);
      expect(corpo).not.toMatch(/gestao\.enabled/);
      expect(corpo).not.toMatch(/user_has_feature/);
      expect(corpo).not.toMatch(/\bfato_/);
      expect(corpo).not.toMatch(/taxonomias/);
      expect(corpo).not.toMatch(/contextos_candidatos/);
    });

    it("devolve o envelope { data, meta }: o literal 'data', jsonb_build_object( existe e meta vem de eng_meta", () => {
      expect(corpo).toContain("'data', jsonb_build_object(");
      expect(corpo).toMatch(/'meta',\s*public\.eng_meta\(/);
    });

    it('revoga de PUBLIC e anon e concede a authenticated, com a assinatura da §8.11', () => {
      const tipos = ASSINATURAS[nome];
      expect(tipos, `assinatura de ${nome} não cadastrada neste teste`).toBeDefined();
      expect(migration.sql).toContain(
        `REVOKE ALL ON FUNCTION public.${nome}(${tipos}) FROM PUBLIC, anon;`,
      );
      expect(migration.sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${nome}(${tipos}) TO authenticated;`,
      );
    });
  });

  it('só get_gestor_engajamento_export_alunos devolve e-mail', () => {
    for (const nome of RPCS_DO_GESTOR) {
      const corpo = corpoVigente(nome);
      const emiteEmail = /'email'\s*,/.test(corpo);
      expect(emiteEmail, `${nome}: e-mail só é permitido na exportação`).toBe(
        nome === 'get_gestor_engajamento_export_alunos',
      );
    }
  });
});

describe('get_admin_engajamento (spec §7.2)', () => {
  const nome = 'get_admin_engajamento';
  const corpo = corpoVigente(nome);
  const migration = vigente(nome);

  it('é SECURITY DEFINER, STABLE e SET search_path TO \'public\'', () => {
    expect(corpo).toMatch(/SECURITY DEFINER/);
    expect(corpo).toMatch(/\bSTABLE\b/);
    expect(corpo).toMatch(/SET search_path TO 'public'/);
  });

  it("exige has_role(auth.uid(), 'admin') antes de qualquer WITH", () => {
    const idxPapel = corpo.indexOf("public.has_role(auth.uid(), 'admin'::app_role)");
    const idxWith = corpo.search(/\bWITH\b/);
    expect(idxPapel).toBeGreaterThan(-1);
    expect(idxWith).toBeGreaterThan(idxPapel);
    expect(corpo).toMatch(/RAISE EXCEPTION 'admin role required'/);
  });

  it('revoga de PUBLIC e anon e concede a authenticated', () => {
    expect(migration.sql).toContain(
      'REVOKE ALL ON FUNCTION public.get_admin_engajamento(date, date, smallint) FROM PUBLIC, anon;',
    );
    expect(migration.sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_admin_engajamento(date, date, smallint) TO authenticated;',
    );
  });

  it('não emite dado individual de aluno (sem e-mail, nome de aluno nem sanarflix_user_id como chave)', () => {
    expect(corpo).not.toMatch(/'email'\s*,/);
    expect(corpo).not.toMatch(/'sanarflix_user_id'\s*,/);
    expect(corpo).not.toMatch(/'alunoId'|'aluno'\s*,/);
    expect(corpo).not.toMatch(/r\.nome|\.email/);
  });

  it('não usa feature flag nem lê as fatos / JSON da origem', () => {
    expect(corpo).not.toMatch(/ies_features/);
    expect(corpo).not.toMatch(/feature_catalog/);
    expect(corpo).not.toMatch(/\bfato_/);
    expect(corpo).not.toMatch(/taxonomias/);
  });

  it('devolve o envelope { data, meta } com o critério do admin (inclui a proficiência)', () => {
    expect(corpo).toContain("'data', jsonb_build_object(");
    expect(corpo).toMatch(/'meta',\s*public\.eng_meta\(.*v_criterio_admin\)/);
    expect(corpo).toMatch(/Proficiência: % de alunos com 60 pontos ou mais/);
  });
});

describe('camada eng_* — grants (spec §5)', () => {
  const arquivos = migrationsDoEngajamento();

  it('encontra as migrations do Engajamento', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(8);
  });

  const tabelas: { tabela: string; arquivo: string; sql: string }[] = [];
  for (const arquivo of arquivos) {
    const sql = readMigration(arquivo);
    for (const m of sql.matchAll(/CREATE TABLE public\.(eng_[a-z_]+)\s*\(/g)) {
      tabelas.push({ tabela: m[1], arquivo, sql });
    }
  }

  it('descobre as 7 tabelas eng_*', () => {
    expect(tabelas.map((t) => t.tabela).sort()).toEqual([
      'eng_atividade_aluno_dia',
      'eng_consumo_aluno_dia_conteudo',
      'eng_depara_quiz_no',
      'eng_no_taxonomia',
      'eng_questao_classificacao',
      'eng_questoes_aluno_dia_no',
      'eng_refresh_log',
    ]);
  });

  it.each(tabelas.map((t) => [t.tabela, t] as const))(
    '%s liga RLS e revoga de PUBLIC, anon e authenticated na mesma migration',
    (_nome, { tabela, sql }) => {
      expect(sql).toContain(`ALTER TABLE public.${tabela}`);
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${tabela}\\s+ENABLE ROW LEVEL SECURITY;`));
      expect(sql).toContain(`REVOKE ALL ON TABLE public.${tabela}`);
      expect(sql).toMatch(
        new RegExp(`REVOKE ALL ON TABLE public\\.${tabela}\\s+FROM PUBLIC, anon, authenticated;`),
      );
    },
  );

  it('tabelas com identity revogam também a sequência de PUBLIC, anon e authenticated', () => {
    for (const { tabela, sql } of tabelas) {
      const bloco = sql.slice(sql.indexOf(`CREATE TABLE public.${tabela}`));
      const fim = bloco.indexOf(');');
      const definicao = bloco.slice(0, fim);
      if (/GENERATED ALWAYS AS IDENTITY/.test(definicao)) {
        expect(sql, `${tabela}: falta REVOKE da sequência`).toMatch(
          new RegExp(`REVOKE ALL ON SEQUENCE public\\.${tabela}_id_seq\\s+FROM PUBLIC, anon, authenticated;`),
        );
      }
    }
  });

  it('nenhuma tabela eng_* recebe GRANT para anon, authenticated ou PUBLIC em migration alguma', () => {
    for (const arquivo of migrationsOrdenadas()) {
      const sql = semComentarios(readMigration(arquivo));
      expect(sql, arquivo).not.toMatch(/GRANT [A-Z, ]+ ON (?:TABLE )?public\.eng_[a-z_]+ TO (?:PUBLIC|anon|authenticated)/);
    }
  });

  it('toda função public.eng_* revoga de PUBLIC, anon e authenticated na mesma migration', () => {
    for (const arquivo of arquivos) {
      const sql = readMigration(arquivo);
      const criadas = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(eng_[a-z_]+)\(/g)].map((m) => m[1]);
      if (criadas.length === 0) continue;
      const revogadas = new Set<string>();
      for (const stmt of sql.matchAll(/REVOKE ALL ON FUNCTION ([^;]+?)\s+FROM PUBLIC, anon, authenticated;/g)) {
        for (const f of stmt[1].matchAll(/public\.(eng_[a-z_]+)\(/g)) revogadas.add(f[1]);
      }
      for (const funcao of criadas) {
        expect(revogadas.has(funcao), `${arquivo}: ${funcao} sem REVOKE de PUBLIC, anon, authenticated`).toBe(true);
      }
    }
  });

  it('nenhuma função eng_* é concedida a authenticated ou anon', () => {
    for (const arquivo of migrationsOrdenadas()) {
      const sql = semComentarios(readMigration(arquivo));
      expect(sql, arquivo).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.eng_[a-z_]+\([^)]*\) TO (?:PUBLIC|anon|authenticated)/);
    }
  });
});

describe('pipeline e cron (spec §6)', () => {
  const pipeline = semComentarios(readMigration(vigente('eng_refresh').arquivo));
  const refresh = corpoVigente('eng_refresh');

  it('reconstrói com DELETE, nunca TRUNCATE (TRUNCATE travaria as RPCs durante o refresh)', () => {
    expect(pipeline).not.toMatch(/\bTRUNCATE\b/i);
    expect(pipeline).toMatch(/DELETE FROM public\.eng_questao_classificacao/);
    expect(pipeline).toMatch(/DELETE FROM public\.eng_atividade_aluno_dia/);
    expect(pipeline).toMatch(/DELETE FROM public\.eng_questoes_aluno_dia_no/);
    expect(pipeline).toMatch(/DELETE FROM public\.eng_consumo_aluno_dia_conteudo/);
  });

  it('nunca apaga nós da taxonomia (as FKs ficam estáveis entre refreshes)', () => {
    expect(pipeline).not.toMatch(/DELETE FROM public\.eng_no_taxonomia/);
    expect(pipeline).toMatch(/INSERT INTO public\.eng_no_taxonomia[\s\S]*?ON CONFLICT \(no_id\) DO UPDATE/);
  });

  it('eng_refresh tem exclusão mútua, log de erro e só aceita cron|manual', () => {
    expect(refresh).toMatch(/pg_try_advisory_xact_lock\(hashtext\('eng_refresh'\)\)/);
    expect(refresh).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(refresh).toMatch(/p_disparo NOT IN \('cron', 'manual'\)/);
  });

  it('as tabelas temporárias do pipeline somem no COMMIT', () => {
    const criacoes = [...pipeline.matchAll(/CREATE TEMP TABLE (tmp_eng_[a-z_]+)([^\n]*)/g)];
    expect(criacoes.length).toBeGreaterThanOrEqual(5);
    for (const [, nome, resto] of criacoes) {
      expect(resto, `${nome} sem ON COMMIT DROP`).toMatch(/ON COMMIT DROP/);
    }
  });

  it('o de-para nasce vazio: nenhuma migration insere em eng_depara_quiz_no', () => {
    for (const arquivo of migrationsOrdenadas()) {
      expect(semComentarios(readMigration(arquivo)), arquivo).not.toMatch(
        /INSERT INTO public\.eng_depara_quiz_no/,
      );
    }
  });

  it('o cron é idempotente, roda às 09:00 UTC (06:00 BRT) e fixa statement_timeout de 30 min no mesmo comando', () => {
    const arquivo = migrationsOrdenadas().find((f) => /eng-refresh-diario/.test(readMigration(f)));
    expect(arquivo, 'nenhuma migration agenda eng-refresh-diario').toBeDefined();
    const sql = semComentarios(readMigration(arquivo!));
    const idxUnschedule = sql.indexOf('cron.unschedule');
    const idxSchedule = sql.indexOf('cron.schedule');
    expect(idxUnschedule).toBeGreaterThan(-1);
    expect(idxSchedule).toBeGreaterThan(idxUnschedule);
    expect(sql).toMatch(/'0 9 \* \* \*'/);
    expect(sql).toMatch(/SET statement_timeout TO '30min'; SELECT public\.eng_refresh\('cron'\);/);
  });
});
