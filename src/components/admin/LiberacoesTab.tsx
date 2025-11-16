import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Unlock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toBrazilDate } from '@/utils/timezone';

interface SimuladoFinalizado {
  id: string;
  user_id: string;
  simulado_id: string;
  finalizado_em: string;
  tempo_total_segundos: number;
  saidas_de_aba: number;
  liberado_novamente: boolean;
  liberado_em: string | null;
  liberado_por: string | null;
  user_email?: string;
  user_nome?: string;
  simulado_nome?: string;
}

export default function LiberacoesTab() {
  const { toast } = useToast();
  const [finalizacoes, setFinalizacoes] = useState<SimuladoFinalizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [liberando, setLiberando] = useState<string | null>(null);

  useEffect(() => {
    fetchFinalizacoes();
  }, []);

  const fetchFinalizacoes = async () => {
    try {
      setLoading(true);

      // Buscar finalizações com dados de usuários e simulados
      const { data: finalizacoesData, error: finalizacoesError } = await supabase
        .from('simulados_finalizados')
        .select('*')
        .order('finalizado_em', { ascending: false });

      if (finalizacoesError) throw finalizacoesError;

      // Buscar dados de usuários
      const userIds = [...new Set(finalizacoesData?.map(f => f.user_id) || [])];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, nome')
        .in('id', userIds);

      // Buscar dados de simulados
      const simuladoIds = [...new Set(finalizacoesData?.map(f => f.simulado_id) || [])];
      const { data: simuladosData } = await supabase
        .from('simulados_admin')
        .select('id, nome')
        .in('id', simuladoIds);

      // Combinar dados
      const finalizacoesCompletas = finalizacoesData?.map(f => {
        const user = usersData?.find(u => u.id === f.user_id);
        const simulado = simuladosData?.find(s => s.id === f.simulado_id);
        
        return {
          ...f,
          user_email: user?.email,
          user_nome: user?.nome,
          simulado_nome: simulado?.nome
        };
      }) || [];

      setFinalizacoes(finalizacoesCompletas);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar finalizações',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLiberar = async (finalizacaoId: string) => {
    try {
      setLiberando(finalizacaoId);

      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('simulados_finalizados')
        .update({
          liberado_novamente: true,
          liberado_em: new Date().toISOString(),
          liberado_por: userData?.user?.id
        })
        .eq('id', finalizacaoId);

      if (error) throw error;

      toast({
        title: 'Simulado liberado',
        description: 'O aluno poderá realizar o simulado novamente.'
      });

      fetchFinalizacoes();
    } catch (error: any) {
      toast({
        title: 'Erro ao liberar simulado',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLiberando(null);
    }
  };

  const filteredFinalizacoes = finalizacoes.filter(f => {
    const searchLower = searchTerm.toLowerCase();
    return (
      f.user_email?.toLowerCase().includes(searchLower) ||
      f.user_nome?.toLowerCase().includes(searchLower) ||
      f.simulado_nome?.toLowerCase().includes(searchLower)
    );
  });

  const formatTempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    return `${horas}h ${minutos}m`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Liberações de Simulados</CardTitle>
          <CardDescription>
            Gerencie liberações individuais para alunos que tiveram problemas durante a realização de simulados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou simulado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFinalizacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma finalização encontrada</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Tente ajustar os termos de busca' : 'Nenhum aluno finalizou simulados ainda'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Simulado</TableHead>
                    <TableHead>Finalizado em</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Saídas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFinalizacoes.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{f.user_nome || 'Nome não disponível'}</p>
                          <p className="text-sm text-muted-foreground">{f.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {f.simulado_nome || 'Simulado não encontrado'}
                      </TableCell>
                      <TableCell>
                        {format(toBrazilDate(f.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{formatTempo(f.tempo_total_segundos)}</TableCell>
                      <TableCell>
                        {f.saidas_de_aba > 0 ? (
                          <Badge variant="destructive">{f.saidas_de_aba}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.liberado_novamente ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Liberado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Finalizado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!f.liberado_novamente && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLiberar(f.id)}
                            disabled={liberando === f.id}
                            className="gap-2"
                          >
                            {liberando === f.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Liberando...
                              </>
                            ) : (
                              <>
                                <Unlock className="h-4 w-4" />
                                Liberar
                              </>
                            )}
                          </Button>
                        )}
                        {f.liberado_novamente && f.liberado_em && (
                          <p className="text-xs text-muted-foreground">
                            Liberado em {format(toBrazilDate(f.liberado_em), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
