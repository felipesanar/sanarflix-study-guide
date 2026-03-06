import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EditProfileSheet } from './EditProfileSheet';

export function SemesterPromptBanner() {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  if (!user || user.semestre != null) return null;

  return (
    <>
      <div className="mx-4 md:mx-6 mt-3 mb-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Seu semestre ainda não foi definido. Defina agora para ver conteúdo personalizado.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          onClick={() => setEditOpen(true)}
        >
          Definir semestre
        </Button>
      </div>
      <EditProfileSheet open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
