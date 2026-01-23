import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Trophy } from 'lucide-react';
import { SimuladosDisponiveis } from '@/components/simulados/SimuladosDisponiveis';
import { SimuladoDesempenho } from './SimuladoDesempenho';

export const Simulados = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [abaAtiva, setAbaAtiva] = useState('disponiveis');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const abaParam = params.get('aba');
    if (abaParam === 'desempenho') {
      setAbaAtiva('desempenho');
    } else {
      setAbaAtiva('disponiveis');
    }
  }, [location.search]);

  const handleTabChange = (val: string) => {
    setAbaAtiva(val);
    const params = new URLSearchParams(location.search);
    params.set('aba', val);
    navigate({ pathname: '/simulados', search: params.toString() }, { replace: true });
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Simulados</h1>
        <p className="text-muted-foreground">
          Prepare-se para o ENAMED com nossos simulados completos
        </p>
      </div>

      <Tabs value={abaAtiva} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="disponiveis" className="gap-2">
            <FileText className="h-4 w-4" />
            Simulados
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="gap-2">
            <Trophy className="h-4 w-4" />
            Desempenho
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="mt-0">
          <SimuladosDisponiveis />
        </TabsContent>

        <TabsContent value="desempenho" className="mt-0">
          <SimuladoDesempenho />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Simulados;
