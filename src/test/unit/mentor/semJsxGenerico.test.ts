import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O `lovable-tagger` (plugin do Vite em dev) injeta atributos logo depois do nome do componente.
 * Num elemento com argumento de tipo explícito (`<Lista<Tipo> ...>`) ele quebra a sintaxe e a tela
 * não abre no dev, embora `tsc` e Vitest passem. Use `const ListaTipada = Lista<Tipo>` fora do JSX.
 */
function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === '__tests__' ? [] : arquivosTsx(caminho);
    return caminho.endsWith('.tsx') && !caminho.endsWith('.test.tsx') ? [caminho] : [];
  });
}

describe('portal do mentor: JSX sem argumento de tipo explícito', () => {
  it('nenhum componente é usado como <Comp<Tipo>> no código de produção', () => {
    const raiz = join(process.cwd(), 'src', 'features', 'mentor');
    const ocorrencias = arquivosTsx(raiz).flatMap((arq) =>
      readFileSync(arq, 'utf8')
        .split('\n')
        .map((linha, i) => ({ arq, linha: i + 1, texto: linha }))
        .filter(({ texto }) => /(^|[\s(>{])<[A-Z][A-Za-z0-9]*<[^>]+>(\s|$|\/|>)/.test(texto)),
    );
    expect(ocorrencias.map((o) => `${o.arq}:${o.linha}`)).toEqual([]);
  });
});
