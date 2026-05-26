import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Loader2, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toBrazilDate } from '@/utils/timezone';
import { Logger } from '@/utils/logger';

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface Simulado {
  id: string;
  nome: string;
}

interface SimuladoFinalizado {
  id: string;
  simulado_id: string;
  finalizado_em: string;
  tempo_total_segundos: number;
  liberado_novamente: boolean;
}

interface LiberarSimuladoModalProps {
  open: boolean;
  onClose: () => void;
}

export const LiberarSimuladoModal = ({ open, onClose }: LiberarSimuladoModalProps) => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [simuladosFinalizados, setSimuladosFinalizados] = useState<SimuladoFinalizado[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState<string>('');
  const [selectedSimulado, setSelectedSimulado] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSimulados, setLoadingSimulados] = useState(false);
  const [liberando, setLiberando] = useState(false);

  useEffect(() => {
    if (open) {
      carregarUsuarios();
      carregarSimulados();
    }
  }, [open]);

  useEffect(() => {
    if (selectedUsuario) {
      carregarSimuladosFinalizados();
    } else {
      setSimuladosFinalizados([]);
    }
  }, [selectedUsuario]);

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email')
        .order('nome');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error: any) {
      Logger.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const carregarSimulados = async () => {
    try {
      const { data, error } = await supabase
        .from('simulados_admin')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      setSimulados(data || []);
    } catch (error: any) {
      Logger.error('Erro ao carregar simulados:', error);
    }
  };

  const carregarSimuladosFinalizados = async () => {
    try {
      setLoadingSimulados(true);
      const { data, error } = await supabase
        .from('simulados_finalizados')
        .select('*')
        .eq('user_id', selectedUsuario)
        .order('finalizado_em', { ascending: false });

      if (error) throw error;
      setSimuladosFinalizados(data || []);
    } catch (error: any) {
      Logger.error('Erro ao carregar simulados finalizados:', error);
      toast.error('Erro ao carregar simulados do aluno');
    } finally {
      setLoadingSimulados(false);
    }
  };

  const handleLiberar = async () => {
    if (!selectedUsuario || !selectedSimulado) {
      toast.error('Selecione um aluno e um simulado');
      return;
    }

    try {
      setLiberando(true);

      const { error } = await supabase
        .from('simulados_finalizados')
        .update({
          liberado_novamente: true,
          liberado_em: new Date().toISOString(),
          liberado_por: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('user_id', selectedUsuario)
        .eq('simulado_id', selectedSimulado);

      if (error) throw error;

      toast.success('Simulado liberado com sucesso!');
      await carregarSimuladosFinalizados();
      setSelectedSimulado('');
    } catch (error: any) {
      Logger.error('Erro ao liberar simulado:', error);
      toast.error('Erro ao liberar simulado');
    } finally {
      setLiberando(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSimuladoNome = (simuladoId: string) => {
    const sim = simulados.find(s => s.id === simuladoId);
    return sim?.nome || 'Simulado não encontrado';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liberar Simulado para Aluno</DialogTitle>
          <DialogDescription>
            Libere novamente um simulado finalizado para que o aluno possa refazê-lo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seleção de Usuário */}
          <div className="space-y-2">
            <Label>Aluno</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  usuariosFiltrados.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome} - {usuario.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Simulados Finalizados do Aluno */}
          {selectedUsuario && (
            <div className="space-y-2">
              <Label>Simulados Finalizados por este Aluno</Label>
              {loadingSimulados ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : simuladosFinalizados.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                  Este aluno ainda não finalizou nenhum simulado
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                  {simuladosFinalizados.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{getSimuladoNome(sf.simulado_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          Finalizado em {format(toBrazilDate(sf.finalizado_em), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      {sf.liberado_novamente ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Liberado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Finalizado</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seleção de Simulado para Liberar */}
          {selectedUsuario && simuladosFinalizados.length > 0 && (
            <div className="space-y-2">
              <Label>Simulado a Liberar</Label>
              <Select value={selectedSimulado} onValueChange={setSelectedSimulado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um simulado para liberar" />
                </SelectTrigger>
                <SelectContent>
                  {simuladosFinalizados
                    .filter(sf => !sf.liberado_novamente)
                    .map((sf) => (
                      <SelectItem key={sf.id} value={sf.simulado_id}>
                        {getSimuladoNome(sf.simulado_id)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={liberando}>
            Cancelar
          </Button>
          <Button
            onClick={handleLiberar}
            disabled={!selectedUsuario || !selectedSimulado || liberando}
          >
            {liberando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Liberar Simulado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
