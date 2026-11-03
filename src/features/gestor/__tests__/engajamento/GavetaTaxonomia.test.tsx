import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockAlunos = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoQuestoesAlunos: (...args: unknown[]) => mockAlunos(...args),
}));

import { GavetaTaxonomia } from '@/features/gestor/components/engajamento/GavetaTaxonomia';
import type { QuestoesEngajamento } from '@/features/gestor/api/types-engajamento';
import { questoesAlunosAssunto, questoesAlunosTema, questoesParacatu } from '../fixtures/engajamento/questoes';
import { resultadoGestor } from '../fixtures/engajamento/visaoGeral';

/** Gaveta "Por taxonomia" e pop-up de alunos do tema/assunto (spec 2026-10-22-engajamento §8.5, §8.6, §12.3). */

const FILTROS = { iesId: 'ies-1', inicio: '2026-05-01', fim: '2026-10-22', semestre: null, alunoId: null, tipo: 'todos' as const };

const montar = (d: QuestoesEngajamento = questoesParacatu(), extra: Record<string, unknown> = {}) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <GavetaTaxonomia dados={d} consulta={resultadoGestor(d, extra)} filtros={FILTROS} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const linha = (id: string) => screen.getByTestId(`taxonomia-${id}`);
const temLinha = (id: string) => screen.queryByTestId(`taxonomia-${id}`) !== null;
const expandida = (id: string) => linha(id).getAttribute('aria-expanded');
const celulas = (id: string) => within(linha(id)).getAllByRole('gridcell').map((c) => c.textContent);

describe('GavetaTaxonomia — estrutura (§12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosTema()));
  });

  it('título, descrição, "Recolher tudo", treegrid rotulado e cabeçalhos', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Por taxonomia' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ciclo clínico: grande área › especialidade › tema · Ciclo básico: disciplina › assunto · clique numa linha para abrir o nível abaixo · clique num tema ou assunto para ver os alunos que resolveram questões dele',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recolher tudo' })).toBeInTheDocument();
    const arvore = screen.getByRole('treegrid', { name: 'Questões por grande área, especialidade e tema' });
    expect(within(arvore).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Classificação', 'Questões', 'Alunos', 'Acerto']);
  });

  it('duas faixas de seção, com legenda e totais; o básico NÃO fica dentro das grandes áreas', () => {
    montar();
    const faixas = screen.getAllByTestId('faixa-ciclo');
    expect(faixas.map((f) => f.textContent)).toEqual([
      'Ciclo clínico e residência Grande área › especialidade › tema100.000—66%',
      'Ciclo básico Disciplina › assunto45.873—68%',
    ]);
    // ordem no documento: faixa clínica, suas linhas, faixa básica, as dela
    const ordem = [...screen.getByRole('treegrid').querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid'));
    expect(ordem.indexOf('taxonomia-ga-cm')).toBeLessThan(ordem.lastIndexOf('faixa-ciclo'));
    expect(ordem.indexOf('taxonomia-disc-fisio')).toBeGreaterThan(ordem.lastIndexOf('faixa-ciclo'));
    expect(ordem.indexOf('taxonomia-ga-ped')).toBeLessThan(ordem.lastIndexOf('faixa-ciclo'));
  });

  it('os títulos das faixas vão em CSS uppercase', () => {
    montar();
    const titulo = within(screen.getAllByTestId('faixa-ciclo')[0]).getByText('Ciclo clínico e residência');
    expect(titulo).toHaveClass('uppercase');
  });

  it('faixa de seção com as cores da §13: fundo de seleção, topo de marca e borda', () => {
    montar();
    const f = screen.getAllByTestId('faixa-ciclo')[0];
    expect(f.style.background).toContain('--gp-brand-surface');
    expect(f.style.borderTop).toContain('3px solid var(--gp-brand)');
    expect(f.style.borderBottom).toContain('--gp-brand-border');
  });

  it('linhas: níveis (aria-level), questões, alunos e acerto; a coluna Alunos não soma', () => {
    montar();
    expect(linha('ga-cm')).toHaveAttribute('aria-level', '1');
    expect(linha('esp-card')).toHaveAttribute('aria-level', '2');
    expect(linha('tema-arr')).toHaveAttribute('aria-level', '3');
    expect(celulas('ga-cm')).toEqual(['Clínica Médica', '60.000', '250', '67%']);
    expect(celulas('tema-arr')).toEqual(['Arritmias', '20.000', '180', '70%']);
    // alunos de Cardiologia (200) e de Pneumologia (190) não somam os de Clínica Médica (250)
    expect(200 + 190).not.toBe(250);
  });

  it('linha "Total" e rodapé literal com o total', () => {
    montar();
    expect(within(screen.getByTestId('taxonomia-total')).getAllByRole('gridcell').map((c) => c.textContent)).toEqual(['Total', '145.873', '296', '66%']);
    expect(
      screen.getByText(
        'Cada questão é contada uma única vez, na sua classificação principal; por isso cada nível soma exatamente o total (145.873), igual aos indicadores do topo. A coluna Alunos não soma: o mesmo aluno resolve questões de vários temas.',
      ),
    ).toBeInTheDocument();
  });

  it('cada nível soma o total (V11): clínico + básico, grandes áreas, especialidades e temas', () => {
    const { arvore } = questoesParacatu();
    const soma = (ns: Array<{ questoes: number }>) => ns.reduce((s, n) => s + n.questoes, 0);
    expect(arvore.clinico.questoes + arvore.basico.questoes).toBe(arvore.total.questoes);
    expect(soma(arvore.clinico.grandesAreas)).toBe(arvore.clinico.questoes);
    expect(soma(arvore.basico.disciplinas)).toBe(arvore.basico.questoes);
    for (const g of arvore.clinico.grandesAreas) {
      expect(soma(g.especialidades)).toBe(g.questoes);
      for (const e of g.especialidades) expect(soma(e.temas)).toBe(e.questoes);
    }
    for (const d of arvore.basico.disciplinas) expect(soma(d.assuntos)).toBe(d.questoes);
  });

  it('acerto vazio fica "—", e crítico em --gp-danger-on', () => {
    const d = questoesParacatu();
    d.arvore.clinico.grandesAreas[0].especialidades[1].temas[0].acertoPct = null;
    montar(d);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Pneumologia' }));
    expect(celulas('tema-asma')[3]).toBe('—');
    // Pneumologia tem 45%: crítico
    const acerto = within(linha('esp-pneumo')).getAllByRole('gridcell')[3].firstElementChild as HTMLElement;
    expect(acerto.style.color).toContain('--gp-danger-on');
  });
});

