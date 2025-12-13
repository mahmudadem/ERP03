import client from './client';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

interface CoaTemplate {
  id: string; // Changed from union type to support API
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
      console.log('[systemMetadataApi] getCurrencies response:', response);
      
      // Handle different response structures
      // Check if response itself is the array (axios interceptor already unwrapped it)
      if (Array.isArray(response)) {
        return response;
      } else if (response.data?.success && response.data?.data) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.error('[systemMetadataApi] Unexpected response structure:', response);
        throw new Error('Invalid response structure');
      }
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
      console.log('[systemMetadataApi] getCoaTemplates response:', response);
      
      // Handle different response structures
      // Check if response itself is the array (axios interceptor already unwrapped it)
      if (Array.isArray(response)) {
        return response;
      } else if (response.data?.success && response.data?.data) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.error('[systemMetadataApi] Unexpected response structure:', response);
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error('[systemMetadataApi] Failed to fetch COA templates:', error);
      throw error;
    }
  },
};
