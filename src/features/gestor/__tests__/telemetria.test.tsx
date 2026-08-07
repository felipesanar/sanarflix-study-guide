/**
 * Task 60 — os 7 eventos de produto da spec §10, sobre o tracker que o
 * projeto já usa (`useAnalyticsTracker`, mockado abaixo). `telemetria.ts` é a
 * ÚNICA porta de entrada: por isso este arquivo testa o hook diretamente,
 * com uma `Sonda` mínima — as rotas reais (`VisaoGeral.tsx`/`Detalhamento.tsx`/
 * `Inicio.tsx`) chamam exatamente estes métodos, não `trackEvent` direto.
 *
 * `useTelemetriaGestor` absorve especificamente o erro que `useAnalyticsTracker`
 * lança quando não há `<AuthProvider>` real na árvore (`useAuth()`,
 * `src/contexts/AuthContext.tsx:649-655`). Em produção o provider sempre
 * existe; mas `VisaoGeral.test.tsx`/`Detalhamento.test.tsx`/
 * `seguranca-lgpd.test.tsx` (de outra task, fora do escopo desta) renderizam
 * as rotas sem ele — confirmado empiricamente que, sem a guarda, isso
 * derruba essas 3 suítes. O describe dedicado abaixo tranca esse
 * comportamento controlando diretamente o que o mock de `useAnalyticsTracker`
 * lança (é isso, e não a presença de um `AuthContext.Provider`, que decide se
 * a guarda entra em ação — ver comentário no describe).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHAVES_PROIBIDAS, sanitizarProps, useTelemetriaGestor } from '@/features/gestor/lib/telemetria';

const trackEvent = vi.fn();
// O parâmetro rest existe para o `...args` do mock abaixo type-checkar: uma
// fábrica sem parâmetros recusa spread (TS2556), e a suíte passava verde com o
// type-check vermelho — o par que já mordeu este projeto antes.
const analyticsTrackerFactory = vi.fn((..._args: unknown[]) => ({ trackEvent }));
vi.mock('@/hooks/useAnalyticsTracker', () => ({
  useAnalyticsTracker: (...args: unknown[]) => analyticsTrackerFactory(...args),
  default: (...args: unknown[]) => analyticsTrackerFactory(...args),
}));

const Sonda: React.FC = () => {
  const t = useTelemetriaGestor();
  React.useEffect(() => {
    t.telaVista('visao_geral', '6ano');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <button onClick={() => t.filtroAlterado('semestre', '7')}>filtro</button>
      <button onClick={() => t.modoGraficoAlterado('area')}>modo</button>
      <button
        onClick={() => {
          t.marcarPrimeiroInsight();
          t.drawerAberto('aluno');
        }}
      >
        drawer
      </button>
      <button onClick={() => t.exportSolicitado('detalhamento')}>export</button>
      <button onClick={() => t.erroBloco('evolucao', 'permissao_negada')}>erro</button>
    </div>
  );
};

/** Boundary mínimo só para o teste que prova que erros SEM relação com AuthProvider não são engolidos pela guarda. */
class SondaComBoundary extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  state: { erro: Error | null } = { erro: null };
  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }
  render() {
    if (this.state.erro) return <div data-testid="erro-capturado">{this.state.erro.message}</div>;
    return this.props.children;
  }
}

const chamada = (nome: string) => trackEvent.mock.calls.find((c) => c[0].eventName === nome)?.[0];

beforeEach(() => {
  trackEvent.mockClear();
  analyticsTrackerFactory.mockClear();
  analyticsTrackerFactory.mockImplementation(() => ({ trackEvent }));
  vi.useRealTimers();
});

