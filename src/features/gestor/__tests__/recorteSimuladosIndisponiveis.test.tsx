import { describe, expect, it } from 'vitest';
import { motivoIndisponivel } from '@/features/gestor/components/SeletorSimulados';
import type { ItemCronograma } from '@/features/gestor/api/types';

/**
 * Reconciliação entre o recorte que vem da URL e o status do cronograma.
 *
 * O bug: `?simulados=<id>` era injetado cru em `filtrosGestor`. Se o id fosse
 * de um simulado previsto ou com gabarito em processamento, (a) as métricas
 * eram pedidas e renderizadas para ele — violando "gabarito em processamento →
 * nenhum número é exibido" (spec §10.4) — e (b) o item aparecia marcado E
 * desabilitado no seletor, deixando o estado "desmarcado" inalcançável.
 *
 * A regra que `Detalhamento.tsx` aplica está replicada aqui como função pura
 * para poder ser exercitada sem montar a rota inteira.
 */
function recorteValido(selecionados: string[], itens: ItemCronograma[]): string[] {
  if (itens.length === 0) return selecionados;
  const disponiveis = new Set(
    itens.filter((item) => motivoIndisponivel(item) === null).map((item) => item.id),
  );
  return selecionados.filter((id) => disponiveis.has(id));
}

const item = (id: string, status: ItemCronograma['status']): ItemCronograma => ({
  id,
  nome: id,
  status,
  data: '2026-06-02',
  modalidade: 'online',
  participantes: null,
  indisponivelPorque: null,
});

describe('recorte de simulados vindo da URL', () => {
  const cronograma: ItemCronograma[] = [
    item('realizado-1', 'realizado'),
    item('processando-1', 'processing'),
    item('previsto-1', 'previsto'),
    item('agendado-1', 'agendado'),
  ];

  it('descarta simulado com gabarito em processamento', () => {
    expect(recorteValido(['realizado-1', 'processando-1'], cronograma)).toEqual(['realizado-1']);
  });

  it('descarta agendado e reagendado — ainda não têm resultado', () => {
    expect(recorteValido(['agendado-1', 'realizado-1'], cronograma)).toEqual(['realizado-1']);
  });

  it('descarta simulado previsto', () => {
    expect(recorteValido(['previsto-1'], cronograma)).toEqual([]);
  });

  it('mantém o que é legítimo, na ordem em que veio', () => {
    expect(recorteValido(['realizado-1'], cronograma)).toEqual(['realizado-1']);
  });

  it('um recorte inteiramente inválido vira vazio — e vazio é o estado sem métrica', () => {
    expect(recorteValido(['processando-1', 'previsto-1'], cronograma)).toEqual([]);
  });

  /**
   * Antes do cronograma chegar não dá para distinguir "id inválido" de "ainda
   * não sei". Descartar cedo faria a seleção piscar para vazio em todo primeiro
   * render e dispararia um estado vazio falso.
   */
  it('não descarta nada enquanto o cronograma não chegou', () => {
    expect(recorteValido(['qualquer-id'], [])).toEqual(['qualquer-id']);
  });

  it('id que não existe no cronograma não entra no recorte', () => {
    expect(recorteValido(['id-fantasma'], cronograma)).toEqual([]);
  });
});
