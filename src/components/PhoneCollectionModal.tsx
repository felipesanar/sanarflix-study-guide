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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';
import { maskPhone, onlyDigits, isValidBrPhone } from '@/utils/phone';

interface PhoneCollectionModalProps {
  isOpen: boolean;
}

export const PhoneCollectionModal: React.FC<PhoneCollectionModalProps> = ({ isOpen }) => {
  const { forceRefreshProfile } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(maskPhone(e.target.value));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digits = onlyDigits(value);
    if (!isValidBrPhone(digits)) {
      setError('Informe DDD + número (10 ou 11 dígitos).');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('set_my_phone', {
        p_telefone: digits,
      });
      if (rpcError) throw rpcError;

      // Atualiza user no contexto e no localStorage relendo public.users.
      await forceRefreshProfile();

      toast({
        title: 'Telefone atualizado',
        description: 'Obrigado! Seu cadastro está completo.',
        duration: 3000,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao salvar telefone';
      toast({
        title: 'Não foi possível salvar',
        description: message,
        variant: 'destructive',
        duration: 4000,
      });
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-5 sm:p-6 [&>button]:hidden gap-3 sm:gap-4"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-lg sm:text-xl">
            Atualize seu cadastro
          </DialogTitle>
          <DialogDescription className="text-sm">
            Precisamos do seu telefone para contato. Informe um número com DDD
            (fixo ou celular).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={value}
              onChange={handleChange}
              placeholder="(11) 91234-5678"
              maxLength={16}
              required
              className="h-12 text-base"
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar telefone'}
          </Button>
        </form>

      </DialogContent>
    </Dialog>
  );
};
