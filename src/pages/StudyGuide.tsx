
import React, { useState, useEffect } from 'react';
import { StudySemesterSelector } from '@/components/StudySemesterSelector';
import { StudyMateriaCard } from '@/components/StudyMateriaCard';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { studyGuideApi, ApiSemestre, ApiMateria } from '@/services/studyGuideApi';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Cache key for localStorage
const getCacheKey = (iesName: string) => `study-guide-${iesName}`;

export const StudyGuide: React.FC = () => {
  const { user } = useAuth();
  const [semestres, setSemestres] = useState<ApiSemestre[]>([]);
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null);
  const [materias, setMaterias] = useState<ApiMateria[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados do cache ou da API
  useEffect(() => {
    const loadCachedOrFreshData = async () => {
      if (!user?.ies_nome) {
        setError('Usuário não vinculado a uma IES');
        setIsLoading(false);
        return;
      }

      const cacheKey = getCacheKey(user.ies_nome);
      
      try {
        // Tentar carregar do cache primeiro
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { semestres: cachedSemestres, materiasBySemestre, timestamp } = JSON.parse(cached);
          const now = Date.now();
          const oneHour = 60 * 60 * 1000;
          
          // Se o cache é válido (menos de 1 hora), usar dados do cache
          if (now - timestamp < oneHour) {
            setSemestres(cachedSemestres);
            
            // Auto-selecionar o semestre atual do usuário se disponível
            if (user.semestre && cachedSemestres.find((s: ApiSemestre) => s.numero === user.semestre)) {
              setSelectedSemestre(user.semestre);
              if (materiasBySemestre[user.semestre]) {
                setMaterias(materiasBySemestre[user.semestre]);
              }
            }
            setIsLoading(false);
            return;
          }
        }

        // Cache inválido ou inexistente, buscar da API
        setIsLoading(true);
        setError(null);
        
        const semestresList = await studyGuideApi.getSemestresByIES(user.ies_nome);
        setSemestres(semestresList);
        
        // Auto-selecionar o semestre atual do usuário se disponível
        let initialMaterias: ApiMateria[] = [];
        if (user.semestre && semestresList.find(s => s.numero === user.semestre)) {
          setSelectedSemestre(user.semestre);
          try {
            initialMaterias = await studyGuideApi.getMateriasBySemestre(user.ies_nome, user.semestre);
            setMaterias(initialMaterias);
          } catch (err) {
            console.error('Erro ao carregar matérias iniciais:', err);
          }
        }

        // Salvar no cache
        const cacheData = {
          semestres: semestresList,
          materiasBySemestre: user.semestre ? { [user.semestre]: initialMaterias } : {},
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Erro ao carregar dados do guia de estudos');
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do guia de estudos",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedOrFreshData();
  }, [user]);

  // Carregar matérias quando um semestre for selecionado
  useEffect(() => {
    const loadMaterias = async () => {
      if (!user?.ies_nome || !selectedSemestre) {
        setMaterias([]);
        return;
      }

      // Verificar cache primeiro
      const cacheKey = getCacheKey(user.ies_nome);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { materiasBySemestre } = JSON.parse(cached);
        if (materiasBySemestre[selectedSemestre]) {
          setMaterias(materiasBySemestre[selectedSemestre]);
          return;
        }
      }

      try {
        setIsLoading(true);
        setError(null);
        const materiasList = await studyGuideApi.getMateriasBySemestre(user.ies_nome, selectedSemestre);
        setMaterias(materiasList);
        
        // Atualizar cache
        if (cached) {
          const cacheData = JSON.parse(cached);
          cacheData.materiasBySemestre[selectedSemestre] = materiasList;
          cacheData.timestamp = Date.now();
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
      } catch (err) {
        console.error('Erro ao carregar matérias:', err);
        setError('Erro ao carregar conteúdos do semestre');
        toast({
          title: "Erro",
          description: "Não foi possível carregar os conteúdos do semestre",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMaterias();
  }, [user, selectedSemestre]);

  const handleSemestreChange = (semestre: number) => {
    setSelectedSemestre(semestre);
    setSelectedMateria('all'); // Reset materia filter when changing semester
  };

  const handleMateriaChange = (materiaId: string) => {
    setSelectedMateria(materiaId);
  };

  // Filter materias based on selection
  const filteredMaterias = selectedMateria === 'all' 
    ? materias 
    : materias.filter(materia => materia.id === selectedMateria);

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Guia de Estudos</h1>
            <p className="text-muted-foreground">
              {user?.ies_nome}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-input mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Semester Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground whitespace-nowrap">
              Selecionar Semestre:
            </label>
            <div className="min-w-[200px]">
              <Select 
                value={selectedSemestre?.toString() || ''} 
                onValueChange={(value) => handleSemestreChange(parseInt(value))}
                disabled={isLoading || semestres.length === 0}
              >
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue placeholder={isLoading ? "Carregando..." : "Escolha um semestre"} />
                </SelectTrigger>
                <SelectContent>
                  {semestres.map((semestre) => (
                    <SelectItem key={semestre.id} value={semestre.numero.toString()}>
                      {semestre.numero}º Semestre
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Materia Filter */}
          {selectedSemestre && materias.length > 0 && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">
                Filtrar por Matéria:
              </label>
              <div className="min-w-[200px]">
                <Select value={selectedMateria} onValueChange={handleMateriaChange}>
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue placeholder="Todas as matérias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as matérias</SelectItem>
                    {materias.map((materia) => (
                      <SelectItem key={materia.id} value={materia.id}>
                        {materia.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando conteúdos...</span>
          </div>
        ) : !selectedSemestre ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Selecione um semestre
            </h3>
            <p className="text-muted-foreground">
              Escolha um semestre acima para visualizar os conteúdos de estudo.
            </p>
          </div>
        ) : materias.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum conteúdo disponível
            </h3>
            <p className="text-muted-foreground">
              Não há conteúdos disponíveis para este semestre.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedMateria !== 'all' 
                  ? materias.find(m => m.id === selectedMateria)?.nome || 'Matéria'
                  : `Conteúdos - ${selectedSemestre}º Semestre`
                }
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredMaterias.length} {filteredMaterias.length === 1 ? 'matéria' : 'matérias'})
                </span>
              </h2>
            </div>

            <div className="space-y-6">
              {filteredMaterias.map((materia) => (
                <StudyMateriaCard 
                  key={materia.id} 
                  materia={materia} 
                  hideTitle={selectedMateria !== 'all'} 
                  semestre={selectedSemestre!}
                  iesNome={user?.ies_nome || ''}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
