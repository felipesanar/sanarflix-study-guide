import { describe, it, expect } from 'vitest';
import {
  lotes,
  corteMaisDificil,
  mapearPacote,
  separarPorEspelho,
  sanitizarErro,
} from '../../../supabase/functions/sync-simulados-b2c/upsert';

describe('sync-simulados-b2c/upsert', () => {
  it('corteMaisDificil devolve o maior corte_geral', () => {
    expect(
      corteMaisDificil([{ corte_geral: 80 }, { corte_geral: 93 }, { corte_geral: 70.5 }]),
    ).toBe(93);
  });

  it('corteMaisDificil ignora cortes nulos e devolve null sem alvos', () => {
    expect(corteMaisDificil([])).toBeNull();
    expect(corteMaisDificil([{ corte_geral: null }])).toBeNull();
    expect(corteMaisDificil([{ corte_geral: null }, { corte_geral: 60 }])).toBe(60);
  });

  it('lotes divide em chunks do tamanho pedido', () => {
    const mil = Array.from({ length: 1000 }, (_, i) => i);
    expect(lotes(mil, 1000)).toHaveLength(1);
    expect(lotes([...mil, 1000], 1000)).toHaveLength(2);
    expect(lotes([...mil, 1000], 1000)[1]).toEqual([1000]);
    expect(lotes([], 1000)).toEqual([]);
  });

  it('mapearPacote converte o contrato nas linhas b2c_*', () => {
    const pacote = {
      gerado_em: '2026-10-15T07:00:00Z',
      simulados: [
        {
          id: 's1',
          sequence_number: 1,
          title: 'Simulado 1',
          questions_count: 100,
          execution_window_start: '2026-09-01T00:00:00Z',
          execution_window_end: '2026-09-02T00:00:00Z',
          status: 'published',
        },
      ],
      questoes: [
        {
          id: 'q1',
          simulado_id: 's1',
          question_number: 1,
          area: 'Clínica Médica',
          theme: 'Diabetes',
          correta_label: 'B',
        },
        {
          id: 'q2',
          simulado_id: 's1',
          question_number: 2,
          area: 'Pediatria',
          theme: null,
          correta_label: 'A',
        },
      ],
      alunos: [
        {
          email: 'ana@x.com',
          nome: 'Ana',
          segment: 'b2c',
          especialidade: { id: 'e1', nome: 'Oftalmologia' },
          alvos: [
            { institution_id: 'i1', nome: 'FAV', corte_geral: 93, corte_cota: 88 },
            { institution_id: 'i2', nome: 'USP', corte_geral: 85, corte_cota: null },
          ],
          tentativas: [
            {
              id: 't1',
              simulado_id: 's1',
              finished_at: '2026-09-01T12:00:00Z',
              score_percentage: 50,
              total_correct: 1,
              total_answered: 2,
              attempt_type: 'online',
            },
          ],
          respostas: [
            {
              attempt_id: 't1',
              question_id: 'q1',
              selected_label: 'B',
              is_correct: true,
              was_answered: true,
            },
            {
              attempt_id: 't1',
              question_id: 'q2',
              selected_label: null,
              is_correct: false,
              was_answered: false,
            },
          ],
        },
      ],
    };

    const m = mapearPacote(pacote);

    expect(m.simulados).toEqual([
      {
        id: 's1',
        sequence_number: 1,
        titulo: 'Simulado 1',
        questoes: 100,
        janela_inicio: '2026-09-01T00:00:00Z',
        janela_fim: '2026-09-02T00:00:00Z',
        status: 'published',
        sincronizado_em: '2026-10-15T07:00:00Z',
      },
    ]);
    expect(m.questoes).toHaveLength(2);
    expect(m.questoes[0]).toEqual({
      id: 'q1',
      simulado_id: 's1',
      numero: 1,
      grande_area: 'Clínica Médica',
      tema: 'Diabetes',
      correta_label: 'B',
    });
    expect(m.alunos).toEqual([
      {
        email: 'ana@x.com',
        nome: 'Ana',
        segment: 'b2c',
        especialidade_id: 'e1',
        especialidade_nome: 'Oftalmologia',
        alvos: pacote.alunos[0].alvos,
        corte_mais_dificil: 93,
        sincronizado_em: '2026-10-15T07:00:00Z',
      },
    ]);
    expect(m.tentativas).toEqual([
      {
        id: 't1',
        email: 'ana@x.com',
        simulado_id: 's1',
        finalizada_em: '2026-09-01T12:00:00Z',
        acerto_pct: 50,
        acertos: 1,
        respondidas: 2,
        modalidade: 'online',
      },
    ]);
    expect(m.respostas).toEqual([
      { tentativa_id: 't1', questao_id: 'q1', marcada_label: 'B', correta: true, respondida: true },
      { tentativa_id: 't1', questao_id: 'q2', marcada_label: null, correta: false, respondida: false },
    ]);
  });

  it('mapearPacote: aluno sem especialidade e sem alvos fica com corte null', () => {
    const m = mapearPacote({
      gerado_em: '2026-10-15T07:00:00Z',
      simulados: [],
      questoes: [],
      alunos: [
        {
          email: 'b@x.com',
          nome: null,
          segment: null,
          especialidade: null,
          alvos: [],
          tentativas: [],
          respostas: [],
        },
      ],
    });
    expect(m.alunos[0].corte_mais_dificil).toBeNull();
    expect(m.alunos[0].especialidade_id).toBeNull();
    expect(m.alunos[0].alvos).toEqual([]);
  });

  it('101 e-mails novos viram 2 lotes de exportação (100 + 1)', () => {
    const emails = Array.from({ length: 101 }, (_, i) => `a${i}@x.com`);
    const { novos, existentes } = separarPorEspelho(emails, []);
    expect(existentes).toEqual([]);
    expect(lotes(novos, 100).map((l) => l.length)).toEqual([100, 1]);
  });

  it('separarPorEspelho divide novos (fora do espelho) e existentes', () => {
    const r = separarPorEspelho(['a@x.com', 'b@x.com', 'c@x.com'], ['B@x.com', 'z@x.com']);
    expect(r.novos).toEqual(['a@x.com', 'c@x.com']);
    expect(r.existentes).toEqual(['b@x.com']);
  });

  it('sanitizarErro troca e-mails por <email>', () => {
    expect(sanitizarErro('upsert b2c_alunos: key (email)=(ana.silva@x.com.br) violates fk')).toBe(
      'upsert b2c_alunos: key <email> violates fk',
    );
    expect(sanitizarErro('a@b.com e c@d.org falharam')).toBe('<email> e <email> falharam');
    expect(sanitizarErro('sem email aqui')).toBe('sem email aqui');
  });

  it('mapearPacote deduplica respostas por (tentativa, questão) mantendo a última', () => {
    const r = (sel: string | null, ok: boolean) => ({
      attempt_id: 't1',
      question_id: 'q1',
      selected_label: sel,
      is_correct: ok,
      was_answered: sel !== null,
    });
    const m = mapearPacote({
      gerado_em: '2026-10-15T07:00:00Z',
      simulados: [],
      questoes: [],
      alunos: [
        {
          email: 'a@x.com',
          nome: null,
          segment: null,
          especialidade: null,
          alvos: [],
          tentativas: [
            {
              id: 't1',
              simulado_id: 's1',
              finished_at: '2026-09-01T12:00:00Z',
              score_percentage: 10,
              total_correct: 1,
              total_answered: 1,
              attempt_type: 'online',
            },
          ],
          respostas: [r('A', false), r('B', true)],
        },
      ],
    });
    expect(m.respostas).toHaveLength(1);
    expect(m.respostas[0]).toMatchObject({ marcada_label: 'B', correta: true });
  });
});
