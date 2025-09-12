const CRONOGRAMA_API_URL = 'https://api-enamed-b2c.onrender.com/api/cronograma';

export interface CronogramaEnamedItem {
  id: string;
  titulo: string;
  descricao: string;
  area_conhecimento: string;
  data_aula?: string;
  link_aula?: string;
  link_gratuito?: string;
}

export interface CronogramaEnamedResponse {
  success: boolean;
  data: CronogramaEnamedItem[];
  message?: string;
}

export const cronogramaEnamedApi = {
  async getAllContent(): Promise<CronogramaEnamedItem[]> {
    try {
      const response = await fetch(CRONOGRAMA_API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch cronograma content');
      }
      
      const data = await response.json();
      
      // Handle different response structures
      if (Array.isArray(data)) {
        return data;
      } else if (data.data && Array.isArray(data.data)) {
        return data.data;
      } else if (data.success && data.data && Array.isArray(data.data)) {
        return data.data;
      }
      
      return [];
    } catch (error) {
      throw error;
    }
  }
};