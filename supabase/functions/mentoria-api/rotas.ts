// Roteamento e autenticação da API de Mentoria. Módulo PURO: nada de APIs do
// Deno, para que o Vitest consiga importá-lo (ver mentoriaApiRotas.test.ts).

export type Rota = 'me' | 'mural' | 'sessoes';

export interface Requisicao {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

export type Resolucao =
  | { ok: true; rota: Rota; email: string; params: Record<string, string | undefined> }
  | { ok: false; status: number; corpo: { erro: string; mensagem: string } };

const falha = (status: number, erro: string, mensagem: string): Resolucao => ({
  ok: false,
  status,
  corpo: { erro, mensagem },
});

/** Comparação em tempo constante. Vazio nunca confere. */
export function compararSegredo(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const n = Math.max(x.length, y.length);
  let dif = x.length ^ y.length;
  for (let i = 0; i < n; i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

function header(headers: Record<string, string | undefined>, nome: string): string | undefined {
  const alvo = nome.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === alvo) return headers[k];
  }
  return undefined;
}

/** Tira o prefixo da function (`/functions/v1/mentoria-api` ou `/mentoria-api`) e a barra final. */
function normalizarPath(path: string): string {
  let p = path.split('?')[0];
  p = p.replace(/^\/functions\/v1(?=\/)/, '').replace(/^\/mentoria-api(?=\/|$)/, '');
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

const ROTAS: Record<string, Rota> = { '/me': 'me', '/mural': 'mural', '/sessoes': 'sessoes' };

export function resolverRequisicao(req: Requisicao, chaveEsperada: string): Resolucao {
  const chave = header(req.headers, 'x-mentoria-key') ?? '';
  if (!compararSegredo(chave, chaveEsperada)) {
    return falha(401, 'nao_autorizado', 'Credencial ausente ou inválida.');
  }

  if (req.method.toUpperCase() !== 'GET') {
    return falha(405, 'metodo_nao_permitido', 'Esta API aceita apenas GET.');
  }

  const rota = ROTAS[normalizarPath(req.path)];
  if (!rota) return falha(404, 'rota_inexistente', 'Rota inexistente.');

  const email = (header(req.headers, 'x-aluno-email') ?? '').trim().toLowerCase();
  if (!email) return falha(400, 'aluno_ausente', 'Cabeçalho x-aluno-email ausente.');

  if (rota === 'mural') {
    const aba = req.query.aba?.trim() || 'coletivo';
    if (aba !== 'coletivo' && aba !== 'pra-voce') {
      return falha(400, 'parametro_invalido', "Parâmetro 'aba' deve ser 'coletivo' ou 'pra-voce'.");
    }
    const cursor = req.query.cursor?.trim() || undefined;
    if (cursor !== undefined && Number.isNaN(Date.parse(cursor))) {
      return falha(400, 'parametro_invalido', "Parâmetro 'cursor' deve ser uma data ISO 8601.");
    }
    return { ok: true, rota, email, params: { aba, cursor } };
  }

  if (rota === 'sessoes') {
    const quando = req.query.quando?.trim() || 'proximas';
    if (quando !== 'proximas' && quando !== 'realizadas') {
      return falha(400, 'parametro_invalido', "Parâmetro 'quando' deve ser 'proximas' ou 'realizadas'.");
    }
    return { ok: true, rota, email, params: { quando } };
  }

  return { ok: true, rota, email, params: {} };
}
