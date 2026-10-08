import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { importarVinculos, type ImportacaoResultado, type LinhaVinculo } from '@/services/admin/mentores';
import { parseVinculosFile } from '@/components/admin/mentores/parseVinculosFile';

interface Props {
  open: boolean;
  mentorId: string;
  mentorNome: string;
  onOpenChange: (open: boolean) => void;
}

const MOTIVO: Record<string, string> = {
  email_invalido: 'e-mail inválido',
  duplicado_na_planilha: 'repetido na planilha',
};

/**
 * Importa os alunos de um mentor (tela A1). Fluxo: escolher arquivo →
 * simulação no banco (dry run) → admin decide se troca quem já tem outro
 * mentor → aplica. Um aluno tem um mentor por vez; trocar encerra o vínculo
 * anterior, sem apagar.
 */
export const ImportVinculosDialog: React.FC<Props> = ({ open, mentorId, mentorNome, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = React.useState<LinhaVinculo[]>([]);
  const [simulacao, setSimulacao] = React.useState<ImportacaoResultado | null>(null);
  const [aplicado, setAplicado] = React.useState<ImportacaoResultado | null>(null);
  const [trocar, setTrocar] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setAplicado(null);
    setOcupado(true);
    try {
      const lidas = await parseVinculosFile(file);
      setLinhas(lidas);
      setSimulacao(await importarVinculos({ mentorId, linhas: lidas, trocar: false, dryRun: true }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setOcupado(false);
    }
  };

  const aplicar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await importarVinculos({ mentorId, linhas, trocar, dryRun: false });
      setAplicado(resultado);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mentores'] });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'A importação falhou.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar alunos de {mentorNome}</DialogTitle>
          <DialogDescription>Planilha .xlsx ou .csv com a coluna "email" (e "nome", opcional).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="planilha-vinculos">Planilha de alunos</Label>
            <input id="planilha-vinculos" type="file" accept=".xlsx,.xls,.csv" onChange={onArquivo} disabled={ocupado} />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {simulacao && !aplicado && (
            <div className="space-y-2 text-sm">
              <p>
                {simulacao.total} linhas: {simulacao.novos} novos, {simulacao.ja_com_este_mentor} já são deste mentor,{' '}
                {simulacao.com_outro_mentor.length} com outro mentor, {simulacao.invalidos.length} com problema.
              </p>
              {simulacao.com_outro_mentor.length > 0 && (
                <ul className="max-h-32 overflow-auto rounded border p-2">
                  {simulacao.com_outro_mentor.map((c) => (
                    <li key={c.email}>
                      {c.email} · hoje com {c.mentor_atual_nome ?? 'outro mentor'}
                    </li>
                  ))}
                </ul>
              )}
              {simulacao.invalidos.length > 0 && (
                <ul className="max-h-32 overflow-auto rounded border p-2">
                  {simulacao.invalidos.map((i) => (
                    <li key={i.ordem}>
                      Item {i.ordem}: {i.email || '(vazio)'} · {MOTIVO[i.motivo] ?? i.motivo}
                    </li>
                  ))}
                </ul>
              )}
              {simulacao.com_outro_mentor.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox id="trocar-mentor" checked={trocar} onCheckedChange={(v) => setTrocar(v === true)} />
                  <Label htmlFor="trocar-mentor">Trocar o mentor de quem já tem outro</Label>
                </div>
              )}
            </div>
          )}

          {aplicado && (
            <p className="text-sm">
              {aplicado.inseridos} alunos vinculados
              {aplicado.trocados > 0 ? `, ${aplicado.trocados} trocados de mentor` : ''}.
            </p>
          )}
        </div>

        <DialogFooter>
          {!aplicado && (
            <Button onClick={aplicar} disabled={!simulacao || ocupado || (simulacao.novos === 0 && !(trocar && simulacao.com_outro_mentor.length > 0))}>
              Aplicar importação
            </Button>
          )}
          {aplicado && <Button onClick={() => onOpenChange(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
