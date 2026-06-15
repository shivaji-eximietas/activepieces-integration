import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { IntegrationHubPage } from './components/IntegrationHubPage';
import './index.css';
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(IntegrationHubPage, {}) }) }));
