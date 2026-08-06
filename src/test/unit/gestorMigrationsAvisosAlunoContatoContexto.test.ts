/**
 * Testes estáticos das RPCs `get_gestor_*` tocadas pelos achados 2
 * (get_gestor_avisos, get_gestor_aluno), 15 (get_gestor_contexto) e 12/16
 * (get_gestor_aluno_contato) da revisão adversarial de 03/08.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — não dá para rodar as funções de
 * verdade aqui. Este arquivo faz o possível sem banco: lê o texto-fonte das
 * migrations e verifica, por padrão, que o bug documentado foi removido e que
 * a correção esperada está presente. Não substitui o passo manual descrito
 * no rodapé de cada migration (pg_get_functiondef + teste funcional em
 * transação revertida, rodado em gvqv antes de aplicar).
 *
 * POR QUE ESTE ARQUIVO NÃO PINA MAIS NENHUM NOME DE MIGRATION
 * -----------------------------------------------------------
 * A versão anterior lia constantes `FILE` fixas nas migrations de 04/08 e
 * seguia verde afirmando, entre outras coisas, que `get_gestor_aluno_contato`
 * "mantém o OR entre gestao.enabled e gestao.portal_v2". Só que
 * `20260806144647_gestor_remove_guard_portal_v2_ga_total.sql` recriou as onze
 * RPCs `get_gestor_*` SEM guard nenhum, e a conferência em produção (gvqv,
 * 06/08) confirma: nenhuma delas chama `user_has_feature` ou
 * `user_has_feature_for_ies`. O teste estava validando história, não o estado
 * em vigor — um .sql pinado nunca fica vermelho quando outro arquivo o
 * substitui. Daqui em diante a fonte é sempre a migration MAIS RECENTE que
 * recria a função, fatiada por função (mesmo padrão de
 * `src/features/gestor/__tests__/questoesContratoSort.test.ts`, e pelo mesmo
 * motivo: a migration de 06/08 recria onze funções no mesmo arquivo, então um
 * `match` sobre o arquivo inteiro casa com a função errada).
 *
 * Efeito colateral registrado de propósito: a limpeza do GA total tirou junto
 * o `gestao.enabled` do guard de `get_gestor_aluno_contato`. `gestao.enabled`
 * era o interruptor MESTRE do módulo de gestão — desligá-lo numa IES deixava
 * de fechar essa RPC —, e ele não fazia parte do escopo declarado da migration
 * (que era remover `gestao.portal_v2`). Não é regressão de compilação nem de
 * teste; é uma decisão que passou sem ser dita. Fica aqui, no teste que
 * afirma o estado real, para não sumir de novo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa máquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as asserções abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf)
  // para a camada complementar, que só age em checkout novo.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

/** O `(` no fim não é enfeite: sem ele, `get_gestor_aluno` casa com
 *  `get_gestor_aluno_contato` e `get_gestor_alunos`, que vêm ANTES no arquivo
 *  de 06/08 — o teste passaria a validar a função errada. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

/** Migrations em ordem cronológica (o prefixo do nome é o timestamp). */
function migrationsOrdenadas(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** A migration mais recente que recria `nome` é a que vale — a definição em vigor. */
function vigente(nome: string): { arquivo: string; sql: string } {
  const marca = cabecalhoDe(nome);
  const candidatos = migrationsOrdenadas()
    .map((arquivo) => ({ arquivo, sql: readMigration(arquivo) }))
    .filter(({ sql }) => sql.includes(marca));
  expect(candidatos.length, `nenhuma migration recria ${nome}`).toBeGreaterThan(0);
  return candidatos[candidatos.length - 1];
}

/**
 * Remove as linhas que são só comentário SQL.
 *
 * As migrations do gestor documentam DE PROPÓSITO, dentro do corpo da função,
 * a chamada que foi trocada ("trocado de user_can_access_ies(...) para
 * gestor_pode_acessar_ies(...)"). Um `not.toMatch(/user_can_access_ies/)`
 * contra o texto bruto reprova por causa dessa prosa, que não é executada.
 * Só linhas INTEIRAS de comentário caem — nunca um `--` no meio de uma linha,
 * que poderia estar dentro de um literal de string.
 */
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*--/.test(linha))
    .join('\n');

/**
 * Corpo de UMA função: do seu CREATE até o dollar-quote que o fecha.
 *
 * Fechar no delimitador, e não no próximo CREATE, importa para a ÚLTIMA função
 * do arquivo: depois dela a migration de 06/08 ainda tem os DELETE de
 * feature_catalog/ies_features e um COMMENT ON FUNCTION que cita
 * `user_has_feature_for_ies` — tudo isso entraria no "corpo" e faria a
 * varredura de guard reprovar por texto que não é da função. A tag do
 * dollar-quote é LIDA do `AS $tag$` de cada função, não fixada: as migrations
 * do gestor usam `$function$` e `$fn$` conforme quem as escreveu.
 */
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

