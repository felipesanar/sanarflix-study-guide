import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestaoRevisao } from '../components/QuestaoRevisao';
import type { QuestaoProvaOficial } from '../types';

const QUESTAO: QuestaoProvaOficial = {
  questionId: 'q1',
  posicao: 37,
  numeroCaderno1: 8,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  enunciado: 'Enunciado da questão de teste.',
  alternativas: { A: 'Alternativa A', B: 'Alternativa B', C: 'Alternativa C', D: 'Alternativa D' },
  imagem: null,
  imagem2: null,
  imagemComentario: null,
  correta: 'C',
  resposta: 'B',
  acertou: false,
  anulada: false,
  comentario: 'Explicação detalhada do professor sobre o gabarito.',
};

describe('QuestaoRevisao', () => {
  it('marca a alternativa do aluno como errada e a correta como gabarito do INEP', () => {
    render(<QuestaoRevisao questao={QUESTAO} caderno={2} />);

    // B é a resposta do aluno e está errada.
    const opcaoB = screen.getByText('Alternativa B').closest('div');
    expect(opcaoB).toHaveTextContent('Sua resposta');

    // C é o gabarito preliminar do INEP.
    const opcaoC = screen.getByText('Alternativa C').closest('div');
    expect(opcaoC).toHaveTextContent('Gabarito preliminar do INEP');

    // A resposta do aluno (B) nunca aparece marcada como gabarito.
    expect(opcaoB).not.toHaveTextContent('Gabarito preliminar do INEP');
  });

  it('mostra o comentário do professor dentro de um collapsible, ao abrir', async () => {
    const user = userEvent.setup();
    render(<QuestaoRevisao questao={QUESTAO} caderno={2} />);

    expect(screen.queryByText(QUESTAO.comentario as string)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /comentário do professor/i }));

    expect(screen.getByText(QUESTAO.comentario as string)).toBeInTheDocument();
  });

  it('mostra "Em branco" quando a resposta é nula', () => {
    render(<QuestaoRevisao questao={{ ...QUESTAO, resposta: null, acertou: false }} caderno={2} />);
    expect(screen.getByText('Em branco')).toBeInTheDocument();
  });

  it('indica no cabeçalho o caderno, a posição e a numeração no Caderno 1', () => {
    render(<QuestaoRevisao questao={QUESTAO} caderno={2} />);
    expect(screen.getByText('Caderno 2 · Questão 37')).toBeInTheDocument();
    expect(screen.getByText(/no Caderno 1 era a questão 8/)).toBeInTheDocument();
  });
});
