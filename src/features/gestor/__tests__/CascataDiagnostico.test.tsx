// src/features/gestor/__tests__/CascataDiagnostico.test.tsx
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, within } from '@/test/utils';
import { CascataDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { useDiagnostico } from '@/features/gestor/api/queries';
import { NIVEL_CRITICO_MAX } from '@/features/gestor/lib/regras';
import type { Meta, NoDiagnostico, VisaoGeral } from '@/features/gestor/api/types';

vi.mock('@/features/gestor/api/queries', () => ({ useDiagnostico: vi.fn() }));

/**
 * Réplica local dos valores da fixture compartilhada da Fase 4
 * (`__tests__/fixtures/visaoGeral.ts`, Task 37 — de outro agente em
 * paralelo). Ainda não existe nesta working tree no momento em que este
 * arquivo foi escrito. Os valores abaixo espelham exatamente
 * `metaFake`/`visaoGeralFake.diagnosticoResumo` do plano
 * (`docs/superpowers/plans/2026-07-25-portal-gestor-v2.md`, Task 37/42),
 * então quando a fixture compartilhada pousar este arquivo pode trocar para
 * importá-la sem mudar nenhuma expectativa.
 */
const metaFake: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const diagnosticoResumoFake: VisaoGeral['diagnosticoResumo'] = [
  { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
  {
    nivel: 'mediano',
    areas: [
      { id: 'ga-cirurgia', nome: 'Cirurgia', acertoPct: 61 },
      { id: 'ga-pediatria', nome: 'Pediatria', acertoPct: 55 },
    ],
  },
  { nivel: 'critico', areas: [{ id: 'ga-clinica', nome: 'Clínica Médica', acertoPct: 27 }] },
];

/** Mesmo recorte de 27% e 61% do fixture acima, sem nenhuma área crítica — o caminho principal (§4.4: 87,9% dos recortes reais). */
const diagnosticoResumoSemCriticoFake: VisaoGeral['diagnosticoResumo'] = [
  { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
  {
    nivel: 'mediano',
    areas: [
      { id: 'ga-pediatria', nome: 'Pediatria', acertoPct: 55 },
      { id: 'ga-cirurgia', nome: 'Cirurgia', acertoPct: 61 },
      { id: 'ga-clinica', nome: 'Clínica Médica', acertoPct: 58 },
    ],
  },
  { nivel: 'critico', areas: [] },
];

/** Recorte-limite: crítico E mediano vazios (só há área excelente). */
const diagnosticoResumoSoExcelenteFake: VisaoGeral['diagnosticoResumo'] = [
  { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
  { nivel: 'mediano', areas: [] },
  { nivel: 'critico', areas: [] },
];

/**
 * Achado 1: os 3 grupos SEMPRE chegam da RPC (`VALUES ('critico',1),
 * ('mediano',2),('excelente',3)` incondicional), mesmo quando não há
 * nenhuma resposta no recorte — `areas` vira `[]` nos três. Semântica
 * diferente de "grupo crítico vazio" (caminho principal, só o crítico sem
 * área): aqui NENHUM grupo tem área, ou seja, não houve classificação
 * nenhuma — ausência de dado, não um resultado.
 */
const diagnosticoResumoVazioFake: VisaoGeral['diagnosticoResumo'] = [
  { nivel: 'excelente', areas: [] },
  { nivel: 'mediano', areas: [] },
  { nivel: 'critico', areas: [] },
];

const grandesAreas: NoDiagnostico[] = [
  { id: 'ga-clinica', nome: 'Clínica Médica', nivel: 'grande_area', acertoPct: 27, desempenho: 'critico', amostra: 118, lowSample: false, temFilhos: true },
  { id: 'ga-cirurgia', nome: 'Cirurgia', nivel: 'grande_area', acertoPct: 61, desempenho: 'mediano', amostra: 118, lowSample: false, temFilhos: true },
];

const especialidadesClinica: NoDiagnostico[] = [
  { id: 'esp-cardio', nome: 'Cardiologia', nivel: 'especialidade', acertoPct: 24, desempenho: 'critico', amostra: 8, lowSample: true, temFilhos: true },
  { id: 'esp-pneumo', nome: 'Pneumologia', nivel: 'especialidade', acertoPct: 31, desempenho: 'mediano', amostra: 110, lowSample: false, temFilhos: true },
];

const recorte = { iesId: 'ies-1', semestre: '6ano' as const };
const mockUseDiagnostico = vi.mocked(useDiagnostico);

/** Formato real de `ResultadoGestor<T>` (api/queries.ts) — `data` já vem desembrulhado do envelope, sem aninhar de novo. */
function envelope(dados: NoDiagnostico[]) {
  return { data: dados, meta: metaFake, isLoading: false, isError: false, refetch: vi.fn() };
}

describe('CascataDiagnostico', () => {
  beforeEach(() => {
    mockUseDiagnostico.mockImplementation(((_f: unknown, node: string | null) =>
      envelope(node === null ? grandesAreas : especialidadesClinica)) as unknown as typeof useDiagnostico);
  });

  it('mostra os 3 grupos por nível com chips de área', () => {
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(screen.getByText('Excelente')).toBeInTheDocument();
    expect(screen.getByText('Mediano')).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByTestId('chip-ga-clinica')).toHaveTextContent('Clínica Médica');
    expect(screen.getByTestId('chip-ga-clinica')).toHaveTextContent('27%');
  });

  it('não renderiza os links removidos em 22/07', () => {
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(screen.queryByText(/Ver alunos em TRI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Explorar diagnóstico/i)).not.toBeInTheDocument();
  });

  it('só busca a cascata depois de abrir: nenhuma chamada de nível raiz antes do clique', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(mockUseDiagnostico).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    expect(mockUseDiagnostico).toHaveBeenCalledWith(
      { iesId: recorte.iesId, semestre: recorte.semestre, simulados: [] },
      null,
    );
  });

  it('a seta divide o grid em dois e a cascata aparece AO LADO, não em drawer', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    expect(screen.getByTestId('diagnostico-grid')).toHaveAttribute('data-dividido', 'true');
    expect(screen.getByTestId('cascata')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('expande a especialidade no lugar, é accordion exclusivo e o segundo clique recolhe', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));

    const clinica = screen.getByRole('button', { name: /Clínica Médica/ });
    await user.click(clinica);
    expect(clinica).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('filhos-ga-clinica')).toBeInTheDocument();

    // exclusivo: abrir Cirurgia fecha Clínica Médica
    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(screen.queryByTestId('filhos-ga-clinica')).not.toBeInTheDocument();
    expect(screen.getByTestId('filhos-ga-cirurgia')).toBeInTheDocument();

    // segundo clique recolhe
    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(screen.queryByTestId('filhos-ga-cirurgia')).not.toBeInTheDocument();
  });

  it('a cascata para no 2º nível: a especialidade abre o drawer de temas, repassando a grande área do nó pai', async () => {
    const user = userEvent.setup();
    const onAbrirTemas = vi.fn();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={onAbrirTemas} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));

    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));
    // PROVA da correção: a grande área repassada é o nó pai que originou o
    // clique ('ga-clinica', o `id` de Clínica Médica) — nunca `undefined` nem
    // string vazia. Um placeholder vazio (o bug original) faria esta
    // asserção falhar.
    expect(onAbrirTemas).toHaveBeenCalledWith({ id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'ga-clinica' });
    expect(screen.queryByTestId('filhos-esp-cardio')).not.toBeInTheDocument();
  });

  it('a grande área repassada é a do ramo aberto, não uma constante: Cirurgia e Clínica Médica produzem valores diferentes', async () => {
    const user = userEvent.setup();
    const onAbrirTemas = vi.fn();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={onAbrirTemas} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));

    // Mesmo mock devolve os mesmos nós de especialidade para qualquer grande
    // área expandida (ver beforeEach) — o que muda é só `node` (o pai), então
    // abrir Cirurgia em vez de Clínica Médica tem que mudar a grande área
    // repassada, provando que não é um valor fixo/hardcoded.
    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));
    expect(onAbrirTemas).toHaveBeenLastCalledWith({
      id: 'esp-cardio',
      nome: 'Cardiologia',
      grandeArea: 'ga-cirurgia',
    });
  });

  it('marca cobertura parcial com o n da amostra quando lowSample', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={diagnosticoResumoFake} recorte={recorte} onAbrirTemas={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));

    const cardio = screen.getByRole('button', { name: /Cardiologia/ });
    expect(cardio).toHaveTextContent('cobertura parcial');
    expect(cardio.querySelector('[data-testid="amostra-esp-cardio"]')).toHaveTextContent('n = 8');
  });

  /**
   * §4.4/regras.ts: NIVEL_CRITICO_MAX = 30 deixa o grupo crítico vazio em
   * 87,9% dos recortes reais (100% descontada a IES de teste) — é o CAMINHO
   * PRINCIPAL desta tela, não uma borda. O vazio precisa dizer o que
   * aconteceu (com o número vindo de regras.ts) e apontar por onde começar
   * (as áreas medianas, da pior para a melhor) — nunca ficar em branco nem
   * sumir da tela.
   */
  describe('grupo crítico vazio — caminho principal (§4.4, 87,9% dos recortes)', () => {
    it('não esconde a seção: continua mostrando os 3 grupos, com Crítico presente e vazio', () => {
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSemCriticoFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      expect(screen.getByText('Excelente')).toBeInTheDocument();
      expect(screen.getByText('Mediano')).toBeInTheDocument();
      expect(screen.getByText('Crítico')).toBeInTheDocument();
    });

    it('explica o que aconteceu usando o corte de regras.ts, não um número escrito na mão', () => {
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSemCriticoFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      const vazio = screen.getByTestId('diagnostico-critico-vazio');
      expect(vazio).toHaveTextContent(`${NIVEL_CRITICO_MAX}%`);
      expect(within(vazio).queryByText('0%')).not.toBeInTheDocument();
    });

    it('aponta por onde começar: lista as áreas medianas ordenadas da pior para a melhor', () => {
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSemCriticoFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      const sugestao = screen.getByTestId('sugestao-mediano');
      const nomes = within(sugestao)
        .getAllByRole('listitem')
        .map((item) => item.textContent);

      expect(nomes[0]).toContain('Pediatria');
      expect(nomes[0]).toContain('55%');
      expect(nomes[1]).toContain('Clínica Médica');
      expect(nomes[2]).toContain('Cirurgia');
    });

    it('sem nenhuma área mediana também, não quebra e não inventa sugestão', () => {
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSoExcelenteFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      expect(screen.getByTestId('diagnostico-critico-vazio')).toBeInTheDocument();
      expect(screen.queryByTestId('sugestao-mediano')).not.toBeInTheDocument();
    });

    it('a cascata continua abrindo pelo card crítico mesmo com o resumo vazio — vazio não é erro', async () => {
      const user = userEvent.setup();
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSemCriticoFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
      expect(screen.getByTestId('cascata')).toBeInTheDocument();
    });
  });

  /**
   * Achado 1 (revisão de 03/08): recorte sem NENHUMA área classificada
   * (nenhum aluno respondeu simulado no recorte) não pode ser apresentado
   * com as mesmas três frases de resultado do caminho principal — a
   * coordenadora leria ausência de dado como ausência de área crítica.
   */
  describe('nenhum grupo classificado — ausência de dado, não resultado (achado 1)', () => {
    it('mostra um único estado de ausência de dado para a seção inteira, não os 3 cards de resultado', () => {
      render(<CascataDiagnostico resumo={diagnosticoResumoVazioFake} recorte={recorte} onAbrirTemas={vi.fn()} />);

      expect(screen.getByTestId('diagnostico-sem-classificacao')).toBeInTheDocument();
      expect(screen.queryByTestId('diagnostico-grid')).not.toBeInTheDocument();
    });

    it('não reaproveita nenhuma das 3 frases de resultado (nem a do card crítico vazio)', () => {
      render(<CascataDiagnostico resumo={diagnosticoResumoVazioFake} recorte={recorte} onAbrirTemas={vi.fn()} />);

      expect(screen.queryByTestId('diagnostico-critico-vazio')).not.toBeInTheDocument();
      expect(
        screen.queryByText(`Nenhuma área abaixo de ${NIVEL_CRITICO_MAX}% de acerto neste recorte`),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Nenhuma área em excelência neste recorte')).not.toBeInTheDocument();
      expect(screen.queryByText('Nenhuma área com desempenho mediano neste recorte')).not.toBeInTheDocument();
    });

    it('o card crítico vazio (caminho principal) continua intacto quando SÓ o crítico está vazio', () => {
      // Regressão: o achado é sobre os TRÊS grupos vazios, nunca sobre o
      // caminho principal (crítico vazio com mediano/excelente presentes).
      render(
        <CascataDiagnostico resumo={diagnosticoResumoSemCriticoFake} recorte={recorte} onAbrirTemas={vi.fn()} />,
      );
      expect(screen.queryByTestId('diagnostico-sem-classificacao')).not.toBeInTheDocument();
      expect(screen.getByTestId('diagnostico-critico-vazio')).toBeInTheDocument();
    });
  });
});
