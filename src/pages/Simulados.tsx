import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { FileText, Trophy } from 'lucide-react';
import { SimuladosDisponiveis } from '@/components/simulados/SimuladosDisponiveis';


export const Simulados = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [abaAtiva, setAbaAtiva] = useState('disponiveis');

  useEffect(() => {
    setAbaAtiva('disponiveis');
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
        <TabsList className="grid w-full max-w-md grid-cols-1 mb-8">
          <TabsTrigger value="disponiveis" className="gap-2">
            <FileText className="h-4 w-4" />
            Simulados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="mt-0">
          <SimuladosDisponiveis />
        </TabsContent>


      </Tabs>
    </div>
  );
};

export default Simulados;
