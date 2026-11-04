/**
 * Início do mentor sobre a fonte mock (dados dos protótipos): B2C (Carcará) e B2B (UniAtenas Paracatu).
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { _definirConfigParaTestes, _resetarFontes } from '@/features/mentor/api/ativa';
import Inicio from '@/features/mentor/routes/v2/Inicio';

// O setup global substitui useNavigate/useLocation; aqui a navegação real é o que se testa.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

function Local() {
  const l = useLocation();
  return <output data-testid="local">{l.pathname + l.search}</output>;
}
function renderInicio(modalidade: 'b2c' | 'b2b') {
  _definirConfigParaTestes({ fonte: 'mock', modalidade, latenciaMs: 0 });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/mentor']}>
        <Routes><Route path="/mentor/*" element={<><Inicio /><Local /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const local = () => screen.getByTestId('local').textContent;

afterEach(() => { vi.useRealTimers(); _resetarFontes(); _definirConfigParaTestes(null); });

describe('Início B2C (mock Carcará)', () => {
  it('faixa da tribo com saudação, eyebrow, ações e marca', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 15, 14, 0) });
    renderInicio('b2c');
    const faixa = await screen.findByRole('banner');
    expect(within(faixa).getByText('Tribo Carcará · Nota 90+')).toBeVisible();
    expect(within(faixa).getByRole('heading', { level: 1, name: 'Boa tarde, Thiago' })).toBeVisible();
    expect(within(faixa).getByRole('img', { name: 'Tribo Carcará' })).toBeVisible();
    await userEvent.click(within(faixa).getByRole('button', { name: 'Nova intervenção' }));
    expect(local()).toBe('/mentor/intervencoes?novo=1');
    await userEvent.click(within(faixa).getByRole('button', { name: 'Publicar no mural' }));
    expect(local()).toBe('/mentor/mural');
  });

  it('visão geral da tribo com 3 indicadores e link para o simulado de referência', async () => {
    renderInicio('b2c');
    const bloco = await screen.findByRole('region', { name: 'Visão geral da tribo' });
    await within(bloco).findByText('5º Simulado PRO · 21/09');
    expect(within(bloco).getByText('Acima do corte')).toBeVisible();
    expect(within(bloco).getByText('34%')).toBeVisible();
    expect(within(bloco).getByText('+6 p.p. vs 4º simulado')).toBeVisible();
    expect(within(bloco).getByText('79%')).toBeVisible();
    expect(within(bloco).getByText('+2 p.p. vs 4º simulado')).toBeVisible();
    expect(within(bloco).getByText('/ 12')).toBeVisible();
    expect(within(bloco).getByText('3 não fizeram')).toBeVisible();
    await userEvent.click(within(bloco).getByRole('button', { name: /Detalhar simulado/ }));
    expect(local()).toBe('/mentor/detalhamento?s=mock-sim-5');
  });

  it('Quem precisa de você: alertas reais, sem grupo vazio, e clique filtra a turma', async () => {
    renderInicio('b2c');
    const bloco = await screen.findByRole('region', { name: 'Quem precisa de você' });
    const sumiram = await within(bloco).findByRole('button', { name: /Sumiram/ });
    expect(within(sumiram).getByText('Sem acesso há 15 dias ou mais')).toBeVisible();
    expect(within(sumiram).getByText('3')).toBeVisible();
    expect(within(bloco).getByRole('button', { name: /Não fizeram o 5º simulado/ })).toHaveTextContent('Simulado fechou em 21/09');
    expect(within(bloco).queryByRole('button', { name: /Esfriando/ })).not.toBeInTheDocument();
    expect(within(bloco).getByText(/4 alertas · hoje, \d{1,2}h/)).toBeVisible();
    await userEvent.click(sumiram);
    expect(local()).toBe('/mentor/turma?alerta=sumiram');
  });

  it('Próximas sessões: encontro em destaque com "Falta link" e ação; 2 seguintes', async () => {
    renderInicio('b2c');
    const bloco = await screen.findByRole('region', { name: 'Próximas sessões' });
    expect(await within(bloco).findByText('Encontro da tribo · 19h')).toBeVisible();
    expect(within(bloco).getByText('Como estudar as últimas 6 semanas')).toBeVisible();
    expect(within(bloco).getByText('Falta link')).toBeVisible();
    const linhas = within(bloco).getAllByRole('button', { name: /· \d{1,2}h/ });
    expect(linhas.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Diego Pacheco · 20h'), expect.stringContaining('Caio Menezes · 18h'),
    ]);
    expect(linhas[0]).toHaveTextContent('Individual');
    await userEvent.click(within(bloco).getByRole('button', { name: 'Adicionar link' }));
    expect(local()).toBe('/mentor/sessoes?sessao=mock-sessao-1');
  });

  it('A fazer: contagem e cards abrem o drawer do kanban', async () => {
    renderInicio('b2c');
    const bloco = await screen.findByRole('region', { name: /A fazer/ });
    const card = await within(bloco).findByRole('button', { name: /Conversa sobre a queda no 5º simulado/ });
    expect(card).toHaveTextContent('Caio Menezes');
    expect(within(bloco).getByRole('button', { name: /Vigilância em saúde/ })).toHaveTextContent('Turma toda');
    expect(within(bloco).getByText('3')).toBeVisible();
    await userEvent.click(card);
    expect(local()).toBe('/mentor/intervencoes?card=mock-card-1');
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir kanban' }));
    expect(local()).toBe('/mentor/intervencoes');
  });
});

describe('Início B2B (mock UniAtenas)', () => {
  it('faixa da IES com selo e ações próprias', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 9, 15, 9, 0) });
    renderInicio('b2b');
    const faixa = await screen.findByRole('banner');
    expect(within(faixa).getByRole('heading', { level: 1, name: 'Bom dia, Beatriz' })).toBeVisible();
    expect(within(faixa).getByRole('img', { name: 'Selo UniAtenas Paracatu' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Próximas sessões' })).toHaveTextContent('Individual · 19h'));
    await userEvent.click(within(faixa).getByRole('button', { name: 'Preparar sessão' }));
    expect(local()).toBe('/mentor/sessoes?sessao=mock-sessao-3');
    await userEvent.click(within(faixa).getByRole('button', { name: 'Rotina do grupo' }));
    expect(local()).toBe('/mentor/canais');
  });

  it('visão geral da instituição: projetado em Conceito e TRI, observado sem marcador', async () => {
    renderInicio('b2b');
    const bloco = await screen.findByRole('region', { name: 'Visão geral da instituição' });
    await within(bloco).findByText('4º simulado · 01/10');
    expect(within(bloco).getAllByTitle('Projetado')).toHaveLength(2);
    expect(within(bloco).getByText('igual ao 3º simulado')).toBeVisible();
    expect(within(bloco).getByText('58,4')).toBeVisible();
    expect(within(bloco).getByText('+1,2 vs 3º simulado')).toBeVisible();
    expect(within(bloco).getByText('52%')).toBeVisible();
    expect(within(bloco).getByText('89 de 171 participantes')).toBeVisible();
    await userEvent.click(within(bloco).getByRole('button', { name: /Ver análise completa/ }));
    expect(local()).toBe('/mentor/visao-geral');
  });

  it('prioridades de acompanhamento filtram a Visão Geral pelo perfil', async () => {
    renderInicio('b2b');
    const bloco = await screen.findByRole('region', { name: 'Prioridades de acompanhamento' });
    const virada = await within(bloco).findByRole('button', { name: /Potencial de virada/ });
    expect(within(virada).getByText('4')).toBeVisible();
    expect(within(bloco).getByRole('button', { name: /Sem acesso recente/ })).toHaveTextContent('Média');
    expect(within(bloco).getByRole('button', { name: /Desempenho muito bom/ })).toHaveTextContent('Baixa');
    await userEvent.click(virada);
    expect(local()).toBe('/mentor/visao-geral?perfil=virada');
  });

  it('próximas sessões em ordem cronológica com status e ação contextual', async () => {
    renderInicio('b2b');
    const bloco = await screen.findByRole('region', { name: 'Próximas sessões' });
    expect(await within(bloco).findByText('Plano para a virada no 5º simulado')).toBeVisible();
    expect(within(bloco).getByRole('button', { name: 'Abrir sessão' })).toBeVisible();
    const linhas = within(bloco).getAllByRole('button', { name: /· 20h/ });
    expect(linhas.map((b) => b.textContent)).toEqual([
      // Dia da semana calculado da data real (22/10/2026 e 05/11/2026 são quintas; o protótipo escreve "Qua").
      expect.stringMatching(/Qui 22.*Oficina de questões · 20h.*Agendada/), expect.stringMatching(/Qui 05.*Pós-simulado · 20h.*Falta link/),
    ]);
  });

  it('grupo da semana: marcar enviado no item do dia, com toast', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-15T14:00:00-03:00') });
    renderInicio('b2b');
    const bloco = await screen.findByRole('region', { name: 'Grupo da turma · semana' });
    await within(bloco).findByText('Enviado');
    expect(within(bloco).getByText('Amanhã')).toBeVisible();
    const botoes = within(bloco).getAllByRole('button', { name: 'Marcar enviado' });
    expect(botoes).toHaveLength(1);
    await userEvent.click(botoes[0]);
    const toast = await screen.findByText('Resposta + comentário do mentor marcada como enviada · entrou no log da semana');
    expect(toast.closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(within(bloco).queryByRole('button', { name: 'Marcar enviado' })).not.toBeInTheDocument());
    expect(within(bloco).getAllByText('Enviado')).toHaveLength(2);
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir canais' }));
    expect(local()).toBe('/mentor/canais');
  });
});
