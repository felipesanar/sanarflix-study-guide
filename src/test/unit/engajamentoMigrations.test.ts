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
import { FEATURE_ENGAJAMENTO } from '@/features/gestor/lib/engajamento';
import { GESTAO_FEATURES_NO_PAINEL } from '@/services/admin/featureCatalog';

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
  'get_gestor_engajamento_versao',
  'get_gestor_engajamento_visao_geral',
];

/** Refresh incremental, Fase 5: a RPC de versão não recebe período, então não valida datas. */
const SEM_PERIODO = new Set(['get_gestor_engajamento_versao']);

/** Assinatura (tipos) de cada RPC, §8.11 — a mesma que o REVOKE/GRANT precisa citar. */
const ASSINATURAS: Record<string, string> = {
  get_gestor_engajamento_visao_geral: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_alunos: 'uuid, date, date, smallint, text, text, boolean, integer, integer, text',
  get_gestor_engajamento_lista: 'uuid, date, date, smallint, text, text, text, integer, integer, boolean',
  get_gestor_engajamento_aluno: 'uuid, date, date, text',
  get_gestor_engajamento_questoes: 'uuid, date, date, smallint',
  get_gestor_engajamento_questoes_alunos: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_conteudos: 'uuid, date, date, smallint, text',
  get_gestor_engajamento_conteudo_alunos: 'uuid, date, date, smallint, text, text, text',
  get_gestor_engajamento_export_alunos: 'uuid, date, date, smallint, text, text, boolean, text',
  get_gestor_engajamento_versao: 'uuid',
};

