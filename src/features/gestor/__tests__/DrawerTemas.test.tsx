// src/features/gestor/__tests__/DrawerTemas.test.tsx
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/utils';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';
import { useDiagnosticoTemas, useGestorContexto } from '@/features/gestor/api/queries';
import type { Meta, TemaCritico } from '@/features/gestor/api/types';

vi.mock('@/features/gestor/api/queries', () => ({
  useDiagnosticoTemas: vi.fn(),
  // O rodapé de ações é o `AcoesRecorte` (Task 45b), que lê `podeExportar` do
  // contexto resolvido no SERVIDOR — por isso o mock do módulo precisa expor
  // este hook também.
  useGestorContexto: vi.fn(),
}));

/**
 * Réplica local do formato de `metaFake` da fixture compartilhada da Fase 4
 * (`__tests__/fixtures/visaoGeral.ts`, Task 37, de outro agente em paralelo
 * — ainda não existe nesta working tree). Mesmo padrão já usado em
 * CascataDiagnostico.test.tsx/DrawerAluno.test.tsx para o mesmo motivo.
 */
const metaFake: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const temas: TemaCritico[] = [
  { id: 'tema-ic', nome: 'Insuficiência cardíaca', acertoPct: 22, amostra: 118, respostas: 944, lowSample: false },
  { id: 'tema-arritmia', nome: 'Arritmias', acertoPct: 41, amostra: 7, respostas: 56, lowSample: true },
];

const recorte = { iesId: 'ies-1', semestre: '6ano' as const };

/**
 * `CascataDiagnostico.onAbrirTemas` (Task 42, já em produção nesta working
 * tree — não editado por esta task) emite apenas `{ id, nome }` da
 * especialidade clicada (ver CascataDiagnostico.test.tsx, "a cascata para no
 * 2º nível"). `grandeArea` é a grande área do NÓ PAI que originou aquele
 * clique — quem compuser esta tela junto com `CascataDiagnostico` precisa
 * capturar esse dado por fora e enriquecer o objeto antes de passá-lo para
 * `DrawerTemas` (ver pendências do componente). Aqui simulamos exatamente
 * esse objeto já enriquecido, como um caller correto deve montar.
 */
const especialidade = { id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'Clínica Médica' };

const mockUseTemas = vi.mocked(useDiagnosticoTemas);
const mockUseContexto = vi.mocked(useGestorContexto);

/**
 * Contexto do gestor com a capability de export JÁ RESOLVIDA pelo servidor
 * (`get_gestor_contexto`) — nenhuma role é lida no cliente. O nome da IES não
 * contém "aluno" de propósito: o teste de "Copiar resumo" abaixo assegura que
 * o texto copiado nunca traz lista nominal (§7.7).
 *
 * `iesDisponiveis` é obrigatório: `AcoesRecorte` resolve o nome da IES do
 * RECORTE contra essa lista (`iesDisponiveis.find(...)`), porque `iesAtual` é a
 * IES de CADASTRO do usuário e não acompanha a troca no dropdown. Em produção
 * `get_gestor_contexto()` sempre popula a lista (migration 20260804130200) —
 * omiti-la aqui era um mock impossível, que explodia em `.find` de `undefined`.
 */
const contextoComExport = (podeExportar: boolean) =>
  ({
    data: {
      iesAtual: { id: 'ies-1', nome: 'Universidade Teste' },
      iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade Teste' }],
      podeExportar,
    },
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }) as unknown as ReturnType<typeof useGestorContexto>;

/**
 * `ResultadoGestor<T>` (api/queries.ts) já desembrulha o envelope: `data` é
 * `T | undefined` direto, nunca `{ data, meta }` aninhado — mesma correção
 * de formato já aplicada em CascataDiagnostico.test.tsx/DrawerAluno.test.tsx
 * contra o exemplo desatualizado do plano.
 */
