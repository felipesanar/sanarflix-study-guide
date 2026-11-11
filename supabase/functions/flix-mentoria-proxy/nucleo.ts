import { montarHeaders, validarRota } from './rotas.ts';

export interface DependenciasProxy {
  usuarioDoJwt(jwt: string): Promise<{ id: string; email: string | null } | null>;
  flixMentorId(userId: string): Promise<string | null>;
  buscar(url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal; redirect: 'manual' }): Promise<{ status: number; text(): Promise<string>; cancelar(): Promise<void> }>;
  config(): { flixUrl: string | null; flixToken: string | null };
  novoId(): string;
  agora(): number;
  registrar(evento: Record<string, unknown>): void;
}
export interface EntradaProxy {
  metodoHttp: string;
  origin: string | null;
  corsPermitido: boolean;
  authorization: string | null;
  requestId: string | null;
  corpo: unknown;
}
export interface SaidaProxy { status: number; corpo: string | null; headers: Record<string, string> }
export class ErroConfiguracaoProxy extends Error {}

export function criarProxy(deps: DependenciasProxy): (entrada: EntradaProxy) => Promise<SaidaProxy> {
  const cache = new Map<string, { expiraEm: number; tribos: Set<string> }>();
  return async (entrada) => {
    const inicio = deps.agora();
    const requestId = entrada.requestId && /^[A-Za-z0-9_-]{8,64}$/.test(entrada.requestId) ? entrada.requestId : deps.novoId();
    const headers = { 'X-Request-Id': requestId, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    let operationId: string | null = null;
    let metodo: string | null = null;
    let mentorId: string | null = null;
    const saida = (status: number, corpo: string | null, code: string | null = null): SaidaProxy => {
      if (status >= 400) deps.registrar({ requestId, operationId, metodo, status, code, mentorId, duracaoMs: deps.agora() - inicio });
      return { status, corpo, headers };
    };
    const erro = (status: number, code: string, message: string, field?: string) =>
      saida(status, JSON.stringify({ error: { code, message, requestId, ...(field ? { field } : {}) } }), code);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (entrada.origin !== null && !entrada.corsPermitido) return erro(403, 'origem_nao_permitida', 'Origem nao permitida.');
      if (entrada.metodoHttp === 'OPTIONS') return saida(204, null);
      if (entrada.metodoHttp !== 'POST') return erro(405, 'metodo_nao_permitido', 'Use POST para chamar o proxy.');
      const jwt = /^Bearer\s+(\S+)$/i.exec(entrada.authorization ?? '')?.[1];
      if (!jwt) return erro(401, 'token_invalido', 'Sessao expirada.');
      let usuario;
      try { usuario = await deps.usuarioDoJwt(jwt); } catch (falha) {
        if (falha instanceof ErroConfiguracaoProxy) return erro(500, 'configuracao', 'Proxy nao configurado.');
        return erro(401, 'token_invalido', 'Sessao expirada.');
      }
      if (!usuario) return erro(401, 'token_invalido', 'Sessao expirada.');
      const { flixUrl, flixToken } = deps.config();
      if (!flixUrl || !flixToken) return erro(503, 'flix_indisponivel', 'Integracao com o Flix ainda nao configurada.');
      if (!entrada.corpo || typeof entrada.corpo !== 'object' || Array.isArray(entrada.corpo)) return erro(400, 'caminho_invalido', 'Informe um objeto JSON valido.');
      const payload = entrada.corpo as Record<string, unknown>;
      const rota = validarRota(payload.metodo, payload.caminho);
      if (rota.ok === false) return erro(rota.status, rota.corpo.error.code, rota.corpo.error.message);
      operationId = rota.operationId;
      metodo = rota.metodo;
      try { mentorId = await deps.flixMentorId(usuario.id); } catch {
        return erro(403, 'mentor_sem_vinculo_flix', 'Mentor sem vinculo com o Flix.');
      }
      if (!mentorId?.trim()) return erro(403, 'mentor_sem_vinculo_flix', 'Mentor sem vinculo com o Flix.');
      const headersFlix = { ...montarHeaders(flixToken, mentorId), 'X-Request-Id': requestId };
      if (rota.exigeIdempotencia && metodo !== 'GET') {
        if (typeof payload.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(payload.idempotencyKey)) return erro(400, 'validacao', 'Informe uma chave de idempotencia valida.', 'idempotencyKey');
        Object.assign(headersFlix, { 'Idempotency-Key': payload.idempotencyKey });
      }
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15_000);
      const base = `${flixUrl.replace(/\/+$/, '')}/mentoria/v1`;
      if (rota.triboId) {
        let vinculo = cache.get(mentorId);
        if (!vinculo || vinculo.expiraEm <= deps.agora()) {
          cache.delete(mentorId);
          const me = await deps.buscar(`${base}/me`, { method: 'GET', headers: { ...montarHeaders(flixToken, mentorId), 'X-Request-Id': requestId }, signal: controller.signal, redirect: 'manual' });
          if (me.status < 200 || me.status >= 300) {
            await me.cancelar();
            return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
          }
          const dados = JSON.parse(await me.text());
          if (!dados || !Array.isArray(dados.tribos) || !dados.tribos.every((tribo: unknown) => tribo && typeof tribo === 'object' && typeof (tribo as { id?: unknown }).id === 'string')) return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
          vinculo = { expiraEm: deps.agora() + 60_000, tribos: new Set(dados.tribos.map((tribo: { id: string }) => tribo.id)) };
          cache.set(mentorId, vinculo);
        }
        if (!vinculo.tribos.has(rota.triboId)) return erro(403, 'sem_acesso_tribo', 'Mentor sem acesso a esta tribo.');
      }
      const resposta = await deps.buscar(`${base}${rota.caminho}`, {
        method: metodo, headers: headersFlix,
        body: metodo !== 'GET' && payload.corpo !== undefined ? JSON.stringify(payload.corpo) : undefined,
        signal: controller.signal, redirect: 'manual',
      });
      if (resposta.status >= 500 || (resposta.status >= 300 && resposta.status < 400)) {
        await resposta.cancelar();
        return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
      }
      const corpo = resposta.status === 204 || resposta.status === 205 ? null : await resposta.text();
      // Apenas codigos conhecidos: campos arbitrarios do Flix nunca entram no registro.
      let code = 'flix';
      if (resposta.status >= 400 && corpo) {
        try {
          const recebido = JSON.parse(corpo)?.error?.code;
          if (['validacao', 'token_invalido', 'sem_acesso_tribo', 'nao_encontrado', 'conflito_horario', 'chave_reutilizada', 'sem_destinatarios', 'anexo_invalido', 'anexo_expirado', 'aluno_fora_da_tribo'].includes(recebido)) code = recebido;
        } catch { /* Resposta nao JSON continua opaca. */ }
      }
      return saida(resposta.status, corpo, resposta.status >= 400 ? code : null);
    } catch {
      return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  };
}
