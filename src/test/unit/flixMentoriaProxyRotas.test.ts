import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gerar } from '../../../scripts/gerar-rotas-mentoria.mjs';
import { montarHeaders, validarRota } from '../../../supabase/functions/flix-mentoria-proxy/rotas';

const rotas = [
  ['GET', '/me'],
  ['PATCH', '/me'],
  ['GET', '/tribos/tribo-1/alunos'],
  ['GET', '/tribos/tribo-1/alunos/aluno_2'],
  ['GET', '/tribos/tribo-1/canais'],
  ['PUT', '/tribos/tribo-1/canais/grupo_tribo'],
  ['GET', '/tribos/tribo-1/publicacoes'],
  ['POST', '/tribos/tribo-1/publicacoes'],
  ['PATCH', '/publicacoes/pub-1'],
  ['DELETE', '/publicacoes/pub-1'],
  ['POST', '/uploads'],
  ['GET', '/tribos/tribo-1/sessoes'],
  ['POST', '/tribos/tribo-1/sessoes'],
  ['PATCH', '/sessoes/sessao-1'],
  ['DELETE', '/sessoes/sessao-1'],
  ['POST', '/sessoes/sessao-1/gravacao'],
  ['POST', '/tribos/tribo-1/horarios'],
  ['POST', '/sessoes/sessao-1/cancelar'],
];

describe('flix-mentoria-proxy: rotas', () => {
  it('mantem a lista gerada identica a especificacao atual', () => {
    const especificacao = JSON.parse(readFileSync('docs/mentoria/contrato-v2.3.openapi.json', 'utf8'));
    expect(readFileSync('supabase/functions/flix-mentoria-proxy/rotas.gerado.ts', 'utf8')).toBe(gerar(especificacao));
  });

  it.each([['GET', '/tribos/a/convites'], ['POST', '/tribos/a/convites'], ['DELETE', '/convites/a']])('recusa legado %s %s', (metodo, caminho) => {
    expect(validarRota(metodo, caminho)).toMatchObject({ ok: false, status: 400 });
  });

  it('restringe query por operacao e devolve metadados', () => {
    expect(validarRota('GET', '/tribos/a/publicacoes?status=publicada&tag=aviso')).toMatchObject({ ok: true, operationId: 'listarPublicacoes', triboId: 'a', exigeIdempotencia: false });
    expect(validarRota('POST', '/tribos/a/publicacoes?status=publicada')).toMatchObject({ ok: false, status: 400 });
    expect(validarRota('GET', '/me?limit=1')).toMatchObject({ ok: false, status: 400 });
    expect(validarRota('PATCH', '/me')).toMatchObject({ ok: true, operationId: 'atualizarMe', triboId: null, exigeIdempotencia: true });
  });
  it.each(rotas)('permite %s %s', (metodo, caminho) => {
    expect(validarRota(metodo, caminho)).toMatchObject({ ok: true, metodo, caminho });
  });

  it.each([
    '/tribos/../alunos', '/tribos/%2e%2e/alunos', '/tribos/%2E/alunos',
    '/tribos/a%2Fb/alunos', '/tribos/a%2fb/alunos', '/tribos/a%5Cb/alunos',
    '/tribos/a\\b/alunos', '/tribos//alunos', '//me', '/me/',
    '/me#fragmento', '/me\n', '/tribos/a b/alunos', '/tribos/á/alunos',
    '/tribos/a.b/alunos', '/tribos/%252e%252e/alunos',
    'https://outro.test/me', '/desconhecida', '/tribos/a/alunos/b/extra',
    '/publicacoes/a/gravacao', '/convites/a/gravacao', '/tribos/a/canais/avisos',
    '',
  ])('rejeita caminho inseguro ou desconhecido: %s', (caminho) => {
    expect(validarRota('GET', caminho)).toMatchObject({
      ok: false, status: 400, corpo: { error: { code: 'caminho_invalido' } },
    });
  });

  it.each(rotas)('rejeita metodo errado para %s %s', (metodo, caminho) => {
    const errado = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].find(
      (candidato) => !rotas.some(([m, c]) => c === caminho && m === candidato),
    );
    expect(validarRota(errado, caminho)).toMatchObject({
      ok: false, status: 405,
    });
  });

  it.each(['HEAD', 'OPTIONS', 'TRACE', 'get', '', null, 42])('rejeita metodo %s', (metodo) => {
    expect(validarRota(metodo, '/me')).toMatchObject({ ok: false, status: 405 });
  });

  it.each([null, undefined, 42, {}, []])('rejeita caminho nao textual: %s', (caminho) => {
    expect(validarRota('GET', caminho)).toMatchObject({ ok: false, status: 400 });
  });

  it.each(['/me?admin=true', '/me?limit=10&mentorId=outro', '/me?%58-Mentor-Id=outro']) (
    'rejeita query fora da allowlist: %s', (caminho) => {
      expect(validarRota('GET', caminho)).toMatchObject({
        ok: false, status: 400, corpo: { error: { code: 'caminho_invalido' } },
      });
    },
  );

  it('recodifica cada par sem permitir que valores virem novos parametros', () => {
    expect(validarRota('GET', '/tribos/a/alunos?limit=10&cursor=a%2fb%3d%3d&busca=Ana%20Maria%26admin%3Dtrue')).toMatchObject({
      ok: true, metodo: 'GET',
      caminho: '/tribos/a/alunos?limit=10&cursor=a%2Fb%3D%3D&busca=Ana+Maria%26admin%3Dtrue',
    });
  });

  it('preserva pares repetidos e normaliza nome codificado e query vazia', () => {
    expect(validarRota('GET', '/tribos/a/alunos?%6cimit=1&busca=a&busca=b')).toMatchObject({
      ok: true, caminho: '/tribos/a/alunos?limit=1&busca=a&busca=b',
    });
    expect(validarRota('GET', '/me?')).toMatchObject({ ok: true, caminho: '/me' });
  });
});

describe('flix-mentoria-proxy: headers', () => {
  it('usa somente credenciais do servidor, sem headers ou metadados do cliente', () => {
    const cliente = {
      metodo: 'GET', caminho: '/me',
      headers: { Authorization: 'Bearer atacante', 'X-Mentor-Id': 'atacante' },
      user_metadata: { flix_user_id: 'atacante' },
      app_metadata: { flix_user_id: 'atacante' },
    };
    expect(validarRota(cliente.metodo, cliente.caminho)).toMatchObject({
      ok: true, metodo: 'GET', caminho: '/me',
    });
    expect(montarHeaders('token-servico', 'mentor-do-banco')).toEqual({
      Authorization: 'Bearer token-servico',
      'X-Mentor-Id': 'mentor-do-banco',
      'Content-Type': 'application/json',
    });
  });
});
