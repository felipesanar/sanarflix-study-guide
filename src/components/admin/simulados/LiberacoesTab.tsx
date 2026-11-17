/** Fatia C2 — sub-aba Liberações (finalizações, saídas de aba/tela, liberar tentativa). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportLiberacoesPdf } from '@/utils/liberacoesPdf';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminEmpty, AdminError, AdminLoading, AdminSectionHeader } from '@/experiences/admin/ui';
import { liberarTentativa } from '@/services/admin/liberacoes';
import { LiberacoesTable } from './LiberacoesTable';
import { LiberacoesDialog } from './LiberacoesDialog';
import type { FinalizacaoRow, SimuladoOption } from './liberacoes-types';

const SIMULADO_FILTER_ALL = '__all__';

/**
 * Limite de finalizações trazidas — evita trazer o histórico inteiro para a tela.
 * Vale para a visão "Todos os simulados"; ao filtrar por um simulado o filtro é aplicado
 * no servidor, então o limite passa a valer só dentro daquele simulado.
 */
const FINALIZACOES_LIMIT = 500;

/**
 * Lista de simulados para o dropdown — vem de `simulados_admin`, não das finalizações carregadas.
 * Ordenada do mais recente para o mais antigo. Ordena no cliente porque muitos simulados não têm
 * `data_liberacao` e, em ordem decrescente, o Postgres colocaria os nulos primeiro. A data de
 * referência é `data_realizacao`, depois `data_liberacao`, depois `created_at`.
 */
async function fetchSimuladoOptions(): Promise<SimuladoOption[]> {
  const { data, error } = await supabase
    .from('simulados_admin')
    .select('id, nome, data_realizacao, data_liberacao, created_at');
  if (error) throw error;
  const refTime = (s: { data_realizacao: string | null; data_liberacao: string | null; created_at: string }) =>
    new Date(s.data_realizacao ?? s.data_liberacao ?? s.created_at).getTime();
  return (data ?? [])
    .sort((a, b) => refTime(b) - refTime(a))
    .map((s) => ({ id: s.id, nome: s.nome }));
}

/**
 * Busca finalizações + nomes/e-mails de aluno em lotes (NÃO um `.in()` gigante — a lista de
 * `user_id` pode ter centenas de itens e uma única URL estouraria; ver lição em
 * `LiberacoesTab.tsx` (raiz, tab antigo) e `useSimuladosAnalytics`) + nomes de simulado.
 * Limitado às `FINALIZACOES_LIMIT` mais recentes (ordenado por `finalizado_em desc`).
 * Com `simuladoId`, filtra no servidor — senão simulados mais antigos que o corte das
 * 500 mais recentes ficariam incompletos ou ausentes.
 */
async function fetchFinalizacoes(simuladoId?: string): Promise<FinalizacaoRow[]> {
  let query = supabase.from('simulados_finalizados').select('*');
  if (simuladoId) query = query.eq('simulado_id', simuladoId);
  const { data: finalizacoesData, error: finalizacoesError } = await query
    .order('finalizado_em', { ascending: false })
    .limit(FINALIZACOES_LIMIT);
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
  // Map em vez de `.find()` dentro do `.map()` abaixo — evita O(n·m) quando há
  // centenas de finalizações e centenas de alunos distintos.
  const usersById = new Map(usersResults.flatMap((r) => r.data ?? []).map((u) => [u.id, u]));

  const simuladoIds = [...new Set(rows.map((f) => f.simulado_id))];
  const { data: simuladosData, error: simuladosError } = await supabase
    .from('simulados_admin')
    .select('id, nome')
    .in('id', simuladoIds.length > 0 ? simuladoIds : ['00000000-0000-0000-0000-000000000000']);
  if (simuladosError) throw simuladosError;
  const simuladosById = new Map((simuladosData ?? []).map((s) => [s.id, s]));

  return rows.map((f) => {
    const user = usersById.get(f.user_id);
    const simulado = simuladosById.get(f.simulado_id);
    return {
      ...f,
      // `saidas_detalhe` ainda não está nos types gerados do Supabase.
      saidas_detalhe: (f as any).saidas_detalhe,
      user_email: user?.email,
      user_nome: user?.nome,
      simulado_nome: simulado?.nome,
    };
  });
}

export default function LiberacoesTab() {
  const [finalizacoes, setFinalizacoes] = useState<FinalizacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [simuladoFilter, setSimuladoFilter] = useState(SIMULADO_FILTER_ALL);
  const [dialogRow, setDialogRow] = useState<FinalizacaoRow | null>(null);

  const [simuladoOptions, setSimuladoOptions] = useState<SimuladoOption[]>([]);

  const load = useCallback(async (filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rows, options] = await Promise.all([
        fetchFinalizacoes(filter === SIMULADO_FILTER_ALL ? undefined : filter),
        fetchSimuladoOptions(),
      ]);
      setFinalizacoes(rows);
      setSimuladoOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar finalizações.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega ao trocar o filtro de simulado: o filtro roda no servidor.
  useEffect(() => {
    load(simuladoFilter);
  }, [load, simuladoFilter]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return finalizacoes.filter((f) => {
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
      toast.success('Tentativa liberada', { description: 'O aluno poderá realizar o simulado novamente.' });
      setDialogRow(null);
    } catch (err) {
      toast.error('Erro ao liberar tentativa', { description: err instanceof Error ? err.message : 'Falha desconhecida.' });
    }
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Liberações"
        subtitle={`Finalizações com detecção de saídas de aba/tela cheia. Libere uma nova tentativa para alunos que tiveram problemas. Mostrando as ${FINALIZACOES_LIMIT} mais recentes.`}
      />

      {loading ? (
        <div className="space-y-3">
          {/* Mantém o filtro visível ao trocar de simulado (a troca refaz a busca no servidor). */}
          {simuladoOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Toolbar
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                simuladoFilter={simuladoFilter}
                onSimuladoFilterChange={setSimuladoFilter}
                simuladoOptions={simuladoOptions}
              exportRows={filteredRows}
              exportDisabled={loading}
              />
            </div>
          )}
          <AdminLoading rows={6} />
        </div>
      ) : error ? (
        <AdminError message={error} onRetry={() => load(simuladoFilter)} />
      ) : finalizacoes.length === 0 && simuladoFilter === SIMULADO_FILTER_ALL ? (
        <AdminEmpty title="Nenhuma finalização registrada" description="Nenhum aluno finalizou simulados ainda." />
      ) : filteredRows.length === 0 ? (
        <div className="space-y-3">
          <Toolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            simuladoFilter={simuladoFilter}
            onSimuladoFilterChange={setSimuladoFilter}
            simuladoOptions={simuladoOptions}
            exportRows={filteredRows}
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
              exportRows={filteredRows}
              exportDisabled={loading}
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
  exportRows?: FinalizacaoRow[];
  exportDisabled?: boolean;
}

export function Toolbar({ searchTerm, onSearchTermChange, simuladoFilter, onSimuladoFilterChange, simuladoOptions, exportRows = [], exportDisabled }: ToolbarProps) {
  const selected = simuladoFilter !== SIMULADO_FILTER_ALL ? simuladoOptions.find((s) => s.id === simuladoFilter) : undefined;
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
      {selected && (
        <Button
          variant="outline"
          className="gap-2"
          disabled={exportDisabled || exportRows.length === 0}
          onClick={() => { void exportLiberacoesPdf(exportRows, selected.nome); }}
        >
          <FileDown className="h-4 w-4" /> Exportar PDF
        </Button>
      )}
    </>
  );
}
