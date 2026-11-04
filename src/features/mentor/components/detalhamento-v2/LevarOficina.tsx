import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '@/features/mentor/api/erros';
import { useEditarSessao, useSessoes } from '@/features/mentor/api/queries';
import type { Sessao, SimuladoMentor } from '@/features/mentor/api/types';

const ddmm = (data: string) => (/^\d{4}-(\d{2})-(\d{2})/.exec(data) ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : data);

/** Próxima oficina agendada (hoje ou depois), em ordem cronológica. */
export function proximaOficina(sessoes: Sessao[] | undefined, hoje: string): Sessao | null {
  return [...(sessoes ?? [])]
    .filter((s) => s.tipo === 'oficina' && s.status === 'agendada' && s.data >= hoje)
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`))[0] ?? null;
}

/**
 * B2B (docs/03 § Tela 3 · Questões): "Levar para a oficina de {data}" põe "20 questões mais erradas do
 * {simulado}" na pauta da próxima oficina; depois vira "Na pauta da oficina de {data}" (verde).
 */
export function LevarOficina({ simulado, onToast }: { simulado: SimuladoMentor | null; onToast: (t: string) => void }) {
  const sessoes = useSessoes({ tipo: 'oficina', status: 'agendada' });
  const editar = useEditarSessao();
  const hoje = new Date().toISOString().slice(0, 10);
  const oficina = proximaOficina(sessoes.data?.data, hoje);
  if (!simulado || sessoes.isLoading) return null;
  if (!oficina) {
    return (
      <button type="button" disabled title="Nenhuma oficina agendada" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap opacity-60"
        style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--gp-border-strong)', fontSize: 12.5, fontWeight: 600 }}>
        <Icon name="calendar_month" size={14} />
        Levar para a oficina
      </button>
    );
  }
  const data = ddmm(oficina.data);
  const naPauta = oficina.pauta.some((p) => p.origem === 'mais_erradas' && p.referenciaId === simulado.id);
  if (naPauta) {
    return (
      <span role="status" data-testid="oficina-na-pauta" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap"
        style={{ padding: '0 12px', borderRadius: 8, background: 'var(--gp-success-surface)', color: 'var(--gp-success-on)', fontSize: 12.5, fontWeight: 600 }}>
        <Icon name="check" size={14} />
        Na pauta da oficina de {data}
      </span>
    );
  }
  const levar = async () => {
    const pauta = [
      ...oficina.pauta.map((p, i) => ({ texto: p.texto, origem: p.origem, referenciaId: p.referenciaId ?? undefined, ordem: i })),
      { texto: `20 questões mais erradas do ${simulado.nome}`, origem: 'mais_erradas' as const, referenciaId: simulado.id, ordem: oficina.pauta.length },
    ];
    try {
      await editar.mutateAsync({ id: oficina.id, mudancas: { pauta } });
      onToast(`As 20 mais erradas do ${simulado.nome} entraram na pauta da oficina de ${data}`);
    } catch (e) {
      onToast(mensagemErro(e));
    }
  };
  return (
    <button type="button" onClick={() => void levar()} disabled={editar.isPending}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap hover:bg-[#7A1818] disabled:opacity-60"
      style={{ padding: '0 12px', borderRadius: 8, background: '#941F1F', color: '#FFFFFF', fontSize: 12.5, fontWeight: 600 }}>
      <Icon name="calendar_month" size={14} />
      Levar para a oficina de {data}
    </button>
  );
}
