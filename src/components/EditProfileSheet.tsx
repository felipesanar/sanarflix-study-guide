import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, Lock, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { maskPhone, onlyDigits, isValidBrPhone } from "@/utils/phone";

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: 'profile_edit' | 'onboarding_banner';
}

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s\-'.]+$/;
const COOLDOWN_DAYS = 60;

export function EditProfileSheet({ open, onOpenChange, source = 'profile_edit' }: EditProfileSheetProps) {
  const isMobile = useIsMobile();
  const { user, forceRefreshProfile } = useAuth();
  const mountedRef = useRef(true);
  const { trackEvent } = useAnalyticsTracker();

  const [nome, setNome] = useState(user?.nome ?? "");
  const [semestre, setSemestre] = useState<number | undefined>(user?.semestre);
  const [semestreUpdatedAt, setSemestreUpdatedAt] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingSemestre, setSavingSemestre] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSemestre, setPendingSemestre] = useState<number | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [telefone, setTelefone] = useState(maskPhone(user?.telefone ?? ""));
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch semestre_updated_at on open
  useEffect(() => {
    if (!open || !user?.id) return;
    setNome(user.nome ?? "");
    setSemestre(user.semestre);
    setNameSuccess(false);
    setTelefone(maskPhone(user.telefone ?? ""));
    setPhoneSuccess(false);

    supabase
      .from("users")
      .select("semestre_updated_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (mountedRef.current) {
          setSemestreUpdatedAt((data as any)?.semestre_updated_at ?? null);
        }
      });
  }, [open, user?.id, user?.nome, user?.semestre, user?.telefone]);

  const cooldownEnd = semestreUpdatedAt
    ? new Date(new Date(semestreUpdatedAt).getTime() + COOLDOWN_DAYS * 86400000)
    : null;
  const isLocked = cooldownEnd ? cooldownEnd > new Date() : false;

  const nameValid = nome.trim().length >= 2 && NAME_REGEX.test(nome.trim());
  const nameChanged = nome.trim() !== (user?.nome ?? "").trim();

  const handleSaveName = async () => {
    if (!user || !nameValid || !nameChanged || savingName) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ nome: nome.trim() })
        .eq("id", user.id);

      if (error) throw error;

      await forceRefreshProfile();
      if (mountedRef.current) {
        setNameSuccess(true);
        setTimeout(() => {
          if (mountedRef.current) setNameSuccess(false);
        }, 2000);
      }
      toast.success("Nome atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar nome.");
    } finally {
      if (mountedRef.current) setSavingName(false);
    }
  };

  const telefoneDigits = onlyDigits(telefone);
  const savedTelefoneDigits = onlyDigits(user?.telefone ?? "");
  const telefoneValid = isValidBrPhone(telefoneDigits);
  const telefoneChanged = telefoneDigits !== savedTelefoneDigits;
  const telefoneError =
    telefoneDigits.length === 0 && savedTelefoneDigits.length > 0
      ? "O telefone não pode ficar vazio."
      : telefoneDigits.length > 0 && !telefoneValid
      ? "Informe DDD + número (10 ou 11 dígitos)."
      : "";

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(maskPhone(e.target.value));
  };

  const handleSavePhone = async () => {
    if (!user || !telefoneValid || !telefoneChanged || savingPhone) return;
    setSavingPhone(true);
    try {
      const { error } = await supabase.rpc("set_my_phone", {
        p_telefone: telefoneDigits,
      });

      if (error) throw error;

      await forceRefreshProfile();
      if (mountedRef.current) {
        setPhoneSuccess(true);
        setTimeout(() => {
          if (mountedRef.current) setPhoneSuccess(false);
        }, 2000);
      }
      toast.success("Telefone atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar telefone.");
    } finally {
      if (mountedRef.current) setSavingPhone(false);
    }
  };

  const handleSemestreChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 12 || num === semestre) return;
    setPendingSemestre(num);
    setConfirmOpen(true);
  };

  const confirmSemestreChange = async () => {
    if (!user || pendingSemestre === null || savingSemestre) return;
    setConfirmOpen(false);
    setSavingSemestre(true);
    const previousSemestre = semestre ?? null;
    try {
      const { error } = await supabase
        .from("users")
        .update({ semestre: pendingSemestre })
        .eq("id", user.id);

      if (error) throw error;

      if (mountedRef.current) {
        setSemestre(pendingSemestre);
        setSemestreUpdatedAt(new Date().toISOString());
      }
      await forceRefreshProfile();

      // Track semester_updated event
      trackEvent({
        eventName: 'semester_updated',
        category: 'interaction',
        data: {
          previous_semester: previousSemestre,
          new_semester: pendingSemestre,
          is_first_definition: previousSemestre === null,
          source,
        },
      });

      toast.success(`Semestre atualizado para ${pendingSemestre}º período!`);
    } catch (e: any) {
      const msg = e?.message?.includes("bloqueada")
        ? e.message
        : "Erro ao atualizar semestre.";
      toast.error(msg);
    } finally {
      if (mountedRef.current) {
        setSavingSemestre(false);
        setPendingSemestre(null);
      }
    }
  };

  const content = (
    <div className="flex flex-col gap-6 py-2">
      {/* Avatar */}
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">
              {(user?.nome ?? "")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          </div>
        </motion.div>
      </div>

      <p className="text-xs text-center text-muted-foreground">{user?.email}</p>

      {/* Name Section */}
      <div className="space-y-2">
        <Label htmlFor="edit-nome" className="text-sm font-medium">
          Nome completo
        </Label>
        <div className="relative">
          <Input
            id="edit-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            maxLength={100}
            className="pr-10"
            autoFocus={false}
            readOnly={false}
            onFocus={(e) => e.target.removeAttribute('autofocus')}
            aria-describedby="nome-error"
          />
          <AnimatePresence>
            {nameSuccess && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Check className="h-4 w-4 text-emerald-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {nome.trim().length > 0 && !nameValid && (
          <p id="nome-error" className="text-xs text-destructive" role="alert">
            Use apenas letras, espaços, hífens ou apóstrofos (mínimo 2 caracteres).
          </p>
        )}
        <Button
          size="sm"
          onClick={handleSaveName}
          disabled={!nameValid || !nameChanged || savingName}
          className="w-full"
        >
          {savingName && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar nome
        </Button>
      </div>

      {/* Phone Section */}
      <div className="space-y-2">
        <Label htmlFor="edit-telefone" className="text-sm font-medium">
          Telefone
        </Label>
        <div className="relative">
          <Input
            id="edit-telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={telefone}
            onChange={handlePhoneChange}
            placeholder="(11) 91234-5678"
            maxLength={16}
            className="pr-10"
            aria-describedby="telefone-error"
          />
          <AnimatePresence>
            {phoneSuccess && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Check className="h-4 w-4 text-emerald-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {telefoneError && (
          <p id="telefone-error" className="text-xs text-destructive" role="alert">
            {telefoneError}
          </p>
        )}
        <Button
          size="sm"
          onClick={handleSavePhone}
          disabled={!telefoneValid || !telefoneChanged || savingPhone}
          className="w-full"
        >
          {savingPhone && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar telefone
        </Button>
      </div>

      {/* Semester Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Período / Semestre</Label>

        {isLocked ? (
          <div className="rounded-xl border border-border bg-muted/50 p-3 flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {semestre ? `${semestre}º período` : "Não definido"}
              </p>
              <p className="text-xs text-muted-foreground">
                Próxima alteração disponível em{" "}
                <strong>
                  {cooldownEnd!.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </strong>
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Select
              value={semestre?.toString() ?? ""}
              onValueChange={handleSemestreChange}
              disabled={savingSemestre}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione seu período" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                  <SelectItem key={s} value={s.toString()}>
                    {s}º período
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingSemestre && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        {/* Warning banner - below the selector */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2.5"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            Seu semestre influencia diretamente o conteúdo do{" "}
            <strong>Guia de Estudos</strong>, <strong>Central de Progresso</strong>,{" "}
            <strong>Rankings</strong> e <strong>Simulados</strong>. Após alterar,
            você só poderá mudar novamente após <strong>60 dias</strong>.
          </p>
        </motion.div>
      </div>
    </div>
  );

  // AlertDialog must be outside Sheet/Dialog to avoid portal nesting issues
  const confirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar alteração de semestre</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Tem certeza que deseja alterar para o{" "}
                <strong>{pendingSemestre}º período</strong>?
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Essa ação não poderá ser desfeita por 60 dias. Seu conteúdo,
                progresso e rankings serão recalculados.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmSemestreChange}>
            Confirmar alteração
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Editar perfil</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