describe('GavetaTaxonomia — abrir e fechar (§12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosTema()));
  });

  it('abertura inicial: a 1ª grande área e, nela, a 1ª especialidade', () => {
    montar();
    expect(expandida('ga-cm')).toBe('true');
    expect(expandida('esp-card')).toBe('true');
    expect(temLinha('tema-arr')).toBe(true);
    expect(expandida('esp-pneumo')).toBe('false');
    expect(temLinha('tema-asma')).toBe(false);
    expect(expandida('ga-ped')).toBe('false');
    expect(temLinha('esp-neo')).toBe(false);
    expect(expandida('disc-fisio')).toBe('false');
    expect(temLinha('ass-cardio')).toBe(false);
  });

  it('sem clínico: abre a 1ª disciplina do básico', () => {
    const d = questoesParacatu();
    d.arvore.clinico = { questoes: 0, acertoPct: null, grandesAreas: [] };
    d.arvore.total = { ...d.arvore.total, questoes: 45873 };
    montar(d);
    expect(screen.getAllByTestId('faixa-ciclo')).toHaveLength(1);
    expect(expandida('disc-fisio')).toBe('true');
    expect(temLinha('ass-cardio')).toBe(true);
    expect(expandida('disc-anat')).toBe('false');
  });

  it('aria-label "Abrir {nome}" / "Recolher {nome}" e o clique alterna', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Recolher Cardiologia' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Pneumologia' }));
    expect(expandida('esp-pneumo')).toBe('true');
    expect(temLinha('tema-asma')).toBe(true);
    expect(screen.getByRole('button', { name: 'Recolher Pneumologia' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recolher Pneumologia' }));
    expect(temLinha('tema-asma')).toBe(false);
  });

  it('recolher o nível de cima esconde os de baixo, e abrir de novo mostra o que estava aberto', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher Clínica Médica' }));
    expect(temLinha('esp-card')).toBe(false);
    expect(temLinha('tema-arr')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Clínica Médica' }));
    expect(temLinha('esp-card')).toBe(true);
    expect(temLinha('tema-arr')).toBe(true); // Cardiologia continuou aberta
  });

  it('o básico abre por disciplina e mostra os assuntos', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Fisiologia' }));
    expect(temLinha('ass-cardio')).toBe(true);
    expect(linha('ass-cardio')).toHaveAttribute('aria-level', '2');
    expect(celulas('ass-cardio')).toEqual(['Fisiologia cardiovascular', '18.000', '180', '70%']);
  });

  it('"Recolher tudo" fecha tudo e fica fechado', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }));
    for (const id of ['ga-cm', 'ga-ped', 'disc-fisio', 'disc-anat']) expect(expandida(id)).toBe('false');
    expect(temLinha('esp-card')).toBe(false);
    expect(temLinha('tema-arr')).toBe(false);
  });

  it('folhas (tema e assunto) não têm aria-expanded', () => {
    montar();
    expect(linha('tema-arr')).not.toHaveAttribute('aria-expanded');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Fisiologia' }));
    expect(linha('ass-cardio')).not.toHaveAttribute('aria-expanded');
  });
});

