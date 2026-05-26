import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, Clock, Mail, Smartphone, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  isNotificationSupported, 
  requestNotificationPermission, 
  getNotificationPermission,
  sendTestNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/utils/notifications';
import { Logger } from '@/utils/logger';

interface ReminderConfig {
  enabled: boolean;
  reminder_time: string;
  days_before: number;
  notify_email: boolean;
  notify_push: boolean;
}

export const ReminderSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [config, setConfig] = useState<ReminderConfig>({
    enabled: true,
    reminder_time: '08:00',
    days_before: 0,
    notify_email: true,
    notify_push: false,
  });

  useEffect(() => {
    if (isNotificationSupported()) {
      setNotificationPermission(getNotificationPermission());
    }
  }, []);

  useEffect(() => {
    loadReminderConfig();
  }, []);

  const loadReminderConfig = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('study_reminders')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error) {
        Logger.error('Error loading reminder config:', error);
        toast.error('Erro ao carregar configurações de lembrete');
        setLoading(false);
        return;
      }

      if (data) {
        setConfig({
          enabled: data.enabled,
          reminder_time: data.reminder_time.substring(0, 5), // HH:MM format
          days_before: data.days_before,
          notify_email: data.notify_email,
          notify_push: data.notify_push,
        });
      }

      setLoading(false);
    } catch (error) {
      Logger.error('Error in loadReminderConfig:', error);
      toast.error('Erro ao carregar configurações');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const { error } = await supabase
        .from('study_reminders')
        .upsert({
          user_id: userData.user.id,
          enabled: config.enabled,
          reminder_time: `${config.reminder_time}:00`,
          days_before: config.days_before,
          notify_email: config.notify_email,
          notify_push: config.notify_push,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        Logger.error('Error saving reminder config:', error);
        toast.error('Erro ao salvar configurações');
        return;
      }

      toast.success('Configurações salvas com sucesso!', {
        icon: '✅',
        duration: 3000,
      });
    } catch (error) {
      Logger.error('Error in handleSave:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    try {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        // Registra subscription no servidor
        const subscribed = await subscribeToPush();
        
        if (subscribed) {
          setConfig({ ...config, notify_push: true });
          toast.success('Notificações push ativadas!', {
            icon: '🔔',
            duration: 3000,
          });
        } else {
          toast.error('Erro ao ativar notificações push', {
            description: 'Tente novamente mais tarde',
          });
        }
      } else {
        toast.error('Permissão de notificação negada', {
          description: 'Habilite as notificações nas configurações do navegador',
        });
      }
    } catch (error) {
      Logger.error('Error enabling push notifications:', error);
      toast.error('Erro ao ativar notificações push');
    }
  };

  const handleDisablePushNotifications = async () => {
    try {
      await unsubscribeFromPush();
      setConfig({ ...config, notify_push: false });
      toast.success('Notificações push desativadas');
    } catch (error) {
      Logger.error('Error disabling push:', error);
    }
  };

  const handleTestPushNotification = async () => {
    try {
      const success = await sendTestNotification(
        '📚 Sanarflix - Teste de Notificação',
        'As notificações push estão funcionando corretamente! 🎉'
      );
      
      if (success) {
        toast.success('Notificação de teste enviada!', {
          icon: '🔔',
          duration: 3000,
        });
      } else {
        toast.error('Erro ao enviar notificação de teste', {
          description: 'Verifique se as permissões estão habilitadas',
        });
      }
    } catch (error) {
      Logger.error('Error sending test push notification:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  };

  const handleTestReminder = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      // Enviar email de teste
      const { error } = await supabase.functions.invoke('send-study-reminder', {
        body: {
          userEmail: userData.user.email,
          userName: userData.user.user_metadata?.nome || 'Estudante',
          subjects: [
            {
              name: 'Matéria de Teste',
              day: 'Hoje',
              week: 'Semana de Teste',
            },
          ],
        },
      });

      if (error) {
        Logger.error('Error sending test reminder:', error);
        toast.error('Erro ao enviar lembrete de teste');
        return;
      }

      toast.success('Lembrete de teste enviado! Verifique seu email.', {
        icon: '📧',
        duration: 5000,
      });
    } catch (error) {
      Logger.error('Error in handleTestReminder:', error);
      toast.error('Erro ao enviar lembrete de teste');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configurações de Lembretes
        </CardTitle>
        <CardDescription>
          Configure lembretes para suas matérias agendadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ativar/Desativar Lembretes */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="text-base font-medium">
              Ativar Lembretes
            </Label>
            <p className="text-sm text-muted-foreground">
              Receba lembretes sobre suas matérias agendadas
            </p>
          </div>
          <Switch
            id="enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        {config.enabled && (
          <>
            {/* Horário do Lembrete */}
            <div className="space-y-2">
              <Label htmlFor="reminder_time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário do Lembrete
              </Label>
              <Input
                id="reminder_time"
                type="time"
                value={config.reminder_time}
                onChange={(e) => setConfig({ ...config, reminder_time: e.target.value })}
                className="max-w-[200px]"
              />
              <p className="text-sm text-muted-foreground">
                Horário em que você receberá os lembretes diários
              </p>
            </div>

            {/* Tipo de Notificação */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Tipo de Notificação</Label>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label htmlFor="notify_email">Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber lembretes por email
                    </p>
                  </div>
                </div>
                <Switch
                  id="notify_email"
                  checked={config.notify_email}
                  onCheckedChange={(checked) => setConfig({ ...config, notify_email: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label htmlFor="notify_push">Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      {notificationPermission === 'granted' 
                        ? 'Notificações ativadas no navegador' 
                        : 'Receber notificações no navegador'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="notify_push"
                  checked={config.notify_push && notificationPermission === 'granted'}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      if (notificationPermission !== 'granted') {
                        handleEnablePushNotifications();
                      } else {
                        handleEnablePushNotifications();
                      }
                    } else {
                      handleDisablePushNotifications();
                    }
                  }}
                  disabled={!isNotificationSupported()}
                />
              </div>
            </div>
          </>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          
          {config.enabled && config.notify_email && (
            <Button
              variant="outline"
              onClick={handleTestReminder}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Teste Email
            </Button>
          )}

          {config.enabled && config.notify_push && notificationPermission === 'granted' && (
            <Button
              variant="outline"
              onClick={handleTestPushNotification}
              className="flex items-center gap-2"
            >
              <Bell className="h-4 w-4" />
              Teste Push
            </Button>
          )}
        </div>

        {/* Informação Adicional */}
        <div className="bg-muted/50 p-4 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Como funciona:</strong> Os lembretes são enviados automaticamente todos os dias no horário configurado, 
            listando as matérias agendadas para o dia.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
