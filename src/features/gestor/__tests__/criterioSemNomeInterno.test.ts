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

/**
 * Os literais de texto que alimentam `criterio` no payload — nunca a função
 * inteira.
 *
 * Desde 07/08 um `criterio` pode ser montado por `CASE`, não só por literal
 * solto: o Conceito ENAMED tem DUAS fontes (consolidado institucional em
 * "Geral", derivado do % de proficientes nos demais recortes) e portanto duas
 * frases de rastreabilidade. Pelo mesmo motivo, a frase do conceito saiu de
 * dentro do `format()` de `v_criterio` e virou `v_conceito_criterio`, montada
 * antes e passada como argumento.
 *
 * As três formas são colhidas aqui porque o teste guarda o TEXTO que chega ao
 * tooltip do gestor, não a sintaxe que o produz — um extrator que só conhece
 * uma das formas passa a aprovar em silêncio o que deixou de enxergar.
 */
function literaisDeCriterio(corpo: string): string[] {
  const literais: string[] = [];
  const literaisDe = (trecho: string) => [...trecho.matchAll(/'([^']*)'/g)].map((m) => m[1]);

  const metaCriterio = corpo.match(/v_criterio\s*:=\s*format\(\s*'([^']*)'/);
  expect(metaCriterio, 'não achei o format() de v_criterio (meta.criterio)').not.toBeNull();
  literais.push(metaCriterio![1]);

  // Frases que entram em meta.criterio como ARGUMENTO do format() acima.
  const conceitoCriterio = corpo.match(/v_conceito_criterio\s*:=\s*CASE\b([\s\S]*?)\bEND\b/);
  if (conceitoCriterio) literais.push(...literaisDe(conceitoCriterio[1]));

  // Forma A: 'criterio', '<literal>'
  const kpisLiteral = [...corpo.matchAll(/'criterio',\s*'([^']*)'/g)].map((m) => m[1]);
  // Forma B: 'criterio', CASE WHEN ... THEN '<literal>' ELSE '<literal>' END
  const kpisCase = [...corpo.matchAll(/'criterio',\s*CASE\b([\s\S]*?)\bEND\b/g)].flatMap((m) =>
    literaisDe(m[1]),
  );

  const kpisCriterio = [...kpisLiteral, ...kpisCase];
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

  it('a migration vigente não reintroduz o guard de gestao.enabled removido pelo PR de simplificação de acesso', () => {
    // Regressão real: esta migration nasceu com o mesmo prefixo de timestamp
    // de 20260807030000_gestor_remove_guard_feature_acesso_por_papel.sql (que
    // remove esse guard de propósito) e, por ordem alfabética de arquivo,
    // rodava DEPOIS dela — reintroduzindo o guard em silêncio. A correção foi
    // reconstruir o corpo a partir da versão sem guard e renumerar para
    // 20260807040000 (depois de todas as migrations daquele PR). Esta
    // asserção trava a ausência do guard na migration `sql` inteira (não só
    // no `corpo` recortado acima) — é exatamente a checagem que provaria, se
    // falhasse, que a base usada para reconstruir a função foi a errada.
    expect(sql).not.toMatch(/gestao\.enabled/);
  });
});