/** O código vigente de `nome`: já fatiado por função e sem a prosa. */
const corpoVigente = (nome: string) => semComentarios(corpoDaFuncao(vigente(nome).sql, nome));

/** Toda RPC `get_gestor_*` que existe em alguma migration. */
function todasAsRpcsDoGestor(): string[] {
  const nomes = new Set<string>();
  for (const arquivo of migrationsOrdenadas()) {
    for (const m of readMigration(arquivo).matchAll(
      /CREATE OR REPLACE FUNCTION public\.(get_gestor_[a-z_]+)\(/g,
    )) {
      nomes.add(m[1]);
    }
  }
  return [...nomes].sort();
}

/**
 * Cabeçalho de função que sobrevive a um CREATE OR REPLACE só se for
 * REDIGITADO. Grants não entram aqui de propósito: CREATE OR REPLACE preserva
 * privilégios, então a migration de 06/08 não os repete — cobrar `GRANT
 * EXECUTE` do texto vigente reprovaria uma migration correta.
 */
function esperaCabecalhoPreservado(corpo: string) {
  expect(corpo).toMatch(/SECURITY DEFINER/);
  expect(corpo).toMatch(/\bSTABLE\b/);
  expect(corpo).toMatch(/SET search_path (?:TO 'public'|= public)/);
}

describe('guard de feature nas RPCs get_gestor_* (GA total, 06/08)', () => {
  const rpcs = todasAsRpcsDoGestor();

  it('descobre as onze RPCs do portal — se este número mudar, a varredura abaixo mudou de escopo', () => {
    expect(rpcs).toEqual([
      'get_gestor_aluno',
      'get_gestor_aluno_contato',
      'get_gestor_alunos',
      'get_gestor_avisos',
      'get_gestor_contexto',
      'get_gestor_cronograma',
      'get_gestor_detalhamento',
      'get_gestor_diagnostico',
      'get_gestor_diagnostico_temas',
      'get_gestor_questoes',
      'get_gestor_visao_geral',
    ]);
  });

  it.each(rpcs)(
    '%s vigente não chama user_has_feature nem user_has_feature_for_ies (guard removido, confere com gvqv)',
    (nome) => {
      const corpo = corpoVigente(nome);
      expect(corpo).not.toMatch(/user_has_feature_for_ies\s*\(/);
      expect(corpo).not.toMatch(/user_has_feature\s*\(/);
      // Nem a chave sobrevive em lugar nenhum do corpo (ex.: dentro de um
      // COALESCE ou de uma mensagem de erro que ainda a mencionasse).
      expect(corpo).not.toMatch(/gestao\.portal_v2/);
    },
  );

  it.each(rpcs)('%s vigente preserva SECURITY DEFINER, STABLE e search_path', (nome) => {
    esperaCabecalhoPreservado(corpoVigente(nome));
  });

  it('a migration que removeu o guard também apagou as 6 chaves de feature_catalog/ies_features', () => {
    const { sql } = vigente('get_gestor_contexto');
    expect(sql).toMatch(/DELETE FROM public\.ies_features/);
    expect(sql).toMatch(/DELETE FROM public\.feature_catalog/);
    expect(sql).toMatch(/'gestao\.portal_v2'/);
  });
});

describe('get_gestor_avisos vigente (achado 2)', () => {
  const corpo = corpoVigente('get_gestor_avisos');

  it('autoriza a IES RESOLVIDA, nunca antes de resolvê-la (a invariante que o guard de feature ocupava)', () => {
    // O achado 2 era de ORDEM: checar permissão antes de saber qual IES é
    // libera a IES errada. Com o guard fora, quem ocupa essa posição é
    // gestor_pode_acessar_ies — e a ordem continua sendo o que importa.
    const idxIesResolvida = corpo.indexOf('IES not resolved');
    const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxIesResolvida);
  });

  it('não usa mais user_can_access_ies (gap 119: gestor puro não herda IES de user_groups órfão)', () => {
    expect(corpo).not.toMatch(/user_can_access_ies/);
  });

  it('preserva o critério de visibilidade e o COALESCE de publico_alvo', () => {
    expect(corpo).toMatch(/'gestor' = ANY \(COALESCE\(a\.publico_alvo, ARRAY\['aluno'\]::text\[\]\)\)/);
    expect(corpo).toMatch(/ORDER BY v\.lido ASC, v\.created_at DESC/);
  });
});

describe('get_gestor_aluno vigente (achado 2)', () => {
  const corpo = corpoVigente('get_gestor_aluno');

  it('mantém o estado aguardando_resultado (não regrediu para a versão anterior a 20260803150000)', () => {
    expect(corpo).toMatch(/situacao',\s*CASE WHEN NOT lv\.participou\s+THEN 'nao_participou'/);
    expect(corpo).toMatch(/WHEN lv\.proficiencia IS NULL\s+THEN 'aguardando_resultado'/);
  });

  it('autoriza a IES DEPOIS de resolvê-la e ANTES de validar o aluno', () => {
    const idxIesResolvida = corpo.indexOf('IES not resolved');
    const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies');
    const idxAlunoObrigatorio = corpo.indexOf('aluno_obrigatorio');
    expect(idxIesResolvida).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxIesResolvida);
    expect(idxAlunoObrigatorio).toBeGreaterThan(idxAutorizacao);
  });
});

describe('get_gestor_contexto vigente (achado 15)', () => {
  const corpo = corpoVigente('get_gestor_contexto');

  it('papel gestor puro recebe SOMENTE a própria IES em v_ies_list, nunca get_accessible_ies', () => {
    // O branch do ELSE (papel = 'gestor', depois do branch gestor_grupo) deve
    // resolver via users.id_ies, não get_accessible_ies. O recorte é ancorado
    // em CÓDIGO (o ELSE que segue o branch de gestor_grupo), não no comentário
    // que rotula o branch — a prosa não é lida por este arquivo.
    const fimDoGestorGrupo = corpo.indexOf('public.get_accessible_ies(v_uid), ARRAY[]::uuid[]');
    expect(fimDoGestorGrupo).toBeGreaterThan(-1);
    const elseBranch = corpo.slice(
      corpo.indexOf('ELSE', fimDoGestorGrupo),
      corpo.indexOf('SELECT u.id_ies INTO v_ies_atual'),
    );
    expect(elseBranch.length).toBeGreaterThan(0);
    expect(elseBranch).toMatch(/FROM public\.users u\s*\n\s*WHERE u\.id = v_uid AND u\.id_ies IS NOT NULL/);
    expect(elseBranch).not.toMatch(/get_accessible_ies\(/);
  });

  it('gestor_grupo continua usando get_accessible_ies (comportamento preservado)', () => {
    expect(corpo).toMatch(
      /ELSIF v_papel = 'gestor_grupo' THEN\s*\n\s*v_ies_list := COALESCE\(public\.get_accessible_ies\(v_uid\), ARRAY\[\]::uuid\[\]\);/,
    );
  });

  it('podeTrocarIes continua restrito a admin e gestor_grupo (inalterado)', () => {
    expect(corpo).toMatch(/'podeTrocarIes',\s*\(v_papel IN \('admin','gestor_grupo'\)\)/);
  });
});

describe('get_gestor_aluno_contato vigente (achados 12 e 16)', () => {
  const corpo = corpoVigente('get_gestor_aluno_contato');

  it('não tem MAIS NENHUM guard de feature — nem gestao.portal_v2, nem gestao.enabled', () => {
    // Este é o caso que a versão pinada deste arquivo afirmava ao contrário.
    // O `gestao.enabled` foi embora junto com o `gestao.portal_v2`: hoje um
    // gestor de IES com o módulo de gestão DESLIGADO ainda recebe o telefone
    // do aluno por esta RPC. Ver o cabeçalho do arquivo.
    expect(corpo).not.toMatch(/user_has_feature/);
    expect(corpo).not.toMatch(/gestao\.enabled/);
    expect(corpo).not.toMatch(/gestao\.portal_v2/);
  });

  it('a única barreira restante é gestor_pode_acessar_ies sobre a IES DO ALUNO', () => {
    expect(corpo).toMatch(/gestor_pode_acessar_ies\(v_ies\)/);
    expect(corpo).not.toMatch(/user_can_access_ies/);
  });

  it('resolve v_ies a partir do próprio aluno (função não recebe p_ies_id)', () => {
    expect(corpo).toMatch(/SELECT u\.id_ies, u\.telefone\s*\n\s*INTO v_ies, v_telefone/);
  });

  it('autoriza DEPOIS de resolver o aluno e responde com mensagem única (anti-enumeração preservada)', () => {
    const idxResolucao = corpo.indexOf('INTO v_ies, v_telefone');
    const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies');
    expect(idxResolucao).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(idxResolucao);
    expect(corpo).toMatch(
      /IF v_ies IS NULL OR NOT public\.gestor_pode_acessar_ies\(v_ies\) THEN\s*\n\s*RAISE EXCEPTION 'aluno_nao_encontrado'/,
    );
  });

  it('preserva a exclusão de staff via user_roles', () => {
    expect(corpo).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_roles ur WHERE ur\.user_id = u\.id\)/);
  });
});
