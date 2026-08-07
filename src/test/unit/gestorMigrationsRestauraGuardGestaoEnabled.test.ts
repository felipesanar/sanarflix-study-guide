/**
 * Testes estáticos do guard de feature 'gestao.enabled' (master) nas onze RPCs
 * `get_gestor_*`, como ele está IMPLANTADO EM PRODUÇÃO hoje: nas duas
 * migrations geradas pelo agente do Lovable —
 * `20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql` (9 funções) e
 * `20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql`
 * (`get_gestor_detalhamento` e `get_gestor_questoes`) — tratadas aqui como UM
 * conjunto: juntas cobrem as mesmas onze funções.
 *
 * ORIGEM DESTE ARQUIVO E POR QUE ELE NÃO PINA MAIS AS NOSSAS MIGRATIONS
 * -----------------------------------------------------------------------
 * Este teste pinava por nome duas migrations nossas —
 * `20260806180000_gestor_restaura_guard_gestao_enabled.sql` (Lote D, 11
 * funções) e `20260806193000_gestor_reaplica_guard_gestao_enabled_detalhamento_questoes.sql`
 * (Lote E, 2 funções) — escritas em 06/08 para restaurar este mesmo guard.
 * Nenhuma das duas chegou a ser aplicada em produção: o DDL real foi feito por
 * outro caminho, o agente do Lovable, que gerou as suas PRÓPRIAS migrations
 * (as duas listadas acima), com timestamp posterior e já mergeadas na
 * branch — confirmado em produção via `pg_get_functiondef`: 11/11 com o
 * guard. As nossas duas viraram duplicata sem nunca ter sido aplicadas em
 * lugar nenhum e foram apagadas (`git rm`); este arquivo foi reescrito para
 * testar o par de arquivos que está de fato em produção, não o par que nunca
 * chegou a existir fora do repositório.
 *
 * POR QUE O GUARD CAIU DA PRIMEIRA VEZ (e por que "só portal_v2" não bastava)
 * -----------------------------------------------------------------------------
 * A migration do GA total (`20260806144647`) removeu do banco o guard de
 * feature 'gestao.portal_v2' das onze RPCs `get_gestor_*` — remoção
 * intencional e ratificada, o portal v2 vale para todo mundo sem checagem de
 * feature. O efeito colateral que ninguém viu: `public.user_has_feature_for_ies`
 * (20260804120000_user_has_feature_for_ies.sql:70-80) EMBUTE o master — antes
 * de olhar a chave específica, ela já exige que 'gestao.enabled' esteja ligada
 * para aquela IES. Tirar a checagem de portal_v2 levou junto a checagem de
 * módulo contratado, que não estava no escopo da limpeza e é o interruptor
 * mestre do produto.
 *
 * A ARMADILHA DE POSIÇÃO — JÁ REGREDIU DUAS VEZES, NÃO REPETIR UMA TERCEIRA
 * -----------------------------------------------------------------------------
 * O guard NÃO pode ser a primeira instrução do `BEGIN` nem vir antes da
 * resolução de `v_ies`: `p_ies_id` é opcional, e há um fallback que resolve
 * `v_ies` a partir de `users.id_ies` ou de `get_accessible_ies(v_uid)[1]`
 * quando `p_ies_id` vem NULL. Como `user_has_feature_for_ies` é fail-closed
 * para `v_ies` NULL, um guard cedo faria toda chamada sem IES explícita
 * estourar `feature_not_enabled` para todo mundo. Ordem correta, nas dez RPCs
 * que resolvem `v_ies`: papel (`Access denied`) → resolução de `v_ies`
 * (`IES not resolved`) → autorização da IES (`gestor_pode_acessar_ies`) →
 * feature (`feature_not_enabled`). `get_gestor_aluno_contato` funde resolução
 * e autorização num único IF (anti-enumeração), mas a ordem relativa ao guard
 * é a mesma: resolve+autoriza primeiro, guard depois.
 *
 * O guard vive DENTRO do corpo de cada uma das onze funções, não numa trigger
 * ou policy separada que sobreviveria a um `CREATE OR REPLACE`. Isso já
 * apagou o guard em silêncio DUAS VEZES: a primeira foi a própria
 * `20260806144647` (GA total), ao limpar 'gestao.portal_v2'; a segunda foi
 * uma migration do Lovable que recriou `get_gestor_detalhamento` e
 * `get_gestor_questoes` a partir de uma versão vinda da main sem o guard, que
 * teve de ser corrigida por uma migration seguinte (a `de63e0ae` testada
 * aqui). Quem recriar qualquer uma das onze RPCs `get_gestor_*` por QUALQUER
 * motivo — fix, feature nova, refactor, merge — precisa reinserir o mesmo
 * bloco de guard 'gestao.enabled' no novo corpo, ou ele desaparece de novo
 * sem nenhum erro, nenhum teste de tipo, nada que avise em compile-time.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — não dá para rodar as funções de
 * verdade aqui. Este arquivo é análise de texto sobre as duas migrations, não
 * teste de execução.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

// As duas migrations do Lovable que, juntas, cobrem as onze RPCs get_gestor_*
// com o guard de 'gestao.enabled' em produção.
const FILE_NOVE = '20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql';
const FILE_DUAS = '20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql';

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa máquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as asserções abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf).
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const sqlNove = () => readMigration(FILE_NOVE);
const sqlDuas = () => readMigration(FILE_DUAS);

/** O `(` no fim não é enfeite: sem ele, `get_gestor_aluno` casa com
 *  `get_gestor_aluno_contato` e `get_gestor_alunos`, que vêm ANTES no arquivo. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

// Qual dos dois arquivos do Lovable recria cada função — 9 num, 2 no outro.
const FUNCOES_DO_ARQUIVO_NOVE = [
  'get_gestor_contexto',
  'get_gestor_cronograma',
  'get_gestor_avisos',
  'get_gestor_aluno_contato',
  'get_gestor_visao_geral',
  'get_gestor_diagnostico',
  'get_gestor_diagnostico_temas',
  'get_gestor_alunos',
  'get_gestor_aluno',
];
const FUNCOES_DO_ARQUIVO_DUAS = ['get_gestor_detalhamento', 'get_gestor_questoes'];

function sqlDe(nome: string): string {
  if (FUNCOES_DO_ARQUIVO_NOVE.includes(nome)) return sqlNove();
  if (FUNCOES_DO_ARQUIVO_DUAS.includes(nome)) return sqlDuas();
  throw new Error(`função ${nome} não está mapeada para nenhum dos dois arquivos do Lovable`);
}

/** Corpo de UMA função: do seu CREATE até o dollar-quote que o fecha (lido de
 *  `AS $tag$`, não fixado — as duas migrations do Lovable usam `$function$`). */
