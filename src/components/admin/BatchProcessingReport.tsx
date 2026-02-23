import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  SkipForward, 
  Download, 
  X,
  Clock,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface BatchResult {
  email: string;
  nome: string;
  linha: number;
  success: boolean;
  action?: 'created' | 'updated' | 'skipped';
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  fieldsUpdated?: string[];
  emailSent?: boolean;
}

export interface BatchReport {
  total: number;
  created: number;
  updated: number;
  errors: number;
  skipped: number;
  results: BatchResult[];
  startedAt: Date;
  finishedAt: Date;
}

interface BatchProcessingReportProps {
  report: BatchReport;
  onDownload: () => void;
  onClose: () => void;
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const seconds = Math.floor(diffMs / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}m ${remainingSeconds}s`;
}

export const BatchProcessingReport: React.FC<BatchProcessingReportProps> = ({
  report,
  onDownload,
  onClose
}) => {
  const [showErrors, setShowErrors] = React.useState(true);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const duration = formatDuration(report.startedAt, report.finishedAt);
  
  const errorResults = report.results.filter(r => !r.success);
  const createdResults = report.results.filter(r => r.success && r.action === 'created');
  const updatedResults = report.results.filter(r => r.success && r.action === 'updated');

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            📊 Relatório de Processamento
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-muted/50">
            <CardContent className="p-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{report.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
              <div className="text-2xl font-bold text-emerald-600">{report.created}</div>
              <div className="text-xs text-emerald-600/80">Criados</div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-3 text-center">
              <RefreshCw className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{report.updated}</div>
              <div className="text-xs text-blue-600/80">Atualizados</div>
            </CardContent>
          </Card>
          
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3 text-center">
              <AlertCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
              <div className="text-2xl font-bold text-destructive">{report.errors}</div>
              <div className="text-xs text-destructive/80">Erros</div>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{duration}</div>
              <div className="text-xs text-muted-foreground">Duração</div>
            </CardContent>
          </Card>
        </div>

        {/* Error Details */}
        {report.errors > 0 && (
          <Collapsible open={showErrors} onOpenChange={setShowErrors}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium">Erros ({report.errors})</span>
                </div>
                {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-48 rounded-md border bg-destructive/5 p-3">
                <div className="space-y-2">
                  {errorResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-2 rounded bg-background/80 border border-destructive/20"
                    >
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Linha {result.linha}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{result.nome}</div>
                        <div className="text-xs text-destructive mt-1">
                          <Badge variant="destructive" className="text-[10px] mr-1">
                            {result.error?.code}
                          </Badge>
                          {result.error?.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Success Details (Created + Updated) */}
        {(report.created > 0 || report.updated > 0) && (
          <Collapsible open={showSuccess} onOpenChange={setShowSuccess}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Sucesso ({report.created + report.updated})</span>
                </div>
                {showSuccess ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-48 rounded-md border bg-muted/30 p-3">
                <div className="space-y-2">
                  {createdResults.map((result, idx) => (
                    <div 
                      key={`created-${idx}`} 
                      className="flex items-center gap-3 p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.emailSent ? 'E-mail de boas-vindas enviado' : '⚠️ E-mail não enviado'}
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                        Criado
                      </Badge>
                    </div>
                  ))}
                  {updatedResults.map((result, idx) => (
                    <div 
                      key={`updated-${idx}`} 
                      className="flex items-center gap-3 p-2 rounded bg-blue-500/10 border border-blue-500/20"
                    >
                      <RefreshCw className="h-4 w-4 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.fieldsUpdated?.length 
                            ? `Atualizado: ${result.fieldsUpdated.join(', ')}`
                            : 'Nenhuma alteração necessária'
                          }
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                        Atualizado
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={onDownload} variant="outline" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Baixar Relatório XLSX
          </Button>
          <Button onClick={onClose} className="flex-1">
            Fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
