import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CronogramaSimulados,
  proximoSimulado,
  resumoCronograma,
  rotuloVigenciaContrato,
  MSG_AGENDAR,
  MSG_CONSULTOR,
  WHATSAPP_SANAR,
} from '@/features/gestor/components/CronogramaSimulados';
import type { ItemCronograma, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({ useCronograma: vi.fn() }));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: mocks.useCronograma,
}));

const META: Meta = {
  periodo: '01/01/2026 — 31/12/2026',
  fonte: 'ies_contrato_simulados · ies_simulado_previsto · simulados_admin',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'realizado = ...',
  partial: false,
  lowSample: false,
};

/**
 * Datas dos agendados relativas a hoje. O componente chama `proximoSimulado`
 * com o relógio real, e é o "próximo" que define qual anatomia cada item
 * recebe (cartão de destaque × linha de lista): com data fixa, o destaque
 * mudaria de item sozinho na virada daquele dia. Realizado e em processamento
 * ficam com data fixa — não disputam o destaque e são conferidos por texto.
 */
const emDias = (dias: number): Date => {
  const data = new Date();
  data.setUTCHours(12, 0, 0, 0);
  data.setUTCDate(data.getUTCDate() + dias);
  return data;
};

/** `dd/MM/yyyy` dos MESMOS dígitos UTC do ISO que `formatData` lê. */
const ddmmaaaa = (data: Date): string =>
  [
    String(data.getUTCDate()).padStart(2, '0'),
    String(data.getUTCMonth() + 1).padStart(2, '0'),
    String(data.getUTCFullYear()),
  ].join('/');

const DATA_S3 = emDias(45);
const DATA_S4 = emDias(12);

/** Um item por status. s4 é o próximo: vence s3 na ordenação. */
const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', participantes: null, indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: DATA_S3.toISOString(), status: 'agendado', modalidade: 'online', participantes: null },
  { id: 's4', nome: 'Simulado 4', data: DATA_S4.toISOString(), status: 'reagendado', modalidade: 'presencial', participantes: null },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null, indisponivelPorque: 'Data ainda não definida' },
];

/** Achado 20 (revisão de 03/08): presencial legado sem data_realizacao/data_liberacao, já com TRI. */
const S6_REALIZADO_SEM_DATA: ItemCronograma = {
  id: 's6',
  nome: 'Simulado Legado Presencial',
  data: null,
  status: 'realizado',
  modalidade: 'presencial',
  participantes: 40,
};

const resultado = (over: Record<string, unknown> = {}) => ({
  isLoading: false,
  isError: false,
  data: undefined,
  meta: META,
  refetch: vi.fn(),
  ...over,
});

const montar = (props?: Partial<React.ComponentProps<typeof CronogramaSimulados>>) =>
  render(<CronogramaSimulados iesId="ies-1" iesNome="UEA" {...props} />);

beforeEach(() => {
  mocks.useCronograma.mockReturnValue(resultado({ data: ITENS }));
});

describe('proximoSimulado', () => {
  const AGORA = emDias(-1);

  it('devolve o agendado/reagendado com a data mais próxima', () => {
    expect(proximoSimulado(ITENS, AGORA)).toBe('s4');
  });

  it('ignora realizado, em processamento e previsto', () => {
    const soPassado: ItemCronograma[] = [ITENS[0], ITENS[1], ITENS[4]];
    expect(proximoSimulado(soPassado, AGORA)).toBeNull();
  });

  it('devolve null com lista vazia', () => {
    expect(proximoSimulado([], AGORA)).toBeNull();
  });

  it('ignora agendado/reagendado com data no passado (achados 11 e 18) — não é "próximo" algo que já passou', () => {
    // s4 (+12d) já passou; s3 (+45d) ainda está no futuro.
    expect(proximoSimulado(ITENS, emDias(20))).toBe('s3');
  });

  it('sem nenhum agendado/reagendado no futuro, não destaca nada — estado legítimo, não um erro', () => {
    expect(proximoSimulado(ITENS, emDias(60))).toBeNull();
  });
});

describe('rotuloVigenciaContrato', () => {
  it('prefixa a vigência devolvida pelo servidor', () => {
    expect(rotuloVigenciaContrato('01/01/2026 — 31/12/2026')).toBe(
      'Vigência do contrato 01/01/2026 — 31/12/2026',
    );
  });

  it('devolve o texto de fallback do servidor sem inventar prefixo, quando não há contrato', () => {
    expect(rotuloVigenciaContrato('sem contrato cadastrado')).toBe('sem contrato cadastrado');
  });
});

