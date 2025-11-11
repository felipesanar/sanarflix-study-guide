import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SanarClassLesson {
  id: string;
  titulo: string;
  professor: string;
  disciplina: string;
  semestre: number;
  formato: 'pdf' | 'pptx';
  data_publicacao: string;
  arquivo_url: string;
  preview_url: string | null;
  ies_id: string;
}

interface IES {
  id: string;
  nome: string;
}

interface LessonFormData {
  titulo: string;
  professor: string;
  disciplina: string;
  semestre: string;
  formato: 'pdf' | 'pptx';
  arquivo_url: string;
  ies_id: string;
}

export default function SanarClassTab() {
  const [lessons, setLessons] = useState<SanarClassLesson[]>([]);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<SanarClassLesson | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<LessonFormData>({
    titulo: "",
    professor: "",
    disciplina: "",
    semestre: "",
    formato: "pdf",
    arquivo_url: "",
    ies_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lessonsResult, iesResult] = await Promise.all([
        supabase
          .from('sanarclass_lessons')
          .select('*')
          .order('data_publicacao', { ascending: false }),
        supabase
          .from('ies')
          .select('*')
          .order('nome')
      ]);

      if (lessonsResult.error) throw lessonsResult.error;
      if (iesResult.error) throw iesResult.error;

      setLessons((lessonsResult.data as SanarClassLesson[]) || []);
      setIesList(iesResult.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      professor: "",
      disciplina: "",
      semestre: "",
      formato: "pdf",
      arquivo_url: "",
      ies_id: "",
    });
  };

  const handleAddLesson = async () => {
    if (!formData.titulo || !formData.professor || !formData.disciplina || 
        !formData.semestre || !formData.arquivo_url || !formData.ies_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sanarclass_lessons')
        .insert({
          titulo: formData.titulo,
          professor: formData.professor,
          disciplina: formData.disciplina,
          semestre: parseInt(formData.semestre),
          formato: formData.formato,
          arquivo_url: formData.arquivo_url,
          preview_url: formData.arquivo_url, // Usa o mesmo link do documento
          ies_id: formData.ies_id,
        });

      if (error) throw error;

      toast.success('Aula adicionada com sucesso ✅');
      setAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao adicionar aula:', error);
      toast.error('Erro ao adicionar aula');
    } finally {
      setSaving(false);
    }
  };

  const handleEditLesson = async () => {
    if (!selectedLesson) return;
    
    if (!formData.titulo || !formData.professor || !formData.disciplina || 
        !formData.semestre || !formData.arquivo_url || !formData.ies_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sanarclass_lessons')
        .update({
          titulo: formData.titulo,
          professor: formData.professor,
          disciplina: formData.disciplina,
          semestre: parseInt(formData.semestre),
          formato: formData.formato,
          arquivo_url: formData.arquivo_url,
          preview_url: formData.arquivo_url, // Usa o mesmo link do documento
          ies_id: formData.ies_id,
        })
        .eq('id', selectedLesson.id);

      if (error) throw error;

      toast.success('Aula atualizada com sucesso ✅');
      setEditModalOpen(false);
      setSelectedLesson(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar aula:', error);
      toast.error('Erro ao atualizar aula');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!selectedLesson) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sanarclass_lessons')
        .delete()
        .eq('id', selectedLesson.id);

      if (error) throw error;

      toast.success('Aula excluída com sucesso');
      setDeleteDialogOpen(false);
      setSelectedLesson(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir aula:', error);
      toast.error('Erro ao excluir aula');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (lesson: SanarClassLesson) => {
    setSelectedLesson(lesson);
    setFormData({
      titulo: lesson.titulo,
      professor: lesson.professor,
      disciplina: lesson.disciplina,
      semestre: lesson.semestre.toString(),
      formato: lesson.formato,
      arquivo_url: lesson.arquivo_url,
      ies_id: lesson.ies_id,
    });
    setEditModalOpen(true);
  };

  const openDeleteDialog = (lesson: SanarClassLesson) => {
    setSelectedLesson(lesson);
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
                <FileText className="h-5 w-5" />
                Gerenciar SanarClass
              </CardTitle>
              <CardDescription>
                Adicione, edite e exclua aulas do SanarClass
              </CardDescription>
            </div>
            <Button onClick={() => setAddModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar nova aula
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Semestre</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma aula cadastrada ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  lessons.map((lesson) => (
                    <TableRow key={lesson.id}>
                      <TableCell className="font-medium">{lesson.titulo}</TableCell>
                      <TableCell>{lesson.professor}</TableCell>
                      <TableCell>{lesson.disciplina}</TableCell>
                      <TableCell>{lesson.semestre}º</TableCell>
                      <TableCell className="uppercase">{lesson.formato}</TableCell>
                      <TableCell>
                        {format(new Date(lesson.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(lesson)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(lesson)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar nova aula</DialogTitle>
            <DialogDescription>
              Preencha os dados da aula do SanarClass
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="titulo">Título da aula *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Introdução à Cardiologia"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="professor">Professor *</Label>
              <Input
                id="professor"
                value={formData.professor}
                onChange={(e) => setFormData({ ...formData, professor: e.target.value })}
                placeholder="Ex: Dr. João Silva"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="disciplina">Disciplina *</Label>
              <Input
                id="disciplina"
                value={formData.disciplina}
                onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })}
                placeholder="Ex: Cardiologia"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="semestre">Semestre *</Label>
                <Select value={formData.semestre} onValueChange={(value) => setFormData({ ...formData, semestre: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(sem => (
                      <SelectItem key={sem} value={sem.toString()}>{sem}º Semestre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="formato">Formato *</Label>
                <Select value={formData.formato} onValueChange={(value: 'pdf' | 'pptx') => setFormData({ ...formData, formato: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ies">Instituição *</Label>
              <Select value={formData.ies_id} onValueChange={(value) => setFormData({ ...formData, ies_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a IES" />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map(ies => (
                    <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="arquivo_url">Link do documento *</Label>
              <Input
                id="arquivo_url"
                value={formData.arquivo_url}
                onChange={(e) => setFormData({ ...formData, arquivo_url: e.target.value })}
                placeholder="https://drive.google.com/file/d/SEU_FILE_ID/preview"
                type="url"
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">📋 Como obter o link correto do Google Drive:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Abra o arquivo no Google Drive</li>
                  <li>Clique em "Compartilhar" → "Qualquer pessoa com o link"</li>
                  <li>Copie o link compartilhado (formato: https://drive.google.com/file/d/FILE_ID/view)</li>
                  <li>Substitua <code className="bg-muted px-1 rounded">/view</code> por <code className="bg-muted px-1 rounded">/preview</code> no final do link</li>
                </ol>
                <p className="text-amber-600 dark:text-amber-500 font-medium mt-2">
                  ⚠️ O link DEVE terminar com /preview para funcionar corretamente
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddLesson} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar aula'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar aula</DialogTitle>
            <DialogDescription>
              Atualize os dados da aula do SanarClass
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-titulo">Título da aula *</Label>
              <Input
                id="edit-titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-professor">Professor *</Label>
              <Input
                id="edit-professor"
                value={formData.professor}
                onChange={(e) => setFormData({ ...formData, professor: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-disciplina">Disciplina *</Label>
              <Input
                id="edit-disciplina"
                value={formData.disciplina}
                onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-semestre">Semestre *</Label>
                <Select value={formData.semestre} onValueChange={(value) => setFormData({ ...formData, semestre: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(sem => (
                      <SelectItem key={sem} value={sem.toString()}>{sem}º Semestre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-formato">Formato *</Label>
                <Select value={formData.formato} onValueChange={(value: 'pdf' | 'pptx') => setFormData({ ...formData, formato: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-ies">Instituição *</Label>
              <Select value={formData.ies_id} onValueChange={(value) => setFormData({ ...formData, ies_id: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map(ies => (
                    <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-arquivo_url">Link do documento *</Label>
              <Input
                id="edit-arquivo_url"
                value={formData.arquivo_url}
                onChange={(e) => setFormData({ ...formData, arquivo_url: e.target.value })}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                💡 Use links de visualização direta (ex: Google Drive em modo preview, Dropbox com ?dl=0, ou PDFs hospedados). 
                O preview será gerado automaticamente a partir deste link.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="destructive" 
              onClick={() => {
                setEditModalOpen(false);
                openDeleteDialog(selectedLesson!);
              }}
            >
              Excluir aula
            </Button>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditLesson} disabled={saving}>
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a aula "{selectedLesson?.titulo}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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