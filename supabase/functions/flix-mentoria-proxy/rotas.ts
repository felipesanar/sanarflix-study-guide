// Modulo puro, compartilhado entre a Edge Function e os testes Vitest.
type Resolucao =
  | { ok: true; metodo: string; caminho: string }
  | { ok: false; status: number; corpo: { error: { code: string; message: string } } };

const ROTAS: { caminho: RegExp; metodos: string[] }[] = [
  { caminho: /^\/me$/, metodos: ['GET'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/alunos$/, metodos: ['GET'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/alunos\/[A-Za-z0-9_:-]+$/, metodos: ['GET'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/canais$/, metodos: ['GET'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/canais\/grupo_tribo$/, metodos: ['PUT'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/publicacoes$/, metodos: ['GET', 'POST'] },
  { caminho: /^\/publicacoes\/[A-Za-z0-9_:-]+$/, metodos: ['PATCH', 'DELETE'] },
  { caminho: /^\/uploads$/, metodos: ['POST'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/sessoes$/, metodos: ['GET', 'POST'] },
  { caminho: /^\/sessoes\/[A-Za-z0-9_:-]+$/, metodos: ['PATCH', 'DELETE'] },
  { caminho: /^\/sessoes\/[A-Za-z0-9_:-]+\/gravacao$/, metodos: ['POST'] },
  { caminho: /^\/tribos\/[A-Za-z0-9_:-]+\/convites$/, metodos: ['GET', 'POST'] },
  { caminho: /^\/convites\/[A-Za-z0-9_:-]+$/, metodos: ['DELETE'] },
];
const QUERY_PERMITIDA = new Set(['limit', 'cursor', 'busca']);

export function validarRota(metodo: unknown, caminho: unknown): Resolucao {
  const invalido: Resolucao = {
    ok: false, status: 400,
    corpo: { error: { code: 'caminho_invalido', message: 'Caminho ou query nao permitido.' } },
  };
  if (typeof caminho !== 'string') return invalido;
  const separador = caminho.indexOf('?');
  const path = separador === -1 ? caminho : caminho.slice(0, separador);
  const query = separador === -1 ? '' : caminho.slice(separador + 1);

  // Valide antes de usar URL: ela normalizaria segmentos de traversal.
  if (!path.startsWith('/') || /[^A-Za-z0-9/_:-]/.test(path) ||
    path.includes('..') || /%2e|%2f|%5c/i.test(path) ||
    path.includes('\\') || path.includes('//')) return invalido;

  const rota = ROTAS.find((r) => r.caminho.test(path));
  if (!rota) return invalido;
  const normalizada = new URLSearchParams();
  for (const [chave, valor] of new URLSearchParams(query)) {
    if (!QUERY_PERMITIDA.has(chave)) return invalido;
    normalizada.append(chave, valor);
  }
  if (typeof metodo !== 'string' || !rota.metodos.includes(metodo)) {
    return {
      ok: false, status: 405,
      corpo: { error: { code: 'metodo_nao_permitido', message: 'Metodo nao permitido para esta rota.' } },
    };
  }
  const sufixo = normalizada.toString();
  return { ok: true, metodo, caminho: path + (sufixo ? `?${sufixo}` : '') };
}

// Ambos os argumentos sao resolvidos no servidor, nunca pelo payload do cliente.
export function montarHeaders(tokenServico: string, mentorId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${tokenServico}`,
    'X-Mentor-Id': mentorId,
    'Content-Type': 'application/json',
  };
}
