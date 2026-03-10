import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Trophy, HelpCircle, ClipboardCheck } from 'lucide-react';
import { SimuladosDisponiveis } from '@/components/simulados/SimuladosDisponiveis';
import { SimuladoDesempenho } from './SimuladoDesempenho';
import { SimuladoCorrecao } from './SimuladoCorrecao';
import { HowToUseSimuladoModal } from '@/components/simulados/HowToUseSimuladoModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';

export const Simulados = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { accessRules } = useAccessRules();
  const [abaAtiva, setAbaAtiva] = useState('disponiveis');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const isAdmin = user?.roles?.includes('admin') ?? false;
  const showDesempenho = accessRules.SimuladoDesempenho;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const abaParam = params.get('aba');
    if (abaParam === 'desempenho') {
      setAbaAtiva('desempenho');
    } else if (abaParam === 'correcao' && isAdmin) {
      setAbaAtiva('correcao');
    } else {
      setAbaAtiva('disponiveis');
    }
  }, [location.search, isAdmin]);

  const handleTabChange = (val: string) => {
    setAbaAtiva(val);
    const params = new URLSearchParams(location.search);
    params.set('aba', val);
    navigate({ pathname: '/simulados', search: params.toString() }, { replace: true });
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* Header com botão do tutorial */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Simulados</h1>
            <p className="text-muted-foreground">
              Prepare-se para o ENAMED com nossos simulados completos
            </p>
          </div>
          
          <Button
            onClick={() => setTutorialOpen(true)}
            className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 gap-2 sm:shrink-0"
          >
            <HelpCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">Como usar o Modo Simulado</span>
            <span className="sm:hidden">Como usar</span>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        </div>
      </div>

      <Tabs value={abaAtiva} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full max-w-lg ${isAdmin ? 'grid-cols-3' : showDesempenho ? 'grid-cols-2' : 'grid-cols-1'} mb-8`}>
          <TabsTrigger value="disponiveis" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Simulados</span>
            <span className="sm:hidden text-xs">Simulados</span>
          </TabsTrigger>
          {showDesempenho && (
            <TabsTrigger value="desempenho" className="gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Desempenho</span>
              <span className="sm:hidden text-xs">Desempenho</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="correcao" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Correção</span>
              <span className="sm:hidden text-xs">Correção</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="disponiveis" className="mt-0">
          <SimuladosDisponiveis />
        </TabsContent>

        {showDesempenho && (
          <TabsContent value="desempenho" className="mt-0">
            <SimuladoDesempenho />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="correcao" className="mt-0">
            <SimuladoCorrecao />
          </TabsContent>
        )}
      </Tabs>

      {/* Modal do tutorial */}
      <HowToUseSimuladoModal open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
};

export default Simulados;
