import { useRef } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { Sessao } from '../../api/types';
import { AgendasLiberadas } from './AgendasLiberadas';
import { EstadosLista } from './EstadosLista';
import { FiltrosSessoes, type OpcaoFiltro } from './FiltrosSessoes';
import { FormNovaSessaoB2c } from './FormNovaSessao';
import { TabelaSessoesB2c } from './TabelaSessoesB2c';
import { Toast } from './Toast';
import { useTelaSessoes } from './useTelaSessoes';
import { ehColetiva } from './util';

type TipoFiltroB2c = 'todas' | 'coletivas' | 'individuais';
// Tipo explícito fora do JSX: o lovable-tagger (dev) injeta atributos em elemento JSX com argumento de tipo e quebra a sintaxe.
const Filtros = FiltrosSessoes<TipoFiltroB2c>;

const OPCOES: OpcaoFiltro<TipoFiltroB2c>[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'coletivas', rotulo: 'Encontros da tribo' },
  { valor: 'individuais', rotulo: 'Individuais' },
];
const casaTipo = (s: Sessao, t: TipoFiltroB2c) => t === 'todas' || (t === 'coletivas' ? ehColetiva(s.tipo) : !ehColetiva(s.tipo));
const PAINEL = 'ms-lista-sessoes';

/** Tela 5 · Sessões (B2C): encontros da tribo e individuais + agendas liberadas. */
export function SessoesB2c() {
  const t = useTelaSessoes<TipoFiltroB2c>('todas', casaTipo);
  const botaoNova = useRef<HTMLButtonElement>(null);
  const bloco = useRef<HTMLElement>(null);
  const agora = new Date();
  const tipoInicial = t.nova === 'individual' ? 'individual' : t.nova === 'coletiva' || t.nova === 'encontro_tribo' ? 'encontro_tribo' : undefined;

  function fecharForm() {
    t.setFormAberto(false);
    requestAnimationFrame(() => botaoNova.current?.focus());
  }

  return (
    <div className="ms-tela" data-testid="mentor-sessoes">
      <header className="ms-cabecalho">
        <div><h1>Sessões</h1></div>
        <button ref={botaoNova} type="button" className="ms-btn-primario" aria-expanded={t.formAberto} aria-controls="ms-form-sessao"
          onClick={() => { t.setFormAberto(true); t.setAba('proximas'); }}>
          <Icon name="add" size={16} />Nova sessão
        </button>
      </header>

      <section ref={bloco} className="ms-bloco" tabIndex={-1} aria-label="Sessões">
        <Filtros opcoes={OPCOES} tipo={t.tipo} onTipo={t.setTipo} aba={t.aba} onAba={t.setAba} painelId={PAINEL} />
        {t.formAberto && (
          <div id="ms-form-sessao">
            <FormNovaSessaoB2c
              alunos={t.alunos.data}
              tipoInicial={tipoInicial}
              onCancelar={fecharForm}
              onToast={t.toast.mostrar}
              onSalva={(criada, msg) => {
                t.toast.mostrar(msg);
                t.setAba('proximas');
                t.definirSessao(criada.id);
                fecharForm();
              }}
            />
          </div>
        )}
        <div id={PAINEL} role="tabpanel" aria-labelledby={`${PAINEL}-aba-${t.aba}`}>
          <EstadosLista consulta={t.sessoes} vazio={t.lista.length === 0} filtrado={t.tipo !== 'todas'} onLimparFiltro={() => t.setTipo('todas')} linhas={4} alturaLinha={44}>
            <TabelaSessoesB2c
              sessoes={t.lista}
              nomeDe={t.nomeDe}
              selecionadaId={t.sessaoParam || null}
              agora={agora}
              onToast={t.toast.mostrar}
              onExcluida={() => bloco.current?.focus()}
            />
          </EstadosLista>
        </div>
      </section>

      <AgendasLiberadas nomeDe={t.nomeDe} onToast={t.toast.mostrar} />
      <Toast mensagem={t.toast.mensagem} />
    </div>
  );
}
