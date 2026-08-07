import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { Label } from '@/components/ui/label';
import { AdminEmpty, AdminError, AdminLoading } from '@/experiences/admin/ui';
import {
  deleteIesContrato,
  fetchIesContratos,
  setIesSimuladosPrevistos,
  upsertIesContrato,
  type IesContratosPayload,
  type SlotPrevistoInput,
  type UpsertIesContratoInput,
} from '@/services/admin/contratoSimulados';
import { ContratoForm } from '@/components/admin/contratos/ContratoForm';
import { SlotsEditor } from '@/components/admin/contratos/SlotsEditor';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Orquestrador de `/admin/contratos` (spec §6.3): seletor de IES, formulário do
 * contrato e editor de slots. É a superfície que o CX/cadastros usa para popular
 * o cronograma — sem ela o Início do gestor nasce sem âncora.
 *
 * Toda escrita vai por RPC de admin (Tasks 9 e 10), nunca `.from().update()`:
 * a derivação de `data_agendada_original` (§6.4) é regra de negócio e precisa
 * de auditoria em `admin_audit_log`.
 */
export const ContratoSimuladosBoard: React.FC = () => {
  const [iesList, setIesList] = useState<{ id: string; nome: string }[]>([]);
  const [iesId, setIesId] = useState<string | null>(null);
  const [payload, setPayload] = useState<IesContratosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Lista de IES — mesmo acesso direto usado em IesFeaturesBoard e ProvasTab.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error: iesError } = await supabase.from('ies').select('id, nome').order('nome');
      if (cancelado) return;
      if (iesError) {
        Logger.error('[ContratoSimuladosBoard] falha ao listar IES:', iesError);
        setError(iesError.message);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setIesList(rows);
      setIesId(rows[0]?.id ?? null);
      if (rows.length === 0) setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!iesId) return;
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchIesContratos(iesId));
    } catch (err) {
      Logger.error('[ContratoSimuladosBoard] falha ao carregar contratos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar contratos da IES');
    } finally {
      setLoading(false);
    }
  }, [iesId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSave = async (label: string, fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      toast.success(`${label} salvo com sucesso.`);
      await load();
    } catch (err) {
      Logger.error(`[ContratoSimuladosBoard] ${label} falhou:`, err);
      toast.error(err instanceof Error ? err.message : `Erro ao salvar ${label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpsert = (input: UpsertIesContratoInput) =>
    runSave('Contrato', () => upsertIesContrato(input));

  const handleDelete = (contratoId: string) =>
    runSave('Exclusão do contrato', () => deleteIesContrato(contratoId));

  const handleSlots = (contratoId: string, slots: SlotPrevistoInput[]) =>
    runSave('Slots', () => setIesSimuladosPrevistos(contratoId, slots));

  const seletorIes = (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="contratos-ies">IES</Label>
      <select
        id="contratos-ies"
        className={selectClass}
        value={iesId ?? ''}
        disabled={saving}
        onChange={(e) => setIesId(e.target.value)}
      >
        {iesList.map((ies) => (
          <option key={ies.id} value={ies.id}>
            {ies.nome}
          </option>
        ))}
      </select>
    </div>
  );

  if (!loading && iesList.length === 0 && !error) {
    return <AdminEmpty title="Nenhuma IES cadastrada" description="Cadastre uma IES antes de criar contratos." />;
  }

  return (
    <div className="space-y-6">
      {seletorIes}

      {loading && <AdminLoading rows={2} rowHeight="h-40" />}
      {!loading && error && <AdminError message={error} onRetry={load} />}

      {!loading && !error && payload && payload.contratos.length === 0 && (
        <div className="space-y-4">
          <AdminEmpty
            title="Nenhum contrato cadastrado"
            description="Sem contrato o cronograma do gestor fica vazio: não há quantos simulados a IES tem direito, nem datas. Crie o contrato abaixo."
          />
          {iesId && <ContratoForm iesId={iesId} saving={saving} onSubmit={handleUpsert} />}
        </div>
      )}

      {!loading && !error && payload &&
        payload.contratos.map((contrato) => (
          <div key={contrato.id} className="space-y-4 rounded-xl border p-4">
            <h2 className="text-lg font-semibold">{contrato.nome_contrato}</h2>
            <ContratoForm
              iesId={payload.ies.id}
              contrato={contrato}
              saving={saving}
              onSubmit={handleUpsert}
              onDelete={() => handleDelete(contrato.id)}
            />
            <SlotsEditor
              contrato={contrato}
              simuladosDisponiveis={payload.simulados_disponiveis}
              saving={saving}
              onSalvarSlots={(slots) => handleSlots(contrato.id, slots)}
            />
          </div>
        ))}

      {!loading && !error && payload && payload.contratos.length > 0 && iesId && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">Adicionar outro contrato</summary>
          <div className="pt-4">
            <ContratoForm iesId={iesId} saving={saving} onSubmit={handleUpsert} />
          </div>
        </details>
      )}
    </div>
  );
};
