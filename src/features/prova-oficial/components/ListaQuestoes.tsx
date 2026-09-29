import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { filtrarQuestoes } from '../lib/questoes';
import type { FiltroQuestoes } from '../lib/questoes';
import { QuestaoRevisao } from './QuestaoRevisao';
import type { QuestaoProvaOficial } from '../types';

interface ListaQuestoesProps {
  questoes: QuestaoProvaOficial[];
  /** Caderno efetivo do aluno — repassado a cada QuestaoRevisao. */
  caderno: number;
}

const TODAS_AREAS = '__todas__';

const CHIPS: { tipo: FiltroQuestoes['tipo']; label: string }[] = [
  { tipo: 'todas', label: 'Todas' },
  { tipo: 'erradas', label: 'Erradas' },
  { tipo: 'em_branco', label: 'Em branco' },
];

/**
 * Lista de revisão questão a questão, na ordem do caderno do próprio aluno
 * (spec D4) — nunca a ordem/numeração do Caderno 1. Sem virtualização: até
 * 100 itens (o tamanho de uma prova) são renderizados de uma vez (brief).
 */
export const ListaQuestoes = ({ questoes, caderno }: ListaQuestoesProps) => {
  const [tipo, setTipo] = useState<FiltroQuestoes['tipo']>('todas');
  const [area, setArea] = useState<string | null>(null);

  const areasDisponiveis = useMemo(() => {
    const vistas = new Set<string>();
    for (const q of questoes) {
      if (q.grandeArea) vistas.add(q.grandeArea);
    }
    return Array.from(vistas).sort((a, b) => a.localeCompare(b));
  }, [questoes]);

  const filtradas = useMemo(
    () => filtrarQuestoes(questoes, { tipo, area }),
    [questoes, tipo, area],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold tracking-tight">Revisão questão a questão</h2>

      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map((chip) => (
          <Button
            key={chip.tipo}
            type="button"
            size="sm"
            variant={tipo === chip.tipo ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setTipo(chip.tipo)}
          >
            {chip.label}
          </Button>
        ))}

        {areasDisponiveis.length > 0 && (
          <Select
            value={area ?? TODAS_AREAS}
            onValueChange={(v) => setArea(v === TODAS_AREAS ? null : v)}
          >
            <SelectTrigger className="w-auto min-w-[9rem] h-9 rounded-full text-xs sm:text-sm">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS_AREAS}>Todas as áreas</SelectItem>
              {areasDisponiveis.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filtradas.length} questões</p>

      <div className="space-y-4">
        {filtradas.map((q) => (
          <QuestaoRevisao key={q.questionId} questao={q} caderno={caderno} />
        ))}
      </div>
    </section>
  );
};