describe('CronogramaSimulados — os 5 status (spec §6.4)', () => {
  it('rotula cada um dos 5 status', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Realizado');
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Em processamento');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveTextContent('Agendado');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Reagendado');
    expect(screen.getByTestId('cronograma-item-s5')).toHaveTextContent('Previsto');
  });

  it('previsto exibe "Previsto" e nenhuma data', () => {
    montar();
    const previsto = screen.getByTestId('cronograma-item-s5');
    expect(previsto).toHaveTextContent('Previsto');
    expect(previsto.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('rotula a data conforme a modalidade: online = Início, presencial = Realização', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Início: 10/03/2026');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent(
      `Realização: ${ddmmaaaa(DATA_S4)}`,
    );
  });

  it('mostra o motivo de indisponibilidade quando o servidor manda', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Gabarito em fechamento');
  });

  it('destaca o próximo simulado e só ele', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s4')).toHaveAttribute('data-destaque', 'true');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveAttribute('data-destaque', 'false');
    expect(screen.getByText('Próximo')).toBeInTheDocument();
  });
});

/**
 * Anatomia da referência (handoff §10.12). Os testes acima cobrem a REGRA
 * (quais status existem, o que navega); estes cobrem a FORMA que a referência
 * fixa e que a implementação anterior não tinha.
 */
describe('CronogramaSimulados — anatomia da referência (§10.12)', () => {
  it('o selo do próximo é a pílula sólida de marca, não uma linha de texto solta', () => {
    montar();
    const selo = screen.getByText('Próximo');
    expect(selo.style.background).toBe('var(--gp-brand)');
    expect(selo.style.color).toBe('var(--gp-on-brand)');
    expect(selo.style.borderRadius).toBe('var(--gp-radius-pill)');
    // A anatomia antiga era um parágrafo "Próximo simulado" acima do nome.
    expect(screen.queryByText('Próximo simulado')).not.toBeInTheDocument();
  });

  it('toda linha com modalidade carrega a pílula de modalidade', () => {
    montar();
    // `ItemCronograma.modalidade` só distingue online|presencial — a
    // granularidade síncrono/assíncrono da referência depende da API.
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Online');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Presencial');
    // Sem modalidade no dado, nenhuma pílula inventada.
    expect(screen.getByTestId('cronograma-item-s5')).not.toHaveTextContent('Online');
    expect(screen.getByTestId('cronograma-item-s5')).not.toHaveTextContent('Presencial');
  });

  it('só a linha navegável oferece a afordância "Resultados"', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Resultados');
    expect(screen.getByTestId('cronograma-item-s3')).not.toHaveTextContent('Resultados');
    expect(screen.getByTestId('cronograma-item-s5')).not.toHaveTextContent('Resultados');
  });

  /**
   * Regressão: `BadgeStatus` desenhava "Realizado · Resultados ›" e a linha
   * desenhava o SEU "Resultados ›" logo depois — a palavra saía duas vezes,
   * lado a lado, na mesma linha. Conta ocorrências no texto, não presença:
   * `toHaveTextContent` passava nos dois mundos.
   */
  it('a afordância "Resultados" aparece UMA vez por linha, nunca duplicada', () => {
    montar();
    const linha = screen.getByTestId('cronograma-item-s1');
    expect(linha.textContent?.match(/Resultados/g) ?? []).toHaveLength(1);
  });

  /**
   * O rótulo textual do status continua no DOM para leitor de tela (nunca só
   * o chevron), mas some da pintura: na referência a linha realizada termina
   * em "Resultados ›" e mais nada.
   */
  it('"Realizado" fica só para leitor de tela — a linha não repinta o status', () => {
    montar();
    expect(screen.getByTestId('status-realizado')).toHaveClass('sr-only');
    expect(screen.getByTestId('status-realizado')).toHaveTextContent('Realizado');
  });

  /**
   * Régua temporal da referência (§10.12): a data abre a linha, em dia + mês
   * abreviado. A forma por extenso e o rótulo por modalidade não somem — vão
   * para `sr-only`/`title` (coberto pelo teste "rotula a data conforme a
   * modalidade" acima, que continua lendo "Início: 10/03/2026").
   */
  it('a data abre a linha em dia + mês abreviado', () => {
    montar();
    const linha = screen.getByTestId('cronograma-item-s1');
    expect(linha).toHaveTextContent('10');
    expect(linha).toHaveTextContent('mar');
  });

  it('o cabeçalho traz a pílula-contador com o resumo do cronograma', () => {
    montar();
    expect(screen.getByTestId('cronograma-resumo')).toHaveTextContent(
      '1 realizado · 2 agendados · 1 em processamento · 1 sem data',
    );
  });

  it('os glifos vêm todos do Fontello do Dendê — zero lucide-react no arquivo', () => {
    const fonte = readFileSync(
      resolve(__dirname, '../components/CronogramaSimulados.tsx'),
      'utf-8',
    );
    expect(fonte).not.toMatch(/lucide-react/);
    expect(fonte).toMatch(/name="calendar_month"/);
    expect(fonte).toMatch(/name="edit_calendar"/);
    expect(fonte).toMatch(/name="chevron_right"/);
    expect(fonte).toMatch(/name="info"/);
  });

  it('os botões de contato são só-texto — a referência não põe glifo neles', () => {
    montar();
    const agendar = screen.getByRole('button', { name: /agendar/i });
    expect(agendar.querySelector('i')).toBeNull();
    expect(agendar.querySelector('svg')).toBeNull();
  });

  /**
   * Item B4 do passe de conformidade: os três botões de ação da referência
   * ("Agendar data" e os dois "Falar com consultor") herdavam `size="sm"` cru
   * do primitivo compartilhado (h-9/rounded-md/px-3/text-sm) em vez da
   * receita de botão de AÇÃO EM PÁGINA que bate com o handoff — 8px de raio,
   * 8px 14px de padding, 12px/600. Corrigido na revisão final (F4): esta NÃO
   * é a mesma receita de EstadoErro/EstadoVazio (retry EM ESTADO, `px-3
   * py-1.5 text-[11px]`) — são dois papéis distintos, cada um com a sua.
   */
  it('"Agendar data" (linha sem data) usa a receita h-auto/rounded-sm/px-3.5/py-2/text-xs/font-semibold', () => {
    montar();
    const agendar = screen.getByRole('button', { name: 'Agendar data' });
    expect(agendar.className).toMatch(/\bh-auto\b/);
    expect(agendar.className).toMatch(/\brounded-sm\b/);
    expect(agendar.className).toMatch(/\bpx-3\.5\b/);
    expect(agendar.className).toMatch(/\bpy-2\b/);
    expect(agendar.className).toMatch(/\btext-xs\b/);
    expect(agendar.className).toMatch(/\bfont-semibold\b/);
  });

  it('"Falar com consultor" do grupo sem data usa a mesma receita de geometria', () => {
    montar();
    const falar = screen.getByRole('button', { name: 'Falar com consultor' });
    expect(falar.className).toMatch(/\bh-auto\b/);
    expect(falar.className).toMatch(/\brounded-sm\b/);
    expect(falar.className).toMatch(/\bpx-3\.5\b/);
    expect(falar.className).toMatch(/\bpy-2\b/);
    expect(falar.className).toMatch(/\btext-xs\b/);
    expect(falar.className).toMatch(/\bfont-semibold\b/);
  });

  it('"Falar com consultor" do estado vazio (nenhum simulado contratado) usa a mesma receita de geometria', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [] }));
    montar();
    const falar = screen.getByRole('button', { name: 'Falar com consultor' });
    expect(falar.className).toMatch(/\bh-auto\b/);
    expect(falar.className).toMatch(/\brounded-sm\b/);
    expect(falar.className).toMatch(/\bpx-3\.5\b/);
    expect(falar.className).toMatch(/\bpy-2\b/);
    expect(falar.className).toMatch(/\btext-xs\b/);
    expect(falar.className).toMatch(/\bfont-semibold\b/);
  });
});