const resultado = (over: Record<string, unknown> = {}) => ({
  data: temas,
  meta: metaFake,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

beforeEach(() => {
  mockUseTemas.mockReturnValue(resultado() as unknown as ReturnType<typeof useDiagnosticoTemas>);
  mockUseContexto.mockReturnValue(contextoComExport(true));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DrawerTemas', () => {
  it('não renderiza nada sem especialidade selecionada', () => {
    render(<DrawerTemas especialidade={null} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lista os temas com % de acerto e barra proporcional', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAccessibleName(/Temas de Cardiologia/i);

    const linha = screen.getByTestId('tema-tema-ic');
    expect(linha).toHaveTextContent('Insuficiência cardíaca');
    expect(linha).toHaveTextContent('22%');
    expect(linha.querySelector('[data-testid="barra-tema-ic"]')).toHaveAttribute('aria-valuenow', '22');
  });

  it('marca cobertura parcial no tema com amostra pequena', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.getByTestId('tema-tema-arritmia')).toHaveTextContent('cobertura parcial');
  });

  /**
   * §10.7: a amostra é contexto de TODO tema, não só do de baixa cobertura —
   * sem ela o gestor não sabe sobre quantas respostas o percentual foi
   * calculado. E o `n` vive fora da pílula, como metadado da linha.
   */
  it('mostra a amostra de todo tema, não só do de cobertura parcial', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.getByTestId('amostra-tema-ic')).toHaveTextContent('944 respostas');
    expect(screen.getByTestId('amostra-tema-arritmia')).toHaveTextContent('56 respostas');
  });

  /**
   * §10.7: a barra codifica o nível pela MESMA régua da cascata
   * (`lib/regras.ts`), e recua para o tom neutro quando a amostra é pequena —
   * a cor não deve gritar severidade onde não se deve confiar no valor.
   */
  it('a barra do tema é tintada por nível, com tom neutro na baixa amostra', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);

    // 22% de acerto: abaixo do corte crítico de regras.ts.
    const critico = screen.getByTestId('barra-tema-ic').firstElementChild as HTMLElement;
    expect(critico.style.background).toBe('var(--gp-danger)');

    // 41% seria "mediano", mas o tema tem lowSample: recua para o neutro.
    const baixaAmostra = screen.getByTestId('barra-tema-arritmia').firstElementChild as HTMLElement;
    expect(baixaAmostra.style.background).toBe('var(--gp-text-3)');
  });

  /**
   * §10.7: cabeçalho em dois níveis. A grande área já chega na prop (é ela
   * que desambigua duas especialidades homônimas) e precisa aparecer — mas o
   * NOME ACESSÍVEL do diálogo continua carregando a frase inteira.
   */
  it('mostra a grande área como sobrelinha do título', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const titulo = screen.getByRole('dialog').querySelector('h2');
    expect(titulo).toHaveTextContent('Clínica Médica');
    expect(titulo).toHaveTextContent('Cardiologia');
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Temas de Cardiologia/i);
  });

  it('declara a proveniência do recorte a partir do meta do envelope, nunca de texto fixo', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const proveniencia = screen.getByTestId('temas-proveniencia');
    expect(proveniencia).toHaveTextContent(metaFake.periodo);
    expect(proveniencia).toHaveTextContent(metaFake.fonte);
  });

  it('prende o foco dentro do drawer ao abrir', async () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    await waitFor(() => expect(dialogo).toContainElement(document.activeElement as HTMLElement));
  });

  /** §11: "Foco vai para o TÍTULO ao abrir" — não para o primeiro botão do rodapé. */
  it('leva o foco ao título ao abrir, não ao primeiro controle do conteúdo', async () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const titulo = screen.getByRole('dialog').querySelector('h2') as HTMLElement;
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('fecha com ESC', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={onFechar} onExportarRecorte={vi.fn()} />);

    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  /**
   * O drawer é do PORTAL: nenhum glifo de outra família (handoff §3, 100%
   * Fontello do Dendê), nada em inglês (docs/11-acessibilidade.md) e o scrim
   * pelo token de tema. Sem as props de slot, o `SheetContent` entrega o `X`
   * do Lucide anunciando "Close" sobre um `bg-black/80` que ignora o tema.
   */
  it('o fechar é do Dendê, anuncia "Fechar" e o scrim usa o token do portal', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);

    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    // Alvo de 30×30 com borda e raio 8px (handoff §4.5).
    expect(fechar.className).toContain('h-[30px]');
    expect(fechar.className).toContain('w-[30px]');
    expect(fechar.className).toContain('rounded-[8px]');

    const scrim = screen.getByRole('dialog').parentElement?.querySelector('div.fixed.inset-0');
    expect(scrim?.className).toContain('bg-[var(--gp-scrim)]');
    expect(scrim?.className).not.toContain('bg-black/80');
  });

  it('fecha ao clicar no scrim', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={onFechar} onExportarRecorte={vi.fn()} />);

    const scrim = screen.getByRole('dialog').parentElement?.querySelector('div.fixed.inset-0');
    expect(scrim).not.toBeNull();
    await user.click(scrim as HTMLElement);
    expect(onFechar).toHaveBeenCalled();
  });

  it('exporta o recorte identificando a especialidade', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExportarRecorte = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={onExportarRecorte} />);

    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(onExportarRecorte).toHaveBeenCalledWith('especialidade:esp-cardio');
  });

  it('copia resumo agregado, sem lista nominal de aluno', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const texto = writeText.mock.calls[0][0] as string;
    expect(texto).toContain('Cardiologia');
    expect(texto).toContain('Insuficiência cardíaca: 22%');
    expect(texto).not.toMatch(/aluno/i);
  });

  /**
   * Task 46.5 (QA de fim de fase) — defeito de contrato entre duas peças da
   * Fase 4: a Task 45b criou `AcoesRecorte` justamente para que "Exportar
   * recorte" e "Copiar resumo" fiquem AUSENTES (não desabilitados) quando o
   * servidor diz que a IES não pode exportar. `DrawerTemas` tinha os dois
   * botões escritos à mão, sem gate nenhum — anunciando ao gestor uma
   * funcionalidade que a IES não contratou.
   */
  it('não renderiza nenhuma ação de recorte quando o servidor diz que não pode exportar', () => {
    mockUseContexto.mockReturnValue(contextoComExport(false));

    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);

    // A lista de temas continua visível — o gate é só das ações.
    expect(screen.getByTestId('tema-tema-ic')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar recorte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar resumo' })).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando a especialidade não tem tema com dado', () => {
    mockUseTemas.mockReturnValue(resultado({ data: [] }) as unknown as ReturnType<typeof useDiagnosticoTemas>);

    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.getByTestId('temas-vazio')).toHaveTextContent('Sem temas com resultado neste recorte');
  });

  describe('estados de carregamento e erro', () => {
    it('loading: mostra skeleton acessível, sem tema ainda', () => {
      mockUseTemas.mockReturnValue(resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useDiagnosticoTemas>);
      render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('tema-tema-ic')).not.toBeInTheDocument();
    });

    it('erro: mensagem com retry que refaz só esta consulta', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockUseTemas.mockReturnValue(
        resultado({ data: undefined, isError: true, refetch }) as unknown as ReturnType<typeof useDiagnosticoTemas>,
      );
      render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * CUIDADO da revisão (achado 11/115, migrations 20260804132000 e
   * 20260804163000): `get_gestor_diagnostico_temas` agora EXIGE
   * `p_grande_area` — sem ela a RPC somaria temas de duas grandes áreas
   * diferentes que tenham especialidade com o mesmo nome, e o total
   * contradiria o percentual mostrado um nível acima na cascata. A "grande
   * área do nó pai" tem que chegar ao hook sempre, nunca `null`.
   */
  describe('grande área de origem chega até a RPC de temas', () => {
    it('passa iesId/semestre, o id da especialidade e a grande área do nó pai — nunca omite p_grande_area', () => {
      render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);

      expect(mockUseTemas).toHaveBeenCalledWith(
        { iesId: 'ies-1', semestre: '6ano', simulados: [] },
        'esp-cardio',
        'Clínica Médica',
      );
    });

    it('duas especialidades homônimas em grandes áreas diferentes nunca compartilham a mesma chamada', () => {
      const { rerender } = render(
        <DrawerTemas
          especialidade={{ id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'Clínica Médica' }}
          recorte={recorte}
          onFechar={vi.fn()}
          onExportarRecorte={vi.fn()}
        />,
      );
      expect(mockUseTemas).toHaveBeenLastCalledWith(expect.anything(), 'esp-cardio', 'Clínica Médica');

      rerender(
        <DrawerTemas
          especialidade={{ id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'Cirurgia' }}
          recorte={recorte}
          onFechar={vi.fn()}
          onExportarRecorte={vi.fn()}
        />,
      );
      expect(mockUseTemas).toHaveBeenLastCalledWith(expect.anything(), 'esp-cardio', 'Cirurgia');
    });
  });
});
