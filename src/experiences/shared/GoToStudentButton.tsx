import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface GoToStudentButtonProps {
  className?: string;
  /** Padrão "outline" — o rodapé compacto da sidebar do gestor usa "ghost". */
  variant?: ButtonProps['variant'];
  /** Padrão "sm". */
  size?: ButtonProps['size'];
}

/**
 * Alternância portal → experiência de aluno.
 *
 * Presente no header (Admin/CX) ou no rodapé da sidebar (Gestor v2) de cada
 * portal dedicado, para que o usuário privilegiado volte à base (a Home do
 * aluno em `/`). É o par do link de portal exibido na navegação de aluno
 * (aluno → portal). `variant`/`size` permitem adaptar a aparência ao
 * contêiner sem duplicar o componente.
 */
export const GoToStudentButton: React.FC<GoToStudentButtonProps> = ({
  className,
  variant = 'outline',
  size = 'sm',
}) => {
  const navigate = useNavigate();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-2 shrink-0', className)}
      onClick={() => navigate('/')}
    >
      <GraduationCap className="h-4 w-4" aria-hidden="true" />
      Ir para versão aluno
    </Button>
  );
};
