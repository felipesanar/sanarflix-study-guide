import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { pagina } from './fixtures';
import type { Leitura } from '../types';

const api = vi.hoisted(() => ({
  listarSimulados: vi.fn(),
  listarLeituras: vi.fn(),
  obterLeitura: vi.fn(),
  enviarLeitura: vi.fn(),
  iniciarLeitura: vi.fn(),
  listarPaginas: vi.fn(),
  revisarPagina: vi.fn(),
  marcarImportada: vi.fn(),
  urlsAssinadas: vi.fn(),
  apagarArquivos: vi.fn(),
  excluirLeitura: vi.fn(),
}));
const imp = vi.hoisted(() => ({ previewImportacao: vi.fn(), executarImportacao: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/features/cartoes/leitura/api', async (original) => ({
  ...(await original<typeof import('@/features/cartoes/leitura/api')>()),
  ...api,
}));
vi.mock('@/components/admin/simulados/importar-respostas-api', async (original) => ({
  ...(await original<typeof import('@/components/admin/simulados/importar-respostas-api')>()),
  ...imp,
}));
vi.mock('sonner', () => ({ toast }));

import LeituraCartoesTab from '@/components/admin/simulados/LeituraCartoesTab';

const SIM = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
const leitura = (extra: Partial<Leitura> = {}): Leitura => ({
  id: 'L1', simulado_id: SIM, arquivo_nome: 'turma-a.pdf', arquivo_bytes: 1024, total_questoes: 3,
  status: 'concluido', criado_por: 'u', created_at: '2026-11-25T12:00:00Z', disparado_em: null, iniciado_em: null,
  concluido_em: null, github_run_url: null, erro: null, import_batch_id: null, importado_em: null, arquivos_apagados_em: null,
  resumo: { paginas: 2, identificadas: 1, nao_identificadas: 1, em_branco: 0, ilegiveis: 0, simulado_divergente: 0, pendencias: 1 },
  ...extra,
});

// Radix Select no jsdom
Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.releasePointerCapture ??= vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  api.listarSimulados.mockResolvedValue([{ id: SIM, nome: 'SIMULADO ENAMED', total_questoes: 3 }]);
  api.urlsAssinadas.mockResolvedValue({});
  api.revisarPagina.mockResolvedValue(undefined);
});

describe('Leitura de cartões: lista', () => {
  it('mostra as leituras com situação e ações conforme o status', async () => {
    api.listarLeituras.mockResolvedValue([
      leitura(),
      leitura({ id: 'L2', status: 'falhou', resumo: null, erro: 'RuntimeError: pdf corrompido' }),
      leitura({ id: 'L3', status: 'processando', resumo: null }),
    ]);
    render(<LeituraCartoesTab />);
    const linhas = await screen.findAllByRole('row');
    expect(linhas).toHaveLength(4);
    expect(within(linhas[1]).getByText('Para revisar')).toBeInTheDocument();
    expect(within(linhas[1]).getByRole('button', { name: 'Revisar' })).toBeInTheDocument();
    expect(within(linhas[2]).getByText(/pdf corrompido/)).toBeInTheDocument();

    api.iniciarLeitura.mockResolvedValue(undefined);
    fireEvent.click(within(linhas[2]).getByRole('button', { name: /Ler de novo/ }));
    await waitFor(() => expect(api.iniciarLeitura).toHaveBeenCalledWith('L2'));
    expect(within(linhas[3]).getByText('Lendo…')).toBeInTheDocument();
  });

  it('excluir pede confirmação e apaga a leitura; importada só oferece apagar os arquivos', async () => {
    api.listarLeituras.mockResolvedValue([
      leitura({ id: 'L1', arquivo_nome: 'errado.pdf', status: 'concluido' }),
      leitura({ id: 'L2', arquivo_nome: 'ok.pdf', status: 'importado', import_batch_id: 'B' }),
      leitura({ id: 'L3', arquivo_nome: 'lendo.pdf', status: 'processando', resumo: null }),
    ]);
    api.excluirLeitura.mockResolvedValue(undefined);
    api.apagarArquivos.mockResolvedValue(4);
    render(<LeituraCartoesTab />);
    const linhas = await screen.findAllByRole('row');
    expect(within(linhas[2]).queryByRole('button', { name: /Excluir a leitura/ })).toBeNull();
    expect(within(linhas[3]).queryByRole('button', { name: /Excluir a leitura|Apagar arquivos/ })).toBeNull();

    fireEvent.click(within(linhas[1]).getByRole('button', { name: 'Excluir a leitura errado.pdf' }));
    expect(await screen.findByText('Excluir esta leitura?')).toBeInTheDocument();
    expect(api.excluirLeitura).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.excluirLeitura).toHaveBeenCalledWith('L1'));

    fireEvent.click(within((await screen.findAllByRole('row'))[2]).getByRole('button', { name: /Apagar arquivos/ }));
    expect(await screen.findByText('Apagar o PDF e as imagens?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar arquivos' }));
    await waitFor(() => expect(api.apagarArquivos).toHaveBeenCalledWith('L2'));
  });

  it('só envia com simulado e PDF', async () => {
    api.listarLeituras.mockResolvedValue([]);
    render(<LeituraCartoesTab />);
    expect(await screen.findByText('Nenhuma leitura ainda')).toBeInTheDocument();
    const enviar = screen.getByRole('button', { name: /Enviar e ler/ });
    expect(enviar).toBeDisabled();
    const input = screen.getByLabelText('PDF escaneado');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notas.xlsx', { type: 'application/vnd.ms-excel' })] } });
    expect(toast.error).toHaveBeenCalledWith('Envie o PDF escaneado dos cartões');
  });

  it('PDF enviado mas o disparo falhou: avisa que a leitura não começou', async () => {
    api.listarLeituras.mockResolvedValue([]);
    api.enviarLeitura.mockResolvedValue('L9');
    api.iniciarLeitura.mockRejectedValue(new Error('não consegui iniciar a leitura: GITHUB_DISPATCH_TOKEN ausente'));
    render(<LeituraCartoesTab />);
    await screen.findByText('Nenhuma leitura ainda');
    fireEvent.click(screen.getByRole('combobox', { name: 'Simulado' }));
    fireEvent.click(await screen.findByRole('option', { name: /SIMULADO ENAMED/ }));
    fireEvent.change(screen.getByLabelText('PDF escaneado'), {
      target: { files: [new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar e ler/ }));
    await waitFor(() => expect(api.iniciarLeitura).toHaveBeenCalledWith('L9'));
    expect(toast.error).toHaveBeenCalledWith('PDF enviado, mas a leitura não começou', expect.anything());
  });
});

