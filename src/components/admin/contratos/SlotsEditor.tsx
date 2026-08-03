import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminTable, adminTableCellClass, adminTableHeadClass } from '@/experiences/admin/ui';
import type {
  IesContrato,
  Modalidade,
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
  onSalvarAgenda: (simuladoId: string, modalidade: Modalidade | null, dataRealizacao: string | null, dataLiberacao: string | null, definitiva: boolean) => void;
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

/** ISO → valor de `<input type="datetime-local">` (`yyyy-MM-ddTHH:mm`), em hora local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  onSalvarAgenda,
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
                    Vincule um simulado para definir modalidade e datas.
                  </span>
                ) : (
                  <AgendaFields
                    simulado={slot.simulado}
                    simuladoId={slot.simulado_id}
                    saving={saving}
                    onSalvar={onSalvarAgenda}
                  />
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

interface AgendaFieldsProps {
  simulado: SimuladoAgenda | null;
  simuladoId: string;
  saving: boolean;
  onSalvar: SlotsEditorProps['onSalvarAgenda'];
}

/**
 * Modalidade + datas do simulado do slot (spec §6.4): ONLINE tem data de
 * início (quando aparece pro aluno); PRESENCIAL tem só data de realização.
 * "Data definitiva" sincroniza `data_agendada_original` e faz a tag
 * "Reagendado" sumir — sem marcar, remarcar mantém a tag.
 */
const AgendaFields: React.FC<AgendaFieldsProps> = ({ simulado, simuladoId, saving, onSalvar }) => {
  const [modalidade, setModalidade] = useState<Modalidade | ''>(simulado?.modalidade ?? '');
  const [data, setData] = useState(
    toLocalInput(simulado?.data_realizacao ?? simulado?.data_liberacao ?? null),
  );
  const [definitiva, setDefinitiva] = useState(false);

  useEffect(() => {
    setModalidade(simulado?.modalidade ?? '');
    setData(toLocalInput(simulado?.data_realizacao ?? simulado?.data_liberacao ?? null));
    setDefinitiva(false);
  }, [simulado]);

  const iso = data === '' ? null : new Date(data).toISOString();
  const invalido = modalidade === '' || iso === null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Modalidade do simulado ${simulado?.nome ?? simuladoId}`}
          className={`${selectClass} max-w-[9rem]`}
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value as Modalidade | '')}
        >
          <option value="">Sem modalidade</option>
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
        </select>
        <Input
          aria-label={
            modalidade === 'online'
              ? `Data de início do simulado ${simulado?.nome ?? simuladoId}`
              : `Data de realização do simulado ${simulado?.nome ?? simuladoId}`
          }
          type="datetime-local"
          className="max-w-[13rem]"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={definitiva}
          onChange={(e) => setDefinitiva(e.target.checked)}
          aria-label={`Data definitiva do simulado ${simulado?.nome ?? simuladoId}`}
        />
        Data definitiva (remove a tag “Reagendado”)
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={saving || invalido}
        onClick={() =>
          onSalvar(
            simuladoId,
            modalidade === '' ? null : modalidade,
            modalidade === 'presencial' ? iso : null,
            modalidade === 'online' ? iso : null,
            definitiva,
          )
        }
      >
        Salvar agenda
      </Button>
    </div>
  );
};
