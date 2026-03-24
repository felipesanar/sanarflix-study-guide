import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { User, FileText, BarChart3, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserSupportPanelProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserSupportPanel: React.FC<UserSupportPanelProps> = ({ userId, userName, open, onOpenChange }) => {
  const [activeTab, setActiveTab] = useState('perfil');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchSection = useCallback(async (section: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-support', {
        body: { userId, section },
      });
      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error('Error fetching support data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      fetchSection(activeTab === 'perfil' ? 'profile' : activeTab);
    }
  }, [open, userId, activeTab, fetchSection]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setData(null);
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Suporte: {userName}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-[calc(100vh-80px)]">
          <TabsList className="mx-6 mt-4 grid grid-cols-5">
            <TabsTrigger value="perfil" className="text-xs gap-1"><User className="h-3 w-3" />Perfil</TabsTrigger>
            <TabsTrigger value="progress" className="text-xs gap-1"><BarChart3 className="h-3 w-3" />Progresso</TabsTrigger>
            <TabsTrigger value="simulados" className="text-xs gap-1"><FileText className="h-3 w-3" />Simulados</TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs gap-1"><Clock className="h-3 w-3" />Sessões</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1"><Activity className="h-3 w-3" />Atividade</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                <TabsContent value="perfil" className="mt-0 space-y-4">
                  {data && <ProfileTab data={data} />}
                </TabsContent>
                <TabsContent value="progress" className="mt-0 space-y-4">
                  {data && <ProgressTab data={data} />}
                </TabsContent>
                <TabsContent value="simulados" className="mt-0 space-y-4">
                  {data && <SimuladosTab data={data} />}
                </TabsContent>
                <TabsContent value="sessions" className="mt-0 space-y-4">
                  {data && <SessionsTab data={data} formatDate={formatDate} formatDuration={formatDuration} />}
                </TabsContent>
                <TabsContent value="activity" className="mt-0 space-y-4">
                  {data && <ActivityTab data={data} formatDate={formatDate} />}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function ProfileTab({ data }: { data: any }) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <InfoRow label="ID" value={<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{data.id}</code>} />
      <InfoRow label="Nome" value={data.nome} />
      <InfoRow label="Email" value={data.email} />
      <InfoRow label="IES" value={data.ies?.nome || '-'} />
      <InfoRow label="Semestre" value={data.semestre || '-'} />
      <InfoRow label="Semestre atualizado em" value={data.semestre_updated_at ? format(new Date(data.semestre_updated_at), "dd/MM/yyyy HH:mm") : 'Nunca'} />
      <InfoRow label="Roles" value={
        data.roles?.length > 0 
          ? data.roles.map((r: string) => <Badge key={r} variant="outline" className="mr-1 text-xs">{r}</Badge>)
          : <span className="text-muted-foreground">Nenhum</span>
      } />
    </div>
  );
}

function ProgressTab({ data }: { data: any }) {
  const legacyCount = data.user_progress?.length || 0;
  const studyGuideCount = data.study_progress?.length || 0;
  const nodesCount = data.progress_nodes?.length || 0;
  const viewsCount = data.aula_views?.length || 0;
  const totalCompleted = legacyCount + studyGuideCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalCompleted}</p>
          <p className="text-xs text-muted-foreground">Total concluído</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{studyGuideCount}</p>
          <p className="text-xs text-muted-foreground">Guia de Estudos</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{nodesCount}</p>
          <p className="text-xs text-muted-foreground">Nós de progresso</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{viewsCount}</p>
          <p className="text-xs text-muted-foreground">Visualizações</p>
        </div>
      </div>

      {data.study_progress?.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">Progresso do Guia de Estudos (recente)</h4>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {data.study_progress.slice(0, 30).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-border/30 pb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{item.content_type}</Badge>
                  <span className="text-muted-foreground truncate max-w-[180px]">{item.materia_id}</span>
                  <span className="text-muted-foreground">Sem {item.semestre}</span>
                </div>
                <span className="text-muted-foreground">
                  {item.completed_at ? format(new Date(item.completed_at), "dd/MM HH:mm") : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.progress_nodes?.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">Últimos nós concluídos</h4>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {data.progress_nodes.slice(0, 20).map((node: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-border/30 pb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{node.node_type}</Badge>
                  <span className="text-muted-foreground truncate max-w-[250px]">{node.node_id}</span>
                </div>
                <span className="text-muted-foreground">{format(new Date(node.completed_at), "dd/MM HH:mm")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimuladosTab({ data }: { data: any }) {
  const finalizados = data.finalizados || [];
  const scores = data.scores || {};

  return (
    <div className="space-y-4">
      {finalizados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum simulado finalizado</p>
      ) : (
        finalizados.map((f: any) => {
          const score = scores[f.simulado_id] || { total: 0, correct: 0 };
          const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
          const simName = f.simulados_admin?.nome || f.simulado_id?.slice(0, 8);

          return (
            <div key={f.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{simName}</h4>
                <Badge variant={pct >= 60 ? "default" : "destructive"} className="text-xs">
                  {score.correct}/{score.total} ({pct}%)
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Finalizado: {format(new Date(f.finalizado_em), "dd/MM/yyyy HH:mm")}</span>
                <span>Tempo: {Math.round(f.tempo_total_segundos / 60)}min</span>
                <span>Tentativa: #{f.tentativa_numero}</span>
                <span>Saídas aba: {f.saidas_de_aba} | FS: {f.saidas_de_fullscreen}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SessionsTab({ data, formatDate, formatDuration }: { data: any; formatDate: (d: string) => string; formatDuration: (s: number) => string }) {
  const sessions = data.sessions || [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3">
        <p className="text-sm text-muted-foreground">Total de sessões carregadas: <strong>{sessions.length}</strong></p>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão registrada</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{formatDate(s.started_at)}</span>
                <div className="flex items-center gap-2">
                  {s.is_mobile && <Badge variant="outline" className="text-[10px]">Mobile</Badge>}
                  <span className="text-muted-foreground">{formatDuration(s.duration_seconds)}</span>
                </div>
              </div>
              <span className="text-muted-foreground">Páginas: {s.pages_visited || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ data, formatDate }: { data: any; formatDate: (d: string) => string }) {
  const events = data.events || [];

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado</p>
      ) : (
        events.map((e: any, i: number) => (
          <div key={i} className="rounded-lg border p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{e.event_category}</Badge>
                <span className="font-medium">{e.event_name}</span>
              </div>
              <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
            </div>
            {e.page_path && <span className="text-muted-foreground">{e.page_path}</span>}
          </div>
        ))
      )}
    </div>
  );
}
