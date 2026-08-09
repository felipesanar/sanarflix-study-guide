import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * As chaves que a tela LÊ têm que ser chaves que o SQL EMITE.
 *
 * Este repositório já foi mordido duas vezes pela mesma família de defeito, e
 * as duas passaram por suíte verde:
 *
 * 1. `p_sort` — a UI mandava `ordem_da_prova` para uma RPC cuja whitelist é
 *    `('numero','acerto')`. Toda chamada levantava `sort_invalido` e o
 *    "Detalhamento das Questões" ficou vazio em produção desde o GA.
 * 2. `alunos` — a rota lê `dados.alunos`, mas `get_gestor_detalhamento` nunca
 *    emitiu essa chave em nenhuma migration. O bloco "Visão de alunos"
 *    afirmava "Nenhum aluno neste recorte" para IES com centenas de alunos.
 *
 * O padrão é sempre o mesmo: o teste de front mocka a RPC e **fabrica no
 * fixture a chave que o servidor nunca mandou**, então as duas metades passam
 * isoladas e ninguém cruza o contrato. Um mock não pode ser a única descrição
 * do que o servidor devolve.
 *
 * Este teste lê o `jsonb_build_object` do corpo vigente de cada função e
 * compara com o que o front declara consumir. É de propósito que ele leia o
 * SQL em vez de uma lista copiada: cópia envelhece em silêncio.
 */

const MIGRATIONS = path.resolve(__dirname, '../../../../supabase/migrations');

/** Corpo da definição vigente de uma função (a migration mais recente que a recria). */
function corpoVigente(nome: string): string {
  const arquivos = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  // `(` logo após o nome é essencial: sem isso, procurar
  // `get_gestor_detalhamento` também casa `get_gestor_detalhamento_temas`
  // (mesmo prefixo) e o teste passa a ler a função errada — achado em 09/08
  // ao introduzir `get_gestor_detalhamento_temas` (drill-down do Detalhamento).
  // Alguns chamadores (ex.: `get_gestor_aluno(`) já mandam o `(` embutido no
  // próprio `nome` para essa mesma finalidade — não duplicar nesse caso.
  const nomeComParen = nome.endsWith('(') ? nome : `${nome}(`;
  const marcador = `CREATE OR REPLACE FUNCTION public.${nomeComParen}`;
  const comFuncao = arquivos.filter((f) =>
    fs.readFileSync(path.join(MIGRATIONS, f), 'utf-8').includes(marcador),
  );
  expect(comFuncao.length, `nenhuma migration define ${nome}`).toBeGreaterThan(0);

  const sql = fs.readFileSync(path.join(MIGRATIONS, comFuncao[comFuncao.length - 1]), 'utf-8');
  const inicio = sql.indexOf(marcador);
  // Uma migration pode recriar várias funções; recorta até a próxima.
  const proxima = sql.indexOf('CREATE OR REPLACE FUNCTION', inicio + 1);
  return sql.slice(inicio, proxima === -1 ? undefined : proxima);
}

/**
 * Chaves de primeiro nível do objeto `'data'` do envelope.
 *
 * Conta parênteses a partir de `'data', jsonb_build_object(` e só aceita as
 * chaves na profundidade 1 — sem isso, as chaves de objetos aninhados
 * (`'areas'`, `'matriz'`, cada campo de cada aluno) entrariam na lista e o
 * teste passaria a afirmar qualquer coisa.
 */
function chavesDoEnvelope(corpo: string): Set<string> {
  const ancora = corpo.indexOf("'data'");
  expect(ancora, 'não achei a chave data no envelope').toBeGreaterThanOrEqual(0);
  const abre = corpo.indexOf('(', corpo.indexOf('jsonb_build_object', ancora));

  const chaves = new Set<string>();
  let nivel = 0;
  for (let i = abre; i < corpo.length; i += 1) {
    const c = corpo[i];
    if (c === '(') nivel += 1;
    else if (c === ')') {
      nivel -= 1;
      if (nivel === 0) break;
    } else if (c === "'" && nivel === 1) {
      const fim = corpo.indexOf("'", i + 1);
      if (fim === -1) break;
      const literal = corpo.slice(i + 1, fim);
      // Chave é o literal seguido de vírgula; valor é seguido de outra coisa.
      if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(literal) && corpo.slice(fim + 1).trimStart().startsWith(',')) {
        chaves.add(literal);
      }
      i = fim;
    }
  }
  return chaves;
}