describe('telemetria do gestor (§10)', () => {
  it('gestor_tela_vista dispara no mount, com tela e semestre', () => {
    render(<Sonda />);
    expect(chamada('gestor_tela_vista')).toEqual({
      eventName: 'gestor_tela_vista',
      category: 'navigation',
      data: { tela: 'visao_geral', semestre: '6ano' },
    });
  });

  it('gestor_filtro_alterado dispara na troca, com tipo e valor', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'filtro' }));
    expect(chamada('gestor_filtro_alterado')).toEqual({
      eventName: 'gestor_filtro_alterado',
      category: 'interaction',
      data: { tipo: 'semestre', valor: '7' },
    });
  });

  it('gestor_modo_grafico_alterado dispara com o modo', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'modo' }));
    expect(chamada('gestor_modo_grafico_alterado')!.data).toEqual({ modo: 'area' });
  });

  it('gestor_drawer_aberto dispara com o tipo, e o primeiro insight fecha o tempo uma única vez', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'drawer' }));
    expect(chamada('gestor_drawer_aberto')!.data).toEqual({ tipo: 'aluno' });

    const tempo = chamada('gestor_tempo_ate_primeiro_insight')!;
    expect(tempo.category).toBe('performance');
    expect(typeof tempo.data.ms).toBe('number');
    expect(tempo.data.ms as number).toBeGreaterThanOrEqual(0);

    await user.click(screen.getByRole('button', { name: 'drawer' }));
    const vezes = trackEvent.mock.calls.filter((c) => c[0].eventName === 'gestor_tempo_ate_primeiro_insight');
    expect(vezes, 'o tempo até o primeiro insight é medido UMA vez por sessão de tela').toHaveLength(1);
  });

  it('gestor_export_solicitado e gestor_erro_bloco disparam com as propriedades da §10', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'export' }));
    await user.click(screen.getByRole('button', { name: 'erro' }));
    expect(chamada('gestor_export_solicitado')!.data).toEqual({ escopo: 'detalhamento' });
    expect(chamada('gestor_erro_bloco')).toEqual({
      eventName: 'gestor_erro_bloco',
      category: 'error',
      data: { bloco: 'evolucao', codigo: 'permissao_negada' },
    });
  });

  it('são exatamente os 7 eventos da §10 — nenhum a mais', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    for (const nome of ['filtro', 'modo', 'drawer', 'export', 'erro']) {
      await user.click(screen.getByRole('button', { name: nome }));
    }
    const nomes = new Set(trackEvent.mock.calls.map((c) => c[0].eventName));
    expect([...nomes].sort()).toEqual([
      'gestor_drawer_aberto',
      'gestor_erro_bloco',
      'gestor_export_solicitado',
      'gestor_filtro_alterado',
      'gestor_modo_grafico_alterado',
      'gestor_tela_vista',
      'gestor_tempo_ate_primeiro_insight',
    ]);
  });
});

describe('telemetria — guarda contra useAuth() sem AuthProvider (Task 60)', () => {
  /**
   * `VisaoGeral.test.tsx`/`Detalhamento.test.tsx`/`seguranca-lgpd.test.tsx`
   * renderizam as rotas do gestor sem `<AuthProvider>` nem mock de
   * `@/contexts/AuthContext`/`@/hooks/useAnalyticsTracker` — confirmado
   * empiricamente que, sem a guarda de `useTelemetriaGestor`, isso derruba as
   * 3 suítes com "useAuth must be used within an AuthProvider". Aqui
   * simulamos exatamente esse throw pelo mock (em vez de depender de um
   * `AuthContext.Provider` real, que nem sempre está disponível — ver
   * `Inicio.test.tsx`, que mocka `@/contexts/AuthContext` só com `useAuth`,
   * sem o objeto `AuthContext`) para travar o comportamento da guarda em
   * isolamento.
   */
  it('absorve especificamente o erro "useAuth must be used within an AuthProvider" e cai no no-op, sem lançar', () => {
    // `mockImplementation` (não `Once`): o React re-invoca o render de um
    // componente que lança (uma vez, em DEV) antes de tratar o erro como
    // fatal — com `Once` a segunda tentativa cairia na implementação padrão
    // (segura) do `beforeEach` e o teste passaria por um motivo errado.
    analyticsTrackerFactory.mockImplementation(() => {
      throw new Error('useAuth must be used within an AuthProvider. Make sure the component is wrapped in <AuthProvider>.');
    });
    expect(() => render(<Sonda />)).not.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'filtro' })).toBeInTheDocument();
  });

  it('NÃO absorve outros erros — um throw sem relação com AuthProvider continua subindo até o error boundary mais próximo', () => {
    analyticsTrackerFactory.mockImplementation(() => {
      throw new Error('erro genuinamente inesperado, sem relação com auth');
    });
    // `render()` do RTL não relança o erro do componente pro chamador (React
    // só loga via console.error sem boundary) — por isso a prova de que o
    // erro NÃO foi engolido pela guarda é um boundary local capturando-o.
    render(
      <SondaComBoundary>
        <Sonda />
      </SondaComBoundary>,
    );
    expect(screen.getByTestId('erro-capturado')).toHaveTextContent('erro genuinamente inesperado');
  });

  it('no caminho feliz (useAnalyticsTracker funciona normalmente) os eventos saem sem interferência da guarda', () => {
    render(<Sonda />);
    expect(analyticsTrackerFactory).toHaveBeenCalled();
    expect(chamada('gestor_tela_vista')).toBeDefined();
  });
});

