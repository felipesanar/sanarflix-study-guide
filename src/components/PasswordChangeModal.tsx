import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ open, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { changePassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "Por favor, verifique se as senhas são idênticas",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const success = await changePassword(newPassword);
      
      if (success) {
        toast({
          title: "Senha alterada!",
          description: "Sua senha foi alterada com sucesso",
        });
        onClose();
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      // Error handling is done in the changePassword function
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-xl font-bold">
            Alteração de Senha Obrigatória
          </DialogTitle>
          <DialogDescription className="text-center">
            Por segurança, altere sua senha antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">
              Nova Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 h-12"
                required
                minLength={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A senha deve ter pelo menos 6 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirmar Nova Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite novamente sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 mt-6"
            disabled={isLoading || !newPassword || !confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando Senha...
              </>
            ) : (
              'Alterar Senha'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};