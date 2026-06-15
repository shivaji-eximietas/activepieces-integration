import axios from 'axios'

import { token } from '../lib/token'
import { SeekPage } from '../lib/shared'

const INTEGRATION_SERVICE_URL =
  (import.meta.env['VITE_INTEGRATION_SERVICE_URL'] as string | undefined) ??
  'http://localhost:4000'

const integrationClient = axios.create({
  baseURL: `${INTEGRATION_SERVICE_URL}/v1`,
})

integrationClient.interceptors.request.use((config) => {
  const t = token.get()
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
})

export type IntegrationItem = {
  id: string
  name: string
  createdAt: string
}

export const integrationApi = {
  async listItems(): Promise<SeekPage<IntegrationItem>> {
    const response = await integrationClient.get<SeekPage<IntegrationItem>>('/items')
    return response.data
  },
  async health(): Promise<{ status: string }> {
    const response = await integrationClient.get<{ status: string }>('/health')
    return response.data
  },
}
