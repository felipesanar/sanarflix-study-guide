const ENAMED_API_BASE_URL = 'https://api-conteudos-enamed.onrender.com/api/cronograma';

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
    try {
      const response = await fetch(`${ENAMED_API_BASE_URL}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ENAMED content');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching ENAMED content:', error);
      throw error;
    }
  },

  async getContentByWeek(week: number): Promise<EnamedContent[]> {
    try {
      const response = await fetch(`${ENAMED_API_BASE_URL}?week=${week}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ENAMED content by week');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching ENAMED content by week:', error);
      throw error;
    }
  },

  async getContentByDiscipline(disciplina: string): Promise<EnamedContent[]> {
    try {
      const response = await fetch(`${ENAMED_API_BASE_URL}?disciplina=${encodeURIComponent(disciplina)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ENAMED content by discipline');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching ENAMED content by discipline:', error);
      throw error;
    }
  }
};