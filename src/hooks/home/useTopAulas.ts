import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TopAula } from '@/hooks/useHomeData';

interface User {
  id: string;
  id_ies?: string;
  semestre?: number;
}

/**
 * Hook extraído de useHomeData para buscar top aulas
 * Responsável por: aulas mais acessadas e conteúdos relacionados
 */
export const useTopAulas = () => {
  const [topAulas, setTopAulas] = useState<TopAula[]>([]);
  const [conteudosRelacionados, setConteudosRelacionados] = useState<Array<{
    id: string;
    conteudo: string;
    curso: string;
    link: string;
  }>>([]);

  const fetchTopAulas = async (user: User) => {
    if (!user?.id_ies || !user?.semestre) return undefined;

    const base = () =>
      supabase
        .from('dados_meu_semestre')
        .select('id, id_ies, semestre, curso, modulo, conteudo, tipo_conteudo, total_acessos, link_acesso');

    let data: Array<{
      id: string;
      conteudo: string | null;
      modulo: string | null;
      curso: string | null;
      tipo_conteudo: string | null;
      link_acesso: string | null;
    }> | null = null;

    // Tentar diferentes queries
    const attempts = [
      () => base().in('id_ies', [user.id_ies]).in('semestre', [user.semestre!]).order('total_acessos', { ascending: false }).limit(12),
      () => base().eq('id_ies', user.id_ies!).eq('semestre', user.semestre!).order('total_acessos', { ascending: false }).limit(12),
      () => base().in('id_ies', [user.id_ies!, String(user.id_ies)]).order('total_acessos', { ascending: false }).limit(12),
    ];

    for (const attempt of attempts) {
      const res = await attempt();
      if (res.data && res.data.length > 0) {
        data = res.data;
        break;
      }
    }

    // Fallback via RPC
    if (!data || data.length === 0) {
      try {
        const { data: iesServer } = await supabase.rpc('get_current_user_ies_id');
        const { data: semServer } = await supabase.rpc('get_current_user_semester');
        if (iesServer) {
          let srvQuery = base().in('id_ies', [iesServer, String(iesServer)]);
          if (semServer !== null && semServer !== undefined) {
            srvQuery = srvQuery.in('semestre', [semServer]);
          }
          const srvRes = await srvQuery.order('total_acessos', { ascending: false }).limit(12);
          data = srvRes.data;
        }
      } catch {}
    }

    if (data && data.length > 0) {
      const aulas = data.slice(0, 3).map((item) => ({
        id: item.id,
        conteudo: ['questões', 'aula'].includes(String(item.conteudo || '').toLowerCase())
          ? (item.modulo || item.curso || 'Conteúdo')
          : (item.conteudo || 'Sem título'),
        curso: item.curso || 'Curso',
        link: item.link_acesso || '#',
        tipo: String(item.tipo_conteudo || '').toLowerCase().includes('quest') ? 'questoes' as const : 'videos' as const,
      }));
      setTopAulas(aulas);

      const relacionados = data.slice(3, 9).map((item) => ({
        id: item.id,
        conteudo: ['questões', 'aula'].includes(String(item.conteudo || '').toLowerCase())
          ? (item.modulo || item.curso || 'Conteúdo')
          : (item.conteudo || 'Conteúdo'),
        curso: item.curso || 'Curso',
        link: item.link_acesso || '#',
      }));
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }

    // Fallback final: tabela conteudos
    const { data: conteudosData } = await supabase
      .from('conteudos')
      .select('id, aula, materia, link_aula, link_quiz')
      .eq('id_ies', user.id_ies)
      .eq('semestre', user.semestre.toString())
      .not('link_aula', 'is', null)
      .limit(12);

    if (conteudosData && conteudosData.length > 0) {
      const aulas = conteudosData.slice(0, 3).map((item) => ({
        id: item.id,
        conteudo: ['questões', 'aula'].includes(String(item.aula || '').toLowerCase())
          ? (item.materia || 'Conteúdo')
          : (item.aula || 'Sem título'),
        curso: item.materia || 'Matéria',
        link: item.link_quiz || item.link_aula || '#',
        tipo: item.link_quiz ? 'questoes' as const : 'videos' as const,
      }));
      const relacionados = conteudosData.slice(3, 9).map((item) => ({
        id: item.id,
        conteudo: ['questões', 'aula'].includes(String(item.aula || '').toLowerCase())
          ? (item.materia || 'Conteúdo')
          : (item.aula || 'Conteúdo'),
        curso: item.materia || 'Matéria',
        link: item.link_quiz || item.link_aula || '#',
      }));
      setTopAulas(aulas);
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }

    return undefined;
  };

  return { topAulas, conteudosRelacionados, fetchTopAulas };
};
