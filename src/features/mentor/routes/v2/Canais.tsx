import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataHoraSp } from '../../api/fonteAcademy';
import { hojeRotina } from '../../api/queries';
import { BancoPerolas } from '../../components/canais/BancoPerolas';
import { CanaisGerais } from '../../components/canais/CanaisGerais';
import { ComiteIes } from '../../components/canais/ComiteIes';
import { PARAMS_MURAL, rascunhoDaUrl } from '../../components/canais/deepLink';
import { MuralCanais } from '../../components/canais/MuralCanais';
import { RotinaWhatsApp } from '../../components/canais/RotinaWhatsApp';
import { ToastCanais, useToastCanais } from '../../components/canais/ToastCanais';

/**
 * Canais (B2B · docs/03 § Tela 5, docs/08 6.5): grupo de WhatsApp com a rotina da semana, Canais
 * gerais, Mural no Academy, Comitê pedagógico e Banco de pérolas. O Academy não envia nada no
 * WhatsApp: o mentor envia no app e marca aqui.
 */
export default function Canais() {
  const [params, setParams] = useSearchParams();
  // O deep link abre o composer uma vez; os parâmetros saem da URL para não reabrir no voltar.
  const [rascunho] = useState(() => rascunhoDaUrl(params));
  useEffect(() => {
    if (!PARAMS_MURAL.some((k) => params.has(k))) return;
    const limpo = new URLSearchParams(params);
    PARAMS_MURAL.forEach((k) => limpo.delete(k));
    setParams(limpo, { replace: true });
  }, [params, setParams]);

  const { hoje, semana } = useMemo(() => {
    const agora = new Date();
    return { hoje: dataHoraSp(agora.toISOString()).data, semana: hojeRotina(agora).semana };
  }, []);
  const { mensagem, mostrar } = useToastCanais();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Canais</h1>
      </header>
      <div className="flex min-w-0 flex-wrap items-start gap-5">
        <RotinaWhatsApp semana={semana} hoje={hoje} onToast={mostrar} />
        <div className="flex min-w-0 shrink grow basis-[300px] flex-col gap-5">
          <CanaisGerais />
          <MuralCanais inicial={rascunho} onToast={mostrar} />
          <ComiteIes />
        </div>
      </div>
      <BancoPerolas hoje={hoje} />
      <ToastCanais mensagem={mensagem} />
    </div>
  );
}