describe('GavetaTaxonomia — pop-up de alunos (§12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosTema()));
  });

  it('tema clínico: aria-label "Ver alunos do tema …" com aria-haspopup="dialog"', () => {
    montar();
    const b = screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' });
    expect(b).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('assunto básico: aria-label "Ver alunos do assunto …"', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Fisiologia' }));
    expect(screen.getByRole('button', { name: 'Ver alunos do assunto Fisiologia cardiovascular' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('o pop-up só consulta depois do clique, com o id da folha', () => {
    montar();
    expect(mockAlunos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    expect(mockAlunos).toHaveBeenLastCalledWith(FILTROS, 'tema-arr');
  });

  it('tema: sobretítulo "Clínica Médica › Cardiologia", título, resumo e colunas', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Clínica Médica › Cardiologia')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Arritmias' })).toBeInTheDocument();
    expect(within(dialog).getByText('180 alunos resolveram · 20.000 questões · 70% de acerto')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Aluno', 'Semestre', 'Questões', 'Acerto', 'Última atividade']);
  });

  it('assunto: sobretítulo "Ciclo básico › Fisiologia"', () => {
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosAssunto()));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Fisiologia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do assunto Fisiologia cardiovascular' }));
    expect(within(screen.getByRole('dialog')).getByText('Ciclo básico › Fisiologia')).toBeInTheDocument();
  });

  it('linhas: semestre, questões, acerto (crítico em alerta) e a última atividade em dd/mm/aaaa', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    const dialog = screen.getByRole('dialog');
    const ana = within(dialog).getByRole('row', { name: /Ana Clara/ });
    expect(within(ana).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Ana Clara Ribeiro', '12º', '320', '78%', '22/10/2026']);
    const acertos = within(dialog).getAllByTestId('acerto-aluno');
    expect(acertos[0].style.color).not.toContain('--gp-danger-on');
    expect(acertos[1].style.color).toContain('--gp-danger-on'); // 41%
  });

  it('rodapé "Mostrando os 12 alunos…" só com mais de 12 alunos no nó', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    expect(within(screen.getByRole('dialog')).getByText('Mostrando os 12 alunos com mais questões de 180.')).toBeInTheDocument();
  });

  it('com 12 alunos ou menos, sem esse rodapé', () => {
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosAssunto()));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Fisiologia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do assunto Fisiologia cardiovascular' }));
    expect(within(screen.getByRole('dialog')).queryByText(/Mostrando os 12/)).not.toBeInTheDocument();
  });

  it('fechar: o botão "Fechar" fecha e o foco volta para a linha que abriu', async () => {
    const user = userEvent.setup();
    montar();
    const gatilho = screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' });
    await user.click(gatilho);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('carregando e erro do pop-up', () => {
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    expect(within(screen.getByRole('dialog')).getByText('Carregando alunos')).toBeInTheDocument();
    unmount();

    const refetch = vi.fn();
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos do tema Arritmias' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('GavetaTaxonomia — estados (§11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(questoesAlunosTema()));
  });

  it('sem questões classificadas: estado vazio compacto', () => {
    const d = questoesParacatu();
    d.arvore = {
      clinico: { questoes: 0, acertoPct: null, grandesAreas: [] },
      basico: { questoes: 0, acertoPct: null, disciplinas: [] },
      total: { questoes: 0, alunos: 0, acertoPct: null },
    };
    montar(d);
    expect(screen.getByText('Nenhuma questão classificada neste recorte.')).toBeInTheDocument();
    expect(screen.queryByRole('treegrid')).not.toBeInTheDocument();
  });

  it('trocando filtro: dado anterior com aria-busy', () => {
    montar(questoesParacatu(), { isPlaceholderData: true });
    expect(screen.getByTestId('bloco-gaveta-taxonomia')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('treegrid')).toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', () => {
    const refetch = vi.fn();
    render(
      <TooltipProvider>
        <MemoryRouter>
          <GavetaTaxonomia dados={undefined} consulta={resultadoGestor(undefined, { isError: true, refetch })} filtros={FILTROS} />
        </MemoryRouter>
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
