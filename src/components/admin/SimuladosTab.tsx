import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Simulado {
  id: number;
  Simulado: string;
}

interface SimuladoFormData {
  Simulado: string;
}

export default function SimuladosTab() {
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSimulado, setSelectedSimulado] = useState<Simulado | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<SimuladoFormData>({
    Simulado: "",
  });

  useEffect(() => {
    fetchSimulados();
  }, []);

  const fetchSimulados = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Simulados')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setSimulados(data || []);
    } catch (error) {
      console.error('Erro ao buscar simulados:', error);
      toast.error('Erro ao carregar simulados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      Simulado: "",
    });
  };

  const handleAddSimulado = async () => {
    if (!formData.Simulado.trim()) {
      toast.error('Preencha o nome do simulado');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('Simulados')
        .insert({
          Simulado: formData.Simulado,
        });

      if (error) throw error;

      toast.success('Simulado adicionado com sucesso ✅');
      setAddModalOpen(false);
      resetForm();
      fetchSimulados();
    } catch (error) {
      console.error('Erro ao adicionar simulado:', error);
      toast.error('Erro ao adicionar simulado');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSimulado = async () => {
    if (!selectedSimulado) return;
    
    if (!formData.Simulado.trim()) {
      toast.error('Preencha o nome do simulado');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('Simulados')
        .update({
          Simulado: formData.Simulado,
        })
        .eq('id', selectedSimulado.id);

      if (error) throw error;

      toast.success('Simulado atualizado com sucesso ✅');
      setEditModalOpen(false);
      setSelectedSimulado(null);
      resetForm();
      fetchSimulados();
    } catch (error) {
      console.error('Erro ao atualizar simulado:', error);
      toast.error('Erro ao atualizar simulado');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSimulado = async () => {
    if (!selectedSimulado) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('Simulados')
        .delete()
        .eq('id', selectedSimulado.id);

      if (error) throw error;

      toast.success('Simulado excluído com sucesso');
      setDeleteDialogOpen(false);
      setSelectedSimulado(null);
      fetchSimulados();
    } catch (error) {
      console.error('Erro ao excluir simulado:', error);
      toast.error('Erro ao excluir simulado');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (simulado: Simulado) => {
    setSelectedSimulado(simulado);
    setFormData({
      Simulado: simulado.Simulado,
    });
    setEditModalOpen(true);
  };

  const openDeleteDialog = (simulado: Simulado) => {
    setSelectedSimulado(simulado);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Gerenciar Simulados
              </CardTitle>
              <CardDescription>
                Adicione, edite e exclua simulados disponíveis para os alunos
              </CardDescription>
            </div>
            <Button onClick={() => setAddModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar simulado
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome do Simulado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Nenhum simulado cadastrado ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  simulados.map((simulado) => (
                    <TableRow key={simulado.id}>
                      <TableCell className="font-medium">{simulado.id}</TableCell>
                      <TableCell>{simulado.Simulado}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(simulado)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(simulado)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Adicionar */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Adicionar novo simulado</DialogTitle>
            <DialogDescription>
              Preencha os dados do simulado
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="simulado">Nome do Simulado *</Label>
              <Input
                id="simulado"
                value={formData.Simulado}
                onChange={(e) => setFormData({ ...formData, Simulado: e.target.value })}
                placeholder="Ex: Simulado ENAMED 2024 - Prova 1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAddSimulado} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar simulado</DialogTitle>
            <DialogDescription>
              Atualize os dados do simulado
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-simulado">Nome do Simulado *</Label>
              <Input
                id="edit-simulado"
                value={formData.Simulado}
                onChange={(e) => setFormData({ ...formData, Simulado: e.target.value })}
                placeholder="Ex: Simulado ENAMED 2024 - Prova 1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleEditSimulado} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O simulado "{selectedSimulado?.Simulado}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSimulado} disabled={saving} className="bg-destructive hover:bg-destructive/90">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
