import { describe, expect, it } from 'vitest';
import { ErroFonte } from '@/features/mentor/api/fonte';
import { campoDoErro, codigoDeSuporte, mensagemErro, tratamentoErro } from '@/features/mentor/api/erros';

describe('mensagemErro (docs/07 § Conexão)', () => {
  it.each([
    [401, 'token_invalido', 'Sua sessão expirou. Entre de novo para continuar.'],
    [404, 'nao_encontrado', 'Este item não existe mais. Atualize a página.'],
    [403, 'mentor_sem_vinculo_flix', 'Seu cadastro de mentor ainda não está ligado ao Flix. Fale com o administrador.'],
    [409, 'chave_reutilizada', 'Esta ação já foi enviada. Atualize a página para ver o resultado.'],
    [429, 'limite_requisicoes', 'Muitas ações em pouco tempo. Aguarde um minuto e tente de novo.'],
    [503, 'flix_indisponivel', 'A mentoria está temporariamente indisponível. Tente de novo em instantes.'],
  ] as const)('%s %s tem mensagem propria', (status, code, mensagem) => {
    expect(mensagemErro(new ErroFonte(status, code, 'texto tecnico'))).toBe(mensagem);
  });

  it('expoe somente o ID como codigo de suporte, sem mudar a mensagem', () => {
    const erro = new ErroFonte(401, 'token_invalido', 'jwt', undefined, 'abc123');
    expect(codigoDeSuporte(erro)).toBe('abc123');
    expect(codigoDeSuporte(new ErroFonte(0, 'rede', ''))).toBeNull();
    expect(codigoDeSuporte(new Error('abc123'))).toBeNull();
    expect(codigoDeSuporte(null)).toBeNull();
    expect(mensagemErro(erro)).not.toContain('abc123');
  });

  it('validacao usa o message da API, inline no field', () => {
    const e = new ErroFonte(400, 'validacao', 'Informe a data da sessão.', 'inicio');
    expect(mensagemErro(e)).toBe('Informe a data da sessão.');
    expect(tratamentoErro(e)).toBe('inline');
    expect(campoDoErro(e)).toBe('inicio');
  });

  it.each([
    ['sem_acesso_tribo', 'Você não tem acesso a esta turma.', 'faixa'],
    ['mentor_sem_agenda', 'Cadastre seu link do Google Agenda no perfil para liberar agendamentos.', 'inline'],
    ['aluno_fora_da_tribo', 'Um dos alunos não está mais na turma. Atualize a lista.', 'toast'],
    ['convite_ativo', 'A agenda deste aluno já está liberada.', 'recarregar'],
    ['rede', 'Não foi possível carregar agora. Tente novamente.', 'estado_erro'],
  ])('%s → mensagem da tabela', (code, msg, trat) => {
    const e = new ErroFonte(code === 'rede' ? 0 : 409, code, 'texto técnico');
    expect(mensagemErro(e)).toBe(msg);
    expect(tratamentoErro(e)).toBe(trat);
    expect(campoDoErro(e)).toBeNull();
  });

  it('5xx vira estado de erro com "Tentar novamente", mesmo com code desconhecido', () => {
    const e = new ErroFonte(502, 'erro_interno', 'Bad gateway');
    expect(mensagemErro(e)).toBe('Não foi possível carregar agora. Tente novamente.');
    expect(tratamentoErro(e)).toBe('estado_erro');
  });

  it('erro que não é ErroFonte não vaza texto técnico', () => {
    expect(mensagemErro(new Error('TypeError: x is undefined'))).toBe('Algo deu errado. Tente de novo.');
    expect(tratamentoErro('qualquer')).toBe('estado_erro');
  });
});
