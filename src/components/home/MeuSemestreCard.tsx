import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Play, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface TopAula {
  id: string;
  titulo: string;
  materia: string;
  acessos: number;
  link: string;
}

interface ConteudoRelacionado {
  id: string;
  titulo: string;
  tipo: 'prova' | 'reforco';
  link: string;
}

interface MeuSemestreCardProps {
  topAulas: TopAula[];
  conteudosRelacionados: ConteudoRelacionado[];
}

export const MeuSemestreCard = ({ topAulas, conteudosRelacionados }: MeuSemestreCardProps) => {
  return (
    <Card className="premium-card col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Meu Semestre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna Esquerda: Top 3 Aulas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Mais Acessadas pelos Colegas
            </h3>
            <div className="space-y-3">
              {topAulas.map((aula, index) => (
                <motion.div
                  key={aula.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{aula.titulo}</div>
                    <div className="text-sm text-muted-foreground">{aula.materia}</div>
                    <div className="text-xs text-muted-foreground">{aula.acessos} acessos</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(aula.link, '_blank')}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Assistir
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Coluna Direita: Conteúdos Relacionados */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Provas e Conteúdos Relacionados
            </h3>
            <div className="space-y-3">
              {conteudosRelacionados.map((conteudo, index) => (
                <motion.div
                  key={conteudo.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
                >
                  <div className={`p-2 rounded-lg ${conteudo.tipo === 'prova' ? 'bg-uscs-blue/10' : 'bg-uscs-orange/10'}`}>
                    <FileText className={`h-5 w-5 ${conteudo.tipo === 'prova' ? 'text-uscs-blue' : 'text-uscs-orange'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{conteudo.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {conteudo.tipo === 'prova' ? 'Prova Anterior' : 'Conteúdo de Reforço'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(conteudo.link, '_blank')}
                  >
                    Ver
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
