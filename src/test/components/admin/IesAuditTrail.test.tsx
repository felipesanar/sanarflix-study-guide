import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../utils';
import { IesAuditTrail } from '@/components/admin/ies/IesAuditTrail';
import { useAuditLog, type AuditLogRow } from '@/services/admin/audit';

vi.mock('@/services/admin/audit', () => ({
  useAuditLog: vi.fn(),
}));

const row = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: 'row-1',
  created_at: '2026-07-01T10:00:00Z',
  action: 'ies_features_update',
  admin_id: 'admin-1',
  admin_nome: 'Admin Um',
  admin_email: 'admin1@sanar.com',
  target_user_id: null,
  target_nome: null,
  target_email: null,
  metadata: { ies_id: 'ies-1' },
  ...overrides,
});

function mockAuditLog(rows: AuditLogRow[], isLoading = false) {
  vi.mocked(useAuditLog).mockReturnValue({
    data: { total: rows.length, rows },
    isLoading,
  } as unknown as ReturnType<typeof useAuditLog>);
}

describe('IesAuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza nada quando fechado', () => {
    mockAuditLog([row()]);
    render(<IesAuditTrail iesId="ies-1" open={false} />);
    expect(screen.queryByText('alterou features da IES')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem alterações registradas.')).not.toBeInTheDocument();
  });

  it('filtra as linhas por metadata.ies_id, só mostrando as da IES aberta', () => {
    mockAuditLog([
      row({ id: 'row-1', metadata: { ies_id: 'ies-1' } }),
      row({ id: 'row-2', metadata: { ies_id: 'ies-2' } }),
      row({ id: 'row-3', metadata: { ies_id: 'ies-1' } }),
    ]);

    render(<IesAuditTrail iesId="ies-1" open />);

    expect(screen.getAllByText('alterou features da IES')).toHaveLength(2);
  });

  it('mostra no máximo 10 linhas mesmo com mais registros da IES', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({ id: `row-${i}`, metadata: { ies_id: 'ies-1' } }),
    );
    mockAuditLog(rows);

    render(<IesAuditTrail iesId="ies-1" open />);

    expect(screen.getAllByText('alterou features da IES')).toHaveLength(10);
  });

  it('renderiza o diff de metadata.changes como badges chave: on/off', () => {
    mockAuditLog([
      row({
        metadata: {
          ies_id: 'ies-1',
          changes: { 'aluno.home': true, 'gestao.enabled': false },
        },
      }),
    ]);

    render(<IesAuditTrail iesId="ies-1" open />);

    expect(screen.getByText('aluno.home: on')).toBeInTheDocument();
    expect(screen.getByText('gestao.enabled: off')).toBeInTheDocument();
  });

  it('mostra "Sem alterações registradas." quando não há linhas da IES', () => {
    mockAuditLog([row({ metadata: { ies_id: 'outra-ies' } })]);

    render(<IesAuditTrail iesId="ies-1" open />);

    expect(screen.getByText('Sem alterações registradas.')).toBeInTheDocument();
  });
});
