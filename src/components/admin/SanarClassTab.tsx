import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toBrazilDate } from '@/utils/timezone';
import { Logger } from '@/utils/logger';
import {
  AdminTable,
  AdminLoading,
  AdminError,
  AdminEmpty,
  StatusPill,
  MonoValue,
  DangerZone,
  adminTableHeadClass,
  adminTableCellClass,
  type StatusPillVariant,
} from '@/experiences/admin/ui';
import { logAdminAction } from '@/services/admin/logAction';

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
  semestres: string[];
  formato: 'pdf' | 'pptx';
  arquivo_url: string;
  ies_id: string;
  arquivo?: File | null;
}

const FORMAT_PILL: Record<string, { label: string; variant: StatusPillVariant }> = {
  pdf: { label: 'PDF', variant: 'blue' },
  pptx: { label: 'PPTX', variant: 'violet' },
};

function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extrai o nome do arquivo (chave no bucket) de uma URL pública do Supabase Storage. */
function fileKeyFromUrl(url: string): string | null {
  try {
    return decodeURIComponent(url.split('/').pop() ?? '') || null;
  } catch {
    return null;
  }
}

export default function SanarClassTab() {
  const [lessons, setLessons] = useState<SanarClassLesson[]>([]);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    semestres: [],
    formato: "pdf",
    arquivo_url: "",
    ies_id: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lessonsResult, iesResult, storageResult] = await Promise.all([
        supabase
          .from('sanarclass_lessons')
          .select('*')
          .order('data_publicacao', { ascending: false }),
        supabase
          .from('ies')
          .select('*')
          .order('nome'),
        supabase.storage.from('sanarclass-files').list('', { limit: 1000 }),
      ]);

      if (lessonsResult.error) throw lessonsResult.error;
      if (iesResult.error) throw iesResult.error;

      setLessons((lessonsResult.data as SanarClassLesson[]) || []);
      setIesList(iesResult.data || []);

      // Tamanho real dos arquivos (uma única chamada em lote ao storage — não inventamos o dado).
      if (!storageResult.error && storageResult.data) {
        const sizes: Record<string, number> = {};
        storageResult.data.forEach((obj) => {
          const size = (obj.metadata as { size?: number } | null)?.size;
          if (typeof size === 'number') sizes[obj.name] = size;
        });
        setFileSizes(sizes);
      }
    } catch (err) {
      Logger.error('Erro ao buscar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      titulo: "",
      professor: "",
      disciplina: "",
      semestres: [],
      formato: "pdf",
      arquivo_url: "",
      ies_id: "",
      arquivo: null,
    });
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    try {
      setUploading(true);

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${randomString}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('sanarclass-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sanarclass-files')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      Logger.error('Erro ao fazer upload:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleAddLesson = async () => {
    if (!formData.titulo || !formData.professor || !formData.disciplina ||
        formData.semestres.length === 0 || !formData.ies_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!formData.arquivo) {
      toast.error('Faça upload do arquivo');
      return;
    }

    setSaving(true);
    try {
      const arquivoUrl = await handleFileUpload(formData.arquivo);

      const rows = formData.semestres.map(sem => ({
        titulo: formData.titulo,
        professor: formData.professor,
        disciplina: formData.disciplina,
        semestre: parseInt(sem),
        formato: formData.formato,
        arquivo_url: arquivoUrl,
        preview_url: arquivoUrl,
        ies_id: formData.ies_id,
      }));

      const { error } = await supabase
        .from('sanarclass_lessons')
        .insert(rows);

      if (error) throw error;

      toast.success(`Aula adicionada para ${rows.length} semestre(s)`);
      setAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      Logger.error('Erro ao adicionar aula:', error);
      toast.error('Erro ao adicionar aula');
    } finally {
      setSaving(false);
    }
  };

  const handleEditLesson = async () => {
    if (!selectedLesson) return;

    if (!formData.titulo || !formData.professor || !formData.disciplina ||
        formData.semestres.length === 0 || !formData.ies_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      let arquivoUrl = formData.arquivo_url;

      if (formData.arquivo) {
        arquivoUrl = await handleFileUpload(formData.arquivo);

        if (selectedLesson.arquivo_url) {
          const oldPath = fileKeyFromUrl(selectedLesson.arquivo_url);
          if (oldPath) {
            await supabase.storage
              .from('sanarclass-files')
              .remove([oldPath]);
          }
        }
      }

      const { error } = await supabase
        .from('sanarclass_lessons')
        .update({
          titulo: formData.titulo,
          professor: formData.professor,
          disciplina: formData.disciplina,
          semestre: parseInt(formData.semestres[0]),
          formato: formData.formato,
          arquivo_url: arquivoUrl,
          preview_url: arquivoUrl,
          ies_id: formData.ies_id,
        })
        .eq('id', selectedLesson.id);

      if (error) throw error;

      toast.success('Aula atualizada com sucesso');
      setEditModalOpen(false);
      setSelectedLesson(null);
      resetForm();
      fetchData();
    } catch (error) {
      Logger.error('Erro ao atualizar aula:', error);
      toast.error('Erro ao atualizar aula');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!selectedLesson) return;
    const target = selectedLesson;

    setSaving(true);
    try {
      if (target.arquivo_url) {
        const filePath = fileKeyFromUrl(target.arquivo_url);
        if (filePath) {
          await supabase.storage
            .from('sanarclass-files')
            .remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('sanarclass_lessons')
        .delete()
        .eq('id', target.id);

      if (error) throw error;

      toast.success('Aula excluída com sucesso');
      await logAdminAction('material_delete', null, { lesson_id: target.id, file_name: target.titulo });
      setDeleteDialogOpen(false);
      setSelectedLesson(null);
      fetchData();
    } catch (error) {
      Logger.error('Erro ao excluir aula:', error);
      toast.error('Erro ao excluir aula');
      throw error;
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
      semestres: [lesson.semestre.toString()],
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

  const iesNome = (iesId: string) => iesList.find((i) => i.id === iesId)?.nome ?? '—';

  if (loading) return <AdminLoading rows={6} />;
  if (error) return <AdminError message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setAddModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar nova aula
        </Button>
      </div>

      {lessons.length === 0 ? (
        <AdminEmpty
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum material cadastrado"
          description="Adicione a primeira aula do SanarClass."
          action={
            <Button onClick={() => setAddModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar nova aula
            </Button>
          }
        />
      ) : (
        <AdminTable>
          <TableHeader>
            <TableRow>
              <TableHead className={adminTableHeadClass}>Material</TableHead>
              <TableHead className={adminTableHeadClass}>IES</TableHead>
              <TableHead className={adminTableHeadClass}>Sem.</TableHead>
              <TableHead className={adminTableHeadClass}>Disciplina</TableHead>
              <TableHead className={adminTableHeadClass}>Professor</TableHead>
              <TableHead className={adminTableHeadClass}>Tamanho</TableHead>
              <TableHead className={adminTableHeadClass}>Publicado</TableHead>
              <TableHead className={adminTableHeadClass}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((lesson) => {
              const pill = FORMAT_PILL[lesson.formato] ?? { label: lesson.formato.toUpperCase(), variant: 'muted' as StatusPillVariant };
              const fileKey = fileKeyFromUrl(lesson.arquivo_url);
              return (
                <TableRow key={lesson.id}>
                  <TableCell className={adminTableCellClass}>
                    <div className="flex items-center gap-2">
                      <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                      <span className="font-medium">{lesson.titulo}</span>
                    </div>
                  </TableCell>
                  <TableCell className={adminTableCellClass}>{iesNome(lesson.ies_id)}</TableCell>
                  <TableCell className={adminTableCellClass}>
                    <MonoValue>{lesson.semestre}º</MonoValue>
                  </TableCell>
                  <TableCell className={adminTableCellClass}>{lesson.disciplina}</TableCell>
                  <TableCell className={adminTableCellClass}>{lesson.professor}</TableCell>
                  <TableCell className={adminTableCellClass}>
                    <MonoValue muted>{formatBytes(fileKey ? fileSizes[fileKey] : undefined)}</MonoValue>
                  </TableCell>
                  <TableCell className={adminTableCellClass}>
                    <MonoValue muted>{format(toBrazilDate(lesson.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}</MonoValue>
                  </TableCell>
                  <TableCell className={adminTableCellClass}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(lesson)} aria-label="Editar material">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(lesson)} aria-label="Excluir material">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </AdminTable>
      )}

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
                <Label>Semestre(s) *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start font-normal h-10">
                      {formData.semestres.length === 0
                        ? "Selecione"
                        : formData.semestres.length === 1
                          ? `${formData.semestres[0]}º Semestre`
                          : `${formData.semestres.length} semestres`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="grid gap-1 max-h-60 overflow-y-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(sem => (
                        <label key={sem} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                          <Checkbox
                            checked={formData.semestres.includes(sem.toString())}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                semestres: checked
                                  ? [...prev.semestres, sem.toString()]
                                  : prev.semestres.filter(s => s !== sem.toString())
                              }));
                            }}
                          />
                          <span className="text-sm">{sem}º Semestre</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
              <Label htmlFor="arquivo">Upload do arquivo (PDF ou PPTX) *</Label>
              <Input
                id="arquivo"
                type="file"
                accept=".pdf,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, arquivo: file });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Tamanho máximo: 50MB.
              </p>
              {formData.arquivo && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Arquivo selecionado: {formData.arquivo.name} ({(formData.arquivo.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddLesson} disabled={saving || uploading}>
              {saving || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Fazendo upload...' : 'Salvando...'}
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
                <Select value={formData.semestres[0] || ''} onValueChange={(value) => setFormData({ ...formData, semestres: [value] })}>
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
              <Label htmlFor="edit-arquivo">Arquivo atual</Label>
              {formData.arquivo_url && (
                <p className="text-xs text-muted-foreground mb-2">
                  Arquivo: {formData.arquivo_url.split('/').pop()}
                </p>
              )}
              <Label htmlFor="edit-arquivo-novo">Substituir arquivo (opcional)</Label>
              <Input
                id="edit-arquivo-novo"
                type="file"
                accept=".pdf,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, arquivo: file });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter o arquivo atual. Máximo: 50MB.
              </p>
              {formData.arquivo && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Novo arquivo: {formData.arquivo.name} ({(formData.arquivo.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                setEditModalOpen(false);
                if (selectedLesson) openDeleteDialog(selectedLesson);
              }}
            >
              Excluir aula
            </Button>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditLesson} disabled={saving || uploading}>
              {saving || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Fazendo upload...' : 'Salvando...'}
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DangerZone
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        level="medium"
        title="Excluir material"
        impact={
          <span>
            A aula <strong>{selectedLesson?.titulo}</strong> e seu arquivo serão excluídos permanentemente.
          </span>
        }
        actionLabel="Excluir aula"
        onConfirm={handleDeleteLesson}
      />
    </div>
  );
}
