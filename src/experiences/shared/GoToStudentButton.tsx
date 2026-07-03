import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Alternância portal → experiência de aluno.
 *
 * Presente no header de cada portal dedicado (Admin/Gestor/CX) para que o
 * usuário privilegiado volte à base (a Home do aluno em `/`). É o par do link
 * de portal exibido na navegação de aluno (aluno → portal).
 */
export const GoToStudentButton: React.FC<{ className?: string }> = ({ className }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2 shrink-0', className)}
      onClick={() => navigate('/')}
    >
      <GraduationCap className="h-4 w-4" aria-hidden="true" />
      Ir para versão aluno
    </Button>
  );
};
