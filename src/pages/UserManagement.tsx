import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersTab } from '@/components/admin/UsersTab';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import SanarClassTab from '@/components/admin/SanarClassTab';
import SimuladosTab from '@/components/admin/SimuladosTab';
import { Shield, Users, Bell, FileText, ClipboardList } from 'lucide-react';

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
          <TabsList className="grid w-full grid-cols-4 max-w-3xl">
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="avisos" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="sanarclass" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              SanarClass
            </TabsTrigger>
            <TabsTrigger value="simulados" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Simulados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6">
            <UsersTab />
          </TabsContent>

          <TabsContent value="avisos" className="mt-6">
            <AnnouncementsTab />
          </TabsContent>

          <TabsContent value="sanarclass" className="mt-6">
            <SanarClassTab />
          </TabsContent>

          <TabsContent value="simulados" className="mt-6">
            <SimuladosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserManagement;