describe('RPCs get_gestor_engajamento_* (spec §7.1)', () => {
  it('descobre as 10 RPCs do Engajamento — se este número mudar, o escopo dos testes mudou', () => {
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

    it('mantém a ordem papel → resolução de v_ies → gestor_pode_acessar_ies → validação de período (se a RPC tem período)', () => {
      const idxPapel = corpo.indexOf("has_role(v_uid,'admin'::app_role)");
      const idxResolucao = corpo.indexOf('IES not resolved');
      const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
      const idxPeriodo = corpo.indexOf('eng_validar_periodo');
      expect(idxPapel).toBeGreaterThan(-1);
      expect(corpo).toMatch(/has_role\(v_uid,'gestor'::app_role\)/);
      expect(corpo).toMatch(/has_role\(v_uid,'gestor_grupo'::app_role\)/);
      expect(idxResolucao).toBeGreaterThan(idxPapel);
      expect(idxAutorizacao).toBeGreaterThan(idxResolucao);
      if (SEM_PERIODO.has(nome)) expect(idxPeriodo, `${nome} não tem período`).toBe(-1);
      else expect(idxPeriodo).toBeGreaterThan(idxAutorizacao);
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

    it('só responde para IES com o Engajamento liberado (ou admin): eng_acesso_liberado(v_ies) vem depois de gestor_pode_acessar_ies e antes do período', () => {
      const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
      const idxLiberacao = corpo.indexOf('public.eng_acesso_liberado(v_ies)');
      const idxPeriodo = corpo.indexOf('eng_validar_periodo');
      expect(idxLiberacao, `${nome} não chama eng_acesso_liberado(v_ies)`).toBeGreaterThan(idxAutorizacao);
      if (!SEM_PERIODO.has(nome)) expect(idxPeriodo).toBeGreaterThan(idxLiberacao);
      expect(corpo.match(/eng_acesso_liberado\(/g), `${nome}: uma checagem só`).toHaveLength(1);
      expect(corpo).toMatch(
        /IF NOT public\.eng_acesso_liberado\(v_ies\) THEN\s+RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';\s+END IF;/,
      );
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

  /** As duas RPCs que alimentam um "Exportar" de lista de alunos: as demais nunca carregam e-mail. */
  const EMITEM_EMAIL = ['get_gestor_engajamento_export_alunos', 'get_gestor_engajamento_lista'];

  it('só as RPCs de exportação devolvem e-mail (export_alunos e a lista, esta só com p_com_email)', () => {
    for (const nome of RPCS_DO_GESTOR) {
      const corpo = corpoVigente(nome);
      const emiteEmail = /'email'\s*,/.test(corpo);
      expect(emiteEmail, `${nome}: e-mail só é permitido na exportação`).toBe(EMITEM_EMAIL.includes(nome));
    }
  });

  it('get_gestor_engajamento_lista só inclui o e-mail quando p_com_email = true (a lista paginada da tela não o carrega)', () => {
    const corpo = corpoVigente('get_gestor_engajamento_lista');
    expect(corpo).toMatch(/p_com_email\s+boolean\s+DEFAULT false/);
    expect(corpo).toMatch(/CASE WHEN p_com_email THEN jsonb_build_object\('email', pg\.email\) ELSE '\{\}'::jsonb END/);
    // O único 'email' do corpo é o do ramo condicional.
    expect(corpo.match(/'email'\s*,/g)).toHaveLength(1);
  });

  it('a assinatura antiga da lista (9 parâmetros) sai do banco, senão o PostgREST fica ambíguo', () => {
    // O DROP mora na migration que mudou a assinatura (p_com_email), não na vigente: a de acesso por IES
    // (20261103180000) recria a lista com a assinatura nova, sem DROP.
    expect(readMigration('20261103120000_engajamento_lista_exporta_email.sql')).toContain(
      'DROP FUNCTION IF EXISTS public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer);',
    );
  });
});

/**
 * Liberação do Engajamento por IES (migration 20261103180000): a chave `gestao.engajamento` nasce desligada em
 * todas as IES (só admin acessa, fase de testes do time interno) e as RPCs a checam no servidor.
 */
describe('Engajamento liberado por IES (gestao.engajamento)', () => {
  const ARQUIVO = '20261103180000_engajamento_acesso_por_ies.sql';
  const sql = readMigration(ARQUIVO);
  const sqlSemComentarios = semComentarios(sql);

  it('a chave é a mesma no front (rota e menu), no painel /admin/ies e na migration — um typo em qualquer ponta separa os três', () => {
    expect(FEATURE_ENGAJAMENTO).toBe('gestao.engajamento');
    expect(GESTAO_FEATURES_NO_PAINEL).toContain(FEATURE_ENGAJAMENTO);
    expect(sql).toContain(`'${FEATURE_ENGAJAMENTO}'`);
    expect(corpoDaFuncao(sql, 'eng_acesso_liberado')).toContain(`'${FEATURE_ENGAJAMENTO}'`);
  });

  it('cadastra a chave no catálogo (experiência gestao, ativa, não master) sem ligá-la em IES alguma', () => {
    expect(sqlSemComentarios).toMatch(/INSERT INTO public\.feature_catalog[\s\S]*?\('gestao\.engajamento', 'gestao', /);
    expect(sqlSemComentarios).toMatch(/'gestao\.engajamento', 'gestao', '[^']+', '[^']+', \d+, false, true\)/);
    // Ausência de linha em ies_features = desligada: nenhuma IES ganha a chave nesta migration.
    expect(sqlSemComentarios).not.toMatch(/INSERT INTO public\.ies_features/);
    expect(sqlSemComentarios).not.toMatch(/UPDATE public\.ies_features/);
    expect(sqlSemComentarios).not.toMatch(/DELETE FROM public\.(?:feature_catalog|ies_features)/);
  });

  describe('eng_acesso_liberado(uuid)', () => {
    const corpo = semComentarios(corpoDaFuncao(sql, 'eng_acesso_liberado'));

    it('é SECURITY DEFINER, STABLE, com search_path fixo', () => {
      expect(corpo).toMatch(/SECURITY DEFINER/);
      expect(corpo).toMatch(/\bSTABLE\b/);
      expect(corpo).toMatch(/SET search_path TO 'public'/);
    });

    it('libera admin OU IES com gestao.engajamento ligada — e nada além disso (nenhum papel de gestor passa sozinho)', () => {
      expect(corpo).toMatch(/has_role\(auth\.uid\(\), 'admin'::app_role\)/);
      expect(corpo).toMatch(
        /FROM public\.ies_features f\s+WHERE f\.ies_id = p_ies AND f\.feature_key = 'gestao\.engajamento' AND f\.enabled/,
      );
      expect(corpo).not.toMatch(/has_role\(auth\.uid\(\), 'gestor/);
      // Não reintroduz o master gestao.enabled nem o rollout gestao.portal_v2 (decisões anteriores).
      expect(corpo).not.toMatch(/gestao\.enabled|gestao\.portal_v2|user_has_feature/);
    });

    it('é interna: revoga de PUBLIC, anon e authenticated e não é concedida a ninguém', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.eng_acesso_liberado(uuid) FROM PUBLIC, anon, authenticated;');
      expect(sqlSemComentarios).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.eng_acesso_liberado/);
    });
  });

  it('recria as 10 RPCs do gestor e cada uma é a vigente do repositório (nenhuma migration posterior a desfaz)', () => {
    for (const nome of RPCS_DO_GESTOR) {
      expect(sql, `${nome} ausente da migration de acesso por IES`).toContain(cabecalhoDe(nome));
      expect(vigente(nome).arquivo, `${nome}: vigente deveria ser ${ARQUIVO}`).toBe(ARQUIVO);
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
    // refresh incremental, P4: o rebuild espera o lock (com lock_timeout) em vez de falhar na hora
    expect(refresh).toMatch(/pg_advisory_xact_lock\(hashtext\('eng_refresh'\)\)/);
    expect(refresh).toMatch(/SET LOCAL lock_timeout/);
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

  it('o cron é idempotente, roda às 06:00 UTC (03:00 BRT) e fixa statement_timeout de 30 min no mesmo comando', () => {
    // refresh incremental, I3: o rebuild total passou das 09:00 UTC para as 06:00 UTC; vale a migration mais recente
    const arquivos = migrationsOrdenadas().filter((f) => /eng-refresh-diario/.test(readMigration(f)));
    const arquivo = arquivos[arquivos.length - 1];
    expect(arquivo, 'nenhuma migration agenda eng-refresh-diario').toBeDefined();
    const sql = semComentarios(readMigration(arquivo!));
    const idxUnschedule = sql.indexOf('cron.unschedule');
    const idxSchedule = sql.indexOf('cron.schedule');
    expect(idxUnschedule).toBeGreaterThan(-1);
    expect(idxSchedule).toBeGreaterThan(idxUnschedule);
    expect(sql).toMatch(/'0 6 \* \* \*'/);
    expect(sql).toMatch(/SET statement_timeout TO '30min'; SELECT public\.eng_refresh\('cron'\);/);
  });
});
