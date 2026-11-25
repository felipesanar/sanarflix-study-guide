/** Uma página da leitura na revisão: imagens, identificação, dúvidas de marcação e descarte. */
import { useState } from 'react';
import { Check, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill, type StatusPillVariant } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import { ROTULO_MOTIVO, ROTULO_SITUACAO, type Situacao } from '@/features/cartoes/leitura/linhas';
import type { PaginaLeitura, RevisaoPatch } from '@/features/cartoes/leitura/types';

const VARIANTE: Record<Situacao, StatusPillVariant> = {
  pronta: 'emerald',
  com_duvida: 'amber',
  nao_identificada: 'red',
  duplicada: 'red',
  ignorada: 'muted',
  descartada: 'muted',
};

const OPCOES = ['A', 'B', 'C', 'D', 'E'] as const;

export interface PaginaRevisaoProps {
  pg: PaginaLeitura;
  situacao: Situacao;
  urls: Record<string, string>;
  somenteLeitura: boolean;
  onSalvar: (patch: RevisaoPatch) => Promise<void>;
}

export function PaginaRevisao({ pg, situacao, urls, somenteLeitura, onSalvar }: PaginaRevisaoProps) {
  const [ident, setIdent] = useState(pg.identificacao_manual ?? pg.identificacao ?? '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async (patch: RevisaoPatch) => {
    setSalvando(true);
    try {
      await onSalvar(patch);
    } finally {
      setSalvando(false);
    }
  };

  const recortes = pg.pendencias.map((p) => p.recorte).filter((r): r is string => Boolean(r));
  const precisaIdentificar = pg.destino === 'nao_identificados' || Boolean(pg.identificacao_manual);
  const duvidas = Object.entries(pg.duvidas ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const ignorada = pg.destino === 'ignorada';
  const bloqueado = somenteLeitura || salvando;

  return (
    <div
      className={cn('space-y-3 rounded-xl border bg-card p-4', pg.descartada && 'opacity-60')}
      data-testid={`pagina-${pg.pagina}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Página {pg.pagina}</span>
        <StatusPill variant={VARIANTE[situacao]}>{ROTULO_SITUACAO[situacao]}</StatusPill>
        {pg.identificacao && pg.destino === 'respostas' && (
          <span className="text-sm text-muted-foreground">lida: {pg.identificacao}</span>
        )}
        {(pg.motivo || ignorada) && (
          <span className="text-sm text-muted-foreground">{ROTULO_MOTIVO[pg.motivo] ?? ROTULO_MOTIVO[pg.status] ?? pg.motivo}</span>
        )}
      </div>

      {(recortes.length > 0 || pg.imagem) && (
        <div className="flex flex-wrap items-start gap-3">
          {recortes.map((r) =>
            urls[r] ? (
              <img key={r} src={urls[r]} alt={`Recorte da página ${pg.pagina}`} className="max-h-48 rounded border bg-white" />
            ) : null,
          )}
          {pg.imagem && urls[pg.imagem] && (
            <a href={urls[pg.imagem]} target="_blank" rel="noreferrer" title="Abrir a página inteira">
              <img src={urls[pg.imagem]} alt={`Página ${pg.pagina} inteira`} className="h-48 rounded border bg-white" />
            </a>
          )}
        </div>
      )}

      {!ignorada && precisaIdentificar && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor={`ident-${pg.id}`} className="text-xs text-muted-foreground">
              Matrícula/RA ou e-mail do aluno
            </label>
            <Input
              id={`ident-${pg.id}`}
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
              disabled={bloqueado || pg.descartada}
              className="w-64"
            />
          </div>
          <Button
            size="sm"
            onClick={() => void salvar({ identificacao_manual: ident.trim() || null })}
            disabled={bloqueado || pg.descartada || ident.trim() === (pg.identificacao_manual ?? '')}
          >
            <Check className="mr-1 h-4 w-4" /> Confirmar
          </Button>
          {pg.identificacao_manual && <span className="text-sm text-emerald-600 dark:text-emerald-400">confirmada: {pg.identificacao_manual}</span>}
        </div>
      )}

      {!ignorada && duvidas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Questões com marcação duvidosa (sem decisão, entram em branco). Confira na imagem da página.
          </p>
          {duvidas.map(([q, tipo]) => {
            const decidida = q in (pg.respostas_manual ?? {});
            const valor = pg.respostas_manual?.[q];
            const escolher = (v: string | null) =>
              void salvar({ respostas_manual: { ...(pg.respostas_manual ?? {}), [q]: v } });
            return (
              <div key={q} className="flex flex-wrap items-center gap-1">
                <span className="w-36 text-sm">
                  Questão {q} <span className="text-muted-foreground">({tipo === 'multipla' ? 'múltipla' : 'fraca'})</span>
                </span>
                {OPCOES.map((o) => (
                  <Button
                    key={o}
                    size="sm"
                    variant={decidida && valor === o ? 'default' : 'outline'}
                    className="w-9"
                    disabled={bloqueado || pg.descartada}
                    onClick={() => escolher(o)}
                    aria-label={`Questão ${q}: ${o}`}
                  >
                    {o}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={decidida && valor === null ? 'default' : 'outline'}
                  disabled={bloqueado || pg.descartada}
                  onClick={() => escolher(null)}
                  aria-label={`Questão ${q}: em branco`}
                >
                  Em branco
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!ignorada && (
        <div>
          {pg.descartada ? (
            <Button size="sm" variant="ghost" disabled={bloqueado} onClick={() => void salvar({ descartada: false })}>
              <Undo2 className="mr-1 h-4 w-4" /> Restaurar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={bloqueado} onClick={() => void salvar({ descartada: true })}>
              <Trash2 className="mr-1 h-4 w-4" /> Descartar página
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
