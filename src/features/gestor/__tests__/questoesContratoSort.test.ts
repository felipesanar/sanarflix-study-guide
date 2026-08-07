import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sortQuestoesParaRpc } from '@/features/gestor/api/queries';
import { ORDENACOES_QUESTOES } from '@/features/gestor/components/TabelaQuestoes';

/**
 * O contrato entre o controle de ordenação e a RPC `get_gestor_questoes`.
 *
 * Este teste existe por causa de um bug real: a UI mandava o próprio rótulo
 * interno (`ordem_da_prova`) em `p_sort`, a RPC só aceita `('numero','acerto')`
 * e levanta `sort_invalido` fora disso — então toda chamada falhava e o
 * "Detalhamento das Questões" ficava permanentemente vazio em produção.
 *
 * A suíte inteira passava: os testes de front mockavam a RPC (e por isso
 * aceitavam qualquer `p_sort`) e os testes de migration liam só o texto do SQL.
 * Ninguém cruzava as duas metades. É esse cruzamento que mora aqui — a
 * whitelist é LIDA do SQL, não copiada, para não congelar uma cópia que
 * envelhece em silêncio quando a migration muda.
 */

const DIR = path.resolve(__dirname, '../../../../supabase/migrations');

/** A migration mais recente que redefine `get_gestor_questoes` é a que vale. */
function sqlVigente(): string {
  const arquivos = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const comFuncao = arquivos.filter((f) =>
    /CREATE OR REPLACE FUNCTION public\.get_gestor_questoes/i.test(
      fs.readFileSync(path.join(DIR, f), 'utf-8'),
    ),
  );
  expect(comFuncao.length).toBeGreaterThan(0);
  return fs.readFileSync(path.join(DIR, comFuncao[comFuncao.length - 1]), 'utf-8');
}

/**
 * Corpo de UMA função dentro do arquivo de migration.
 *
 * Uma migration pode recriar várias funções de uma vez — a de 06/08 que tirou o
 * guard de feature recria as onze RPCs `get_gestor_*` no mesmo arquivo. Sem
 * recortar por função, um `match` de `v_sort NOT IN (...)` pega a primeira
 * ocorrência do arquivo, que é a whitelist de `get_gestor_alunos`
 * ('nome','semestre',...), e o teste passa a validar o contrato errado.
 */
function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}`);
  expect(inicio, `função ${nome} não encontrada na migration`).toBeGreaterThanOrEqual(0);
  const proxima = sql.indexOf('CREATE OR REPLACE FUNCTION', inicio + 1);
  return sql.slice(inicio, proxima === -1 ? undefined : proxima);
}

/** Extrai a whitelist do `IF v_sort NOT IN (...)` de `get_gestor_questoes`. */
function whitelistDoSql(sql: string): string[] {
  const corpo = corpoDaFuncao(sql, 'get_gestor_questoes');
  const m = corpo.match(/v_sort\s+NOT\s+IN\s*\(([^)]*)\)/i);
  expect(m, 'não achei a whitelist de v_sort em get_gestor_questoes').not.toBeNull();
  return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe('contrato de ordenação do Detalhamento das Questões', () => {
  const sql = sqlVigente();
  const whitelist = whitelistDoSql(sql);

  it('a migration vigente expõe uma whitelist legível', () => {
    expect(whitelist.length).toBeGreaterThan(0);
    expect(whitelist).toContain('numero');
  });

  it('TODA opção da UI vira um valor que a RPC aceita', () => {
    const rejeitados = ORDENACOES_QUESTOES.map((o) => o.valor)
      .map((valor) => ({ valor, enviado: sortQuestoesParaRpc(valor) }))
      .filter(({ enviado }) => !whitelist.includes(enviado));

    expect(
      rejeitados,
      `estes valores da UI viram um p_sort fora da whitelist ${JSON.stringify(whitelist)} ` +
        `e fariam a RPC levantar sort_invalido`,
    ).toEqual([]);
  });

  it('o padrão da tela ("Ordem da prova") mapeia para `numero`', () => {
    expect(ORDENACOES_QUESTOES[0].valor).toBe('ordem_da_prova');
    expect(sortQuestoesParaRpc('ordem_da_prova')).toBe('numero');
  });

  it('"Mais erradas" pede o acerto ascendente — a questão mais errada primeiro', () => {
    expect(sortQuestoesParaRpc('mais_erradas')).toBe('acerto');
    // Escopado à função, pelo mesmo motivo da whitelist: o arquivo tem outras
    // RPCs com o próprio `ORDER BY` sobre `v_sort`.
    expect(corpoDaFuncao(sql, 'get_gestor_questoes')).toMatch(
      /v_sort\s*=\s*'acerto'\s*THEN\s*f\.acerto_pct\s*END\s*ASC/i,
    );
  });

  it('valor desconhecido degrada para o padrão em vez de estourar a RPC', () => {
    expect(sortQuestoesParaRpc('valor_que_nao_existe')).toBe('numero');
  });

  /**
   * `mais_acertadas` só é servível quando o banco souber ordenar decrescente.
   * Enquanto a migration não estiver aplicada, o mapa degrada para `acerto` —
   * este teste registra os dois estados para que a virada seja deliberada.
   */
  it('"Mais acertadas" degrada para `acerto` até o banco aceitar `acerto_desc`', () => {
    const bancoSuportaDesc = whitelist.includes('acerto_desc');
    expect(sortQuestoesParaRpc('mais_acertadas', bancoSuportaDesc)).toBe(
      bancoSuportaDesc ? 'acerto_desc' : 'acerto',
    );
  });
});
