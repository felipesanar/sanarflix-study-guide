/**
 * Fatia C1 — sub-aba Provas: tabela de simulados (criar/editar, ver questões,
 * exportar, encerrar). Reaproveita a lógica de `src/components/admin/SimuladosTab.tsx`
 * (fetch, cálculo de status, export XLSX) reapresentada no vocabulário do
 * console admin (`@/experiences/admin/ui`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { isSameDay } from 'date-fns';
import { Download, Edit2, Eye, Plus, Search, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { toBrazilDate } from '@/utils/timezone';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminTable,
  DangerZone,
  MonoValue,
  StatusPill,
  adminTableCellClass,
  adminTableHeadClass,
  type StatusPillVariant,
} from '@/experiences/admin/ui';
import { logAdminAction } from '@/services/admin/logAction';
import SimuladoConfigDialog from './SimuladoConfigDialog';
import QuestoesDialog from './QuestoesDialog';

/** Linha da tabela de Provas — espelha `simulados_admin` + contagem de questões. */
export interface Simulado {
  id: string;
  nome: string;
  descricao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  duracao_minutos: number;
  status: 'aguardando' | 'ativo' | 'encerrado';
  created_at: string;
  ies_ids: string[];
  questoes_count: number;
  liberacao_desempenho: 'imediato' | 'agendado' | 'ao_encerrar';
  data_liberacao_desempenho: string | null;
}

export interface IES {
  id: string;
  nome: string;
}

type StatusFilter = 'todos' | 'aguardando' | 'ativo' | 'encerrado';

/** Status calculado a partir das datas — mesma regra de `SimuladosTab.calcularStatusSimulado`. */
function calcularStatus(
  dataLiberacao: string | null,
  dataEncerramento: string | null,
  statusBanco: string,
): 'aguardando' | 'ativo' | 'encerrado' {
  const agora = new Date();
  if (statusBanco === 'encerrado') return 'encerrado';
  if (dataEncerramento && new Date(dataEncerramento) < agora) return 'encerrado';
  if (dataLiberacao && new Date(dataLiberacao) > agora) return 'aguardando';
  return 'ativo';
}

/** Rótulo/variante de exibição — contrato §C1: aguardando=blue, ativo=emerald, ativo+encerra hoje=amber, encerrado=muted. */
function getStatusDisplay(s: Simulado): { variant: StatusPillVariant; label: string } {
  if (s.status === 'encerrado') return { variant: 'muted', label: 'Encerrado' };
  if (s.status === 'aguardando') return { variant: 'blue', label: 'Agendado' };
  if (s.data_encerramento && isSameDay(toBrazilDate(s.data_encerramento), toBrazilDate(new Date()))) {
    return { variant: 'amber', label: 'Encerrando hoje' };
  }
  return { variant: 'emerald', label: 'Em andamento' };
}

