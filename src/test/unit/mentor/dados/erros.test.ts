import { describe, expect, it } from 'vitest';
import { ErroFonte } from '@/features/mentor/api/fonte';
import { campoDoErro, mensagemErro, tratamentoErro } from '@/features/mentor/api/erros';

describe('mensagemErro (docs/07 § Conexão)', () => {
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
