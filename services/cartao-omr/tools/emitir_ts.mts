/**
 * Gera cartões com o MESMO código que o Academy usa no navegador (`src/features/cartoes/`), pela linha
 * de comando. Existe para os testes de paridade com o gerador Python (`tests/test_emissao_ts.py`) e para
 * conferir um PDF fora do navegador. Não tem lógica própria.
 *
 *   node services/cartao-omr/tools/emitir_ts.mts <entrada.json> <saida.pdf>
 *
 * Requer Node 22.18+ (executa TypeScript sem compilar) e `node_modules` instalado na raiz do repositório.
 * `entrada.json` segue `OpcoesEmissao`: { layout, simuladoId, nomeSimulado?, ies?, data?, alunos?, copias? }.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarPdf, montarSpecs } from '../../../src/features/cartoes/emitir.ts';
import type { OpcoesEmissao } from '../../../src/features/cartoes/emitir.ts';
import type { CardTemplate } from '../../../src/features/cartoes/types.ts';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('uso: node emitir_ts.mts <entrada.json> <saida.pdf>');
  process.exit(2);
}

const aqui = dirname(fileURLToPath(import.meta.url));
const opcoes = JSON.parse(readFileSync(entrada, 'utf8')) as OpcoesEmissao;
const arquivo = opcoes.layout === 'sfa' ? 'sfa_v2.json' : 'uniatenas_v1.json';
const template = JSON.parse(readFileSync(join(aqui, '..', 'templates', arquivo), 'utf8')) as CardTemplate;

const inicio = performance.now();
const specs = montarSpecs(opcoes);
const pdf = await gerarPdf(template, specs, { ceder: 0 });
writeFileSync(saida, Buffer.from(pdf));
console.log(JSON.stringify({ paginas: specs.length, ms: Math.round(performance.now() - inicio), bytes: pdf.byteLength }));
