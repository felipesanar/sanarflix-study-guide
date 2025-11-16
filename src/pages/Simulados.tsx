import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { FileText, Trophy } from 'lucide-react';
import { SimuladosDisponiveis } from '@/components/simulados/SimuladosDisponiveis';
import { SimuladoDesempenho } from './SimuladoDesempenho';

export const Simulados = () => {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState('disponiveis');

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Simulados</h1>
        <p className="text-muted-foreground">
          Prepare-se para o ENAMED com nossos simulados completos
        </p>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="disponiveis" className="gap-2">
            <FileText className="h-4 w-4" />
            Simulados
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="gap-2 px-5 sm:px-6 text-xs sm:text-sm">
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
