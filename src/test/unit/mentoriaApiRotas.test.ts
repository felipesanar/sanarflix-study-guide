import { describe, it, expect } from 'vitest';
import { resolverRequisicao, compararSegredo } from '../../../supabase/functions/mentoria-api/rotas';

const CHAVE = 'segredo-do-kong';
const req = (over: Partial<Parameters<typeof resolverRequisicao>[0]> = {}) => ({
  method: 'GET',
  path: '/me',
  headers: { 'x-mentoria-key': CHAVE, 'x-aluno-email': 'Aluno@Sanar.com ' } as Record<string, string | undefined>,
  query: {} as Record<string, string | undefined>,
  ...over,
});

describe('mentoria-api · rotas', () => {
  it('401 sem chave', () => {
    const r = resolverRequisicao(req({ headers: { 'x-aluno-email': 'a@b.com' } }), CHAVE);
    expect(r).toMatchObject({ ok: false, status: 401, corpo: { erro: 'nao_autorizado' } });
  });

  it('401 com chave errada', () => {
    const r = resolverRequisicao(req({ headers: { 'x-mentoria-key': 'outra', 'x-aluno-email': 'a@b.com' } }), CHAVE);
    expect(r).toMatchObject({ ok: false, status: 401, corpo: { erro: 'nao_autorizado' } });
  });

  it('401 quando a chave esperada não está configurada', () => {
    const r = resolverRequisicao(req({ headers: { 'x-mentoria-key': '', 'x-aluno-email': 'a@b.com' } }), '');
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('400 sem x-aluno-email', () => {
    const r = resolverRequisicao(req({ headers: { 'x-mentoria-key': CHAVE } }), CHAVE);
    expect(r).toMatchObject({ ok: false, status: 400, corpo: { erro: 'aluno_ausente' } });
  });

  it('400 com x-aluno-email em branco', () => {
    const r = resolverRequisicao(req({ headers: { 'x-mentoria-key': CHAVE, 'x-aluno-email': '   ' } }), CHAVE);
    expect(r).toMatchObject({ ok: false, status: 400, corpo: { erro: 'aluno_ausente' } });
  });

  it('GET /me ok, com e-mail normalizado', () => {
    expect(resolverRequisicao(req(), CHAVE)).toEqual({ ok: true, rota: 'me', email: 'aluno@sanar.com', params: {} });
  });

  it('aceita nomes de header em caixa diferente', () => {
    const r = resolverRequisicao(req({ headers: { 'X-Mentoria-Key': CHAVE, 'X-Aluno-Email': 'a@b.com' } }), CHAVE);
    expect(r).toMatchObject({ ok: true, rota: 'me', email: 'a@b.com' });
  });

  it('remove o prefixo /mentoria-api', () => {
    expect(resolverRequisicao(req({ path: '/mentoria-api/me' }), CHAVE)).toMatchObject({ ok: true, rota: 'me' });
    expect(resolverRequisicao(req({ path: '/functions/v1/mentoria-api/sessoes' }), CHAVE)).toMatchObject({ ok: true, rota: 'sessoes' });
    expect(resolverRequisicao(req({ path: '/mentoria-api/mural/' }), CHAVE)).toMatchObject({ ok: true, rota: 'mural' });
  });

  it('mural: aba padrão coletivo', () => {
    expect(resolverRequisicao(req({ path: '/mural' }), CHAVE)).toMatchObject({
      ok: true, rota: 'mural', params: { aba: 'coletivo', cursor: undefined },
    });
  });

  it('mural: aba pra-voce e cursor', () => {
    const cursor = '2026-10-08T12:00:00.000Z';
    expect(resolverRequisicao(req({ path: '/mural', query: { aba: 'pra-voce', cursor } }), CHAVE)).toMatchObject({
      ok: true, rota: 'mural', params: { aba: 'pra-voce', cursor },
    });
  });

  it('mural: aba inválida → 400 parametro_invalido', () => {
    expect(resolverRequisicao(req({ path: '/mural', query: { aba: 'outra' } }), CHAVE)).toMatchObject({
      ok: false, status: 400, corpo: { erro: 'parametro_invalido' },
    });
  });

  it('mural: cursor inválido → 400 parametro_invalido', () => {
    expect(resolverRequisicao(req({ path: '/mural', query: { cursor: 'ontem' } }), CHAVE)).toMatchObject({
      ok: false, status: 400, corpo: { erro: 'parametro_invalido' },
    });
  });

  it('sessoes: quando padrão proximas', () => {
    expect(resolverRequisicao(req({ path: '/sessoes' }), CHAVE)).toMatchObject({
      ok: true, rota: 'sessoes', params: { quando: 'proximas' },
    });
  });

  it('sessoes: realizadas', () => {
    expect(resolverRequisicao(req({ path: '/sessoes', query: { quando: 'realizadas' } }), CHAVE)).toMatchObject({
      ok: true, rota: 'sessoes', params: { quando: 'realizadas' },
    });
  });

  it('sessoes: quando inválido → 400', () => {
    expect(resolverRequisicao(req({ path: '/sessoes', query: { quando: 'todas' } }), CHAVE)).toMatchObject({
      ok: false, status: 400, corpo: { erro: 'parametro_invalido' },
    });
  });

  it('rota desconhecida → 404 rota_inexistente', () => {
    expect(resolverRequisicao(req({ path: '/outra' }), CHAVE)).toMatchObject({
      ok: false, status: 404, corpo: { erro: 'rota_inexistente' },
    });
  });

  it('método diferente de GET → 405', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      expect(resolverRequisicao(req({ method }), CHAVE)).toMatchObject({ ok: false, status: 405 });
    }
  });

  it('toda resposta de erro traz mensagem em pt-BR', () => {
    const r = resolverRequisicao(req({ path: '/outra' }), CHAVE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.corpo.mensagem.length).toBeGreaterThan(3);
  });
});

describe('compararSegredo', () => {
  it('iguais → true', () => expect(compararSegredo('abc123', 'abc123')).toBe(true));
  it('diferentes → false', () => expect(compararSegredo('abc123', 'abc124')).toBe(false));
  it('tamanhos diferentes → false', () => {
    expect(compararSegredo('abc', 'abc123')).toBe(false);
    expect(compararSegredo('abc123', 'abc')).toBe(false);
  });
  it('vazios → false', () => expect(compararSegredo('', '')).toBe(false));
});
