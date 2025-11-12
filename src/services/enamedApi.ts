import { fetchWithCache } from '@/utils/performanceCache';
import { env } from '@/config/env';
import { apiFetch } from '@/services/apiClient';

const ENAMED_API_BASE_URL = env.ENAMED_API_BASE_URL;

export interface EnamedContent {
  id: string;
  week: number;
  day: number;
  tema: string;
  disciplina: string;
  tipo: string;
  url?: string;
}

export const enamedApi = {
  async getAllContent(): Promise<EnamedContent[]> {
    return fetchWithCache(
      'enamed_all_content',
      async () => {
        try {
          const response = await apiFetch(`${ENAMED_API_BASE_URL}`);
          if (!response.ok) {
            throw new Error('Failed to fetch ENAMED content');
          }
          return await response.json();
        } catch (error) {
          throw error;
        }
      },
      30 * 60 * 1000 // 30 minutos
    );
  },

  async getContentByWeek(week: number): Promise<EnamedContent[]> {
    return fetchWithCache(
      `enamed_week_${week}`,
      async () => {
        try {
          const response = await apiFetch(`${ENAMED_API_BASE_URL}?week=${week}`);
          if (!response.ok) {
            throw new Error('Failed to fetch ENAMED content by week');
          }
          return await response.json();
        } catch (error) {
          throw error;
        }
      },
      30 * 60 * 1000 // 30 minutos
    );
  },

  async getContentByDiscipline(disciplina: string): Promise<EnamedContent[]> {
    return fetchWithCache(
      `enamed_discipline_${disciplina}`,
      async () => {
        try {
          const response = await apiFetch(`${ENAMED_API_BASE_URL}?disciplina=${encodeURIComponent(disciplina)}`);
          if (!response.ok) {
            throw new Error('Failed to fetch ENAMED content by discipline');
          }
          return await response.json();
        } catch (error) {
          throw error;
        }
      },
      30 * 60 * 1000 // 30 minutos
    );
  }
};
