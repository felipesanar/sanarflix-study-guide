import { describe, it, expect } from 'vitest';
import { filtrarQuestoes, destaquesPorArea } from '../lib/questoes';
import type { QuestaoProvaOficial } from '../types';

const q = (over: Partial<QuestaoProvaOficial>): QuestaoProvaOficial => ({
  questionId: 'x', posicao: 1, numeroCaderno1: 1, grandeArea: 'Cirurgia', especialidade: null,
  enunciado: 'e', alternativas: { A: 'a', B: 'b', C: 'c', D: 'd' }, imagem: null, imagem2: null,
  imagemComentario: null, correta: 'A', resposta: 'A', acertou: true, anulada: false, comentario: null, ...over,
});

describe('filtrarQuestoes', () => {
  const lista = [
    q({ questionId: '1', acertou: true }),
    q({ questionId: '2', acertou: false, resposta: 'B' }),
    q({ questionId: '3', acertou: false, resposta: null, grandeArea: 'Pediatria' }),
    q({ questionId: '4', acertou: false, anulada: true, resposta: 'C' }),
  ];
  it('todas devolve tudo na ordem recebida', () => {
    expect(filtrarQuestoes(lista, { tipo: 'todas', area: null }).map((x) => x.questionId)).toEqual(['1', '2', '3', '4']);
  });
  it('erradas exclui acertos, brancos e anuladas', () => {
    expect(filtrarQuestoes(lista, { tipo: 'erradas', area: null }).map((x) => x.questionId)).toEqual(['2']);
  });
  it('em_branco pega só resposta nula não anulada', () => {
    expect(filtrarQuestoes(lista, { tipo: 'em_branco', area: null }).map((x) => x.questionId)).toEqual(['3']);
  });
  it('combina com filtro de área', () => {
    expect(filtrarQuestoes(lista, { tipo: 'todas', area: 'Pediatria' }).map((x) => x.questionId)).toEqual(['3']);
  });
});

describe('destaquesPorArea', () => {
  it('melhor e mais fraca por percentual, empate pelo maior total', () => {
    const r = destaquesPorArea([
      { area: 'Clínica Médica', acertos: 18, total: 24 }, // 75%
      { area: 'Cirurgia', acertos: 7, total: 14 },        // 50%
      { area: 'Pediatria', acertos: 9, total: 12 },       // 75%
    ]);
    expect(r).toEqual({ melhor: 'Clínica Médica', maisFraca: 'Cirurgia' });
  });
  it('lista vazia devolve nulls', () => {
    expect(destaquesPorArea([])).toEqual({ melhor: null, maisFraca: null });
  });
});
