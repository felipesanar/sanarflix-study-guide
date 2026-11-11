import { describe, expect, it } from 'vitest';
import { resolverOperacao } from '@/test/mentoria/contrato/especificacao';
import { preparar, PUBLICACAO, SESSAO, JANELA, type FonteFutura } from './apoio';

describe('perfil', () => {
  it('[T1] [T3] me retorna mentor e tribos autorizadas', async () => {
    const a = preparar();
    expect(await a.fonte.me()).toMatchObject({ mentor: { id: a.mentorId }, tribos: expect.arrayContaining([expect.objectContaining({ id: a.triboId })]) });
    a.conferirPedidos();
  });
  it('[T3] atualizarPerfil retorna foto atualizada', async () => {
    const a = preparar();
    expect(await a.fonte.atualizarPerfil({ fotoUrl: 'https://exemplo.com/foto.png' })).toMatchObject({ id: a.mentorId, fotoUrl: 'https://exemplo.com/foto.png' });
    a.conferirPedidos();
  });
  it('[T3] atualiza bio, mote e conta Google pelo contrato v2.3', async () => {
    const a = preparar();
    const perfil = { bio: 'Bio', mote: 'Vamos estudar', googleEmail: 'mentor@exemplo.com', fotoUrl: null };
    expect(await a.fonte.atualizarPerfil(perfil)).toMatchObject({ ...perfil, ativo: true, agendaUrl: null });
    expect(await a.fonte.me()).toMatchObject({ mentor: perfil, portalMentor: true, tribos: [expect.objectContaining({ mentoriaAtiva: true }), expect.objectContaining({ mentoriaAtiva: true })] });
    a.conferirPedidos();
  });
});
describe('alunos', () => {
  it('[T3] todos os alunos trazem email para cruzamento e alunoId UUID', async () => {
    const a = preparar();
    const alunos = await a.fonte.alunos(a.triboId);
    expect(alunos.length).toBeGreaterThan(0);
    for (const aluno of alunos) {
      expect(aluno.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
      expect(aluno.alunoId).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
    }
    a.conferirPedidos();
  });
  it('[T3] alunos percorre paginas e preserva identificadores', async () => {
    const a = preparar();
    const alunos = await a.fonte.alunos(a.triboId);
    expect(alunos.map((aluno) => aluno.alunoId)).toEqual(a.alunoIds);
    a.conferirPedidos();
  });
  it('[T3] aluno retorna nome e contato pela chave do Flix', async () => {
    const a = preparar();
    expect(await a.fonte.aluno(a.triboId, a.alunoIds[0])).toMatchObject({ alunoId: a.alunoIds[0], nome: 'Ana Souza', email: expect.any(String) });
    a.conferirPedidos();
  });
});
describe('canais', () => {
  it('[T3] canais retorna somente os canais da modalidade', async () => {
    const a = preparar();
    expect((await a.fonte.canais(a.triboId)).map((c) => c.tipo)).toEqual(['avisos', 'plantao', 'grupo_turma']);
    expect((await a.fonte.canais(a.triboB2bId)).map((c) => c.tipo)).toEqual(['grupo_turma']);
    a.conferirPedidos();
  });
  it('[T3] salvarGrupoTribo devolve canal atualizado', async () => {
    const a = preparar();
    expect(await a.fonte.salvarGrupoTribo(a.triboId, 'https://chat.whatsapp.com/abc')).toMatchObject({ tipo: 'grupo_turma', url: 'https://chat.whatsapp.com/abc', configurado: true });
    a.conferirPedidos();
  });
});
describe('mural', () => {
  it('[T3] publicacoes retorna pagina com publicacao criada', async () => {
    const a = preparar(); const p = a.criarPublicacao();
    expect(await a.fonte.publicacoes(a.triboId)).toMatchObject({ data: [expect.objectContaining({ id: p.publicacao.id })], nextCursor: null });
    a.conferirPedidos();
  });
  it('[T3] publicacoes aceita filtros de status e tag', async () => {
    const a = preparar(); a.criarPublicacao();
    expect((await a.fonte.publicacoes(a.triboId, { status: 'publicada', tag: 'aviso' })).data).toHaveLength(1);
    a.conferirPedidos();
  });
  // FALTA: criarPublicacao devolve envelope em vez da publicacao esperada pela tela
  it.fails('[T3] criarPublicacao retorna id no objeto da publicacao', async () => {
    const a = preparar();
    expect(await a.fonte.criarPublicacao(a.triboId, { ...PUBLICACAO, registrarIntervencao: true })).toMatchObject({ id: expect.any(String), titulo: PUBLICACAO.titulo });
    a.conferirPedidos();
  });
  // FALTA: editarPublicacao devolve envelope em vez da publicacao esperada pela tela
  it.fails('[T3] editarPublicacao retorna titulo atualizado', async () => {
    const a = preparar(); const p = a.criarPublicacao();
    expect(await a.fonte.editarPublicacao(p.publicacao.id, { titulo: 'Novo titulo' })).toMatchObject({ id: p.publicacao.id, titulo: 'Novo titulo' });
    a.conferirPedidos();
  });
  it('[T3] excluirPublicacao resolve sem corpo e remove a publicacao', async () => {
    const a = preparar(); const p = a.criarPublicacao();
    expect(await a.fonte.excluirPublicacao(p.publicacao.id)).toBeUndefined();
    expect((await a.fonte.publicacoes(a.triboId)).data).toEqual([]);
    a.conferirPedidos();
  });
});
describe('upload', () => {
  // FALTA: contrato devolve arquivoId e expiraEm, enquanto a tela espera fileUrl
  it.fails('[T3] pedirUpload fornece URL utilizavel pelo fluxo atual da tela', async () => {
    const a = preparar();
    expect(await a.fonte.pedirUpload({ nome: 'plano.pdf', mime: 'application/pdf', bytes: 100 })).toMatchObject({ uploadUrl: expect.stringMatching(/^https:/), fileUrl: expect.stringMatching(/^https:/) });
    a.conferirPedidos();
  });
});
describe('sessoes', () => {
  it('[T3] sessoes retorna pagina ordenada de encontros', async () => {
    const a = preparar(); const s = a.criarSessao();
    expect(await a.fonte.sessoes(a.triboId)).toMatchObject({ data: [expect.objectContaining({ id: s.id })], nextCursor: null });
    a.conferirPedidos();
  });
  it('[T3] sessoes aceita todos os filtros usados pela tela', async () => {
    const a = preparar(); a.criarSessao();
    expect((await a.fonte.sessoes(a.triboId, { de: '2026-11-12T00:00:00Z', ate: '2026-11-13T00:00:00Z', status: 'agendada', tipo: 'encontro_tribo' })).data).toHaveLength(1);
    a.conferirPedidos();
  });
  it('[T3] criarSessao retorna encontro e estado do Meet', async () => {
    const a = preparar();
    expect(await a.fonte.criarSessao(a.triboId, SESSAO)).toMatchObject({ id: expect.any(String), inicio: SESSAO.inicio, meet: { estado: 'pendente' } });
    a.conferirPedidos();
  });
  // FALTA: editarSessao nao adapta envelope sessao/avisoPublicacaoId
  it.fails('[T3] editarSessao retorna encontro alterado para a tela', async () => {
    const a = preparar(); const s = a.criarSessao();
    expect(await a.fonte.editarSessao(s.id, { tema: 'Novo tema' })).toMatchObject({ id: s.id, tema: 'Novo tema' });
    a.conferirPedidos();
  });
  it('[T3] excluirSessao resolve sem corpo para horario livre', async () => {
    const a = preparar(); const [s] = a.criarHorarios();
    expect(await a.fonte.excluirSessao(s.id)).toBeUndefined();
    a.conferirPedidos();
  });
  // FALTA: vincularGravacao envia origem, propriedade ausente do contrato
  it.fails('[T3] vincularGravacao envia somente os campos aceitos pela v2.3', async () => {
    const a = preparar(); const s = a.criarSessao(); a.simulador.marcarRealizada(s.id);
    expect(await a.fonte.vincularGravacao(s.id, { url: 'https://drive.google.com/gravacao', duracaoSeg: 120 })).toMatchObject({ id: s.id, gravacao: { estado: 'manual' } });
    a.conferirPedidos();
  });
  for (const metodo of ['criarHorarios', 'excluirHorario', 'cancelarSessao'] as const) {
    // FALTA: metodo ainda nao implementado na FonteMentoria
    it.fails(`[T3] ${metodo} resolve para operacao da v2.3`, async () => {
      const a = preparar(); const fonte = a.fonte as FonteFutura;
      if (metodo === 'criarHorarios') expect((await fonte.criarHorarios(a.triboId, JANELA)).data).toHaveLength(4);
      if (metodo === 'excluirHorario') expect(await fonte.excluirHorario(a.criarHorarios()[0].id)).toBeUndefined();
      if (metodo === 'cancelarSessao') expect(await fonte.cancelarSessao(a.criarSessao().id, 'Imprevisto')).toMatchObject({ sessao: { status: 'cancelada' }, avisoPublicacaoId: expect.any(String) });
      a.conferirPedidos();
    });
  }
});
describe('convites legados', () => {
  for (const metodo of ['convites', 'liberarAgenda', 'desligarAgenda'] as const) {
    it(`[T3] ${metodo} NAO resolve para operacao da v2.3`, async () => {
      const a = preparar();
      const chamada = metodo === 'convites' ? a.fonte.convites(a.triboId) : metodo === 'liberarAgenda' ? a.fonte.liberarAgenda(a.triboId, a.alunoIds[0], { titulo: 'Conversa', mensagem: 'Vamos conversar' }) : a.fonte.desligarAgenda(a.alunoIds[0]);
      // As rotas de convite saem na v2.3: o proxy as recusa antes de chegar a API.
      await expect(chamada).rejects.toMatchObject({ code: 'caminho_invalido' });
      expect(a.pedidos).toHaveLength(1);
      expect(resolverOperacao(a.pedidos[0].metodo, a.pedidos[0].caminho)).toBeNull();
    });
  }
});
