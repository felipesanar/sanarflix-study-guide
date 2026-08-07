import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminTable, adminTableCellClass, adminTableHeadClass } from '@/experiences/admin/ui';
import type {
  IesContrato,
  SimuladoAgenda,
  SlotPrevistoInput,
} from '@/services/admin/contratoSimulados';

/**
 * `<select>` NATIVO com as classes do trigger shadcn. Divergência deliberada
 * do Radix Select usado no resto do admin: testar Radix no jsdom exige stub de
 * `hasPointerCapture`/`scrollIntoView` e caçar a opção portalizada no body
 * (ver `src/test/components/admin/IesFeaturesBoard.test.tsx:170-184`) — com
 * vários selects por linha de tabela isso fica intratável.
 */
const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface SlotsEditorProps {
  contrato: IesContrato;
  simuladosDisponiveis: SimuladoAgenda[];
  saving: boolean;
  onSalvarSlots: (slots: SlotPrevistoInput[]) => void;
}

interface SlotDraft extends SlotPrevistoInput {
  simulado: SimuladoAgenda | null;
}

const toDraft = (contrato: IesContrato): SlotDraft[] =>
  contrato.slots.map((s) => ({
    ordem: s.ordem,
    nome_previsto: s.nome_previsto,
    simulado_id: s.simulado_id,
    simulado: s.simulado,
  }));

/** ISO → `dd/mm/aaaa hh:mm` em pt-BR, hora local. Ausente vira "—" (nunca zero/vazio). */
function formatDataHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const ROTULO_MODALIDADE: Record<'online' | 'presencial', string> = {
  online: 'Online',
  presencial: 'Presencial',
};

/**
 * Editor dos slots de um contrato (spec §6.2): cada linha é um slot; slot sem
 * `simulado_id` é "A definir" e existe só para o gestor ver quantos simulados
 * a IES tem direito. Salva o array COMPLETO via `admin_set_ies_simulados_previstos`
 * (é sync, não append).
 */
