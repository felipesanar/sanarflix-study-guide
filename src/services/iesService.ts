/**
 * Camada de serviço para Instituições de Ensino Superior (IES).
 *
 * Centraliza queries simples sobre a tabela `ies` que apareciam
 * espalhadas (UsersTab, IesPicker, formulários). Não cobre operações
 * administrativas (criação/edição de IES) — essas ficam no portal
 * admin via RPC dedicada.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface Ies {
  id: string;
  nome: string;
}

export const iesService = {
  /**
   * Lista todas as IES disponíveis, ordenadas por nome.
   */
  async list(): Promise<Ies[]> {
    const { data, error } = await supabase
      .from('ies')
      .select('id, nome')
      .order('nome');

    if (error) {
      Logger.error('[iesService.list]', error);
      return [];
    }
    return (data ?? []) as Ies[];
  },

  /**
   * Busca uma IES por ID. Retorna null se não encontrada.
   */
  async getById(id: string): Promise<Ies | null> {
    const { data, error } = await supabase
      .from('ies')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      Logger.error('[iesService.getById]', error);
      return null;
    }
    return (data as Ies | null) ?? null;
  },
};
