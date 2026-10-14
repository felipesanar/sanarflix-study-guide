import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { salvarPost, listarPosts, listarTags } from '@/services/mentor/mural';

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe('services/mentor/mural', () => {
  beforeEach(() => mockRpc.mockReset());

  it('salvarPost manda todos os p_* com defaults', async () => {
    mockRpc.mockReturnValue(ok({ post_id: 'p1', publicado: false, intervencao_id: null }));
    await expect(
      salvarPost({ tag: 'Aviso', titulo: 'Oi', mensagem: 'Texto', publico: 'turma', publicar: false }),
    ).resolves.toEqual({ post_id: 'p1', publicado: false, intervencao_id: null });
    expect(mockRpc).toHaveBeenCalledWith('mentor_mural_salvar', {
      p_id: null,
      p_tag: 'Aviso',
      p_titulo: 'Oi',
      p_mensagem: 'Texto',
      p_link_titulo: null,
      p_link_url: null,
      p_anexo_path: null,
      p_anexo_nome: null,
      p_publico: 'turma',
      p_destinatarios: [],
      p_publicar: false,
      p_registrar_intervencao: false,
    });
  });

  it('salvarPost repassa edição, link, anexo, destinatários e registro de intervenção', async () => {
    mockRpc.mockReturnValue(ok({ post_id: 'p1', publicado: true, intervencao_id: 'i1' }));
    await salvarPost({
      id: 'p1', tag: 'Desempenho', titulo: 'T', mensagem: 'M',
      linkTitulo: 'Veja', linkUrl: 'https://x.com', anexoPath: 'u1/a.pdf', anexoNome: 'a.pdf',
      publico: 'selecionados', destinatarios: ['a@x.com'], publicar: true, registrarIntervencao: true,
    });
    expect(mockRpc).toHaveBeenCalledWith('mentor_mural_salvar', {
      p_id: 'p1', p_tag: 'Desempenho', p_titulo: 'T', p_mensagem: 'M',
      p_link_titulo: 'Veja', p_link_url: 'https://x.com', p_anexo_path: 'u1/a.pdf', p_anexo_nome: 'a.pdf',
      p_publico: 'selecionados', p_destinatarios: ['a@x.com'], p_publicar: true, p_registrar_intervencao: true,
    });
  });

  it('listarPosts manda filtros nulos por padrão', async () => {
    mockRpc.mockReturnValue(ok([]));
    await expect(listarPosts()).resolves.toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('mentor_mural_listar', { p_aluno_email: null, p_tag: null });
  });

  it('listarPosts repassa aluno e tag', async () => {
    mockRpc.mockReturnValue(ok([]));
    await listarPosts({ alunoEmail: 'a@x.com', tag: 'Aviso' });
    expect(mockRpc).toHaveBeenCalledWith('mentor_mural_listar', { p_aluno_email: 'a@x.com', p_tag: 'Aviso' });
  });

  it('listarTags chama mentor_tags', async () => {
    mockRpc.mockReturnValue(ok(['Aviso']));
    await expect(listarTags()).resolves.toEqual(['Aviso']);
    expect(mockRpc).toHaveBeenCalledWith('mentor_tags', {});
  });

  it('erro da RPC vira Error com a mensagem', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'post não encontrado' } }));
    await expect(listarTags()).rejects.toThrow('post não encontrado');
  });
});