describe('telemetria — nenhuma identificação individual (§7.7, §10, contorno da Task 60)', () => {
  it('sanitizarProps remove toda chave identificável — inclusive id de aluno: o contorno da Task 60 só permite id de IES/semestre/simulado', () => {
    const limpo = sanitizarProps({
      tela: 'visao_geral',
      nome: 'Ana Souza',
      nome_completo: 'Ana Souza',
      aluno_nome: 'Ana',
      nomeAluno: 'Ana',
      alunoNome: 'Ana',
      email: 'ana@x.com',
      e_mail: 'ana@x.com',
      matricula: '2020123',
      cpf: '00011122233',
      telefone: '11999999999',
      ies_nome: 'IES Alfa',
      iesNome: 'IES Alfa',
      enunciado: 'Enunciado da questão',
      proficiencia: 72,
      aluno_id: 'uuid-do-aluno',
      alunoId: 'uuid-do-aluno',
      ies_id: 'uuid-da-ies',
      semestre: '6ano',
    });
    expect(limpo).toEqual({ tela: 'visao_geral', ies_id: 'uuid-da-ies', semestre: '6ano' });
    CHAVES_PROIBIDAS.forEach((k) => expect(Object.keys(limpo)).not.toContain(k));
  });

  it('sanitizarProps derruba valores que PARECEM e-mail, CPF ou nome completo, mesmo sob chave neutra', () => {
    const limpo = sanitizarProps({
      valor: 'ana.souza@sanar.com',
      outro: '000.111.222-33',
      chaveNeutra: 'Ana Souza',
      ok: '6ano',
    });
    expect(limpo).toEqual({ ok: '6ano' });
  });

  it('nenhum evento disparado carrega e-mail, CPF, nome completo, nem chave de identificação individual', async () => {
    render(<Sonda />);
    const user = userEvent.setup();
    for (const nome of ['filtro', 'modo', 'drawer', 'export', 'erro']) {
      await user.click(screen.getByRole('button', { name: nome }));
    }
    const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
    const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    const NOME_COMPLETO = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/;
    trackEvent.mock.calls.forEach(([ev]) => {
      const serial = JSON.stringify(ev);
      expect(serial, `evento ${ev.eventName} com e-mail`).not.toMatch(EMAIL);
      expect(serial, `evento ${ev.eventName} com CPF`).not.toMatch(CPF);
      expect(serial, `evento ${ev.eventName} com nome completo`).not.toMatch(NOME_COMPLETO);
      CHAVES_PROIBIDAS.forEach((chaveProibida) => {
        expect(serial, `evento ${ev.eventName} com chave proibida ${chaveProibida}`).not.toMatch(
          new RegExp(`"${chaveProibida}"\\s*:`),
        );
      });
      expect(ev.eventName, 'nome de evento não pode conter PII').toMatch(/^gestor_[a-z_]+$/);
    });
  });
});
