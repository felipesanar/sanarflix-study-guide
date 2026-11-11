import { especificacao } from './especificacao';

export interface ErroEsquema { caminho: string; mensagem: string }
export const PALAVRAS_SUPORTADAS: readonly string[] = ['$ref', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'minProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'oneOf', 'format', 'description'];
type Objeto = Record<string, unknown>;
const objeto = (v: unknown): v is Objeto => v !== null && typeof v === 'object' && !Array.isArray(v);
const chave = (v: unknown): string => Array.isArray(v) ? `[${v.map(chave).join(',')}]` : objeto(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${chave(v[k])}`).join(',')}}` : JSON.stringify(v) ?? 'undefined';
const igual = (a: unknown, b: unknown): boolean => chave(a) === chave(b);
const dataValida = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

export function validarEsquema(esquema: unknown, valor: unknown, raiz: unknown = especificacao): ErroEsquema[] {
  function visitar(s: unknown, v: unknown, caminho: string, profundidade: number): ErroEsquema[] {
    const erros: ErroEsquema[] = [];
    const erro = (mensagem: string, local = caminho) => erros.push({ caminho: local, mensagem });
    const filho = (nome: string) => `${caminho}/${nome.replace(/~/g, '~0').replace(/\//g, '~1')}`;
    if (profundidade > 100) return [{ caminho, mensagem: 'Referencia circular ou profundidade excedida.' }];
    if (s === false) return [{ caminho, mensagem: 'Valor nao permitido.' }];
    if (!objeto(s)) return erros;
    if (typeof s.$ref === 'string') {
      const destino = s.$ref.startsWith('#/') ? s.$ref.slice(2).split('/').reduce<unknown>((a, k) => objeto(a) ? a[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined, raiz) : undefined;
      if (destino === undefined) erro(`Referencia nao encontrada: ${s.$ref}`);
      else erros.push(...visitar(destino, v, caminho, profundidade + 1));
    }
    const tipos = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
    if (v === null && tipos.includes('null')) return erros;
    if (tipos.length && !tipos.some((t) => t === 'null' ? v === null : t === 'object' ? objeto(v) : t === 'array' ? Array.isArray(v) : t === 'integer' ? typeof v === 'number' && Number.isInteger(v) : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === t)) erro(`Tipo esperado: ${tipos.join(' ou ')}.`);
    if (Array.isArray(s.enum) && !s.enum.some((x) => igual(x, v))) erro('Valor fora do enum.');
    if ('const' in s && !igual(s.const, v)) erro('Valor diferente da constante.');
    if (Array.isArray(s.oneOf) && s.oneOf.filter((ramo) => visitar(ramo, v, caminho, profundidade + 1).length === 0).length !== 1) erro('Deve corresponder a exatamente um esquema de oneOf.');
    if (objeto(v)) {
      const propriedades = objeto(s.properties) ? s.properties : {};
      if (Array.isArray(s.required)) for (const nome of s.required) if (typeof nome === 'string' && !Object.prototype.hasOwnProperty.call(v, nome)) erro('Campo obrigatorio.', filho(nome));
      if (typeof s.minProperties === 'number' && Object.keys(v).length < s.minProperties) erro('Objeto com menos propriedades que o minimo.');
      for (const [nome, conteudo] of Object.entries(v)) {
        if (Object.prototype.hasOwnProperty.call(propriedades, nome)) erros.push(...visitar(propriedades[nome], conteudo, filho(nome), profundidade + 1));
        else if (s.additionalProperties === false) erro('Propriedade adicional nao permitida.', filho(nome));
        else if (objeto(s.additionalProperties)) erros.push(...visitar(s.additionalProperties, conteudo, filho(nome), profundidade + 1));
      }
    }
    if (Array.isArray(v)) {
      if (typeof s.minItems === 'number' && v.length < s.minItems) erro('Lista menor que o minimo.');
      if (typeof s.maxItems === 'number' && v.length > s.maxItems) erro('Lista maior que o maximo.');
      if (s.uniqueItems === true && new Set(v.map(chave)).size !== v.length) erro('Itens devem ser unicos.');
      if (s.items !== undefined) v.forEach((item, i) => erros.push(...visitar(s.items, item, filho(String(i)), profundidade + 1)));
    }
    if (typeof v === 'string') {
      if (typeof s.minLength === 'number' && [...v].length < s.minLength) erro('Texto menor que o minimo.');
      if (typeof s.maxLength === 'number' && [...v].length > s.maxLength) erro('Texto maior que o maximo.');
      if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(v)) erro('Texto nao corresponde ao padrao.');
      if (s.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) erro('UUID invalido.');
      if (s.format === 'date' && !dataValida(v)) erro('Data invalida.');
      if (s.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(v) || !dataValida(v.slice(0, 10)) || Number.isNaN(Date.parse(v)))) erro('Instante ISO 8601 com fuso obrigatorio.');
    }
    if (typeof v === 'number') {
      if (typeof s.minimum === 'number' && v < s.minimum) erro('Numero menor que o minimo.');
      if (typeof s.maximum === 'number' && v > s.maximum) erro('Numero maior que o maximo.');
    }
    return erros;
  }
  return visitar(esquema, valor, '', 0);
}

export function palavrasNaoSuportadas(documento: unknown): string[] {
  const encontradas = new Set<string>();
  function schema(v: unknown): void {
    if (!objeto(v)) return;
    for (const [nome, valor] of Object.entries(v)) {
      if (!PALAVRAS_SUPORTADAS.includes(nome)) encontradas.add(nome);
      if (nome === 'properties' && objeto(valor)) Object.values(valor).forEach(schema);
      if (nome === 'items' || nome === 'additionalProperties') schema(valor);
      if (nome === 'oneOf' && Array.isArray(valor)) valor.forEach(schema);
    }
  }
  function parametros(v: unknown): void {
    if (Array.isArray(v)) { v.forEach(parametros); return; }
    if (!objeto(v)) return;
    if ('schema' in v) schema(v.schema);
    for (const [nome, conteudo] of Object.entries(v)) if (nome !== 'schemas' && nome !== 'schema') parametros(conteudo);
  }
  if (objeto(documento)) {
    const componentes = objeto(documento.components) ? documento.components : {};
    if (objeto(componentes.schemas)) Object.values(componentes.schemas).forEach(schema);
    parametros(componentes.parameters);
    parametros(documento.paths);
  }
  return [...encontradas].sort();
}
