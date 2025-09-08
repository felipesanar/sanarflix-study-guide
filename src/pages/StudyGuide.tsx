
import React, { useState, useEffect } from 'react';
import { StudySemesterSelector } from '@/components/StudySemesterSelector';
import { StudyMateriaCard } from '@/components/StudyMateriaCard';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { studyGuideApi, ApiSemestre, ApiMateria } from '@/services/studyGuideApi';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const StudyGuide: React.FC = () => {
  const { user } = useAuth();
  const [semestres, setSemestres] = useState<ApiSemestre[]>([]);
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null);
  const [materias, setMaterias] = useState<ApiMateria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar semestres disponíveis da IES do usuário
  useEffect(() => {
    const loadSemestres = async () => {
      if (!user?.id_ies) {
        setError('Usuário não vinculado a uma IES');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const semestresList = await studyGuideApi.getSemestresByIES(user.id_ies);
        setSemestres(semestresList);
        
        // Auto-selecionar o semestre atual do usuário se disponível
        if (user.semestre && semestresList.find(s => s.numero === user.semestre)) {
          setSelectedSemestre(user.semestre);
        }
      } catch (err) {
        console.error('Erro ao carregar semestres:', err);
        setError('Erro ao carregar semestres disponíveis');
        toast({
          title: "Erro",
          description: "Não foi possível carregar os semestres disponíveis",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSemestres();
  }, [user]);

  // Carregar matérias quando um semestre for selecionado
  useEffect(() => {
    const loadMaterias = async () => {
      if (!user?.id_ies || !selectedSemestre) {
        setMaterias([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const materiasList = await studyGuideApi.getMateriasBySemestre(user.id_ies, selectedSemestre);
        setMaterias(materiasList);
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
  };

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

      {/* Semester Selector */}
      <StudySemesterSelector
        semestres={semestres}
        selectedSemestre={selectedSemestre}
        onSemestreChange={handleSemestreChange}
        isLoading={isLoading}
      />

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
                Conteúdos - {selectedSemestre}º Semestre
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({materias.length} {materias.length === 1 ? 'matéria' : 'matérias'})
                </span>
              </h2>
            </div>

            <div className="space-y-6">
              {materias.map((materia) => (
                <StudyMateriaCard key={materia.id} materia={materia} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
