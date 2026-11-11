// Modulo puro, compartilhado entre a Edge Function e os testes Vitest.
import { ROTAS } from './rotas.gerado.ts';
type Resolucao =
  | { ok: true; metodo: string; caminho: string; operationId: string; triboId: string | null; exigeIdempotencia: boolean }
  | { ok: false; status: number; corpo: { error: { code: string; message: string } } };

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

  const candidatas = ROTAS.filter((r) => r.caminho.test(path));
  if (!candidatas.length) return invalido;
  const rota = candidatas.find((r) => r.metodo === metodo);
  if (!rota) {
    return {
      ok: false, status: 405,
      corpo: { error: { code: 'metodo_nao_permitido', message: 'Metodo nao permitido para esta rota.' } },
    };
  }
  const normalizada = new URLSearchParams();
  for (const [chave, valor] of new URLSearchParams(query)) {
    if (!rota.parametrosDeQuery.includes(chave)) return invalido;
    normalizada.append(chave, valor);
  }
  const sufixo = normalizada.toString();
  return {
    ok: true, metodo: rota.metodo, caminho: path + (sufixo ? `?${sufixo}` : ''),
    operationId: rota.operationId, exigeIdempotencia: rota.exigeIdempotencia,
    triboId: rota.modelo.startsWith('/tribos/{triboId}/') ? path.split('/')[2] : null,
  };
}

// Ambos os argumentos sao resolvidos no servidor, nunca pelo payload do cliente.
export function montarHeaders(tokenServico: string, mentorId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${tokenServico}`,
    'X-Mentor-Id': mentorId,
    'Content-Type': 'application/json',
  };
}
