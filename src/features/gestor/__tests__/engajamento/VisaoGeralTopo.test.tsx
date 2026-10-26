import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockVisaoGeral = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoVisaoGeral: (...args: unknown[]) => mockVisaoGeral(...args),
}));

import { DoAcessoAoHabito } from '@/features/gestor/components/engajamento/DoAcessoAoHabito';
import { EngajamentoMesAMes } from '@/features/gestor/components/engajamento/EngajamentoMesAMes';
import { KpisEngajamento } from '@/features/gestor/components/engajamento/KpisEngajamento';
import VisaoGeralEngajamento from '@/features/gestor/routes/engajamento/VisaoGeralEngajamento';
import type { VisaoGeralEngajamento as Dados } from '@/features/gestor/api/types-engajamento';
import {
  META_ENGAJAMENTO,
  resultadoGestor,
  visaoGeralAlunoSemAtividade,
  visaoGeralComAluno,
  visaoGeralParacatu,
  visaoGeralSemestre8,
} from '../fixtures/engajamento/visaoGeral';

/**
 * Topo da Visão geral (spec 2026-10-22-engajamento §12.2): KPIs, "Engajamento
 * mês a mês" e "Do acesso ao hábito". Fixture derivada do exemplo da §8.1.
 */

const envolver = (ui: React.ReactElement, url = '/gestor/engajamento?ies=ies-1') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </TooltipProvider>,
  );

const kpi = (testId: string) => screen.getByTestId(testId);
const valor = (testId: string) => within(kpi(testId)).getByTestId('kpi-valor').textContent;
const sufixo = (testId: string) => within(kpi(testId)).queryByTestId('kpi-sufixo')?.textContent;
const nota = (testId: string) => within(kpi(testId)).queryByTestId('kpi-rodape')?.textContent;
const titulos = () => screen.getAllByTestId('kpi-titulo').map((t) => t.textContent);

const consulta = (data: Dados | undefined, extra: Record<string, unknown> = {}) => resultadoGestor(data, extra);

