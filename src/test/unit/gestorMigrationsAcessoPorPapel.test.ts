/**
 * Testes estáticos do acesso às onze RPCs `get_gestor_*` depois da
 * simplificação de 07/08 (spec `2026-08-07-simplificacao-acesso-gestor-design.md`):
 * o acesso passa a depender SOMENTE de papel (`admin`/`gestor`/`gestor_grupo`)
 * e escopo de IES (`gestor_pode_acessar_ies`), nunca mais de uma feature
 * `gestao.enabled` ligada ou desligada por IES em `ies_features`.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado — não dá para rodar as funções de verdade aqui. Este
 * arquivo é análise de texto sobre a migration vigente, não teste de execução.
 *
 * POR QUE A FONTE É SEMPRE "A MIGRATION MAIS RECENTE QUE RECRIA A FUNÇÃO"
 * -------------------------------------------------------------------------
 * Um teste que pina o NOME de uma migration por constante nunca fica vermelho
 * quando outra migration, mais recente, recria a mesma função — ele continua
 * validando um arquivo que pode ter parado de valer. Isso já causou um teste
 * fantasma neste projeto (ver a seção "A ARMADILHA DE POSIÇÃO" abaixo). Por
 * isso `vigente(nome)` abaixo varre TODAS as migrations em ordem cronológica
 * (o prefixo do nome é o timestamp) e usa a ÚLTIMA que recria `nome` — mesmo
 * padrão de `src/features/gestor/__tests__/questoesContratoSort.test.ts`.
 *
 * A ARMADILHA DE POSIÇÃO — JÁ REGREDIU DUAS VEZES, NÃO REPETIR UMA TERCEIRA
 * -------------------------------------------------------------------------
 * O guard de `gestao.enabled` (agora removido de propósito por esta mesma
 * migration) vivia DENTRO do corpo de cada uma das onze funções, não numa
 * trigger ou policy separada que sobreviveria a um `CREATE OR REPLACE`. Isso
 * já apagou guards em silêncio DUAS VEZES neste projeto: (1) a migration do
 * GA total (`20260806144647`), ao limpar a chave morta `gestao.portal_v2`,
 * levou junto `gestao.enabled` por estarem no mesmo bloco de comentário —
 * efeito colateral fora do escopo declarado; (2) uma migration do Lovable
 * recriou `get_gestor_detalhamento` e `get_gestor_questoes` a partir de uma
 * versão vinda da `main` sem o guard, corrigido só numa migration seguinte.
 * Nenhuma das duas vezes gerou erro de tipo, erro de teste (o teste antigo
 * estava pinado no arquivo errado) ou qualquer aviso em compile-time — o
 * guard simplesmente parou de existir em produção, sem barulho.
 *
 * A LIÇÃO QUE ISSO DEIXA PARA DEPOIS DE `gestao.enabled` SAIR DE VEZ: quem
 * recriar qualquer uma das onze RPCs `get_gestor_*` por QUALQUER motivo — fix,
 * feature nova, refactor, merge de branch — precisa preservar os TRÊS blocos
 * de preâmbulo que continuam depois desta migration, NESSA ORDEM: (1) papel
 * (`Access denied`), (2) resolução de `v_ies` (`IES not resolved`), (3)
 * `gestor_pode_acessar_ies(v_ies)` (`Permission denied: cannot access this
 * IES`). A ordem importa porque o bloco 3 depende de `v_ies` já resolvido — um
 * `gestor_pode_acessar_ies` antes da resolução chamaria a função com um
 * parâmetro que ainda não existe. `get_gestor_contexto` só tem o bloco 1 (não
 * lê dado de uma IES só). `get_gestor_aluno_contato` funde 2 e 3 num único
 * `IF` anti-enumeração (mensagem genérica `aluno_nao_encontrado` tanto para
 * aluno inexistente quanto para aluno de IES não autorizada), mas a ordem
 * relativa — resolver e autorizar antes de qualquer outra coisa — é a mesma.
 *
 * Este arquivo substitui, com o conhecimento acima preservado, o par de
 * arquivos que teria ficado pinado no estado ANTERIOR a esta migration
 * (`gestorMigrationsRestauraGuardGestaoEnabled.test.ts`, que provava a
 * PRESENÇA do guard nas duas migrations do Lovable —
 * `20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql` e
 * `20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql` — e teria ficado
 * vermelho por decisão, não por bug, no momento em que esta migration entrar
 * em vigor).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa maquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as assercoes abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

/** O `(` no fim não é enfeite: sem ele, `get_gestor_aluno` casa com
 *  `get_gestor_aluno_contato` e `get_gestor_alunos`, que vêm ANTES no arquivo. */
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
 * Corpo de UMA função: do seu CREATE até o dollar-quote que o fecha. O helper
 * `corpoDaFuncao(sql, nome)` citado no plano de implementação ainda não existe
 * como import compartilhado — este arquivo copia o mesmo padrão usado em
 * `gestorMigrationsAvisosAlunoContatoContexto.test.ts` / `questoesContratoSort.test.ts`,
 * em vez de importar de outro arquivo de teste.
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

