// Regras de `components/turma/simulados.ts` (implementação antiga ainda usada pelo Início e pelo Detalhamento
// antigos). Os casos de `components/turma/resumo.ts` saíram junto com a Minha Turma antiga.
import { describe, it, expect } from 'vitest';
import {
  contarAlertas,
  numeroUltimoSimulado,
  opcoesSimulados,
  passaAlerta,
} from '@/features/mentor/components/turma/simulados';
import { desempAluno, desempAlunoNulos, desempenho, nota, simuladoB2C, SIM1, SIM2, SIM3 } from '../components/mentor/fixtures';

const S1 = simuladoB2C(SIM1, 1);
const S2 = simuladoB2C(SIM2, 2);
const S3 = simuladoB2C(SIM3, 3);

describe('lista de simulados da RPC (chips e último simulado)', () => {
  // O Simulado 3 está encerrado mas NINGUÉM da turma fez: só a lista da RPC o conhece.
  const alunos = [desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50), nota(SIM2, 2, 60)] })];
  const dados = desempenho(alunos, {
    simulados: [S3, S1, S2],
    participacao_ultimo: { simulado_id: SIM3, fizeram: 0, total: 1 },
  });

  it('as opções vêm da lista, ordenadas, inclusive o simulado sem nenhuma nota', () => {
    expect(opcoesSimulados(dados).map((o) => o.sequence_number)).toEqual([1, 2, 3]);
    expect(opcoesSimulados(undefined)).toEqual([]);
    expect(opcoesSimulados({ simulados: undefined as never })).toEqual([]);
  });
  it('o número do último simulado vem da lista, mesmo sem nota', () => {
    expect(numeroUltimoSimulado(dados)).toBe(3);
    expect(numeroUltimoSimulado({ ...dados, participacao_ultimo: { simulado_id: null, fizeram: 0, total: 1 } })).toBeNull();
    expect(numeroUltimoSimulado({ ...dados, simulados: [] })).toBeNull();
  });
});

describe('alertas com regrediu/estagnado nulos', () => {
  const alunos = [
    desempAlunoNulos({ email: 'a' }),
    desempAluno({ email: 'b', regrediu: true }),
    desempAluno({ email: 'c', estagnado: true }),
  ];
  it('null não conta como alerta', () => {
    expect(contarAlertas(alunos)).toEqual({ regrediu: 1, estagnado: 1, nao_fez: 0 });
    expect(passaAlerta(alunos[0], 'regrediu')).toBe(false);
    expect(passaAlerta(alunos[0], 'estagnado')).toBe(false);
  });
});
