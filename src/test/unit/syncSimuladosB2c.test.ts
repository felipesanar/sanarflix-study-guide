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
        resultado_liberado_em: null,
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
      enunciado: null,
      explicacao: null,
      imagem_url: null,
      imagem_url_2: null,
      explicacao_imagem_url: null,
      dificuldade: null,
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
        dentro_janela: null,
        posicao: null,
        participantes: null,
        percentil: null,
      },
    ]);
    expect(m.alternativas).toEqual([]);
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
  describe('espelho completo (campos novos do export)', () => {
    const pacoteNovo = () => ({
      gerado_em: '2026-10-15T07:00:00Z',
      simulados: [
        {
          id: 's1',
          sequence_number: 1,
          title: 'Simulado 1',
          questions_count: 2,
          execution_window_start: '2026-09-01T00:00:00Z',
          execution_window_end: '2026-09-02T00:00:00Z',
          status: 'published',
          results_release_at: '2026-09-03T12:00:00Z',
        },
      ],
      questoes: [
        {
          id: 'q1',
          simulado_id: 's1',
          question_number: 1,
          area: 'Pediatria',
          theme: 'Asma',
          correta_label: 'B',
          text: 'Enunciado da questão 1',
          explanation: 'Porque B',
          image_url: 'https://img/1.png',
          image_url_2: null,
          explanation_image_url: 'https://img/exp.png',
          difficulty: 'dificil',
        },
      ],
      opcoes: [
        { id: 'o1', question_id: 'q1', label: 'A', text: 'Alt A', is_correct: false },
        { id: 'o2', question_id: 'q1', label: 'B', text: 'Alt B', is_correct: true },
        { id: 'o3', question_id: 'q1', label: 'C', text: null, is_correct: null },
        // duplicada por id: fica só a última
        { id: 'o1', question_id: 'q1', label: 'A', text: 'Alt A v2', is_correct: false },
        // questão fora do pacote: não entra (quebraria a FK)
        { id: 'o9', question_id: 'q-inexistente', label: 'A', text: 'x', is_correct: false },
      ],
      alunos: [
        {
          email: 'ana@x.com',
          nome: 'Ana',
          segment: 'b2c',
          especialidade: null,
          alvos: [],
          tentativas: [
            {
              id: 't1',
              simulado_id: 's1',
              finished_at: '2026-09-01T12:00:00Z',
              score_percentage: 70,
              total_correct: 7,
              total_answered: 10,
              attempt_type: 'online',
              is_within_window: true,
              posicao: 12,
              participantes: 300,
              percentil: 96.1,
            },
          ],
          respostas: [],
        },
      ],
    });

    it('mapeia liberação, conteúdo da questão, alternativas e classificação', () => {
      const m = mapearPacote(pacoteNovo());
      expect(m.simulados[0].resultado_liberado_em).toBe('2026-09-03T12:00:00Z');
      expect(m.questoes[0]).toEqual({
        id: 'q1',
        simulado_id: 's1',
        numero: 1,
        grande_area: 'Pediatria',
        tema: 'Asma',
        correta_label: 'B',
        enunciado: 'Enunciado da questão 1',
        explicacao: 'Porque B',
        imagem_url: 'https://img/1.png',
        imagem_url_2: null,
        explicacao_imagem_url: 'https://img/exp.png',
        dificuldade: 'dificil',
      });
      expect(m.alternativas).toEqual([
        { id: 'o1', questao_id: 'q1', label: 'A', texto: 'Alt A v2', correta: false },
        { id: 'o2', questao_id: 'q1', label: 'B', texto: 'Alt B', correta: true },
        { id: 'o3', questao_id: 'q1', label: 'C', texto: null, correta: false },
      ]);
      expect(m.tentativas[0]).toMatchObject({
        dentro_janela: true,
        posicao: 12,
        participantes: 300,
        percentil: 96.1,
      });
    });

    it('dedupe de alternativas também por (questão, label)', () => {
      const p = pacoteNovo();
      p.opcoes = [
        { id: 'o1', question_id: 'q1', label: 'A', text: 'primeira', is_correct: false },
        { id: 'o1b', question_id: 'q1', label: 'A', text: 'segunda', is_correct: false },
      ];
      const m = mapearPacote(p);
      expect(m.alternativas).toHaveLength(1);
      expect(m.alternativas[0].texto).toBe('segunda');
    });

    it('payload antigo (sem as chaves novas) sincroniza com null / []', () => {
      const p = pacoteNovo() as Record<string, unknown>;
      delete p.opcoes;
      for (const s of p.simulados as Record<string, unknown>[]) delete s.results_release_at;
      for (const q of p.questoes as Record<string, unknown>[]) {
        for (const k of ['text', 'explanation', 'image_url', 'image_url_2', 'explanation_image_url', 'difficulty']) delete q[k];
      }
      for (const a of p.alunos as { tentativas: Record<string, unknown>[] }[]) {
        for (const t of a.tentativas) for (const k of ['is_within_window', 'posicao', 'participantes', 'percentil']) delete t[k];
      }
      const m = mapearPacote(p as unknown as Parameters<typeof mapearPacote>[0]);
      expect(m.alternativas).toEqual([]);
      expect(m.simulados[0].resultado_liberado_em).toBeNull();
      expect(m.questoes[0]).toMatchObject({
        enunciado: null,
        explicacao: null,
        imagem_url: null,
        imagem_url_2: null,
        explicacao_imagem_url: null,
        dificuldade: null,
      });
      expect(m.tentativas[0]).toMatchObject({
        dentro_janela: null,
        posicao: null,
        participantes: null,
        percentil: null,
      });
    });
  });

  describe('resposta de simulado ainda não liberado (is_correct nulo)', () => {
    const pacoteCom = (respostas: { sel: string | null; ok: boolean | null; was?: boolean | null }[]) =>
      ({
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
                score_percentage: 50,
                total_correct: 1,
                total_answered: 2,
                attempt_type: 'online',
              },
            ],
            respostas: respostas.map((r, i) => ({
              attempt_id: 't1',
              question_id: `q${i + 1}`,
              selected_label: r.sel,
              is_correct: r.ok,
              was_answered: r.was === undefined ? r.sel !== null : r.was,
            })),
          },
        ],
      }) as Parameters<typeof mapearPacote>[0];

    it('is_correct nulo (redigido) grava correta = null, não false', () => {
      const m = mapearPacote(pacoteCom([{ sel: 'B', ok: null }, { sel: 'C', ok: null }]));
      expect(m.respostas.map((r) => r.correta)).toEqual([null, null]);
      expect(m.respostas[0]).toMatchObject({ marcada_label: 'B', respondida: true });
    });

    it('is_correct booleano (liberado) continua booleano', () => {
      const m = mapearPacote(pacoteCom([{ sel: 'B', ok: true }, { sel: 'C', ok: false }]));
      expect(m.respostas.map((r) => r.correta)).toEqual([true, false]);
    });

    it('em branco explícito (was_answered=false) nunca é acerto: correta = false mesmo com is_correct nulo', () => {
      const m = mapearPacote(pacoteCom([{ sel: null, ok: null, was: false }]));
      expect(m.respostas[0]).toMatchObject({ correta: false, respondida: false });
    });

    it('was_answered ausente + is_correct nulo continua null (não assume em branco)', () => {
      const m = mapearPacote(pacoteCom([{ sel: null, ok: null, was: null }]));
      expect(m.respostas[0].correta).toBeNull();
    });
  });
});
