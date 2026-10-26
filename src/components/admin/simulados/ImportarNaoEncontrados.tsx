import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { NaoEncontradoItem } from './importar-respostas-types';

export function ImportarNaoEncontrados({ itens, simuladoNome }: { itens: NaoEncontradoItem[]; simuladoNome: string }) {
  const [busca, setBusca] = useState('');
  const [motivo, setMotivo] = useState('');
  const motivos = useMemo(() => Array.from(new Set(itens.map((i) => i.motivo))), [itens]);
  const filtrados = itens.filter(
    (i) => (!motivo || i.motivo === motivo) && i.identificador.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  if (itens.length === 0) return null;

  const baixar = () => {
    const ws = XLSX.utils.json_to_sheet(
      itens.map((i) => ({ Linha: i.linha ?? '', 'Matrícula/RA ou e-mail': i.identificador, Motivo: i.motivo })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não encontrados');
    const slug = simuladoNome.replace(/[^\w-]+/g, '-').slice(0, 60) || 'simulado';
    XLSX.writeFile(wb, `nao-encontrados-${slug}.xlsx`);
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <UserX className="h-4 w-4 text-destructive" /> Alunos não encontrados ({itens.length})
        </h3>
        <Button size="sm" variant="outline" onClick={baixar}>
          <Download className="mr-2 h-4 w-4" /> Baixar lista (.xlsx)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Estas linhas ficarão de fora da importação.</p>
      <div className="flex flex-wrap gap-2">
        <Input className="h-8 max-w-xs" placeholder="Buscar RA ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {motivos.length > 1 && (
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Filtrar por motivo"
          >
            <option value="">Todos os motivos</option>
            {motivos.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Linha</th>
              <th className="px-3 py-2">Matrícula/RA ou e-mail</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i, idx) => (
              <tr key={`${i.identificador}-${idx}`} className="border-t">
                <td className="px-3 py-2 font-mono tabular-nums">{i.linha ?? '—'}</td>
                <td className="px-3 py-2 font-mono">{i.identificador || '(em branco)'}</td>
                <td className="px-3 py-2">{i.motivo}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Nenhum resultado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
