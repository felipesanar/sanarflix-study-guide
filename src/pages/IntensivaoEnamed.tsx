import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Video, FileText, Clock, Calendar, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Dados do cronograma do Intensivão ENAMED
const cronogramaDados = {
  semanas: [
    {
      numero: "Semana 01",
      periodo: "11/08-17/08",
      dias: [
        {
          nome: "Dia 1 - Ginecologia e Obstetrícia",
          temas: [
            "Da Concepção ao Puerpério",
            "- Assistência pré-natal",
            "- O parto",
            "- Puerpério"
          ]
        },
        {
          nome: "Dia 2 - Pediatria",
          temas: [
            "Neonatologia e Primeiros Cuidados",
            "- Reanimação neonatal",
            "- Icterícia neonatal",
            "- Testes de triagem neonatal"
          ]
        },
        {
          nome: "Dia 3 - Clínica Médica",
          temas: [
            "Arritmias e Patologias Cardíacas",
            "- Bradiarritmias",
            "- Taquiarritmias",
            "- Doenças do pericárdio"
          ]
        },
        {
          nome: "Dia 4 - Clínica Cirúrgica",
          temas: [
            "Atendimento ao Trauma (ATLS)",
            "- ATLS: Atendimento Inicial ao Politraumatizado",
            "- ATLS: Trauma Cranioencefálico",
            "- ATLS: Trauma de Coluna Vertebral"
          ]
        },
        {
          nome: "Dia 5 - MFC, Saúde Coletiva e Saúde Mental",
          temas: [
            "Organização do SUS e Rede de Atenção Psicossocial",
            "- História do SUS e leis orgânicas da saúde (SC)",
            "- Financiamento e Funcionamento do SUS (SC)",
            "- Urgências clínico-psiquiátricas (SM)"
          ]
        },
        {
          nome: "Dia 6",
          temas: [
            "Revisão Inteligente: S1"
          ]
        },
        {
          nome: "Dia 7",
          temas: [
            "Prova na Íntegra: REVALIDA - 2021"
          ]
        }
      ]
    },
    {
      numero: "Semana 02",
      periodo: "18/08-24/08",
      dias: [
        {
          nome: "Dia 1 - Ginecologia e Obstetrícia",
          temas: [
            "Intercorrências Clínicas na Gestação",
            "- Doenças intercorrentes na gestação",
            "- Diabetes e gestação",
            "- Doenças hipertensivas na gestação"
          ]
        },
        {
          nome: "Dia 2 - Pediatria",
          temas: [
            "Saúde Perinatal e Desenvolvimento Inicial",
            "- Doenças perinatais e da prematuridade",
            "- Desconforto respiratório do recém-nascido",
            "- Puericultura e aleitamento materno"
          ]
        },
        {
          nome: "Dia 3 - Clínica Médica",
          temas: [
            "Síndromes Dolorosas e Reumatológicas",
            "- Fibromialgia e Síndromes Reumáticas dolorosas Regionais",
            "- Lombalgia e Cervicalgia",
            "- Lúpus Eritematoso Sistêmico"
          ]
        },
        {
          nome: "Dia 4 - Clínica Cirúrgica",
          temas: [
            "Trauma Específico e Choque",
            "- ATLS: Trauma Torácico e Abdominal",
            "- ATLS: Trauma Músculo-Esquelético",
            "- ATLS: Choque"
          ]
        },
        {
          nome: "Dia 5 - MFC, Saúde Coletiva e Saúde Mental",
          temas: [
            "Abordagem Integral na Atenção Primária",
            "- Atenção primária e Medicina de família e comunidade (MFC)",
            "- Hipertensão arterial sistêmica (MFC)",
            "- Transtornos de humor (SM)"
          ]
        },
        {
          nome: "Dia 6",
          temas: [
            "Revisão Inteligente: S1 + S2"
          ]
        },
        {
          nome: "Dia 7",
          temas: [
            "Prova na Íntegra: Simulado IV - SanarFlix"
          ]
        }
      ]
    }
    // Adicionar mais semanas conforme necessário
  ]
};

const getContentIcon = (tema: string) => {
  if (tema.includes('Prova') || tema.includes('Simulado')) {
    return <FileText className="h-4 w-4" />;
  } else if (tema.includes('Revisão')) {
    return <BookOpen className="h-4 w-4" />;
  }
  return <Video className="h-4 w-4" />;
};

const getContentTypeBadge = (tema: string) => {
  if (tema.includes('Prova') || tema.includes('Simulado')) {
    return <Badge variant="destructive" className="text-xs">Prova</Badge>;
  } else if (tema.includes('Revisão')) {
    return <Badge variant="secondary" className="text-xs">Revisão</Badge>;
  }
  return <Badge variant="default" className="text-xs">Aula</Badge>;
};

