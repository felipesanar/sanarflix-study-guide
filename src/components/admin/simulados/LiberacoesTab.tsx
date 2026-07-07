/** Fatia C2 — sub-aba Liberações (finalizações, saídas de aba/tela, liberar tentativa). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminEmpty, AdminError, AdminLoading, AdminSectionHeader } from '@/experiences/admin/ui';
import { liberarTentativa } from '@/services/admin/liberacoes';
import { LiberacoesTable } from './LiberacoesTable';
import { LiberacoesDialog } from './LiberacoesDialog';
import type { FinalizacaoRow, SimuladoOption } from './liberacoes-types';

const SIMULADO_FILTER_ALL = '__all__';

/**
 * Busca finalizações + nomes/e-mails de aluno em lotes (NÃO um `.in()` gigante — a lista de
 * `user_id` pode ter centenas de itens e uma única URL estouraria; ver lição em
 * `LiberacoesTab.tsx` (raiz, tab antigo) e `useSimuladosAnalytics`) + nomes de simulado.
 */
async function fetchFinalizacoes(): Promise<FinalizacaoRow[]> {
  const { data: finalizacoesData, error: finalizacoesError } = await supabase
    .from('simulados_finalizados')
    .select('*')
    .order('finalizado_em', { ascending: false });
  if (finalizacoesError) throw finalizacoesError;

  const rows = finalizacoesData ?? [];

  const userIds = [...new Set(rows.map((f) => f.user_id))];
  const USERS_BATCH_SIZE = 200;
  const userBatches: string[][] = [];
  for (let i = 0; i < userIds.length; i += USERS_BATCH_SIZE) {
    userBatches.push(userIds.slice(i, i + USERS_BATCH_SIZE));
  }
  const usersResults = await Promise.all(
    userBatches.map((batch) => supabase.from('users').select('id, email, nome').in('id', batch)),
  );
  const usersError = usersResults.find((r) => r.error)?.error;
  if (usersError) throw usersError;
  const usersData = usersResults.flatMap((r) => r.data ?? []);

  const simuladoIds = [...new Set(rows.map((f) => f.simulado_id))];
  const { data: simuladosData, error: simuladosError } = await supabase
    .from('simulados_admin')
    .select('id, nome')
    .in('id', simuladoIds.length > 0 ? simuladoIds : ['00000000-0000-0000-0000-000000000000']);
  if (simuladosError) throw simuladosError;

  return rows.map((f) => {
    const user = usersData.find((u) => u.id === f.user_id);
    const simulado = simuladosData?.find((s) => s.id === f.simulado_id);
    return {
      ...f,
      user_email: user?.email,
      user_nome: user?.nome,
      simulado_nome: simulado?.nome,
    };
  });
}

export default function LiberacoesTab() {
  const { toast } = useToast();
  const [finalizacoes, setFinalizacoes] = useState<FinalizacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [simuladoFilter, setSimuladoFilter] = useState(SIMULADO_FILTER_ALL);
  const [dialogRow, setDialogRow] = useState<FinalizacaoRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchFinalizacoes();
      setFinalizacoes(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar finalizações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const simuladoOptions: SimuladoOption[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of finalizacoes) {
      if (!map.has(f.simulado_id)) map.set(f.simulado_id, f.simulado_nome ?? 'Simulado não encontrado');
    }
    return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [finalizacoes]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return finalizacoes.filter((f) => {
      if (simuladoFilter !== SIMULADO_FILTER_ALL && f.simulado_id !== simuladoFilter) return false;
      if (!q) return true;
      return (
        f.user_nome?.toLowerCase().includes(q) ||
        f.user_email?.toLowerCase().includes(q) ||
        f.simulado_nome?.toLowerCase().includes(q)
      );
    });
  }, [finalizacoes, searchTerm, simuladoFilter]);

  const handleConfirmLiberar = async (motivo: string) => {
    if (!dialogRow) return;
    try {
      const result = await liberarTentativa(dialogRow.id, motivo);
      setFinalizacoes((prev) =>
        prev.map((f) =>
          f.id === result.finalizacao_id
            ? { ...f, liberado_novamente: true, liberado_em: new Date().toISOString() }
            : f,
        ),
      );
      toast({ title: 'Tentativa liberada', description: 'O aluno poderá realizar o simulado novamente.' });
      setDialogRow(null);
    } catch (err) {
      toast({
        title: 'Erro ao liberar tentativa',
        description: err instanceof Error ? err.message : 'Falha desconhecida.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Liberações"
        subtitle="Finalizações com detecção de saídas de aba/tela cheia. Libere uma nova tentativa para alunos que tiveram problemas."
      />

      {loading ? (
        <AdminLoading rows={6} />
      ) : error ? (
        <AdminError message={error} onRetry={load} />
      ) : finalizacoes.length === 0 ? (
        <AdminEmpty title="Nenhuma finalização registrada" description="Nenhum aluno finalizou simulados ainda." />
      ) : filteredRows.length === 0 ? (
        <div className="space-y-3">
          <Toolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            simuladoFilter={simuladoFilter}
            onSimuladoFilterChange={setSimuladoFilter}
            simuladoOptions={simuladoOptions}
          />
          <AdminEmpty title="Nenhum resultado" description="Tente ajustar a busca ou o filtro de simulado." />
        </div>
      ) : (
        <LiberacoesTable
          rows={filteredRows}
          onLiberar={setDialogRow}
          toolbar={
            <Toolbar
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              simuladoFilter={simuladoFilter}
              onSimuladoFilterChange={setSimuladoFilter}
              simuladoOptions={simuladoOptions}
            />
          }
        />
      )}

      <LiberacoesDialog row={dialogRow} onOpenChange={(open) => !open && setDialogRow(null)} onConfirm={handleConfirmLiberar} />
    </div>
  );
}

interface ToolbarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  simuladoFilter: string;
  onSimuladoFilterChange: (value: string) => void;
  simuladoOptions: SimuladoOption[];
}

function Toolbar({ searchTerm, onSearchTermChange, simuladoFilter, onSimuladoFilterChange, simuladoOptions }: ToolbarProps) {
  return (
    <>
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por aluno ou simulado…"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={simuladoFilter} onValueChange={onSimuladoFilterChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Todos os simulados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIMULADO_FILTER_ALL}>Todos os simulados</SelectItem>
          {simuladoOptions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
