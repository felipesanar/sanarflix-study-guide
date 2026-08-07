import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { render } from '../../utils';
import { IesFeaturesBoard } from '@/components/admin/ies/IesFeaturesBoard';
import { supabase } from '@/integrations/supabase/client';
import { setIesFeatures } from '@/services/admin/iesFeatures';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/services/admin/iesFeatures', () => ({
  setIesFeatures: vi.fn().mockResolvedValue({ applied: 1 }),
}));

// Histórico fica fechado por padrão nos testes abaixo — `useAuditLog` nunca
// chega a rodar (enabled: false), então um stub simples é suficiente.
vi.mock('@/services/admin/audit', () => ({
  useAuditLog: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

// `gestao.*` seguem no catálogo mockado só para cobrir o uso genérico de
// `catalog.gestao` no dialog "Copiar de..." (soma com `catalog.aluno` pro
// diff) — o Portal do Gestor não é mais liberado por feature de IES, então
// o card não renderiza seção nenhuma para essas entradas.
const CATALOG_ROWS = [
  { key: 'gestao.enabled', experience: 'gestao', label: 'Habilitar Portal do Gestor', description: 'Master do gestor', sort_order: 100 },
  { key: 'gestao.alunos', experience: 'gestao', label: 'Alunos', description: 'Lista de alunos', sort_order: 101 },
  { key: 'gestao.insights', experience: 'gestao', label: 'Insights', description: 'Insights pedagógicos', sort_order: 102 },
  { key: 'aluno.home', experience: 'aluno', label: 'Home', description: 'Início', sort_order: 10 },
  { key: 'aluno.guia_estudos', experience: 'aluno', label: 'Guia de Estudos', description: 'Conteúdo por matéria', sort_order: 11 },
];

const IES_ROWS = [
  { id: 'ies-1', nome: 'Faculdade Alpha' },
  { id: 'ies-2', nome: 'Faculdade Beta' },
];

const FEATURES_ROWS = [
  { ies_id: 'ies-1', feature_key: 'aluno.home', enabled: true },
  { ies_id: 'ies-1', feature_key: 'gestao.enabled', enabled: true },
  { ies_id: 'ies-2', feature_key: 'gestao.enabled', enabled: false },
];

function mockSupabaseFrom() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'feature_catalog') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: CATALOG_ROWS, error: null }),
      } as any;
    }
    if (table === 'ies') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: IES_ROWS, error: null }),
      } as any;
    }
    if (table === 'ies_features') {
      return {
        select: vi.fn().mockResolvedValue({ data: FEATURES_ROWS, error: null }),
      } as any;
    }
    return {} as any;
  });
}

/** Card de uma IES pelo nome — escopo para queries dentro dele. */
function cardFor(nome: string): HTMLElement {
  return screen.getByText(nome).closest('div.rounded-xl') as HTMLElement;
}

describe('IesFeaturesBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom();
  });

  it('renderiza um card por IES só com a seção do aluno e seu contador — sem seção de gestor', async () => {
    render(<IesFeaturesBoard />);

    await waitFor(() => {
      expect(screen.getByText('Faculdade Alpha')).toBeInTheDocument();
      expect(screen.getByText('Faculdade Beta')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Experiência do Aluno').length).toBe(2);
    // Trava o resultado: Portal do Gestor não é mais liberado por feature de
    // IES, então a seção "Experiência do Gestor" não deve mais existir.
    expect(screen.queryByText('Experiência do Gestor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Habilitar Portal do Gestor')).not.toBeInTheDocument();
    const alphaCard = cardFor('Faculdade Alpha');
    // Alpha: aluno.home=true, aluno.guia_estudos=false (default) → 1/2.
    expect(within(alphaCard).getByText('1/2')).toBeInTheDocument();
  });

  it('busca filtra a lista por nome (case/acento-insensitive)', async () => {
    render(<IesFeaturesBoard />);
    await waitFor(() => screen.getByText('Faculdade Alpha'));

    fireEvent.change(screen.getByPlaceholderText('Buscar IES...'), { target: { value: 'ALPHA' } });

    await waitFor(() => {
      expect(screen.getByText('Faculdade Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Faculdade Beta')).not.toBeInTheDocument();
    });
  });

  it('togglar um switch marca pendência e habilita Salvar; salvar chama setIesFeatures com a chave certa', async () => {
    render(<IesFeaturesBoard />);
    await waitFor(() => screen.getByText('Faculdade Alpha'));

    const alphaCard = cardFor('Faculdade Alpha');
    const alunoHomeSwitch = within(alphaCard).getByLabelText('Home');
    fireEvent.click(alunoHomeSwitch);

    await waitFor(() => {
      expect(within(alphaCard).getByText(/1 alteração não salva/)).toBeInTheDocument();
    });

    const saveButton = within(alphaCard).getByRole('button', { name: /Salvar/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(setIesFeatures).toHaveBeenCalledWith('ies-1', { 'aluno.home': false });
      expect(toast.success).toHaveBeenCalled();
    });

    // Pendência é limpa após salvar com sucesso — badge some.
    await waitFor(() => {
      expect(within(alphaCard).queryByText(/alteraç(ão|ões) não salva/)).not.toBeInTheDocument();
    });
  });

  it('copiar-de: cancelar não aplica nada nem chama setIesFeatures', async () => {
    render(<IesFeaturesBoard />);
    await waitFor(() => screen.getByText('Faculdade Beta'));

    const betaCard = cardFor('Faculdade Beta');
    fireEvent.click(within(betaCard).getByRole('button', { name: /Copiar de/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Cancelar/i }));

    expect(setIesFeatures).not.toHaveBeenCalled();
  });

  it('copiar-de: aplicar grava como pendência na IES destino (nunca chama setIesFeatures)', async () => {
    // Radix Select precisa de scrollIntoView/hasPointerCapture, ausentes no jsdom.
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();

    render(<IesFeaturesBoard />);
    await waitFor(() => screen.getByText('Faculdade Beta'));

    const betaCard = cardFor('Faculdade Beta');
    fireEvent.click(within(betaCard).getByRole('button', { name: /Copiar de/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('combobox'));

    // O conteúdo do Select é portalizado no body — não fica dentro do `dialog`.
    const option = await screen.findByText('Faculdade Alpha', { selector: '[role="option"] *, [role="option"]' });
    fireEvent.click(option);

    await waitFor(() => {
      expect(within(dialog).getByText(/feature.*vão mudar/)).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Aplicar como pendências/i }));

    expect(setIesFeatures).not.toHaveBeenCalled();
    await waitFor(() => {
      // Alpha tem aluno.home + gestao.enabled ligados e Beta não → cópia gera pendências em Beta.
      expect(within(betaCard).getByText(/alteraç(ão|ões) não salva/)).toBeInTheDocument();
    });
  });
});
