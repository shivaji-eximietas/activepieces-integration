import { SeekPage } from '@activepieces/shared';

import { integrationClient } from '../lib/integration-client';

export type IntegrationItem = {
  id: string;
  name: string;
  createdAt: string;
};

export const integrationApi = {
  async listItems(): Promise<SeekPage<IntegrationItem>> {
    const response =
      await integrationClient.get<SeekPage<IntegrationItem>>('/items');
    return response.data;
  },
  async health(): Promise<{ status: string }> {
    const response = await integrationClient.get<{ status: string }>('/health');
    return response.data;
  },
};
