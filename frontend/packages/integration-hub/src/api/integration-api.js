import axios from 'axios';
import { token } from '../lib/token';
const INTEGRATION_SERVICE_URL = import.meta.env['VITE_INTEGRATION_SERVICE_URL'] ??
    'http://localhost:4000';
const integrationClient = axios.create({
    baseURL: `${INTEGRATION_SERVICE_URL}/v1`,
});
integrationClient.interceptors.request.use((config) => {
    const t = token.get();
    if (t) {
        config.headers.Authorization = `Bearer ${t}`;
    }
    return config;
});
export const integrationApi = {
    async listItems() {
        const response = await integrationClient.get('/items');
        return response.data;
    },
    async health() {
        const response = await integrationClient.get('/health');
        return response.data;
    },
};
