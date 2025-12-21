import client from './client';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

interface CoaTemplate {
  id: string;
  name: string;
  description: string;
  recommended: string;
  accountCount: number;
  complexity: 'low' | 'medium' | 'high';
}

export const systemMetadataApi = {
  /**
   * Get list of available currencies
   */
  async getCurrencies(): Promise<Currency[]> {
    try {
      const response = await client.get('/system/metadata/currencies');
      
      // Client interceptor already unwraps response.data.data
      if (Array.isArray(response)) {
        return response;
      }

      // Fallback strategies for different response shapes
      if (response && Array.isArray(response.data)) {
        return response.data;
      }
      if (response?.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      console.warn('[systemMetadataApi] Unexpected response structure for currencies:', response);
      // Return empty array instead of throwing to prevent crashing the UI completely
      return []; 
    } catch (error) {
      console.error('[systemMetadataApi] Failed to fetch currencies:', error);
      throw error;
    }
  },

  /**
   * Get list of available COA templates
   */
  async getCoaTemplates(): Promise<CoaTemplate[]> {
    try {
      const response = await client.get('/system/metadata/coa-templates');
      
      // Client interceptor already unwraps response.data.data
      if (Array.isArray(response)) {
        return response;
      }

      // Fallback strategies
      if (response && Array.isArray(response.data)) {
        return response.data;
      }
      if (response?.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      console.warn('[systemMetadataApi] Unexpected response structure for COA templates:', response);
      return [];
    } catch (error) {
      console.error('[systemMetadataApi] Failed to fetch COA templates:', error);
      throw error;
    }
  },
};
