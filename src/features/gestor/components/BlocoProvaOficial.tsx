import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag, TagCoberturaParcial } from '@/features/gestor/components/Tag';
import { formatNumero } from '@/features/gestor/lib/formatters';
import type { ProvaOficialGestor } from '@/features/gestor/api/types';

export interface BlocoProvaOficialProps {
  prova: ProvaOficialGestor;
  onVerDetalhamento: (simuladoId: string) => void;
}

/**
 * Bloco dedicado da prova oficial ENAMED (UniAtenas) na Visão Geral (Task 4).
 *
 * A prova é EXCLUÍDA de `get_gestor_visao_geral` (spec D5) e vive só aqui —
 * conceito/proficientes sempre marcados como estimativa Sanar (TRI), nunca o
 * conceito oficial do INEP (§ notice fixa no rodapé). `conceito`/
 * `proficientesPct` chegam `null` quando `comTri === 0`: nenhum aluno do
 * recorte tem `resultados_alunos_tri.score_proprio` ainda — nunca um número
 * inventado (spec §4.10).
 */
export function BlocoProvaOficial({ prova, onVerDetalhamento }: BlocoProvaOficialProps) {
  const semParticipantes = prova.participantes === 0;
  const semTri = prova.comTri === 0;

  return (
    <Card data-testid="bloco-prova-oficial" style={{ borderRadius: 'var(--gp-radius-lg)', boxShadow: 'var(--gp-shadow-card)' }}>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{prova.nome}</h2>
        <Tag variant="selo">★ Prova oficial</Tag>
      </CardHeader>
      <CardContent className="flex flex-col" style={{ gap: 12 }}>
        {semParticipantes ? (
          <p data-testid="prova-oficial-sem-participantes" style={{ fontSize: 13, color: 'var(--gp-text-3)' }}>
            Sem participantes neste recorte
          </p>
        ) : (
          <div className="flex flex-wrap items-center" style={{ gap: 14, rowGap: 8 }}>
            <span data-testid="prova-oficial-participantes" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
              {`${formatNumero(prova.participantes)} participantes`}
            </span>
            {prova.amostraPequena ? <TagCoberturaParcial n={prova.participantes} /> : null}
            {semTri ? (
              <span data-testid="prova-oficial-aguardando" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
                Aguardando cálculo da nota
              </span>
            ) : (
              <>
                <span data-testid="prova-oficial-conceito" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
                  {`conceito estimado ${Math.round(prova.conceito ?? 0)}`}
                </span>
                <span data-testid="prova-oficial-proficientes" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
                  {`${formatNumero(prova.proficientesPct)}% proficientes`}
                </span>
              </>
            )}
            <span data-testid="prova-oficial-media" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
              {`média de ${formatNumero(prova.mediaAcertos)} acertos`}
            </span>
          </div>
        )}

        <p data-testid="prova-oficial-aviso" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
          Estimativa Sanar (TRI) com gabarito preliminar. O conceito oficial é divulgado pelo INEP.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-fit gap-1.5"
          onClick={() => onVerDetalhamento(prova.simuladoId)}
        >
          Ver detalhamento
          <Icon name="chevron_right" size={14} />
        </Button>
      </CardContent>
    </Card>
  );
}
