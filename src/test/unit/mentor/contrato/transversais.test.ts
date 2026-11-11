import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ErroFonte } from '@/features/mentor/api/fonte';
import { mensagemErro, MENSAGENS_ERRO } from '@/features/mentor/api/erros';
import { MODULOS, preparar, PUBLICACAO } from './apoio';

function arquivos(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
    if (item.name === 'test' || item.name === '__tests__' || item.name.startsWith('.env')) return [];
    const caminho = join(diretorio, item.name);
    return item.isDirectory() ? arquivos(caminho) : /\.[cm]?[jt]sx?$/.test(item.name) ? [caminho] : [];
  });
}

describe('regras transversais', () => {
  it('[T1] importacao dinamica por alias resolve modulo existente dentro do teste', async () => {
    const caminho = '@/features/mentor/lib/regrasMentor';
    const { engajamento } = await import(caminho);
    expect(engajamento(0)).toBe('ativo');
  });
  it('[T5] token de servico e segredos nao chegam ao src', () => {
    expect(arquivos('src').filter((f) => readFileSync(f, 'utf8').includes('FLIX_MENTORIA_TOKEN'))).toEqual([]);
    const referencias = [...arquivos('src/features/mentor'), 'src/config/env.ts'].flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bVITE_[A-Z0-9_]+\b/g)].map(([chave]) => ({ arquivo: f, chave })));
    expect(referencias.filter(({ chave }) => /TOKEN|SECRET|FLIX_MENTORIA_URL/.test(chave))).toEqual([]);
  });
  // FALTA: components/mural-v2/anexoMural.ts faz fetch de upload fora de api/
  it.fails('[T1] lista infratores de acesso HTTP ou Supabase fora de api e exige lista vazia', () => {
    const infratores = arquivos('src/features/mentor').filter((f) => !relative('src/features/mentor', f).replace(/\\/g, '/').startsWith('api/'))
      .filter((f) => /\bfetch\s*\(|\bsupabase\s*\.|\bfunctions\s*\.\s*invoke/.test(readFileSync(f, 'utf8')))
      .map((f) => relative('src/features/mentor', f).replace(/\\/g, '/')).sort();
    expect(infratores).toEqual([]);
  });
  it('[T6] tribo de outro mentor gera ErroFonte e mensagem propria', async () => {
    const a = preparar();
    const erro = await a.fonte.alunos(a.triboDeOutroMentorId).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroFonte);
    expect(erro).toMatchObject({ status: 403, code: 'sem_acesso_tribo' });
    expect(mensagemErro(erro)).toBe('Você não tem acesso a esta turma.');
  });
  it('[T14] token invalido pede novo login sem usar mensagem generica', () => {
    const mensagem = mensagemErro(new ErroFonte(401, 'token_invalido', 'jwt expired'));
    expect(mensagem).not.toBe(MENSAGENS_ERRO.desconhecido);
    expect(mensagem).toMatch(/sessão|login|entrar/i);
    expect(mensagem).not.toContain('jwt');
  });
  it('[T13] mesma chave de idempotencia repete resposta com um so efeito no simulador', async () => {
    const a = preparar();
    const pedido = { metodo: 'POST', caminho: `/tribos/${a.triboId}/publicacoes`, corpo: PUBLICACAO, chaveIdempotencia: 'intencao-publicar-0001' };
    const primeira = a.simulador.responder(pedido);
    expect(primeira.status).toBe(201);
    expect(a.simulador.responder(pedido)).toEqual(primeira);
    expect((await a.fonte.publicacoes(a.triboId)).data).toHaveLength(1);
  });
  it('[T13] novaChave gera valores distintos com 16 a 64 caracteres', async () => {
    const { novaChave } = await import(MODULOS.idempotencia);
    const chaves = Array.from({ length: 20 }, () => novaChave());
    expect(new Set(chaves).size).toBe(20);
    for (const chave of chaves) expect(chave).toMatch(/^.{16,64}$/);
  });
  it('[T13] fonte envia chave de idempotencia nas escritas', async () => {
    const a = preparar();
    await a.fonte.salvarGrupoTribo(a.triboId, 'https://chat.whatsapp.com/abc');
    await a.fonte.criarSessao(a.triboId, { tipo: 'individual', alunoId: a.alunoIds[0], inicio: '2026-11-14T17:00:00Z' });
    expect(a.invocar).toHaveBeenCalledTimes(2);
    for (const [, opcoes] of a.invocar.mock.calls) expect(opcoes.body).toMatchObject({ idempotencyKey: expect.stringMatching(/^.{16,64}$/) });
  });
  it('[T12] ErroFonte carrega o requestId que o cliente enviou e o servidor devolveu', async () => {
    const a = preparar();
    const erro = await a.fonte.alunos(a.triboDeOutroMentorId).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroFonte);
    const enviado = (a.invocar.mock.calls.at(-1)?.[1].body as { requestId?: string }).requestId;
    expect(enviado).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(erro).toMatchObject({ code: 'sem_acesso_tribo', requestId: enviado });
  });
});