describe('KpisEngajamento — sem aluno (§12.2)', () => {
  it('5 KPIs na ordem da spec', () => {
    envolver(<KpisEngajamento dados={visaoGeralParacatu()} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(titulos()).toEqual([
      'Base ativa',
      'Alunos engajados',
      'Sem retorno há 30+ dias',
      'Questões resolvidas',
      'Acerto médio',
    ]);
  });

  it('valores, linha 2 e notas literais, com o comparativo indisponível (período anterior antes de 2026)', () => {
    envolver(<KpisEngajamento dados={visaoGeralParacatu()} meta={META_ENGAJAMENTO} periodo="6m" />);

    expect(valor('kpi-base-ativa')).toBe('521');
    expect(nota('kpi-base-ativa')).toBe('alunos com acesso vigente');

    expect(valor('kpi-engajados')).toBe('63%');
    expect(sufixo('kpi-engajados')).toBe('330 de 521');
    expect(nota('kpi-engajados')).toBe('sem comparativo para este período');

    expect(valor('kpi-sem-retorno')).toBe('133');
    expect(sufixo('kpi-sem-retorno')).toBe('26% da base');
    expect(nota('kpi-sem-retorno')).toBe('usaram e pararam');

    expect(valor('kpi-questoes')).toBe('145.873');
    expect(nota('kpi-questoes')).toBe('442 por aluno engajado');

    expect(valor('kpi-acerto')).toBe('66%');
    // comparável (questões), mas sem denominador anterior (PARACATU não tem nada antes de 05/2026)
    expect(nota('kpi-acerto')).toBe('sem comparativo para este período');
  });

  it('"Sem retorno há 30+ dias" usa --gp-danger-on', () => {
    envolver(<KpisEngajamento dados={visaoGeralParacatu()} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(within(kpi('kpi-sem-retorno')).getByTestId('kpi-valor').style.color).toContain('--gp-danger-on');
    expect(within(kpi('kpi-questoes')).getByTestId('kpi-valor').style.color).not.toContain('--gp-danger-on');
  });

  it('comparável: "▲ X p.p. vs. 6 meses anteriores" (engajamento e acerto)', () => {
    const d = visaoGeralParacatu();
    d.periodo.anterior = { inicio: '2026-01-01', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: true };
    d.kpis.engajadosPctAnterior = 57.0;
    d.kpis.acertoPctAnterior = 60.0;
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(nota('kpi-engajados')).toBe('▲ 6 p.p. vs. 6 meses anteriores');
    expect(nota('kpi-acerto')).toBe('▲ 6 p.p. vs. 6 meses anteriores');
  });

  it('queda e igualdade: "▼ X p.p." e "= 0 p.p."; o rótulo segue o período ("30 dias anteriores")', () => {
    const d = visaoGeralParacatu();
    d.periodo.anterior = { inicio: '2026-01-01', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: true };
    d.periodo.dias = 30;
    d.kpis.engajadosPctAnterior = 70.0;
    d.kpis.acertoPctAnterior = 66.0;
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="30d" />);
    expect(nota('kpi-engajados')).toBe('▼ 7 p.p. vs. 30 dias anteriores');
    expect(nota('kpi-acerto')).toBe('= 0 p.p. vs. 30 dias anteriores');
  });

  it('período personalizado: o rótulo anterior usa a quantidade de dias', () => {
    const d = visaoGeralParacatu();
    d.periodo.dias = 45;
    d.periodo.anterior = { inicio: '2026-01-01', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: true };
    d.kpis.engajadosPctAnterior = 60.0;
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="custom" />);
    expect(nota('kpi-engajados')).toBe('▲ 3 p.p. vs. 45 dias anteriores');
  });

  it('não comparável por D10 mesmo havendo número anterior: usa o texto alternativo', () => {
    const d = visaoGeralParacatu();
    d.periodo.anterior = { inicio: '2025-11-07', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: false };
    d.kpis.engajadosPctAnterior = 57.0;
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(nota('kpi-engajados')).toBe('sem comparativo para este período');
  });

  it('com semestre: a nota vira "média da IES: …"', () => {
    envolver(<KpisEngajamento dados={visaoGeralSemestre8()} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(valor('kpi-engajados')).toBe('65%');
    expect(nota('kpi-engajados')).toBe('média da IES: 63%');
    expect(nota('kpi-acerto')).toBe('média da IES: 66%');
  });

  it('sem engajados no período: "nenhum aluno engajado no período" e acerto "—"', () => {
    const d = visaoGeralParacatu();
    d.kpis = { ...d.kpis, engajados: 0, engajadosPct: 0, questoes: 0, questoesPorEngajado: null, acertoPct: null };
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(nota('kpi-questoes')).toBe('nenhum aluno engajado no período');
    expect(valor('kpi-acerto')).toBe('—');
  });
});

describe('KpisEngajamento — com aluno (§12.2)', () => {
  it('5 KPIs do modo aluno, com as médias do semestre dele', () => {
    envolver(<KpisEngajamento dados={visaoGeralComAluno()} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(titulos()).toEqual(['Semestre', 'Situação', 'Dias ativos', 'Questões resolvidas', 'Acerto']);

    expect(valor('kpi-semestre')).toBe('8º');
    expect(nota('kpi-semestre')).toBe('turma com 80 alunos');

    expect(valor('kpi-situacao')).toBe('Ativo');
    expect(nota('kpi-situacao')).toBe('última atividade: hoje');
    expect(within(kpi('kpi-situacao')).getByTestId('kpi-valor').style.color).not.toContain('--gp-danger-on');

    expect(valor('kpi-dias-ativos')).toBe('42');
    expect(sufixo('kpi-dias-ativos')).toBe('de 175');
    expect(nota('kpi-dias-ativos')).toBe('dias com alguma atividade no período');

    expect(valor('kpi-questoes')).toBe('1.284');
    expect(nota('kpi-questoes')).toBe('média do semestre: 420');

    expect(valor('kpi-acerto')).toBe('74%');
    expect(nota('kpi-acerto')).toBe('média do semestre: 66%');
  });

  it('aluno sumido: "Sumido" em --gp-danger-on e "última atividade: há N dias"', () => {
    const d = visaoGeralComAluno();
    d.aluno = { ...d.aluno!, situacao: 'sumido', diasSemAtividade: 40, ultimaAtividade: '2026-09-12' };
    envolver(<KpisEngajamento dados={d} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(valor('kpi-situacao')).toBe('Sumido');
    expect(within(kpi('kpi-situacao')).getByTestId('kpi-valor').style.color).toContain('--gp-danger-on');
    expect(nota('kpi-situacao')).toBe('última atividade: há 40 dias');
  });

  it('aluno sem atividade: "Sem atividade", "nunca" e acerto "—"', () => {
    envolver(<KpisEngajamento dados={visaoGeralAlunoSemAtividade()} meta={META_ENGAJAMENTO} periodo="6m" />);
    expect(valor('kpi-situacao')).toBe('Sem atividade');
    expect(within(kpi('kpi-situacao')).getByTestId('kpi-valor').style.color).toContain('--gp-danger-on');
    expect(nota('kpi-situacao')).toBe('última atividade: nunca');
    expect(valor('kpi-acerto')).toBe('—');
    expect(valor('kpi-dias-ativos')).toBe('0');
  });
});

describe('KpisEngajamento — estados (§11)', () => {
  it('carregando: os rótulos aparecem e nenhum número é afirmado', () => {
    envolver(<KpisEngajamento dados={undefined} periodo="6m" estado="loading" />);
    expect(titulos()).toHaveLength(5);
    expect(screen.queryAllByTestId('kpi-valor')).toHaveLength(0);
  });

  it('erro: cada cartão oferece "Tentar novamente"', () => {
    const refazer = vi.fn();
    envolver(<KpisEngajamento dados={undefined} periodo="6m" estado="error" onTentarNovamente={refazer} />);
    const botoes = screen.getAllByRole('button', { name: /Tentar novamente/ });
    expect(botoes).toHaveLength(5);
    fireEvent.click(botoes[0]);
    expect(refazer).toHaveBeenCalledTimes(1);
  });
});

describe('EngajamentoMesAMes (§12.2)', () => {
  it('título, descrição, "%" e "N alunos" por mês e rodapé do mês parcial', () => {
    const d = visaoGeralParacatu();
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d)} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Engajamento mês a mês' })).toBeInTheDocument();
    expect(screen.getByText('% da base ativa com ao menos 1 atividade no mês')).toBeInTheDocument();

    const grafico = screen.getByRole('img', { name: 'Engajamento mês a mês' });
    expect(within(grafico).getByText('43%')).toBeInTheDocument(); // setembro: 223 de 521
    expect(within(grafico).getByText('223 alunos')).toBeInTheDocument();
    expect(within(grafico).getByText('Out*')).toBeInTheDocument();
    expect(within(grafico).getByText('Set')).toBeInTheDocument();

    expect(screen.getByText('Outubro parcial, até 22/10.')).toBeInTheDocument();
  });

  it('a tabela alternativa traz uma linha por mês, com o rótulo do mês parcial', () => {
    const d = visaoGeralParacatu();
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d)} />);
    const figura = screen.getByRole('img', { name: 'Engajamento mês a mês' }).closest('figure') as HTMLElement;
    expect(within(figura).getByText('Ver dados em tabela')).toBeInTheDocument();
    const linhas = within(figura).getAllByRole('row');
    expect(linhas).toHaveLength(7); // cabeçalho + 6 meses
    expect(within(linhas[6]).getByRole('rowheader')).toHaveTextContent('Out*');
  });

  it('sem mês parcial no fim, não há rodapé', () => {
    const d = visaoGeralParacatu();
    d.meses = d.meses.map((m) => ({ ...m, parcial: false }));
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d)} />);
    expect(screen.queryByText(/parcial, até/)).not.toBeInTheDocument();
  });

  it('com aluno: "Dias ativos mês a mês", descrição com o primeiro nome e "N d"', () => {
    const d = visaoGeralComAluno();
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d)} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Dias ativos mês a mês' })).toBeInTheDocument();
    expect(screen.getByText('Dias em que Ana teve ao menos 1 atividade')).toBeInTheDocument();
    const grafico = screen.getByRole('img', { name: 'Dias ativos mês a mês' });
    expect(within(grafico).getByText('9 d')).toBeInTheDocument();
    expect(within(grafico).getAllByText('8 d')).toHaveLength(2);
    expect(within(grafico).queryByText(/alunos/)).not.toBeInTheDocument();
  });

  it('trocando filtro (placeholder): dado anterior a 60% de opacidade com aria-busy', () => {
    const d = visaoGeralParacatu();
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d, { isPlaceholderData: true })} />);
    const bloco = screen.getByTestId('bloco-engajamento-mes-a-mes');
    expect(bloco).toHaveAttribute('aria-busy', 'true');
    expect(bloco.className).toContain('opacity-60');
    expect(within(bloco).getByRole('img')).toBeInTheDocument();
  });

  it('sem placeholder, o bloco não fica ocupado', () => {
    const d = visaoGeralParacatu();
    envolver(<EngajamentoMesAMes dados={d} consulta={consulta(d)} />);
    expect(screen.getByTestId('bloco-engajamento-mes-a-mes')).not.toHaveAttribute('aria-busy');
  });

  describe('carregando e erro', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('o skeleton só aparece depois de 400 ms (regra dos 400 ms)', () => {
      envolver(<EngajamentoMesAMes dados={undefined} consulta={consulta(undefined, { isLoading: true })} />);
      expect(screen.getByTestId('engajamento-mes-a-mes-aguardando')).toBeInTheDocument();
      expect(screen.queryByTestId('engajamento-mes-a-mes-loading')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(screen.getByTestId('engajamento-mes-a-mes-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('engajamento-mes-a-mes-aguardando')).not.toBeInTheDocument();
    });

    it('erro: "Tentar novamente" refaz a consulta, sem derrubar a página', () => {
      const refetch = vi.fn();
      envolver(<EngajamentoMesAMes dados={undefined} consulta={consulta(undefined, { isError: true, refetch })} />);
      fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('DoAcessoAoHabito (§4.3, §12.2)', () => {
  const largura = (chave: string) => {
    const barra = screen.getByTestId(`habito-${chave}`).querySelector('[aria-hidden="true"]') as HTMLElement;
    return (barra.firstElementChild as HTMLElement).style.width;
  };

  it('título e descrição com o mês de referência e os ativos no mês', () => {
    const d = visaoGeralParacatu();
    envolver(<DoAcessoAoHabito dados={d} consulta={consulta(d)} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Do acesso ao hábito' })).toBeInTheDocument();
    expect(
      screen.getByText('Dias ativos em set/26 (último mês fechado) · 223 dos 521 alunos tiveram atividade no mês'),
    ).toBeInTheDocument();
  });

  it('as 5 linhas na ordem, com nome, descrição, valor e % dos ativos no mês (1 casa, vírgula)', () => {
    const d = visaoGeralParacatu();
    envolver(<DoAcessoAoHabito dados={d} consulta={consulta(d)} />);

    const nomes = ['base', 'baixo', 'medio', 'alto', 'altissimo'].map((c) => screen.getByTestId(`habito-${c}`));
    expect(nomes.map((li) => li.textContent)).toEqual([
      'Base ativaAlunos com acesso vigente no SanarFlix521· 100%',
      'Baixo engajamento1 a 3 dias ativos no mês133· 59,6% dos ativos no mês',
      'Médio engajamento4 a 7 dias ativos no mês50· 22,4% dos ativos no mês',
      'Alto engajamento8 a 14 dias ativos no mês35· 15,7% dos ativos no mês',
      'Altíssimo engajamento15 dias ou mais ativos no mês5· 2,2% dos ativos no mês',
    ]);
  });

  it('as quatro faixas somam os ativos no mês (V10) e a barra é a fração da base ativa', () => {
    const d = visaoGeralParacatu();
    const { baixo, medio, alto, altissimo, ativosNoMes } = d.habito;
    expect(baixo + medio + alto + altissimo).toBe(ativosNoMes);

    envolver(<DoAcessoAoHabito dados={d} consulta={consulta(d)} />);
    expect(largura('base')).toBe('100%');
    expect(parseFloat(largura('baixo'))).toBeCloseTo((100 * 133) / 521, 5);
    expect(parseFloat(largura('altissimo'))).toBeCloseTo((100 * 5) / 521, 5);
  });

  it('com aluno: descrição própria, "Sim"/"Não" por faixa e barra cheia só na faixa dele', () => {
    const d = visaoGeralComAluno();
    envolver(<DoAcessoAoHabito dados={d} consulta={consulta(d)} />);
    expect(screen.getByText('Em que faixa Ana ficou em set/26 · 8 dias ativos no mês')).toBeInTheDocument();

    const sim = (c: string) => within(screen.getByTestId(`habito-${c}`)).getByTestId('habito-valor').textContent;
    expect(['base', 'baixo', 'medio', 'alto', 'altissimo'].map(sim)).toEqual(['Sim', 'Não', 'Não', 'Sim', 'Não']);
    expect(largura('base')).toBe('100%');
    expect(largura('alto')).toBe('100%');
    expect(largura('baixo')).toBe('0%');
    expect(largura('altissimo')).toBe('0%');
    expect(screen.queryByText(/dos ativos no mês/)).not.toBeInTheDocument();
  });

  it('com aluno sem dia ativo no mês: todas as faixas "Não", exceto a Base ativa', () => {
    const d = visaoGeralAlunoSemAtividade();
    envolver(<DoAcessoAoHabito dados={d} consulta={consulta(d)} />);
    const sim = (c: string) => within(screen.getByTestId(`habito-${c}`)).getByTestId('habito-valor').textContent;
    expect(['base', 'baixo', 'medio', 'alto', 'altissimo'].map(sim)).toEqual(['Sim', 'Não', 'Não', 'Não', 'Não']);
  });
});

describe('VisaoGeralEngajamento (rota) — topo da página', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisaoGeral.mockReturnValue(consulta(visaoGeralParacatu()));
  });

  it('consulta a visão geral com o recorte da URL e mostra os KPIs e os dois blocos', () => {
    envolver(<VisaoGeralEngajamento />, '/gestor/engajamento?ies=ies-1&periodo=30d&eng_sem=8');
    expect(mockVisaoGeral.mock.calls[0][0]).toMatchObject({ iesId: 'ies-1', semestre: 8, alunoId: null, periodo: '30d' });
    expect(titulos()).toContain('Alunos engajados');
    expect(screen.getByRole('heading', { level: 2, name: 'Engajamento mês a mês' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Do acesso ao hábito' })).toBeInTheDocument();
  });

  it('o rótulo do período anterior segue a opção da URL', () => {
    const d = visaoGeralParacatu();
    d.periodo.dias = 30;
    d.periodo.anterior = { inicio: '2026-01-01', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: true };
    d.kpis.engajadosPctAnterior = 60.0;
    mockVisaoGeral.mockReturnValue(consulta(d));
    envolver(<VisaoGeralEngajamento />, '/gestor/engajamento?ies=ies-1&periodo=30d');
    expect(nota('kpi-engajados')).toBe('▲ 3 p.p. vs. 30 dias anteriores');
  });

  it('com aluno na URL e o dado dele: KPIs, mês a mês e hábito no modo aluno', () => {
    mockVisaoGeral.mockReturnValue(consulta(visaoGeralComAluno()));
    envolver(<VisaoGeralEngajamento />, '/gestor/engajamento?ies=ies-1&aluno=aluno-1');
    expect(titulos()).toEqual(['Semestre', 'Situação', 'Dias ativos', 'Questões resolvidas', 'Acerto']);
    expect(screen.getByRole('heading', { level: 2, name: 'Dias ativos mês a mês' })).toBeInTheDocument();
    expect(screen.getByText('Em que faixa Ana ficou em set/26 · 8 dias ativos no mês')).toBeInTheDocument();
  });

  it('trocando filtro: o dado anterior fica na tela, com aria-busy, e os KPIs também escurecem', () => {
    mockVisaoGeral.mockReturnValue(consulta(visaoGeralParacatu(), { isPlaceholderData: true }));
    envolver(<VisaoGeralEngajamento />);
    expect(screen.getByTestId('bloco-engajamento-mes-a-mes')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('bloco-do-acesso-ao-habito')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('kpis-engajamento').parentElement).toHaveAttribute('aria-busy', 'true');
    expect(valor('kpi-base-ativa')).toBe('521');
  });

  it('erro da visão geral: cada bloco oferece "Tentar novamente" e o mesmo refetch', () => {
    const refetch = vi.fn();
    mockVisaoGeral.mockReturnValue(consulta(undefined, { isError: true, refetch }));
    envolver(<VisaoGeralEngajamento />);
    const botoes = screen.getAllByRole('button', { name: /Tentar novamente/ });
    expect(botoes.length).toBeGreaterThanOrEqual(7); // 5 cartões + 2 blocos
    botoes.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(botoes.length);
  });
});
