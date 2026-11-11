import { describe, expect, it } from 'vitest';
import { especificacao, operacao, operacoes, resolverOperacao } from './especificacao';

describe('operacoes extraidas da especificacao v2.3', () => {
  it('extrai todas as operacoes na ordem do documento', () => {
    const documento = especificacao as { paths: Record<string, Record<string, { operationId: string }>> };
    expect(operacoes.map((o) => o.operationId)).toEqual(Object.values(documento.paths).flatMap((p) => Object.values(p).map((o) => o.operationId)));
    expect(operacoes).toHaveLength(20);
  });
  it.each(['obterMe', 'atualizarMe', 'listarAlunos', 'obterAluno', 'listarCanais', 'salvarGrupoTribo', 'listarPublicacoes', 'criarPublicacao', 'editarPublicacao', 'excluirPublicacao', 'pedirUpload', 'listarSessoes', 'criarSessao', 'criarHorarios', 'editarSessao', 'excluirHorario', 'cancelarSessao', 'vincularGravacao', 'reservarHorario', 'cancelarReserva'])('resolve %s pelo metodo e modelo', (id) => {
    const o = operacao(id);
    const caminho = o.modelo.replace(/\{([^}]+)\}/g, (_, nome: string) => `${nome}-teste`);
    const r = resolverOperacao(o.metodo, caminho);
    expect(r?.operacao).toBe(o);
    expect(r?.parametros).toEqual(Object.fromEntries(o.parametrosDeCaminho.map((p) => [p, `${p}-teste`])));
  });
  it('resolve referencias, query e corpo um nivel', () => {
    expect(operacao('criarPublicacao')).toMatchObject({ exigeIdempotencia: true, esquemaCorpo: { type: 'object' }, respostas: { '201': { type: 'object' } } });
    expect(operacao('excluirHorario').respostas['204']).toBeNull();
    expect(resolverOperacao('GET', '/tribos/abc/alunos?limit=200&busca=Ana+Silva')?.query).toEqual({ limit: '200', busca: 'Ana Silva' });
  });
  it('recusa operacao desconhecida e caminhos incompletos', () => {
    expect(() => operacao('ausente')).toThrow();
    for (const [metodo, caminho] of [['GET', '/ausente'], ['POST', '/me'], ['GET', '/tribos//alunos'], ['GET', '/me/extra']]) expect(resolverOperacao(metodo, caminho)).toBeNull();
  });
});
