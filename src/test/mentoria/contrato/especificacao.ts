import documento from '../../../../docs/mentoria/contrato-v2.3.openapi.json';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface Operacao {
  operationId: string;
  metodo: MetodoHttp;
  modelo: string;
  tag: 'academy' | 'mentorado';
  parametrosDeCaminho: string[];
  parametrosDeQuery: string[];
  exigeIdempotencia: boolean;
  esquemaCorpo: unknown | null;
  respostas: Record<string, unknown | null>;
}
export const especificacao: unknown = documento;
type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Objeto : {};

function resolver(v: unknown): Objeto {
  const o = objeto(v);
  if (typeof o.$ref !== 'string') return o;
  if (!o.$ref.startsWith('#/')) throw new Error(`Referencia nao local: ${o.$ref}`);
  return objeto(o.$ref.slice(2).split('/').reduce<unknown>((atual, chave) => objeto(atual)[chave.replace(/~1/g, '/').replace(/~0/g, '~')], especificacao));
}
function esquema(v: unknown): unknown | null {
  const s = objeto(objeto(objeto(resolver(v).content)['application/json']).schema);
  return Object.keys(s).length ? resolver(s) : null;
}
export const operacoes: Operacao[] = Object.entries(documento.paths).flatMap(([modelo, metodos]) =>
  Object.entries(metodos).flatMap(([metodo, valor]) => {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) return [];
    const o = objeto(valor);
    const parametros = [...(Array.isArray(objeto(metodos).parameters) ? objeto(metodos).parameters as unknown[] : []), ...(Array.isArray(o.parameters) ? o.parameters : [])].map(resolver);
    return [{
      operationId: String(o.operationId), metodo: metodo.toUpperCase() as MetodoHttp, modelo,
      tag: Array.isArray(o.tags) && o.tags.includes('mentorado') ? 'mentorado' : 'academy',
      parametrosDeCaminho: parametros.filter((p) => p.in === 'path').map((p) => String(p.name)),
      parametrosDeQuery: parametros.filter((p) => p.in === 'query').map((p) => String(p.name)),
      exigeIdempotencia: parametros.some((p) => p.in === 'header' && p.name === 'Idempotency-Key'),
      esquemaCorpo: esquema(o.requestBody),
      respostas: Object.fromEntries(Object.entries(objeto(o.responses)).map(([status, resposta]) => [status, esquema(resposta)])),
    }];
  }));

export function operacao(operationId: string): Operacao {
  const encontrada = operacoes.find((o) => o.operationId === operationId);
  if (!encontrada) throw new Error(`Operacao desconhecida: ${operationId}`);
  return encontrada;
}
export function resolverOperacao(metodo: string, caminho: string): { operacao: Operacao; parametros: Record<string, string>; query: Record<string, string> } | null {
  const separador = caminho.indexOf('?');
  const partes = (separador < 0 ? caminho : caminho.slice(0, separador)).split('/');
  for (const o of operacoes) {
    const modelo = o.modelo.split('/');
    if (o.metodo !== metodo || modelo.length !== partes.length) continue;
    const parametros: Record<string, string> = {};
    const casa = modelo.every((parte, i) => {
      if (!parte.startsWith('{')) return parte === partes[i];
      if (!partes[i]) return false;
      try { parametros[parte.slice(1, -1)] = decodeURIComponent(partes[i]); } catch { return false; }
      return !/[/?#\\]/.test(parametros[parte.slice(1, -1)]);
    });
    if (casa) return { operacao: o, parametros, query: Object.fromEntries(new URLSearchParams(separador < 0 ? '' : caminho.slice(separador + 1))) };
  }
  return null;
}
