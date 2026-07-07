import { useEffect, useMemo, useState } from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui/AdminSectionHeader';
import { AdminLoading } from '@/experiences/admin/ui/AdminLoading';
import { AdminError } from '@/experiences/admin/ui/AdminError';
import { AdminEmpty } from '@/experiences/admin/ui/AdminEmpty';
import { MonoValue } from '@/experiences/admin/ui/MonoValue';
import { Button } from '@/components/ui/button';
import { useAuditLog } from '@/services/admin/audit';
import { AuditFilters, type AuditPeriod } from './AuditFilters';
import { AuditTable } from './AuditTable';

const LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

function periodToFrom(period: AuditPeriod): string | null {
  if (period === 'all') return null;
  const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Seção Auditoria (`/admin/auditoria`, capability `admin.tools`) — filtros
 * (busca/ação/período) + `AdminTable` paginada via `admin_get_audit_log`.
 */
export function AuditoriaSection() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [period, setPeriod] = useState<AuditPeriod>('7d');
  const [page, setPage] = useState(0);

  // Debounce da busca — evita 1 chamada de RPC por tecla digitada.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Qualquer troca de filtro volta para a primeira página.
  useEffect(() => {
    setPage(0);
  }, [search, action, period]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      action: action === 'all' ? undefined : action,
      from: periodToFrom(period),
      limit: LIMIT,
      offset: page * LIMIT,
    }),
    [search, action, period, page],
  );

  const { data, isLoading, isError, isFetching, refetch } = useAuditLog(filters);

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Auditoria"
        subtitle="Quem fez o quê, quando. Trilha consultável de ações sensíveis a partir de admin_audit_log."
      />

      <AuditFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        action={action}
        onActionChange={setAction}
        period={period}
        onPeriodChange={setPeriod}
      />

      {isLoading && <AdminLoading rows={8} />}

      {isError && !isLoading && (
        <AdminError message="Não foi possível carregar a trilha de auditoria." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && (
        rows.length === 0 ? (
          <AdminEmpty
            title="Nenhum evento encontrado"
            description="Ajuste a busca, a ação ou o período para ver outros resultados."
          />
        ) : (
          <AuditTable
            rows={rows}
            footer={
              <>
                <span>
                  <MonoValue>{total}</MonoValue> evento{total === 1 ? '' : 's'} · página <MonoValue>{page + 1}</MonoValue> de{' '}
                  <MonoValue>{totalPages}</MonoValue>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || isFetching}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            }
          />
        )
      )}
    </div>
  );
}

export default AuditoriaSection;
