/**
 * Visão Geral (B2B) sobre a fonte mock dos protótipos (`VITE_MENTOR_FONTE=mock`, modalidade b2b):
 * hooks reais de `api/queries.ts`, dados de `api/mock/b2b.ts`. "Hoje" fixado em 04/11/2026.
 */
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { _definirConfigParaTestes, _resetarFontes } from '@/features/mentor/api/ativa';
import VisaoGeral from '@/features/mentor/routes/v2/VisaoGeral';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));

function Url() {
  const l = useLocation();
  return <output data-testid="url">{l.pathname}{l.search}</output>;
}
function montar(caminho = '/mentor/visao-geral') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[caminho]}><VisaoGeral /><Url /></MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
const url = () => screen.getByTestId('url').textContent ?? '';
const tabelaTemas = () => screen.getByRole('table', { name: 'Temas críticos' });
const linhasTemas = () => within(tabelaTemas()).getAllByRole('button', { name: /^(Expandir|Recolher) / });
const tabelaAlunos = () => screen.getByRole('table', { name: 'Alunos' });

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T12:00:00-03:00')); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 }); });
afterEach(() => { _resetarFontes(); _definirConfigParaTestes(null); });

describe('Visão Geral · cabeçalho e período', () => {
  it('título, período padrão "Últimos 6 meses", resumo e link para o último simulado do período', async () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Visão Geral' })).toBeVisible();
    const periodo = screen.getByRole('group', { name: 'Período' });
    const botoes = within(periodo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Últimos 30 dias', 'Últimos 90 dias', 'Últimos 6 meses', 'Ciclo 2026']);
    expect(within(periodo).getByRole('button', { name: 'Últimos 6 meses' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('4 simulados no período')).toBeVisible();
    expect(screen.getByRole('link', { name: /Detalhar este simulado/ })).toHaveAttribute('href', '/mentor/detalhamento?s=mock-sim-4');
  });

  it('trocar o período grava na URL e marca o botão', async () => {
    montar();
    await screen.findByText('4 simulados no período');
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 30 dias' }));
    expect(url()).toContain('periodo=30d');
    expect(screen.getByRole('button', { name: 'Últimos 30 dias' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 6 meses' }));
    expect(url()).not.toContain('periodo=');
  });

  it('período vindo da URL', async () => {
    montar('/mentor/visao-geral?periodo=ciclo');
    expect(screen.getByRole('button', { name: 'Ciclo 2026' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Visão Geral · projeção × observado', () => {
  it('projeção em bloco próprio, com aviso de que não é resultado oficial do INEP', async () => {
    montar();
    const projecao = await screen.findByRole('region', { name: 'Projeção para o ENAMED' });
    expect(within(projecao).getByText('estimativa · não é resultado oficial do INEP')).toBeVisible();
    expect(within(projecao).getAllByText('projetado')).toHaveLength(2);
    const conceito = within(projecao).getByTestId('kpi-conceito-enamed');
    expect(within(conceito).getByTestId('kpi-valor')).toHaveTextContent('3');
    expect(within(conceito).getByText('/ 5')).toBeVisible();
    expect(within(conceito).getByText('52% de proficientes no 4º simulado')).toBeVisible();
    expect(within(conceito).queryByTestId('kpi-delta')).not.toBeInTheDocument();
    expect(within(conceito).getByTestId('kpi-regua')).toHaveTextContent(/1º.*2.*Anterior.*3.*Atual.*3/);
    const tri = within(projecao).getByTestId('kpi-tri-projetado');
    expect(within(tri).getByTestId('kpi-valor')).toHaveTextContent('58,4');
    expect(within(tri).getByTestId('kpi-delta')).toHaveTextContent('+1,2 vs anterior');
    expect(within(tri).getByText('faltam 1,6 para 60')).toBeVisible();
    expect(within(projecao).getByText('Evolução da proficiência média')).toBeVisible();
    expect(within(projecao).getByRole('img', { name: 'Proficiência média por simulado: 54,1, 55,8, 57,2, 58,4' })).toBeVisible();
    // Projeção não carrega número observado.
    expect(within(projecao).queryByText('Participação')).not.toBeInTheDocument();
  });

  it('resultados observados em faixa separada, sem selo', async () => {
    montar();
    const obs = await screen.findByRole('region', { name: 'Resultados observados' });
    expect(within(obs).queryByText('projetado')).not.toBeInTheDocument();
    expect(within(obs).getByText('52%')).toBeVisible();
    expect(within(obs).getByText('89 de 171')).toBeVisible();
    expect(within(obs).getByText('61,8%')).toBeVisible();
    expect(within(obs).getByText('no simulado mais recente do período (4º)')).toBeVisible();
    expect(within(obs).getByText('/ 186')).toBeVisible();
    expect(within(obs).getByText('15 alunos da turma não fizeram')).toBeVisible();
    expect(within(obs).getByText('de 6 contratados')).toBeVisible();
    expect(within(obs).getByRole('img', { name: '4 simulados no período de 6 contratados' })).toBeVisible();
    expect(within(obs).getByText('próximo: 5º · 31/10')).toBeVisible();
  });

  it('"Entenda as métricas" abre e fecha o glossário inline', async () => {
    montar();
    const botao = await screen.findByRole('button', { name: 'Entenda as métricas' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const glossario = document.getElementById(botao.getAttribute('aria-controls')!)!;
    expect(within(glossario).getByText('Conceito ENAMED previsto')).toBeVisible();
    expect(within(glossario).getByText('Proficiência (0 a 100)')).toBeVisible();
    expect(within(glossario).getByText('Proficiente')).toBeVisible();
    expect(within(glossario).getByText('Percentual de acerto')).toBeVisible();
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Visão Geral · temas críticos', () => {
  it('mostra 5, expande de 5 em 5 com "faltam N" e recolhe', async () => {
    montar();
    await waitFor(() => expect(linhasTemas()).toHaveLength(5));
    expect(screen.getByRole('heading', { name: /Temas críticos da turma/ })).toHaveTextContent('16');
    expect(linhasTemas()[0]).toHaveTextContent('Notificação compulsória');
    expect(screen.getByText('Mostrando 5 de 16')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 5 (faltam 11)' }));
    expect(linhasTemas()).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 5 (faltam 6)' }));
    expect(linhasTemas()).toHaveLength(15);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 1' }));
    expect(linhasTemas()).toHaveLength(16);
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher para os 5 primeiros' }));
    expect(linhasTemas()).toHaveLength(5);
    expect(screen.getByText('crítico < 50%')).toBeVisible();
    expect(screen.getByText('mediano 50% a 79%')).toBeVisible();
  });

  it('trocar filtro (área ou ordenação) volta para 5', async () => {
    montar();
    await waitFor(() => expect(linhasTemas()).toHaveLength(5));
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'acerto' } });
    expect(linhasTemas()).toHaveLength(5);
    expect(linhasTemas()[0]).toHaveTextContent('Notificação compulsória');
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'alunos' } });
    expect(linhasTemas()[0]).toHaveTextContent('Notificação compulsória');
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
    fireEvent.change(screen.getByLabelText('Grande área'), { target: { value: 'Clínica Médica' } });
    expect(screen.getByText('Mostrando 3 de 3')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Grande área'), { target: { value: 'Saúde Mental' } });
    expect(linhasTemas()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Mostrar mais|Recolher/ })).not.toBeInTheDocument();
  });

  it('linha expandida: evolução, questões do simulado, levar para a oficina e criar intervenção', async () => {
    montar();
    await waitFor(() => expect(linhasTemas()).toHaveLength(5));
    const linha = screen.getByRole('button', { name: 'Expandir Vigilância em saúde' });
    fireEvent.click(linha);
    expect(screen.getByRole('button', { name: 'Recolher Vigilância em saúde' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('2º: 44% → 3º: 41% → 4º: 38%')).toBeVisible();
    expect(screen.getByText('Questões do tema no 4º simulado')).toBeVisible();
    expect(await screen.findByText('Q52 · 1 questão no simulado')).toBeVisible();
    const levar = await screen.findByRole('button', { name: 'Levar para a próxima oficina (19/11)' });
    fireEvent.click(levar);
    const toast = await screen.findByText('Vigilância em saúde entrou na pauta da oficina de 19/11');
    expect(toast.closest('[role="status"]')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Na pauta da oficina' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' }));
    expect(await screen.findByText('Intervenção criada em A fazer')).toBeVisible();
  });
});

describe('Visão Geral · alunos', () => {
  it('tabela com grupo, perfil, semestre, proficiências (— = não participou) e rodapé', async () => {
    montar();
    await waitFor(() => expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(12));
    const amanda = within(tabelaAlunos()).getByRole('button', { name: 'Amanda Rocha' }).closest('[role="row"]') as HTMLElement;
    expect(within(amanda).getByText('Consistentemente proficiente')).toBeVisible();
    expect(within(amanda).getByText('Desempenho muito bom')).toBeVisible();
    expect(within(amanda).getByText('12º')).toBeVisible();
    expect(amanda).toHaveTextContent('61 · 63 · 64 · 66');
    expect(amanda).toHaveTextContent('74%');
    expect(amanda).toHaveTextContent('hoje');
    const davi = within(tabelaAlunos()).getByRole('button', { name: 'Davi Santana' }).closest('[role="row"]') as HTMLElement;
    expect(davi).toHaveTextContent('38 · 41 · 39 · —');
    const joao = within(tabelaAlunos()).getByRole('button', { name: 'João Pedro Rangel' }).closest('[role="row"]') as HTMLElement;
    expect(within(joao).getByText('há 19 dias')).toBeVisible();
    expect(within(tabelaAlunos()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['Aluno', 'Semestre', 'Proficiência 1º → 4º', 'Acerto 4º', 'Último acesso']),
    );
    expect(screen.getByText('Mostrando 11 de 11 · — = não participou')).toBeVisible();
  });

  it('chips de grupo filtram e vão para a URL', async () => {
    montar();
    await waitFor(() => expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(12));
    const grupos = screen.getByRole('group', { name: 'Filtrar por grupo' });
    expect(within(grupos).getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(grupos).getByRole('button', { name: /^Em variação/ }));
    expect(url()).toContain('grupo=em_variacao');
    expect(within(grupos).getByRole('button', { name: /^Em variação/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(1 + 2);
    fireEvent.click(within(grupos).getByRole('button', { name: /^Sem resultado/ }));
    expect(within(tabelaAlunos()).getByRole('button', { name: 'Lívia Vasconcelos Teixeira' })).toBeVisible();
  });

  it('perfil vindo do Início vira chip removível e filtra a lista', async () => {
    montar('/mentor/visao-geral?perfil=virada');
    expect(await screen.findByText('Perfil: com potencial de virada · 4')).toBeVisible();
    await waitFor(() => expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(1 + 4));
    expect(screen.getByText('Mostrando 4 de 4 · — = não participou')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro' }));
    expect(url()).not.toContain('perfil=');
    expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(12);
  });

  it('busca sem resultado mostra o vazio com "Limpar filtros"', async () => {
    montar('/mentor/visao-geral?grupo=em_variacao');
    await waitFor(() => expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar aluno' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum aluno neste recorte.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(url()).not.toContain('grupo=');
    expect(screen.getByRole('textbox', { name: 'Buscar aluno' })).toHaveValue('');
    expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(12);
  });

  it('clicar no aluno abre o drawer pela URL (?aluno=)', async () => {
    montar();
    await waitFor(() => expect(within(tabelaAlunos()).getAllByRole('row')).toHaveLength(12));
    fireEvent.click(within(tabelaAlunos()).getByRole('button', { name: 'Bruno Teles' }));
    expect(url()).toContain('aluno=bruno.teles%40exemplo.com');
  });
});
