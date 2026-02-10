import * as React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, Building2, BookOpen, GraduationCap, Video, FileText, HelpCircle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ConteudoRow {
  id_ies: string;
  semestre: string;
  materia: string;
  tema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
}

interface IesRow {
  id: string;
  nome: string;
}

interface IesSummary {
  id: string;
  nome: string;
  semestres: number;
  materias: number;
  temas: number;
  aulas: number;
  total: number;
  semestreDetails: SemestreDetail[];
}

interface SemestreDetail {
  semestre: string;
  materias: number;
  temas: number;
  total: number;
}

async function fetchAllConteudos(): Promise<ConteudoRow[]> {
  const PAGE_SIZE = 1000;
  let all: ConteudoRow[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('conteudos')
      .select('id_ies, semestre, materia, tema, aula, link_aula, link_pdf, link_quiz')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data) all = all.concat(data);
    hasMore = data?.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return all;
}

function computeStats(rows: ConteudoRow[], iesList: IesRow[]) {
  const iesMap = new Map(iesList.map(i => [i.id, i.nome]));

  // Global KPIs
  const totalRecords = rows.length;
  const uniqueIes = new Set(rows.map(r => r.id_ies));
  const uniqueSemestres = new Set(rows.map(r => r.semestre));
  const uniqueMaterias = new Set(rows.map(r => r.materia));

  // Coverage
  const withAula = rows.filter(r => r.link_aula).length;
  const withPdf = rows.filter(r => r.link_pdf).length;
  const withQuiz = rows.filter(r => r.link_quiz).length;

  // Per-IES
  const byIes = new Map<string, ConteudoRow[]>();
  rows.forEach(r => {
    if (!byIes.has(r.id_ies)) byIes.set(r.id_ies, []);
    byIes.get(r.id_ies)!.push(r);
  });

  const iesSummaries: IesSummary[] = Array.from(byIes.entries()).map(([iesId, iesRows]) => {
    // Semester details
    const bySem = new Map<string, ConteudoRow[]>();
    iesRows.forEach(r => {
      if (!bySem.has(r.semestre)) bySem.set(r.semestre, []);
      bySem.get(r.semestre)!.push(r);
    });

    const semestreDetails: SemestreDetail[] = Array.from(bySem.entries())
      .sort((a, b) => {
        const numA = parseInt(a[0]);
        const numB = parseInt(b[0]);
        if (isNaN(numA) && isNaN(numB)) return a[0].localeCompare(b[0]);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      })
      .map(([sem, semRows]) => ({
        semestre: sem,
        materias: new Set(semRows.map(r => r.materia)).size,
        temas: new Set(semRows.filter(r => r.tema).map(r => r.tema)).size,
        total: semRows.length,
      }));

    return {
      id: iesId,
      nome: iesMap.get(iesId) || iesId,
      semestres: new Set(iesRows.map(r => r.semestre)).size,
      materias: new Set(iesRows.map(r => r.materia)).size,
      temas: new Set(iesRows.filter(r => r.tema).map(r => r.tema)).size,
      aulas: new Set(iesRows.filter(r => r.aula).map(r => r.aula)).size,
      total: iesRows.length,
      semestreDetails,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    totalRecords,
    totalIes: uniqueIes.size,
    totalSemestres: uniqueSemestres.size,
    totalMaterias: uniqueMaterias.size,
    coverage: {
      aula: totalRecords ? Math.round((withAula / totalRecords) * 100) : 0,
      pdf: totalRecords ? Math.round((withPdf / totalRecords) * 100) : 0,
      quiz: totalRecords ? Math.round((withQuiz / totalRecords) * 100) : 0,
    },
    iesSummaries,
  };
}

export const StudyGuideOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof computeStats> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [conteudos, iesResult] = await Promise.all([
          fetchAllConteudos(),
          supabase.from('ies').select('id, nome'),
        ]);
        if (iesResult.error) throw iesResult.error;
        setStats(computeStats(conteudos, iesResult.data || []));
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do Guia de Estudos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4 text-sm text-destructive">Erro: {error}</CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalRecords === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum dado de guia de estudos encontrado no banco.
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    { label: 'Registros', value: stats.totalRecords.toLocaleString('pt-BR'), icon: <Database className="h-4 w-4" /> },
    { label: 'IES', value: stats.totalIes, icon: <Building2 className="h-4 w-4" /> },
    { label: 'Semestres', value: stats.totalSemestres, icon: <GraduationCap className="h-4 w-4" /> },
    { label: 'Matérias', value: stats.totalMaterias, icon: <BookOpen className="h-4 w-4" /> },
  ];

  const coverageItems = [
    { label: 'Vídeo (link_aula)', value: stats.coverage.aula, icon: <Video className="h-4 w-4" /> },
    { label: 'PDF (link_pdf)', value: stats.coverage.pdf, icon: <FileText className="h-4 w-4" /> },
    { label: 'Quiz (link_quiz)', value: stats.coverage.quiz, icon: <HelpCircle className="h-4 w-4" /> },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Dados do Guia de Estudos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border bg-muted/30 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium">
                {k.icon} {k.label}
              </div>
              <div className="text-2xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Cobertura */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Cobertura de Links</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coverageItems.map(c => (
              <div key={c.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">{c.icon} {c.label}</span>
                  <span className="font-medium">{c.value}%</span>
                </div>
                <Progress value={c.value} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Tabela por IES com Accordion */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Detalhamento por IES</h4>
          <Accordion type="multiple" className="border rounded-lg">
            {stats.iesSummaries.map(ies => (
              <AccordionItem key={ies.id} value={ies.id} className="px-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm">{ies.nome}</span>
                    <div className="flex gap-2 ml-auto mr-4">
                      <Badge variant="secondary" className="text-xs">{ies.total.toLocaleString('pt-BR')} reg.</Badge>
                      <Badge variant="outline" className="text-xs">{ies.semestres} sem.</Badge>
                      <Badge variant="outline" className="text-xs">{ies.materias} mat.</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">Semestre</TableHead>
                        <TableHead className="h-8 text-xs text-right">Matérias</TableHead>
                        <TableHead className="h-8 text-xs text-right">Temas</TableHead>
                        <TableHead className="h-8 text-xs text-right">Registros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ies.semestreDetails.map(s => (
                        <TableRow key={s.semestre}>
                          <TableCell className="py-1.5 text-xs font-medium">{s.semestre}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right">{s.materias}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right">{s.temas}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right">{s.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
};
