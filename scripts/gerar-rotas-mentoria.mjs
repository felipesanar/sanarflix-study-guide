import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function gerar(especificacao) {
  const resolver = (valor) => {
    if (!valor.$ref) return valor;
    if (!valor.$ref.startsWith('#/')) throw new Error('Referencia nao local.');
    return resolver(valor.$ref.slice(2).split('/').reduce((atual, chave) => atual[chave.replace(/~1/g, '/').replace(/~0/g, '~')], especificacao));
  };
  const rotas = [];
  for (const [modelo, item] of Object.entries(especificacao.paths)) {
    for (const [metodo, operacao] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(metodo) || !operacao.tags?.includes('academy')) continue;
      const parametros = new Map();
      for (const parametro of [...(item.parameters ?? []), ...(operacao.parameters ?? [])].map(resolver)) {
        parametros.set(`${parametro.in}:${parametro.name}`, parametro);
      }
      const lista = [...parametros.values()];
      const padrao = modelo.split(/(\{[^}]+\})/).map((parte) => parte.startsWith('{') ? '[A-Za-z0-9_:-]+' : parte.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('');
      rotas.push(`  { operationId: ${JSON.stringify(operacao.operationId)}, metodo: ${JSON.stringify(metodo.toUpperCase())}, modelo: ${JSON.stringify(modelo)}, caminho: /^${padrao}$/, parametrosDeQuery: ${JSON.stringify(lista.filter((p) => p.in === 'query').map((p) => p.name))}, exigeIdempotencia: ${lista.some((p) => p.in === 'header' && p.name.toLowerCase() === 'idempotency-key')} },`);
    }
  }
  return '// GERADO por scripts/gerar-rotas-mentoria.mjs a partir de docs/mentoria/contrato-v2.3.openapi.json. Não edite.\n'
    + 'export const ROTAS = [\n' + rotas.join('\n') + '\n];\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const especificacao = JSON.parse(readFileSync(new URL('../docs/mentoria/contrato-v2.3.openapi.json', import.meta.url), 'utf8'));
  writeFileSync(new URL('../supabase/functions/flix-mentoria-proxy/rotas.gerado.ts', import.meta.url), gerar(especificacao));
}