export const IntensivaoEnamed: React.FC = () => {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');

  // Calcular dados de progresso
  const progressData = useMemo(() => {
    const totalItems = cronogramaDados.semanas.reduce((acc, semana) => 
      acc + semana.dias.reduce((dayAcc, dia) => dayAcc + dia.temas.length, 0), 0
    );
    const completedItems = Math.floor(totalItems * 0.3); // Mock: 30% completo
    const percentage = Math.round((completedItems / totalItems) * 100);
    
    return { totalItems, completedItems, percentage };
  }, []);

  // Filtrar dados por semana selecionada
  const availableDays = useMemo(() => {
    if (selectedWeek === 'all') return [];
    const semana = cronogramaDados.semanas.find(s => s.numero === selectedWeek);
    return semana ? semana.dias : [];
  }, [selectedWeek]);

  // Filtrar conteúdo baseado nas seleções
  const filteredContent = useMemo(() => {
    let content: Array<{
      semana: string;
      dia: string;
      tema: string;
      completed: boolean;
    }> = [];

    cronogramaDados.semanas.forEach(semana => {
      if (selectedWeek !== 'all' && semana.numero !== selectedWeek) return;

      semana.dias.forEach(dia => {
        if (selectedDay !== 'all' && dia.nome !== selectedDay) return;

        dia.temas.forEach(tema => {
          content.push({
            semana: semana.numero,
            dia: dia.nome,
            tema,
            completed: Math.random() > 0.7 // Mock random completion
          });
        });
      });
    });

    return content;
  }, [selectedWeek, selectedDay]);

  // Calcular dias restantes para o ENAMED (mock)
  const diasRestantes = 85;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-lightest to-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com título e contagem regressiva */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Target className="h-8 w-8 text-red-darkest" />
            <h1 className="text-4xl font-bold text-red-darkest">Intensivão ENAMED</h1>
          </div>
          
          {user && (
            <p className="text-lg text-neutral-medium">
              {user.faculty} - {user.semester}º período
            </p>
          )}
          
          <div className="bg-gradient-primary text-white px-6 py-3 rounded-2xl inline-block shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Faltam {diasRestantes} dias para o ENAMED!</span>
            </div>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <Card className="border-red-dark shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-darkest flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Progresso Geral do Intensivão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-medium">
                  {progressData.completedItems} de {progressData.totalItems} itens concluídos
                </span>
                <span className="font-semibold text-red-dark">{progressData.percentage}%</span>
              </div>
              <Progress 
                value={progressData.percentage} 
                className="h-3 bg-red-lightest"
              />
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="border-red-dark shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="font-medium text-red-darkest">Filtros:</span>
              
              <div className="flex gap-3 flex-wrap flex-1">
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-48 border-red-light focus:ring-red-dark">
                    <SelectValue placeholder="Selecionar semana" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as semanas</SelectItem>
                    {cronogramaDados.semanas.map(semana => (
                      <SelectItem key={semana.numero} value={semana.numero}>
                        {semana.numero} ({semana.periodo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedWeek !== 'all' && (
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="w-64 border-red-light focus:ring-red-dark">
                      <SelectValue placeholder="Selecionar dia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os dias</SelectItem>
                      {availableDays.map(dia => (
                        <SelectItem key={dia.nome} value={dia.nome}>
                          {dia.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(selectedWeek !== 'all' || selectedDay !== 'all') && (
                  <Button
                    onClick={() => {
                      setSelectedWeek('all');
                      setSelectedDay('all');
                    }}
                    variant="outline"
                    className="border-red-light text-red-dark hover:bg-red-lightest"
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de conteúdos */}
        <div className="grid gap-4">
          {filteredContent.map((item, index) => (
            <Card 
              key={index}
              className={`border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] ${
                item.completed 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-red-dark bg-white'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      item.completed ? 'bg-green-100 text-green-600' : 'bg-red-lightest text-red-dark'
                    }`}>
                      {getContentIcon(item.tema)}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-darkest text-lg">
                          {item.tema}
                        </h3>
                        {getContentTypeBadge(item.tema)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-neutral-medium">
                        <span className="font-medium">{item.semana}</span>
                        <span>•</span>
                        <span>{item.dia}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.completed ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        Concluído
                      </Badge>
                    ) : (
                      <Button
                        variant="default"
                        className="bg-red-dark hover:bg-red-darkest text-white transition-smooth"
                      >
                        Acessar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredContent.length === 0 && (
          <Card className="border-red-light">
            <CardContent className="p-8 text-center">
              <p className="text-neutral-medium text-lg">
                Nenhum conteúdo encontrado para os filtros selecionados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};