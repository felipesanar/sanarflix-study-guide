import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AdminLoading, AdminError, AdminEmpty } from '@/experiences/admin/ui';
import { listMentores, type MentorAdmin } from '@/services/admin/mentores';
import { CreateMentorDialog } from './CreateMentorDialog';
import { ImportVinculosDialog } from './ImportVinculosDialog';

type Filtro = 'todos' | 'b2c' | 'b2b';

/** Lista de mentores (tela A1): busca, filtro por tipo, criar e importar alunos. */
export const MentoresBoard: React.FC = () => {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'mentores'],
    queryFn: listMentores,
  });
  const [busca, setBusca] = React.useState('');
  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [criando, setCriando] = React.useState(false);
  const [importando, setImportando] = React.useState<MentorAdmin | null>(null);

  const visiveis = data.filter(
    (m) =>
      (filtro === 'todos' || m.tipo === filtro) &&
      `${m.nome} ${m.email} ${m.turma_nome}`.toLowerCase().includes(busca.toLowerCase()),
  );

  if (isLoading) return <AdminLoading />;
  if (isError) return <AdminError message="Não foi possível carregar os mentores." onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Buscar mentor"
          className="h-9 rounded-md border px-3 text-sm"
          placeholder="Buscar por nome, e-mail ou turma"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {(['todos', 'b2c', 'b2b'] as Filtro[]).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f.toUpperCase()}
          </Button>
        ))}
        <Button className="ml-auto" onClick={() => setCriando(true)}>Novo mentor</Button>
      </div>

      {visiveis.length === 0 ? (
        <AdminEmpty title="Nenhum mentor encontrado" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Mentor</th><th>Tipo</th><th>Turma</th><th>Alunos</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.user_id} className="border-t">
                <td className="py-2">
                  <div className="font-medium">{m.nome}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td>{m.tipo.toUpperCase()}</td>
                <td>{m.turma_nome}{m.ies_nome ? ` · ${m.ies_nome}` : ''}</td>
                <td>{m.alunos_ativos}</td>
                <td>{m.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setImportando(m)}>Importar alunos</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateMentorDialog open={criando} onOpenChange={setCriando} />
      {importando && (
        <ImportVinculosDialog
          open
          mentorId={importando.user_id}
          mentorNome={importando.nome}
          onOpenChange={(o) => !o && setImportando(null)}
        />
      )}
    </div>
  );
};
