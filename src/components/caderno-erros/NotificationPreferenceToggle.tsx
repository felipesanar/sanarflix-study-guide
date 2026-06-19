import React from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

/**
 * Toggle do lembrete diário de revisão por email. Esconde-se sozinho enquanto a
 * migração de notification_preferences não estiver aplicada.
 */
export const NotificationPreferenceToggle: React.FC = () => {
  const { cadernoDailyReview, setCadernoDailyReview, loading, available } = useNotificationPreferences();

  if (loading || !available) return null;

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <Label htmlFor="caderno-daily-review" className="text-sm font-medium cursor-pointer">
            Lembrete diário de revisão
          </Label>
          <p className="text-xs text-muted-foreground">Receba um email quando tiver questões para revisar.</p>
        </div>
        <Switch
          id="caderno-daily-review"
          checked={cadernoDailyReview}
          onCheckedChange={setCadernoDailyReview}
        />
      </CardContent>
    </Card>
  );
};