describe('Leitura de cartões: revisão', () => {
  async function abrir(paginas: ReturnType<typeof pagina>[], l = leitura()) {
    api.listarLeituras.mockResolvedValue([l]);
    api.obterLeitura.mockResolvedValue(l);
    api.listarPaginas.mockResolvedValue(paginas);
    render(<LeituraCartoesTab />);
    fireEvent.click(await screen.findByRole('button', { name: l.status === 'importado' ? 'Ver' : 'Revisar' }));
    await screen.findByRole('tablist', { name: 'Filtro de páginas' });
  }

  it('o genérico bloqueia a importação até confirmar a matrícula, que é gravada na hora', async () => {
    const ok = pagina({ identificacao: '2023001' });
    const gen = pagina({ destino: 'nao_identificados', identificacao: null, motivo: 'cartao_generico' });
    await abrir([ok, gen]);

    const botao = screen.getByRole('button', { name: /Pré-visualizar importação \(1 aluno\)/ });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/Resolva antes as páginas não identificadas/)).toBeInTheDocument();

    const card = screen.getByTestId(`pagina-${gen.pagina}`);
    expect(within(card).getByText(/Cartão genérico/)).toBeInTheDocument();
    fireEvent.change(within(card).getByLabelText(/Matrícula\/RA ou e-mail/), { target: { value: '2024777' } });
    fireEvent.click(within(card).getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(api.revisarPagina).toHaveBeenCalledWith(gen.id, { identificacao_manual: '2024777' }));

    expect(await screen.findByRole('button', { name: /Pré-visualizar importação \(2 alunos\)/ })).toBeEnabled();
  });

  it('decide uma marcação múltipla e importa pelo dry-run de sempre, marcando a leitura como importada', async () => {
    const pg = pagina({ identificacao: '2023001', duvidas: { '2': 'multipla' }, respostas: { '1': 'A', '2': null, '3': 'C' } });
    await abrir([pg]);
    fireEvent.click(screen.getByRole('button', { name: 'Questão 2: D' }));
    await waitFor(() => expect(api.revisarPagina).toHaveBeenCalledWith(pg.id, { respostas_manual: { '2': 'D' } }));

    imp.previewImportacao.mockResolvedValue({
      results: [{ matricula_ra: '2023001', status: 'preview_ok' }],
      summary: { total: 1, ok: 1, warning: 0, error: 0, already_finalized: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: /Pré-visualizar importação \(1 aluno\)/ }));
    await waitFor(() => expect(imp.previewImportacao).toHaveBeenCalled());
    expect(imp.previewImportacao.mock.calls[0][0]).toMatchObject({
      simuladoId: SIM,
      rows: [{ pagina: pg.pagina, matricula_ra: '2023001', answers: { '1': 'A', '2': 'D', '3': 'C' } }],
    });

    imp.executarImportacao.mockResolvedValue({
      report: { batch_id: 'B9', summary: { total: 1, imported: 1, skipped: 0, replaced: 0, failed: 0 }, results: [] },
      cancelled: false,
    });
    api.marcarImportada.mockResolvedValue(undefined);
    api.apagarArquivos.mockResolvedValue(3);
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar importação/ }));
    const confirmar = await screen.findByRole('textbox');
    fireEvent.change(confirmar, { target: { value: 'IMPORTAR' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Importar|Confirmar/ }).at(-1)!);
    await waitFor(() => expect(api.marcarImportada).toHaveBeenCalledWith('L1', 'B9'));
    await waitFor(() => expect(api.apagarArquivos).toHaveBeenCalledWith('L1'));
  });

  it('leitura já importada fica só para consulta', async () => {
    const gen = pagina({ destino: 'nao_identificados', identificacao: null, motivo: 'cartao_generico', identificacao_manual: '1' });
    await abrir([gen], leitura({ status: 'importado', import_batch_id: 'B1' }));
    expect(screen.getByText(/Leitura já importada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Todas' }));
    const card = screen.getByTestId(`pagina-${gen.pagina}`);
    expect(within(card).getByRole('button', { name: /Descartar/ })).toBeDisabled();
  });
});
