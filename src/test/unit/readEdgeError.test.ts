import { describe, it, expect } from 'vitest';
import { readEdgeError, ACCESS_EXPIRED_CODE } from '@/utils/readEdgeError';

const err = (body: string, status = 401) => ({ context: new Response(body, { status }) });

describe('readEdgeError', () => {
  it('identifica acesso expirado', async () => {
    const r = await readEdgeError(err(JSON.stringify({ error: 'x', code: 'ACCESS_EXPIRED' })));
    expect(r.code).toBe(ACCESS_EXPIRED_CODE);
  });
  it('mantém mensagem de credenciais inválidas', async () => {
    const r = await readEdgeError(err(JSON.stringify({ error: 'Email ou senha inválidos' })));
    expect(r).toEqual({ message: 'Email ou senha inválidos', code: undefined });
  });
  it('corpo ilegível não retorna mensagem', async () => {
    const r = await readEdgeError(err('oops'));
    expect(r.message).toBeUndefined();
    expect(r.code).toBeUndefined();
  });
});
