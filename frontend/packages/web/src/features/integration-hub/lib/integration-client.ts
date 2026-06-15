import axios from 'axios';

import { authenticationSession } from '@/lib/authentication-session';

const INTEGRATION_SERVICE_URL =
  import.meta.env.VITE_INTEGRATION_SERVICE_URL ?? 'http://localhost:4000';

export const integrationClient = axios.create({
  baseURL: `${INTEGRATION_SERVICE_URL}/v1`,
});

integrationClient.interceptors.request.use((config) => {
  const token = authenticationSession.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
