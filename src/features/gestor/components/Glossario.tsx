import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PROFICIENCIA_MINIMA } from '../lib/regras';
import { useGestorPortalContainer } from '../shell/GestorShell';

/**
 * Lista definitiva das escalas do portal — handoff docs/04-componentes.md §7.
 *
 * NÃO existe entrada "Nota TRI": a métrica foi eliminada como conceito separado
 * de proficiência (spec §4.1). O rótulo único é "Proficiência". Um teste de
 * regressão garante que a string não volte.
 */
export const ENTRADAS_GLOSSARIO: { termo: string; definicao: string }[] = [
  {
    termo: 'Proficiência (0 a 100)',
    definicao:
      'Desempenho estimado do aluno considerando a dificuldade das questões respondidas.',
  },
  {
    termo: 'Conceito ENAMED projetado (1 a 5)',
    definicao:
      'Projeção institucional a partir dos simulados. Não é o conceito oficial do MEC.',
  },
  {
    termo: 'Percentual de acerto',
    definicao:
      'Questões certas sobre questões respondidas, no recorte selecionado. É a única métrica válida para grande área, especialidade e tema.',
  },
  {
    termo: 'Cobertura parcial',
    definicao:
      'Recorte com poucos participantes ou poucas questões. Leia com cautela.',
  },
  {
    termo: 'Proficiente',
    definicao: `Proficiência de ${PROFICIENCIA_MINIMA} ou mais. O corte é do produto, não do MEC.`,
  },
];

export function Glossario() {
  const [aberto, setAberto] = useState(false);
  const container = useGestorPortalContainer();

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {/* Link de marca, nunca botão neutro: na referência a afordância vive no
            mesmo bloco alinhado à direita do segmented de semestre, em 12px/600
            com a cor da marca. `--gp-brand-on-dark` porque no tema escuro a
            marca crua reprova AA como cor de texto. */}
        <button
          type="button"
          className="whitespace-nowrap rounded-sm underline-offset-4 hover:underline focus-visible:outline-none"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
        >
          Entenda as métricas
        </button>
      </DialogTrigger>

      <DialogContent container={container} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Entenda as métricas</DialogTitle>
        </DialogHeader>

        <dl className="space-y-4">
          {ENTRADAS_GLOSSARIO.map((entrada) => (
            <div key={entrada.termo} className="space-y-1">
              <dt className="text-sm font-semibold text-foreground">
                {entrada.termo}
              </dt>
              <dd className="text-sm leading-5 text-muted-foreground">
                {entrada.definicao}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