describe('resumoCronograma', () => {
  it('junta as parcelas existentes na ordem da referência', () => {
    expect(resumoCronograma(ITENS)).toBe(
      '1 realizado · 2 agendados · 1 em processamento · 1 sem data',
    );
  });

  it('omite a parcela zerada — "0 agendados" é ruído, não informação', () => {
    expect(resumoCronograma([ITENS[0]])).toBe('1 realizado');
  });

  it('sem itens não há resumo nenhum', () => {
    expect(resumoCronograma([])).toBeNull();
  });
});

describe('CronogramaSimulados — bloco de contratados sem data', () => {
  it('agrupa os previstos com a contagem', () => {
    montar();
    const bloco = screen.getByTestId('cronograma-sem-data');
    expect(bloco).toHaveTextContent('Contratados sem data definida · 1');
    expect(bloco).toContainElement(screen.getByTestId('cronograma-item-s5'));
  });

  it('Agendar e Falar com consultor abrem o WhatsApp com textos diferentes', async () => {
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: /agendar/i }));
    await user.click(screen.getByRole('button', { name: /falar com consultor/i }));

    expect(abrir).toHaveBeenCalledTimes(2);
    const [urlAgendar] = abrir.mock.calls[0] as [string];
    const [urlConsultor] = abrir.mock.calls[1] as [string];

    // "Agendar" parte da LINHA de um simulado (§10.12), então a mensagem diz
    // de qual: com dois ou mais contratados sem data, um pedido genérico
    // obrigaria o consultor a perguntar a qual deles o gestor se refere.
    expect(urlAgendar).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(
        MSG_AGENDAR('UEA', 'Simulado 5'),
      )}`,
    );
    expect(decodeURIComponent(urlAgendar)).toContain('Simulado 5');
    expect(urlConsultor).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(MSG_CONSULTOR('UEA'))}`,
    );
    expect(urlAgendar).not.toBe(urlConsultor);
  });

  it('não renderiza o bloco quando todo simulado tem data', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: ITENS.slice(0, 4) }));
    montar();
    expect(screen.queryByTestId('cronograma-sem-data')).not.toBeInTheDocument();
  });
});

