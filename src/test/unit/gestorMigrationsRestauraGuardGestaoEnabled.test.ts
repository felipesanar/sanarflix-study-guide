/**
 * Testes estáticos da migration `20260806180000_gestor_restaura_guard_gestao_enabled.sql`
 * (Lote D, 06/08) — restaura o guard de feature 'gestao.enabled' (master) nas
 * onze RPCs get_gestor_*, sem trazer de volta 'gestao.portal_v2'.
 *
 * Contexto: `20260806144647_gestor_remove_guard_portal_v2_ga_total.sql` (GA
 * total) removeu do banco o guard de `gestao.portal_v2` das onze RPCs —
 * remoção intencional e ratificada. O efeito colateral que ninguém viu:
 * `public.user_has_feature_for_ies` (usada por dez das onze via aquele guard)
 * embute o master `gestao.enabled` — tirar a checagem de portal_v2 levou
 * junto a checagem de módulo contratado. Decisão do Felipe (06/08): restaurar
 * SOMENTE `gestao.enabled`.
 *
 * Não há harness de pgTAP neste repo e o Supabase MCP disponível aponta para
 * o projeto errado (lljn; produção é gvqv) — não dá para rodar as funções de
 * verdade aqui. Este arquivo é análise de texto sobre a migration, não teste
 * de execução: prova que o guard existe, que ele está na POSIÇÃO certa (o
 * ponto que mais fácil regride — ver a armadilha documentada em
 * 20260804120000_user_has_feature_for_ies.sql:99-127 e no cabeçalho da própria
 * migration), que 'gestao.portal_v2' não volta, e que nenhuma das duas
 * funções helper (`user_has_feature`, `user_has_feature_for_ies`) é recriada
 * aqui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const FILE = '20260806180000_gestor_restaura_guard_gestao_enabled.sql';

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa máquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as asserções abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf).
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const sql = () => readMigration(FILE);

/** O `(` no fim não é enfeite: sem ele, `get_gestor_aluno` casa com
 *  `get_gestor_aluno_contato` e `get_gestor_alunos`, que vêm ANTES no arquivo. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

/** Corpo de UMA função: do seu CREATE até o dollar-quote que o fecha (lido de
 *  `AS $tag$`, não fixado — esta migration usa `$function$` em todas). */
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

/** Remove linhas que são só comentário SQL, para que asserções negativas não
 *  mordam a prosa explicativa (que cita de propósito 'gestao.portal_v2' e os
 *  nomes das duas funções helper, para explicar a decisão). */
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*--/.test(linha))
    .join('\n');

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
// guard, então entra na mesma verificação de posição, com âncoras próprias.
const TODAS_AS_DEZ_COM_V_IES = [...RPCS_COM_V_IES_EXPLICITO, 'get_gestor_aluno_contato'];

const TODAS_AS_ONZE = ['get_gestor_contexto', ...TODAS_AS_DEZ_COM_V_IES];

describe('Lote D (06/08) — migration 20260806180000_gestor_restaura_guard_gestao_enabled.sql', () => {
  it('recria as onze RPCs get_gestor_*, cada uma com CREATE OR REPLACE FUNCTION (nunca DROP)', () => {
    const body = sql();
    for (const nome of TODAS_AS_ONZE) {
      expect(body, `${nome} não é recriada`).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`));
    }
    expect(body.match(/^CREATE OR REPLACE FUNCTION public\.get_gestor_/gm)?.length).toBe(11);
    expect(semComentarios(body)).not.toMatch(/DROP FUNCTION/);
    expect(semComentarios(body)).not.toMatch(/^DELETE FROM/m);
  });

  it.each(TODAS_AS_DEZ_COM_V_IES)(
    "%s: guard 'gestao.enabled' via user_has_feature_for_ies(v_ies), na posição certa",
    (nome) => {
      const corpo = semComentarios(corpoDaFuncao(sql(), nome));
      expect(corpo).toMatch(/IF NOT public\.user_has_feature_for_ies\('gestao\.enabled', v_ies\) THEN/);
      expect(corpo).toMatch(/RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';/);
      // Nunca a chave morta, nunca a variante sem _for_ies (bool_or de grupo).
      expect(corpo).not.toMatch(/gestao\.portal_v2/);
      expect(corpo).not.toMatch(/user_has_feature\(/); // não confundir com user_has_feature_for_ies(

      // A POSIÇÃO é o ponto que regride fácil (ver cabeçalho da migration):
      // o guard tem de vir DEPOIS de a IES já estar resolvida E autorizada —
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
    const corpo = semComentarios(corpoDaFuncao(sql(), 'get_gestor_contexto'));
    // get_gestor_contexto não recebe p_ies_id (enumera as IES do switcher, não
    // lê dado de uma IES só) — por isso usa a variante sem _for_ies, igual ao
    // padrão já documentado para 'gestao.portal_v2' em
    // 20260804120000_user_has_feature_for_ies.sql:124-127.
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
    const body = sql();
    // O arquivo inteiro (comentários inclusos) cita 'gestao.portal_v2' de
    // propósito, para explicar a decisão — mas removendo os comentários,
    // nenhuma chamada real deve sobrar.
    expect(semComentarios(body)).not.toMatch(/gestao\.portal_v2/);
  });

  it('nunca CREATE OR REPLACE FUNCTION em user_has_feature nem em user_has_feature_for_ies (só chama, nunca recria)', () => {
    const body = sql();
    expect(body).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.user_has_feature\(/);
    expect(body).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.user_has_feature_for_ies\(/);
    // As chamadas reais existem (dez _for_ies + uma sem _for_ies) — confirma
    // que a migration não ficou muda por engano. Conta só CÓDIGO (sem a
    // prosa do cabeçalho, que cita as duas formas de propósito).
    const codigo = semComentarios(body);
    expect(codigo.match(/user_has_feature_for_ies\('gestao\.enabled', v_ies\)/g)?.length).toBe(
      RPCS_COM_V_IES_EXPLICITO.length + 1, // + get_gestor_aluno_contato
    );
    expect(codigo.match(/(?<!_for_ies)user_has_feature\('gestao\.enabled'\)/g)?.length).toBe(1);
  });

  it('preserva SECURITY DEFINER, STABLE e search_path em todas as onze (cabeçalho redigitado por CREATE OR REPLACE)', () => {
    const body = sql();
    for (const nome of TODAS_AS_ONZE) {
      const corpo = corpoDaFuncao(body, nome);
      expect(corpo, nome).toMatch(/SECURITY DEFINER/);
      expect(corpo, nome).toMatch(/\bSTABLE\b/);
      expect(corpo, nome).toMatch(/SET search_path TO 'public'/);
    }
  });

  it('get_gestor_detalhamento usa como base o corpo de 20260806170000 (chave "alunos" preservada, não revertida)', () => {
    // 20260806170000_get_gestor_detalhamento_alunos.sql recriou esta função
    // DEPOIS do GA total, para emitir a chave 'alunos' no envelope. Usar o
    // corpo do GA total (mais antigo) aqui reverteria aquele fix em silêncio.
    const corpo = corpoDaFuncao(sql(), 'get_gestor_detalhamento');
    expect(corpo).toMatch(/'alunos', COALESCE\(\(/);
    expect(corpo).toMatch(/aluno_linha AS \(/);
  });
});
