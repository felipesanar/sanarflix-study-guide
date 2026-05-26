import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { supabase } from '@/integrations/supabase/client';

import { Simulado } from '@/types/simulado';
import { SimuladoCard } from './SimuladoCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Logger } from '@/utils/logger';

export const SimuladosDisponiveis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTema, setFiltroTema] = useState<string>('todos');
  const [filtroProfessor, setFiltroProfessor] = useState<string>('todos');

  useEffect(() => {
    carregarSimulados();
  }, [user]);

  useEffect(() => {
    const onFinalizado = () => carregarSimulados();
    const onFocus = () => carregarSimulados();
    window.addEventListener('simulado:finalizado', onFinalizado);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('simulado:finalizado', onFinalizado);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Verifica se o desempenho do simulado está liberado
  const verificarDesempenhoLiberado = (sim: any): boolean => {
    const liberacaoDesempenho = sim.liberacao_desempenho || 'imediato';
    const agora = new Date();

    if (liberacaoDesempenho === 'imediato') return true;
    
    if (liberacaoDesempenho === 'agendado' && sim.data_liberacao_desempenho) {
      return agora >= new Date(sim.data_liberacao_desempenho);
    }
    
    if (liberacaoDesempenho === 'ao_encerrar') {
      // Verifica se o simulado está encerrado (por status ou por data)
      if (sim.status === 'encerrado') return true;
      if (sim.data_encerramento && agora >= new Date(sim.data_encerramento)) return true;
      return false;
    }
    
    return true; // Fallback para simulados antigos sem a coluna
  };

  const carregarSimulados = async () => {
    setLoading(true);
    try {
      const dados = await simuladosApi.listarSimulados(user?.id_ies);
      const urlParams = new URLSearchParams(window.location.search);
      const justFinished = urlParams.get('just_finished');

      const { data: finalizados } = await supabase
        .from('simulados_finalizados')
        .select('simulado_id, liberado_novamente')
        .eq('user_id', user.id);

      const finalizadoSet = new Set((finalizados || [])
        .filter((f: any) => !f.liberado_novamente)
        .map((f: any) => String(f.simulado_id)));

      const agora = new Date();
      
      const simuladosComStatus = dados.map((sim) => {
        // Verificar se o simulado está encerrado por tempo
        const isEncerrado = sim.data_encerramento && agora > new Date(sim.data_encerramento);
        
        if (isEncerrado) {
          return { 
            ...sim, 
            status: 'encerrado' as const,
            desempenho_liberado: verificarDesempenhoLiberado({ ...sim, status: 'encerrado' })
          };
        }
        
        const estadoKey = `simulado_${sim.id}_estado`;
        const estadoStr = localStorage.getItem(estadoKey);
        if (estadoStr) {
          return { 
            ...sim, 
            status: 'em_andamento' as const,
            desempenho_liberado: false
          };
        }
        
        const isConcluido = finalizadoSet.has(String(sim.id)) || justFinished === String(sim.id);
        if (isConcluido) {
          return { 
            ...sim, 
            status: 'concluido' as const,
            desempenho_liberado: verificarDesempenhoLiberado(sim)
          };
        }
        
        return { 
          ...sim,
          desempenho_liberado: verificarDesempenhoLiberado(sim)
        };
      });

      setSimulados(simuladosComStatus);
    } catch (error) {
      Logger.error('Erro ao carregar simulados:', error);
      toast.error('Erro ao carregar simulados');
    } finally {
      setLoading(false);
    }
  };

  const handleIniciar = (id: string) => {
    navigate(`/simulados/${id}/prova`);
  };

  const handleContinuar = (id: string) => {
    navigate(`/simulados/${id}/prova`);
  };

  const handleVerDesempenho = (id: string) => {
    navigate('/simulados?aba=desempenho');
  };

  const simuladosFiltrados = simulados.filter(sim => {
    const matchBusca = sim.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                      sim.descricao.toLowerCase().includes(busca.toLowerCase());
    const matchTema = filtroTema === 'todos' || sim.tema === filtroTema;
    const matchProfessor = filtroProfessor === 'todos' || sim.professor === filtroProfessor;
    
    return matchBusca && matchTema && matchProfessor;
  });

  const temas = Array.from(new Set(simulados.map(s => s.tema).filter(Boolean)));
  const professores = Array.from(new Set(simulados.map(s => s.professor).filter(Boolean)));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full md:w-48" />
          <Skeleton className="h-10 w-full md:w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 bg-muted/30 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar simulados..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filtroTema} onValueChange={setFiltroTema}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os temas</SelectItem>
            {temas.map(tema => (
              <SelectItem key={tema} value={tema!}>{tema}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroProfessor} onValueChange={setFiltroProfessor}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Professor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os professores</SelectItem>
            {professores.map(prof => (
              <SelectItem key={prof} value={prof!}>{prof}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Simulados */}
      {simuladosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum simulado encontrado</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou busca
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {simuladosFiltrados.map(simulado => (
            <SimuladoCard
              key={simulado.id}
              simulado={simulado}
              onIniciar={handleIniciar}
              onContinuar={handleContinuar}
              onVerDesempenho={handleVerDesempenho}
            />
          ))}
        </div>
      )}
    </div>
  );
};
