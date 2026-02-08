import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersTab } from '@/components/admin/UsersTab';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import SanarClassTab from '@/components/admin/SanarClassTab';
import SimuladosTab from '@/components/admin/SimuladosTab';
import LiberacoesTab from '@/components/admin/LiberacoesTab';
import IesFeaturesTab from '@/components/admin/IesFeaturesTab';
import { StudyGuideImportTab } from '@/components/admin/StudyGuideImportTab';
import { Shield, Users, Bell, FileText, ClipboardList, Unlock, Building2, Upload } from 'lucide-react';

const UserManagement: React.FC = () => {
  const { user } = useAuth();

  const isAdmin = user?.roles?.includes('admin') || false;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" />
            Portal do Administrador
          </h1>
          <p className="text-muted-foreground">
            Gerencie usuários, configurações e todos os aspectos da plataforma
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full grid-cols-6 max-w-6xl">
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="avisos" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Avisos</span>
            </TabsTrigger>
            <TabsTrigger value="ies-features" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">IES</span>
            </TabsTrigger>
            <TabsTrigger value="guia-estudos" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Guia</span>
            </TabsTrigger>
            <TabsTrigger value="sanarclass" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">SanarClass</span>
            </TabsTrigger>
            <TabsTrigger value="simulados" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Simulados</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6">
            <UsersTab />
          </TabsContent>

          <TabsContent value="avisos" className="mt-6">
            <AnnouncementsTab />
          </TabsContent>

          <TabsContent value="ies-features" className="mt-6">
            <IesFeaturesTab />
          </TabsContent>

          <TabsContent value="guia-estudos" className="mt-6">
            <StudyGuideImportTab />
          </TabsContent>

          <TabsContent value="sanarclass" className="mt-6">
            <SanarClassTab />
          </TabsContent>

          <TabsContent value="simulados" className="mt-6">
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
              </TabsList>

              <TabsContent value="simulados" className="mt-6">
                <SimuladosTab />
              </TabsContent>
              <TabsContent value="liberacoes" className="mt-6">
                <LiberacoesTab />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserManagement;
