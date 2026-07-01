import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Unlock, Upload } from 'lucide-react';
import SimuladosTab from '@/components/admin/SimuladosTab';
import LiberacoesTab from '@/components/admin/LiberacoesTab';
import SimuladosImportRespostasTab from '@/components/admin/SimuladosImportRespostasTab';

/**
 * Seção Simulados do Portal do Admin (`/admin/simulados`).
 *
 * Mantém as sub-abas internas (Simulados, Liberações, Importar respostas) por
 * estado — a apartação dessas sub-abas em rotas, se desejada, fica para depois.
 */
const SimuladosPage: React.FC = () => (
  <Tabs defaultValue="simulados" className="w-full">
    <TabsList className="flex gap-2 w-full max-w-3xl">
      <TabsTrigger value="simulados" className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4" />
        Simulados
      </TabsTrigger>
      <TabsTrigger value="liberacoes" className="flex items-center gap-2">
        <Unlock className="h-4 w-4" />
        Liberações
      </TabsTrigger>
      <TabsTrigger value="importar-respostas" className="flex items-center gap-2">
        <Upload className="h-4 w-4" />
        Importar respostas
      </TabsTrigger>
    </TabsList>

    <TabsContent value="simulados" className="mt-6">
      <SimuladosTab />
    </TabsContent>
    <TabsContent value="liberacoes" className="mt-6">
      <LiberacoesTab />
    </TabsContent>
    <TabsContent value="importar-respostas" className="mt-6">
      <SimuladosImportRespostasTab />
    </TabsContent>
  </Tabs>
);

export default SimuladosPage;