describe('CronogramaSimulados — "realizado" sem data não é "contratado sem data" (achado 20)', () => {
  it('aparece na lista de datados, mesmo sem data — não desaparece das duas agrupações', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [...ITENS, S6_REALIZADO_SEM_DATA] }));
    montar();
    expect(screen.getByTestId('cronograma-item-s6')).toBeInTheDocument();
  });

  it('não entra na contagem "Contratados sem data" — já aconteceu, não está pendente de agendamento', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [...ITENS, S6_REALIZADO_SEM_DATA] }));
    montar();
    const bloco = screen.getByTestId('cronograma-sem-data');
    expect(bloco).toHaveTextContent('Contratados sem data definida · 1');
    expect(bloco).not.toContainElement(screen.getByTestId('cronograma-item-s6'));
  });

  it('não renderiza data falsa e explica por que a data não aparece', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [S6_REALIZADO_SEM_DATA] }));
    montar();
    const item = screen.getByTestId('cronograma-item-s6');
    expect(item.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(item).toHaveTextContent('Data de realização não registrada');
  });

  it('continua navegável — realizado sempre é navegável, com ou sem data', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [S6_REALIZADO_SEM_DATA] }));
    montar();
    expect(screen.getByTestId('cronograma-item-s6')).toBeEnabled();
  });
});

describe('CronogramaSimulados — proveniência escopada à IES consultada (achados 1, 3, 4 e 7)', () => {
  it('mostra a vigência devolvida pelo meta desta consulta (useCronograma), não um dado externo', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: ITENS, meta: META }));
    montar();
    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      'Vigência do contrato 01/01/2026 — 31/12/2026',
    );
  });

  it('ao trocar de IES (outro iesId, outro meta) o rodapé muda de acordo — nunca fica presa na primeira consulta', () => {
    mocks.useCronograma.mockReturnValue(
      resultado({ data: ITENS, meta: { ...META, periodo: '01/06/2026 — 31/05/2027' } }),
    );
    montar({ iesId: 'ies-2', iesNome: 'Outra IES' });
    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      'Vigência do contrato 01/06/2026 — 31/05/2027',
    );
    expect(screen.getByTestId('cronograma-proveniencia')).not.toHaveTextContent(
      '01/01/2026 — 31/12/2026',
    );
  });

  it('quando a IES consultada não tem contrato cadastrado, mostra o texto do servidor — não some, não inventa vigência', () => {
    mocks.useCronograma.mockReturnValue(
      resultado({ data: ITENS, meta: { ...META, periodo: 'sem contrato cadastrado' } }),
    );
    montar();
    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      'sem contrato cadastrado',
    );
  });

  it('omite o rodapé quando a consulta não trouxe meta', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: ITENS, meta: undefined }));
    montar();
    expect(screen.queryByTestId('cronograma-proveniencia')).not.toBeInTheDocument();
  });
});

describe('CronogramaSimulados — estados (§8.4)', () => {
  it('loading: skeleton que reserva altura, sem itens', () => {
    mocks.useCronograma.mockReturnValue(resultado({ isLoading: true }));
    montar();
    expect(screen.getAllByTestId('cronograma-skeleton')).toHaveLength(4);
    expect(screen.queryByTestId('cronograma-item-s1')).not.toBeInTheDocument();
  });

  it('empty: nenhum simulado contratado', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [] }));
    montar();
    expect(screen.getByText(/nenhum simulado contratado/i)).toBeInTheDocument();
  });

  it('error: mensagem + Tentar novamente refaz só esta query', async () => {
    const refetch = vi.fn();
    mocks.useCronograma.mockReturnValue(resultado({ isError: true, refetch }));
    const user = userEvent.setup();
    montar();

    expect(screen.getByText(/não foi possível carregar o cronograma/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
