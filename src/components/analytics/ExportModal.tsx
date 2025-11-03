import * as React from 'react';
const { useState } = React;
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AnalyticsFilters;
}

const mockExportData = [
  { id: 1, usuario: 'Usuário #2847', curso: 'Medicina', ies: 'USP', cliques: 45, sessao: '25min', completude: '65%' },
  { id: 2, usuario: 'Usuário #1923', curso: 'Enfermagem', ies: 'UNIFESP', cliques: 38, sessao: '18min', completude: '52%' },
  { id: 3, usuario: 'Usuário #5671', curso: 'Medicina', ies: 'UNICAMP', cliques: 52, sessao: '32min', completude: '78%' },
  { id: 4, usuario: 'Usuário #8934', curso: 'Farmácia', ies: 'USP', cliques: 12, sessao: '8min', completude: '23%' },
  { id: 5, usuario: 'Usuário #4576', curso: 'Enfermagem', ies: 'USCS', cliques: 41, sessao: '22min', completude: '61%' }
];

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange, filters }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    // Simulate download progress
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsDownloading(false);
          
          toast({
            title: "CSV exportado com sucesso!",
            description: "Arquivo analytics_data.csv baixado",
            duration: 3000,
          });
          
          onOpenChange(false);
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  const filteredData = mockExportData.filter(item => {
    if (filters.course && !item.curso.toLowerCase().includes(filters.course.toLowerCase())) {
      return false;
    }
    if (filters.university && !item.ies.toLowerCase().includes(filters.university.toLowerCase())) {
      return false;
    }
    if (filters.searchTerm && !item.usuario.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Exportar Dados Analíticos</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Dados filtrados para exportação ({filteredData.length} registros)
            </p>
            
            {/* Filters Summary */}
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.course && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  Curso: {filters.course}
                </span>
              )}
              {filters.university && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  IES: {filters.university}
                </span>
              )}
              {filters.searchTerm && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                  Busca: {filters.searchTerm}
                </span>
              )}
              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                Período: {filters.dateRange.start.toLocaleDateString()} - {filters.dateRange.end.toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>IES</TableHead>
                  <TableHead>Cliques</TableHead>
                  <TableHead>Sessão</TableHead>
                  <TableHead>Completude</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.usuario}</TableCell>
                    <TableCell>{row.curso}</TableCell>
                    <TableCell>{row.ies}</TableCell>
                    <TableCell>{row.cliques}</TableCell>
                    <TableCell>{row.sessao}</TableCell>
                    <TableCell>{row.completude}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado encontrado com os filtros aplicados
            </div>
          )}
        </div>

        {/* Download Section */}
        <div className="border-t pt-4 space-y-4">
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Preparando download...</span>
                <span>{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="w-full" />
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              <p>Formato: CSV (compatível com Excel)</p>
              <p>Tamanho estimado: ~{Math.round(filteredData.length * 0.1)}KB</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isDownloading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDownload}
                disabled={isDownloading || filteredData.length === 0}
                className="gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Baixar CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};