function corpoDaFuncao(texto: string, nome: string): string {
  const inicio = texto.indexOf(cabecalhoDe(nome));
  expect(inicio, `função ${nome} não encontrada`).toBeGreaterThanOrEqual(0);
  const abertura = /\bAS\s+(\$[A-Za-z_]*\$)/.exec(texto.slice(inicio));
  expect(abertura, `não achei o dollar-quote que abre o corpo de ${nome}`).not.toBeNull();
  const tag = abertura![1];
  const fim = texto.indexOf(`${tag};`, inicio + abertura!.index + abertura![0].length);
  expect(fim, `função ${nome} não fecha com ${tag};`).toBeGreaterThan(inicio);
  return texto.slice(inicio, fim + tag.length + 1);
}

/** Remove linhas que são só comentário SQL, para que asserções negativas não
 *  mordam a prosa explicativa (que cita de propósito 'gestao.portal_v2' e os
 *  nomes das duas funções helper, para explicar a decisão). */
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*--/.test(linha))
    .join('\n');

const corpoVigente = (nome: string) => semComentarios(corpoDaFuncao(sqlDe(nome), nome));

const RPCS_COM_V_IES_EXPLICITO = [
  'get_gestor_cronograma',
  'get_gestor_avisos',
  'get_gestor_visao_geral',
  'get_gestor_diagnostico',
  'get_gestor_diagnostico_temas',
  'get_gestor_alunos',
  'get_gestor_aluno',
  'get_gestor_detalhamento',
  'get_gestor_questoes',
];