/** O código vigente de `nome`: já fatiado por função. */
const corpoVigente = (nome: string) => corpoDaFuncao(vigente(nome).sql, nome);

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

// As 9 RPCs que recebem p_ies_id e passam pelos três blocos na ordem completa
// (papel -> resolução de v_ies -> gestor_pode_acessar_ies). Ficam fora daqui:
// get_gestor_contexto (não recebe p_ies_id, só tem o bloco de papel) e
// get_gestor_aluno_contato (funde resolução e autorização num único IF).
const RPCS_COM_IES = [
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

const TODAS_AS_ONZE = [
  'get_gestor_contexto',
  'get_gestor_aluno_contato',
  ...RPCS_COM_IES,
];

describe('acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08)', () => {
  it('descobre exatamente as onze RPCs do portal — se este número mudar, a varredura abaixo mudou de escopo', () => {
    expect(todasAsRpcsDoGestor()).toEqual(
      [...TODAS_AS_ONZE].sort(),
    );
  });

  it('nenhuma das onze menciona gestao.enabled', () => {
    for (const nome of TODAS_AS_ONZE) {
      expect(corpoVigente(nome), nome).not.toMatch(/gestao\.enabled/);
    }
  });

  it('nenhuma das onze chama user_has_feature_for_ies', () => {
    for (const nome of TODAS_AS_ONZE) {
      expect(corpoVigente(nome), nome).not.toMatch(/user_has_feature_for_ies\s*\(/);
    }
  });

  it('nenhuma das onze chama user_has_feature (nem a variante sem _for_ies)', () => {
    for (const nome of TODAS_AS_ONZE) {
      expect(corpoVigente(nome), nome).not.toMatch(/user_has_feature\s*\(/);
    }
  });

  it('user_has_feature NAO e recriada em nenhuma migration (19 RPCs legadas dependem dela para aluno.%)', () => {
    for (const arquivo of migrationsOrdenadas()) {
      expect(readMigration(arquivo), arquivo).not.toMatch(
        /CREATE OR REPLACE FUNCTION public\.user_has_feature\(/,
      );
    }
  });

  it.each(RPCS_COM_IES)(
    '%s mantem papel -> resolucao de v_ies -> gestor_pode_acessar_ies, nessa ordem',
    (nome) => {
      const corpo = corpoVigente(nome);
      const idxPapel = corpo.indexOf("has_role(v_uid,'admin'::app_role)");
      const idxResolucao = corpo.indexOf('IES not resolved');
      const idxEscopo = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
      expect(idxPapel, `${nome}: bloco de papel não encontrado`).toBeGreaterThan(-1);
      expect(idxResolucao, `${nome}: "IES not resolved" não encontrado`).toBeGreaterThan(idxPapel);
      expect(idxEscopo, `${nome}: gestor_pode_acessar_ies(v_ies) não encontrado`).toBeGreaterThan(
        idxResolucao,
      );
    },
  );

  it('get_gestor_contexto mantem SOMENTE o bloco de papel (nao autoriza por IES)', () => {
    const corpo = corpoVigente('get_gestor_contexto');
    expect(corpo).toMatch(/has_role\(v_uid,'admin'::app_role\)/);
    expect(corpo).toMatch(/RAISE EXCEPTION 'Access denied';/);
    // get_gestor_contexto tem seu PRÓPRIO "IES not resolved" (v_ies_atual, para
    // montar iesAtual no payload) — não é o bloco 2/3 do preâmbulo das outras
    // dez, que resolve+autoriza p_ies_id via gestor_pode_acessar_ies. Esta
    // função nunca chama gestor_pode_acessar_ies: não lê dado de uma IES só,
    // enumera o switcher inteiro.
    expect(corpo).not.toMatch(/gestor_pode_acessar_ies/);
  });

  it('get_gestor_aluno_contato mantem papel e o IF fundido de resolucao+autorizacao (aluno_nao_encontrado)', () => {
    const corpo = corpoVigente('get_gestor_aluno_contato');
    const idxPapel = corpo.indexOf("has_role(v_uid,'admin'::app_role)");
    const idxFundido = corpo.indexOf(
      "IF v_ies IS NULL OR NOT public.gestor_pode_acessar_ies(v_ies) THEN",
    );
    expect(idxPapel).toBeGreaterThan(-1);
    expect(idxFundido, 'IF fundido de resolucao+autorizacao nao encontrado').toBeGreaterThan(
      idxPapel,
    );
    expect(corpo).toMatch(/RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';/);
  });

  it.each(TODAS_AS_ONZE)('%s preserva SECURITY DEFINER, STABLE e search_path', (nome) => {
    const corpo = corpoVigente(nome);
    expect(corpo, nome).toMatch(/SECURITY DEFINER/);
    expect(corpo, nome).toMatch(/\bSTABLE\b/);
    expect(corpo, nome).toMatch(/SET search_path (?:TO 'public'|= public)/);
  });
});
