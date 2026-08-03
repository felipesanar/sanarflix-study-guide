import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IesContrato, UpsertIesContratoInput } from '@/services/admin/contratoSimulados';

export interface ContratoFormProps {
  iesId: string;
  /** `undefined` = formulário de criação; preenchido = edição. */
  contrato?: IesContrato;
  saving: boolean;
  onSubmit: (input: UpsertIesContratoInput) => void;
  /** Só aparece em modo edição. */
  onDelete?: () => void;
}

/**
 * Formulário do contrato de simulados de uma IES (spec §6.2/§6.3): nome,
 * quantos simulados a IES tem direito e vigência. Em modo edição o "nome do
 * contrato" é a chave natural do upsert (`ies_id` + nome) — mudar o nome CRIA
 * outro contrato em vez de renomear, e o campo avisa isso.
 */
export const ContratoForm: React.FC<ContratoFormProps> = ({ iesId, contrato, saving, onSubmit, onDelete }) => {
  const [nome, setNome] = useState(contrato?.nome_contrato ?? '');
  const [contratados, setContratados] = useState(String(contrato?.simulados_contratados ?? ''));
  const [inicio, setInicio] = useState(contrato?.vigencia_inicio ?? '');
  const [fim, setFim] = useState(contrato?.vigencia_fim ?? '');

  // Troca de IES/contrato recarrega o formulário com os dados novos.
  useEffect(() => {
    setNome(contrato?.nome_contrato ?? '');
    setContratados(String(contrato?.simulados_contratados ?? ''));
    setInicio(contrato?.vigencia_inicio ?? '');
    setFim(contrato?.vigencia_fim ?? '');
  }, [contrato, iesId]);

  const qtd = Number.parseInt(contratados, 10);
  const erro =
    nome.trim().length === 0
      ? 'Informe o nome do contrato.'
      : !Number.isFinite(qtd) || qtd <= 0
        ? 'Simulados contratados deve ser maior que zero.'
        : inicio === '' || fim === ''
          ? 'Informe a vigência (início e fim).'
          : fim < inicio
            ? 'A vigência termina antes de começar.'
            : contrato && qtd < contrato.slots.length
              ? `O contrato já tem ${contrato.slots.length} slot(s); remova slots antes de reduzir para ${qtd}.`
              : null;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="contrato-nome">Nome do contrato</Label>
          <Input
            id="contrato-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Contrato 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-qtd">Simulados contratados</Label>
          <Input
            id="contrato-qtd"
            type="number"
            min={1}
            value={contratados}
            onChange={(e) => setContratados(e.target.value)}
            placeholder="7"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-inicio">Vigência — início</Label>
          <Input id="contrato-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-fim">Vigência — fim</Label>
          <Input id="contrato-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={saving || erro !== null}
          onClick={() =>
            onSubmit({
              iesId,
              nome: nome.trim(),
              simuladosContratados: qtd,
              vigenciaInicio: inicio,
              vigenciaFim: fim,
            })
          }
        >
          {contrato ? 'Salvar contrato' : 'Criar contrato'}
        </Button>
        {contrato && onDelete && (
          <Button variant="outline" disabled={saving} onClick={onDelete}>
            Excluir contrato
          </Button>
        )}
        {contrato && (
          <span className="text-xs text-muted-foreground">
            O nome é a chave do contrato — alterá-lo cria um contrato novo em vez de renomear.
          </span>
        )}
      </div>
    </div>
  );
};
