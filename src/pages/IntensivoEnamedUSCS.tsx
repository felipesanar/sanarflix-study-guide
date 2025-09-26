import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction, Clock, BookOpen, Users, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const IntensivoEnamedUSCS: React.FC = () => {
  const { user } = useAuth();
  const [userIes, setUserIes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select(`
            id_ies,
            ies:id_ies (
              nome
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const iesNome = userData?.ies?.nome || '';
        setUserIes(iesNome);
        
        // Verificar se o usuário é da USCS
        const isUSCS = iesNome.toLowerCase().includes('uscs') || 
                      iesNome.toLowerCase().includes('universidade municipal de são caetano do sul');
        
        setHasAccess(isUSCS);
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Esta página é exclusiva para alunos da <strong>USCS</strong> (Universidade Municipal de São Caetano do Sul).
            </p>
            <p className="text-sm text-muted-foreground">
              Sua instituição atual: <Badge variant="outline">{userIes || 'Não identificada'}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Se você é aluno da USCS e está vendo esta mensagem, entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-full">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Intensivo Enamed - USCS
          </h1>
          <p className="text-xl text-muted-foreground">
            Programa exclusivo para alunos da Universidade Municipal de São Caetano do Sul
          </p>
        </div>
      </div>

      {/* Status de Produção */}
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <Construction className="h-5 w-5 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <strong>🚧 Em Produção</strong>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <Clock className="h-3 w-3 mr-1" />
              Em desenvolvimento
            </Badge>
          </div>
          <p className="mt-2">
            Estamos trabalhando para trazer o melhor conteúdo preparatório para o ENAMED. 
            Em breve, você terá acesso a materiais exclusivos, simulados personalizados e muito mais!
          </p>
        </AlertDescription>
      </Alert>

      {/* Cards de Preview das Funcionalidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Simulados Personalizados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Simulados adaptados ao currículo da USCS com questões específicas 
              para o perfil dos alunos da instituição.
            </p>
            <Badge variant="outline" className="mt-3">Em breve</Badge>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Material Exclusivo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Conteúdo preparatório desenvolvido em parceria com professores 
              da USCS, focado nas áreas de maior relevância.
            </p>
            <Badge variant="outline" className="mt-3">Em breve</Badge>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">Acompanhamento Personalizado</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Sistema de mentoria e acompanhamento do progresso individual 
              com feedback específico para cada aluno.
            </p>
            <Badge variant="outline" className="mt-3">Em breve</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Informações Institucionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            Sobre o Programa USCS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            O <strong>Intensivo Enamed - USCS</strong> é um programa preparatório exclusivo 
            desenvolvido especificamente para os alunos de Medicina da Universidade Municipal 
            de São Caetano do Sul.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">🎯 Objetivos</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Preparação direcionada para o ENAMED</li>
                <li>Conteúdo alinhado ao currículo da USCS</li>
                <li>Acompanhamento individualizado</li>
                <li>Simulados com perfil institucional</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">📚 Metodologia</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Questões baseadas em casos clínicos</li>
                <li>Material desenvolvido pelos professores</li>
                <li>Análise de desempenho comparativo</li>
                <li>Cronograma adaptado ao semestre</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="text-center p-8">
          <h3 className="text-xl font-semibold mb-4">Fique por dentro das novidades!</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Estamos trabalhando arduamente para disponibilizar este conteúdo exclusivo. 
            Acompanhe as atualizações e seja o primeiro a saber quando o programa estiver disponível.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Clock className="h-4 w-4 mr-2" />
              Lançamento previsto: Em breve
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntensivoEnamedUSCS;