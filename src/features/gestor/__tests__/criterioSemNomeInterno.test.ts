import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `meta.criterio` e `kpis.*.criterio` de `get_gestor_visao_geral` chegam crus
 * no tooltip de rastreabilidade do front
 * (`src/features/gestor/components/TooltipRastreabilidade.tsx:85,147` — só
 * imprime, não sanitiza). Até 20260807021546 esses textos citavam estrutura
 * interna do banco ("resultados_alunos_tri.score_proprio", "score_proprio"),
 * linguagem que não é de negócio e que o gestor não tem por que ver.
 * 20260807030000 reescreveu SÓ esses literais — este teste trava a ausência
 * do nome de tabela/coluna para a próxima vez que alguém recriar a função.
 */

const DIR = path.resolve(__dirname, '../../../../supabase/migrations');

/** A migration mais recente que redefine `get_gestor_visao_geral` é a que vale. */
function sqlVigente(): string {
  const arquivos = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const comFuncao = arquivos.filter((f) =>
    /CREATE OR REPLACE FUNCTION public\.get_gestor_visao_geral/i.test(
      fs.readFileSync(path.join(DIR, f), 'utf-8'),
    ),
  );
  expect(comFuncao.length).toBeGreaterThan(0);
  return fs.readFileSync(path.join(DIR, comFuncao[comFuncao.length - 1]), 'utf-8');
}

/**
 * Corpo de UMA função dentro do arquivo de migration — mesmo recorte de
 * `questoesContratoSort.test.ts`, necessário porque uma migration pode
 * recriar várias RPCs `get_gestor_*` no mesmo arquivo.
 */
function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}`);
  expect(inicio, `função ${nome} não encontrada na migration`).toBeGreaterThanOrEqual(0);
  const proxima = sql.indexOf('CREATE OR REPLACE FUNCTION', inicio + 1);
  return sql.slice(inicio, proxima === -1 ? undefined : proxima);
}

/** Os literais de texto que alimentam `criterio` no payload — nunca a função inteira. */
function literaisDeCriterio(corpo: string): string[] {
  const literais: string[] = [];

  const metaCriterio = corpo.match(/v_criterio\s*:=\s*format\(\s*'([^']*)'/);
  expect(metaCriterio, 'não achei o format() de v_criterio (meta.criterio)').not.toBeNull();
  literais.push(metaCriterio![1]);

  const kpisCriterio = [...corpo.matchAll(/'criterio',\s*'([^']*)'/g)].map((m) => m[1]);
  expect(kpisCriterio.length, 'não achei nenhum literal kpis.*.criterio').toBeGreaterThan(0);
  literais.push(...kpisCriterio);

  return literais;
}

describe('get_gestor_visao_geral — meta.criterio e kpis.*.criterio em linguagem de negócio', () => {
  const sql = sqlVigente();
  const corpo = corpoDaFuncao(sql, 'get_gestor_visao_geral');
  const literais = literaisDeCriterio(corpo);

  it('extrai ao menos os quatro literais de criterio conhecidos (meta + 3 kpis)', () => {
    expect(literais.length).toBeGreaterThanOrEqual(4);
  });

  it('nenhum literal de criterio cita nome de tabela (resultados_alunos_tri, user_roles)', () => {
    const comTabela = literais.filter(
      (texto) => /resultados_alunos_tri/i.test(texto) || /\buser_roles\b/i.test(texto),
    );
    expect(
      comTabela,
      'estes literais de criterio vazam nome de tabela do banco pro tooltip do gestor',
    ).toEqual([]);
  });

  it('nenhum literal de criterio cita nome de coluna (score_proprio)', () => {
    const comColuna = literais.filter((texto) => /score_proprio/i.test(texto));
    expect(
      comColuna,
      'estes literais de criterio vazam nome de coluna do banco pro tooltip do gestor',
    ).toEqual([]);
  });
});
