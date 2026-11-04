import { useRef } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { TriboMe } from '../../api/fonte';
import type { Sessao } from '../../api/types';
import { EstadosLista } from './EstadosLista';
import { FiltrosSessoes, type OpcaoFiltro } from './FiltrosSessoes';
import { FormNovaSessaoB2b } from './FormNovaSessao';
import { ListaSessoesB2b } from './ListaSessoesB2b';
import { Toast } from './Toast';
import { useTelaSessoes } from './useTelaSessoes';
import { cicloContrato, ehColetiva } from './util';

type TipoFiltroB2b = 'todas' | 'pos_simulado' | 'oficina' | 'individual';
const OPCOES: OpcaoFiltro<TipoFiltroB2b>[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'pos_simulado', rotulo: 'Pós-simulado' },
  { valor: 'oficina', rotulo: 'Oficina de questões' },
  { valor: 'individual', rotulo: 'Individuais' },
];
const casaTipo = (s: Sessao, t: TipoFiltroB2b) => t === 'todas' || s.tipo === t;
const PAINEL = 'ms-lista-sessoes';

/** Faixa do ciclo do contrato (docs/03 § Tela 4). Sem contrato cadastrado, não aparece. */
function FaixaCiclo({ sessoes, encontrosPorMes, iesNome, carregado, agora }: {
  sessoes: Sessao[]; encontrosPorMes: number | null | undefined; iesNome: string | null; carregado: boolean; agora: Date;
}) {
  if (!encontrosPorMes) return null;
  const itens = carregado ? cicloContrato(sessoes, encontrosPorMes, agora) : [];
  return (
    <section className="ms-bloco ms-ciclo" aria-label="Ciclo do contrato">
      <span>
        <Icon name="documents" size={16} />
        {iesNome ? `Contrato ${iesNome}:` : 'Contrato:'} <b>{encontrosPorMes} {encontrosPorMes === 1 ? 'encontro síncrono' : 'encontros síncronos'} por mês</b>
      </span>
      {itens.map((i) => (
        <span key={i.chave} data-completo={i.completo}>
          <span className="ms-dot" aria-hidden="true" style={{ background: i.completo ? 'var(--gp-success)' : 'var(--gp-warning)' }} />
          {i.texto}
        </span>
      ))}
    </section>
  );
}

/** Tela 4 · Sessões de mentoria (B2B): lista expansível, pauta e ciclo do contrato. */
export function SessoesB2b({ tribo }: { tribo: TriboMe | null }) {
  const t = useTelaSessoes<TipoFiltroB2b>('todas', casaTipo);
  const botaoNova = useRef<HTMLButtonElement>(null);
  const bloco = useRef<HTMLElement>(null);
  const agora = new Date();
  const iesNome = tribo?.iesNome ?? null;
  const tipoInicial = t.nova === 'pos_simulado' || t.nova === 'oficina' || t.nova === 'individual' ? t.nova : undefined;
  // A próxima abre expandida (docs/03; captura b2b/09: a próxima coletiva, que é a que tem pauta e link),
  // até o mentor abrir/fechar outra; a escolha vai para a URL.
  const proxima = t.lista.find((s) => ehColetiva(s.tipo)) ?? t.lista[0];
  const abertaId = t.sessaoParam !== null ? t.sessaoParam || null : t.aba === 'proximas' ? proxima?.id ?? null : null;

  function fecharForm() {
    t.setFormAberto(false);
    requestAnimationFrame(() => botaoNova.current?.focus());
  }

  return (
    <div className="ms-tela" data-testid="mentor-sessoes">
      <header className="ms-cabecalho">
        <div><h1>Sessões de mentoria</h1></div>
        <button ref={botaoNova} type="button" className="ms-btn-primario" aria-expanded={t.formAberto} aria-controls="ms-form-sessao"
          onClick={() => t.setFormAberto(true)}>
          <Icon name="add" size={16} />Nova sessão
        </button>
      </header>

      <FaixaCiclo sessoes={t.todas} encontrosPorMes={tribo?.encontrosPorMes} iesNome={iesNome} carregado={t.sessoes.isSuccess} agora={agora} />

      {t.formAberto && (
        <div id="ms-form-sessao">
          <FormNovaSessaoB2b
            alunos={t.alunos.data}
            sessoes={t.todas}
            encontrosPorMes={tribo?.encontrosPorMes}
            iesNome={iesNome}
            tipoInicial={tipoInicial}
            onCancelar={fecharForm}
            onToast={t.toast.mostrar}
            onSalva={(criada, msg) => {
              t.toast.mostrar(msg);
              t.setAba('proximas');
              t.setTipo('todas');
              t.definirSessao(criada.id);
              fecharForm();
            }}
          />
        </div>
      )}

      <section ref={bloco} className="ms-bloco" tabIndex={-1} aria-label="Sessões">
        <FiltrosSessoes<TipoFiltroB2b> opcoes={OPCOES} tipo={t.tipo} onTipo={t.setTipo} aba={t.aba} onAba={t.setAba} painelId={PAINEL} />
        <div id={PAINEL} role="tabpanel" aria-labelledby={`${PAINEL}-aba-${t.aba}`}>
          <EstadosLista consulta={t.sessoes} vazio={t.lista.length === 0} filtrado={t.tipo !== 'todas'} onLimparFiltro={() => t.setTipo('todas')} linhas={4} alturaLinha={64}>
            <ListaSessoesB2b
              sessoes={t.lista}
              abertaId={abertaId}
              onAlternar={(id) => t.definirSessao(abertaId === id ? null : id)}
              nomeDe={t.nomeDe}
              agendaLiberada={t.agendaLiberada}
              agora={agora}
              onToast={t.toast.mostrar}
              onExcluida={() => bloco.current?.focus()}
            />
          </EstadosLista>
        </div>
      </section>
      <Toast mensagem={t.toast.mensagem} />
    </div>
  );
}