describe('contrato do envelope: o que a tela lê é o que o SQL emite', () => {
  it('get_gestor_detalhamento emite as chaves que o Detalhamento consome', () => {
    const chaves = chavesDoEnvelope(corpoVigente('get_gestor_detalhamento'));

    // Declarado no tipo `Detalhamento` (api/types.ts) e lido em routes/Detalhamento.tsx.
    for (const obrigatoria of ['metricas', 'acertoPorAreaESemestre', 'dispersao']) {
      expect(chaves, `envelope sem a chave ${obrigatoria}`).toContain(obrigatoria);
    }
  });

  /**
   * A rota nunca pode colapsar `undefined` em `[]`.
   *
   * A primeira versão deste caso ramificava: "se o SQL do repo emite `alunos`,
   * exija que a rota pare de tratar `undefined`". Estava errado, e errado de um
   * jeito instrutivo — **migration no repositório não é migration aplicada**.
   * Foi exatamente essa confusão que derrubou as abas de desempenho em produção
   * em 06/08: as chaves de feature foram apagadas por serem "dado morto na
   * branch", enquanto a `main` no ar ainda dependia delas.
   *
   * O invariante durável não depende do estado do banco: `[]` é uma resposta do
   * servidor e pode virar "nenhum aluno neste recorte"; `undefined` é o servidor
   * não ter respondido, e sobre isso a tela não pode concluir nada. Manter o
   * ramo de `undefined` continua correto depois que a migration entrar — ele
   * simplesmente para de ser alcançado.
   */
  it('a rota nunca colapsa "a RPC não mandou alunos" em "veio vazio"', () => {
    const rota = fs.readFileSync(path.resolve(__dirname, '../routes/Detalhamento.tsx'), 'utf-8');

    expect(
      rota,
      '`?? []` faz a tabela afirmar "Nenhum aluno neste recorte" quando na verdade nunca perguntou',
    ).not.toMatch(/alunos=\{dados\.alunos \?\? \[\]\}/);

    expect(
      rota,
      'a rota precisa de um ramo explícito para o caso de a RPC não devolver `alunos`',
    ).toMatch(/dados\.alunos === undefined/);
  });

  /**
   * Registro executável do que ainda não está em produção. Quando alguém
   * aplicar `20260806170000_get_gestor_detalhamento_alunos.sql`, este caso
   * continua passando — ele afirma o repositório, não o banco.
   */
  it('a migration que acrescenta `alunos` existe no repositório e emite a chave', () => {
    const chaves = chavesDoEnvelope(corpoVigente('get_gestor_detalhamento'));
    expect(
      chaves,
      'a migration que fecha o bloco "Visão de alunos" sumiu do repositório',
    ).toContain('alunos');
  });

  it('get_gestor_visao_geral emite as chaves que a Visão Geral consome', () => {
    const chaves = chavesDoEnvelope(corpoVigente('get_gestor_visao_geral'));
    for (const obrigatoria of ['kpis', 'evolucao', 'dispersao']) {
      expect(chaves, `envelope sem a chave ${obrigatoria}`).toContain(obrigatoria);
    }
  });

  /**
   * O drawer não pode depender do chamador para saber de quem é o painel: a
   * Dispersão só tem `alunoId`, e o prop `nome` chegava vazio por ali.
   */
  it('get_gestor_aluno devolve o nome, e o DrawerAluno usa isso antes do prop', () => {
    const corpo = corpoVigente('get_gestor_aluno(');
    expect(corpo).toMatch(/'nome',/);

    const drawer = fs.readFileSync(path.resolve(__dirname, '../components/DrawerAluno.tsx'), 'utf-8');
    expect(drawer).toMatch(/const nomeExibido = entradas\[0\]\?\.nome/);
    // Nenhum uso do prop cru na renderização — só como reserva do resolvido.
    expect(drawer).not.toMatch(/\{iniciais\(nome\)\}/);
    expect(drawer).not.toMatch(/>\{nome\}</);
  });
});