export default function ProvasTab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const [configOpen, setConfigOpen] = useState(false);
  const [configMode, setConfigMode] = useState<'create' | 'edit'>('create');
  const [editingSimulado, setEditingSimulado] = useState<Simulado | null>(null);

  const [questoesOpen, setQuestoesOpen] = useState(false);
  const [questoesTarget, setQuestoesTarget] = useState<Simulado | null>(null);

  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [encerrarTarget, setEncerrarTarget] = useState<Simulado | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  const fetchIES = useCallback(async () => {
    try {
      const { data, error: iesError } = await supabase.from('ies').select('id, nome').order('nome');
      if (iesError) throw iesError;
      setIesList(data ?? []);
    } catch (err) {
      Logger.error('[ProvasTab] falha ao carregar IES:', err);
    }
  }, []);

  const fetchSimulados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Sem embedding: `questoes_simulado(count)` gera LATERAL + json_agg no
      // PostgREST e, combinado com as policies de RLS, estoura statement_timeout.
      const { data, error: fetchError } = await supabase
        .from('simulados_admin')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;

      const ids = (data ?? []).map((s) => s.id);
      const countsBySimulado: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: qsRows, error: qsError } = await supabase.rpc('get_simulados_questoes_count', {
          p_simulado_ids: ids,
        });
        if (qsError) throw qsError;
        for (const row of qsRows ?? []) {
          countsBySimulado[String(row.simulado_id)] = Number(row.total) || 0;
        }
      }

      const rows: Simulado[] = (data ?? []).map((s) => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        data_liberacao: s.data_liberacao,
        data_encerramento: s.data_encerramento,
        duracao_minutos: s.duracao_minutos,
        status: calcularStatus(s.data_liberacao, s.data_encerramento, s.status),
        created_at: s.created_at ?? '',
        ies_ids: s.ies_ids ?? [],
        questoes_count: countsBySimulado[String(s.id)] ?? 0,
        liberacao_desempenho: (s.liberacao_desempenho as Simulado['liberacao_desempenho']) || 'imediato',
        data_liberacao_desempenho: s.data_liberacao_desempenho,
      }));

      setSimulados(rows);
    } catch (err) {
      Logger.error('[ProvasTab] falha ao carregar simulados:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os simulados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSimulados();
    fetchIES();
  }, [fetchSimulados, fetchIES]);

  // Abre a criação automaticamente quando a URL tem ?new=1 (deep-link do
  // Command Center / sidebar). O parâmetro é limpo ao fechar o diálogo.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setConfigMode('create');
      setEditingSimulado(null);
      setConfigOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearNewParam = useCallback(() => {
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleConfigOpenChange = (open: boolean) => {
    setConfigOpen(open);
    if (!open) clearNewParam();
  };

  const handleNovoSimulado = () => {
    setConfigMode('create');
    setEditingSimulado(null);
    setConfigOpen(true);
  };

  const handleEditar = (simulado: Simulado) => {
    setConfigMode('edit');
    setEditingSimulado(simulado);
    setConfigOpen(true);
  };

  const handleSaved = () => {
    setConfigOpen(false);
    clearNewParam();
    fetchSimulados();
  };

  const handleVerQuestoes = (simulado: Simulado) => {
    setQuestoesTarget(simulado);
    setQuestoesOpen(true);
  };

  const handleAbrirEncerrar = (simulado: Simulado) => {
    setEncerrarTarget(simulado);
    setEncerrarOpen(true);
  };

  const handleConfirmEncerrar = async () => {
    if (!encerrarTarget) return;
    try {
      setEncerrando(true);
      const { error: updateError } = await supabase
        .from('simulados_admin')
        .update({ status: 'encerrado' })
        .eq('id', encerrarTarget.id);
      if (updateError) throw updateError;

      await logAdminAction('encerrar_simulado', null, { simulado_id: encerrarTarget.id, nome: encerrarTarget.nome });

      toast({ title: 'Simulado encerrado', description: 'Os alunos perderam acesso imediatamente.' });
      fetchSimulados();
    } catch (err) {
      toast({
        title: 'Erro ao encerrar simulado',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
      throw err; // mantém a DangerZone aberta para nova tentativa.
    } finally {
      setEncerrando(false);
    }
  };

  const handleExportar = async (simulado: Simulado) => {
    try {
      const { data: questoes, error: questoesError } = await supabase
        .from('questoes_simulado')
        .select('*')
        .eq('simulado_id', simulado.id)
        .order('ordem');
      if (questoesError) throw questoesError;

      const exportData = (questoes ?? []).map((q) => ({
        ENUNCIADO: q.enunciado,
        A: q.alternativa_a,
        B: q.alternativa_b,
        C: q.alternativa_c,
        D: q.alternativa_d,
        E: q.alternativa_e || '',
        CORRETA: q.correta,
        'Feedback das respostas corretas': q.feedback_corretas || '',
        'IMAGEM DA QUESTÃO': q.imagem || '',
        OBSERVAÇÃO: q.observacao || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questões');
      XLSX.writeFile(wb, `${simulado.nome}.xlsx`);

      toast({ title: 'Exportação concluída', description: 'O arquivo foi baixado com sucesso.' });
    } catch (err) {
      toast({
        title: 'Erro na exportação',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const iesNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ies of iesList) map.set(ies.id, ies.nome);
    return map;
  }, [iesList]);

  const filtered = useMemo(() => {
    return simulados.filter((s) => {
      const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [simulados, searchTerm, statusFilter]);

  const renderBody = () => {
    if (loading) return <AdminLoading rows={6} />;
    if (error) return <AdminError message={error} onRetry={fetchSimulados} />;
    if (filtered.length === 0) {
      return (
        <AdminEmpty
          title="Nenhum simulado encontrado"
          description={
            simulados.length === 0
              ? 'Crie o primeiro simulado para começar.'
              : 'Ajuste a busca ou o filtro de status.'
          }
          action={
            simulados.length === 0 ? (
              <Button size="sm" onClick={handleNovoSimulado}>
                <Plus className="h-4 w-4 mr-2" /> Novo simulado
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <AdminTable
        toolbar={
          <>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar simulados…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="aguardando">Agendados</SelectItem>
                <SelectItem value="ativo">Em andamento</SelectItem>
                <SelectItem value="encerrado">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead className={adminTableHeadClass}>Simulado</TableHead>
            <TableHead className={adminTableHeadClass}>IES</TableHead>
            <TableHead className={adminTableHeadClass}>Questões</TableHead>
            <TableHead className={adminTableHeadClass}>Janela</TableHead>
            <TableHead className={adminTableHeadClass}>Status</TableHead>
            <TableHead className={cnRight(adminTableHeadClass)}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((simulado) => {
            const statusInfo = getStatusDisplay(simulado);
            const iesNomes = simulado.ies_ids.map((id) => iesNameById.get(id) ?? id);
            return (
              <TableRow key={simulado.id}>
                <TableCell className={adminTableCellClass}>
                  <span className="font-medium">{simulado.nome}</span>
                </TableCell>
                <TableCell className={adminTableCellClass}>
                  {simulado.ies_ids.length === 0 ? (
                    <MonoValue muted>0</MonoValue>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <MonoValue className="cursor-default underline decoration-dotted decoration-muted-foreground">
                            {simulado.ies_ids.length}
                          </MonoValue>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{iesNomes.join(', ')}</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className={adminTableCellClass}>
                  <MonoValue>{simulado.questoes_count}</MonoValue>
                </TableCell>
                <TableCell className={adminTableCellClass}>
                  <div className="flex flex-col gap-0.5">
                    <MonoValue className="text-xs">
                      {simulado.data_liberacao ? format(toBrazilDate(simulado.data_liberacao), 'dd/MM/yy HH:mm') : '—'}
                    </MonoValue>
                    <MonoValue className="text-xs" muted>
                      até {simulado.data_encerramento ? format(toBrazilDate(simulado.data_encerramento), 'dd/MM/yy HH:mm') : '—'}
                    </MonoValue>
                  </div>
                </TableCell>
                <TableCell className={adminTableCellClass}>
                  <StatusPill variant={statusInfo.variant}>{statusInfo.label}</StatusPill>
                </TableCell>
                <TableCell className={cnRight(adminTableCellClass)}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" title="Ver questões" onClick={() => handleVerQuestoes(simulado)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Editar" onClick={() => handleEditar(simulado)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Exportar questões" onClick={() => handleExportar(simulado)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {simulado.status === 'ativo' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Encerrar simulado"
                        onClick={() => handleAbrirEncerrar(simulado)}
                      >
                        <StopCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </AdminTable>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleNovoSimulado}>
          <Plus className="h-4 w-4 mr-2" /> Novo simulado
        </Button>
      </div>

      {renderBody()}

      <SimuladoConfigDialog
        open={configOpen}
        onOpenChange={handleConfigOpenChange}
        mode={configMode}
        simulado={editingSimulado}
        iesList={iesList}
        onSaved={handleSaved}
      />

      <QuestoesDialog
        open={questoesOpen}
        onOpenChange={setQuestoesOpen}
        simuladoId={questoesTarget?.id ?? null}
        simuladoNome={questoesTarget?.nome ?? ''}
      />

      <DangerZone
        open={encerrarOpen}
        onOpenChange={setEncerrarOpen}
        level="medium"
        title={`Encerrar "${encerrarTarget?.nome ?? ''}"`}
        impact="Os alunos perdem acesso imediatamente ao simulado. Esta ação não pode ser desfeita."
        actionLabel={encerrando ? 'Encerrando…' : 'Encerrar simulado'}
        loading={encerrando}
        onConfirm={handleConfirmEncerrar}
      />
    </div>
  );
}

/** Alinha à direita preservando as classes base da célula/cabeçalho mono. */
function cnRight(base: string) {
  return `${base} text-right`;
}
