/**
 * Detalhamento renderizado sobre a fonte mock (VITE_MENTOR_FONTE=mock = dados dos protótipos).
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { _definirConfigParaTestes, _resetarFontes } from '@/features/mentor/api/ativa';
import Detalhamento from '@/features/mentor/routes/v2/Detalhamento';

// O setup global troca useNavigate/useLocation por stubs; aqui a navegação é real.
vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function montar(rota = '/mentor/detalhamento') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            <Route path="/mentor/detalhamento" element={<><Detalhamento /><Local /></>} />
            <Route path="*" element={<Local />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
const local = () => decodeURIComponent(screen.getByTestId('local').textContent ?? '');
const params = () => new URLSearchParams(local().split('?')[1] ?? '');

afterEach(() => { _resetarFontes(); _definirConfigParaTestes(null); });

describe('Detalhamento · B2C (mock)', () => {
  beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 }); });

  it('abre com 4º + 5º, escreve ?s= e mostra os blocos do protótipo', async () => {
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Detalhamento de simulados' })).toBeInTheDocument();
    await waitFor(() => expect(params().get('s')).toBe('4,5'));
    const seletor = screen.getByTestId('seletor-simulados');
    expect(within(seletor).getByText('4º Simulado PRO')).toBeInTheDocument();
    expect(within(seletor).getByText('5º Simulado PRO')).toBeInTheDocument();
    expect(screen.getByText(/o agregado da turma é a Minha Turma/)).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-possivel-aprovacao')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acerto por prevalência' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diagnóstico da IA' })).toBeInTheDocument();
    expect(await screen.findByText(/A turma subiu 2 p\.p\. no geral/)).toBeInTheDocument();
    expect(screen.getByText('Visão de alunos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detalhamento das questões' })).toBeInTheDocument();
    // B2C: sem semestre, com "Último acesso" e as abas por corte.
    expect(await screen.findByRole('columnheader', { name: /Último acesso/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Semestre/ })).not.toBeInTheDocument();
    const filtro = screen.getByRole('group', { name: 'Filtrar alunos por situação' });
    for (const r of ['Acima do corte', 'Próximo do corte', 'Longe do corte']) expect(within(filtro).getByRole('button', { name: new RegExp(r) })).toBeInTheDocument();
  });

  it('sem seleção mostra só o seletor com "Escolha ao menos um simulado"; a URL guarda ?s= vazio', async () => {
    const user = userEvent.setup();
    montar('/mentor/detalhamento?s=4,5');
    await user.click(await screen.findByRole('button', { name: 'Limpar seleção' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um simulado');
    expect(params().get('s')).toBe('');
    expect(screen.queryByTestId('kpi-possivel-aprovacao')).not.toBeInTheDocument();
    expect(screen.queryByText('Como ler estes indicadores')).not.toBeInTheDocument();
  });

  it('com 1 simulado não há delta (pede 2 para comparar); deep link ?s=5', async () => {
    montar('/mentor/detalhamento?s=5');
    const card = await screen.findByTestId('kpi-possivel-aprovacao');
    expect(within(card).getByText('selecione 2 simulados para comparar')).toBeInTheDocument();
    expect(within(card).queryByTestId('kpi-delta')).not.toBeInTheDocument();
  });

  it('"Como ler estes indicadores" expande com aria-expanded', async () => {
    const user = userEvent.setup();
    montar();
    const botao = await screen.findByRole('button', { name: 'Como ler estes indicadores' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await user.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Possível aprovação', { selector: 'dt' })).toBeInTheDocument();
  });

  it('Detalhar abre o drawer da grande área (?ga=) e "Intervenção" cria card com toast', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Detalhar Preventiva' }));
    const drawer = await screen.findByRole('dialog');
    expect(params().get('ga')).toBe('Preventiva');
    expect(within(drawer).getByText(/Acerto puro, sem nota de corte/)).toHaveTextContent('(4º e 5º)');
    const ver = within(drawer).getAllByRole('button', { name: /Ver temas/ })[0];
    await user.click(ver);
    expect(ver).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(drawer).getAllByRole('button', { name: /Criar intervenção para/ })[0]);
    expect(await screen.findByTestId('toast-detalhamento')).toHaveTextContent(/Intervenção criada em A fazer: |Essa intervenção já está no kanban: /);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(params().get('ga')).toBeNull();
  });

  it('Q expandida: enunciado, alternativas, distribuição, quem marcou o distrator e as 2 ações', async () => {
    const user = userEvent.setup();
    montar();
    const linha = await screen.findByTestId('linha-questao-mock-q-12');
    await user.click(within(linha).getByRole('button', { name: /Ver detalhe da questão 12/ }));
    const detalhe = await screen.findByTestId('detalhe-mock-q-12');
    expect(await within(detalhe).findByText('Enunciado.')).toBeInTheDocument();
    expect(within(detalhe).getByText(/alternativa correta/)).toBeInTheDocument();
    expect(within(detalhe).getByText('distrator dominante')).toBeInTheDocument();
    expect(within(detalhe).getByText('Distribuição por alternativa')).toBeInTheDocument();
    expect(within(detalhe).getByText('Quem marcou C')).toBeInTheDocument();
    expect(within(detalhe).getByRole('button', { name: 'Criar intervenção' })).toBeInTheDocument();
    await user.click(within(detalhe).getByRole('button', { name: 'Mensagem pra quem marcou C' }));
    expect(local()).toMatch(/^\/mentor\/mural\?/);
    expect(params().get('tag')).toBe('desempenho');
    expect(params().get('titulo')).toBe('Vigilância em saúde: o erro que mais apareceu');
  });

  it('ordenação das questões vai para a URL', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('radio', { name: /Mais erradas/ }));
    expect(params().get('ord')).toBe('erradas');
  });

  it('IA: "Gerar de novo" mostra skeleton e toast; "Levar pro mural" abre o Mural preenchido para a turma', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText(/A turma subiu 2 p\.p\./);
    await user.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    expect(screen.getByTestId('ia-gerando')).toHaveAttribute('role', 'status');
    expect(await screen.findByTestId('toast-detalhamento')).toHaveTextContent('Diagnóstico gerado de novo');
    await user.click(screen.getByRole('button', { name: 'Levar pro mural' }));
    expect(local()).toMatch(/^\/mentor\/mural\?/);
    expect(params().get('para')).toBeNull();
    expect(params().get('titulo')).toBe('Onde a turma perde ponto no 5º simulado');
    expect(params().get('mensagem')).toMatch(/A turma subiu 2 p\.p\./);
  });

  it('"Ver cronograma" informa o próximo simulado', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: /Ver cronograma/ }));
    expect(await screen.findByTestId('toast-detalhamento')).toHaveTextContent(/^Cronograma: 6º Simulado PRO/);
  });
});

describe('Detalhamento · B2B (mock)', () => {
  beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 }); });

  it('indicadores projetados, abas de proficiência, semestre e "Levar pro mural" para Canais', async () => {
    const user = userEvent.setup();
    montar();
    expect(await screen.findByTestId('kpi-conceito')).toBeInTheDocument();
    expect(screen.getAllByText('projetado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/o agregado do período é a Visão Geral/)).toBeInTheDocument();
    const filtro = await screen.findByRole('group', { name: 'Filtrar alunos por situação' });
    for (const r of ['Proficiente', 'Potencial de virada', 'Abaixo do limiar']) expect(within(filtro).getByRole('button', { name: new RegExp(r) })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Semestre/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Limiar/ })).toBeInTheDocument();
    await screen.findByText(/O TRI projetado subiu/);
    await user.click(screen.getByRole('button', { name: 'Levar pro mural' }));
    expect(local()).toMatch(/^\/mentor\/canais\?/);
    expect(params().get('mural')).toBe('1');
  });
});