// get_gestor_aluno_contato não recebe p_ies_id (recebe p_aluno_id) — v_ies vem
// de users.id_ies DO ALUNO. Ainda assim resolve e autoriza v_ies antes do
// guard, então entra na mesma verificação de posição, com âncora própria.
const TODAS_AS_DEZ_COM_V_IES = [...RPCS_COM_V_IES_EXPLICITO, 'get_gestor_aluno_contato'];

const TODAS_AS_ONZE = ['get_gestor_contexto', ...TODAS_AS_DEZ_COM_V_IES];

describe('Guard de gestao.enabled nas onze RPCs get_gestor_* (migrations do Lovable em produção)', () => {
  it('as onze RPCs get_gestor_* são recriadas: 9 num arquivo, 2 no outro, cada uma com CREATE OR REPLACE FUNCTION (nunca DROP)', () => {
    const nove = sqlNove();
    const duas = sqlDuas();
    for (const nome of FUNCOES_DO_ARQUIVO_NOVE) {
      expect(nove, `${nome} não é recriada em ${FILE_NOVE}`).toMatch(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`),
      );
    }
    for (const nome of FUNCOES_DO_ARQUIVO_DUAS) {
      expect(duas, `${nome} não é recriada em ${FILE_DUAS}`).toMatch(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`),
      );
    }
    expect(nove.match(/^CREATE OR REPLACE FUNCTION public\.get_gestor_/gm)?.length).toBe(9);
    expect(duas.match(/^CREATE OR REPLACE FUNCTION public\.get_gestor_/gm)?.length).toBe(2);
    expect(semComentarios(nove)).not.toMatch(/DROP FUNCTION/);
    expect(semComentarios(duas)).not.toMatch(/DROP FUNCTION/);
  });

  it.each(TODAS_AS_DEZ_COM_V_IES)(
    "%s: guard 'gestao.enabled' via user_has_feature_for_ies(v_ies), DEPOIS da resolução e autorização da IES",
    (nome) => {
      const corpo = corpoVigente(nome);
      expect(corpo).toMatch(/IF NOT public\.user_has_feature_for_ies\('gestao\.enabled', v_ies\) THEN/);
      expect(corpo).toMatch(/RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';/);
      // Nunca a chave morta, nunca a variante sem _for_ies (bool_or de grupo).
      expect(corpo).not.toMatch(/gestao\.portal_v2/);
      expect(corpo).not.toMatch(/user_has_feature\(/); // não confundir com user_has_feature_for_ies(

      // A POSIÇÃO é a asserção mais importante deste arquivo: essa é a
      // regressão que já aconteceu de verdade duas vezes (ver docblock). O
      // guard tem de vir DEPOIS de a IES já estar resolvida E autorizada —
      // nunca antes, porque a helper é fail-closed para v_ies NULL.
      const idxFeature = corpo.indexOf("user_has_feature_for_ies('gestao.enabled', v_ies)");
      if (nome === 'get_gestor_aluno_contato') {
        // Aqui não há "IES not resolved" nem gestor_pode_acessar_ies isolado:
        // a resolução e a autorização estão no MESMO IF (anti-enumeração).
        const idxResolucaoEAutorizacao = corpo.indexOf(
          "IF v_ies IS NULL OR NOT public.gestor_pode_acessar_ies(v_ies) THEN",
        );
        expect(idxResolucaoEAutorizacao).toBeGreaterThan(-1);
        expect(idxFeature).toBeGreaterThan(idxResolucaoEAutorizacao);
      } else {
        const idxIesNotResolved = corpo.indexOf('IES not resolved');
        const idxAutorizacao = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
        expect(idxIesNotResolved).toBeGreaterThan(-1);
        expect(idxAutorizacao).toBeGreaterThan(idxIesNotResolved);
        expect(idxFeature).toBeGreaterThan(idxAutorizacao);
      }
    },
  );

  it("get_gestor_contexto: guard 'gestao.enabled' via user_has_feature (bool_or), não a variante _for_ies", () => {
    const corpo = corpoVigente('get_gestor_contexto');
    // get_gestor_contexto não recebe p_ies_id (enumera as IES do switcher, não
    // lê dado de uma IES só) — por isso usa a variante sem _for_ies.
    expect(corpo).toMatch(/IF NOT public\.user_has_feature\('gestao\.enabled'\) THEN/);
    expect(corpo).toMatch(/RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';/);
    expect(corpo).not.toMatch(/user_has_feature_for_ies\(/);
    expect(corpo).not.toMatch(/gestao\.portal_v2/);

    // Posição: logo depois do "Access denied" inicial (não depende de v_ies —
    // esta função não resolve uma IES só).
    const idxAccessDenied = corpo.indexOf('Access denied');
    const idxFeature = corpo.indexOf("user_has_feature('gestao.enabled')");
    expect(idxAccessDenied).toBeGreaterThan(-1);
    expect(idxFeature).toBeGreaterThan(idxAccessDenied);
  });

  it("nenhuma ocorrência de 'gestao.portal_v2' como guard — só em prosa explicativa (comentários)", () => {
    // Os dois arquivos citam 'gestao.portal_v2' de propósito, para explicar a
    // decisão — mas removendo os comentários, nenhuma chamada real deve sobrar.
    expect(semComentarios(sqlNove())).not.toMatch(/gestao\.portal_v2/);
    expect(semComentarios(sqlDuas())).not.toMatch(/gestao\.portal_v2/);
  });

  it('nenhum dos dois arquivos recria user_has_feature nem user_has_feature_for_ies (só chama, nunca recria)', () => {
    // O corpo real das duas funções helper não existe em nenhum .sql do repo
    // (guard injetado pela migration 20260709171344 em user_has_feature, que
    // é compartilhada com 19 RPCs legadas). Um CREATE OR REPLACE em qualquer
    // uma delas apagaria esse guard legado em silêncio.
    for (const sql of [sqlNove(), sqlDuas()]) {
      expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.user_has_feature\(/);
      expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.user_has_feature_for_ies\(/);
    }
  });

  it('preserva SECURITY DEFINER, STABLE e search_path em todas as onze', () => {
    for (const nome of TODAS_AS_ONZE) {
      const corpo = corpoDaFuncao(sqlDe(nome), nome);
      expect(corpo, nome).toMatch(/SECURITY DEFINER/);
      expect(corpo, nome).toMatch(/\bSTABLE\b/);
      expect(corpo, nome).toMatch(/SET search_path TO 'public'/);
    }
  });

  it('get_gestor_detalhamento em produção emite a chave "alunos" (fix de 20260806170000, não revertido pelo guard nem pelo merge da main)', () => {
    // 20260806170000_get_gestor_detalhamento_alunos.sql adicionou a chave
    // 'alunos' ao envelope. O merge da main que trouxe as mudanças de
    // "alunos e whitelist" (20260806192302) manteve essa chave; a migration
    // do Lovable aqui testada recria a função a partir dessa versão, com
    // SOMENTE o guard acrescentado — não pode ter perdido a chave no caminho.
    const corpo = corpoDaFuncao(sqlDuas(), 'get_gestor_detalhamento');
    expect(corpo).toMatch(/'alunos', COALESCE\(\(/);
    expect(corpo).toMatch(/aluno_linha AS \(/);
  });
});
