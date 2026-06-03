import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Target, BarChart3, School, TrendingUp, ChevronLeft, ChevronRight, CheckCircle, XCircle, Download, ArrowUpDown, Ban, Building2 } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, BarChart as RechartsBarChart, Bar, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { normalizeGrandeArea } from '@/utils/grandeArea';

// --- Types ---
interface Simulado { id: string; nome: string; }
interface SemesterData { semestre: number; total: number; acertos: number; num_students: number; }
interface AreaData { name: string; total: number; acertos: number; }
interface SpecialtyData extends AreaData { area_name: string; }
interface SubspecialtyData extends AreaData { specialty_name: string; area_name: string; }
interface OverallStats { total: number; acertos: number; totalStudents: number; }
interface QuestionDetail {
  id: string; enunciado: string; a: string; b: string; c: string; d: string;
  gabarito: string; comentario: string; imagem: string | null; anulada: boolean;
  semester_distribution: SemesterData[];
  students: { nome: string; semestre: number; acertou: boolean; resposta: string; }[];
}
interface StudentScore { nome: string; semestre: number; score_total: number; total_questions: number; scores_by_area: Record<string, number>; }
interface EvolutionData { simulado_id: string; simulado_nome: string; created_at: string; areas: { area: string; total: number; acertos: number; percentual: number; }[]; }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// --- Semester Chart ---
const SemesterChart: React.FC<{ data: SemesterData[] }> = ({ data }) => {
  const chartData = data.map(d => ({
    name: `${d.semestre}º Sem`,
    percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
    acertos: d.acertos,
    total: d.total,
    alunos: d.num_students,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Acurácia por Semestre</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Sem dados de semestre disponíveis.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs fill-muted-foreground" />
              <RechartsTooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-sm">Acurácia: <strong>{d.percentual}%</strong></p>
                    <p className="text-sm text-muted-foreground">{d.acertos}/{d.total} acertos · {d.alunos} alunos</p>
                  </div>
                );
              }} />
              <Bar dataKey="percentual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Acurácia %" />
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

// --- Evolution Chart ---
const EvolutionChart: React.FC<{ data: EvolutionData[] }> = ({ data }) => {
  const allAreas = useMemo(() => {
    const set = new Set<string>();
    data.forEach(d => d.areas.forEach(a => set.add(a.area)));
    return Array.from(set).sort();
  }, [data]);

  const chartData = data.map(d => {
    const row: any = { name: d.simulado_nome.length > 20 ? d.simulado_nome.slice(0, 20) + '…' : d.simulado_nome };
    d.areas.forEach(a => { row[a.area] = a.percentual; });
    return row;
  });

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-primary" />Evolução por Simulado e Grande Área</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <RechartsBarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} className="text-xs fill-muted-foreground" interval={0} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs fill-muted-foreground" />
            <RechartsTooltip />
            <Legend />
            {allAreas.map((area, i) => (
              <Bar key={area} dataKey={area} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// --- Hierarchical Tree ---
const TreeNode: React.FC<{ name: string; percentage: number; isSelected: boolean; onClick: () => void }> = ({ name, percentage, isSelected, onClick }) => (
  <button onClick={onClick} className={cn("w-full text-left p-3 border rounded-md transition-all duration-200 hover:bg-muted/80", isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border")}>
    <div className="flex justify-between items-center gap-2">
      <span className="font-medium text-sm truncate">{name}</span>
      <span className={cn("font-bold text-sm shrink-0", isSelected ? "text-primary-foreground" : "text-primary")}>{percentage}%</span>
    </div>
  </button>
);

const TreeColumn: React.FC<{ title: string; children: React.ReactNode; isEmpty?: boolean; emptyText?: string }> = ({ title, children, isEmpty, emptyText }) => (
  <div className="flex-1 min-w-0 md:min-w-[200px]">
    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{title}</h3>
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {isEmpty ? (
        <div className="flex items-center justify-center h-40 text-center text-muted-foreground text-sm p-4 border border-dashed rounded-md">{emptyText}</div>
      ) : children}
    </div>
  </div>
);

// --- Question Detail Modal ---
const InstitutionalQuestionModal: React.FC<{
  isOpen: boolean; onOpenChange: (open: boolean) => void;
  questions: QuestionDetail[]; isLoading: boolean;
}> = ({ isOpen, onOpenChange, questions, isLoading }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (isOpen) setIdx(0); }, [isOpen]);

  const q = questions[idx];
  const alts = q ? [{ key: 'A', text: q.a }, { key: 'B', text: q.b }, { key: 'C', text: q.c }, { key: 'D', text: q.d }] : [];

  const semChartData = q?.semester_distribution.map(s => ({
    name: `${s.semestre}º`,
    percentual: s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0,
    acertos: s.acertos,
    total: s.total,
  })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Questão
            {q?.anulada && <Badge variant="secondary" className="bg-purple-500/10 text-purple-500"><Ban className="h-3 w-3 mr-1" />ANULADA</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto space-y-6 py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : q ? (
            <>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{q.enunciado}</p>
              {q.imagem && <div className="flex justify-center"><img src={q.imagem} alt="Questão" className="max-w-full h-auto rounded-md" /></div>}
              <div className="space-y-2">
                {alts.map(alt => (
                  <div key={alt.key} className={cn("p-3 border rounded-md", alt.key === q.gabarito
                    ? "bg-green-100 border-green-500 dark:bg-green-500/20 dark:border-green-600"
                    : "bg-muted/30"
                  )}>
                    <span className="font-bold mr-2">{alt.key})</span>{alt.text}
                  </div>
                ))}
              </div>
              {q.comentario && (
                <div className="bg-muted/80 p-4 rounded-md border">
                  <h4 className="font-bold text-primary mb-2">Comentário</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{q.comentario}</p>
                </div>
              )}

              {/* Semester distribution chart */}
              {semChartData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm">Distribuição de Acertos por Semestre</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsBarChart data={semChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs fill-muted-foreground" />
                      <RechartsTooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return <div className="bg-background border rounded-lg shadow-lg p-2 text-sm"><p>{d.name} Sem — {d.percentual}% ({d.acertos}/{d.total})</p></div>;
                      }} />
                      <Bar dataKey="percentual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Student list */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Respostas dos Alunos ({q.students.length})</h4>
                <div className="max-h-[300px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="w-20">Semestre</TableHead>
                        <TableHead className="w-20">Resposta</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {q.students.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.nome}</TableCell>
                          <TableCell>{s.semestre}º</TableCell>
                          <TableCell>{s.resposta || '—'}</TableCell>
                          <TableCell>
                            {s.acertou
                              ? <CheckCircle className="h-4 w-4 text-green-500" />
                              : <XCircle className="h-4 w-4 text-red-500" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : <p className="text-center text-muted-foreground">Nenhuma questão encontrada.</p>}
        </div>
        {questions.length > 1 && (
          <div className="flex-shrink-0 pt-4 border-t flex justify-between items-center">
            <Button variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button>
            <span className="text-sm text-muted-foreground">{idx + 1} de {questions.length}</span>
            <Button variant="outline" onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))} disabled={idx === questions.length - 1}>Próxima<ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Student Scores Table ---
const StudentScoresTable: React.FC<{ areas: string[]; students: StudentScore[]; simuladoName: string }> = ({ areas, students, simuladoName }) => {
  const [sortKey, setSortKey] = useState<string>('score_total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...students].sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'score_total') { va = a.score_total; vb = b.score_total; }
      else if (sortKey === 'semestre') { va = a.semestre ?? 0; vb = b.semestre ?? 0; }
      else { va = a.scores_by_area?.[sortKey] ?? 0; vb = b.scores_by_area?.[sortKey] ?? 0; }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [students, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = sorted.map(s => {
        const row: Record<string, any> = { Aluno: s.nome, Semestre: s.semestre };
        areas.forEach(a => { row[a] = s.scores_by_area?.[a] ?? 0; });
        row['Score Total'] = s.score_total;
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Desempenho');
      XLSX.writeFile(wb, `desempenho_${simuladoName.replace(/\s+/g, '_')}.xlsx`);
      toast({ title: 'Planilha exportada com sucesso!' });
    } catch { toast({ title: 'Erro ao exportar', variant: 'destructive' }); }
  };

  const SortHeader: React.FC<{ label: string; sortKeyName: string }> = ({ label, sortKeyName }) => (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort(sortKeyName)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === sortKeyName ? "text-primary" : "text-muted-foreground/50")} />
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />Planilha de Desempenho Individual</CardTitle>
        <Button variant="outline" size="sm" onClick={exportXLSX}><Download className="h-4 w-4 mr-2" />Exportar XLSX</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Aluno" sortKeyName="nome" />
                <SortHeader label="Semestre" sortKeyName="semestre" />
                {areas.map(a => <SortHeader key={a} label={a} sortKeyName={a} />)}
                <SortHeader label="Score Total" sortKeyName="score_total" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium whitespace-nowrap">{s.nome}</TableCell>
                  <TableCell>{s.semestre ?? '—'}º</TableCell>
                  {areas.map(a => <TableCell key={a} className="text-center">{s.scores_by_area?.[a] ?? 0}</TableCell>)}
                  <TableCell className="text-center font-bold text-primary">{s.score_total}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={areas.length + 3} className="text-center text-muted-foreground py-8">Nenhum aluno encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Main Page ---
const DesempenhoInstitucional: React.FC = () => {
  const { user } = useAuth();
  const canFilterIES = isAdmin(user);
  
  // IES filter (for admin/b2b_partner)
  const [iesList, setIesList] = useState<{ id: string; nome: string }[]>([]);
  const [selectedIes, setSelectedIes] = useState<string | null>(null);

  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [selectedSimulado, setSelectedSimulado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(false);

  // Performance data
  const [overallStats, setOverallStats] = useState<OverallStats>({ total: 0, acertos: 0, totalStudents: 0 });
  const [bySemester, setBySemester] = useState<SemesterData[]>([]);
  const [byArea, setByArea] = useState<AreaData[]>([]);
  const [bySpecialty, setBySpecialty] = useState<SpecialtyData[]>([]);
  const [bySubspecialty, setBySubspecialty] = useState<SubspecialtyData[]>([]);

  // Tree state
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  // Question modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuestions, setModalQuestions] = useState<QuestionDetail[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Student scores
  const [scoreAreas, setScoreAreas] = useState<string[]>([]);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);

  // Evolution
  const [evolution, setEvolution] = useState<EvolutionData[]>([]);

  // Helper to get IES param for RPCs
  const iesParam = canFilterIES && selectedIes ? selectedIes : undefined;

  // Load IES list for admin/b2b_partner
  useEffect(() => {
    if (!canFilterIES) return;
    const load = async () => {
      const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
      if (!error && data) {
        setIesList(data);
        if (data.length > 0 && !selectedIes) setSelectedIes(data[0].id);
      }
    };
    load();
  }, [canFilterIES]);

  // Load simulados (re-trigger when IES changes for admin/b2b)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_institutional_simulados', {
        p_ies_id: iesParam ?? undefined,
      });
      if (!error && data) {
        setSimulados(data as Simulado[]);
        if (data.length > 0) setSelectedSimulado((data as Simulado[])[0].id);
        else setSelectedSimulado(null);
      }
      setLoading(false);
    };
    // For professor: load immediately. For admin/b2b: wait for IES selection
    if (!canFilterIES || selectedIes) load();
  }, [canFilterIES, selectedIes]);

  // Load evolution (re-trigger when IES changes)
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_institutional_evolution', {
        p_ies_id: iesParam ?? undefined,
      });
      if (!error && data) setEvolution(data as unknown as EvolutionData[]);
    };
    if (!canFilterIES || selectedIes) load();
  }, [canFilterIES, selectedIes]);

  // Load performance when simulado changes
  useEffect(() => {
    if (!selectedSimulado) return;
    const load = async () => {
      setPerfLoading(true);
      setSelectedArea(null);
      setSelectedSpecialty(null);

      const perfParams: any = { p_simulado_id: selectedSimulado };
      const scoresParams: any = { p_simulado_id: selectedSimulado };
      if (iesParam) {
        perfParams.p_ies_id = iesParam;
        scoresParams.p_ies_id = iesParam;
      }

      const [perfRes, scoresRes] = await Promise.all([
        supabase.rpc('get_institutional_performance', perfParams),
        supabase.rpc('get_institutional_student_scores', scoresParams),
      ]);

      if (!perfRes.error && perfRes.data) {
        const d = perfRes.data as any;
        setOverallStats(d.overallStats || { total: 0, acertos: 0, totalStudents: 0 });
        setBySemester(d.bySemester || []);
        // Mescla variantes de `grande_area` (ex.: "Ginecologia" + "Ginecologia e Obstetrícia")
        // mesmo se o backend devolver linhas separadas (cache antigo / dados não migrados).
        const mergedAreas = new Map<string, { name: string; total: number; acertos: number }>();
        (d.byArea || []).forEach((a: any) => {
          const canonical = normalizeGrandeArea(a.name);
          const existing = mergedAreas.get(canonical) || { name: canonical, total: 0, acertos: 0 };
          existing.total += Number(a.total) || 0;
          existing.acertos += Number(a.acertos) || 0;
          mergedAreas.set(canonical, existing);
        });
        setByArea(Array.from(mergedAreas.values()).map(a => ({ ...a, percentual: a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0 })));
        setBySpecialty((d.bySpecialty || []).map((a: any) => ({ ...a, area_name: normalizeGrandeArea(a.area_name), percentual: a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0 })));
        setBySubspecialty((d.bySubspecialty || []).map((a: any) => ({ ...a, area_name: normalizeGrandeArea(a.area_name), percentual: a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0 })));
      }

      if (!scoresRes.error && scoresRes.data) {
        const d = scoresRes.data as any;
        setScoreAreas(d.areas || []);
        setStudentScores(d.students || []);
      }

      setPerfLoading(false);
    };
    load();
  }, [selectedSimulado]);

  const handleSubspecialtyClick = async (tema: string, area: string | null, specialty: string | null) => {
    if (!selectedSimulado) return;
    setModalOpen(true);
    setModalLoading(true);
    setModalQuestions([]);

    const params = {
      p_simulado_id: selectedSimulado!,
      p_tema: tema,
      p_area: area || undefined,
      p_specialty: specialty || undefined,
      p_ies_id: iesParam ?? undefined,
    };

    const { data, error } = await supabase.rpc('get_institutional_question_details', params);

    if (!error && data) {
      setModalQuestions((data as any).questions || []);
    }
    setModalLoading(false);
  };

  // Tree filtering
  const filteredSpecialties = selectedArea ? bySpecialty.filter(s => s.area_name?.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueSpecialties = filteredSpecialties.filter((s, i, arr) => i === arr.findIndex(x => x.name.toLowerCase() === s.name.toLowerCase())).sort((a, b) => (b as any).percentual - (a as any).percentual);
  const filteredSubs = selectedArea && selectedSpecialty ? bySubspecialty.filter(s => s.specialty_name?.toLowerCase() === selectedSpecialty.toLowerCase() && s.area_name?.toLowerCase() === selectedArea.toLowerCase()) : [];
  const uniqueSubs = filteredSubs.filter((s, i, arr) => i === arr.findIndex(x => x.name.toLowerCase() === s.name.toLowerCase())).sort((a, b) => (b as any).percentual - (a as any).percentual);

  const percentualGeral = overallStats.total > 0 ? Math.round((overallStats.acertos / overallStats.total) * 100) : 0;
  const simuladoName = simulados.find(s => s.id === selectedSimulado)?.nome || '';
  const iesName = canFilterIES ? iesList.find(i => i.id === selectedIes)?.nome : user?.ies_nome;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><School className="h-6 w-6 text-primary" />Desempenho Institucional</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visão geral do desempenho dos alunos nos simulados
              {iesName && <span className="font-medium text-foreground"> — {iesName}</span>}
            </p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* IES filter for admin/b2b_partner */}
          {canFilterIES && (
            <Select value={selectedIes || ''} onValueChange={(val) => { setSelectedIes(val); setSelectedSimulado(null); }}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Selecione uma IES" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {iesList.map(ies => <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Simulado filter */}
          <Select value={selectedSimulado || ''} onValueChange={setSelectedSimulado}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Selecione um simulado" />
            </SelectTrigger>
            <SelectContent>
              {simulados.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {perfLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : selectedSimulado ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{overallStats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Alunos Participantes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{percentualGeral}%</p>
                <p className="text-sm text-muted-foreground">Acurácia Média</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{overallStats.total}</p>
                <p className="text-sm text-muted-foreground">Respostas Totais</p>
              </CardContent>
            </Card>
          </div>

          {/* Semester Chart */}
          <SemesterChart data={bySemester} />

          {/* Hierarchical Tree */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Análise Hierárquica Institucional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:border-r lg:pr-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Acurácia Geral</h3>
                  <div className="flex items-center justify-center bg-primary text-primary-foreground p-4 rounded-md min-w-[180px]">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{percentualGeral}%</p>
                      <p className="text-xs opacity-80">{overallStats.acertos}/{overallStats.total}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TreeColumn title="Grande Área">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      {byArea.map(a => (
                        <TreeNode key={a.name} name={a.name} percentage={(a as any).percentual}
                          isSelected={selectedArea === a.name}
                          onClick={() => { setSelectedArea(selectedArea === a.name ? null : a.name); setSelectedSpecialty(null); }}
                        />
                      ))}
                    </motion.div>
                  </TreeColumn>
                  <TreeColumn title="Especialidade" isEmpty={!selectedArea || uniqueSpecialties.length === 0} emptyText={!selectedArea ? "Selecione uma Grande Área." : "Nenhuma encontrada."}>
                    <AnimatePresence>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        {uniqueSpecialties.map(s => (
                          <TreeNode key={s.name} name={s.name} percentage={(s as any).percentual}
                            isSelected={selectedSpecialty === s.name}
                            onClick={() => setSelectedSpecialty(selectedSpecialty === s.name ? null : s.name)}
                          />
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </TreeColumn>
                  <TreeColumn title="Tema / Assunto" isEmpty={!selectedSpecialty || uniqueSubs.length === 0} emptyText={!selectedSpecialty ? "Selecione uma Especialidade." : "Nenhum encontrado."}>
                    <AnimatePresence>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        {uniqueSubs.map(sub => (
                          <button key={sub.name} onClick={() => handleSubspecialtyClick(sub.name, selectedArea, selectedSpecialty)} className="w-full">
                            <TreeNode name={sub.name} percentage={(sub as any).percentual} isSelected={false} onClick={() => {}} />
                          </button>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </TreeColumn>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evolution Chart */}
          <EvolutionChart data={evolution} />

          {/* Student Scores Table */}
          <StudentScoresTable areas={scoreAreas} students={studentScores} simuladoName={simuladoName} />
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <School className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum simulado disponível para sua instituição.</p>
          </CardContent>
        </Card>
      )}

      {/* Question Modal */}
      <InstitutionalQuestionModal isOpen={modalOpen} onOpenChange={setModalOpen} questions={modalQuestions} isLoading={modalLoading} />
    </div>
  );
};

export default DesempenhoInstitucional;