export const SlotsEditor: React.FC<SlotsEditorProps> = ({
  contrato,
  simuladosDisponiveis,
  saving,
  onSalvarSlots,
}) => {
  const [slots, setSlots] = useState<SlotDraft[]>(() => toDraft(contrato));

  useEffect(() => {
    setSlots(toDraft(contrato));
  }, [contrato]);

  const limite = contrato.simulados_contratados;
  const acimaDoContratado = slots.length > limite;
  const lotado = slots.length >= limite;

  const sujo = useMemo(
    () =>
      JSON.stringify(slots.map(({ simulado: _simulado, ...s }) => s)) !==
      JSON.stringify(toDraft(contrato).map(({ simulado: _simulado, ...s }) => s)),
    [slots, contrato],
  );

  const vincular = (ordem: number, simuladoId: string) =>
    setSlots((prev) =>
      prev.map((s) =>
        s.ordem === ordem
          ? {
              ...s,
              simulado_id: simuladoId === '' ? null : simuladoId,
              simulado: simuladosDisponiveis.find((sim) => sim.id === simuladoId) ?? null,
            }
          : s,
      ),
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {slots.length} slot(s) de {limite} contratado(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={lotado || saving}
            onClick={() =>
              setSlots((prev) => [
                ...prev,
                {
                  ordem: prev.reduce((max, s) => Math.max(max, s.ordem), 0) + 1,
                  nome_previsto: null,
                  simulado_id: null,
                  simulado: null,
                },
              ])
            }
          >
            Adicionar slot
          </Button>
          <Button
            size="sm"
            disabled={saving || acimaDoContratado || !sujo}
            onClick={() => onSalvarSlots(slots.map(({ simulado: _simulado, ...s }) => s))}
          >
            Salvar slots
          </Button>
        </div>
      </div>

      {acimaDoContratado && (
        <p className="text-sm text-destructive">
          {slots.length} slot(s) para {limite} simulado(s) contratado(s) — remova slots ou aumente o contrato antes de salvar.
        </p>
      )}
      {!acimaDoContratado && lotado && (
        <p className="text-xs text-muted-foreground">
          Limite de {limite} slot(s) do contrato atingido. Aumente “Simulados contratados” para criar mais.
        </p>
      )}

      <AdminTable>
        <TableHeader>
          <TableRow>
            <TableHead className={adminTableHeadClass}>#</TableHead>
            <TableHead className={adminTableHeadClass}>Nome previsto</TableHead>
            <TableHead className={adminTableHeadClass}>Simulado vinculado</TableHead>
            <TableHead className={adminTableHeadClass}>Modalidade e datas</TableHead>
            <TableHead className={adminTableHeadClass} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <TableRow key={slot.ordem}>
              <TableCell className={`${adminTableCellClass} font-mono`}>{slot.ordem}</TableCell>
              <TableCell className={adminTableCellClass}>
                <Input
                  aria-label={`Nome previsto do slot ${slot.ordem}`}
                  value={slot.nome_previsto ?? ''}
                  placeholder="Simulado 1"
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((s) =>
                        s.ordem === slot.ordem
                          ? { ...s, nome_previsto: e.target.value === '' ? null : e.target.value }
                          : s,
                      ),
                    )
                  }
                />
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <select
                  aria-label={`Simulado do slot ${slot.ordem}`}
                  className={selectClass}
                  value={slot.simulado_id ?? ''}
                  onChange={(e) => vincular(slot.ordem, e.target.value)}
                >
                  <option value="">A definir</option>
                  {simuladosDisponiveis.map((sim) => (
                    <option key={sim.id} value={sim.id}>
                      {sim.nome}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                {slot.simulado_id == null ? (
                  <span className="text-xs text-muted-foreground">
                    Vincule um simulado para ver modalidade e datas.
                  </span>
                ) : (
                  <AgendaLeitura simulado={slot.simulado} />
                )}
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setSlots((prev) => prev.filter((s) => s.ordem !== slot.ordem))}
                >
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </AdminTable>
    </div>
  );
};

interface AgendaLeituraProps {
  simulado: SimuladoAgenda | null;
}

/**
 * Modalidade + datas do simulado do slot, em modo SOMENTE LEITURA (spec §6.4):
 * ONLINE usa `data_liberacao` (quando aparece pro aluno); PRESENCIAL usa
 * `data_realizacao`. A escrita desses campos não é desta tela — ver
 * `admin_update_simulado` na tela de configuração do simulado.
 *
 * NÃO exibe a tag "Reagendado" de propósito. Quem deriva isso é o banco, em
 * `admin_update_simulado`: `data_agendada_original IS NOT NULL AND
 * data_agendada_original <> COALESCE(data_realizacao, data_liberacao)`.
 * Recalcular aqui divergiria em dois pontos — a base do COALESCE não olha a
 * modalidade, e comparar as datas como string ISO daria falso positivo entre
 * fusos que representam o mesmo instante. Este projeto já tem 5 réguas de
 * desempenho incompatíveis por reimplementar regra do servidor no cliente.
 * Para mostrar a tag aqui, `admin_get_ies_contratos` precisa devolver o
 * booleano já calculado.
 */
const AgendaLeitura: React.FC<AgendaLeituraProps> = ({ simulado }) => {
  const modalidade = simulado?.modalidade ?? null;
  const dataPrincipal =
    modalidade === 'online'
      ? (simulado?.data_liberacao ?? null)
      : modalidade === 'presencial'
        ? (simulado?.data_realizacao ?? null)
        : null;

  return (
    <div className="space-y-1 text-xs">
      <p>
        <span className="text-muted-foreground">Modalidade: </span>
        {modalidade ? ROTULO_MODALIDADE[modalidade] : '—'}
      </p>
      <p>
        <span className="text-muted-foreground">
          {modalidade === 'online' ? 'Início: ' : 'Realização: '}
        </span>
        {formatDataHora(dataPrincipal)}
      </p>
      <p>
        <span className="text-muted-foreground">Encerramento: </span>
        {formatDataHora(simulado?.data_encerramento ?? null)}
      </p>
      <p className="text-muted-foreground">
        Modalidade e datas se editam na tela de configuração do simulado.
      </p>
    </div>
  );
};
