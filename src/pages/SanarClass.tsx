import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  BookOpen, 
  Download, 
  Eye, 
  FileText, 
  Filter, 
  X, 
  GraduationCap,
  Sparkles,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SanarClassLesson {
  id: string;
  titulo: string;
  professor: string;
  disciplina: string;
  semestre: number;
  formato: 'pdf' | 'pptx';
  data_publicacao: string;
  arquivo_url: string;
  preview_url: string | null;
  ies_id: string;
}

export default function SanarClass() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<SanarClassLesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<SanarClassLesson[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>("all");
  const [selectedSemestre, setSelectedSemestre] = useState<string>("all");
  const [selectedFormato, setSelectedFormato] = useState<string>("all");
  
  // Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<SanarClassLesson | null>(null);

  // Opções únicas para filtros
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [semestres, setSemestres] = useState<number[]>([]);

  useEffect(() => {
    fetchLessons();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [lessons, searchTerm, selectedDisciplina, selectedSemestre, selectedFormato]);

  const fetchLessons = async () => {
    if (!user?.id_ies) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sanarclass_lessons')
        .select('*')
        .eq('ies_id', user.id_ies)
        .order('data_publicacao', { ascending: false });

      if (error) throw error;

      setLessons((data as SanarClassLesson[]) || []);
      
      // Extrair valores únicos para filtros
      const uniqueDisciplinas = [...new Set(data?.map(l => l.disciplina) || [])];
      const uniqueSemestres = [...new Set(data?.map(l => l.semestre) || [])].sort((a, b) => a - b);
      
      setDisciplinas(uniqueDisciplinas);
      setSemestres(uniqueSemestres);
    } catch (error) {
      console.error('Erro ao buscar aulas:', error);
      toast.error('Erro ao carregar aulas do SanarClass');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...lessons];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(lesson =>
        lesson.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lesson.professor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por disciplina
    if (selectedDisciplina !== "all") {
      filtered = filtered.filter(lesson => lesson.disciplina === selectedDisciplina);
    }

    // Filtro por semestre
    if (selectedSemestre !== "all") {
      filtered = filtered.filter(lesson => lesson.semestre === parseInt(selectedSemestre));
    }

    // Filtro por formato
    if (selectedFormato !== "all") {
      filtered = filtered.filter(lesson => lesson.formato === selectedFormato);
    }

    setFilteredLessons(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDisciplina("all");
    setSelectedSemestre("all");
    setSelectedFormato("all");
  };

  const handleViewLesson = (lesson: SanarClassLesson) => {
    setSelectedLesson(lesson);
    setViewModalOpen(true);
  };

  const handleDownload = (lesson: SanarClassLesson) => {
    window.open(lesson.arquivo_url, '_blank');
    toast.success('Download iniciado');
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando aulas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Parceria Sanarflix</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                SanarClass
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Todas as aulas feitas pelos professores da sua instituição em parceria com o Sanarflix
            </p>
            
            <Button 
              size="lg" 
              onClick={() => setInfoModalOpen(true)}
              className="gap-2"
            >
              <GraduationCap className="h-5 w-5" />
              Peça uma nova aula com seu professor
            </Button>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Busca */}
              <div className="relative">
                <Input
                  placeholder="Buscar por nome da aula ou professor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>

              {/* Filtros em grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedDisciplina} onValueChange={setSelectedDisciplina}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as disciplinas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {disciplinas.map(disc => (
                      <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSemestre} onValueChange={setSelectedSemestre}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os semestres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os semestres</SelectItem>
                    {semestres.map(sem => (
                      <SelectItem key={sem} value={sem.toString()}>{sem}º Semestre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedFormato} onValueChange={setSelectedFormato}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os formatos</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="w-full sm:w-auto gap-2"
                size="sm"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Grade de Aulas */}
      <section className="px-4 pb-16">
        <div className="container mx-auto max-w-6xl">
          {filteredLessons.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center space-y-4">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <div>
                  <h3 className="text-lg font-semibold">Nenhuma aula encontrada</h3>
                  <p className="text-muted-foreground">
                    {lessons.length === 0 
                      ? "Ainda não há aulas disponíveis do SanarClass para sua instituição" 
                      : "Tente ajustar os filtros para encontrar outras aulas"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLessons.map((lesson) => (
                <Card 
                  key={lesson.id} 
                  className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 overflow-hidden"
                >
                  {/* Preview */}
                  {lesson.preview_url && (
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <img 
                        src={lesson.preview_url} 
                        alt={lesson.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="shrink-0">
                        {lesson.formato.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {lesson.semestre}º Sem
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      {lesson.titulo}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span className="text-sm font-medium">{lesson.professor}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3" />
                        <span className="text-sm">{lesson.disciplina}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(lesson.data_publicacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-2">
                    <Button 
                      variant="default" 
                      className="w-full gap-2"
                      onClick={() => handleViewLesson(lesson)}
                    >
                      <Eye className="h-4 w-4" />
                      Visualizar
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => handleDownload(lesson)}
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Seção de Incentivo */}
      <section className="px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                Quer uma aula do Sanarflix com seus professores?
              </CardTitle>
              <CardDescription className="text-base">
                Sua turma pode criar novas aulas com o Sanarflix.<br />
                Converse com seu professor e peça para ele solicitar diretamente ao nosso time.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <Button size="lg" onClick={() => setInfoModalOpen(true)} className="gap-2">
                <GraduationCap className="h-5 w-5" />
                Saiba como solicitar
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Modal de Visualização */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLesson && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedLesson.titulo}</DialogTitle>
                <DialogDescription className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedLesson.professor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{selectedLesson.disciplina}</span>
                    <Badge variant="outline" className="ml-2">
                      {selectedLesson.semestre}º Semestre
                    </Badge>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2">
                <iframe
                  src={selectedLesson.arquivo_url}
                  className="w-full h-full"
                  title={selectedLesson.titulo}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => handleDownload(selectedLesson)}
                  className="gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => setViewModalOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Informações */}
      <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Como solicitar uma aula SanarClass
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Converse com seu professor</h4>
                  <p className="text-sm text-muted-foreground">
                    Escolha um tema relevante e apresente a ideia de criar uma aula em parceria com o Sanarflix
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Professor entra em contato</h4>
                  <p className="text-sm text-muted-foreground">
                    Seu professor deve entrar em contato com o time do Sanarflix para formalizar a parceria
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Produção da aula</h4>
                  <p className="text-sm text-muted-foreground">
                    Nossa equipe auxilia na produção e disponibiliza a aula aqui no SanarClass
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <p className="text-sm font-medium">
                💡 Dica: Aulas sobre temas específicos da sua região ou casos clínicos locais são excelentes sugestões!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}