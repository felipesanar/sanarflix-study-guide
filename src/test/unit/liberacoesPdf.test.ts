import { describe, it, expect } from 'vitest';
import { buildLiberacoesPdfRows, LIBERACOES_PDF_COLUMNS } from '@/utils/liberacoesPdf';

const row: any = { id: '1', user_id: 'u', simulado_id: 's', finalizado_em: '2026-11-10T13:30:00Z', tempo_total_segundos: 5520,
  saidas_de_aba: 2, saidas_de_fullscreen: 1, liberado_novamente: false, liberado_em: null, liberado_por: null,
  tentativa_numero: 1, bloqueado_por_saidas: true, user_nome: 'Ana', user_email: 'a@x.com', simulado_nome: 'Sim 1' };

describe('liberacoesPdf', () => {
  it('tem as 7 colunas da tela', () => {
    expect(LIBERACOES_PDF_COLUMNS).toEqual(['Aluno', 'Simulado', 'Tent.', 'Finalizado', 'Tempo', 'Saídas', 'Ação']);
  });
  it('formata valores como a tela', () => {
    const [r] = buildLiberacoesPdfRows([row]);
    expect(r[0]).toEqual(['Ana', 'a@x.com']);
    expect(r[2]).toEqual(['#1']);
    expect(r[3]).toEqual(['10/11/2026 às 10:30']);
    expect(r[4]).toEqual(['1h 32m']);
    expect(r[5]).toEqual(['2 aba · 1 tela', 'Bloqueado por saídas']);
    expect(r[6]).toEqual(['Não liberado']);
  });
});
